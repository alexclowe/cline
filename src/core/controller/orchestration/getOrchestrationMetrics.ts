import { EmptyRequest } from "../../../shared/proto/cline/common"
import { OrchestrationMetrics } from "../../../shared/proto/cline/orchestration"
import { Controller } from ".."

/**
 * Gets orchestration metrics
 * @param controller The controller instance
 * @param request Empty request
 * @returns OrchestrationMetrics with performance data
 */
export async function getOrchestrationMetrics(controller: Controller, _request: EmptyRequest): Promise<OrchestrationMetrics> {
	try {
		const metrics = controller.getOrchestrationMetrics()

		if (!metrics) {
			// Return empty metrics if orchestration is not initialized
			return OrchestrationMetrics.create({
				totalTasks: 0,
				successfulTasks: 0,
				failedTasks: 0,
				averageExecutionTime: 0,
				averageAgentsUsed: 0,
				efficiency: 0,
				coordinationStrategyUsage: {},
				agentTypeUsage: {},
			})
		}

		// Convert to protobuf format
		return OrchestrationMetrics.create({
			totalTasks: metrics.totalTasks || 0,
			successfulTasks: metrics.successfulTasks || 0,
			failedTasks: metrics.failedTasks || 0,
			averageExecutionTime: metrics.averageExecutionTime || 0,
			averageAgentsUsed: metrics.averageAgentsUsed || 0,
			efficiency: metrics.efficiency || 0,
			coordinationStrategyUsage: metrics.coordinationStrategyUsage || {},
			agentTypeUsage: metrics.agentTypeUsage || {},
		})
	} catch (error) {
		console.error("Error getting orchestration metrics:", error)
		// Return empty metrics on error
		return OrchestrationMetrics.create({
			totalTasks: 0,
			successfulTasks: 0,
			failedTasks: 0,
			averageExecutionTime: 0,
			averageAgentsUsed: 0,
			efficiency: 0,
			coordinationStrategyUsage: {},
			agentTypeUsage: {},
		})
	}
}
