import { Boolean, StringRequest } from "../../../shared/proto/cline/common"
import { Controller } from ".."

/**
 * Cancels an active orchestration task
 * @param controller The controller instance
 * @param request The request containing the task ID to cancel
 * @returns Boolean indicating whether the cancellation was successful
 */
export async function cancelOrchestrationTask(controller: Controller, request: StringRequest): Promise<Boolean> {
	try {
		const taskId = request.value
		if (!taskId) {
			return Boolean.create({ value: false })
		}

		const success = await controller.cancelOrchestrationTask(taskId)
		return Boolean.create({ value: success })
	} catch (error) {
		console.error("Error canceling orchestration task:", error)
		return Boolean.create({ value: false })
	}
}
