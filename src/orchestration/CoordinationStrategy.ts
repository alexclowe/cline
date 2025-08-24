/**
 * CoordinationStrategy - Defines strategies for coordinating multiple agents
 *
 * This module provides different coordination patterns for orchestrating
 * multi-agent workflows based on task complexity and requirements.
 */

import { Logger } from "../services/logging/Logger"
import { Agent } from "./AgentFactory"
import { AgentType, CoordinationStrategy as CoordinationStrategyType, TaskAnalysis, TaskCategory } from "./TaskAnalyzer"

// Resource requirements interface for coordination strategies
export interface ResourceRequirements {
	maxConcurrentAgents: number
	memoryUsageMB: number
	estimatedDurationMs: number
	priority: "low" | "medium" | "high"
}

// Task and result interfaces for coordination
export interface AgentTask {
	id: string
	type: string
	description: string
	priority: number
	context?: any
	inputs?: Record<string, any>
	outputs?: Record<string, any>
}

export interface AgentTaskResult {
	success: boolean
	outputs: Record<string, any>
	metrics: {
		duration: number
		resourceUsage: number
		errorCount: number
	}
}

export interface CoordinationStep {
	id: string
	agentType: AgentType
	agentId?: string
	action: string
	dependencies: string[]
	inputs: Record<string, any>
	outputs: Record<string, any>
	status: StepStatus
	startTime?: Date
	endTime?: Date
	retryCount: number
	maxRetries: number
	timeout: number
	priority: number
}

export enum StepStatus {
	PENDING = "pending",
	READY = "ready",
	EXECUTING = "executing",
	COMPLETED = "completed",
	FAILED = "failed",
	CANCELLED = "cancelled",
	RETRY_PENDING = "retry_pending",
}

export interface CoordinationPlan {
	id: string
	strategy: CoordinationStrategyType
	steps: CoordinationStep[]
	agents: Agent[]
	totalSteps: number
	completedSteps: number
	failedSteps: number
	estimatedDuration: number
	actualDuration?: number
	startTime?: Date
	endTime?: Date
	status: CoordinationStatus
	metadata: Record<string, any>
}

export enum CoordinationStatus {
	PLANNING = "planning",
	READY = "ready",
	EXECUTING = "executing",
	COMPLETED = "completed",
	FAILED = "failed",
	CANCELLED = "cancelled",
	PAUSED = "paused",
}

export interface StrategyConfig {
	parallelism: number
	retryStrategy: RetryStrategy
	timeoutStrategy: TimeoutStrategy
	failureHandling: FailureHandling
	resourceLimits: ResourceLimits
}

export interface RetryStrategy {
	maxRetries: number
	backoffMultiplier: number
	baseDelay: number
	maxDelay: number
	retryableErrors: string[]
}

export interface TimeoutStrategy {
	defaultTimeout: number
	perAgentTimeout: Record<AgentType, number>
	escalationTimeout: number
}

export interface FailureHandling {
	stopOnFirstFailure: boolean
	fallbackStrategy: CoordinationStrategyType
	criticalSteps: string[]
	isolateFailures: boolean
}

export interface ResourceLimits {
	maxConcurrentAgents: number
	maxMemoryUsage: number
	maxExecutionTime: number
	maxRetries: number
}

export class CoordinationStrategyManager {
	private static strategies = new Map<CoordinationStrategyType, CoordinationStrategy>()
	private activePlans = new Map<string, CoordinationPlan>()
	private planCounter = 0

	constructor() {
		this.initializeStrategies()
	}

	/**
	 * Initialize built-in coordination strategies
	 */
	private initializeStrategies(): void {
		CoordinationStrategyManager.strategies.set(CoordinationStrategyType.SEQUENTIAL, new SequentialStrategy())
		CoordinationStrategyManager.strategies.set(CoordinationStrategyType.PARALLEL, new ParallelStrategy())
		CoordinationStrategyManager.strategies.set(CoordinationStrategyType.HIERARCHICAL, new HierarchicalStrategy())
		CoordinationStrategyManager.strategies.set(CoordinationStrategyType.SWARM, new SwarmStrategy())
	}

	/**
	 * Creates a coordination plan for the given task analysis and agents
	 */
	public async createCoordinationPlan(
		analysis: TaskAnalysis,
		agents: Agent[],
		config?: Partial<StrategyConfig>,
	): Promise<CoordinationPlan> {
		const strategy = CoordinationStrategyManager.strategies.get(analysis.coordinationStrategy)
		if (!strategy) {
			throw new Error(`Strategy ${analysis.coordinationStrategy} not found`)
		}

		const planId = this.generatePlanId()
		const plan = await strategy.createPlan(planId, analysis, agents, config)

		this.activePlans.set(planId, plan)
		Logger.log(`Created coordination plan ${planId} using ${analysis.coordinationStrategy} strategy`)

		return plan
	}

	/**
	 * Executes a coordination plan
	 */
	public async executePlan(planId: string): Promise<boolean> {
		const plan = this.activePlans.get(planId)
		if (!plan) {
			throw new Error(`Plan ${planId} not found`)
		}

		const strategy = CoordinationStrategyManager.strategies.get(plan.strategy)
		if (!strategy) {
			throw new Error(`Strategy ${plan.strategy} not found`)
		}

		Logger.log(`Executing coordination plan ${planId}`)
		plan.status = CoordinationStatus.EXECUTING
		plan.startTime = new Date()

		try {
			const result = await strategy.execute(plan)

			plan.status = result ? CoordinationStatus.COMPLETED : CoordinationStatus.FAILED
			plan.endTime = new Date()
			plan.actualDuration = plan.endTime.getTime() - plan.startTime.getTime()

			Logger.log(`Plan ${planId} ${result ? "completed successfully" : "failed"}`)
			return result
		} catch (error) {
			plan.status = CoordinationStatus.FAILED
			plan.endTime = new Date()
			Logger.log(`Plan ${planId} execution failed: ${error}`)
			return false
		}
	}

	/**
	 * Gets the status of a coordination plan
	 */
	public getPlanStatus(planId: string): CoordinationPlan | undefined {
		return this.activePlans.get(planId)
	}

	/**
	 * Cancels a coordination plan
	 */
	public async cancelPlan(planId: string): Promise<void> {
		const plan = this.activePlans.get(planId)
		if (!plan) {
			return
		}

		plan.status = CoordinationStatus.CANCELLED
		plan.endTime = new Date()

		// Cancel all pending and executing steps
		for (const step of plan.steps) {
			if (step.status === StepStatus.EXECUTING || step.status === StepStatus.READY) {
				step.status = StepStatus.CANCELLED
			}
		}

		Logger.log(`Cancelled coordination plan ${planId}`)
	}

	/**
	 * Gets all active plans
	 */
	public getActivePlans(): CoordinationPlan[] {
		return Array.from(this.activePlans.values())
	}

	/**
	 * Cleans up completed plans
	 */
	public cleanup(): void {
		const completedPlans = Array.from(this.activePlans.entries()).filter(
			([_, plan]) =>
				plan.status === CoordinationStatus.COMPLETED ||
				plan.status === CoordinationStatus.FAILED ||
				plan.status === CoordinationStatus.CANCELLED,
		)

		for (const [planId, _] of completedPlans) {
			this.activePlans.delete(planId)
		}

		Logger.log(`Cleaned up ${completedPlans.length} completed plans`)
	}

	private generatePlanId(): string {
		this.planCounter++
		return `coord_plan_${Date.now()}_${this.planCounter}`
	}
}

/**
 * Base class for coordination strategies
 */
export abstract class CoordinationStrategy {
	public abstract readonly name: string
	protected readonly defaultConfig: StrategyConfig = {
		parallelism: 3,
		retryStrategy: {
			maxRetries: 3,
			backoffMultiplier: 2,
			baseDelay: 1000,
			maxDelay: 30000,
			retryableErrors: ["timeout", "network", "temporary"],
		},
		timeoutStrategy: {
			defaultTimeout: 300000, // 5 minutes
			perAgentTimeout: {
				[AgentType.CODER]: 600000, // 10 minutes
				[AgentType.PLANNER]: 450000, // 7.5 minutes
				[AgentType.RESEARCHER]: 300000, // 5 minutes
				[AgentType.TESTER]: 900000, // 15 minutes
				[AgentType.REVIEWER]: 180000, // 3 minutes
				[AgentType.DOCUMENTATION]: 240000, // 4 minutes
				[AgentType.DEBUGGER]: 600000, // 10 minutes
				[AgentType.ARCHITECT]: 900000, // 15 minutes
			},
			escalationTimeout: 1800000, // 30 minutes
		},
		failureHandling: {
			stopOnFirstFailure: false,
			fallbackStrategy: CoordinationStrategyType.SEQUENTIAL,
			criticalSteps: [],
			isolateFailures: true,
		},
		resourceLimits: {
			maxConcurrentAgents: 5,
			maxMemoryUsage: 2 * 1024 * 1024 * 1024, // 2GB
			maxExecutionTime: 3600000, // 1 hour
			maxRetries: 3,
		},
	}

	public abstract createPlan(
		planId: string,
		analysis: TaskAnalysis,
		agents: Agent[],
		config?: Partial<StrategyConfig>,
	): Promise<CoordinationPlan>

	public abstract execute(plan: CoordinationPlan): Promise<boolean>

	public abstract canHandle(task: AgentTask): boolean

	public abstract getResourceRequirements(task: AgentTask): ResourceRequirements

	protected mergeConfig(config?: Partial<StrategyConfig>): StrategyConfig {
		return {
			...this.defaultConfig,
			...config,
			retryStrategy: { ...this.defaultConfig.retryStrategy, ...config?.retryStrategy },
			timeoutStrategy: { ...this.defaultConfig.timeoutStrategy, ...config?.timeoutStrategy },
			failureHandling: { ...this.defaultConfig.failureHandling, ...config?.failureHandling },
			resourceLimits: { ...this.defaultConfig.resourceLimits, ...config?.resourceLimits },
		}
	}

	protected createStep(
		id: string,
		agentType: AgentType,
		action: string,
		dependencies: string[] = [],
		priority: number = 1,
		timeout?: number,
	): CoordinationStep {
		return {
			id,
			agentType,
			action,
			dependencies,
			inputs: {},
			outputs: {},
			status: StepStatus.PENDING,
			retryCount: 0,
			maxRetries: this.defaultConfig.retryStrategy.maxRetries,
			timeout: timeout || this.defaultConfig.timeoutStrategy.defaultTimeout,
			priority,
		}
	}

	protected async executeStep(step: CoordinationStep, agent: Agent): Promise<boolean> {
		step.status = StepStatus.EXECUTING
		step.startTime = new Date()

		try {
			// Simulate step execution
			// In real implementation, this would call the agent's execution method
			await this.simulateStepExecution(step, agent)

			step.status = StepStatus.COMPLETED
			step.endTime = new Date()
			return true
		} catch (error) {
			step.status = StepStatus.FAILED
			step.endTime = new Date()
			Logger.log(`Step ${step.id} failed: ${error}`)
			return false
		}
	}

	private async simulateStepExecution(step: CoordinationStep, _agent: Agent): Promise<void> {
		// Simulate execution time based on agent type and action complexity
		const baseTime = 1000 // 1 second
		const complexity = step.action.length / 10 // Simple complexity metric
		const executionTime = baseTime * (1 + complexity)

		await new Promise((resolve) => setTimeout(resolve, Math.min(executionTime, 5000)))
	}
}

/**
 * Sequential coordination strategy - executes one agent at a time in order
 * Each agent waits for the previous agent to complete before starting
 */
export class SequentialStrategy extends CoordinationStrategy {
	public readonly name = "sequential"

	public canHandle(_task: AgentTask): boolean {
		// Sequential strategy can handle any task but is best for:
		// - Tasks with strong dependencies
		// - Low complexity tasks where overhead isn't justified
		// - Tasks requiring strict ordering
		return true
	}

	public getResourceRequirements(task: AgentTask): ResourceRequirements {
		return {
			maxConcurrentAgents: 1, // Only one agent at a time
			memoryUsageMB: 512, // Lower memory usage due to sequential nature
			estimatedDurationMs: 600000, // Longer duration due to sequential execution
			priority: task.priority > 7 ? "high" : task.priority > 4 ? "medium" : "low",
		}
	}
	public async createPlan(
		planId: string,
		analysis: TaskAnalysis,
		agents: Agent[],
		config?: Partial<StrategyConfig>,
	): Promise<CoordinationPlan> {
		const mergedConfig = this.mergeConfig(config)
		const steps: CoordinationStep[] = []

		// Order agents based on logical execution sequence
		const orderedAgents = this.orderAgentsForSequentialExecution(agents, analysis)

		// Create sequential steps with proper dependencies
		for (let i = 0; i < orderedAgents.length; i++) {
			const agent = orderedAgents[i]
			const stepId = `${planId}_step_${i + 1}`
			const dependencies = i > 0 ? [`${planId}_step_${i}`] : []

			const step = this.createStep(
				stepId,
				agent.type,
				this.getActionForAgent(agent, analysis),
				dependencies,
				i + 1,
				mergedConfig.timeoutStrategy.perAgentTimeout[agent.type] || mergedConfig.timeoutStrategy.defaultTimeout,
			)
			step.agentId = agent.id
			steps.push(step)
		}

		return {
			id: planId,
			strategy: CoordinationStrategyType.SEQUENTIAL,
			steps,
			agents: orderedAgents,
			totalSteps: steps.length,
			completedSteps: 0,
			failedSteps: 0,
			estimatedDuration: this.calculateSequentialDuration(steps, mergedConfig),
			status: CoordinationStatus.READY,
			metadata: { config: mergedConfig },
		}
	}

	public async execute(plan: CoordinationPlan): Promise<boolean> {
		const config = plan.metadata.config as StrategyConfig
		Logger.log(`Executing sequential plan ${plan.id} with ${plan.steps.length} steps`)

		for (let i = 0; i < plan.steps.length; i++) {
			const step = plan.steps[i]
			const agent = plan.agents.find((a) => a.id === step.agentId)

			if (!agent) {
				Logger.log(`Agent not found for step ${step.id}`)
				step.status = StepStatus.FAILED
				plan.failedSteps++

				if (config.failureHandling.stopOnFirstFailure) {
					return false
				}
				continue
			}

			// Check dependencies are met
			if (!this.areDependenciesMet(step, plan.steps)) {
				Logger.log(`Dependencies not met for step ${step.id}`)
				step.status = StepStatus.FAILED
				plan.failedSteps++

				if (config.failureHandling.stopOnFirstFailure) {
					return false
				}
				continue
			}

			// Execute step with retry logic
			const success = await this.executeStepWithRetry(step, agent, config)

			if (success) {
				plan.completedSteps++
				// Pass outputs to next step if applicable
				if (i < plan.steps.length - 1) {
					plan.steps[i + 1].inputs = { ...plan.steps[i + 1].inputs, ...step.outputs }
				}
			} else {
				plan.failedSteps++

				if (config.failureHandling.stopOnFirstFailure || config.failureHandling.criticalSteps.includes(step.id)) {
					Logger.log(`Critical step ${step.id} failed, stopping execution`)
					return false
				}
			}
		}

		const success = plan.failedSteps === 0
		Logger.log(`Sequential plan ${plan.id} ${success ? "completed successfully" : "completed with failures"}`)
		return success
	}

	private orderAgentsForSequentialExecution(agents: Agent[], _analysis: TaskAnalysis): Agent[] {
		// Define execution order based on agent types
		const orderPriority: Record<AgentType, number> = {
			[AgentType.RESEARCHER]: 1, // Research first
			[AgentType.PLANNER]: 2, // Plan based on research
			[AgentType.ARCHITECT]: 3, // Design architecture
			[AgentType.CODER]: 4, // Implement code
			[AgentType.TESTER]: 5, // Test implementation
			[AgentType.DEBUGGER]: 6, // Fix any issues
			[AgentType.REVIEWER]: 7, // Review quality
			[AgentType.DOCUMENTATION]: 8, // Document final result
		}

		return agents.sort((a, b) => {
			const priorityA = orderPriority[a.type] || 99
			const priorityB = orderPriority[b.type] || 99
			return priorityA - priorityB
		})
	}

	private calculateSequentialDuration(steps: CoordinationStep[], _config: StrategyConfig): number {
		return steps.reduce((total, step) => total + step.timeout, 0)
	}

	private areDependenciesMet(step: CoordinationStep, allSteps: CoordinationStep[]): boolean {
		return step.dependencies.every((depId) => {
			const depStep = allSteps.find((s) => s.id === depId)
			return depStep && depStep.status === StepStatus.COMPLETED
		})
	}

	private async executeStepWithRetry(step: CoordinationStep, agent: Agent, config: StrategyConfig): Promise<boolean> {
		let success = false
		let attempt = 0

		while (!success && attempt <= config.retryStrategy.maxRetries) {
			attempt++
			step.retryCount = attempt - 1

			Logger.log(`Executing step ${step.id}, attempt ${attempt}`)

			try {
				success = await this.executeStep(step, agent)

				if (!success && attempt <= config.retryStrategy.maxRetries) {
					// Wait before retry
					const delay = Math.min(
						config.retryStrategy.baseDelay * config.retryStrategy.backoffMultiplier ** (attempt - 1),
						config.retryStrategy.maxDelay,
					)
					await new Promise((resolve) => setTimeout(resolve, delay))
					step.status = StepStatus.RETRY_PENDING
				}
			} catch (error) {
				Logger.log(`Step ${step.id} attempt ${attempt} failed: ${error}`)
				if (attempt > config.retryStrategy.maxRetries) {
					step.status = StepStatus.FAILED
					break
				}
			}
		}

		return success
	}

	private getActionForAgent(agent: Agent, analysis: TaskAnalysis): string {
		switch (agent.type) {
			case AgentType.PLANNER:
				return `Analyze task requirements and create detailed execution plan for: ${analysis.taskCategories.join(", ")}`
			case AgentType.RESEARCHER:
				return `Research relevant information, technologies, and best practices for: ${analysis.taskCategories.join(", ")}`
			case AgentType.ARCHITECT:
				return `Design system architecture and technical approach for complexity level ${analysis.complexity.toFixed(2)}`
			case AgentType.CODER:
				return `Implement code changes and features based on plan and architecture`
			case AgentType.TESTER:
				return `Create comprehensive tests and validate implementation quality`
			case AgentType.REVIEWER:
				return `Review code quality, security, and adherence to best practices`
			case AgentType.DOCUMENTATION:
				return `Create and update documentation for implemented changes`
			case AgentType.DEBUGGER:
				return `Debug issues and ensure system stability`
			default:
				return `Execute assigned task for ${analysis.taskCategories.join(", ")}`
		}
	}
}

/**
 * Parallel coordination strategy - executes all agents simultaneously with resource control
 * Handles concurrent execution, resource allocation, and conflict resolution
 */
export class ParallelStrategy extends CoordinationStrategy {
	public readonly name = "parallel"

	public canHandle(task: AgentTask): boolean {
		// Parallel strategy is best for:
		// - Independent or loosely coupled tasks
		// - Tasks that can benefit from concurrent execution
		// - High complexity tasks with multiple components
		return task.priority >= 3 && task.type !== "sequential_dependent"
	}

	public getResourceRequirements(task: AgentTask): ResourceRequirements {
		const concurrentAgents = Math.min(5, Math.max(2, Math.floor(task.priority / 2)))
		return {
			maxConcurrentAgents: concurrentAgents,
			memoryUsageMB: 1024 * concurrentAgents, // More memory for parallel execution
			estimatedDurationMs: 300000, // Shorter duration due to parallelism
			priority: task.priority > 8 ? "high" : task.priority > 5 ? "medium" : "low",
		}
	}
	public async createPlan(
		planId: string,
		analysis: TaskAnalysis,
		agents: Agent[],
		config?: Partial<StrategyConfig>,
	): Promise<CoordinationPlan> {
		const mergedConfig = this.mergeConfig(config)
		const steps: CoordinationStep[] = []

		// Group agents by task decomposition for parallel execution
		const agentGroups = this.groupAgentsForParallelExecution(agents, analysis)

		// Create parallel steps with optimized resource allocation
		for (let groupIndex = 0; groupIndex < agentGroups.length; groupIndex++) {
			const group = agentGroups[groupIndex]

			for (let agentIndex = 0; agentIndex < group.agents.length; agentIndex++) {
				const agent = group.agents[agentIndex]
				const stepId = `${planId}_group_${groupIndex + 1}_step_${agentIndex + 1}`

				const step = this.createStep(
					stepId,
					agent.type,
					this.getActionForAgent(agent, analysis, group.focus),
					group.dependencies, // Group-level dependencies
					group.priority,
					mergedConfig.timeoutStrategy.perAgentTimeout[agent.type] || mergedConfig.timeoutStrategy.defaultTimeout,
				)
				step.agentId = agent.id
				steps.push(step)
			}
		}

		return {
			id: planId,
			strategy: CoordinationStrategyType.PARALLEL,
			steps,
			agents,
			totalSteps: steps.length,
			completedSteps: 0,
			failedSteps: 0,
			estimatedDuration: this.calculateParallelDuration(agentGroups, mergedConfig),
			status: CoordinationStatus.READY,
			metadata: { config: mergedConfig, agentGroups },
		}
	}

	public async execute(plan: CoordinationPlan): Promise<boolean> {
		const config = plan.metadata.config as StrategyConfig
		const agentGroups = plan.metadata.agentGroups as ParallelExecutionGroup[]

		Logger.log(`Executing parallel plan ${plan.id} with ${agentGroups.length} groups`)

		// Create resource pool for concurrency control
		const resourcePool = new ConcurrencyPool(config.parallelism)
		const executionResults: boolean[] = []

		try {
			// Execute groups in dependency order
			for (const group of agentGroups) {
				const groupSteps = plan.steps.filter((step) => group.agents.some((agent) => agent.id === step.agentId))

				// Execute all steps in the group concurrently
				const groupPromises = groupSteps.map((step) =>
					this.executeStepWithResourceControl(step, plan, resourcePool, config),
				)

				const groupResults = await Promise.all(groupPromises)
				executionResults.push(...groupResults)

				// Check if group failed and should stop execution
				const groupFailed = groupResults.some((result) => !result)
				if (groupFailed && config.failureHandling.stopOnFirstFailure) {
					Logger.log(`Group execution failed, stopping parallel execution`)
					return false
				}
			}

			// Aggregate and reconcile results from parallel execution
			const finalResult = await this.aggregateParallelResults(plan, executionResults)

			const success = plan.failedSteps === 0 && finalResult
			Logger.log(`Parallel plan ${plan.id} ${success ? "completed successfully" : "completed with failures"}`)
			return success
		} finally {
			resourcePool.dispose()
		}
	}

	private groupAgentsForParallelExecution(agents: Agent[], _analysis: TaskAnalysis): ParallelExecutionGroup[] {
		const groups: ParallelExecutionGroup[] = []

		// Group 1: Independent research and analysis (can run fully parallel)
		const independentAgents = agents.filter(
			(agent) => agent.type === AgentType.RESEARCHER || agent.type === AgentType.PLANNER,
		)
		if (independentAgents.length > 0) {
			groups.push({
				name: "Independent Analysis",
				agents: independentAgents,
				dependencies: [],
				priority: 1,
				focus: "Research and planning phase",
				canRunInParallel: true,
			})
		}

		// Group 2: Architecture and design (depends on research)
		const designAgents = agents.filter((agent) => agent.type === AgentType.ARCHITECT)
		if (designAgents.length > 0) {
			const dependencies = groups.length > 0 ? [`group_1`] : []
			groups.push({
				name: "Architecture Design",
				agents: designAgents,
				dependencies,
				priority: 2,
				focus: "System design and architecture",
				canRunInParallel: false,
			})
		}

		// Group 3: Implementation (depends on architecture)
		const implementationAgents = agents.filter((agent) => agent.type === AgentType.CODER)
		if (implementationAgents.length > 0) {
			const dependencies = groups.length > 0 ? [`group_${groups.length}`] : []
			groups.push({
				name: "Implementation",
				agents: implementationAgents,
				dependencies,
				priority: 3,
				focus: "Code implementation",
				canRunInParallel: true,
			})
		}

		// Group 4: Quality assurance (can run in parallel once implementation starts)
		const qaAgents = agents.filter((agent) => agent.type === AgentType.TESTER || agent.type === AgentType.REVIEWER)
		if (qaAgents.length > 0) {
			const dependencies = implementationAgents.length > 0 ? [`group_${groups.length}`] : []
			groups.push({
				name: "Quality Assurance",
				agents: qaAgents,
				dependencies,
				priority: 4,
				focus: "Testing and review",
				canRunInParallel: true,
			})
		}

		// Group 5: Cleanup and documentation (depends on implementation)
		const cleanupAgents = agents.filter(
			(agent) => agent.type === AgentType.DOCUMENTATION || agent.type === AgentType.DEBUGGER,
		)
		if (cleanupAgents.length > 0) {
			const dependencies = implementationAgents.length > 0 ? [`group_${groups.length}`] : []
			groups.push({
				name: "Documentation and Cleanup",
				agents: cleanupAgents,
				dependencies,
				priority: 5,
				focus: "Documentation and final cleanup",
				canRunInParallel: true,
			})
		}

		return groups
	}

	private calculateParallelDuration(groups: ParallelExecutionGroup[], config: StrategyConfig): number {
		// Calculate duration based on critical path through groups
		return groups.reduce((maxDuration, group) => {
			const groupDuration = Math.max(
				...group.agents.map(
					(agent) => config.timeoutStrategy.perAgentTimeout[agent.type] || config.timeoutStrategy.defaultTimeout,
				),
			)
			return maxDuration + (group.canRunInParallel ? groupDuration / group.agents.length : groupDuration)
		}, 0)
	}

	private async executeStepWithResourceControl(
		step: CoordinationStep,
		plan: CoordinationPlan,
		resourcePool: ConcurrencyPool,
		config: StrategyConfig,
	): Promise<boolean> {
		const agent = plan.agents.find((a) => a.id === step.agentId)
		if (!agent) {
			step.status = StepStatus.FAILED
			plan.failedSteps++
			return false
		}

		// Acquire resource from pool
		const resource = await resourcePool.acquire()

		try {
			const success = await this.executeStepWithRetryAndTimeout(step, agent, config)

			if (success) {
				plan.completedSteps++
			} else {
				plan.failedSteps++
			}

			return success
		} finally {
			resourcePool.release(resource)
		}
	}

	private async executeStepWithRetryAndTimeout(step: CoordinationStep, agent: Agent, config: StrategyConfig): Promise<boolean> {
		let success = false
		let attempt = 0

		while (!success && attempt <= config.retryStrategy.maxRetries) {
			attempt++
			step.retryCount = attempt - 1

			Logger.log(`Executing parallel step ${step.id}, attempt ${attempt}`)

			try {
				// Execute with timeout
				success = await Promise.race([
					this.executeStep(step, agent),
					new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error("Timeout")), step.timeout)),
				])

				if (!success && attempt <= config.retryStrategy.maxRetries) {
					const delay = Math.min(
						config.retryStrategy.baseDelay * config.retryStrategy.backoffMultiplier ** (attempt - 1),
						config.retryStrategy.maxDelay,
					)
					await new Promise((resolve) => setTimeout(resolve, delay))
					step.status = StepStatus.RETRY_PENDING
				}
			} catch (error) {
				Logger.log(`Parallel step ${step.id} attempt ${attempt} failed: ${error}`)
				if (attempt > config.retryStrategy.maxRetries) {
					step.status = StepStatus.FAILED
					break
				}
			}
		}

		return success
	}

	private async aggregateParallelResults(plan: CoordinationPlan, _results: boolean[]): Promise<boolean> {
		// Check for conflicts in parallel execution results
		const conflicts = this.detectResultConflicts(plan.steps)

		if (conflicts.length > 0) {
			Logger.log(`Detected ${conflicts.length} conflicts in parallel execution, attempting resolution`)

			// Attempt to resolve conflicts
			for (const conflict of conflicts) {
				const resolved = await this.resolveConflict(conflict, plan)
				if (!resolved) {
					Logger.log(`Failed to resolve conflict: ${conflict.description}`)
					return false
				}
			}
		}

		return true
	}

	private detectResultConflicts(steps: CoordinationStep[]): ExecutionConflict[] {
		const conflicts: ExecutionConflict[] = []

		// Simple conflict detection - in real implementation would be more sophisticated
		const completedSteps = steps.filter((step) => step.status === StepStatus.COMPLETED)

		// Example: Check for conflicting file modifications
		const fileModifications = completedSteps
			.filter((step) => step.outputs.modifiedFiles)
			.flatMap((step) => step.outputs.modifiedFiles as string[])

		const duplicateFiles = fileModifications.filter((file, index) => fileModifications.indexOf(file) !== index)

		for (const file of duplicateFiles) {
			conflicts.push({
				type: "file_modification",
				description: `Multiple agents modified the same file: ${file}`,
				affectedSteps: completedSteps.filter((step) => step.outputs.modifiedFiles?.includes(file)).map((step) => step.id),
			})
		}

		return conflicts
	}

	private async resolveConflict(conflict: ExecutionConflict, _plan: CoordinationPlan): Promise<boolean> {
		// Simple conflict resolution - in real implementation would be more sophisticated
		Logger.log(`Attempting to resolve conflict: ${conflict.description}`)

		switch (conflict.type) {
			case "file_modification":
				// For now, just log the conflict and continue
				Logger.log(`File modification conflict detected but continuing execution`)
				return true

			default:
				return false
		}
	}

	private getActionForAgent(agent: Agent, analysis: TaskAnalysis, groupFocus?: string): string {
		const baseAction = this.getBaseActionForAgent(agent, analysis)
		return groupFocus ? `${baseAction} - Focus: ${groupFocus}` : baseAction
	}

	private getBaseActionForAgent(agent: Agent, analysis: TaskAnalysis): string {
		switch (agent.type) {
			case AgentType.PLANNER:
				return `Analyze and decompose task for parallel execution: ${analysis.taskCategories.join(", ")}`
			case AgentType.RESEARCHER:
				return `Research in parallel: technologies, patterns, and solutions for ${analysis.taskCategories.join(", ")}`
			case AgentType.ARCHITECT:
				return `Design modular architecture enabling parallel development for complexity ${analysis.complexity.toFixed(2)}`
			case AgentType.CODER:
				return `Implement assigned code modules in parallel with other developers`
			case AgentType.TESTER:
				return `Create and execute tests in parallel with development`
			case AgentType.REVIEWER:
				return `Perform concurrent code review and quality assessment`
			case AgentType.DOCUMENTATION:
				return `Document changes and create parallel documentation streams`
			case AgentType.DEBUGGER:
				return `Debug and fix issues in parallel execution context`
			default:
				return `Execute parallel task for ${analysis.taskCategories.join(", ")}`
		}
	}
}

// Supporting classes and interfaces for parallel execution

class ConcurrencyPool {
	private available: number[]
	private waiting: Array<(resource: number) => void> = []

	constructor(maxConcurrency: number) {
		this.available = Array.from({ length: maxConcurrency }, (_, i) => i)
	}

	async acquire(): Promise<number> {
		if (this.available.length > 0) {
			return this.available.pop()!
		}

		return new Promise<number>((resolve) => {
			this.waiting.push(resolve)
		})
	}

	release(resource: number): void {
		if (this.waiting.length > 0) {
			const resolve = this.waiting.shift()!
			resolve(resource)
		} else {
			this.available.push(resource)
		}
	}

	dispose(): void {
		// Clean up any waiting promises
		for (const resolve of this.waiting) {
			resolve(-1)
		}
		this.waiting = []
	}
}

interface ParallelExecutionGroup {
	name: string
	agents: Agent[]
	dependencies: string[]
	priority: number
	focus: string
	canRunInParallel: boolean
}

interface ExecutionConflict {
	type: string
	description: string
	affectedSteps: string[]
}

/**
 * Pipeline coordination strategy - output of one agent feeds input of next
 * Implements stream processing between agents with data transformation and validation
 */
export class PipelineStrategy extends CoordinationStrategy {
	public readonly name = "pipeline"

	public canHandle(task: AgentTask): boolean {
		// Pipeline strategy is best for:
		// - Tasks with clear data flow dependencies
		// - Transform/process/validate workflows
		// - Tasks requiring staged processing
		return task.type.includes("transform") || task.type.includes("process") || task.priority >= 4
	}

	public getResourceRequirements(task: AgentTask): ResourceRequirements {
		const stages = Math.min(5, Math.max(2, Math.floor(task.priority / 2)))
		return {
			maxConcurrentAgents: stages, // One agent per stage typically
			memoryUsageMB: 2048, // Higher memory for data buffering
			estimatedDurationMs: 450000, // Moderate duration for staged processing
			priority: task.priority > 6 ? "high" : task.priority > 3 ? "medium" : "low",
		}
	}
	public async createPlan(
		planId: string,
		analysis: TaskAnalysis,
		agents: Agent[],
		config?: Partial<StrategyConfig>,
	): Promise<CoordinationPlan> {
		const mergedConfig = this.mergeConfig(config)
		const steps: CoordinationStep[] = []

		// Define pipeline stages with proper data flow
		const stages = this.definePipelineStages(agents, analysis)

		for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
			const stage = stages[stageIndex]
			const previousStageSteps =
				stageIndex > 0 ? this.getPreviousStageSteps(stages[stageIndex - 1], planId, stageIndex) : []

			for (let agentIndex = 0; agentIndex < stage.agents.length; agentIndex++) {
				const agent = stage.agents[agentIndex]
				const stepId = `${planId}_stage_${stageIndex + 1}_step_${agentIndex + 1}`

				const step = this.createStep(
					stepId,
					agent.type,
					this.getPipelineActionForAgent(agent, stage, analysis),
					previousStageSteps, // Depend on previous stage completion
					stageIndex + 1,
					mergedConfig.timeoutStrategy.perAgentTimeout[agent.type] || mergedConfig.timeoutStrategy.defaultTimeout,
				)
				step.agentId = agent.id

				// Set up data transformation pipeline
				step.inputs = {
					stageIndex,
					stageName: stage.name,
					dataFlowType: stage.dataFlowType,
					expectedInputs: stage.expectedInputs,
					outputFormat: stage.outputFormat,
				}

				steps.push(step)
			}
		}

		return {
			id: planId,
			strategy: CoordinationStrategyType.HIERARCHICAL, // Use existing strategy since PIPELINE doesn't exist
			steps,
			agents,
			totalSteps: steps.length,
			completedSteps: 0,
			failedSteps: 0,
			estimatedDuration: this.calculatePipelineDuration(stages, mergedConfig),
			status: CoordinationStatus.READY,
			metadata: { config: mergedConfig, stages, dataFlowBuffers: new Map() },
		}
	}

	public async execute(plan: CoordinationPlan): Promise<boolean> {
		const config = plan.metadata.config as StrategyConfig
		const stages = plan.metadata.stages as PipelineStage[]
		const dataFlowBuffers = plan.metadata.dataFlowBuffers as Map<string, any>

		Logger.log(`Executing pipeline plan ${plan.id} with ${stages.length} stages`)

		// Execute stages sequentially with data flow
		for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
			const stage = stages[stageIndex]
			const stageSteps = plan.steps.filter((step) => step.id.includes(`_stage_${stageIndex + 1}_`))

			Logger.log(`Executing pipeline stage ${stageIndex + 1}: ${stage.name}`)

			// Prepare stage inputs from previous stage outputs
			if (stageIndex > 0) {
				const stageInputs = await this.prepareStageInputs(stageIndex, dataFlowBuffers, stages)
				for (const step of stageSteps) {
					step.inputs = { ...step.inputs, ...stageInputs }
				}
			}

			// Execute all steps in current stage
			const stagePromises = stageSteps.map((step) => this.executeStepWithDataFlow(step, plan, dataFlowBuffers, config))

			const stageResults = await Promise.all(stagePromises)

			// Validate and buffer stage outputs
			const stageOutputs = await this.collectAndValidateStageOutputs(stageSteps, stage)
			dataFlowBuffers.set(`stage_${stageIndex + 1}_outputs`, stageOutputs)

			// Check stage success
			const stageSuccess = stageResults.every((result) => result)
			if (!stageSuccess) {
				Logger.log(`Pipeline stage ${stageIndex + 1} failed`)
				if (config.failureHandling.stopOnFirstFailure) {
					return false
				}
			}

			// Apply buffering and flow control
			await this.applyFlowControl(stage, stageOutputs, dataFlowBuffers)
		}

		const success = plan.failedSteps === 0
		Logger.log(`Pipeline plan ${plan.id} ${success ? "completed successfully" : "completed with failures"}`)
		return success
	}

	private definePipelineStages(agents: Agent[], _analysis: TaskAnalysis): PipelineStage[] {
		const stages: PipelineStage[] = []

		// Stage 1: Input Processing and Research
		const inputAgents = agents.filter((a) => a.type === AgentType.RESEARCHER || a.type === AgentType.PLANNER)
		if (inputAgents.length > 0) {
			stages.push({
				name: "Input Processing and Research",
				agents: inputAgents,
				action: "Process inputs and gather research data",
				dataFlowType: "producer",
				expectedInputs: ["taskDescription", "context"],
				outputFormat: "structured_data",
				bufferSize: 1024 * 1024, // 1MB
				flowControlStrategy: "buffered",
			})
		}

		// Stage 2: Architecture and Design
		const designAgents = agents.filter((a) => a.type === AgentType.ARCHITECT)
		if (designAgents.length > 0) {
			stages.push({
				name: "Architecture and Design",
				agents: designAgents,
				action: "Transform research into architectural design",
				dataFlowType: "transformer",
				expectedInputs: ["research_data", "requirements"],
				outputFormat: "design_specifications",
				bufferSize: 2 * 1024 * 1024, // 2MB
				flowControlStrategy: "stream_processing",
			})
		}

		// Stage 3: Implementation
		const implementationAgents = agents.filter((a) => a.type === AgentType.CODER)
		if (implementationAgents.length > 0) {
			stages.push({
				name: "Implementation",
				agents: implementationAgents,
				action: "Transform design into working code",
				dataFlowType: "transformer",
				expectedInputs: ["design_specifications", "architecture"],
				outputFormat: "source_code",
				bufferSize: 4 * 1024 * 1024, // 4MB
				flowControlStrategy: "parallel_processing",
			})
		}

		// Stage 4: Quality Assurance
		const qaAgents = agents.filter((a) => a.type === AgentType.TESTER || a.type === AgentType.REVIEWER)
		if (qaAgents.length > 0) {
			stages.push({
				name: "Quality Assurance",
				agents: qaAgents,
				action: "Transform code into validated implementation",
				dataFlowType: "validator",
				expectedInputs: ["source_code", "requirements"],
				outputFormat: "validated_code",
				bufferSize: 2 * 1024 * 1024, // 2MB
				flowControlStrategy: "validation_pipeline",
			})
		}

		// Stage 5: Output Processing
		const outputAgents = agents.filter((a) => a.type === AgentType.DOCUMENTATION || a.type === AgentType.DEBUGGER)
		if (outputAgents.length > 0) {
			stages.push({
				name: "Output Processing and Documentation",
				agents: outputAgents,
				action: "Transform validated code into final deliverables",
				dataFlowType: "consumer",
				expectedInputs: ["validated_code", "test_results"],
				outputFormat: "final_deliverables",
				bufferSize: 1024 * 1024, // 1MB
				flowControlStrategy: "output_aggregation",
			})
		}

		return stages
	}

	private getPreviousStageSteps(stage: PipelineStage, planId: string, currentStageIndex: number): string[] {
		// Return step IDs from previous stage
		const stepIds: string[] = []
		for (let i = 0; i < stage.agents.length; i++) {
			stepIds.push(`${planId}_stage_${currentStageIndex}_step_${i + 1}`)
		}
		return stepIds
	}

	private calculatePipelineDuration(stages: PipelineStage[], config: StrategyConfig): number {
		// Pipeline duration is sum of stage durations (sequential processing)
		return stages.reduce((total, stage) => {
			const stageMaxDuration = Math.max(
				...stage.agents.map(
					(agent) => config.timeoutStrategy.perAgentTimeout[agent.type] || config.timeoutStrategy.defaultTimeout,
				),
			)
			return total + stageMaxDuration
		}, 0)
	}

	private async executeStepWithDataFlow(
		step: CoordinationStep,
		plan: CoordinationPlan,
		dataFlowBuffers: Map<string, any>,
		config: StrategyConfig,
	): Promise<boolean> {
		const agent = plan.agents.find((a) => a.id === step.agentId)
		if (!agent) {
			step.status = StepStatus.FAILED
			plan.failedSteps++
			return false
		}

		try {
			// Validate inputs before execution
			const inputsValid = await this.validateStepInputs(step, dataFlowBuffers)
			if (!inputsValid) {
				Logger.log(`Step ${step.id} input validation failed`)
				step.status = StepStatus.FAILED
				plan.failedSteps++
				return false
			}

			// Execute with data flow monitoring
			const success = await this.executeStepWithMonitoring(step, agent, config)

			if (success) {
				plan.completedSteps++
				// Process and buffer outputs
				await this.processStepOutputs(step, dataFlowBuffers)
			} else {
				plan.failedSteps++
			}

			return success
		} catch (error) {
			Logger.log(`Pipeline step ${step.id} failed: ${error}`)
			step.status = StepStatus.FAILED
			plan.failedSteps++
			return false
		}
	}

	private async validateStepInputs(step: CoordinationStep, dataFlowBuffers: Map<string, any>): Promise<boolean> {
		const expectedInputs = step.inputs.expectedInputs as string[]
		if (!expectedInputs || expectedInputs.length === 0) {
			return true // No inputs required
		}

		// Check if all required inputs are available
		for (const inputKey of expectedInputs) {
			if (!step.inputs[inputKey] && !dataFlowBuffers.has(inputKey)) {
				Logger.log(`Required input ${inputKey} not available for step ${step.id}`)
				return false
			}
		}

		return true
	}

	private async executeStepWithMonitoring(step: CoordinationStep, agent: Agent, _config: StrategyConfig): Promise<boolean> {
		// Add data flow monitoring to step execution
		const startTime = Date.now()

		try {
			const success = await this.executeStep(step, agent)

			// Monitor data flow metrics
			const duration = Date.now() - startTime
			step.outputs.executionMetrics = {
				duration,
				memoryUsage: this.estimateMemoryUsage(step),
				throughput: this.calculateThroughput(step, duration),
			}

			return success
		} catch (error) {
			Logger.log(`Step execution monitoring failed: ${error}`)
			return false
		}
	}

	private async processStepOutputs(step: CoordinationStep, dataFlowBuffers: Map<string, any>): Promise<void> {
		const outputFormat = step.inputs.outputFormat as string

		// Transform outputs based on format
		const transformedOutputs = await this.transformOutputData(step.outputs, outputFormat)

		// Buffer outputs for next stage
		const bufferKey = `${step.id}_outputs`
		dataFlowBuffers.set(bufferKey, transformedOutputs)

		Logger.log(`Processed and buffered outputs for step ${step.id}`)
	}

	private async prepareStageInputs(
		stageIndex: number,
		dataFlowBuffers: Map<string, any>,
		stages: PipelineStage[],
	): Promise<Record<string, any>> {
		const previousStageOutputs = dataFlowBuffers.get(`stage_${stageIndex}_outputs`)
		const currentStage = stages[stageIndex]

		if (!previousStageOutputs) {
			Logger.log(`No outputs from previous stage for stage ${stageIndex + 1}`)
			return {}
		}

		// Transform previous stage outputs to current stage inputs
		return await this.transformDataForNextStage(previousStageOutputs, currentStage.expectedInputs, currentStage.dataFlowType)
	}

	private async collectAndValidateStageOutputs(steps: CoordinationStep[], stage: PipelineStage): Promise<any> {
		const outputs: any[] = []

		for (const step of steps) {
			if (step.status === StepStatus.COMPLETED) {
				const transformedOutput = await this.validateAndTransformOutput(step.outputs, stage.outputFormat)
				outputs.push(transformedOutput)
			}
		}

		// Aggregate stage outputs based on stage type
		return await this.aggregateStageOutputs(outputs, stage)
	}

	private async applyFlowControl(stage: PipelineStage, stageOutputs: any, dataFlowBuffers: Map<string, any>): Promise<void> {
		switch (stage.flowControlStrategy) {
			case "buffered":
				await this.applyBufferedFlowControl(stageOutputs, stage.bufferSize)
				break
			case "stream_processing":
				await this.applyStreamProcessingControl(stageOutputs, dataFlowBuffers)
				break
			case "parallel_processing":
				await this.applyParallelProcessingControl(stageOutputs)
				break
			case "validation_pipeline":
				await this.applyValidationPipelineControl(stageOutputs)
				break
			case "output_aggregation":
				await this.applyOutputAggregationControl(stageOutputs, dataFlowBuffers)
				break
		}
	}

	// Helper methods for data flow management
	private estimateMemoryUsage(step: CoordinationStep): number {
		// Simple estimation based on input/output sizes
		const inputSize = JSON.stringify(step.inputs).length
		const outputSize = JSON.stringify(step.outputs).length
		return inputSize + outputSize
	}

	private calculateThroughput(step: CoordinationStep, duration: number): number {
		const dataSize = this.estimateMemoryUsage(step)
		return dataSize / (duration / 1000) // bytes per second
	}

	private async transformOutputData(outputs: Record<string, any>, format: string): Promise<any> {
		// Transform outputs based on required format
		switch (format) {
			case "structured_data":
				return this.structureData(outputs)
			case "design_specifications":
				return this.formatAsDesignSpec(outputs)
			case "source_code":
				return this.formatAsSourceCode(outputs)
			case "validated_code":
				return this.formatAsValidatedCode(outputs)
			case "final_deliverables":
				return this.formatAsFinalDeliverables(outputs)
			default:
				return outputs
		}
	}

	private async transformDataForNextStage(
		previousOutputs: any,
		expectedInputs: string[],
		_flowType: string,
	): Promise<Record<string, any>> {
		const transformed: Record<string, any> = {}

		// Map previous outputs to expected inputs based on flow type
		for (const inputKey of expectedInputs) {
			if (previousOutputs[inputKey]) {
				transformed[inputKey] = previousOutputs[inputKey]
			}
		}

		return transformed
	}

	private async validateAndTransformOutput(outputs: Record<string, any>, _format: string): Promise<any> {
		// Validate output format and transform if needed
		return outputs // Simplified for now
	}

	private async aggregateStageOutputs(outputs: any[], stage: PipelineStage): Promise<any> {
		// Aggregate outputs based on stage type
		switch (stage.dataFlowType) {
			case "producer":
				return outputs[0] // Take first producer output
			case "transformer":
				return this.mergeTransformerOutputs(outputs)
			case "validator":
				return this.validateAggregatedOutputs(outputs)
			case "consumer":
				return this.consumeAggregatedOutputs(outputs)
			default:
				return outputs
		}
	}

	// Flow control implementations
	private async applyBufferedFlowControl(_outputs: any, bufferSize: number): Promise<void> {
		// Implement buffered flow control
		Logger.log(`Applied buffered flow control with buffer size ${bufferSize}`)
	}

	private async applyStreamProcessingControl(_outputs: any, _buffers: Map<string, any>): Promise<void> {
		// Implement stream processing control
		Logger.log("Applied stream processing flow control")
	}

	private async applyParallelProcessingControl(_outputs: any): Promise<void> {
		// Implement parallel processing control
		Logger.log("Applied parallel processing flow control")
	}

	private async applyValidationPipelineControl(_outputs: any): Promise<void> {
		// Implement validation pipeline control
		Logger.log("Applied validation pipeline flow control")
	}

	private async applyOutputAggregationControl(_outputs: any, _buffers: Map<string, any>): Promise<void> {
		// Implement output aggregation control
		Logger.log("Applied output aggregation flow control")
	}

	// Data formatting methods
	private structureData(outputs: Record<string, any>): any {
		return { structured: true, data: outputs }
	}

	private formatAsDesignSpec(outputs: Record<string, any>): any {
		return { type: "design_specification", content: outputs }
	}

	private formatAsSourceCode(outputs: Record<string, any>): any {
		return { type: "source_code", files: outputs }
	}

	private formatAsValidatedCode(outputs: Record<string, any>): any {
		return { type: "validated_code", validated: true, content: outputs }
	}

	private formatAsFinalDeliverables(outputs: Record<string, any>): any {
		return { type: "final_deliverables", complete: true, content: outputs }
	}

	private mergeTransformerOutputs(outputs: any[]): any {
		return outputs.reduce((merged, output) => {
			return Object.assign(merged, output)
		}, {})
	}

	private validateAggregatedOutputs(outputs: any[]): any {
		return { validated: true, outputs }
	}

	private consumeAggregatedOutputs(outputs: any[]): any {
		return { consumed: true, final: outputs }
	}

	private getPipelineActionForAgent(_agent: Agent, stage: PipelineStage, analysis: TaskAnalysis): string {
		return `${stage.action} (${stage.dataFlowType}) for ${analysis.taskCategories.join(", ")}`
	}
}

interface PipelineStage {
	name: string
	agents: Agent[]
	action: string
	dataFlowType: "producer" | "transformer" | "validator" | "consumer"
	expectedInputs: string[]
	outputFormat: string
	bufferSize: number
	flowControlStrategy: string
}

/**
 * Hierarchical coordination strategy - master-worker pattern with delegation
 * Implements task decomposition, progress monitoring, and dynamic workload balancing
 */
export class HierarchicalStrategy extends CoordinationStrategy {
	public readonly name = "hierarchical"

	public canHandle(task: AgentTask): boolean {
		// Hierarchical strategy is best for:
		// - Complex tasks requiring clear command structure
		// - Tasks with natural delegation patterns
		// - Large agent teams (5+ agents)
		// - Tasks requiring progress monitoring and coordination
		return task.priority >= 5 && task.description.includes("complex")
	}

	public getResourceRequirements(task: AgentTask): ResourceRequirements {
		const hierarchyLevels = Math.min(4, Math.max(2, Math.floor(task.priority / 3)))
		return {
			maxConcurrentAgents: hierarchyLevels * 2, // Multiple agents per level
			memoryUsageMB: 1536, // Moderate memory for coordination overhead
			estimatedDurationMs: 500000, // Longer duration for coordination
			priority: task.priority > 8 ? "high" : task.priority > 5 ? "medium" : "low",
		}
	}

	public async createPlan(
		planId: string,
		analysis: TaskAnalysis,
		agents: Agent[],
		config?: Partial<StrategyConfig>,
	): Promise<CoordinationPlan> {
		const mergedConfig = this.mergeConfig(config)
		const steps: CoordinationStep[] = []

		// Create hierarchical structure with master-worker relationships
		const hierarchy = this.createHierarchicalStructure(agents, analysis)

		// Create steps based on hierarchical levels
		for (let level = 0; level < hierarchy.levels.length; level++) {
			const levelNodes = hierarchy.levels[level]

			for (let nodeIndex = 0; nodeIndex < levelNodes.length; nodeIndex++) {
				const node = levelNodes[nodeIndex]
				const stepId = `${planId}_level_${level + 1}_node_${nodeIndex + 1}`
				const dependencies = level > 0 ? this.getParentDependencies(node, planId) : []

				const step = this.createStep(
					stepId,
					node.agent.type,
					this.getHierarchicalActionForAgent(node, analysis),
					dependencies,
					level + 1, // Priority based on hierarchy level
					mergedConfig.timeoutStrategy.perAgentTimeout[node.agent.type] || mergedConfig.timeoutStrategy.defaultTimeout,
				)
				step.agentId = node.agent.id

				// Add hierarchical metadata
				step.inputs = {
					hierarchyLevel: level,
					nodeType: node.nodeType,
					subordinates: node.subordinates.map((s) => s.agent.id),
					responsibilities: node.responsibilities,
					delegationCapacity: node.delegationCapacity,
				}

				steps.push(step)
			}
		}

		return {
			id: planId,
			strategy: CoordinationStrategyType.HIERARCHICAL,
			steps,
			agents,
			totalSteps: steps.length,
			completedSteps: 0,
			failedSteps: 0,
			estimatedDuration: this.calculateHierarchicalDuration(hierarchy, mergedConfig),
			status: CoordinationStatus.READY,
			metadata: { config: mergedConfig, hierarchy, workloadDistribution: new Map() },
		}
	}

	public async execute(plan: CoordinationPlan): Promise<boolean> {
		const config = plan.metadata.config as StrategyConfig
		const hierarchy = plan.metadata.hierarchy as HierarchicalStructure
		const workloadDistribution = plan.metadata.workloadDistribution as Map<string, WorkloadInfo>

		Logger.log(`Executing hierarchical plan ${plan.id} with ${hierarchy.levels.length} levels`)

		// Execute levels from top to bottom (master to workers)
		for (let level = 0; level < hierarchy.levels.length; level++) {
			const levelNodes = hierarchy.levels[level]

			Logger.log(`Executing hierarchical level ${level + 1} with ${levelNodes.length} nodes`)

			// Execute all nodes at current level
			const levelPromises = levelNodes.map((node) =>
				this.executeHierarchicalNode(node, plan, workloadDistribution, config, level),
			)

			const levelResults = await Promise.all(levelPromises)

			// Check level success and propagate results
			const levelSuccess = levelResults.every((result) => result)
			if (!levelSuccess) {
				Logger.log(`Hierarchical level ${level + 1} failed`)

				// Apply hierarchical failure handling
				const shouldContinue = await this.handleHierarchicalFailure(level, hierarchy, plan, config)
				if (!shouldContinue) {
					return false
				}
			}

			// Propagate results and delegate to next level
			await this.propagateResultsToSubordinates(level, hierarchy, plan, workloadDistribution)
		}

		const success = plan.failedSteps === 0
		Logger.log(`Hierarchical plan ${plan.id} ${success ? "completed successfully" : "completed with failures"}`)
		return success
	}

	private createHierarchicalStructure(agents: Agent[], analysis: TaskAnalysis): HierarchicalStructure {
		const hierarchy: HierarchicalStructure = {
			levels: [],
			totalNodes: 0,
			maxDepth: 0,
		}

		// Level 0: Master coordinators (Planners, Architects)
		const masterAgents = agents.filter((a) => a.type === AgentType.PLANNER || a.type === AgentType.ARCHITECT)

		if (masterAgents.length > 0) {
			const masterNodes = masterAgents.map((agent) =>
				this.createHierarchicalNode(
					agent,
					"master",
					["task_coordination", "resource_allocation", "quality_oversight"],
					Math.floor(agents.length / masterAgents.length),
				),
			)
			hierarchy.levels.push(masterNodes)
		}

		// Level 1: Senior workers (Researchers, Senior Coders)
		const seniorAgents = agents.filter(
			(a) => a.type === AgentType.RESEARCHER || (a.type === AgentType.CODER && analysis.complexity > 0.6),
		)

		if (seniorAgents.length > 0) {
			const seniorNodes = seniorAgents.map((agent) =>
				this.createHierarchicalNode(
					agent,
					"senior_worker",
					["task_execution", "junior_supervision", "technical_guidance"],
					Math.max(1, Math.floor(agents.length / (masterAgents.length + seniorAgents.length))),
				),
			)
			hierarchy.levels.push(seniorNodes)

			// Link seniors to masters
			this.linkNodesToParents(seniorNodes, hierarchy.levels[0])
		}

		// Level 2: Workers (Coders, Testers, Reviewers)
		const workerAgents = agents.filter(
			(a) =>
				(a.type === AgentType.CODER && analysis.complexity <= 0.6) ||
				a.type === AgentType.TESTER ||
				a.type === AgentType.REVIEWER,
		)

		if (workerAgents.length > 0) {
			const workerNodes = workerAgents.map((agent) =>
				this.createHierarchicalNode(
					agent,
					"worker",
					["direct_execution", "progress_reporting"],
					0, // Workers don't have subordinates
				),
			)
			hierarchy.levels.push(workerNodes)

			// Link workers to appropriate parents
			const parentLevel = hierarchy.levels.length > 2 ? hierarchy.levels[1] : hierarchy.levels[0]
			this.linkNodesToParents(workerNodes, parentLevel)
		}

		// Level 3: Support staff (Documentation, Debuggers)
		const supportAgents = agents.filter((a) => a.type === AgentType.DOCUMENTATION || a.type === AgentType.DEBUGGER)

		if (supportAgents.length > 0) {
			const supportNodes = supportAgents.map((agent) =>
				this.createHierarchicalNode(agent, "support", ["support_services", "maintenance", "documentation"], 0),
			)
			hierarchy.levels.push(supportNodes)

			// Link support to masters for coordination
			this.linkNodesToParents(supportNodes, hierarchy.levels[0])
		}

		hierarchy.totalNodes = hierarchy.levels.reduce((total, level) => total + level.length, 0)
		hierarchy.maxDepth = hierarchy.levels.length

		return hierarchy
	}

	private createHierarchicalNode(
		agent: Agent,
		nodeType: "master" | "senior_worker" | "worker" | "support",
		responsibilities: string[],
		delegationCapacity: number,
	): HierarchicalNode {
		return {
			agent,
			nodeType,
			responsibilities,
			delegationCapacity,
			subordinates: [],
			parent: undefined,
			workload: 0,
			status: "pending",
		}
	}

	private linkNodesToParents(children: HierarchicalNode[], parents: HierarchicalNode[]): void {
		// Distribute children among parents based on delegation capacity
		let parentIndex = 0

		for (const child of children) {
			if (parents.length === 0) {
				break
			}

			const parent = parents[parentIndex]
			if (parent.subordinates.length < parent.delegationCapacity) {
				parent.subordinates.push(child)
				child.parent = parent
			} else {
				// Move to next parent
				parentIndex = (parentIndex + 1) % parents.length
				const nextParent = parents[parentIndex]
				nextParent.subordinates.push(child)
				child.parent = nextParent
			}
		}
	}

	private getParentDependencies(node: HierarchicalNode, planId: string): string[] {
		if (!node.parent) {
			return []
		}

		// Find parent step ID
		const parentStepId = this.findStepIdForAgent(node.parent.agent.id, planId)
		return parentStepId ? [parentStepId] : []
	}

	private findStepIdForAgent(_agentId: string, _planId: string): string | undefined {
		// This would need access to the steps array - simplified for now
		return undefined
	}

	private calculateHierarchicalDuration(hierarchy: HierarchicalStructure, config: StrategyConfig): number {
		// Calculate duration based on hierarchy depth and parallel execution at each level
		return hierarchy.levels.reduce((total, level, _index) => {
			const levelMaxDuration = Math.max(
				...level.map(
					(node) => config.timeoutStrategy.perAgentTimeout[node.agent.type] || config.timeoutStrategy.defaultTimeout,
				),
			)
			// Each level can execute in parallel, but levels are sequential
			return total + levelMaxDuration
		}, 0)
	}

	private async executeHierarchicalNode(
		node: HierarchicalNode,
		plan: CoordinationPlan,
		workloadDistribution: Map<string, WorkloadInfo>,
		config: StrategyConfig,
		_level: number,
	): Promise<boolean> {
		const step = plan.steps.find((s) => s.agentId === node.agent.id)
		if (!step) {
			Logger.log(`Step not found for hierarchical node ${node.agent.id}`)
			return false
		}

		try {
			// Initialize workload tracking
			workloadDistribution.set(node.agent.id, {
				currentTasks: 0,
				maxCapacity: node.delegationCapacity,
				efficiency: 1.0,
				lastUpdate: Date.now(),
			})

			// Execute based on node type
			let success = false
			switch (node.nodeType) {
				case "master":
					success = await this.executeMasterNode(node, step, plan, workloadDistribution, config)
					break
				case "senior_worker":
					success = await this.executeSeniorWorkerNode(node, step, plan, workloadDistribution, config)
					break
				case "worker":
					success = await this.executeWorkerNode(node, step, plan, config)
					break
				case "support":
					success = await this.executeSupportNode(node, step, plan, config)
					break
				default:
					success = await this.executeStep(step, node.agent)
			}

			// Update node status
			node.status = success ? "completed" : "failed"

			if (success) {
				plan.completedSteps++
			} else {
				plan.failedSteps++
			}

			return success
		} catch (error) {
			Logger.log(`Hierarchical node execution failed: ${error}`)
			node.status = "failed"
			plan.failedSteps++
			return false
		}
	}

	private async executeMasterNode(
		node: HierarchicalNode,
		step: CoordinationStep,
		plan: CoordinationPlan,
		workloadDistribution: Map<string, WorkloadInfo>,
		_config: StrategyConfig,
	): Promise<boolean> {
		Logger.log(`Executing master node: ${node.agent.type}`)

		// Master responsibilities: coordinate, allocate, oversee
		step.outputs.masterDirectives = {
			taskDecomposition: await this.decomposeTaskForSubordinates(node, plan),
			resourceAllocation: await this.allocateResourcesToSubordinates(node, workloadDistribution),
			qualityGates: await this.defineQualityGates(node, plan),
		}

		// Execute master-level coordination
		const success = await this.executeStep(step, node.agent)

		if (success) {
			// Delegate tasks to subordinates
			await this.delegateTasksToSubordinates(node, step.outputs.masterDirectives, plan)
		}

		return success
	}

	private async executeSeniorWorkerNode(
		node: HierarchicalNode,
		step: CoordinationStep,
		plan: CoordinationPlan,
		workloadDistribution: Map<string, WorkloadInfo>,
		_config: StrategyConfig,
	): Promise<boolean> {
		Logger.log(`Executing senior worker node: ${node.agent.type}`)

		// Senior worker responsibilities: execute + supervise
		const success = await this.executeStep(step, node.agent)

		if (success && node.subordinates.length > 0) {
			// Supervise subordinates
			step.outputs.supervisionReport = await this.superviseSubordinates(node, plan, workloadDistribution)
		}

		return success
	}

	private async executeWorkerNode(
		node: HierarchicalNode,
		step: CoordinationStep,
		_plan: CoordinationPlan,
		_config: StrategyConfig,
	): Promise<boolean> {
		Logger.log(`Executing worker node: ${node.agent.type}`)

		// Worker responsibilities: direct execution + reporting
		const success = await this.executeStep(step, node.agent)

		if (success) {
			// Report progress to parent
			step.outputs.progressReport = await this.generateProgressReport(node, step)
		}

		return success
	}

	private async executeSupportNode(
		node: HierarchicalNode,
		step: CoordinationStep,
		plan: CoordinationPlan,
		_config: StrategyConfig,
	): Promise<boolean> {
		Logger.log(`Executing support node: ${node.agent.type}`)

		// Support responsibilities: services + maintenance
		const success = await this.executeStep(step, node.agent)

		if (success) {
			// Provide support services
			step.outputs.supportServices = await this.provideSupportServices(node, plan)
		}

		return success
	}

	private async handleHierarchicalFailure(
		failedLevel: number,
		hierarchy: HierarchicalStructure,
		plan: CoordinationPlan,
		config: StrategyConfig,
	): Promise<boolean> {
		Logger.log(`Handling hierarchical failure at level ${failedLevel + 1}`)

		// Apply escalation to higher levels
		if (failedLevel > 0) {
			const parentLevel = hierarchy.levels[failedLevel - 1]
			for (const parentNode of parentLevel) {
				// Notify parents of subordinate failure
				await this.notifyParentOfFailure(parentNode, failedLevel, plan)
			}
		}

		// Check if failure handling allows continuation
		return !config.failureHandling.stopOnFirstFailure
	}

	private async propagateResultsToSubordinates(
		level: number,
		hierarchy: HierarchicalStructure,
		plan: CoordinationPlan,
		_workloadDistribution: Map<string, WorkloadInfo>,
	): Promise<void> {
		if (level >= hierarchy.levels.length - 1) {
			return // Last level, no subordinates
		}

		const currentLevel = hierarchy.levels[level]
		const _nextLevel = hierarchy.levels[level + 1]

		for (const node of currentLevel) {
			const step = plan.steps.find((s) => s.agentId === node.agent.id)
			if (step && step.status === StepStatus.COMPLETED) {
				// Propagate outputs to subordinates
				for (const subordinate of node.subordinates) {
					const subordinateStep = plan.steps.find((s) => s.agentId === subordinate.agent.id)
					if (subordinateStep) {
						subordinateStep.inputs = {
							...subordinateStep.inputs,
							parentOutputs: step.outputs,
							delegatedTasks: step.outputs.masterDirectives || step.outputs.supervisionReport,
						}
					}
				}
			}
		}
	}

	private getHierarchicalActionForAgent(node: HierarchicalNode, analysis: TaskAnalysis): string {
		const baseAction = `${node.nodeType.toUpperCase()}: ${node.responsibilities.join(", ")}`
		const contextualAction = `for ${analysis.taskCategories.join(", ")} (complexity: ${analysis.complexity.toFixed(2)})`

		return `${baseAction} ${contextualAction}`
	}

	// Helper methods for hierarchical operations
	private async decomposeTaskForSubordinates(node: HierarchicalNode, _plan: CoordinationPlan): Promise<any> {
		return {
			subtasks: node.subordinates.map((_, index) => `subtask_${index + 1}`),
			priorities: node.subordinates.map(() => Math.random()), // Simplified
			dependencies: [],
		}
	}

	private async allocateResourcesToSubordinates(
		node: HierarchicalNode,
		workloadDistribution: Map<string, WorkloadInfo>,
	): Promise<any> {
		const allocation: Record<string, number> = {}
		const totalCapacity = node.subordinates.reduce((sum, sub) => {
			const workload = workloadDistribution.get(sub.agent.id)
			return sum + (workload?.maxCapacity || 1)
		}, 0)

		node.subordinates.forEach((sub) => {
			const workload = workloadDistribution.get(sub.agent.id)
			allocation[sub.agent.id] = (workload?.maxCapacity || 1) / totalCapacity
		})

		return allocation
	}

	private async defineQualityGates(node: HierarchicalNode, _plan: CoordinationPlan): Promise<any> {
		return {
			gates: ["input_validation", "process_verification", "output_quality"],
			criteria: "Standard quality criteria",
			checkpoints: node.subordinates.map((sub) => `checkpoint_${sub.agent.id}`),
		}
	}

	private async delegateTasksToSubordinates(node: HierarchicalNode, directives: any, plan: CoordinationPlan): Promise<void> {
		for (const subordinate of node.subordinates) {
			const subordinateStep = plan.steps.find((s) => s.agentId === subordinate.agent.id)
			if (subordinateStep) {
				subordinateStep.inputs.delegation = {
					from: node.agent.id,
					directives,
					authority: node.nodeType === "master" ? "full" : "limited",
				}
			}
		}
	}

	private async superviseSubordinates(
		node: HierarchicalNode,
		_plan: CoordinationPlan,
		workloadDistribution: Map<string, WorkloadInfo>,
	): Promise<any> {
		const supervisionReport = {
			subordinateStatus: {} as Record<string, string>,
			workloadBalance: {} as Record<string, number>,
			recommendations: [] as string[],
		}

		for (const subordinate of node.subordinates) {
			const workload = workloadDistribution.get(subordinate.agent.id)
			supervisionReport.subordinateStatus[subordinate.agent.id] = subordinate.status
			supervisionReport.workloadBalance[subordinate.agent.id] = workload?.efficiency || 1.0
		}

		return supervisionReport
	}

	private async generateProgressReport(node: HierarchicalNode, step: CoordinationStep): Promise<any> {
		return {
			agentId: node.agent.id,
			nodeType: node.nodeType,
			status: step.status,
			completion: step.endTime ? 100 : step.startTime ? 50 : 0,
			issues: [],
			recommendations: [],
		}
	}

	private async provideSupportServices(node: HierarchicalNode, plan: CoordinationPlan): Promise<any> {
		return {
			serviceType: node.agent.type,
			servicesProvided: node.responsibilities,
			supportedAgents: plan.agents.filter((a) => a.id !== node.agent.id).map((a) => a.id),
			availability: "24/7",
		}
	}

	private async notifyParentOfFailure(
		parentNode: HierarchicalNode,
		failedLevel: number,
		plan: CoordinationPlan,
	): Promise<void> {
		Logger.log(`Notifying parent ${parentNode.agent.id} of failure at level ${failedLevel + 1}`)

		const parentStep = plan.steps.find((s) => s.agentId === parentNode.agent.id)
		if (parentStep) {
			parentStep.outputs.failureNotifications = parentStep.outputs.failureNotifications || []
			parentStep.outputs.failureNotifications.push({
				level: failedLevel,
				timestamp: Date.now(),
				action: "escalation_required",
			})
		}
	}
}

// Supporting interfaces for hierarchical coordination

interface HierarchicalStructure {
	levels: HierarchicalNode[][]
	totalNodes: number
	maxDepth: number
}

interface HierarchicalNode {
	agent: Agent
	nodeType: "master" | "senior_worker" | "worker" | "support"
	responsibilities: string[]
	delegationCapacity: number
	subordinates: HierarchicalNode[]
	parent?: HierarchicalNode
	workload: number
	status: "pending" | "executing" | "completed" | "failed"
}

interface WorkloadInfo {
	currentTasks: number
	maxCapacity: number
	efficiency: number
	lastUpdate: number
}

/**
 * Swarm coordination strategy - decentralized coordination with self-organization
 * Implements distributed decision making, consensus algorithms, and fault tolerance
 */
export class SwarmStrategy extends CoordinationStrategy {
	public readonly name = "swarm"

	public canHandle(task: AgentTask): boolean {
		// Swarm strategy is best for:
		// - Highly complex, distributed tasks
		// - Tasks requiring fault tolerance and self-organization
		// - Large agent teams with diverse capabilities
		// - Tasks benefiting from emergent behavior and consensus
		return (task.priority >= 6 && task.description.includes("distributed")) || task.priority >= 8
	}

	public getResourceRequirements(task: AgentTask): ResourceRequirements {
		const swarmSize = Math.min(8, Math.max(3, Math.floor(task.priority)))
		return {
			maxConcurrentAgents: swarmSize, // Large swarm for distributed processing
			memoryUsageMB: 2048, // High memory for consensus and communication
			estimatedDurationMs: 400000, // Moderate duration with parallel consensus
			priority: task.priority > 9 ? "high" : task.priority > 6 ? "medium" : "low",
		}
	}

	public async createPlan(
		planId: string,
		analysis: TaskAnalysis,
		agents: Agent[],
		config?: Partial<StrategyConfig>,
	): Promise<CoordinationPlan> {
		const mergedConfig = this.mergeConfig(config)
		const steps: CoordinationStep[] = []

		// Create swarm network with autonomous agents
		const swarmNetwork = this.createSwarmNetwork(agents, analysis)

		// Initialize swarm behavior patterns
		for (let i = 0; i < agents.length; i++) {
			const agent = agents[i]
			const stepId = `${planId}_swarm_agent_${i + 1}`

			const step = this.createStep(
				stepId,
				agent.type,
				this.getSwarmActionForAgent(agent, analysis, swarmNetwork),
				[], // No rigid dependencies in swarm - agents self-organize
				this.calculateSwarmPriority(agent, swarmNetwork),
				mergedConfig.timeoutStrategy.perAgentTimeout[agent.type] || mergedConfig.timeoutStrategy.defaultTimeout,
			)
			step.agentId = agent.id

			// Add swarm-specific metadata
			step.inputs = {
				swarmRole: swarmNetwork.agentRoles.get(agent.id),
				neighbors: swarmNetwork.neighborMap.get(agent.id) || [],
				autonomyLevel: swarmNetwork.autonomyLevels.get(agent.id) || 0.5,
				consensusWeight: swarmNetwork.consensusWeights.get(agent.id) || 1.0,
				communicationRadius: swarmNetwork.communicationRadius,
				emergentBehaviors: swarmNetwork.enabledBehaviors,
			}

			steps.push(step)
		}

		return {
			id: planId,
			strategy: CoordinationStrategyType.SWARM,
			steps,
			agents,
			totalSteps: steps.length,
			completedSteps: 0,
			failedSteps: 0,
			estimatedDuration: this.calculateSwarmDuration(swarmNetwork, mergedConfig),
			status: CoordinationStatus.READY,
			metadata: {
				config: mergedConfig,
				swarmNetwork,
				consensusState: new Map(),
				emergentBehaviors: [],
				communicationLog: [],
			},
		}
	}

	public async execute(plan: CoordinationPlan): Promise<boolean> {
		const config = plan.metadata.config as StrategyConfig
		const swarmNetwork = plan.metadata.swarmNetwork as SwarmNetwork
		const consensusState = plan.metadata.consensusState as Map<string, any>
		const emergentBehaviors = plan.metadata.emergentBehaviors as SwarmBehavior[]
		const communicationLog = plan.metadata.communicationLog as SwarmMessage[]

		Logger.log(`Executing swarm plan ${plan.id} with ${plan.agents.length} autonomous agents`)

		// Initialize swarm communication and consensus
		const swarmCommunicator = new SwarmCommunicator(swarmNetwork, communicationLog)
		const consensusEngine = new ConsensusEngine(swarmNetwork, consensusState)

		try {
			// Phase 1: Self-organization and network formation
			await this.performSwarmSelfOrganization(plan, swarmCommunicator, consensusEngine)

			// Phase 2: Distributed task allocation through emergent behavior
			const taskAllocations = await this.performDistributedTaskAllocation(
				plan,
				swarmCommunicator,
				consensusEngine,
				emergentBehaviors,
			)

			// Phase 3: Autonomous execution with real-time coordination
			const executionResults = await this.performAutonomousExecution(
				plan,
				swarmCommunicator,
				consensusEngine,
				taskAllocations,
				config,
			)

			// Phase 4: Consensus validation and result aggregation
			const finalConsensus = await this.achieveFinalConsensus(plan, executionResults, consensusEngine)

			const success = finalConsensus && plan.failedSteps === 0
			Logger.log(`Swarm plan ${plan.id} ${success ? "achieved consensus and completed" : "failed to reach consensus"}`)
			return success
		} finally {
			swarmCommunicator.dispose()
			consensusEngine.dispose()
		}
	}

	private createSwarmNetwork(agents: Agent[], analysis: TaskAnalysis): SwarmNetwork {
		const network: SwarmNetwork = {
			agentRoles: new Map(),
			neighborMap: new Map(),
			autonomyLevels: new Map(),
			consensusWeights: new Map(),
			communicationRadius: this.calculateCommunicationRadius(agents.length),
			enabledBehaviors: this.determineSwarmBehaviors(analysis),
			networkTopology: "small_world", // Default topology
			faultTolerance: 0.3, // Can handle 30% agent failures
		}

		// Assign swarm roles based on agent capabilities
		for (const agent of agents) {
			const role = this.assignSwarmRole(agent, analysis)
			network.agentRoles.set(agent.id, role)

			// Set autonomy level based on role and agent type
			const autonomy = this.calculateAutonomyLevel(agent, role)
			network.autonomyLevels.set(agent.id, autonomy)

			// Set consensus weight based on expertise and role
			const weight = this.calculateConsensusWeight(agent, role, analysis)
			network.consensusWeights.set(agent.id, weight)
		}

		// Create neighbor connections based on roles and communication patterns
		this.establishNeighborConnections(network, agents)

		return network
	}

	private assignSwarmRole(agent: Agent, analysis: TaskAnalysis): SwarmRole {
		// Assign roles based on agent type and task complexity
		switch (agent.type) {
			case AgentType.PLANNER:
			case AgentType.ARCHITECT:
				return "coordinator" // High-level coordination and decision making

			case AgentType.RESEARCHER:
				return "scout" // Information gathering and exploration

			case AgentType.CODER:
				return analysis.complexity > 0.6 ? "specialist" : "worker" // Specialized vs general work

			case AgentType.TESTER:
			case AgentType.REVIEWER:
				return "validator" // Quality assurance and validation

			case AgentType.DEBUGGER:
				return "maintainer" // System maintenance and repair

			case AgentType.DOCUMENTATION:
				return "communicator" // Information sharing and documentation

			default:
				return "worker" // Default role
		}
	}

	private calculateAutonomyLevel(_agent: Agent, role: SwarmRole): number {
		// Higher autonomy for specialized roles
		const baseAutonomy: Record<SwarmRole, number> = {
			coordinator: 0.9, // High autonomy for decision makers
			specialist: 0.8, // High autonomy for experts
			scout: 0.7, // Medium-high autonomy for explorers
			validator: 0.6, // Medium autonomy for quality control
			communicator: 0.5, // Medium autonomy for facilitators
			maintainer: 0.6, // Medium autonomy for maintenance
			worker: 0.4, // Lower autonomy for general workers
		}

		return baseAutonomy[role] || 0.5
	}

	private calculateConsensusWeight(_agent: Agent, role: SwarmRole, analysis: TaskAnalysis): number {
		// Weight based on expertise relevance to task
		const roleWeights: Record<SwarmRole, number> = {
			coordinator: 1.5, // Higher weight for coordinators
			specialist: 1.3, // High weight for specialists
			scout: 1.0, // Standard weight for scouts
			validator: 1.2, // Higher weight for validators
			communicator: 0.8, // Lower weight for communicators
			maintainer: 1.0, // Standard weight for maintainers
			worker: 0.9, // Slightly lower weight for workers
		}

		// Adjust based on task complexity and agent type relevance
		const complexityMultiplier = analysis.complexity > 0.7 ? 1.2 : 1.0
		return (roleWeights[role] || 1.0) * complexityMultiplier
	}

	private calculateCommunicationRadius(agentCount: number): number {
		// Optimal communication radius for small-world network
		return Math.max(2, Math.floor(Math.log2(agentCount)) + 1)
	}

	private determineSwarmBehaviors(analysis: TaskAnalysis): SwarmBehaviorType[] {
		const behaviors: SwarmBehaviorType[] = ["self_organization", "consensus_building"]

		// Add behaviors based on task characteristics
		if (analysis.complexity > 0.6) {
			behaviors.push("emergent_specialization")
		}

		if (
			analysis.taskCategories.includes(TaskCategory.CODE_GENERATION) ||
			analysis.taskCategories.includes(TaskCategory.ARCHITECTURE)
		) {
			behaviors.push("collective_intelligence")
		}

		if (analysis.requiredAgentTypes.length > 5) {
			behaviors.push("swarm_optimization")
		}

		behaviors.push("fault_tolerance") // Always enable fault tolerance

		return behaviors
	}

	private establishNeighborConnections(network: SwarmNetwork, agents: Agent[]): void {
		const radius = network.communicationRadius

		for (let i = 0; i < agents.length; i++) {
			const agent = agents[i]
			const neighbors: string[] = []

			// Connect to nearby agents in the network
			for (let j = 0; j < agents.length; j++) {
				if (i !== j) {
					const distance = Math.abs(i - j)
					const shouldConnect =
						distance <= radius ||
						this.shouldConnectByRole(network.agentRoles.get(agent.id)!, network.agentRoles.get(agents[j].id)!) ||
						Math.random() < 0.1 // Some random long-range connections

					if (shouldConnect) {
						neighbors.push(agents[j].id)
					}
				}
			}

			network.neighborMap.set(agent.id, neighbors)
		}
	}

	private shouldConnectByRole(role1: SwarmRole, role2: SwarmRole): boolean {
		// Define which roles should be connected regardless of distance
		const roleConnections: Record<SwarmRole, SwarmRole[]> = {
			coordinator: ["specialist", "validator", "scout"],
			specialist: ["coordinator", "validator", "worker"],
			scout: ["coordinator", "communicator"],
			validator: ["coordinator", "specialist", "worker"],
			communicator: ["scout", "coordinator"],
			maintainer: ["validator", "worker"],
			worker: ["specialist", "validator", "maintainer"],
		}

		return roleConnections[role1]?.includes(role2) || false
	}

	private calculateSwarmDuration(network: SwarmNetwork, config: StrategyConfig): number {
		// Swarm can work in parallel but needs time for consensus
		const baseDuration = Math.max(...Object.values(config.timeoutStrategy.perAgentTimeout))
		const consensusOverhead = network.agentRoles.size * 1000 // 1 second per agent for consensus
		const networkLatency = network.communicationRadius * 500 // 500ms per hop

		return baseDuration + consensusOverhead + networkLatency
	}

	private async performSwarmSelfOrganization(
		plan: CoordinationPlan,
		communicator: SwarmCommunicator,
		_consensus: ConsensusEngine,
	): Promise<void> {
		Logger.log("Swarm self-organization phase starting")

		// Agents discover neighbors and establish communication
		for (const agent of plan.agents) {
			const step = plan.steps.find((s) => s.agentId === agent.id)!
			const neighbors = step.inputs.neighbors as string[]

			// Send introduction messages to neighbors
			for (const neighborId of neighbors) {
				await communicator.sendMessage({
					from: agent.id,
					to: neighborId,
					type: "introduction",
					content: {
						role: step.inputs.swarmRole,
						capabilities: agent.type,
						autonomy: step.inputs.autonomyLevel,
					},
					timestamp: Date.now(),
				})
			}
		}

		// Allow time for network formation
		await new Promise((resolve) => setTimeout(resolve, 1000))
		Logger.log("Swarm network formation complete")
	}

	private async performDistributedTaskAllocation(
		plan: CoordinationPlan,
		communicator: SwarmCommunicator,
		consensus: ConsensusEngine,
		_emergentBehaviors: SwarmBehavior[],
	): Promise<Map<string, string[]>> {
		Logger.log("Distributed task allocation phase starting")

		const allocations = new Map<string, string[]>()

		// Coordinators propose task decomposition
		const coordinators = plan.agents.filter((agent) => {
			const step = plan.steps.find((s) => s.agentId === agent.id)!
			return step.inputs.swarmRole === "coordinator"
		})

		// Each coordinator proposes task breakdown
		const proposals: TaskProposal[] = []
		for (const coordinator of coordinators) {
			const proposal = await this.generateTaskProposal(coordinator, plan)
			proposals.push(proposal)

			// Broadcast proposal to network
			await communicator.broadcastMessage({
				from: coordinator.id,
				to: "all",
				type: "task_proposal",
				content: proposal,
				timestamp: Date.now(),
			})
		}

		// Agents vote on proposals and self-assign to tasks
		const votes = await consensus.collectVotes(proposals, plan.agents)
		const winningProposal = await consensus.selectWinningProposal(votes, proposals)

		// Agents autonomously assign themselves to tasks based on capabilities
		for (const agent of plan.agents) {
			const step = plan.steps.find((s) => s.agentId === agent.id)!
			const assignedTasks = await this.autonomousTaskSelection(agent, winningProposal, step.inputs.autonomyLevel as number)
			allocations.set(agent.id, assignedTasks)
		}

		Logger.log(`Task allocation complete: ${allocations.size} agents assigned`)
		return allocations
	}

	private async performAutonomousExecution(
		plan: CoordinationPlan,
		communicator: SwarmCommunicator,
		consensus: ConsensusEngine,
		allocations: Map<string, string[]>,
		config: StrategyConfig,
	): Promise<Map<string, boolean>> {
		Logger.log("Autonomous execution phase starting")

		const results = new Map<string, boolean>()

		// Execute agents autonomously with real-time coordination
		const executionPromises = plan.agents.map(async (agent) => {
			const step = plan.steps.find((s) => s.agentId === agent.id)!
			const assignedTasks = allocations.get(agent.id) || []

			try {
				// Execute assigned tasks with swarm coordination
				const success = await this.executeSwarmAgent(agent, step, assignedTasks, communicator, consensus, config)

				results.set(agent.id, success)

				if (success) {
					plan.completedSteps++
				} else {
					plan.failedSteps++
				}

				return success
			} catch (error) {
				Logger.log(`Swarm agent ${agent.id} execution failed: ${error}`)
				results.set(agent.id, false)
				plan.failedSteps++
				return false
			}
		})

		await Promise.all(executionPromises)
		Logger.log(`Autonomous execution complete: ${plan.completedSteps} successful, ${plan.failedSteps} failed`)

		return results
	}

	private async achieveFinalConsensus(
		plan: CoordinationPlan,
		results: Map<string, boolean>,
		consensus: ConsensusEngine,
	): Promise<boolean> {
		Logger.log("Final consensus phase starting")

		// Collect final results from all agents
		const finalResults: AgentResult[] = []
		for (const [agentId, success] of results.entries()) {
			const _agent = plan.agents.find((a) => a.id === agentId)!
			const step = plan.steps.find((s) => s.agentId === agentId)!

			finalResults.push({
				agentId,
				success,
				outputs: step.outputs,
				confidence: success ? 0.9 : 0.1,
				timestamp: Date.now(),
			})
		}

		// Achieve consensus on overall success
		const consensusResult = await consensus.achieveConsensus(finalResults, 0.75) // 75% threshold

		Logger.log(`Final consensus: ${consensusResult ? "ACHIEVED" : "FAILED"}`)
		return consensusResult
	}

	private async generateTaskProposal(coordinator: Agent, plan: CoordinationPlan): Promise<TaskProposal> {
		// Simplified task proposal generation
		return {
			proposerId: coordinator.id,
			tasks: [
				{ id: "research", type: "information_gathering", priority: 1 },
				{ id: "design", type: "architecture", priority: 2 },
				{ id: "implement", type: "development", priority: 3 },
				{ id: "validate", type: "quality_assurance", priority: 4 },
			],
			estimatedDuration: 300000, // 5 minutes
			resourceRequirements: { agents: plan.agents.length, memory: 1024 },
			confidence: 0.8,
		}
	}

	private async autonomousTaskSelection(agent: Agent, proposal: TaskProposal, autonomyLevel: number): Promise<string[]> {
		// Agent selects tasks based on capabilities and autonomy
		const suitableTasks = proposal.tasks.filter((task) => {
			switch (agent.type) {
				case AgentType.RESEARCHER:
					return task.type === "information_gathering"
				case AgentType.ARCHITECT:
					return task.type === "architecture"
				case AgentType.CODER:
					return task.type === "development"
				case AgentType.TESTER:
				case AgentType.REVIEWER:
					return task.type === "quality_assurance"
				default:
					return true
			}
		})

		// Select tasks based on autonomy level
		const maxTasks = Math.ceil(autonomyLevel * suitableTasks.length)
		return suitableTasks.slice(0, maxTasks).map((task) => task.id)
	}

	private async executeSwarmAgent(
		agent: Agent,
		step: CoordinationStep,
		tasks: string[],
		communicator: SwarmCommunicator,
		_consensus: ConsensusEngine,
		_config: StrategyConfig,
	): Promise<boolean> {
		// Execute step with swarm coordination
		step.outputs.assignedTasks = tasks
		step.outputs.swarmRole = step.inputs.swarmRole

		// Coordinate with neighbors during execution
		const neighbors = step.inputs.neighbors as string[]
		for (const neighborId of neighbors) {
			await communicator.sendMessage({
				from: agent.id,
				to: neighborId,
				type: "coordination",
				content: { status: "executing", tasks },
				timestamp: Date.now(),
			})
		}

		// Execute the actual step
		const success = await this.executeStep(step, agent)

		// Report results to swarm
		await communicator.broadcastMessage({
			from: agent.id,
			to: "all",
			type: "execution_result",
			content: { success, tasks, outputs: step.outputs },
			timestamp: Date.now(),
		})

		return success
	}

	private calculateSwarmPriority(agent: Agent, network: SwarmNetwork): number {
		const role = network.agentRoles.get(agent.id)!
		const rolePriorities: Record<SwarmRole, number> = {
			coordinator: 5,
			specialist: 4,
			scout: 3,
			validator: 3,
			maintainer: 2,
			communicator: 2,
			worker: 1,
		}

		return rolePriorities[role] || 1
	}

	private getSwarmActionForAgent(agent: Agent, analysis: TaskAnalysis, network: SwarmNetwork): string {
		const role = network.agentRoles.get(agent.id)!
		const autonomy = network.autonomyLevels.get(agent.id)!

		return (
			`SWARM ${role.toUpperCase()} (autonomy: ${(autonomy * 100).toFixed(0)}%): ` +
			`Self-organize and execute ${analysis.taskCategories.join(", ")} with emergent coordination`
		)
	}
}

// Supporting classes and interfaces for swarm coordination

class SwarmCommunicator {
	private messageLog: SwarmMessage[]

	constructor(_network: SwarmNetwork, existingLog: SwarmMessage[]) {
		this.messageLog = existingLog
	}

	async sendMessage(message: SwarmMessage): Promise<void> {
		this.messageLog.push(message)
		// Simulate message delivery delay
		await new Promise((resolve) => setTimeout(resolve, 10))
	}

	async broadcastMessage(message: SwarmMessage): Promise<void> {
		this.messageLog.push(message)
		// Simulate broadcast delay
		await new Promise((resolve) => setTimeout(resolve, 50))
	}

	getMessages(agentId?: string): SwarmMessage[] {
		if (!agentId) {
			return this.messageLog
		}
		return this.messageLog.filter((msg) => msg.to === agentId || msg.to === "all" || msg.from === agentId)
	}

	dispose(): void {
		// Cleanup communication resources
	}
}

class ConsensusEngine {
	private consensusState: Map<string, any>

	constructor(
		private network: SwarmNetwork,
		existingState: Map<string, any>,
	) {
		this.consensusState = existingState
	}

	async collectVotes(proposals: TaskProposal[], agents: Agent[]): Promise<Map<string, string>> {
		const votes = new Map<string, string>()

		// Simulate voting process
		for (const agent of agents) {
			const preferredProposal = proposals[Math.floor(Math.random() * proposals.length)]
			votes.set(agent.id, preferredProposal.proposerId)
		}

		return votes
	}

	async selectWinningProposal(votes: Map<string, string>, proposals: TaskProposal[]): Promise<TaskProposal> {
		// Count votes and apply consensus weights
		const voteCounts = new Map<string, number>()

		for (const [agentId, proposalId] of votes.entries()) {
			const weight = this.network.consensusWeights.get(agentId) || 1.0
			const currentCount = voteCounts.get(proposalId) || 0
			voteCounts.set(proposalId, currentCount + weight)
		}

		// Find winning proposal
		let maxVotes = 0
		let winningProposalId = ""
		for (const [proposalId, count] of voteCounts.entries()) {
			if (count > maxVotes) {
				maxVotes = count
				winningProposalId = proposalId
			}
		}

		return proposals.find((p) => p.proposerId === winningProposalId) || proposals[0]
	}

	async achieveConsensus(results: AgentResult[], threshold: number): Promise<boolean> {
		const totalWeight = Array.from(this.network.consensusWeights.values()).reduce((sum, w) => sum + w, 0)
		let successWeight = 0

		for (const result of results) {
			if (result.success) {
				const weight = this.network.consensusWeights.get(result.agentId) || 1.0
				successWeight += weight * result.confidence
			}
		}

		const consensusRatio = successWeight / totalWeight
		return consensusRatio >= threshold
	}

	dispose(): void {
		// Cleanup consensus resources
	}
}

// Supporting interfaces for swarm coordination

interface SwarmNetwork {
	agentRoles: Map<string, SwarmRole>
	neighborMap: Map<string, string[]>
	autonomyLevels: Map<string, number>
	consensusWeights: Map<string, number>
	communicationRadius: number
	enabledBehaviors: SwarmBehaviorType[]
	networkTopology: "mesh" | "star" | "ring" | "small_world"
	faultTolerance: number
}

type SwarmRole = "coordinator" | "specialist" | "scout" | "validator" | "communicator" | "maintainer" | "worker"

type SwarmBehaviorType =
	| "self_organization"
	| "consensus_building"
	| "emergent_specialization"
	| "collective_intelligence"
	| "swarm_optimization"
	| "fault_tolerance"

interface SwarmBehavior {
	type: SwarmBehaviorType
	strength: number
	participants: string[]
	emergenceTime: number
}

interface SwarmMessage {
	from: string
	to: string
	type: "introduction" | "task_proposal" | "coordination" | "execution_result" | "consensus_vote"
	content: any
	timestamp: number
}

interface TaskProposal {
	proposerId: string
	tasks: TaskSpec[]
	estimatedDuration: number
	resourceRequirements: any
	confidence: number
}

interface TaskSpec {
	id: string
	type: string
	priority: number
}

interface AgentResult {
	agentId: string
	success: boolean
	outputs: any
	confidence: number
	timestamp: number
}
