/**
 * GitHub Copilot CLI Provider for Claude-Flow Integration
 *
 * This provider integrates GitHub Copilot CLI functionality into the Claude-Flow
 * orchestration system, providing code suggestions, explanations, and assistance
 * through the gh copilot command-line interface.
 */

import { execSync, spawn } from "child_process"
import { promisify } from "util"
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

const exec = promisify(require("child_process").exec)

export interface GitHubCopilotConfig {
	enabled: boolean
	timeout: number
	maxRetries: number
	useStreaming: boolean
	defaultMode: "suggest" | "explain" | "chat"
}

export class GitHubCopilotProvider extends BaseProvider {
	readonly name: LLMProvider = "github-copilot"
	readonly capabilities: ProviderCapabilities = {
		supportedModels: ["copilot-chat", "copilot-suggest", "copilot-explain"] as LLMModel[],
		supportsStreaming: true,
		supportsFunctionCalling: false,
		supportsSystemMessages: true,
		supportsVision: false,
		supportsAudio: false,
		supportsTools: false,
		supportsFineTuning: false,
		supportsEmbeddings: false,
		supportsLogprobs: false,
		supportsBatching: false,
		maxContextLength: {} as Record<LLMModel, number>,
		maxOutputTokens: {} as Record<LLMModel, number>,
		pricing: {
			"copilot-chat": {
				promptCostPer1k: 0,
				completionCostPer1k: 0,
				currency: "USD",
			},
			"copilot-suggest": {
				promptCostPer1k: 0,
				completionCostPer1k: 0,
				currency: "USD",
			},
			"copilot-explain": {
				promptCostPer1k: 0,
				completionCostPer1k: 0,
				currency: "USD",
			},
		},
	}

	private copilotConfig: GitHubCopilotConfig

	constructor(options: BaseProviderOptions & { copilotConfig?: Partial<GitHubCopilotConfig> }) {
		super(options)

		this.copilotConfig = {
			enabled: true,
			timeout: 30000,
			maxRetries: 3,
			useStreaming: true,
			defaultMode: "chat",
			...options.copilotConfig,
		}

		// Initialize context and output token limits for supported models
		const copilotModels: LLMModel[] = ["copilot-chat", "copilot-suggest", "copilot-explain"]
		copilotModels.forEach((model) => {
			;(this.capabilities.maxContextLength as any)[model] = model === "copilot-chat" ? 8192 : 4096
			;(this.capabilities.maxOutputTokens as any)[model] = model === "copilot-chat" ? 2048 : 1024
		})
	}

	protected async doInitialize(): Promise<void> {
		// Check if GitHub CLI is installed
		try {
			execSync("gh --version", { stdio: "ignore" })
		} catch (_error) {
			throw new Error("GitHub CLI (gh) is not installed or not in PATH")
		}

		// Check if Copilot extension is installed
		try {
			execSync("gh copilot --help", { stdio: "ignore" })
		} catch (_error) {
			throw new Error("GitHub Copilot CLI extension is not installed. Run: gh extension install github/gh-copilot")
		}

		// Check authentication
		try {
			execSync("gh auth status", { stdio: "ignore" })
		} catch (_error) {
			throw new Error("GitHub CLI is not authenticated. Run: gh auth login")
		}

		this.logger.info("GitHub Copilot CLI provider initialized successfully")
	}

	protected async doComplete(request: LLMRequest): Promise<LLMResponse> {
		const startTime = Date.now()

		try {
			// Extract the user message content
			const userMessage = request.messages
				.filter((msg) => msg.role === "user")
				.map((msg) => (typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)))
				.join("\n")

			let result: string

			// Determine which Copilot command to use based on the model or request content
			if (request.model === "copilot-suggest" || this.isCodeSuggestionRequest(userMessage)) {
				result = await this.suggest(userMessage)
			} else if (request.model === "copilot-explain" || this.isCodeExplanationRequest(userMessage)) {
				result = await this.explain(userMessage)
			} else {
				result = await this.chat(userMessage)
			}

			const endTime = Date.now()
			const responseTime = endTime - startTime

			// Estimate token usage (rough approximation)
			const inputTokens = this.estimateTokens(userMessage)
			const outputTokens = this.estimateTokens(result)

			return {
				id: `copilot-${Date.now()}`,
				model: request.model || "copilot-chat",
				provider: this.name,
				content: result,
				usage: {
					promptTokens: inputTokens,
					completionTokens: outputTokens,
					totalTokens: inputTokens + outputTokens,
				},
				cost: {
					promptCost: 0, // GitHub Copilot is subscription-based
					completionCost: 0,
					totalCost: 0,
					currency: "USD",
				},
				latency: responseTime,
				metadata: {
					responseTime,
					provider: this.name,
					timestamp: new Date().toISOString(),
				},
			}
		} catch (error) {
			throw this.transformError(error)
		}
	}

	protected async *doStreamComplete(request: LLMRequest): AsyncIterable<LLMStreamEvent> {
		const startTime = Date.now()
		const totalTokens = 0

		try {
			// Extract the user message content
			const userMessage = request.messages
				.filter((msg) => msg.role === "user")
				.map((msg) => (typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)))
				.join("\n")

			// For streaming, we'll use the chat command and stream the output
			yield* this.streamChat(userMessage)

			const endTime = Date.now()
			const responseTime = endTime - startTime

			// Final usage event
			yield {
				type: "usage",
				usage: {
					promptTokens: this.estimateTokens(userMessage),
					completionTokens: totalTokens,
					totalTokens: this.estimateTokens(userMessage) + totalTokens,
				},
				cost: {
					promptCost: 0,
					completionCost: 0,
					totalCost: 0,
					currency: "USD",
				},
				metadata: {
					responseTime,
					provider: this.name,
				},
			}
		} catch (error) {
			yield {
				type: "error",
				error: this.transformError(error),
			}
		}
	}

	async listModels(): Promise<LLMModel[]> {
		return ["copilot-chat", "copilot-suggest", "copilot-explain"] as LLMModel[]
	}

	async getModelInfo(model: LLMModel): Promise<ModelInfo> {
		const baseInfo: ModelInfo = {
			model,
			name: `GitHub Copilot ${model}`,
			contextLength: this.capabilities.maxContextLength[model] || 8192,
			maxOutputTokens: this.capabilities.maxOutputTokens[model] || 2048,
			supportedFeatures: ["text-generation", "code-assistance"],
			description: `GitHub Copilot CLI - ${model}`,
		}

		switch (model) {
			case "copilot-chat":
				return {
					...baseInfo,
					description: "GitHub Copilot Chat - Interactive coding assistant",
				}
			case "copilot-suggest":
				return {
					...baseInfo,
					description: "GitHub Copilot Suggest - Code completion and suggestions",
				}
			case "copilot-explain":
				return {
					...baseInfo,
					description: "GitHub Copilot Explain - Code explanation and analysis",
				}
			default:
				return baseInfo
		}
	}

	protected async doHealthCheck(): Promise<HealthCheckResult> {
		try {
			// Test basic gh command
			execSync("gh --version", { timeout: 5000, stdio: "ignore" })

			// Test copilot extension
			execSync("gh copilot --help", { timeout: 5000, stdio: "ignore" })

			// Test authentication
			execSync("gh auth status", { timeout: 5000, stdio: "ignore" })

			return {
				healthy: true,
				error: undefined,
				timestamp: new Date(),
				details: { message: "GitHub Copilot CLI is healthy and authenticated" },
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
	 * Suggests code using GitHub Copilot CLI
	 */
	async suggest(prompt: string): Promise<string> {
		try {
			const { stdout } = await exec(`gh copilot suggest "${this.escapeShellArg(prompt)}"`, {
				timeout: this.copilotConfig.timeout,
			})
			return stdout.trim()
		} catch (error) {
			throw new LLMProviderError(
				`GitHub Copilot suggest failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				"COPILOT_SUGGEST_ERROR",
				this.name,
				undefined,
				true,
			)
		}
	}

	/**
	 * Explains code using GitHub Copilot CLI
	 */
	async explain(code: string): Promise<string> {
		try {
			const { stdout } = await exec(`gh copilot explain "${this.escapeShellArg(code)}"`, {
				timeout: this.copilotConfig.timeout,
			})
			return stdout.trim()
		} catch (error) {
			throw new LLMProviderError(
				`GitHub Copilot explain failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				"COPILOT_EXPLAIN_ERROR",
				this.name,
				undefined,
				true,
			)
		}
	}

	/**
	 * Chat with GitHub Copilot CLI
	 */
	async chat(message: string): Promise<string> {
		try {
			// For non-streaming chat, use a simpler approach
			const { stdout } = await exec(`echo "${this.escapeShellArg(message)}" | gh copilot chat`, {
				timeout: this.copilotConfig.timeout,
			})
			return stdout.trim()
		} catch (error) {
			throw new LLMProviderError(
				`GitHub Copilot chat failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				"COPILOT_CHAT_ERROR",
				this.name,
				undefined,
				true,
			)
		}
	}

	/**
	 * Stream chat with GitHub Copilot CLI
	 */
	private async *streamChat(message: string): AsyncIterable<LLMStreamEvent> {
		try {
			const child = spawn("gh", ["copilot", "chat"], {
				stdio: ["pipe", "pipe", "pipe"],
			})

			// Send the message to stdin
			child.stdin.write(message)
			child.stdin.end()

			let buffer = ""

			// Read stdout in chunks
			child.stdout.on("data", (chunk: Buffer) => {
				const text = chunk.toString()
				buffer += text

				// Yield each chunk as a text event
				if (text.trim()) {
					this.emit("stream_chunk", {
						type: "text",
						text: text,
						metadata: {
							provider: this.name,
							timestamp: new Date().toISOString(),
						},
					})
				}
			})

			// Handle errors
			child.stderr.on("data", (chunk: Buffer) => {
				const errorText = chunk.toString()
				this.logger.error(`GitHub Copilot stderr: ${errorText}`)
			})

			// Wait for process to complete
			await new Promise<void>((resolve, reject) => {
				child.on("close", (code) => {
					if (code === 0) {
						resolve()
					} else {
						reject(new Error(`GitHub Copilot process exited with code ${code}`))
					}
				})

				child.on("error", (error) => {
					reject(error)
				})
			})

			// Yield final text if we have any buffered content
			if (buffer.trim()) {
				yield {
					type: "text",
					text: buffer,
					metadata: {
						provider: this.name,
						timestamp: new Date().toISOString(),
					},
				}
			}
		} catch (error) {
			yield {
				type: "error",
				error: this.transformError(error),
			}
		}
	}

	/**
	 * Determines if the request is asking for code suggestions
	 */
	private isCodeSuggestionRequest(content: string): boolean {
		const suggestionKeywords = [
			"suggest",
			"complete",
			"generate code",
			"write code",
			"implement",
			"create function",
			"code for",
		]

		const lowerContent = content.toLowerCase()
		return suggestionKeywords.some((keyword) => lowerContent.includes(keyword))
	}

	/**
	 * Determines if the request is asking for code explanation
	 */
	private isCodeExplanationRequest(content: string): boolean {
		const explanationKeywords = ["explain", "what does", "how does", "analyze", "understand", "breakdown", "describe"]

		const lowerContent = content.toLowerCase()
		return (
			explanationKeywords.some((keyword) => lowerContent.includes(keyword)) &&
			(lowerContent.includes("code") || lowerContent.includes("function") || lowerContent.includes("class"))
		)
	}

	/**
	 * Escapes shell arguments to prevent injection
	 */
	private escapeShellArg(arg: string): string {
		return arg.replace(/'/g, "'\"'\"'")
	}

	/**
	 * Updates the Copilot configuration
	 */
	updateCopilotConfig(config: Partial<GitHubCopilotConfig>): void {
		this.copilotConfig = { ...this.copilotConfig, ...config }
		this.logger.info("GitHub Copilot configuration updated", config)
	}

	/**
	 * Gets the current Copilot configuration
	 */
	getCopilotConfig(): GitHubCopilotConfig {
		return { ...this.copilotConfig }
	}
}
