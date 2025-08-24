/**
 * JavaScript version of utility helper functions for Claude-Flow compatibility
 * This file provides JavaScript exports that some legacy components expect
 */

// Re-export everything from the TypeScript helpers
const {
	execAsync,
	add,
	helloWorld,
	generateId,
	timeout,
	delay,
	retry,
	debounce,
	throttle,
	deepClone,
	deepMerge,
	TypedEventEmitter,
	formatBytes,
	parseDuration,
	ensureArray,
	groupBy,
	createDeferred,
	safeParseJSON,
	calculator,
	circuitBreaker,
	greeting,
} = require("./helpers.ts")

// Export for CommonJS compatibility
module.exports = {
	execAsync,
	add,
	helloWorld,
	generateId,
	timeout,
	delay,
	retry,
	debounce,
	throttle,
	deepClone,
	deepMerge,
	TypedEventEmitter,
	formatBytes,
	parseDuration,
	ensureArray,
	groupBy,
	createDeferred,
	safeParseJSON,
	calculator,
	circuitBreaker,
	greeting,
}

// Also provide ES6 exports for compatibility
Object.assign(exports, module.exports)
