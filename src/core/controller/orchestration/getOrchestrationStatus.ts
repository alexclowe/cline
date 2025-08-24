import { EmptyRequest } from "../../../shared/proto/cline/common"
import {
	ActiveOrchestrationTask,
	OrchestrationConfig,
	OrchestrationHealth,
	OrchestrationMetrics,
	OrchestrationMode,
	OrchestrationStatus,
} from "../../../shared/proto/cline/orchestration"
import { Controller } from ".."

/**
 * Gets orchestration configuration and status
 * @param controller The controller instance
 * @param request Empty request
 * @returns OrchestrationStatus with current state, metrics, health, and active tasks
 */
export async function getOrchestrationStatus(controller: Controller, _request: EmptyRequest): Promise<OrchestrationStatus> {
	try {
		const status = controller.getOrchestrationStatus()

		// Convert metrics to protobuf format
		const metrics = status.metrics
			? OrchestrationMetrics.create({
					totalTasks: status.metrics.totalTasks || 0,
					successfulTasks: status.metrics.successfulTasks || 0,
					failedTasks: status.metrics.failedTasks || 0,
					averageExecutionTime: status.metrics.averageExecutionTime || 0,
					averageAgentsUsed: status.metrics.averageAgentsUsed || 0,
					efficiency: status.metrics.efficiency || 0,
					coordinationStrategyUsage: {},
					agentTypeUsage: {},
				})
			: undefined

		// Convert health to protobuf format
		const health = status.health
			? OrchestrationHealth.create({
					isHealthy: status.health.isHealthy || false,
					activeTasks: status.health.activeTasks || 0,
					memoryUsage: String(status.health.memoryUsage || 0),
					maxMemoryUsage: String(status.health.maxMemoryUsage || 0),
					efficiency: status.health.efficiency || 0,
					uptime: String(Date.now() - (status.health.uptime || 0)),
					issues: [],
					recommendations: [],
				})
			: undefined

		// Convert active tasks to protobuf format
		const activeTasks = (status.activeTasks || []).map((task) =>
			ActiveOrchestrationTask.create({
				id: task.id || "",
				description: task.description || "",
				status: task.status || "unknown",
				agentCount: task.agentCount || 0,
				startTime: String(task.startTime || 0),
				mode: OrchestrationMode.ORCHESTRATION_ADAPTIVE,
				complexityScore: 0.5, // Default complexity score
			}),
		)

		// Get orchestration configuration
		const config = OrchestrationConfig.create({
			enabled: status.enabled,
			maxConcurrentAgents: 3,
			maxMemoryUsage: String(512 * 1024 * 1024), // 512MB
			timeoutMinutes: 5,
			fallbackToSingleAgent: true,
			debugMode: false,
			autoOptimization: true,
			resourceMonitoring: true,
			complexityThreshold: 0.4,
		})

		return OrchestrationStatus.create({
			enabled: status.enabled,
			currentMode: status.enabled ? OrchestrationMode.ORCHESTRATION_ADAPTIVE : OrchestrationMode.ORCHESTRATION_DISABLED,
			metrics,
			health,
			activeTasks,
			config,
		})
	} catch (error) {
		console.error("Error getting orchestration status:", error)

		// Return default disabled status on error
		return OrchestrationStatus.create({
			enabled: false,
			currentMode: OrchestrationMode.ORCHESTRATION_DISABLED,
			metrics: undefined,
			health: undefined,
			activeTasks: [],
			config: OrchestrationConfig.create({
				enabled: false,
				maxConcurrentAgents: 1,
				maxMemoryUsage: String(256 * 1024 * 1024),
				timeoutMinutes: 5,
				fallbackToSingleAgent: true,
				debugMode: false,
				autoOptimization: false,
				resourceMonitoring: false,
				complexityThreshold: 0.8,
			}),
		})
	}
}
