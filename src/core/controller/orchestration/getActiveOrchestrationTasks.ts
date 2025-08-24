import { EmptyRequest } from "../../../shared/proto/cline/common"
import {
	ActiveOrchestrationTask,
	ActiveOrchestrationTasksArray,
	OrchestrationMode as ProtoOrchestrationMode,
} from "../../../shared/proto/cline/orchestration"
import { Controller } from ".."

/**
 * Maps ClaudeFlow OrchestrationMode to protobuf OrchestrationMode
 */
function mapClaudeFlowModeToProtoMode(claudeFlowMode: string): ProtoOrchestrationMode {
	switch (claudeFlowMode) {
		case "disabled":
			return ProtoOrchestrationMode.ORCHESTRATION_DISABLED
		case "analysis_only":
			return ProtoOrchestrationMode.ORCHESTRATION_ANALYSIS_ONLY
		case "single_agent_fallback":
			return ProtoOrchestrationMode.ORCHESTRATION_SINGLE_AGENT_FALLBACK
		case "full_orchestration":
			return ProtoOrchestrationMode.ORCHESTRATION_FULL_ORCHESTRATION
		case "adaptive":
		default:
			return ProtoOrchestrationMode.ORCHESTRATION_ADAPTIVE
	}
}

/**
 * Gets list of active orchestration tasks
 * @param controller The controller instance
 * @param request Empty request
 * @returns ActiveOrchestrationTasksArray with active tasks
 */
export async function getActiveOrchestrationTasks(
	controller: Controller,
	_request: EmptyRequest,
): Promise<ActiveOrchestrationTasksArray> {
	try {
		const activeTasks = controller.getActiveOrchestrationTasks()

		if (!activeTasks || activeTasks.length === 0) {
			// Return empty array if no active tasks
			return ActiveOrchestrationTasksArray.create({
				tasks: [],
				totalCount: 0,
			})
		}

		// Convert to protobuf format
		const protoTasks = activeTasks.map((task: any) =>
			ActiveOrchestrationTask.create({
				id: task.id || "",
				description: task.description || "",
				status: task.status || "",
				agentCount: task.agentCount || 0,
				startTime: task.startTime || Date.now(),
				mode: task.mode ? mapClaudeFlowModeToProtoMode(task.mode) : ProtoOrchestrationMode.ORCHESTRATION_ADAPTIVE,
				complexityScore: task.complexityScore || 0,
			}),
		)

		return ActiveOrchestrationTasksArray.create({
			tasks: protoTasks,
			totalCount: protoTasks.length,
		})
	} catch (error) {
		console.error("Error getting active orchestration tasks:", error)
		// Return empty array on error
		return ActiveOrchestrationTasksArray.create({
			tasks: [],
			totalCount: 0,
		})
	}
}
