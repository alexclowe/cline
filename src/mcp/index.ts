/**
 * MCP (Model Context Protocol) Module
 * Export all MCP components for easy integration
 */

// Core MCP interfaces and types
export interface MCPTool {
	name: string
	description: string
	handler: (input: unknown, context?: MCPContext) => Promise<unknown>
	inputSchema?: Record<string, unknown>
}

export interface MCPContext {
	sessionId: string
	agentId?: string
	logger: any
}

export interface MCPConfig {
	transport: "stdio" | "http"
	enableMetrics?: boolean
	auth?: {
		enabled: boolean
		method: "token" | "basic"
	}
	host?: string
	port?: number
	tlsEnabled?: boolean
	loadBalancer?: {
		enabled: boolean
		maxRequestsPerSecond: number
		maxConcurrentRequests: number
	}
	sessionTimeout?: number
	maxSessions?: number
}

export interface MCPProtocolVersion {
	major: number
	minor: number
	patch: number
}

// Tool Implementations
export { type ClaudeFlowToolContext, createClaudeFlowTools } from "./claude-flow-tools"
export { createRuvSwarmTools, type RuvSwarmToolContext } from "./ruv-swarm-tools"

// Core MCP Server (simplified implementation for now)
export class MCPServer {
	private logger: any
	private tools: Map<string, MCPTool> = new Map()

	constructor(config: MCPConfig, _eventBus: any, logger: any) {
		this.config = config
		this.logger = logger
	}

	async start(): Promise<void> {
		this.logger?.info("Starting MCP server...")
		// Implementation placeholder
	}

	async stop(): Promise<void> {
		this.logger?.info("Stopping MCP server...")
		// Implementation placeholder
	}

	registerTool(tool: MCPTool): void {
		this.tools.set(tool.name, tool)
	}

	getTools(): MCPTool[] {
		return Array.from(this.tools.values())
	}

	async executeTool(name: string, input: any, context: MCPContext): Promise<any> {
		const tool = this.tools.get(name)
		if (!tool) {
			throw new Error(`Tool not found: ${name}`)
		}
		return tool.handler(input, context)
	}
}

/**
 * MCP Integration Factory
 * Provides a simple way to create a complete MCP integration
 */
export class MCPIntegrationFactory {
	/**
	 * Create a standalone MCP server (without orchestration integration)
	 */
	static async createStandaloneServer(config: {
		mcpConfig: MCPConfig
		logger: any
		enableLifecycleManagement?: boolean
		enablePerformanceMonitoring?: boolean
	}): Promise<{
		server: MCPServer
	}> {
		const { mcpConfig, logger } = config

		const eventBus = new (await import("node:events")).EventEmitter()
		const server = new MCPServer(mcpConfig, eventBus, logger)

		return { server }
	}

	/**
	 * Create a development/testing MCP setup
	 */
	static async createDevelopmentSetup(logger: any): Promise<{
		server: MCPServer
	}> {
		const mcpConfig: MCPConfig = {
			transport: "stdio",
			enableMetrics: true,
			auth: {
				enabled: false,
				method: "token",
			},
		}

		const { server } = await MCPIntegrationFactory.createStandaloneServer({
			mcpConfig,
			logger,
			enableLifecycleManagement: true,
			enablePerformanceMonitoring: true,
		})

		return { server }
	}
}

/**
 * Default MCP configuration for common use cases
 */
export const DefaultMCPConfigs = {
	/**
	 * Development configuration with stdio transport
	 */
	development: {
		transport: "stdio" as const,
		enableMetrics: true,
		auth: {
			enabled: false,
			method: "token" as const,
		},
	},

	/**
	 * Production configuration with HTTP transport and authentication
	 */
	production: {
		transport: "http" as const,
		host: "0.0.0.0",
		port: 3000,
		tlsEnabled: true,
		enableMetrics: true,
		auth: {
			enabled: true,
			method: "token" as const,
		},
		loadBalancer: {
			enabled: true,
			maxRequestsPerSecond: 100,
			maxConcurrentRequests: 50,
		},
		sessionTimeout: 3600000, // 1 hour
		maxSessions: 1000,
	},

	/**
	 * Testing configuration with minimal features
	 */
	testing: {
		transport: "stdio" as const,
		enableMetrics: false,
		auth: {
			enabled: false,
			method: "token" as const,
		},
	},
} as const

/**
 * MCP Utility Functions
 */
export const MCPUtils = {
	/**
	 * Validate MCP protocol version
	 */
	isValidProtocolVersion(version: MCPProtocolVersion): boolean {
		return (
			typeof version.major === "number" &&
			typeof version.minor === "number" &&
			typeof version.patch === "number" &&
			version.major > 0
		)
	},

	/**
	 * Compare two protocol versions
	 */
	compareVersions(a: MCPProtocolVersion, b: MCPProtocolVersion): number {
		if (a.major !== b.major) {
			return a.major - b.major
		}
		if (a.minor !== b.minor) {
			return a.minor - b.minor
		}
		return a.patch - b.patch
	},

	/**
	 * Format protocol version as string
	 */
	formatVersion(version: MCPProtocolVersion): string {
		return `${version.major}.${version.minor}.${version.patch}`
	},

	/**
	 * Parse protocol version from string
	 */
	parseVersion(versionString: string): MCPProtocolVersion {
		const parts = versionString.split(".").map((p) => parseInt(p, 10))
		if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) {
			throw new Error(`Invalid version string: ${versionString}`)
		}
		return {
			major: parts[0],
			minor: parts[1],
			patch: parts[2],
		}
	},

	/**
	 * Generate a random session ID
	 */
	generateSessionId(): string {
		return `mcp_session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
	},

	/**
	 * Generate a random request ID
	 */
	generateRequestId(): string {
		return `mcp_req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
	},
}
