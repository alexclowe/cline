/**
 * Enhanced Task Executor v2.0 with improved environment handling
 */

import { ChildProcess, spawn } from "node:child_process"
import { EventEmitter } from "node:events"
import { Logger } from "../core/logger.js"
import { generateId } from "../utils/helpers.js"
import { AgentState, TaskDefinition } from "./types.js"

// Define missing interfaces for executor v2
export interface ClaudeExecutionOptions {
	model?: string
	maxTokens?: number
	temperature?: number
	timeout?: number
	useStdin?: boolean
	claudePath?: string
	outputFormat?: string
	streamOutput?: boolean
	detached?: boolean
	dangerouslySkipPermissions?: boolean
}

export interface ClaudeExecutionOptionsV2 extends ClaudeExecutionOptions {
	nonInteractive?: boolean
	autoApprove?: boolean
	promptDefaults?: Record<string, any>
	environmentOverride?: Record<string, string>
	retryOnInteractiveError?: boolean
}

export interface ExecutionConfig {
	timeoutMs: number
	killTimeout: number
	streamOutput: boolean
	maxRetries: number
	retryDelay: number
}

export interface ExecutionContext {
	workingDirectory: string
	environment: Record<string, string>
	sessionId: string
	metadata: Record<string, any>
}

export interface ExecutionResult {
	success: boolean
	output: string
	error: string
	exitCode: number
	duration: number
	resourcesUsed: ResourceUsage
	artifacts: Record<string, any>
	metadata: Record<string, any>
}

export interface ResourceUsage {
	cpuTime: number
	maxMemory: number
	diskIO: number
	networkIO: number
	fileHandles: number
}

export interface ClaudeCommand {
	command: string
	args: string[]
	input: string
}

export interface ExecutionEnvironment {
	terminalType: string
	isInteractive: boolean
	recommendedFlags: string[]
}

// Mock environment detector functions for now
function detectExecutionEnvironment(): ExecutionEnvironment {
	return {
		terminalType: process.env.TERM || "unknown",
		isInteractive: process.stdout.isTTY || false,
		recommendedFlags: [],
	}
}

function applySmartDefaults(
	options: ClaudeExecutionOptionsV2,
	environment: ExecutionEnvironment,
): ClaudeExecutionOptionsV2 & { appliedDefaults: string[] } {
	const appliedDefaults: string[] = []
	const enhanced = { ...options }

	if (!environment.isInteractive && !options.nonInteractive) {
		enhanced.nonInteractive = true
		appliedDefaults.push("nonInteractive")
	}

	return { ...enhanced, appliedDefaults }
}

// Base TaskExecutor class
export class TaskExecutor extends EventEmitter {
	protected config: ExecutionConfig
	protected logger: Logger

	constructor(config: Partial<ExecutionConfig> = {}) {
		super()
		this.config = {
			timeoutMs: 300000, // 5 minutes
			killTimeout: 5000,
			streamOutput: true,
			maxRetries: 3,
			retryDelay: 1000,
			...config,
		}

		// Use test-safe logger configuration
		const loggerConfig =
			process.env.CLAUDE_FLOW_ENV === "test"
				? { level: "error" as const, format: "json" as const, destination: "console" as const }
				: { level: "info" as const, format: "json" as const, destination: "console" as const }

		this.logger = new Logger(loggerConfig, { component: "TaskExecutor" })
	}

	protected async createExecutionContext(task: TaskDefinition, agent: AgentState): Promise<ExecutionContext> {
		return {
			workingDirectory: process.cwd(),
			environment: {
				CLAUDE_TASK_TYPE: task.type,
				CLAUDE_AGENT_TYPE: agent.type,
			},
			sessionId: generateId("execution"),
			metadata: {
				taskId: task.id.id,
				agentId: agent.id.id,
			},
		}
	}

	protected buildClaudePrompt(task: TaskDefinition, _agent: AgentState): string {
		return `Task: ${task.name}\nDescription: ${task.description}\nInstructions: ${task.instructions}`
	}

	protected async collectResourceUsage(_sessionId: string): Promise<ResourceUsage> {
		return {
			cpuTime: 0,
			maxMemory: 0,
			diskIO: 0,
			networkIO: 0,
			fileHandles: 0,
		}
	}

	protected async collectArtifacts(_context: ExecutionContext): Promise<Record<string, any>> {
		return {}
	}
}

export class TaskExecutorV2 extends TaskExecutor {
	private environment = detectExecutionEnvironment()

	constructor(config: Partial<ExecutionConfig> = {}) {
		super(config)

		// Log environment info on initialization
		this.logger.info("Task Executor v2.0 initialized", {
			environment: this.environment.terminalType,
			interactive: this.environment.isInteractive,
			recommendations: this.environment.recommendedFlags,
		})
	}

	async executeClaudeTask(
		task: TaskDefinition,
		agent: AgentState,
		claudeOptions: ClaudeExecutionOptionsV2 = {},
	): Promise<ExecutionResult> {
		// Apply smart defaults based on environment
		const enhancedOptions = applySmartDefaults(claudeOptions, this.environment)

		// Log if defaults were applied
		if (enhancedOptions.appliedDefaults.length > 0) {
			this.logger.info("Applied environment-based defaults", {
				defaults: enhancedOptions.appliedDefaults,
				environment: this.environment.terminalType,
			})
		}

		try {
			return await this.executeClaudeWithTimeoutV2(
				generateId("claude-execution"),
				task,
				agent,
				await this.createExecutionContext(task, agent),
				enhancedOptions,
			)
		} catch (error: any) {
			// Handle interactive errors with retry
			if (this.isInteractiveError(error) && enhancedOptions.retryOnInteractiveError) {
				this.logger.warn("Interactive error detected, retrying with non-interactive mode", {
					error: error.message,
				})

				// Force non-interactive mode and retry
				enhancedOptions.nonInteractive = true
				enhancedOptions.dangerouslySkipPermissions = true

				return await this.executeClaudeWithTimeoutV2(
					generateId("claude-execution-retry"),
					task,
					agent,
					await this.createExecutionContext(task, agent),
					enhancedOptions,
				)
			}

			throw error
		}
	}

	private async executeClaudeWithTimeoutV2(
		sessionId: string,
		task: TaskDefinition,
		agent: AgentState,
		context: ExecutionContext,
		options: ClaudeExecutionOptionsV2,
	): Promise<ExecutionResult> {
		const startTime = Date.now()
		const timeout = options.timeout || this.config.timeoutMs

		// Build Claude command with v2 enhancements
		const command = this.buildClaudeCommandV2(task, agent, options)

		// Create execution environment with enhancements
		const env: Record<string, string> = {
			...process.env,
			...context.environment,
			...options.environmentOverride,
			CLAUDE_TASK_ID: task.id.id,
			CLAUDE_AGENT_ID: agent.id.id,
			CLAUDE_SESSION_ID: sessionId,
			CLAUDE_WORKING_DIR: context.workingDirectory,
			CLAUDE_NON_INTERACTIVE: options.nonInteractive ? "1" : "0",
			CLAUDE_AUTO_APPROVE: options.autoApprove ? "1" : "0",
		}

		// Add prompt defaults if provided
		if (options.promptDefaults) {
			env.CLAUDE_PROMPT_DEFAULTS = JSON.stringify(options.promptDefaults)
		}

		this.logger.debug("Executing Claude command v2", {
			sessionId,
			command: command.command,
			args: command.args,
			workingDir: context.workingDirectory,
			nonInteractive: options.nonInteractive,
			environment: this.environment.terminalType,
		})

		return new Promise((resolve, reject) => {
			let outputBuffer = ""
			let errorBuffer = ""
			let isTimeout = false
			let process: ChildProcess | null = null

			// Setup timeout
			const timeoutHandle = setTimeout(() => {
				isTimeout = true
				if (process) {
					this.logger.warn("Claude execution timeout, killing process", {
						sessionId,
						pid: process.pid,
						timeout,
					})

					process.kill("SIGTERM")
					setTimeout(() => {
						if (process && !process.killed) {
							process.kill("SIGKILL")
						}
					}, this.config.killTimeout)
				}
			}, timeout)

			try {
				// Spawn Claude process with enhanced options
				process = spawn(command.command, command.args, {
					cwd: context.workingDirectory,
					env,
					stdio: options.nonInteractive ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
					detached: options.detached || false,
					// Disable shell to avoid shell-specific issues
					shell: false,
				})

				if (!process.pid) {
					clearTimeout(timeoutHandle)
					reject(new Error("Failed to spawn Claude process"))
					return
				}

				this.logger.info("Claude process started (v2)", {
					sessionId,
					pid: process.pid,
					command: command.command,
					mode: options.nonInteractive ? "non-interactive" : "interactive",
				})

				// Handle process output
				if (process.stdout) {
					process.stdout.on("data", (data: Buffer) => {
						const chunk = data.toString()
						outputBuffer += chunk

						if (this.config.streamOutput) {
							this.emit("output", {
								sessionId,
								type: "stdout",
								data: chunk,
							})
						}
					})
				}

				if (process.stderr) {
					process.stderr.on("data", (data: Buffer) => {
						const chunk = data.toString()
						errorBuffer += chunk

						// Check for interactive mode errors
						if (this.isInteractiveErrorMessage(chunk)) {
							this.logger.warn("Interactive mode error detected in stderr", {
								sessionId,
								error: chunk.trim(),
							})
						}

						if (this.config.streamOutput) {
							this.emit("output", {
								sessionId,
								type: "stderr",
								data: chunk,
							})
						}
					})
				}

				// Handle process errors
				process.on("error", (error: Error) => {
					clearTimeout(timeoutHandle)
					this.logger.error("Process error", {
						sessionId,
						error: error.message,
						code: (error as any).code,
					})
					reject(error)
				})

				// Handle process completion
				process.on("close", async (code: number | null, signal: string | null) => {
					clearTimeout(timeoutHandle)

					const duration = Date.now() - startTime
					const exitCode = code || 0

					this.logger.info("Claude process completed (v2)", {
						sessionId,
						exitCode,
						signal,
						duration,
						isTimeout,
						hasErrors: errorBuffer.length > 0,
					})

					try {
						// Collect resource usage
						const resourceUsage = await this.collectResourceUsage(sessionId)

						// Collect artifacts
						const artifacts = await this.collectArtifacts(context)

						const result: ExecutionResult = {
							success: !isTimeout && exitCode === 0,
							output: outputBuffer,
							error: errorBuffer,
							exitCode,
							duration,
							resourcesUsed: resourceUsage,
							artifacts,
							metadata: {
								environment: this.environment.terminalType,
								nonInteractive: options.nonInteractive || false,
								appliedDefaults: (options as any).appliedDefaults || [],
							},
						}

						if (isTimeout) {
							reject(new Error(`Execution timed out after ${timeout}ms`))
						} else if (exitCode !== 0 && this.isInteractiveErrorMessage(errorBuffer)) {
							reject(new Error(`Interactive mode error: ${errorBuffer.trim()}`))
						} else {
							resolve(result)
						}
					} catch (collectionError: any) {
						this.logger.error("Error collecting execution results", {
							sessionId,
							error: collectionError.message,
						})

						// Still resolve with basic result
						resolve({
							success: !isTimeout && exitCode === 0,
							output: outputBuffer,
							error: errorBuffer,
							exitCode,
							duration,
							resourcesUsed: this.getDefaultResourceUsage(),
							artifacts: {},
							metadata: {},
						})
					}
				})
			} catch (spawnError: any) {
				clearTimeout(timeoutHandle)
				this.logger.error("Failed to spawn process", {
					sessionId,
					error: spawnError.message,
				})
				reject(spawnError)
			}
		})
	}

	private buildClaudeCommandV2(task: TaskDefinition, agent: AgentState, options: ClaudeExecutionOptionsV2): ClaudeCommand {
		const args: string[] = []
		let input = ""

		// Build prompt
		const prompt = this.buildClaudePrompt(task, agent)

		if (options.useStdin) {
			input = prompt
		} else {
			args.push("-p", prompt)
		}

		// Add tools
		if (task.requirements.tools.length > 0) {
			args.push("--allowedTools", task.requirements.tools.join(","))
		}

		// Add model if specified
		if (options.model) {
			args.push("--model", options.model)
		}

		// Add max tokens if specified
		if (options.maxTokens) {
			args.push("--max-tokens", options.maxTokens.toString())
		}

		// Add temperature if specified
		if (options.temperature !== undefined) {
			args.push("--temperature", options.temperature.toString())
		}

		// Skip permissions check for non-interactive environments
		if (
			options.nonInteractive ||
			options.dangerouslySkipPermissions ||
			this.environment.recommendedFlags.includes("--dangerously-skip-permissions")
		) {
			args.push("--dangerously-skip-permissions")
		}

		// Add non-interactive flag if needed
		if (options.nonInteractive) {
			args.push("--non-interactive")
		}

		// Add auto-approve if specified
		if (options.autoApprove) {
			args.push("--auto-approve")
		}

		// Add output format
		if (options.outputFormat) {
			args.push("--output-format", options.outputFormat)
		} else if (options.nonInteractive) {
			// Default to JSON for non-interactive mode
			args.push("--output-format", "json")
		}

		// Add environment info for debugging
		args.push(
			"--metadata",
			JSON.stringify({
				environment: this.environment.terminalType,
				interactive: this.environment.isInteractive,
				executor: "v2",
			}),
		)

		return {
			command: options.claudePath || "claude",
			args,
			input,
		}
	}

	private isInteractiveError(error: any): boolean {
		if (!(error instanceof Error)) {
			return false
		}

		const errorMessage = error.message.toLowerCase()
		return (
			errorMessage.includes("raw mode") ||
			errorMessage.includes("stdin") ||
			errorMessage.includes("interactive") ||
			errorMessage.includes("tty") ||
			errorMessage.includes("terminal")
		)
	}

	private isInteractiveErrorMessage(message: string): boolean {
		const lowerMessage = message.toLowerCase()
		return (
			lowerMessage.includes("raw mode is not supported") ||
			lowerMessage.includes("stdin is not a tty") ||
			lowerMessage.includes("requires interactive terminal") ||
			lowerMessage.includes("manual ui agreement needed")
		)
	}

	private getDefaultResourceUsage(): ResourceUsage {
		return {
			cpuTime: 0,
			maxMemory: 0,
			diskIO: 0,
			networkIO: 0,
			fileHandles: 0,
		}
	}
}

export default TaskExecutorV2
