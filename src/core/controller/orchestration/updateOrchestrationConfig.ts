import { Empty } from "../../../shared/proto/cline/common"
import { OrchestrationConfigRequest } from "../../../shared/proto/cline/orchestration"
import { Controller } from ".."

/**
 * Updates orchestration configuration
 * @param controller The controller instance
 * @param request The configuration update request
 * @returns Empty response indicating success
 */
export async function updateOrchestrationConfig(controller: Controller, request: OrchestrationConfigRequest): Promise<Empty> {
	try {
		// Extract configuration from request
		const config = {
			enabled: request.enabled,
			maxConcurrentAgents: request.maxConcurrentAgents,
			maxMemoryUsage: Number(request.maxMemoryUsage),
			timeoutMinutes: request.timeoutMinutes,
			fallbackToSingleAgent: request.fallbackToSingleAgent,
			debugMode: request.debugMode,
			autoOptimization: request.autoOptimization,
			resourceMonitoring: request.resourceMonitoring,
			complexityThreshold: request.complexityThreshold,
		}

		// Update orchestration configuration if orchestrator exists
		if (controller.claudeFlowOrchestratorInstance) {
			controller.claudeFlowOrchestratorInstance.updateConfig(config)
			console.log("Orchestration configuration updated:", config)
		} else {
			console.log("Orchestration not initialized, configuration not applied")
		}

		// If orchestration is being enabled, initialize it
		if (config.enabled && !controller.isOrchestrationEnabled) {
			await controller.initializeOrchestration()
		}

		// If orchestration is being disabled, shut it down
		if (!config.enabled && controller.isOrchestrationEnabled) {
			await controller.shutdownOrchestration()
		}

		return Empty.create({})
	} catch (error) {
		console.error("Error updating orchestration configuration:", error)
		// Return empty response even on error to avoid RPC failures
		return Empty.create({})
	}
}
