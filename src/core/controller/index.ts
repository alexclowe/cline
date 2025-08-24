import { Anthropic } from "@anthropic-ai/sdk"
import { buildApiHandler } from "@core/api"
import { cleanupLegacyCheckpoints } from "@integrations/checkpoints/CheckpointMigration"
import { downloadTask } from "@integrations/misc/export-markdown"
import { ClineAccountService } from "@services/account/ClineAccountService"
import { McpHub } from "@services/mcp/McpHub"
import { ApiProvider, ModelInfo } from "@shared/api"
import { ChatContent } from "@shared/ChatContent"
import { ExtensionState, Platform } from "@shared/ExtensionMessage"
import { HistoryItem } from "@shared/HistoryItem"
import { McpMarketplaceCatalog } from "@shared/mcp"
import { Mode } from "@shared/storage/types"
import { TelemetrySetting } from "@shared/TelemetrySetting"
import { UserInfo } from "@shared/UserInfo"
import { fileExistsAtPath } from "@utils/fs"
import axios from "axios"
import fs from "fs/promises"
import pWaitFor from "p-wait-for"
import * as path from "path"
import * as vscode from "vscode"
import { clineEnvConfig } from "@/config"
import { HostProvider } from "@/hosts/host-provider"
import { AuthService } from "@/services/auth/AuthService"
import { PostHogClientProvider, telemetryService } from "@/services/posthog/PostHogClientProvider"
import { ShowMessageType } from "@/shared/proto/host/window"
import { getLatestAnnouncementId } from "@/utils/announcements"
import { getCwd, getDesktopDir } from "@/utils/path"
import { EventBus } from "../../core/event-bus"
import { ConsoleLogger } from "../../core/logger"
import { MemoryManager } from "../../memory/manager"
import { ClaudeFlowOrchestrator, OrchestrationConfig, OrchestrationMode } from "../../orchestration/ClaudeFlowOrchestrator"
import { SwarmCoordinator } from "../../swarm/coordinator"
import type { MemoryConfig } from "../../utils/types"
import { CacheService, PersistenceErrorEvent } from "../storage/CacheService"
import { ensureMcpServersDirectoryExists, ensureSettingsDirectoryExists, GlobalFileNames } from "../storage/disk"
import { Task } from "../task"
import { sendMcpMarketplaceCatalogEvent } from "./mcp/subscribeToMcpMarketplaceCatalog"
import { sendStateUpdate } from "./state/subscribeToState"

/*
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/blob/main/default/weather-webview/src/providers/WeatherViewProvider.ts

https://github.com/KumarVariable/vscode-extension-sidebar-html/blob/master/src/customSidebarViewProvider.ts
*/

export class Controller {
	readonly id: string
	private disposables: vscode.Disposable[] = []
	task?: Task

	mcpHub: McpHub
	accountService: ClineAccountService
	authService: AuthService
	readonly cacheService: CacheService

	// Claude-Flow Orchestration components (optional)
	private claudeFlowOrchestrator?: ClaudeFlowOrchestrator
	private swarmCoordinator?: SwarmCoordinator
	private memoryManager?: MemoryManager
	private orchestrationEnabled: boolean = false

	// Public getters for orchestration components (required for RPC handlers)
	get claudeFlowOrchestratorInstance(): ClaudeFlowOrchestrator | undefined {
		return this.claudeFlowOrchestrator
	}

	get isOrchestrationEnabled(): boolean {
		return this.orchestrationEnabled
	}

	constructor(
		readonly context: vscode.ExtensionContext,
		id: string,
	) {
		this.id = id

		HostProvider.get().logToChannel("ClineProvider instantiated")
		this.accountService = ClineAccountService.getInstance()
		this.cacheService = new CacheService(context)
		this.authService = AuthService.getInstance(this)

		// Initialize cache service asynchronously - critical for extension functionality
		this.cacheService
			.initialize()
			.then(() => {
				this.authService.restoreRefreshTokenAndRetrieveAuthInfo()
			})
			.catch((error) => {
				console.error("CRITICAL: Failed to initialize CacheService - extension may not function properly:", error)
			})

		// Set up persistence error recovery
		this.cacheService.onPersistenceError = async ({ error }: PersistenceErrorEvent) => {
			console.error("Cache persistence failed, recovering:", error)
			try {
				await this.cacheService.reInitialize()
				await this.postStateToWebview()
				HostProvider.window.showMessage({
					type: ShowMessageType.WARNING,
					message: "Saving settings to storage failed.",
				})
			} catch (recoveryError) {
				console.error("Cache recovery failed:", recoveryError)
				HostProvider.window.showMessage({
					type: ShowMessageType.ERROR,
					message: "Failed to save settings. Please restart the extension.",
				})
			}
		}

		this.mcpHub = new McpHub(
			() => ensureMcpServersDirectoryExists(),
			() => ensureSettingsDirectoryExists(this.context),
			this.context.extension?.packageJSON?.version ?? "1.0.0",
			telemetryService,
		)

		// Clean up legacy checkpoints
		cleanupLegacyCheckpoints(this.context.globalStorageUri.fsPath).catch((error) => {
			console.error("Failed to cleanup legacy checkpoints:", error)
		})
	}

	async getCurrentMode(): Promise<Mode> {
		return this.cacheService.getGlobalStateKey("mode")
	}

	/*
	VSCode extensions use the disposable pattern to clean up resources when the sidebar/editor tab is closed by the user or system. This applies to event listening, commands, interacting with the UI, etc.
	- https://vscode-docs.readthedocs.io/en/stable/extensions/patterns-and-principles/
	- https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	*/
	async dispose() {
		await this.clearTask()
		while (this.disposables.length) {
			const x = this.disposables.pop()
			if (x) {
				x.dispose()
			}
		}
		this.mcpHub.dispose()

		console.error("Controller disposed")
	}

	// Auth methods
	async handleSignOut() {
		try {
			// TODO: update to clineAccountId and then move clineApiKey to a clear function.
			this.cacheService.setSecret("clineAccountId", undefined)
			this.cacheService.setGlobalState("userInfo", undefined)

			// Update API providers through cache service
			const apiConfiguration = this.cacheService.getApiConfiguration()
			const updatedConfig = {
				...apiConfiguration,
				planModeApiProvider: "openrouter" as ApiProvider,
				actModeApiProvider: "openrouter" as ApiProvider,
			}
			this.cacheService.setApiConfiguration(updatedConfig)

			await this.postStateToWebview()
			HostProvider.window.showMessage({
				type: ShowMessageType.INFORMATION,
				message: "Successfully logged out of Cline",
			})
		} catch (_error) {
			HostProvider.window.showMessage({
				type: ShowMessageType.INFORMATION,
				message: "Logout failed",
			})
		}
	}

	async setUserInfo(info?: UserInfo) {
		this.cacheService.setGlobalState("userInfo", info)
	}

	async initTask(task?: string, images?: string[], files?: string[], historyItem?: HistoryItem) {
		await this.clearTask() // ensures that an existing task doesn't exist before starting a new one, although this shouldn't be possible since user must clear task before starting a new one

		// Initialize orchestration system if not already done
		if (!this.orchestrationEnabled) {
			await this.initializeOrchestration()
		}

		// Check if this task should use orchestration
		if (task && this.shouldUseOrchestration(task)) {
			try {
				console.log("Task complexity assessment suggests orchestration - attempting orchestrated execution")
				const result = await this.attemptOrchestration(task, images, files, historyItem)
				if (result.success) {
					console.log("Orchestrated execution completed successfully")
					return
				}
				console.log("Orchestrated execution failed, falling back to standard execution:", result.error)
			} catch (error) {
				console.error("Orchestration failed, falling back to standard execution:", error)
			}
		}

		const apiConfiguration = this.cacheService.getApiConfiguration()
		const autoApprovalSettings = this.cacheService.getGlobalStateKey("autoApprovalSettings")
		const browserSettings = this.cacheService.getGlobalStateKey("browserSettings")
		const focusChainSettings = this.cacheService.getGlobalStateKey("focusChainSettings")
		const focusChainFeatureFlagEnabled = this.cacheService.getGlobalStateKey("focusChainFeatureFlagEnabled")
		const preferredLanguage = this.cacheService.getGlobalStateKey("preferredLanguage")
		const openaiReasoningEffort = this.cacheService.getGlobalStateKey("openaiReasoningEffort")
		const mode = this.cacheService.getGlobalStateKey("mode")
		const shellIntegrationTimeout = this.cacheService.getGlobalStateKey("shellIntegrationTimeout")
		const terminalReuseEnabled = this.cacheService.getGlobalStateKey("terminalReuseEnabled")
		const terminalOutputLineLimit = this.cacheService.getGlobalStateKey("terminalOutputLineLimit")
		const defaultTerminalProfile = this.cacheService.getGlobalStateKey("defaultTerminalProfile")
		const enableCheckpointsSetting = this.cacheService.getGlobalStateKey("enableCheckpointsSetting")
		const isNewUser = this.cacheService.getGlobalStateKey("isNewUser")
		const taskHistory = this.cacheService.getGlobalStateKey("taskHistory")
		const strictPlanModeEnabled = this.cacheService.getGlobalStateKey("strictPlanModeEnabled")
		const useAutoCondense = this.cacheService.getGlobalStateKey("useAutoCondense")

		const NEW_USER_TASK_COUNT_THRESHOLD = 10

		// Check if the user has completed enough tasks to no longer be considered a "new user"
		if (isNewUser && !historyItem && taskHistory && taskHistory.length >= NEW_USER_TASK_COUNT_THRESHOLD) {
			this.cacheService.setGlobalState("isNewUser", false)
			await this.postStateToWebview()
		}

		if (autoApprovalSettings) {
			const updatedAutoApprovalSettings = {
				...autoApprovalSettings,
				version: (autoApprovalSettings.version ?? 1) + 1,
			}
			this.cacheService.setGlobalState("autoApprovalSettings", updatedAutoApprovalSettings)
		}
		// Apply remote feature flag gate to focus chain settings
		const effectiveFocusChainSettings = {
			...(focusChainSettings || { enabled: true, remindClineInterval: 6 }),
			enabled: Boolean(focusChainSettings?.enabled) && Boolean(focusChainFeatureFlagEnabled),
		}

		this.task = new Task(
			this,
			this.mcpHub,
			(historyItem) => this.updateTaskHistory(historyItem),
			() => this.postStateToWebview(),
			(taskId) => this.reinitExistingTaskFromId(taskId),
			() => this.cancelTask(),
			apiConfiguration,
			autoApprovalSettings,
			browserSettings,
			effectiveFocusChainSettings,
			preferredLanguage,
			openaiReasoningEffort,
			mode,
			strictPlanModeEnabled ?? true,
			useAutoCondense ?? true,
			shellIntegrationTimeout,
			terminalReuseEnabled ?? true,
			terminalOutputLineLimit ?? 500,
			defaultTerminalProfile ?? "default",
			enableCheckpointsSetting ?? true,
			await getCwd(getDesktopDir()),
			this.cacheService,
			task,
			images,
			files,
			historyItem,
		)
	}

	async reinitExistingTaskFromId(taskId: string) {
		const history = await this.getTaskWithId(taskId)
		if (history) {
			await this.initTask(undefined, undefined, undefined, history.historyItem)
		}
	}

	async updateTelemetrySetting(telemetrySetting: TelemetrySetting) {
		this.cacheService.setGlobalState("telemetrySetting", telemetrySetting)
		const isOptedIn = telemetrySetting !== "disabled"
		telemetryService.updateTelemetryState(isOptedIn)
		await this.postStateToWebview()
	}

	async togglePlanActMode(modeToSwitchTo: Mode, chatContent?: ChatContent): Promise<boolean> {
		const didSwitchToActMode = modeToSwitchTo === "act"

		// Store mode to global state
		this.cacheService.setGlobalState("mode", modeToSwitchTo)

		// Capture mode switch telemetry | Capture regardless of if we know the taskId
		telemetryService.captureModeSwitch(this.task?.ulid ?? "0", modeToSwitchTo)

		// Update API handler with new mode (buildApiHandler now selects provider based on mode)
		if (this.task) {
			const apiConfiguration = this.cacheService.getApiConfiguration()
			this.task.api = buildApiHandler({ ...apiConfiguration, ulid: this.task.ulid }, modeToSwitchTo)
		}

		await this.postStateToWebview()

		if (this.task) {
			this.task.updateMode(modeToSwitchTo)
			if (this.task.taskState.isAwaitingPlanResponse && didSwitchToActMode) {
				this.task.taskState.didRespondToPlanAskBySwitchingMode = true
				// Use chatContent if provided, otherwise use default message
				await this.task.handleWebviewAskResponse(
					"messageResponse",
					chatContent?.message || "PLAN_MODE_TOGGLE_RESPONSE",
					chatContent?.images || [],
					chatContent?.files || [],
				)

				return true
			} else {
				this.cancelTask()
				return false
			}
		}

		return false
	}

	async cancelTask() {
		if (this.task) {
			const { historyItem } = await this.getTaskWithId(this.task.taskId)
			try {
				await this.task.abortTask()
			} catch (error) {
				console.error("Failed to abort task", error)
			}
			await pWaitFor(
				() =>
					this.task === undefined ||
					this.task.taskState.isStreaming === false ||
					this.task.taskState.didFinishAbortingStream ||
					this.task.taskState.isWaitingForFirstChunk, // if only first chunk is processed, then there's no need to wait for graceful abort (closes edits, browser, etc)
				{
					timeout: 3_000,
				},
			).catch(() => {
				console.error("Failed to abort task")
			})
			if (this.task) {
				// 'abandoned' will prevent this cline instance from affecting future cline instance gui. this may happen if its hanging on a streaming request
				this.task.taskState.abandoned = true
			}
			await this.initTask(undefined, undefined, undefined, historyItem) // clears task again, so we need to abortTask manually above
			// Dont send the state to the webview, the new Cline instance will send state when it's ready.
			// Sending the state here sent an empty messages array to webview leading to virtuoso having to reload the entire list
		}
	}

	async handleAuthCallback(customToken: string, provider: string | null = null) {
		try {
			await this.authService.handleAuthCallback(customToken, provider ? provider : "google")

			const clineProvider: ApiProvider = "cline"

			// Get current settings to determine how to update providers
			const planActSeparateModelsSetting = this.cacheService.getGlobalStateKey("planActSeparateModelsSetting")

			const currentMode = await this.getCurrentMode()

			// Get current API configuration from cache
			const currentApiConfiguration = this.cacheService.getApiConfiguration()

			const updatedConfig = { ...currentApiConfiguration }

			if (planActSeparateModelsSetting) {
				// Only update the current mode's provider
				if (currentMode === "plan") {
					updatedConfig.planModeApiProvider = clineProvider
				} else {
					updatedConfig.actModeApiProvider = clineProvider
				}
			} else {
				// Update both modes to keep them in sync
				updatedConfig.planModeApiProvider = clineProvider
				updatedConfig.actModeApiProvider = clineProvider
			}

			// Update the API configuration through cache service
			this.cacheService.setApiConfiguration(updatedConfig)

			// Mark welcome view as completed since user has successfully logged in
			this.cacheService.setGlobalState("welcomeViewCompleted", true)

			if (this.task) {
				this.task.api = buildApiHandler({ ...updatedConfig, ulid: this.task.ulid }, currentMode)
			}

			await this.postStateToWebview()
		} catch (error) {
			console.error("Failed to handle auth callback:", error)
			HostProvider.window.showMessage({
				type: ShowMessageType.ERROR,
				message: "Failed to log in to Cline",
			})
			// Even on login failure, we preserve any existing tokens
			// Only clear tokens on explicit logout
		}
	}

	// MCP Marketplace
	private async fetchMcpMarketplaceFromApi(silent: boolean = false): Promise<McpMarketplaceCatalog | undefined> {
		try {
			const response = await axios.get(`${clineEnvConfig.mcpBaseUrl}/marketplace`, {
				headers: {
					"Content-Type": "application/json",
				},
			})

			if (!response.data) {
				throw new Error("Invalid response from MCP marketplace API")
			}

			const catalog: McpMarketplaceCatalog = {
				items: (response.data || []).map((item: any) => ({
					...item,
					githubStars: item.githubStars ?? 0,
					downloadCount: item.downloadCount ?? 0,
					tags: item.tags ?? [],
				})),
			}

			// Store in global state
			this.cacheService.setGlobalState("mcpMarketplaceCatalog", catalog)
			return catalog
		} catch (error) {
			console.error("Failed to fetch MCP marketplace:", error)
			if (!silent) {
				const errorMessage = error instanceof Error ? error.message : "Failed to fetch MCP marketplace"
				HostProvider.window.showMessage({
					type: ShowMessageType.ERROR,
					message: errorMessage,
				})
			}
			return undefined
		}
	}

	private async fetchMcpMarketplaceFromApiRPC(silent: boolean = false): Promise<McpMarketplaceCatalog | undefined> {
		try {
			const response = await axios.get(`${clineEnvConfig.mcpBaseUrl}/marketplace`, {
				headers: {
					"Content-Type": "application/json",
					"User-Agent": "cline-vscode-extension",
				},
			})

			if (!response.data) {
				throw new Error("Invalid response from MCP marketplace API")
			}

			const catalog: McpMarketplaceCatalog = {
				items: (response.data || []).map((item: any) => ({
					...item,
					githubStars: item.githubStars ?? 0,
					downloadCount: item.downloadCount ?? 0,
					tags: item.tags ?? [],
				})),
			}

			// Store in global state
			this.cacheService.setGlobalState("mcpMarketplaceCatalog", catalog)
			return catalog
		} catch (error) {
			console.error("Failed to fetch MCP marketplace:", error)
			if (!silent) {
				const errorMessage = error instanceof Error ? error.message : "Failed to fetch MCP marketplace"
				throw new Error(errorMessage)
			}
			return undefined
		}
	}

	async silentlyRefreshMcpMarketplace() {
		try {
			const catalog = await this.fetchMcpMarketplaceFromApi(true)
			if (catalog) {
				await sendMcpMarketplaceCatalogEvent(catalog)
			}
		} catch (error) {
			console.error("Failed to silently refresh MCP marketplace:", error)
		}
	}

	/**
	 * RPC variant that silently refreshes the MCP marketplace catalog and returns the result
	 * Unlike silentlyRefreshMcpMarketplace, this doesn't send a message to the webview
	 * @returns MCP marketplace catalog or undefined if refresh failed
	 */
	async silentlyRefreshMcpMarketplaceRPC() {
		try {
			return await this.fetchMcpMarketplaceFromApiRPC(true)
		} catch (error) {
			console.error("Failed to silently refresh MCP marketplace (RPC):", error)
			return undefined
		}
	}

	// OpenRouter

	async handleOpenRouterCallback(code: string) {
		let apiKey: string
		try {
			const response = await axios.post("https://openrouter.ai/api/v1/auth/keys", { code })
			if (response.data && response.data.key) {
				apiKey = response.data.key
			} else {
				throw new Error("Invalid response from OpenRouter API")
			}
		} catch (error) {
			console.error("Error exchanging code for API key:", error)
			throw error
		}

		const openrouter: ApiProvider = "openrouter"
		const currentMode = await this.getCurrentMode()

		// Update API configuration through cache service
		const currentApiConfiguration = this.cacheService.getApiConfiguration()
		const updatedConfig = {
			...currentApiConfiguration,
			planModeApiProvider: openrouter,
			actModeApiProvider: openrouter,
			openRouterApiKey: apiKey,
		}
		this.cacheService.setApiConfiguration(updatedConfig)

		await this.postStateToWebview()
		if (this.task) {
			this.task.api = buildApiHandler({ ...updatedConfig, ulid: this.task.ulid }, currentMode)
		}
		// Dont send settingsButtonClicked because its bad ux if user is on welcome
	}

	private async ensureCacheDirectoryExists(): Promise<string> {
		const cacheDir = path.join(this.context.globalStorageUri.fsPath, "cache")
		await fs.mkdir(cacheDir, { recursive: true })
		return cacheDir
	}

	// Read OpenRouter models from disk cache
	async readOpenRouterModels(): Promise<Record<string, ModelInfo> | undefined> {
		const openRouterModelsFilePath = path.join(await this.ensureCacheDirectoryExists(), GlobalFileNames.openRouterModels)
		const fileExists = await fileExistsAtPath(openRouterModelsFilePath)
		if (fileExists) {
			const fileContents = await fs.readFile(openRouterModelsFilePath, "utf8")
			return JSON.parse(fileContents)
		}
		return undefined
	}

	// Read Vercel AI Gateway models from disk cache
	async readVercelAiGatewayModels(): Promise<Record<string, ModelInfo> | undefined> {
		const vercelAiGatewayModelsFilePath = path.join(
			await this.ensureCacheDirectoryExists(),
			GlobalFileNames.vercelAiGatewayModels,
		)
		const fileExists = await fileExistsAtPath(vercelAiGatewayModelsFilePath)
		if (fileExists) {
			const fileContents = await fs.readFile(vercelAiGatewayModelsFilePath, "utf8")
			return JSON.parse(fileContents)
		}
		return undefined
	}

	// Task history

	async getTaskWithId(id: string): Promise<{
		historyItem: HistoryItem
		taskDirPath: string
		apiConversationHistoryFilePath: string
		uiMessagesFilePath: string
		contextHistoryFilePath: string
		taskMetadataFilePath: string
		apiConversationHistory: Anthropic.MessageParam[]
	}> {
		const history = this.cacheService.getGlobalStateKey("taskHistory")
		const historyItem = history.find((item) => item.id === id)
		if (historyItem) {
			const taskDirPath = path.join(this.context.globalStorageUri.fsPath, "tasks", id)
			const apiConversationHistoryFilePath = path.join(taskDirPath, GlobalFileNames.apiConversationHistory)
			const uiMessagesFilePath = path.join(taskDirPath, GlobalFileNames.uiMessages)
			const contextHistoryFilePath = path.join(taskDirPath, GlobalFileNames.contextHistory)
			const taskMetadataFilePath = path.join(taskDirPath, GlobalFileNames.taskMetadata)
			const fileExists = await fileExistsAtPath(apiConversationHistoryFilePath)
			if (fileExists) {
				const apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, "utf8"))
				return {
					historyItem,
					taskDirPath,
					apiConversationHistoryFilePath,
					uiMessagesFilePath,
					contextHistoryFilePath,
					taskMetadataFilePath,
					apiConversationHistory,
				}
			}
		}
		// if we tried to get a task that doesn't exist, remove it from state
		// FIXME: this seems to happen sometimes when the json file doesn't save to disk for some reason
		await this.deleteTaskFromState(id)
		throw new Error("Task not found")
	}

	async exportTaskWithId(id: string) {
		const { historyItem, apiConversationHistory } = await this.getTaskWithId(id)
		await downloadTask(historyItem.ts, apiConversationHistory)
	}

	async deleteTaskFromState(id: string) {
		// Remove the task from history
		const taskHistory = this.cacheService.getGlobalStateKey("taskHistory")
		const updatedTaskHistory = taskHistory.filter((task) => task.id !== id)
		this.cacheService.setGlobalState("taskHistory", updatedTaskHistory)

		// Notify the webview that the task has been deleted
		await this.postStateToWebview()

		return updatedTaskHistory
	}

	async postStateToWebview() {
		const state = await this.getStateToPostToWebview()
		await sendStateUpdate(this.id, state)
	}

	async getStateToPostToWebview(): Promise<ExtensionState> {
		// Get API configuration from cache for immediate access
		const apiConfiguration = this.cacheService.getApiConfiguration()
		const lastShownAnnouncementId = this.cacheService.getGlobalStateKey("lastShownAnnouncementId")
		const taskHistory = this.cacheService.getGlobalStateKey("taskHistory")
		const autoApprovalSettings = this.cacheService.getGlobalStateKey("autoApprovalSettings")
		const browserSettings = this.cacheService.getGlobalStateKey("browserSettings")
		const focusChainSettings = this.cacheService.getGlobalStateKey("focusChainSettings")
		const focusChainFeatureFlagEnabled = this.cacheService.getGlobalStateKey("focusChainFeatureFlagEnabled")
		const preferredLanguage = this.cacheService.getGlobalStateKey("preferredLanguage")
		const openaiReasoningEffort = this.cacheService.getGlobalStateKey("openaiReasoningEffort")
		const mode = this.cacheService.getGlobalStateKey("mode")
		const strictPlanModeEnabled = this.cacheService.getGlobalStateKey("strictPlanModeEnabled")
		const useAutoCondense = this.cacheService.getGlobalStateKey("useAutoCondense")
		const userInfo = this.cacheService.getGlobalStateKey("userInfo")
		const mcpMarketplaceEnabled = this.cacheService.getGlobalStateKey("mcpMarketplaceEnabled")
		const mcpDisplayMode = this.cacheService.getGlobalStateKey("mcpDisplayMode")
		const telemetrySetting = this.cacheService.getGlobalStateKey("telemetrySetting")
		const planActSeparateModelsSetting = this.cacheService.getGlobalStateKey("planActSeparateModelsSetting")
		const enableCheckpointsSetting = this.cacheService.getGlobalStateKey("enableCheckpointsSetting")
		const globalClineRulesToggles = this.cacheService.getGlobalStateKey("globalClineRulesToggles")
		const globalWorkflowToggles = this.cacheService.getGlobalStateKey("globalWorkflowToggles")
		const shellIntegrationTimeout = this.cacheService.getGlobalStateKey("shellIntegrationTimeout")
		const terminalReuseEnabled = this.cacheService.getGlobalStateKey("terminalReuseEnabled")
		const defaultTerminalProfile = this.cacheService.getGlobalStateKey("defaultTerminalProfile")
		const isNewUser = this.cacheService.getGlobalStateKey("isNewUser")
		const welcomeViewCompleted = Boolean(
			this.cacheService.getGlobalStateKey("welcomeViewCompleted") || this.authService.getInfo()?.user?.uid,
		)
		const customPrompt = this.cacheService.getGlobalStateKey("customPrompt")
		const mcpResponsesCollapsed = this.cacheService.getGlobalStateKey("mcpResponsesCollapsed")
		const terminalOutputLineLimit = this.cacheService.getGlobalStateKey("terminalOutputLineLimit")
		const localClineRulesToggles = this.cacheService.getWorkspaceStateKey("localClineRulesToggles")
		const localWindsurfRulesToggles = this.cacheService.getWorkspaceStateKey("localWindsurfRulesToggles")
		const localCursorRulesToggles = this.cacheService.getWorkspaceStateKey("localCursorRulesToggles")
		const workflowToggles = this.cacheService.getWorkspaceStateKey("workflowToggles")

		const currentTaskItem = this.task?.taskId ? (taskHistory || []).find((item) => item.id === this.task?.taskId) : undefined
		const checkpointTrackerErrorMessage = this.task?.taskState.checkpointTrackerErrorMessage
		const clineMessages = this.task?.messageStateHandler.getClineMessages() || []

		const processedTaskHistory = (taskHistory || [])
			.filter((item) => item.ts && item.task)
			.sort((a, b) => b.ts - a.ts)
			.slice(0, 100) // for now we're only getting the latest 100 tasks, but a better solution here is to only pass in 3 for recent task history, and then get the full task history on demand when going to the task history view (maybe with pagination?)

		const latestAnnouncementId = getLatestAnnouncementId(this.context)
		const shouldShowAnnouncement = lastShownAnnouncementId !== latestAnnouncementId
		const platform = process.platform as Platform
		const distinctId = PostHogClientProvider.getInstance().distinctId
		const version = this.context.extension?.packageJSON?.version ?? ""
		const uriScheme = vscode.env.uriScheme

		return {
			version,
			apiConfiguration,
			uriScheme,
			currentTaskItem,
			checkpointTrackerErrorMessage,
			clineMessages,
			currentFocusChainChecklist: this.task?.taskState.currentFocusChainChecklist || null,
			taskHistory: processedTaskHistory,
			shouldShowAnnouncement,
			platform,
			autoApprovalSettings,
			browserSettings,
			focusChainSettings,
			focusChainFeatureFlagEnabled,
			preferredLanguage,
			openaiReasoningEffort,
			mode,
			strictPlanModeEnabled,
			useAutoCondense,
			userInfo,
			mcpMarketplaceEnabled,
			mcpDisplayMode,
			telemetrySetting,
			planActSeparateModelsSetting,
			enableCheckpointsSetting: enableCheckpointsSetting ?? true,
			distinctId,
			globalClineRulesToggles: globalClineRulesToggles || {},
			localClineRulesToggles: localClineRulesToggles || {},
			localWindsurfRulesToggles: localWindsurfRulesToggles || {},
			localCursorRulesToggles: localCursorRulesToggles || {},
			localWorkflowToggles: workflowToggles || {},
			globalWorkflowToggles: globalWorkflowToggles || {},
			shellIntegrationTimeout,
			terminalReuseEnabled,
			defaultTerminalProfile,
			isNewUser,
			welcomeViewCompleted: welcomeViewCompleted as boolean, // Can be undefined but is set to either true or false by the migration that runs on extension launch in extension.ts
			mcpResponsesCollapsed,
			terminalOutputLineLimit,
			customPrompt,
		}
	}

	async clearTask() {
		if (this.task) {
		}
		await this.task?.abortTask()
		this.task = undefined // removes reference to it, so once promises end it will be garbage collected
	}

	// Caching mechanism to keep track of webview messages + API conversation history per provider instance

	/*
	Now that we use retainContextWhenHidden, we don't have to store a cache of cline messages in the user's state, but we could to reduce memory footprint in long conversations.

	- We have to be careful of what state is shared between ClineProvider instances since there could be multiple instances of the extension running at once. For example when we cached cline messages using the same key, two instances of the extension could end up using the same key and overwriting each other's messages.
	- Some state does need to be shared between the instances, i.e. the API key--however there doesn't seem to be a good way to notify the other instances that the API key has changed.

	We need to use a unique identifier for each ClineProvider instance's message cache since we could be running several instances of the extension outside of just the sidebar i.e. in editor panels.

	// conversation history to send in API requests

	/*
	It seems that some API messages do not comply with vscode state requirements. Either the Anthropic library is manipulating these values somehow in the backend in a way that's creating cyclic references, or the API returns a function or a Symbol as part of the message content.
	VSCode docs about state: "The value must be JSON-stringifyable ... value — A value. MUST not contain cyclic references."
	For now we'll store the conversation history in memory, and if we need to store in state directly we'd need to do a manual conversion to ensure proper json stringification.
	*/

	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = this.cacheService.getGlobalStateKey("taskHistory")
		const existingItemIndex = history.findIndex((h) => h.id === item.id)
		if (existingItemIndex !== -1) {
			history[existingItemIndex] = item
		} else {
			history.push(item)
		}
		this.cacheService.setGlobalState("taskHistory", history)
		return history
	}

	// ===== CLAUDE-FLOW ORCHESTRATION METHODS =====

	/**
	 * Get orchestration configuration from VSCode settings
	 */
	private getOrchestrationConfigFromSettings(): Partial<OrchestrationConfig> {
		const config = vscode.workspace.getConfiguration("cline.orchestration")

		const enabled = config.get<boolean>("enabled", false)
		const maxAgents = config.get<number>("maxAgents", 3)
		const timeoutMs = config.get<number>("timeoutMs", 300000)
		const fallbackToSingleAgent = config.get<boolean>("fallbackToSingleAgent", true)

		return {
			enabled,
			maxConcurrentAgents: maxAgents,
			maxMemoryUsage: 512 * 1024 * 1024, // 512MB
			timeoutMinutes: Math.ceil(timeoutMs / 60000), // Convert ms to minutes
			fallbackToSingleAgent,
			debugMode: false,
			autoOptimization: true,
			resourceMonitoring: true,
			vsCodeLmModelSelector: {}, // Use default VS Code LM models
		}
	}

	/**
	 * Get complexity threshold from VSCode settings
	 */
	private getComplexityThreshold(): number {
		const config = vscode.workspace.getConfiguration("cline.orchestration")
		return config.get<number>("complexityThreshold", 0.4)
	}

	/**
	 * Initialize Claude-Flow orchestration system (optional enhancement)
	 */
	async initializeOrchestration(): Promise<void> {
		try {
			console.log("Initializing Claude-Flow orchestration system...")

			// Get orchestration configuration from VSCode settings
			const orchestrationConfig = this.getOrchestrationConfigFromSettings()

			// Skip initialization if orchestration is disabled in settings
			if (!orchestrationConfig.enabled) {
				console.log("Orchestration disabled in settings, skipping initialization")
				this.orchestrationEnabled = false
				return
			}

			// Initialize memory manager
			const memoryConfig: MemoryConfig = {
				backend: "sqlite",
				sqlitePath: path.join(this.context.globalStorageUri.fsPath, "cline-memory.db"),
				cacheSizeMB: 64,
				retentionDays: 30,
				syncInterval: 60000, // 60 seconds
				conflictResolution: "last-write",
			}

			const eventBus = new EventBus()
			const logger = new ConsoleLogger()

			this.memoryManager = new MemoryManager(memoryConfig, eventBus, logger)
			await this.memoryManager.initialize()

			// Initialize swarm coordinator with simple config
			this.swarmCoordinator = new SwarmCoordinator({
				name: "Cline Orchestration Swarm",
				description: "Claude-Flow orchestration for Cline tasks",
				mode: "centralized",
				strategy: "auto",
				maxAgents: 3,
			})

			await this.swarmCoordinator.initialize()

			// Initialize Claude-Flow orchestrator
			this.claudeFlowOrchestrator = new ClaudeFlowOrchestrator(
				this.swarmCoordinator,
				this.memoryManager,
				orchestrationConfig,
			)

			this.orchestrationEnabled = true

			console.log("Claude-Flow orchestration system initialized successfully")
		} catch (error) {
			console.error("Failed to initialize Claude-Flow orchestration:", error)
			console.log("Falling back to standard Cline operation")
			this.orchestrationEnabled = false

			// Clean up any partially initialized components
			await this.shutdownOrchestration()
		}
	}

	/**
	 * Shutdown orchestration system
	 */
	async shutdownOrchestration(): Promise<void> {
		try {
			if (this.claudeFlowOrchestrator) {
				await this.claudeFlowOrchestrator.cleanup()
				this.claudeFlowOrchestrator = undefined
			}

			if (this.swarmCoordinator) {
				await this.swarmCoordinator.shutdown()
				this.swarmCoordinator = undefined
			}

			if (this.memoryManager) {
				await this.memoryManager.shutdown()
				this.memoryManager = undefined
			}

			this.orchestrationEnabled = false
			console.log("Claude-Flow orchestration system shut down")
		} catch (error) {
			console.error("Error shutting down orchestration:", error)
		}
	}

	/**
	 * Check if a task should use orchestration based on complexity analysis
	 */
	shouldUseOrchestration(taskDescription: string): boolean {
		// Check if orchestration is globally enabled
		if (!this.orchestrationEnabled || !this.claudeFlowOrchestrator) {
			return false
		}

		// Get orchestration configuration
		const config = this.claudeFlowOrchestrator.getConfig()
		if (!config.enabled) {
			return false
		}

		try {
			// Quick complexity assessment without full context
			const quickComplexity = this.assessTaskComplexity(taskDescription)

			// Get complexity threshold from settings
			const complexityThreshold = this.getComplexityThreshold()

			// Use orchestration for tasks that exceed the complexity threshold
			return quickComplexity > complexityThreshold
		} catch (error) {
			console.error("Error assessing task complexity:", error)
			return false // Fallback to standard execution
		}
	}

	/**
	 * Quick task complexity assessment for orchestration routing
	 */
	private assessTaskComplexity(taskDescription: string): number {
		const text = taskDescription.toLowerCase()
		let complexity = 0.1 // Base complexity

		// High complexity indicators
		const highComplexityKeywords = [
			"architecture",
			"design pattern",
			"microservices",
			"distributed",
			"algorithm",
			"optimization",
			"performance",
			"security",
			"database",
			"machine learning",
			"ai",
			"refactor",
			"multiple files",
			"system",
		]

		// Medium complexity indicators
		const mediumComplexityKeywords = [
			"test",
			"integration",
			"api",
			"interface",
			"framework",
			"library",
			"configuration",
			"deployment",
			"component",
		]

		// Check for high complexity keywords
		const highMatches = highComplexityKeywords.filter((keyword) => text.includes(keyword)).length
		complexity += highMatches * 0.2

		// Check for medium complexity keywords
		const mediumMatches = mediumComplexityKeywords.filter((keyword) => text.includes(keyword)).length
		complexity += mediumMatches * 0.15

		// Length-based complexity
		if (taskDescription.length > 500) {
			complexity += 0.2
		}
		if (taskDescription.length > 1000) {
			complexity += 0.2
		}

		// Multiple requirements indicator
		if (text.includes(" and ") || text.includes(" also ") || text.includes(" then ")) {
			complexity += 0.2
		}

		// File operation indicators
		if (text.includes("multiple") || text.includes("several") || text.includes("many")) {
			complexity += 0.15
		}

		return Math.min(complexity, 1.0)
	}

	/**
	 * Attempt orchestrated execution of a task
	 */
	private async attemptOrchestration(
		task: string,
		_images?: string[],
		_files?: string[],
		_historyItem?: HistoryItem,
	): Promise<{ success: boolean; error?: string }> {
		if (!this.claudeFlowOrchestrator) {
			return { success: false, error: "Orchestrator not initialized" }
		}

		try {
			// Use adaptive mode for orchestration - let the system decide
			const result = await this.claudeFlowOrchestrator.orchestrateTask(
				task,
				undefined, // context
				OrchestrationMode.ADAPTIVE,
			)

			// Check if orchestration was successful
			if (result.success) {
				console.log(
					`Orchestration completed successfully with ${result.agents.length} agents in ${result.executionTime}ms`,
				)
				return { success: true }
			} else {
				return { success: false, error: result.error || "Orchestration failed" }
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	/**
	 * Orchestrate a task using Claude-Flow system (public API)
	 */
	async orchestrateTask(taskDescription: string, mode?: OrchestrationMode): Promise<any> {
		if (!this.claudeFlowOrchestrator) {
			throw new Error("Orchestration system is not initialized")
		}

		return await this.claudeFlowOrchestrator.orchestrateTask(taskDescription, undefined, mode)
	}

	/**
	 * Get orchestration status and metrics
	 */
	getOrchestrationStatus(): {
		enabled: boolean
		metrics?: any
		health?: any
		activeTasks?: any[]
	} {
		if (!this.orchestrationEnabled || !this.claudeFlowOrchestrator) {
			return {
				enabled: false,
				metrics: null,
				health: null,
				activeTasks: [],
			}
		}

		try {
			const metrics = this.claudeFlowOrchestrator.getMetrics()
			const health = this.claudeFlowOrchestrator.getHealthStatus()
			const activeTasks = this.claudeFlowOrchestrator.getActiveTasks()

			return {
				enabled: true,
				metrics: {
					totalTasks: metrics.totalTasks,
					successfulTasks: metrics.successfulTasks,
					failedTasks: metrics.failedTasks,
					efficiency: metrics.efficiency,
					averageExecutionTime: metrics.averageExecutionTime,
					averageAgentsUsed: metrics.averageAgentsUsed,
				},
				health: {
					isHealthy: health.isHealthy,
					activeTasks: health.activeTasks,
					memoryUsage: health.memoryUsage,
					maxMemoryUsage: health.maxMemoryUsage,
					uptime: health.uptime,
				},
				activeTasks: activeTasks.map((task) => ({
					id: task.id,
					description: task.description.substring(0, 100) + "...",
					status: task.status,
					agentCount: task.agents.length,
					startTime: task.startTime,
				})),
			}
		} catch (error) {
			console.error("Error getting orchestration status:", error)
			return {
				enabled: true,
				metrics: null,
				health: null,
				activeTasks: [],
			}
		}
	}

	/**
	 * Update orchestration configuration (public API for RPC handlers)
	 */
	async updateOrchestrationConfigRPC(config: Partial<OrchestrationConfig>): Promise<void> {
		// Update orchestration configuration if orchestrator exists
		if (this.claudeFlowOrchestrator) {
			this.claudeFlowOrchestrator.updateConfig(config)
			console.log("Orchestration configuration updated:", config)
		} else {
			console.log("Orchestration not initialized, configuration not applied")
		}

		// If orchestration is being enabled, initialize it
		if (config.enabled && !this.orchestrationEnabled) {
			await this.initializeOrchestration()
		}

		// If orchestration is being disabled, shut it down
		if (config.enabled === false && this.orchestrationEnabled) {
			await this.shutdownOrchestration()
		}
	}

	/**
	 * Cancel an orchestration task (public API for RPC handlers)
	 */
	async cancelOrchestrationTask(taskId: string): Promise<boolean> {
		if (!this.claudeFlowOrchestrator) {
			return false
		}

		try {
			await this.claudeFlowOrchestrator.cancelTask(taskId)
			return true
		} catch (error) {
			console.error("Error canceling orchestration task:", error)
			return false
		}
	}

	/**
	 * Get orchestration metrics (public API for RPC handlers)
	 */
	getOrchestrationMetrics(): any {
		if (!this.claudeFlowOrchestrator) {
			return null
		}

		try {
			return this.claudeFlowOrchestrator.getMetrics()
		} catch (error) {
			console.error("Error getting orchestration metrics:", error)
			return null
		}
	}

	/**
	 * Reset orchestration metrics (public API for RPC handlers)
	 */
	async resetOrchestrationMetrics(): Promise<void> {
		if (!this.claudeFlowOrchestrator) {
			return
		}

		try {
			this.claudeFlowOrchestrator.resetMetrics()
		} catch (error) {
			console.error("Error resetting orchestration metrics:", error)
		}
	}

	/**
	 * Get orchestration health status (public API for RPC handlers)
	 */
	getOrchestrationHealth(): any {
		if (!this.claudeFlowOrchestrator) {
			return null
		}

		try {
			return this.claudeFlowOrchestrator.getHealthStatus()
		} catch (error) {
			console.error("Error getting orchestration health:", error)
			return null
		}
	}

	/**
	 * Get active orchestration tasks (public API for RPC handlers)
	 */
	getActiveOrchestrationTasks(): any[] {
		if (!this.claudeFlowOrchestrator) {
			return []
		}

		try {
			return this.claudeFlowOrchestrator.getActiveTasks()
		} catch (error) {
			console.error("Error getting active orchestration tasks:", error)
			return []
		}
	}
}
