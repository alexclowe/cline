/**
 * Enhanced VS Code LM Handler for Claude-Flow Orchestration
 *
 * This handler extends the existing VS Code LM provider functionality
 * specifically for use within the Claude-Flow orchestration system,
 * providing additional orchestration-aware features and multi-agent support.
 */

import * as vscode from "vscode"
import { VsCodeLmHandler } from "../core/api/providers/vscode-lm.js"
import { BaseProvider, BaseProviderOptions } from "./base-provider.js"
import {
	HealthCheckResult,
	LLMModel,
	LLMProvider,
	LLMProviderError,
	LLMRequest,
	LLMResponse,
	LLMStreamEvent,
	ModelInfo,
	ProviderCapabilities,
} from "./types.js"

export interface VsCodeLmOrchestrationConfig {
	enabled: boolean
	maxConcurrentRequests: number
	requestTimeout: number
	retryAttempts: number
	modelSelector?: vscode.LanguageModelChatSelector
	orchestrationMode: "single" | "multi" | "adaptive"
	agentSpecialization: boolean
	contextSharing: boolean
}

/**
 * Enhanced VS Code LM Handler for orchestration scenarios
 * Provides specialized functionality for multi-agent coordination
 */
export class VsCodeLmOrchestrationHandler extends BaseProvider {
	readonly name: LLMProvider = "github-copilot" // Uses GitHub Copilot through VS Code LM API
	readonly capabilities: ProviderCapabilities = {
		supportedModels: [] as LLMModel[], // Will be populated dynamically
		supportsStreaming: true,
		supportsFunctionCalling: false, // Limited by VS Code LM API
		supportsSystemMessages: true,
		supportsVision: false,
		supportsAudio: false,
		supportsTools: true, // Through VS Code extension tools
		supportsFineTuning: false,
		supportsEmbeddings: false,
		supportsLogprobs: false,
		supportsBatching: true,
		maxContextLength: {} as Record<LLMModel, number>,
		maxOutputTokens: {} as Record<LLMModel, number>,
		pricing: {}, // GitHub Copilot is subscription-based
	}

	private vsCodeLmHandler: VsCodeLmHandler
	private orchestrationConfig: VsCodeLmOrchestrationConfig
	private availableModels: vscode.LanguageModelChat[] = []
	private activeRequests = new Map<string, vscode.CancellationTokenSource>()

	constructor(
		options: BaseProviderOptions & {
			orchestrationConfig?: Partial<VsCodeLmOrchestrationConfig>
			vsCodeLmModelSelector?: vscode.LanguageModelChatSelector
		},
	) {
		super(options)

		this.orchestrationConfig = {
			enabled: true,
			maxConcurrentRequests: 5,
			requestTimeout: 300000, // 5 minutes
			retryAttempts: 3,
			modelSelector: options.vsCodeLmModelSelector || {},
			orchestrationMode: "adaptive",
			agentSpecialization: true,
			contextSharing: true,
			...options.orchestrationConfig,
		}

		// Initialize the underlying VS Code LM handler
		this.vsCodeLmHandler = new VsCodeLmHandler({
			vsCodeLmModelSelector: this.orchestrationConfig.modelSelector,
		})
	}

	protected async doInitialize(): Promise<void> {
		try {
			// Discover available VS Code language models
			await this.discoverAvailableModels()

			// Update capabilities with discovered models
			this.updateCapabilitiesFromModels()

			this.logger.info("VS Code LM Orchestration Handler initialized", {
				availableModels: this.availableModels.length,
				orchestrationMode: this.orchestrationConfig.orchestrationMode,
			})
		} catch (error) {
			throw new Error(
				`Failed to initialize VS Code LM Orchestration Handler: ${error instanceof Error ? error.message : "Unknown error"}`,
			)
		}
	}

	protected async doComplete(request: LLMRequest): Promise<LLMResponse> {
		const requestId = `orchestration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

		try {
			// Check concurrent request limits
			if (this.activeRequests.size >= this.orchestrationConfig.maxConcurrentRequests) {
				throw new LLMProviderError(
					"Maximum concurrent requests exceeded",
					"CONCURRENT_LIMIT_EXCEEDED",
					this.name,
					429,
					true,
				)
			}

			// Create cancellation token for request tracking
			const cancellationSource = new vscode.CancellationTokenSource()
			this.activeRequests.set(requestId, cancellationSource)

			// Enhance request with orchestration context
			const enhancedRequest = this.enhanceRequestForOrchestration(request)

			// Convert LLMRequest to Anthropic format for VS Code LM handler
			const anthropicMessages = this.convertToAnthropicFormat(enhancedRequest)
			const systemPrompt = this.extractSystemPrompt(enhancedRequest)

			// Use the underlying VS Code LM handler
			let accumulatedContent = ""
			const startTime = Date.now()

			for await (const chunk of this.vsCodeLmHandler.createMessage(systemPrompt, anthropicMessages)) {
				if (chunk.type === "text") {
					accumulatedContent += chunk.text
				}
				// Handle other chunk types as needed
			}

			const endTime = Date.now()
			const modelInfo = this.vsCodeLmHandler.getModel()

			// Build response
			const response: LLMResponse = {
				id: requestId,
				model: modelInfo.id as LLMModel,
				provider: this.name,
				content: accumulatedContent,
				usage: {
					promptTokens: this.estimateTokens(JSON.stringify(anthropicMessages)),
					completionTokens: this.estimateTokens(accumulatedContent),
					totalTokens: this.estimateTokens(JSON.stringify(anthropicMessages)) + this.estimateTokens(accumulatedContent),
				},
				cost: {
					promptCost: 0,
					completionCost: 0,
					totalCost: 0,
					currency: "USD",
				},
				latency: endTime - startTime,
				metadata: {
					orchestrationMode: this.orchestrationConfig.orchestrationMode,
					requestId,
					modelFamily: modelInfo.id,
					timestamp: new Date().toISOString(),
				},
			}

			return response
		} catch (error) {
			throw this.transformError(error)
		} finally {
			// Cleanup
			this.activeRequests.delete(requestId)
		}
	}

	protected async *doStreamComplete(request: LLMRequest): AsyncIterable<LLMStreamEvent> {
		const requestId = `stream-orchestration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

		try {
			// Check concurrent request limits
			if (this.activeRequests.size >= this.orchestrationConfig.maxConcurrentRequests) {
				yield {
					type: "error",
					error: new LLMProviderError(
						"Maximum concurrent requests exceeded",
						"CONCURRENT_LIMIT_EXCEEDED",
						this.name,
						429,
						true,
					),
				}
				return
			}

			// Create cancellation token
			const cancellationSource = new vscode.CancellationTokenSource()
			this.activeRequests.set(requestId, cancellationSource)

			// Enhance request with orchestration context
			const enhancedRequest = this.enhanceRequestForOrchestration(request)

			// Convert to Anthropic format
			const anthropicMessages = this.convertToAnthropicFormat(enhancedRequest)
			const systemPrompt = this.extractSystemPrompt(enhancedRequest)

			let totalTokens = 0
			const startTime = Date.now()

			// Stream from VS Code LM handler
			for await (const chunk of this.vsCodeLmHandler.createMessage(systemPrompt, anthropicMessages)) {
				if (chunk.type === "text") {
					totalTokens += this.estimateTokens(chunk.text)

					yield {
						type: "text",
						text: chunk.text,
						metadata: {
							orchestrationMode: this.orchestrationConfig.orchestrationMode,
							requestId,
							timestamp: new Date().toISOString(),
						},
					}
				} else if (chunk.type === "usage") {
					yield {
						type: "usage",
						usage: chunk.inputTokens
							? {
									promptTokens: chunk.inputTokens,
									completionTokens: totalTokens,
									totalTokens: chunk.inputTokens + totalTokens,
								}
							: undefined,
						cost: {
							promptCost: 0,
							completionCost: 0,
							totalCost: 0,
							currency: "USD",
						},
						metadata: {
							orchestrationMode: this.orchestrationConfig.orchestrationMode,
							requestId,
							responseTime: Date.now() - startTime,
						},
					}
				}
			}
		} catch (error) {
			yield {
				type: "error",
				error: this.transformError(error),
			}
		} finally {
			this.activeRequests.delete(requestId)
		}
	}

	async listModels(): Promise<LLMModel[]> {
		await this.discoverAvailableModels()
		return this.availableModels.map((model) => this.createModelId(model) as LLMModel)
	}

	async getModelInfo(model: LLMModel): Promise<ModelInfo> {
		const vsCodeModel = this.findVsCodeModel(model)

		if (!vsCodeModel) {
			throw new Error(`Model ${model} not found`)
		}

		return {
			model,
			name: vsCodeModel.name,
			description: `${vsCodeModel.vendor} ${vsCodeModel.family} v${vsCodeModel.version}`,
			contextLength: vsCodeModel.maxInputTokens,
			maxOutputTokens: Math.floor(vsCodeModel.maxInputTokens * 0.25), // Conservative estimate
			supportedFeatures: [
				"text-generation",
				"conversation",
				"code-assistance",
				...(this.orchestrationConfig.agentSpecialization ? ["agent-specialization"] : []),
				...(this.orchestrationConfig.contextSharing ? ["context-sharing"] : []),
			],
		}
	}

	protected async doHealthCheck(): Promise<HealthCheckResult> {
		try {
			// Test VS Code LM availability
			const models = await vscode.lm.selectChatModels(this.orchestrationConfig.modelSelector || {})

			if (models.length === 0) {
				return {
					healthy: false,
					error: "No VS Code language models available",
					timestamp: new Date(),
					details: {
						modelSelector: this.orchestrationConfig.modelSelector,
					},
				}
			}

			// Test a simple completion
			const testModel = models[0]
			const testMessage = vscode.LanguageModelChatMessage.User("Hello")

			const response = await testModel.sendRequest([testMessage], {
				justification: "Health check test",
			})

			let hasResponse = false
			for await (const chunk of response.stream) {
				if (chunk instanceof vscode.LanguageModelTextPart) {
					hasResponse = true
					break
				}
			}

			return {
				healthy: hasResponse,
				timestamp: new Date(),
				details: {
					availableModels: models.length,
					orchestrationMode: this.orchestrationConfig.orchestrationMode,
					activeRequests: this.activeRequests.size,
				},
			}
		} catch (error) {
			return {
				healthy: false,
				error: error instanceof Error ? error.message : "Unknown health check error",
				timestamp: new Date(),
			}
		}
	}

	/**
	 * Discovers available VS Code language models
	 */
	private async discoverAvailableModels(): Promise<void> {
		try {
			this.availableModels = await vscode.lm.selectChatModels(this.orchestrationConfig.modelSelector || {})

			this.logger.info(`Discovered ${this.availableModels.length} VS Code language models`)
		} catch (error) {
			this.logger.error("Failed to discover VS Code language models", error)
			this.availableModels = []
		}
	}

	/**
	 * Updates capabilities based on discovered models
	 */
	private updateCapabilitiesFromModels(): void {
		const modelIds = this.availableModels.map((model) => this.createModelId(model) as LLMModel)
		this.capabilities.supportedModels = modelIds

		// Update context and output token limits
		this.availableModels.forEach((model) => {
			const modelId = this.createModelId(model) as LLMModel
			;(this.capabilities.maxContextLength as any)[modelId] = model.maxInputTokens
			;(this.capabilities.maxOutputTokens as any)[modelId] = Math.floor(model.maxInputTokens * 0.25)
		})
	}

	/**
	 * Creates a consistent model ID from VS Code model
	 */
	private createModelId(model: vscode.LanguageModelChat): string {
		return `${model.vendor}-${model.family}-${model.version}`.toLowerCase().replace(/[^a-z0-9-]/g, "-")
	}

	/**
	 * Finds VS Code model by model ID
	 */
	private findVsCodeModel(modelId: LLMModel): vscode.LanguageModelChat | undefined {
		return this.availableModels.find((model) => this.createModelId(model) === modelId)
	}

	/**
	 * Enhances request with orchestration-specific context
	 */
	private enhanceRequestForOrchestration(request: LLMRequest): LLMRequest {
		if (!this.orchestrationConfig.agentSpecialization) {
			return request
		}

		// Add orchestration context to system message
		const orchestrationContext = {
			mode: this.orchestrationConfig.orchestrationMode,
			agentSpecialization: this.orchestrationConfig.agentSpecialization,
			contextSharing: this.orchestrationConfig.contextSharing,
			timestamp: new Date().toISOString(),
		}

		const enhancedMessages = [...request.messages]

		// Add orchestration context to the first system message or create one
		const systemMessageIndex = enhancedMessages.findIndex((msg) => msg.role === "system")

		if (systemMessageIndex >= 0) {
			enhancedMessages[systemMessageIndex] = {
				...enhancedMessages[systemMessageIndex],
				content: `${enhancedMessages[systemMessageIndex].content}\n\n[Orchestration Context: ${JSON.stringify(orchestrationContext)}]`,
			}
		} else {
			enhancedMessages.unshift({
				role: "system",
				content: `[Orchestration Context: ${JSON.stringify(orchestrationContext)}]`,
			})
		}

		return {
			...request,
			messages: enhancedMessages,
		}
	}

	/**
	 * Converts LLMRequest to Anthropic message format for VS Code LM handler
	 */
	private convertToAnthropicFormat(request: LLMRequest): any[] {
		return request.messages
			.filter((msg) => msg.role !== "system")
			.map((msg) => ({
				role: msg.role === "assistant" ? "assistant" : "user",
				content: msg.content,
			}))
	}

	/**
	 * Extracts system prompt from request
	 */
	private extractSystemPrompt(request: LLMRequest): string {
		const systemMessages = request.messages.filter((msg) => msg.role === "system")
		return systemMessages.map((msg) => msg.content).join("\n\n") || ""
	}

	/**
	 * Cancels a specific request
	 */
	async cancelRequest(requestId: string): Promise<boolean> {
		const cancellationSource = this.activeRequests.get(requestId)
		if (cancellationSource) {
			cancellationSource.cancel()
			cancellationSource.dispose()
			this.activeRequests.delete(requestId)
			return true
		}
		return false
	}

	/**
	 * Gets orchestration status
	 */
	getOrchestrationStatus(): {
		enabled: boolean
		mode: string
		activeRequests: number
		maxConcurrentRequests: number
		availableModels: number
	} {
		return {
			enabled: this.orchestrationConfig.enabled,
			mode: this.orchestrationConfig.orchestrationMode,
			activeRequests: this.activeRequests.size,
			maxConcurrentRequests: this.orchestrationConfig.maxConcurrentRequests,
			availableModels: this.availableModels.length,
		}
	}

	/**
	 * Updates orchestration configuration
	 */
	updateOrchestrationConfig(config: Partial<VsCodeLmOrchestrationConfig>): void {
		this.orchestrationConfig = { ...this.orchestrationConfig, ...config }

		if (config.modelSelector) {
			// Rediscover models if selector changed
			this.discoverAvailableModels().then(() => {
				this.updateCapabilitiesFromModels()
			})
		}

		this.logger.info("VS Code LM orchestration configuration updated", config)
	}

	/**
	 * Cleanup all active requests
	 */
	override destroy(): void {
		// Cancel all active requests
		for (const [_requestId, cancellationSource] of this.activeRequests) {
			cancellationSource.cancel()
			cancellationSource.dispose()
		}
		this.activeRequests.clear()

		// Dispose VS Code LM handler
		this.vsCodeLmHandler.dispose()

		super.destroy()
	}
}
