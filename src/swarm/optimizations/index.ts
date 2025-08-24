/**
 * Swarm Optimizations
 * Export all optimization components
 */

import { AsyncFileManager } from "./async-file-manager"
import { ClaudeConnectionPool } from "./connection-pool"
import { OptimizedExecutor } from "./optimized-executor"

export type { FileOperationResult } from "./async-file-manager"
export { AsyncFileManager } from "./async-file-manager"
export { CircularBuffer } from "./circular-buffer"
export type { PoolConfig, PooledConnection } from "./connection-pool"
export { ClaudeConnectionPool } from "./connection-pool"
export type { ExecutionMetrics, ExecutorConfig } from "./optimized-executor"
export { OptimizedExecutor } from "./optimized-executor"
export type { TTLMapOptions } from "./ttl-map"
export { TTLMap } from "./ttl-map"

// Re-export commonly used together
export function createOptimizedSwarmStack(config?: { connectionPool?: any; executor?: any; fileManager?: any }) {
	const connectionPool = new ClaudeConnectionPool(config?.connectionPool)
	const fileManager = new AsyncFileManager(config?.fileManager)
	const executor = new OptimizedExecutor({
		...config?.executor,
		connectionPool: config?.connectionPool,
		fileOperations: config?.fileManager,
	})

	return {
		connectionPool,
		fileManager,
		executor,
		shutdown: async () => {
			if (executor.shutdown) {
				await executor.shutdown()
			}
			if (fileManager.waitForPendingOperations) {
				await fileManager.waitForPendingOperations()
			}
			if (connectionPool.drain) {
				await connectionPool.drain()
			}
		},
	}
}
