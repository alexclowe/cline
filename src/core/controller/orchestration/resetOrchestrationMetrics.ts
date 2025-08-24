import { Empty, EmptyRequest } from "../../../shared/proto/cline/common"
import { Controller } from ".."

/**
 * Resets orchestration metrics
 * @param controller The controller instance
 * @param request Empty request
 * @returns Empty response
 */
export async function resetOrchestrationMetrics(controller: Controller, _request: EmptyRequest): Promise<Empty> {
	try {
		await controller.resetOrchestrationMetrics()
		return Empty.create({})
	} catch (error) {
		console.error("Error resetting orchestration metrics:", error)
		// Still return success even if there's an error, as reset is best-effort
		return Empty.create({})
	}
}
