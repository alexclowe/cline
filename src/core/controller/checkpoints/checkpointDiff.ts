import { Empty, Int64Request } from "@shared/proto/cline/common"
import { stringToNumber } from "../../../shared/proto-conversions/type-utils"
import { Controller } from ".."

export async function checkpointDiff(controller: Controller, request: Int64Request): Promise<Empty> {
	if (request.value) {
		await controller.task?.presentMultifileDiff(stringToNumber(request.value) || 0, false)
	}
	return Empty
}
