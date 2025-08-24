/**
 * ClaudeFlowOrchestrator - Main integration bridge for Claude-Flow capabilities
 *
 * This is the primary orchestration layer that integrates Claude-Flow's advanced
 * multi-agent coordination, persistent memory, and swarm intelligence into Cline's
 * existing VSCode extension architecture using VS Code LM API.
 */

import * as vscode from "vscode"
import { VsCodeLmHandler } from "../core/api/providers/vscode-lm"
import { IMemoryManager } from "../memory/manager"
import { Logger } from "../services/logging/Logger"
import { SwarmCoordinator } from "../swarm/coordinator"
import { AgentTask, AgentTaskResult } from "./AgentExecutors"
import { Agent, AgentFactory } from "./AgentFactory"
import {
	CoordinationStatus,
	CoordinationStrategy,
	HierarchicalStrategy,
	ParallelStrategy,
	PipelineStrategy,
	SequentialStrategy,
	CoordinationPlan as StrategyCoordinationPlan,
	SwarmStrategy,
} from "./CoordinationStrategy"
import { AgentType, CoordinationStrategy as CoordinationStrategyEnum, TaskAnalysis, TaskAnalyzer } from "./TaskAnalyzer"

export interface OrchestrationConfig {
	enabled: boolean
	maxConcurrentAgents: number
	maxMemoryUsage: number
	timeoutMinutes: number
	fallbackToSingleAgent: boolean
	debugMode: boolean
	autoOptimization: boolean
	resourceMonitoring: boolean
	vsCodeLmModelSelector?: vscode.LanguageModelChatSelector
}

export interface OrchestrationResult {
	success: boolean
	taskId: string
	planId?: string
	agents: Agent[]
	executionTime: number
	resourceUsage: ResourceUsage
	metrics: OrchestrationMetrics
	error?: string
	warnings: string[]
}

export interface ResourceUsage {
	memoryUsed: number
	cpuTime: number
	apiCalls: number
	tokensUsed: number
	networkRequests: number
}

export interface OrchestrationMetrics {
	totalTasks: number
	successfulTasks: number
	failedTasks: number
	averageExecutionTime: number
	averageAgentsUsed: number
	coordinationStrategyUsage: Record<string, number>
	agentTypeUsage: Record<AgentType, number>
	efficiency: number
}

export enum OrchestrationMode {
	DISABLED = "disabled",
	ANALYSIS_ONLY = "analysis_only",
	SINGLE_AGENT_FALLBACK = "single_agent_fallback",
	FULL_ORCHESTRATION = "full_orchestration",
	ADAPTIVE = "adaptive",
}

export class ClaudeFlowOrchestrator {
	private agentFactory: AgentFactory
	private coordinationStrategies: Map<CoordinationStrategyEnum, CoordinationStrategy>
	private config: OrchestrationConfig
	private metrics: OrchestrationMetrics
	private activeTasks = new Map<string, OrchestrationTask>()
	private taskCounter = 0
	private vsCodeLmHandler: VsCodeLmHandler
	private startTime = Date.now()

	constructor(swarmCoordinator: SwarmCoordinator, memoryManager: IMemoryManager, config?: Partial<OrchestrationConfig>) {
		this.config = this.mergeDefaultConfig(config)
		this.taskAnalyzer = new TaskAnalyzer()
		this.coordinationStrategies = this.initializeCoordinationStrategies()
		this.metrics = this.initializeMetrics()

		// Initialize VS Code LM handler
		this.vsCodeLmHandler = new VsCodeLmHandler({
			vsCodeLmModelSelector: this.config.vsCodeLmModelSelector,
		})

		// Initialize agent factory with VS Code LM support
		this.agentFactory = new AgentFactory(this.vsCodeLmHandler, swarmCoordinator, memoryManager)

		Logger.log("ClaudeFlowOrchestrator initialized with VS Code LM API")
	}

	/**
	 * Main entry point for orchestrating a Cline task
	 */
	public async orchestrateTask(
		taskDescription: string,
		context?: any,
		mode: OrchestrationMode = OrchestrationMode.ADAPTIVE,
	): Promise<OrchestrationResult> {
		const taskId = this.generateTaskId()
		const startTime = Date.now()

		Logger.log(`Starting orchestration for task ${taskId}: ${taskDescription.substring(0, 100)}...`)

		try {
			// Check if orchestration is enabled
			if (!this.config.enabled || mode === OrchestrationMode.DISABLED) {
				return this.createDisabledResult(taskId, taskDescription)
			}

			// Analyze the task
			const analysis = await TaskAnalyzer.analyzeTask(taskDescription, context)

			if (mode === OrchestrationMode.ANALYSIS_ONLY) {
				return this.createAnalysisOnlyResult(taskId, analysis, startTime)
			}

			// Determine if we should use orchestration based on analysis and mode
			const shouldOrchestrate = this.shouldUseOrchestration(analysis, mode)

			if (!shouldOrchestrate) {
				return this.createSingleAgentFallbackResult(taskId, analysis, startTime)
			}

			// Create and execute the orchestration plan
			const result = await this.executeOrchestration(taskId, taskDescription, analysis, startTime)

			// Update metrics
			this.updateMetrics(result, analysis)

			return result
		} catch (error) {
			Logger.log(`Orchestration failed for task ${taskId}: ${error}`)

			const executionTime = Date.now() - startTime
			return {
				success: false,
				taskId,
				agents: [],
				executionTime,
				resourceUsage: this.createEmptyResourceUsage(),
				metrics: this.metrics,
				error: error instanceof Error ? error.message : String(error),
				warnings: [],
			}
		}
	}

	/**
	 * Executes the full orchestration process
	 */
	private async executeOrchestration(
		taskId: string,
		taskDescription: string,
		analysis: TaskAnalysis,
		startTime: number,
	): Promise<OrchestrationResult> {
		const orchestrationTask: OrchestrationTask = {
			id: taskId,
			description: taskDescription,
			analysis,
			agents: [],
			plan: undefined,
			status: OrchestrationTaskStatus.INITIALIZING,
			startTime: new Date(startTime),
			resourceUsage: this.createEmptyResourceUsage(),
			warnings: [],
		}

		this.activeTasks.set(taskId, orchestrationTask)

		try {
			// Step 1: Create agents based on task analysis
			orchestrationTask.status = OrchestrationTaskStatus.CREATING_AGENTS
			orchestrationTask.agents = await this.agentFactory.createAgentsForTask(analysis)

			Logger.log(`Created ${orchestrationTask.agents.length} agents for task ${taskId}`)

			// Step 2: Create coordination plan
			orchestrationTask.status = OrchestrationTaskStatus.PLANNING
			orchestrationTask.plan = {
				id: `plan_${taskId}`,
				strategy: analysis.coordinationStrategy,
				agentAssignments: orchestrationTask.agents.map((agent) => ({
					agentId: agent.id,
					agentType: agent.type,
					tasks: [],
				})),
				executionOrder: [],
				createdAt: new Date(),
			}

			Logger.log(`Created coordination plan ${orchestrationTask.plan.id} for task ${taskId}`)

			// Step 3: Execute the plan using coordination strategy
			orchestrationTask.status = OrchestrationTaskStatus.EXECUTING

			const agentTask: AgentTask = {
				id: taskId,
				type: analysis.taskCategories[0] || "general",
				description: taskDescription,
				priority: analysis.riskLevel === "high" || analysis.riskLevel === "critical" ? 3 : 2,
				context: {
					complexity: analysis.complexity,
					estimatedDuration: analysis.estimatedDuration,
					resourceRequirements: analysis.resourceRequirements,
				},
			}

			const taskResult = await this.executeCoordinationStrategy(
				analysis.coordinationStrategy,
				agentTask,
				orchestrationTask.agents,
			)

			const planSuccess = taskResult.success

			// Step 4: Collect results and cleanup
			orchestrationTask.status = planSuccess ? OrchestrationTaskStatus.COMPLETED : OrchestrationTaskStatus.FAILED

			const executionTime = Date.now() - startTime
			const resourceUsage = await this.collectResourceUsage(orchestrationTask)

			// Cleanup agents
			await this.agentFactory.terminateAllAgents()

			// Remove from active tasks
			this.activeTasks.delete(taskId)

			return {
				success: planSuccess,
				taskId,
				planId: orchestrationTask.plan.id,
				agents: orchestrationTask.agents,
				executionTime,
				resourceUsage,
				metrics: this.metrics,
				warnings: orchestrationTask.warnings,
			}
		} catch (error) {
			orchestrationTask.status = OrchestrationTaskStatus.FAILED

			// Cleanup on error
			await this.agentFactory.terminateAllAgents()
			this.activeTasks.delete(taskId)

			throw error
		}
	}

	/**
	 * Determines if orchestration should be used based on analysis and mode
	 */
	private shouldUseOrchestration(analysis: TaskAnalysis, mode: OrchestrationMode): boolean {
		switch (mode) {
			case OrchestrationMode.DISABLED:
				return false

			case OrchestrationMode.ANALYSIS_ONLY:
				return false

			case OrchestrationMode.SINGLE_AGENT_FALLBACK:
				return false

			case OrchestrationMode.FULL_ORCHESTRATION:
				return true

			case OrchestrationMode.ADAPTIVE:
				// Use orchestration for complex tasks with multiple agents
				return analysis.complexity > 0.4 && analysis.requiredAgentTypes.length > 1

			default:
				return false
		}
	}

	/**
	 * Gets the current status of an orchestration task
	 */
	public getTaskStatus(taskId: string): OrchestrationTask | undefined {
		return this.activeTasks.get(taskId)
	}

	/**
	 * Gets all active orchestration tasks
	 */
	public getActiveTasks(): OrchestrationTask[] {
		return Array.from(this.activeTasks.values())
	}

	/**
	 * Cancels an active orchestration task
	 */
	public async cancelTask(taskId: string): Promise<boolean> {
		const task = this.activeTasks.get(taskId)
		if (!task) {
			return false
		}

		try {
			// Mark plan as cancelled
			if (task.plan) {
				Logger.log(`Cancelling coordination plan ${task.plan.id}`)
			}

			// Terminate agents
			for (const agent of task.agents) {
				await this.agentFactory.terminateAgent(agent.id)
			}

			// Update task status
			task.status = OrchestrationTaskStatus.CANCELLED

			// Remove from active tasks
			this.activeTasks.delete(taskId)

			Logger.log(`Cancelled orchestration task ${taskId}`)
			return true
		} catch (error) {
			Logger.log(`Error cancelling task ${taskId}: ${error}`)
			return false
		}
	}

	/**
	 * Gets orchestration metrics
	 */
	public getMetrics(): OrchestrationMetrics {
		return { ...this.metrics }
	}

	/**
	 * Resets orchestration metrics
	 */
	public resetMetrics(): void {
		this.metrics = this.initializeMetrics()
		Logger.log("Orchestration metrics reset")
	}

	/**
	 * Updates orchestration configuration
	 */
	public updateConfig(config: Partial<OrchestrationConfig>): void {
		this.config = { ...this.config, ...config }

		// Update VS Code LM handler if model selector changed
		if (config.vsCodeLmModelSelector) {
			this.vsCodeLmHandler = new VsCodeLmHandler({
				vsCodeLmModelSelector: config.vsCodeLmModelSelector,
			})
		}

		Logger.log("Orchestration configuration updated")
	}

	/**
	 * Gets current orchestration configuration
	 */
	public getConfig(): OrchestrationConfig {
		return { ...this.config }
	}

	/**
	 * Gets available VS Code language models
	 */
	public async getAvailableModels(): Promise<vscode.LanguageModelChat[]> {
		try {
			return await vscode.lm.selectChatModels(this.config.vsCodeLmModelSelector || {})
		} catch (error) {
			Logger.log(`Error getting available models: ${error}`)
			return []
		}
	}

	/**
	 * Performs cleanup of completed tasks and resources
	 */
	public async cleanup(): Promise<void> {
		try {
			// Cleanup VS Code LM handler
			this.vsCodeLmHandler.dispose()

			// Cleanup completed coordination plans
			Logger.log("Cleaning up completed coordination plans")

			// Remove completed tasks older than 1 hour
			const oneHourAgo = new Date(Date.now() - 3600000)
			const tasksToRemove: string[] = []

			for (const [taskId, task] of this.activeTasks.entries()) {
				if (
					task.startTime < oneHourAgo &&
					(task.status === OrchestrationTaskStatus.COMPLETED ||
						task.status === OrchestrationTaskStatus.FAILED ||
						task.status === OrchestrationTaskStatus.CANCELLED)
				) {
					tasksToRemove.push(taskId)
				}
			}

			for (const taskId of tasksToRemove) {
				this.activeTasks.delete(taskId)
			}

			Logger.log(`Cleanup completed: removed ${tasksToRemove.length} old tasks`)
		} catch (error) {
			Logger.log(`Cleanup error: ${error}`)
		}
	}

	/**
	 * Gets orchestration health status
	 */
	public getHealthStatus(): OrchestrationHealth {
		const activeTasks = this.getActiveTasks()
		const totalMemoryUsage = activeTasks.reduce((sum, task) => sum + task.resourceUsage.memoryUsed, 0)

		return {
			isHealthy: totalMemoryUsage < this.config.maxMemoryUsage * 0.8,
			activeTasks: activeTasks.length,
			memoryUsage: totalMemoryUsage,
			maxMemoryUsage: this.config.maxMemoryUsage,
			efficiency: this.metrics.efficiency,
			uptime: Date.now() - this.startTime,
		}
	}

	// Private helper methods

	private mergeDefaultConfig(config?: Partial<OrchestrationConfig>): OrchestrationConfig {
		const defaultConfig: OrchestrationConfig = {
			enabled: true,
			maxConcurrentAgents: 5,
			maxMemoryUsage: 2 * 1024 * 1024 * 1024, // 2GB
			timeoutMinutes: 30,
			fallbackToSingleAgent: true,
			debugMode: false,
			autoOptimization: true,
			resourceMonitoring: true,
			vsCodeLmModelSelector: {}, // Use default VS Code LM models
		}

		return { ...defaultConfig, ...config }
	}

	private initializeMetrics(): OrchestrationMetrics {
		return {
			totalTasks: 0,
			successfulTasks: 0,
			failedTasks: 0,
			averageExecutionTime: 0,
			averageAgentsUsed: 0,
			coordinationStrategyUsage: {},
			agentTypeUsage: {} as Record<AgentType, number>,
			efficiency: 1.0,
		}
	}

	private generateTaskId(): string {
		this.taskCounter++
		return `orchestration_task_${Date.now()}_${this.taskCounter}`
	}

	private createDisabledResult(taskId: string, _description: string): OrchestrationResult {
		return {
			success: true,
			taskId,
			agents: [],
			executionTime: 0,
			resourceUsage: this.createEmptyResourceUsage(),
			metrics: this.metrics,
			warnings: ["Orchestration is disabled"],
		}
	}

	private createAnalysisOnlyResult(taskId: string, analysis: TaskAnalysis, startTime: number): OrchestrationResult {
		return {
			success: true,
			taskId,
			agents: [],
			executionTime: Date.now() - startTime,
			resourceUsage: this.createEmptyResourceUsage(),
			metrics: this.metrics,
			warnings: [
				`Analysis only mode: complexity=${analysis.complexity.toFixed(2)}, agents=${analysis.requiredAgentTypes.length}, strategy=${analysis.coordinationStrategy}`,
			],
		}
	}

	private createSingleAgentFallbackResult(taskId: string, _analysis: TaskAnalysis, startTime: number): OrchestrationResult {
		return {
			success: true,
			taskId,
			agents: [],
			executionTime: Date.now() - startTime,
			resourceUsage: this.createEmptyResourceUsage(),
			metrics: this.metrics,
			warnings: ["Falling back to single agent execution"],
		}
	}

	private createEmptyResourceUsage(): ResourceUsage {
		return {
			memoryUsed: 0,
			cpuTime: 0,
			apiCalls: 0,
			tokensUsed: 0,
			networkRequests: 0,
		}
	}

	private async collectResourceUsage(task: OrchestrationTask): Promise<ResourceUsage> {
		// In a real implementation, this would collect actual resource usage
		// For now, provide estimated values based on agents and execution time
		const executionTime = Date.now() - task.startTime.getTime()
		const agentCount = task.agents.length

		return {
			memoryUsed: agentCount * 100 * 1024 * 1024, // 100MB per agent
			cpuTime: executionTime * agentCount * 0.5, // Estimated CPU usage
			apiCalls: agentCount * 10, // Estimated API calls per agent
			tokensUsed: agentCount * 1000, // Estimated tokens per agent
			networkRequests: agentCount * 5, // Estimated network requests per agent
		}
	}

	/**
	 * Initializes coordination strategies
	 */
	private initializeCoordinationStrategies(): Map<CoordinationStrategyEnum, CoordinationStrategy> {
		const strategies = new Map<CoordinationStrategyEnum, CoordinationStrategy>()

		strategies.set(CoordinationStrategyEnum.SEQUENTIAL, new SequentialStrategy())
		strategies.set(CoordinationStrategyEnum.PARALLEL, new ParallelStrategy())
		strategies.set(CoordinationStrategyEnum.PIPELINE, new PipelineStrategy())
		strategies.set(CoordinationStrategyEnum.HIERARCHICAL, new HierarchicalStrategy())
		strategies.set(CoordinationStrategyEnum.SWARM, new SwarmStrategy())

		return strategies
	}

	/**
	 * Executes a task using the appropriate coordination strategy
	 */
	private async executeCoordinationStrategy(
		strategy: CoordinationStrategyEnum,
		task: AgentTask,
		agents: Agent[],
	): Promise<AgentTaskResult> {
		const coordinationStrategy = this.coordinationStrategies.get(strategy)

		if (!coordinationStrategy) {
			throw new Error(`Coordination strategy ${strategy} not found`)
		}

		Logger.log(`Executing ${strategy} coordination strategy with ${agents.length} agents`)

		// Enhanced strategy execution with resource requirements validation
		const resourceReqs = coordinationStrategy.getResourceRequirements(task)
		Logger.log(`Strategy resource requirements: ${JSON.stringify(resourceReqs)}`)

		// Validate strategy can handle the task
		if (!coordinationStrategy.canHandle(task)) {
			Logger.log(`Strategy ${strategy} cannot handle task, falling back to sequential`)
			const fallbackStrategy = this.coordinationStrategies.get(CoordinationStrategyEnum.SEQUENTIAL)!

			// Create a coordination plan for fallback strategy
			const fallbackPlan: StrategyCoordinationPlan = {
				id: `fallback_${Date.now()}`,
				strategy: CoordinationStrategyEnum.SEQUENTIAL,
				steps: [],
				agents,
				totalSteps: agents.length,
				completedSteps: 0,
				failedSteps: 0,
				estimatedDuration: 300000,
				status: CoordinationStatus.READY,
				metadata: {},
			}

			const success = await fallbackStrategy.execute(fallbackPlan)
			return {
				success,
				taskId: task.id,
				agentId: agents[0]?.id || "fallback-agent",
				executionTime: 0,
				outputs: { fallback: true, strategy: CoordinationStrategyEnum.SEQUENTIAL },
				metrics: {
					startTime: new Date(),
					endTime: new Date(),
					duration: 0,
					tokensUsed: 0,
					apiCalls: 0,
					toolsUsed: [],
					qualityScore: success ? 0.8 : 0.2,
					efficiency: success ? 0.7 : 0.1,
					taskComplexity: 0.5,
					errorCount: success ? 0 : 1,
					retryCount: 1,
					memoryPeakUsage: 0,
					cacheHitRate: 0,
				},
			}
		}

		// Create a coordination plan for the selected strategy
		const coordinationPlan: StrategyCoordinationPlan = {
			id: `coord_${Date.now()}`,
			strategy,
			steps: [],
			agents,
			totalSteps: agents.length,
			completedSteps: 0,
			failedSteps: 0,
			estimatedDuration: resourceReqs.estimatedDurationMs,
			status: CoordinationStatus.READY,
			metadata: { task, resourceRequirements: resourceReqs },
		}

		const success = await coordinationStrategy.execute(coordinationPlan)
		return {
			success,
			taskId: task.id,
			agentId: agents[0]?.id || "coordination-manager",
			executionTime: resourceReqs.estimatedDurationMs,
			outputs: { strategy, agents: agents.map((a) => a.id) },
			metrics: {
				startTime: new Date(),
				endTime: new Date(Date.now() + resourceReqs.estimatedDurationMs),
				duration: resourceReqs.estimatedDurationMs,
				tokensUsed: agents.length * 500, // Estimated tokens per agent
				apiCalls: agents.length,
				toolsUsed: ["coordination_strategy"],
				qualityScore: success ? 0.85 : 0.3,
				efficiency: success ? 0.8 : 0.2,
				taskComplexity: 0.7,
				errorCount: success ? 0 : 1,
				retryCount: 0,
				memoryPeakUsage: agents.length * 50 * 1024 * 1024, // 50MB per agent
				cacheHitRate: 0.1,
			},
		}
	}

	private updateMetrics(result: OrchestrationResult, analysis: TaskAnalysis): void {
		this.metrics.totalTasks++

		if (result.success) {
			this.metrics.successfulTasks++
		} else {
			this.metrics.failedTasks++
		}

		// Update averages
		this.metrics.averageExecutionTime =
			(this.metrics.averageExecutionTime * (this.metrics.totalTasks - 1) + result.executionTime) / this.metrics.totalTasks

		this.metrics.averageAgentsUsed =
			(this.metrics.averageAgentsUsed * (this.metrics.totalTasks - 1) + result.agents.length) / this.metrics.totalTasks

		// Update strategy usage
		const strategy = analysis.coordinationStrategy
		this.metrics.coordinationStrategyUsage[strategy] = (this.metrics.coordinationStrategyUsage[strategy] || 0) + 1

		// Update agent type usage
		for (const agentType of analysis.requiredAgentTypes) {
			this.metrics.agentTypeUsage[agentType] = (this.metrics.agentTypeUsage[agentType] || 0) + 1
		}

		// Calculate efficiency
		this.metrics.efficiency = this.metrics.successfulTasks / this.metrics.totalTasks
	}
}

// Supporting interfaces and enums

export interface CoordinationPlan {
	id: string
	strategy: CoordinationStrategyEnum
	agentAssignments: AgentAssignment[]
	executionOrder: string[]
	createdAt: Date
}

export interface AgentAssignment {
	agentId: string
	agentType: AgentType
	tasks: string[]
}

export interface OrchestrationTask {
	id: string
	description: string
	analysis: TaskAnalysis
	agents: Agent[]
	plan?: CoordinationPlan
	status: OrchestrationTaskStatus
	startTime: Date
	endTime?: Date
	resourceUsage: ResourceUsage
	warnings: string[]
}

export enum OrchestrationTaskStatus {
	INITIALIZING = "initializing",
	CREATING_AGENTS = "creating_agents",
	PLANNING = "planning",
	EXECUTING = "executing",
	COMPLETED = "completed",
	FAILED = "failed",
	CANCELLED = "cancelled",
}

export interface OrchestrationHealth {
	isHealthy: boolean
	activeTasks: number
	memoryUsage: number
	maxMemoryUsage: number
	efficiency: number
	uptime: number
}
