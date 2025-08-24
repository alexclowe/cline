/**
 * Claude-Flow specific MCP tools for Cline integration
 */

import type { ILogger, MCPContext, MCPTool } from "../utils/types"

export interface ClaudeFlowToolContext extends MCPContext {
	orchestrator?: any // Reference to orchestrator instance
}

/**
 * Create all Claude-Flow specific MCP tools
 */
export function createClaudeFlowTools(logger: ILogger): MCPTool[] {
	return [
		// Agent management tools
		createSpawnAgentTool(logger),
		createListAgentsTool(logger),
		createTerminateAgentTool(logger),
		createGetAgentInfoTool(logger),

		// Task management tools
		createCreateTaskTool(logger),
		createListTasksTool(logger),
		createGetTaskStatusTool(logger),
		createCancelTaskTool(logger),
		createAssignTaskTool(logger),

		// Memory management tools
		createQueryMemoryTool(logger),
		createStoreMemoryTool(logger),
		createDeleteMemoryTool(logger),

		// System monitoring tools
		createGetSystemStatusTool(logger),
		createGetMetricsTool(logger),
		createHealthCheckTool(logger),

		// Configuration tools
		createGetConfigTool(logger),
		createUpdateConfigTool(logger),
		createValidateConfigTool(logger),

		// Workflow tools
		createExecuteWorkflowTool(logger),
		createCreateWorkflowTool(logger),
		createListWorkflowsTool(logger),

		// Terminal management tools
		createExecuteCommandTool(logger),
		createListTerminalsTool(logger),
		createCreateTerminalTool(logger),
	]
}

function createSpawnAgentTool(logger: ILogger): MCPTool {
	return {
		name: "agents/spawn",
		description: "Spawn a new Claude agent with specified configuration",
		inputSchema: {
			type: "object",
			properties: {
				type: {
					type: "string",
					description: "Type of specialized agent to spawn",
					enum: ["coordinator", "researcher", "implementer", "analyst", "custom"],
				},
				name: {
					type: "string",
					description: "Display name for the agent",
				},
				capabilities: {
					type: "array",
					items: { type: "string" },
					description: "List of capabilities for the agent",
				},
				systemPrompt: {
					type: "string",
					description: "Custom system prompt for the agent",
				},
				maxConcurrentTasks: {
					type: "number",
					default: 3,
					description: "Maximum number of concurrent tasks",
				},
				priority: {
					type: "number",
					default: 5,
					description: "Agent priority level (1-10)",
				},
			},
			required: ["type", "name"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Spawning agent", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const profile = {
				id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				name: input.name,
				type: input.type,
				capabilities: input.capabilities || [],
				systemPrompt: input.systemPrompt || getDefaultSystemPrompt(input.type),
				maxConcurrentTasks: input.maxConcurrentTasks || 3,
				priority: input.priority || 5,
			}

			const sessionId = await context.orchestrator.spawnAgent(profile)

			return {
				agentId: profile.id,
				sessionId,
				profile,
				status: "spawned",
				timestamp: new Date().toISOString(),
			}
		},
	}
}

function createListAgentsTool(logger: ILogger): MCPTool {
	return {
		name: "agents/list",
		description: "List all active agents in the system",
		inputSchema: {
			type: "object",
			properties: {
				includeTerminated: {
					type: "boolean",
					default: false,
					description: "Include terminated agents in the list",
				},
				filterByType: {
					type: "string",
					description: "Filter agents by type",
				},
			},
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Listing agents", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const agents = await context.orchestrator.listAgents()
			let filteredAgents = agents

			if (!input.includeTerminated) {
				filteredAgents = filteredAgents.filter((agent: any) => agent.status !== "terminated")
			}

			if (input.filterByType) {
				filteredAgents = filteredAgents.filter((agent: any) => agent.type === input.filterByType)
			}

			return {
				agents: filteredAgents,
				count: filteredAgents.length,
				timestamp: new Date().toISOString(),
			}
		},
	}
}

function createTerminateAgentTool(logger: ILogger): MCPTool {
	return {
		name: "agents/terminate",
		description: "Terminate a specific agent",
		inputSchema: {
			type: "object",
			properties: {
				agentId: {
					type: "string",
					description: "ID of the agent to terminate",
				},
				reason: {
					type: "string",
					description: "Reason for termination",
				},
				graceful: {
					type: "boolean",
					default: true,
					description: "Whether to perform graceful shutdown",
				},
			},
			required: ["agentId"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Terminating agent", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			await context.orchestrator.terminateAgent(input.agentId, {
				reason: input.reason || "Manual termination",
				graceful: input.graceful !== false,
			})

			return {
				agentId: input.agentId,
				status: "terminated",
				reason: input.reason || "Manual termination",
				timestamp: new Date().toISOString(),
			}
		},
	}
}

function createGetAgentInfoTool(logger: ILogger): MCPTool {
	return {
		name: "agents/info",
		description: "Get detailed information about a specific agent",
		inputSchema: {
			type: "object",
			properties: {
				agentId: {
					type: "string",
					description: "ID of the agent",
				},
			},
			required: ["agentId"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Getting agent info", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const agentInfo = await context.orchestrator.getAgentInfo(input.agentId)
			if (!agentInfo) {
				throw new Error(`Agent not found: ${input.agentId}`)
			}

			return {
				agent: agentInfo,
				timestamp: new Date().toISOString(),
			}
		},
	}
}

// Task management tools
function createCreateTaskTool(logger: ILogger): MCPTool {
	return {
		name: "tasks/create",
		description: "Create a new task for execution",
		inputSchema: {
			type: "object",
			properties: {
				type: { type: "string", description: "Type of task to create" },
				description: { type: "string", description: "Description of the task" },
				priority: { type: "number", default: 5, description: "Task priority (1-10)" },
				dependencies: { type: "array", items: { type: "string" }, description: "List of task IDs this task depends on" },
				assignToAgent: { type: "string", description: "Specific agent ID to assign the task to" },
				input: { type: "object", description: "Input data for the task" },
				timeout: { type: "number", description: "Task timeout in milliseconds" },
			},
			required: ["type", "description"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Creating task", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const task = {
				type: input.type,
				description: input.description,
				priority: input.priority || 5,
				dependencies: input.dependencies || [],
				input: input.input || {},
				status: "pending",
				createdAt: new Date(),
			}

			const taskId = await context.orchestrator.createTask(task)

			if (input.assignToAgent) {
				await context.orchestrator.assignTask(taskId, input.assignToAgent)
			}

			return {
				taskId,
				task: { ...task, id: taskId },
				timestamp: new Date().toISOString(),
			}
		},
	}
}

function createListTasksTool(logger: ILogger): MCPTool {
	return {
		name: "tasks/list",
		description: "List tasks with optional filtering",
		inputSchema: {
			type: "object",
			properties: {
				status: {
					type: "string",
					enum: ["pending", "queued", "assigned", "running", "completed", "failed", "cancelled"],
				},
				agentId: { type: "string", description: "Filter by assigned agent ID" },
				type: { type: "string", description: "Filter by task type" },
				limit: { type: "number", default: 50, description: "Maximum number of tasks to return" },
				offset: { type: "number", default: 0, description: "Number of tasks to skip" },
			},
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Listing tasks", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const tasks = await context.orchestrator.listTasks({
				status: input.status,
				agentId: input.agentId,
				type: input.type,
				limit: input.limit || 50,
				offset: input.offset || 0,
			})

			return {
				tasks,
				count: tasks.length,
				timestamp: new Date().toISOString(),
			}
		},
	}
}

function createGetTaskStatusTool(logger: ILogger): MCPTool {
	return {
		name: "tasks/status",
		description: "Get detailed status of a specific task",
		inputSchema: {
			type: "object",
			properties: {
				taskId: { type: "string", description: "ID of the task" },
			},
			required: ["taskId"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Getting task status", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const task = await context.orchestrator.getTask(input.taskId)
			if (!task) {
				throw new Error(`Task not found: ${input.taskId}`)
			}

			return {
				task,
				timestamp: new Date().toISOString(),
			}
		},
	}
}

function createCancelTaskTool(logger: ILogger): MCPTool {
	return {
		name: "tasks/cancel",
		description: "Cancel a pending or running task",
		inputSchema: {
			type: "object",
			properties: {
				taskId: { type: "string", description: "ID of the task to cancel" },
				reason: { type: "string", description: "Reason for cancellation" },
			},
			required: ["taskId"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Cancelling task", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			await context.orchestrator.cancelTask(input.taskId, input.reason || "Manual cancellation")

			return {
				taskId: input.taskId,
				status: "cancelled",
				reason: input.reason || "Manual cancellation",
				timestamp: new Date().toISOString(),
			}
		},
	}
}

function createAssignTaskTool(logger: ILogger): MCPTool {
	return {
		name: "tasks/assign",
		description: "Assign a task to a specific agent",
		inputSchema: {
			type: "object",
			properties: {
				taskId: { type: "string", description: "ID of the task to assign" },
				agentId: { type: "string", description: "ID of the agent to assign the task to" },
			},
			required: ["taskId", "agentId"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Assigning task", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			await context.orchestrator.assignTask(input.taskId, input.agentId)

			return {
				taskId: input.taskId,
				agentId: input.agentId,
				status: "assigned",
				timestamp: new Date().toISOString(),
			}
		},
	}
}

// Memory management tools (simplified implementations)
function createQueryMemoryTool(logger: ILogger): MCPTool {
	return {
		name: "memory/query",
		description: "Query agent memory with filters and search",
		inputSchema: {
			type: "object",
			properties: {
				agentId: { type: "string", description: "Filter by agent ID" },
				sessionId: { type: "string", description: "Filter by session ID" },
				type: { type: "string", enum: ["observation", "insight", "decision", "artifact", "error"] },
				search: { type: "string", description: "Full-text search query" },
				limit: { type: "number", default: 50, description: "Maximum number of entries to return" },
			},
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Querying memory", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const entries = await context.orchestrator.queryMemory(input)

			return {
				entries,
				count: entries.length,
				query: input,
				timestamp: new Date().toISOString(),
			}
		},
	}
}

function createStoreMemoryTool(logger: ILogger): MCPTool {
	return {
		name: "memory/store",
		description: "Store a new memory entry",
		inputSchema: {
			type: "object",
			properties: {
				agentId: { type: "string", description: "Agent ID for the memory entry" },
				sessionId: { type: "string", description: "Session ID for the memory entry" },
				type: { type: "string", enum: ["observation", "insight", "decision", "artifact", "error"] },
				content: { type: "string", description: "Content of the memory entry" },
				context: { type: "object", description: "Context data for the memory entry" },
				tags: { type: "array", items: { type: "string" }, description: "Tags for the memory entry" },
			},
			required: ["agentId", "sessionId", "type", "content"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Storing memory", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const entry = {
				agentId: input.agentId,
				sessionId: input.sessionId,
				type: input.type,
				content: input.content,
				context: input.context || {},
				tags: input.tags || [],
				timestamp: new Date(),
				version: 1,
			}

			const entryId = await context.orchestrator.storeMemory(entry)

			return {
				entryId,
				entry: { ...entry, id: entryId },
				timestamp: new Date().toISOString(),
			}
		},
	}
}

function createDeleteMemoryTool(logger: ILogger): MCPTool {
	return {
		name: "memory/delete",
		description: "Delete a memory entry",
		inputSchema: {
			type: "object",
			properties: {
				entryId: { type: "string", description: "ID of the memory entry to delete" },
			},
			required: ["entryId"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Deleting memory", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			await context.orchestrator.deleteMemory(input.entryId)

			return {
				entryId: input.entryId,
				status: "deleted",
				timestamp: new Date().toISOString(),
			}
		},
	}
}

// System monitoring tools (simplified implementations)
function createGetSystemStatusTool(logger: ILogger): MCPTool {
	return {
		name: "system/status",
		description: "Get comprehensive system status information",
		inputSchema: { type: "object", properties: {} },
		handler: async (_input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Getting system status", { sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const status = await context.orchestrator.getSystemStatus()
			return { ...status, timestamp: new Date().toISOString() }
		},
	}
}

function createGetMetricsTool(logger: ILogger): MCPTool {
	return {
		name: "system/metrics",
		description: "Get system performance metrics",
		inputSchema: {
			type: "object",
			properties: {
				timeRange: { type: "string", enum: ["1h", "6h", "24h", "7d"], default: "1h" },
			},
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Getting system metrics", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const metrics = await context.orchestrator.getMetrics(input.timeRange || "1h")
			return { metrics, timeRange: input.timeRange || "1h", timestamp: new Date().toISOString() }
		},
	}
}

function createHealthCheckTool(logger: ILogger): MCPTool {
	return {
		name: "system/health",
		description: "Perform a comprehensive health check",
		inputSchema: {
			type: "object",
			properties: {
				deep: { type: "boolean", default: false, description: "Perform deep health check" },
			},
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Performing health check", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const healthCheck = await context.orchestrator.performHealthCheck(input.deep || false)
			return { ...healthCheck, timestamp: new Date().toISOString() }
		},
	}
}

// Configuration tools (simplified implementations)
function createGetConfigTool(logger: ILogger): MCPTool {
	return {
		name: "config/get",
		description: "Get current system configuration",
		inputSchema: {
			type: "object",
			properties: {
				section: { type: "string", enum: ["orchestrator", "terminal", "memory", "coordination", "mcp", "logging"] },
			},
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Getting configuration", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const config = await context.orchestrator.getConfig(input.section)
			return { config, section: input.section, timestamp: new Date().toISOString() }
		},
	}
}

function createUpdateConfigTool(logger: ILogger): MCPTool {
	return {
		name: "config/update",
		description: "Update system configuration",
		inputSchema: {
			type: "object",
			properties: {
				section: { type: "string", enum: ["orchestrator", "terminal", "memory", "coordination", "mcp", "logging"] },
				config: { type: "object", description: "Configuration values to update" },
				restart: { type: "boolean", default: false, description: "Restart affected components after update" },
			},
			required: ["section", "config"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Updating configuration", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const result = await context.orchestrator.updateConfig(input.section, input.config, input.restart || false)
			return { ...result, timestamp: new Date().toISOString() }
		},
	}
}

function createValidateConfigTool(logger: ILogger): MCPTool {
	return {
		name: "config/validate",
		description: "Validate a configuration object",
		inputSchema: {
			type: "object",
			properties: {
				config: { type: "object", description: "Configuration object to validate" },
			},
			required: ["config"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Validating configuration", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const validation = await context.orchestrator.validateConfig(input.config)
			return { ...validation, timestamp: new Date().toISOString() }
		},
	}
}

// Workflow tools (simplified implementations)
function createExecuteWorkflowTool(logger: ILogger): MCPTool {
	return {
		name: "workflow/execute",
		description: "Execute a workflow from a file or definition",
		inputSchema: {
			type: "object",
			properties: {
				filePath: { type: "string", description: "Path to workflow file" },
				workflow: { type: "object", description: "Inline workflow definition" },
				parameters: { type: "object", description: "Parameters to pass to the workflow" },
			},
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Executing workflow", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			if (!input.filePath && !input.workflow) {
				throw new Error("Either filePath or workflow must be provided")
			}

			const result = await context.orchestrator.executeWorkflow({
				filePath: input.filePath,
				workflow: input.workflow,
				parameters: input.parameters || {},
			})

			return { ...result, timestamp: new Date().toISOString() }
		},
	}
}

function createCreateWorkflowTool(logger: ILogger): MCPTool {
	return {
		name: "workflow/create",
		description: "Create a new workflow definition",
		inputSchema: {
			type: "object",
			properties: {
				name: { type: "string", description: "Name of the workflow" },
				description: { type: "string", description: "Description of the workflow" },
				tasks: { type: "array", items: { type: "object" }, description: "List of tasks in the workflow" },
				savePath: { type: "string", description: "Path to save the workflow file" },
			},
			required: ["name", "tasks"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Creating workflow", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const workflow = {
				name: input.name,
				description: input.description,
				tasks: input.tasks,
				created: new Date().toISOString(),
			}

			const result = await context.orchestrator.createWorkflow(workflow, input.savePath)
			return { ...result, workflow, timestamp: new Date().toISOString() }
		},
	}
}

function createListWorkflowsTool(logger: ILogger): MCPTool {
	return {
		name: "workflow/list",
		description: "List available workflows",
		inputSchema: {
			type: "object",
			properties: {
				directory: { type: "string", description: "Directory to search for workflows" },
			},
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Listing workflows", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const workflows = await context.orchestrator.listWorkflows(input.directory)
			return { workflows, count: workflows.length, timestamp: new Date().toISOString() }
		},
	}
}

// Terminal management tools (simplified implementations)
function createExecuteCommandTool(logger: ILogger): MCPTool {
	return {
		name: "terminal/execute",
		description: "Execute a command in a terminal session",
		inputSchema: {
			type: "object",
			properties: {
				command: { type: "string", description: "Command to execute" },
				args: { type: "array", items: { type: "string" }, description: "Command arguments" },
				cwd: { type: "string", description: "Working directory for the command" },
				env: { type: "object", description: "Environment variables" },
				timeout: { type: "number", default: 30000, description: "Command timeout in milliseconds" },
				terminalId: { type: "string", description: "Specific terminal ID to use" },
			},
			required: ["command"],
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Executing command", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const result = await context.orchestrator.executeCommand({
				command: input.command,
				args: input.args,
				cwd: input.cwd,
				env: input.env,
				timeout: input.timeout || 30000,
				terminalId: input.terminalId,
			})

			return { ...result, timestamp: new Date().toISOString() }
		},
	}
}

function createListTerminalsTool(logger: ILogger): MCPTool {
	return {
		name: "terminal/list",
		description: "List all terminal sessions",
		inputSchema: {
			type: "object",
			properties: {
				includeIdle: { type: "boolean", default: true, description: "Include idle terminals" },
			},
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Listing terminals", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const terminals = await context.orchestrator.listTerminals(input.includeIdle !== false)
			return { terminals, count: terminals.length, timestamp: new Date().toISOString() }
		},
	}
}

function createCreateTerminalTool(logger: ILogger): MCPTool {
	return {
		name: "terminal/create",
		description: "Create a new terminal session",
		inputSchema: {
			type: "object",
			properties: {
				cwd: { type: "string", description: "Working directory for the terminal" },
				env: { type: "object", description: "Environment variables" },
				shell: { type: "string", description: "Shell to use (bash, zsh, etc.)" },
			},
		},
		handler: async (input: any, context?: ClaudeFlowToolContext) => {
			logger.info("Creating terminal", { input, sessionId: context?.sessionId })

			if (!context?.orchestrator) {
				throw new Error("Orchestrator not available")
			}

			const terminal = await context.orchestrator.createTerminal({
				cwd: input.cwd,
				env: input.env,
				shell: input.shell,
			})

			return { terminal, timestamp: new Date().toISOString() }
		},
	}
}

function getDefaultSystemPrompt(type: string): string {
	const prompts = {
		coordinator:
			"You are a coordinator agent responsible for planning, delegating, and orchestrating tasks across multiple agents.",
		researcher:
			"You are a research agent specialized in gathering, analyzing, and synthesizing information from various sources.",
		implementer:
			"You are an implementation agent focused on writing code, creating solutions, and executing technical tasks.",
		analyst:
			"You are an analysis agent that identifies patterns, generates insights, and provides data-driven recommendations.",
		custom: "You are a specialized agent with custom capabilities defined by your configuration.",
	}

	return prompts[type as keyof typeof prompts] || prompts.custom
}
