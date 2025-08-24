/**
 * JavaScript version of error handling utilities for Claude-Flow compatibility
 * This file provides JavaScript exports that some legacy components expect
 */

// Re-export everything from the TypeScript errors module
const {
	ErrorCode,
	BaseError,
	ValidationError,
	NotFoundError,
	ConfigurationError,
	NetworkError,
	TimeoutError,
	AuthenticationError,
	AuthorizationError,
	RateLimitError,
	ServiceUnavailableError,
	createError,
	isError,
	formatError,
	getErrorStack,
	ErrorHandler,
	withRetry,
	withTimeout,
	withFallback,
} = require("./errors.ts")

// Export for CommonJS compatibility
module.exports = {
	ErrorCode,
	BaseError,
	ValidationError,
	NotFoundError,
	ConfigurationError,
	NetworkError,
	TimeoutError,
	AuthenticationError,
	AuthorizationError,
	RateLimitError,
	ServiceUnavailableError,
	createError,
	isError,
	formatError,
	getErrorStack,
	ErrorHandler,
	withRetry,
	withTimeout,
	withFallback,
}

// Also provide ES6 exports for compatibility
Object.assign(exports, module.exports)
