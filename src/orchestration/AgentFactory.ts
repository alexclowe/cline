/**
 * AgentFactory - Creates and configures specialized agents for different task types
 *
 * This factory integrates with:
 * - Existing provider system (src/providers/)
 * - Swarm coordination system (src/swarm/)
 * - Memory management (src/memory/)
 */

import { VsCodeLmHandler } from "../core/api/providers/vscode-lm"
import { IMemoryManager } from "../memory/manager"
import { Logger } from "../services/logging/Logger"
import { SwarmCoordinator } from "../swarm/coordinator"
import { AgentCapabilities } from "../swarm/types"
import {
	AgentExecutor,
	AgentTask,
	AgentTaskResult,
	ArchitectAgentExecutor,
	BaseAgentExecutor,
	CoderAgentExecutor,
	DebuggerAgentExecutor,
	DocumentationAgentExecutor,
	PlannerAgentExecutor,
	ResearcherAgentExecutor,
	ReviewerAgentExecutor,
	TesterAgentExecutor,
} from "./AgentExecutors"
import { AgentType, TaskAnalysis } from "./TaskAnalyzer"

export interface Agent {
	id: string
	type: AgentType
	name: string
	capabilities: AgentCapabilities
	provider: string
	model: string
	systemPrompt: string
	tools: string[]
	memoryContext: string
	status: AgentStatus
	createdAt: Date
	lastActiveAt: Date
	tasksCompleted: number
	successRate: number
}

export enum AgentCapability {
	CODE_GENERATION = "code_generation",
	CODE_ANALYSIS = "code_analysis",
	DEBUGGING = "debugging",
	TESTING = "testing",
	DOCUMENTATION = "documentation",
	RESEARCH = "research",
	ARCHITECTURE_DESIGN = "architecture_design",
	PERFORMANCE_OPTIMIZATION = "performance_optimization",
	SECURITY_ANALYSIS = "security_analysis",
	DATABASE_OPERATIONS = "database_operations",
	API_INTEGRATION = "api_integration",
	UI_UX_DESIGN = "ui_ux_design",
}

export enum AgentStatus {
	INITIALIZING = "initializing",
	READY = "ready",
	WORKING = "working",
	WAITING = "waiting",
	ERROR = "error",
	COMPLETED = "completed",
	TERMINATED = "terminated",
}

export interface AgentConfiguration {
	preferredProvider?: string
	preferredModel?: string
	memorySize?: number
	timeoutMinutes?: number
	maxRetries?: number
	tools?: string[]
	customPrompt?: string
}

export class AgentFactory {
	private static agentCounter = 0
	private static activeAgents = new Map<string, Agent>()
	private static agentExecutors = new Map<string, AgentExecutor>()

	// Agent template configurations
	private static readonly AGENT_TEMPLATES = {
		[AgentType.CODER]: {
			name: "Code Specialist",
			capabilities: [AgentCapability.CODE_GENERATION, AgentCapability.CODE_ANALYSIS, AgentCapability.DEBUGGING],
			systemPrompt: `You are a specialized coding agent focused on writing high-quality, maintainable code. 
Your expertise includes:
- Writing clean, efficient code following best practices
- Code analysis and refactoring
- Implementing algorithms and data structures
- Following coding standards and conventions
- Optimizing performance and readability

Always prioritize code quality, security, and maintainability.`,
			tools: ["write_to_file", "replace_in_file", "read_file", "execute_command", "search_files"],
			preferredModels: ["claude-3-5-sonnet", "gpt-4", "deepseek-coder"],
		},

		[AgentType.PLANNER]: {
			name: "Task Planning Specialist",
			capabilities: [AgentCapability.ARCHITECTURE_DESIGN, AgentCapability.CODE_ANALYSIS, AgentCapability.RESEARCH],
			systemPrompt: `You are a strategic planning agent focused on task analysis and workflow design.
Your expertise includes:
- Breaking down complex tasks into manageable components
- Creating detailed execution strategies and workflows
- Analyzing task dependencies and requirements
- Risk assessment and mitigation planning
- Resource allocation and timeline estimation
- Coordinating multi-agent collaboration strategies

Always provide clear, actionable plans with well-defined steps and success criteria.`,
			tools: ["read_file", "search_files", "list_files", "list_code_definition_names"],
			preferredModels: ["claude-3-5-sonnet", "gpt-4", "gemini-pro"],
		},

		[AgentType.RESEARCHER]: {
			name: "Research Specialist",
			capabilities: [AgentCapability.RESEARCH, AgentCapability.CODE_ANALYSIS, AgentCapability.DOCUMENTATION],
			systemPrompt: `You are a research specialist focused on gathering information and analyzing requirements.
Your expertise includes:
- Researching technologies, frameworks, and best practices
- Analyzing existing codebases and documentation
- Finding solutions to technical problems
- Evaluating different approaches and trade-offs
- Providing detailed technical analysis

Always provide thorough research with sources and evidence-based recommendations.`,
			tools: ["read_file", "search_files", "web_fetch", "use_mcp_tool"],
			preferredModels: ["claude-3-5-sonnet", "gpt-4-turbo", "gemini-pro"],
		},

		[AgentType.TESTER]: {
			name: "Testing Specialist",
			capabilities: [AgentCapability.TESTING, AgentCapability.CODE_ANALYSIS, AgentCapability.DEBUGGING],
			systemPrompt: `You are a testing specialist focused on ensuring code quality through comprehensive testing.
Your expertise includes:
- Writing unit tests, integration tests, and end-to-end tests
- Test-driven development (TDD) practices
- Code coverage analysis
- Performance testing and benchmarking
- Quality assurance and bug detection

Always aim for high test coverage and robust testing strategies.`,
			tools: ["write_to_file", "execute_command", "read_file", "search_files"],
			preferredModels: ["claude-3-5-sonnet", "gpt-4", "deepseek-coder"],
		},

		[AgentType.REVIEWER]: {
			name: "Code Reviewer",
			capabilities: [
				AgentCapability.CODE_ANALYSIS,
				AgentCapability.SECURITY_ANALYSIS,
				AgentCapability.PERFORMANCE_OPTIMIZATION,
			],
			systemPrompt: `You are a code review specialist focused on ensuring code quality and best practices.
Your expertise includes:
- Code review and quality assessment
- Security vulnerability detection
- Performance optimization suggestions
- Architecture and design pattern evaluation
- Best practices enforcement

Always provide constructive feedback with specific recommendations for improvement.`,
			tools: ["read_file", "search_files", "list_files"],
			preferredModels: ["claude-3-5-sonnet", "gpt-4", "gemini-pro"],
		},

		[AgentType.DOCUMENTATION]: {
			name: "Documentation Specialist",
			capabilities: [AgentCapability.DOCUMENTATION, AgentCapability.CODE_ANALYSIS],
			systemPrompt: `You are a documentation specialist focused on creating clear, comprehensive documentation.
Your expertise includes:
- Writing technical documentation and README files
- Code commenting and inline documentation
- API documentation generation
- User guides and tutorials
- Architecture documentation

Always create documentation that is clear, accurate, and helpful for developers.`,
			tools: ["write_to_file", "read_file", "search_files"],
			preferredModels: ["claude-3-5-sonnet", "gpt-4-turbo", "gemini-pro"],
		},

		[AgentType.DEBUGGER]: {
			name: "Debug Specialist",
			capabilities: [AgentCapability.DEBUGGING, AgentCapability.CODE_ANALYSIS, AgentCapability.TESTING],
			systemPrompt: `You are a debugging specialist focused on identifying and fixing bugs efficiently.
Your expertise includes:
- Bug identification and root cause analysis
- Error tracking and debugging techniques
- Performance profiling and optimization
- Log analysis and monitoring
- Systematic troubleshooting approaches

Always approach debugging methodically with detailed analysis and testing.`,
			tools: ["read_file", "execute_command", "search_files", "replace_in_file"],
			preferredModels: ["claude-3-5-sonnet", "deepseek-coder", "gpt-4"],
		},

		[AgentType.ARCHITECT]: {
			name: "Architecture Specialist",
			capabilities: [
				AgentCapability.ARCHITECTURE_DESIGN,
				AgentCapability.CODE_ANALYSIS,
				AgentCapability.PERFORMANCE_OPTIMIZATION,
			],
			systemPrompt: `You are a software architecture specialist focused on designing scalable, maintainable systems.
Your expertise includes:
- System architecture design and planning
- Design pattern selection and implementation
- Scalability and performance considerations
- Technology stack evaluation
- Microservices and distributed systems

Always consider long-term maintainability, scalability, and architectural best practices.`,
			tools: ["read_file", "search_files", "write_to_file", "list_files"],
			preferredModels: ["claude-3-5-sonnet", "gpt-4", "gemini-pro"],
		},
	}

	constructor(
		private vsCodeLmHandler: VsCodeLmHandler,
		private swarmCoordinator: SwarmCoordinator,
		private memoryManager: IMemoryManager,
	) {}

	/**
	 * Creates agents based on task analysis
	 */
	public async createAgentsForTask(analysis: TaskAnalysis, config?: AgentConfiguration): Promise<Agent[]> {
		Logger.log(`Creating ${analysis.requiredAgentTypes.length} agents for task`)

		const agents: Agent[] = []

		for (const agentType of analysis.requiredAgentTypes) {
			try {
				const agent = await this.createAgent(agentType, analysis, config)
				agents.push(agent)
				AgentFactory.activeAgents.set(agent.id, agent)
				Logger.log(`Created agent: ${agent.name} (${agent.id})`)
			} catch (error) {
				Logger.log(`Failed to create agent ${agentType}: ${error}`)
				throw new Error(`Failed to create agent ${agentType}: ${error}`)
			}
		}

		return agents
	}

	/**
	 * Creates a single agent of the specified type
	 */
	public async createAgent(type: AgentType, analysis: TaskAnalysis, config?: AgentConfiguration): Promise<Agent> {
		const template = AgentFactory.AGENT_TEMPLATES[type]
		if (!template) {
			throw new Error(`No template found for agent type: ${type}`)
		}

		const agentId = this.generateAgentId(type)

		// Select optimal provider and model
		const { provider, model } = await this.selectProviderAndModel(type, analysis, config)

		// Initialize memory context for this agent
		const memoryContext = await this.initializeAgentMemory(agentId, type, analysis)

		const agent: Agent = {
			id: agentId,
			type,
			name: template.name,
			capabilities: this.convertCapabilitiesToAgentCapabilities(template.capabilities),
			provider,
			model: model,
			systemPrompt: config?.customPrompt || template.systemPrompt,
			tools: config?.tools || template.tools,
			memoryContext,
			status: AgentStatus.INITIALIZING,
			createdAt: new Date(),
			lastActiveAt: new Date(),
			tasksCompleted: 0,
			successRate: 1.0,
		}

		// Register agent with swarm coordinator
		await this.swarmCoordinator.registerAgent(agent.name, agent.type as any)

		// Initialize agent with provider
		await this.initializeAgentWithProvider(agent)

		agent.status = AgentStatus.READY
		return agent
	}

	/**
	 * Selects the optimal provider and model for an agent
	 */
	private async selectProviderAndModel(
		type: AgentType,
		analysis: TaskAnalysis,
		config?: AgentConfiguration,
	): Promise<{ provider: string; model: string }> {
		const template = AgentFactory.AGENT_TEMPLATES[type]

		// Use config override if provided
		if (config?.preferredProvider && config?.preferredModel) {
			return {
				provider: config.preferredProvider,
				model: config.preferredModel,
			}
		}

		// Select based on task complexity and agent type
		let selectedModel: string

		if (analysis.complexity > 0.8) {
			// High complexity tasks - use best models
			selectedModel = template.preferredModels[0]
		} else if (analysis.complexity > 0.5) {
			// Medium complexity - use good models
			selectedModel = template.preferredModels[1] || template.preferredModels[0]
		} else {
			// Low complexity - use efficient models
			selectedModel = template.preferredModels[2] || template.preferredModels[1] || template.preferredModels[0]
		}

		// Determine provider based on model
		const provider = this.getProviderForModel(selectedModel)

		return { provider, model: selectedModel }
	}

	/**
	 * Maps model names to their providers
	 */
	private getProviderForModel(model: string): string {
		if (model.includes("claude")) {
			return "anthropic"
		}
		if (model.includes("gpt")) {
			return "openai"
		}
		if (model.includes("gemini")) {
			return "google"
		}
		if (model.includes("deepseek")) {
			return "deepseek"
		}
		return "anthropic" // default fallback
	}

	/**
	 * Converts AgentCapability array to AgentCapabilities object
	 */
	private convertCapabilitiesToAgentCapabilities(capabilities: AgentCapability[]): AgentCapabilities {
		const agentCapabilities: AgentCapabilities = {
			// Initialize all capabilities to false
			codeGeneration: false,
			codeReview: false,
			testing: false,
			documentation: false,
			research: false,
			analysis: false,
			webSearch: false,
			apiIntegration: false,
			fileSystem: true, // Default to true for all agents
			terminalAccess: true, // Default to true for all agents
			languages: [],
			frameworks: [],
			domains: [],
			tools: [],
			maxConcurrentTasks: 3,
			maxMemoryUsage: 512 * 1024 * 1024, // 512MB
			maxExecutionTime: 5 * 60 * 1000, // 5 minutes
			reliability: 0.8,
			speed: 1.0,
			quality: 0.8,
		}

		// Set capabilities based on the provided array
		for (const capability of capabilities) {
			switch (capability) {
				case AgentCapability.CODE_GENERATION:
					agentCapabilities.codeGeneration = true
					break
				case AgentCapability.CODE_ANALYSIS:
					agentCapabilities.codeReview = true
					agentCapabilities.analysis = true
					break
				case AgentCapability.DEBUGGING:
					agentCapabilities.codeReview = true
					agentCapabilities.analysis = true
					break
				case AgentCapability.TESTING:
					agentCapabilities.testing = true
					break
				case AgentCapability.DOCUMENTATION:
					agentCapabilities.documentation = true
					break
				case AgentCapability.RESEARCH:
					agentCapabilities.research = true
					agentCapabilities.webSearch = true
					break
				case AgentCapability.ARCHITECTURE_DESIGN:
					agentCapabilities.analysis = true
					agentCapabilities.codeReview = true
					break
				case AgentCapability.PERFORMANCE_OPTIMIZATION:
					agentCapabilities.analysis = true
					agentCapabilities.codeReview = true
					break
				case AgentCapability.SECURITY_ANALYSIS:
					agentCapabilities.analysis = true
					agentCapabilities.codeReview = true
					break
				case AgentCapability.API_INTEGRATION:
					agentCapabilities.apiIntegration = true
					break
			}
		}

		return agentCapabilities
	}

	/**
	 * Initializes memory context for an agent
	 */
	private async initializeAgentMemory(agentId: string, type: AgentType, analysis: TaskAnalysis): Promise<string> {
		try {
			// Create memory namespace for this agent
			const memoryNamespace = `agent_${agentId}`

			// Store agent context and task analysis
			await this.memoryManager.store({
				id: `${memoryNamespace}_agent_type`,
				agentId: memoryNamespace,
				type: "agent_config",
				content: type,
				tags: ["agent_type"],
				timestamp: new Date(),
				version: 1,
			})
			await this.memoryManager.store({
				id: `${memoryNamespace}_task_analysis`,
				agentId: memoryNamespace,
				type: "task_analysis",
				content: JSON.stringify(analysis),
				tags: ["task_analysis"],
				timestamp: new Date(),
				version: 1,
			})
			await this.memoryManager.store({
				id: `${memoryNamespace}_created_at`,
				agentId: memoryNamespace,
				type: "metadata",
				content: new Date().toISOString(),
				tags: ["created_at"],
				timestamp: new Date(),
				version: 1,
			})

			// Load relevant historical knowledge for this agent type
			const historicalContext = await this.loadHistoricalContext(type)
			if (historicalContext) {
				await this.memoryManager.store({
					id: `${memoryNamespace}_historical_context`,
					agentId: memoryNamespace,
					type: "historical_context",
					content: historicalContext,
					tags: ["historical_context"],
					timestamp: new Date(),
					version: 1,
				})
			}

			return memoryNamespace
		} catch (error) {
			Logger.log(`Failed to initialize memory for agent ${agentId}: ${error}`)
			return `agent_${agentId}` // Return basic namespace even if initialization fails
		}
	}

	/**
	 * Loads historical context relevant to the agent type
	 */
	private async loadHistoricalContext(type: AgentType): Promise<string | null> {
		try {
			// Query memory for similar tasks completed by this agent type
			const historicalData = await this.memoryManager.query({
				agentId: type,
				limit: 5,
				search: "agent_type",
			})

			if (historicalData && historicalData.length > 0) {
				return historicalData.map((item) => item.content).join("\n\n")
			}

			return null
		} catch (error) {
			Logger.log(`Failed to load historical context for ${type}: ${error}`)
			return null
		}
	}

	/**
	 * Initializes the agent with VS Code LM handler and creates specialized executor
	 */
	private async initializeAgentWithProvider(agent: Agent): Promise<void> {
		try {
			// All agents use VS Code LM API - no provider-specific configuration needed
			// VS Code LM handler is shared across all agents

			// Create specialized executor for this agent
			const executor = this.createAgentExecutor(agent)
			AgentFactory.agentExecutors.set(agent.id, executor)

			Logger.log(`Agent ${agent.id} initialized with VS Code LM API (model: ${agent.model}) and specialized executor`)
		} catch (error) {
			Logger.log(`Failed to initialize agent ${agent.id} with VS Code LM: ${error}`)
			throw error
		}
	}

	/**
	 * Creates a specialized executor for an agent based on its type
	 */
	private createAgentExecutor(agent: Agent): AgentExecutor {
		switch (agent.type) {
			case AgentType.CODER:
				return new CoderAgentExecutor(agent, this.vsCodeLmHandler)
			case AgentType.PLANNER:
				return new PlannerAgentExecutor(agent, this.vsCodeLmHandler)
			case AgentType.RESEARCHER:
				return new ResearcherAgentExecutor(agent, this.vsCodeLmHandler)
			case AgentType.REVIEWER:
				return new ReviewerAgentExecutor(agent, this.vsCodeLmHandler)
			case AgentType.TESTER:
				return new TesterAgentExecutor(agent, this.vsCodeLmHandler)
			case AgentType.DOCUMENTATION:
				return new DocumentationAgentExecutor(agent, this.vsCodeLmHandler)
			case AgentType.DEBUGGER:
				return new DebuggerAgentExecutor(agent, this.vsCodeLmHandler)
			case AgentType.ARCHITECT:
				return new ArchitectAgentExecutor(agent, this.vsCodeLmHandler)
			default:
				return new BaseAgentExecutor(agent, this.vsCodeLmHandler)
		}
	}

	/**
	 * Executes a task with a specific agent
	 */
	public static async executeAgentTask(agentId: string, task: AgentTask, context?: any): Promise<AgentTaskResult> {
		const agent = AgentFactory.activeAgents.get(agentId)
		const executor = AgentFactory.agentExecutors.get(agentId)

		if (!agent || !executor) {
			throw new Error(`Agent ${agentId} not found or not initialized`)
		}

		try {
			AgentFactory.updateAgentStatus(agentId, AgentStatus.WORKING)

			const result = await executor.execute(task, context)

			AgentFactory.updateAgentStatus(agentId, AgentStatus.READY)
			AgentFactory.updateAgentStats(agentId, result.success)

			return result
		} catch (error) {
			AgentFactory.updateAgentStatus(agentId, AgentStatus.ERROR)
			AgentFactory.updateAgentStats(agentId, false)
			throw error
		}
	}

	/**
	 * Gets agent executor for direct access to specialized methods
	 */
	public static getAgentExecutor(agentId: string): AgentExecutor | undefined {
		return AgentFactory.agentExecutors.get(agentId)
	}

	/**
	 * Generates a unique agent ID
	 */
	private generateAgentId(type: AgentType): string {
		AgentFactory.agentCounter++
		const timestamp = Date.now().toString(36)
		const counter = AgentFactory.agentCounter.toString(36)
		return `${type}_${timestamp}_${counter}`
	}

	/**
	 * Updates agent status
	 */
	public static updateAgentStatus(agentId: string, status: AgentStatus): void {
		const agent = AgentFactory.activeAgents.get(agentId)
		if (agent) {
			agent.status = status
			agent.lastActiveAt = new Date()
		}
	}

	/**
	 * Updates agent statistics
	 */
	public static updateAgentStats(agentId: string, completed: boolean): void {
		const agent = AgentFactory.activeAgents.get(agentId)
		if (agent) {
			agent.tasksCompleted++
			if (completed) {
				// Update success rate with exponential moving average
				agent.successRate = 0.9 * agent.successRate + 0.1 * 1.0
			} else {
				agent.successRate = 0.9 * agent.successRate + 0.1 * 0.0
			}
		}
	}

	/**
	 * Gets all active agents
	 */
	public static getActiveAgents(): Agent[] {
		return Array.from(AgentFactory.activeAgents.values())
	}

	/**
	 * Gets a specific agent by ID
	 */
	public static getAgent(agentId: string): Agent | undefined {
		return AgentFactory.activeAgents.get(agentId)
	}

	/**
	 * Terminates an agent and cleans up resources
	 */
	public async terminateAgent(agentId: string): Promise<void> {
		const agent = AgentFactory.activeAgents.get(agentId)
		const executor = AgentFactory.agentExecutors.get(agentId)

		if (!agent) {
			return
		}

		try {
			// Cleanup executor resources
			if (executor) {
				await executor.cleanup()
				AgentFactory.agentExecutors.delete(agentId)
			}

			// Update final stats in memory
			await this.memoryManager.store({
				id: `${agent.memoryContext}_final_stats`,
				agentId: agent.memoryContext,
				type: "final_stats",
				content: JSON.stringify({
					tasksCompleted: agent.tasksCompleted,
					successRate: agent.successRate,
					terminatedAt: new Date().toISOString(),
				}),
				tags: ["final_stats"],
				timestamp: new Date(),
				version: 1,
			})

			// Unregister from swarm coordinator
			// TODO: Implement unregisterAgent method in SwarmCoordinator
			// await this.swarmCoordinator.unregisterAgent(agentId)

			// Update status and remove from active agents
			agent.status = AgentStatus.TERMINATED
			AgentFactory.activeAgents.delete(agentId)

			Logger.log(`Agent ${agentId} terminated successfully`)
		} catch (error) {
			Logger.log(`Error terminating agent ${agentId}: ${error}`)
		}
	}

	/**
	 * Terminates all active agents
	 */
	public async terminateAllAgents(): Promise<void> {
		const agentIds = Array.from(AgentFactory.activeAgents.keys())

		for (const agentId of agentIds) {
			await this.terminateAgent(agentId)
		}

		// Clear executor map
		AgentFactory.agentExecutors.clear()

		Logger.log(`Terminated ${agentIds.length} agents`)
	}

	/**
	 * Gets agent performance metrics
	 */
	public static getAgentMetrics(): AgentMetrics {
		const agents = Array.from(AgentFactory.activeAgents.values())

		return {
			totalAgents: agents.length,
			agentsByType: AgentFactory.getAgentCountByType(agents),
			agentsByStatus: AgentFactory.getAgentCountByStatus(agents),
			averageSuccessRate: AgentFactory.calculateAverageSuccessRate(agents),
			totalTasksCompleted: agents.reduce((sum, agent) => sum + agent.tasksCompleted, 0),
		}
	}

	private static getAgentCountByType(agents: Agent[]): Record<AgentType, number> {
		const counts = {} as Record<AgentType, number>

		for (const type of Object.values(AgentType)) {
			counts[type] = agents.filter((agent) => agent.type === type).length
		}

		return counts
	}

	private static getAgentCountByStatus(agents: Agent[]): Record<AgentStatus, number> {
		const counts = {} as Record<AgentStatus, number>

		for (const status of Object.values(AgentStatus)) {
			counts[status] = agents.filter((agent) => agent.status === status).length
		}

		return counts
	}

	private static calculateAverageSuccessRate(agents: Agent[]): number {
		if (agents.length === 0) {
			return 0
		}

		const totalSuccessRate = agents.reduce((sum, agent) => sum + agent.successRate, 0)
		return totalSuccessRate / agents.length
	}
}

export interface AgentMetrics {
	totalAgents: number
	agentsByType: Record<AgentType, number>
	agentsByStatus: Record<AgentStatus, number>
	averageSuccessRate: number
	totalTasksCompleted: number
}
