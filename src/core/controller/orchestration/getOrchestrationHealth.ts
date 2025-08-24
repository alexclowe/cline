import { EmptyRequest } from "../../../shared/proto/cline/common"
import { OrchestrationHealth } from "../../../shared/proto/cline/orchestration"
import { Controller } from ".."

/**
 * Gets orchestration health status
 * @param controller The controller instance
 * @param request Empty request
 * @returns OrchestrationHealth with system health data
 */
export async function getOrchestrationHealth(controller: Controller, _request: EmptyRequest): Promise<OrchestrationHealth> {
	try {
		const health = controller.getOrchestrationHealth()

		if (!health) {
			// Return default health status if orchestration is not initialized
			return OrchestrationHealth.create({
				isHealthy: false,
				activeTasks: 0,
				memoryUsage: "0",
				maxMemoryUsage: "0",
				efficiency: 0,
				uptime: "0",
				issues: ["Orchestration system not initialized"],
				recommendations: ["Enable orchestration in settings"],
			})
		}

		// Convert to protobuf format
		return OrchestrationHealth.create({
			isHealthy: health.isHealthy || false,
			activeTasks: health.activeTasks || 0,
			memoryUsage: String(health.memoryUsage || 0),
			maxMemoryUsage: String(health.maxMemoryUsage || 0),
			efficiency: health.efficiency || 0,
			uptime: String(health.uptime || 0),
			issues: health.issues || [],
			recommendations: health.recommendations || [],
		})
	} catch (error) {
		console.error("Error getting orchestration health:", error)
		// Return unhealthy status on error
		return OrchestrationHealth.create({
			isHealthy: false,
			activeTasks: 0,
			memoryUsage: "0",
			maxMemoryUsage: "0",
			efficiency: 0,
			uptime: "0",
			issues: ["Error retrieving health status"],
			recommendations: ["Check orchestration system logs"],
		})
	}
}
