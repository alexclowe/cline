// Main exports for the swarm system

// Advanced orchestrator and swarm types (primary source)
export * from "./advanced-orchestrator"
export * from "./coordinator"
export * from "./executor"
export * from "./memory"
// Optimizations (selective exports to avoid conflicts)
export {
	AsyncFileManager,
	CircularBuffer,
	ClaudeConnectionPool,
	createOptimizedSwarmStack,
	OptimizedExecutor,
	TTLMap,
} from "./optimizations/index"
export * from "./prompt-cli"

// Prompt copying system exports
export * from "./prompt-copier"
export * from "./prompt-copier-enhanced"
export * from "./prompt-manager"
export * from "./prompt-utils"
export * from "./strategies/auto"
export * from "./strategies/base"
export * from "./strategies/research"
// Legacy compatibility types (explicit re-exports to avoid conflicts)
export type {
	SwarmAgent,
	SwarmConfiguration,
	SwarmDefinition,
	SwarmError,
	SwarmExecutionContext,
	SwarmMemoryEntry,
	SwarmTask,
	SwarmTaskResult,
	TaskExecutionContext,
	TaskExecutionError,
} from "./swarm-types"
export * from "./swarm-types"

// Utility function to get all exports
export function getSwarmComponents() {
	return {
		// Core components
		coordinator: () => import("./coordinator"),
		executor: () => import("./executor"),
		types: () => import("./types"),

		// Strategies
		strategies: {
			base: () => import("./strategies/base"),
			auto: () => import("./strategies/auto"),
			research: () => import("./strategies/research"),
		},

		// Memory
		memory: () => import("./memory"),

		// Prompt system
		promptCopier: () => import("./prompt-copier"),
		promptCopierEnhanced: () => import("./prompt-copier-enhanced"),
		promptUtils: () => import("./prompt-utils"),
		promptManager: () => import("./prompt-manager"),
		promptCli: () => import("./prompt-cli"),

		// Optimizations
		optimizations: () => import("./optimizations/index"),

		// Advanced components
		advancedOrchestrator: () => import("./advanced-orchestrator"),
		swarmTypes: () => import("./swarm-types"),
	}
}
