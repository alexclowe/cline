/**
 * Utility for proper error handling in TypeScript
 */
import { getErrorMessage as getErrorMsg, getErrorStack as getErrorStk, isError as isErr } from "./type-guards.js"

export class AppError extends Error {
	constructor(
		message: string,
		public code?: string,
		public statusCode?: number,
	) {
		super(message)
		this.name = "AppError"
		Object.setPrototypeOf(this, AppError.prototype)
	}
}

// Re-export from type-guards for backward compatibility
export const isError = isErr
export const getErrorMessage = getErrorMsg
export const getErrorStack = getErrorStk

export class SwarmError extends Error {
	constructor(
		message: string,
		public code?: string,
		public context?: Record<string, any>,
	) {
		super(message)
		this.name = "SwarmError"
		Object.setPrototypeOf(this, SwarmError.prototype)
	}
}

export function handleSwarmError(error: unknown): SwarmError {
	if (error instanceof SwarmError) {
		return error
	}

	if (error instanceof Error) {
		return new SwarmError(error.message, "UNKNOWN_ERROR", { originalError: error.name })
	}

	return new SwarmError(String(error), "UNKNOWN_ERROR")
}

export function logError(error: Error, context?: Record<string, any>): void {
	const message = getErrorMessage(error)
	const stack = getErrorStack(error)

	console.error(`Error${context ? ` in ${JSON.stringify(context)}` : ""}: ${message}`)
	if (stack && process.env.NODE_ENV === "development") {
		console.error("Stack trace:", stack)
	}

	// Additional logging for SwarmError
	if (error instanceof SwarmError && error.context) {
		console.error("Swarm Error Context:", JSON.stringify(error.context, null, 2))
	}
}

export function handleError(error: unknown, context?: string): never {
	const message = getErrorMessage(error)
	const stack = getErrorStack(error)
	console.error(`Error${context ? ` in ${context}` : ""}: ${message}`)
	if (stack && process.env.NODE_ENV === "development") {
		console.error("Stack trace:", stack)
	}
	process.exit(1)
}
