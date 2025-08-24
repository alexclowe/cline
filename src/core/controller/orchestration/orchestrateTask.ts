import { OrchestrationMode as ClaudeFlowOrchestrationMode } from "../../../orchestration/ClaudeFlowOrchestrator"
import {
	OrchestrationResult,
	OrchestrationTaskRequest,
	OrchestrationMode as ProtoOrchestrationMode,
} from "../../../shared/proto/cline/orchestration"
import { Controller } from ".."

/**
 * Maps protobuf OrchestrationMode to ClaudeFlow OrchestrationMode
 */
function mapProtoModeToClaudeFlowMode(protoMode: ProtoOrchestrationMode): ClaudeFlowOrchestrationMode {
	switch (protoMode) {
		case ProtoOrchestrationMode.ORCHESTRATION_DISABLED:
			return ClaudeFlowOrchestrationMode.DISABLED
		case ProtoOrchestrationMode.ORCHESTRATION_ANALYSIS_ONLY:
			return ClaudeFlowOrchestrationMode.ANALYSIS_ONLY
		case ProtoOrchestrationMode.ORCHESTRATION_SINGLE_AGENT_FALLBACK:
			return ClaudeFlowOrchestrationMode.SINGLE_AGENT_FALLBACK
		case ProtoOrchestrationMode.ORCHESTRATION_FULL_ORCHESTRATION:
			return ClaudeFlowOrchestrationMode.FULL_ORCHESTRATION
		case ProtoOrchestrationMode.ORCHESTRATION_ADAPTIVE:
		default:
			return ClaudeFlowOrchestrationMode.ADAPTIVE
	}
}

/**
 * Orchestrates a task using the Claude-Flow system
 * @param controller The controller instance
 * @param request The orchestration task request
 * @returns OrchestrationResult with execution details
 */
export async function orchestrateTask(controller: Controller, request: OrchestrationTaskRequest): Promise<OrchestrationResult> {
	try {
		// Extract orchestration mode from request, defaulting to ADAPTIVE
		const protoMode = request.mode || ProtoOrchestrationMode.ORCHESTRATION_ADAPTIVE
		const claudeFlowMode = mapProtoModeToClaudeFlowMode(protoMode)

		// Call the controller's orchestration method
		const result = await controller.orchestrateTask(request.taskDescription, claudeFlowMode)

		// Return successful result in protobuf format
		return OrchestrationResult.create({
			success: result.success || false,
			taskId: result.taskId || "",
			planId: result.planId || "",
			agents: (result.agents || []).map((agent: any) => ({
				id: agent.id || "",
				type: agent.type || "",
				status: agent.status || "",
				createdAt: String(agent.createdAt || Date.now()),
			})),
			executionTime: String(result.executionTime || 0),
			resourceUsage: result.resourceUsage
				? {
						memoryUsed: String(result.resourceUsage.memoryUsed || 0),
						cpuTime: String(result.resourceUsage.cpuTime || 0),
						apiCalls: result.resourceUsage.apiCalls || 0,
						tokensUsed: result.resourceUsage.tokensUsed || 0,
						networkRequests: result.resourceUsage.networkRequests || 0,
					}
				: undefined,
			error: result.error || "",
			warnings: result.warnings || [],
		})
	} catch (error) {
		// Return error result in protobuf format
		const errorMessage = error instanceof Error ? error.message : String(error)
		return OrchestrationResult.create({
			success: false,
			taskId: "",
			planId: "",
			agents: [],
			executionTime: "0",
			resourceUsage: undefined,
			error: errorMessage,
			warnings: [],
		})
	}
}
