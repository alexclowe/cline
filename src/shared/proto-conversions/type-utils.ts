/**
 * Type conversion utilities for protobuf ↔ TypeScript compatibility
 * Handles conversion between string and number types for protobuf messages
 */

/**
 * Safely converts a string to a number
 * @param value String value from protobuf message
 * @returns Parsed number or undefined if invalid
 */
export function stringToNumber(value: string | undefined): number | undefined {
	if (!value || value === "") {
		return undefined
	}
	const parsed = parseInt(value, 10)
	return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * Safely converts a number to a string
 * @param value Number value for protobuf message
 * @returns String representation or undefined if invalid
 */
export function numberToString(value: number | undefined): string | undefined {
	if (value === undefined || value === null || Number.isNaN(value)) {
		return undefined
	}
	return value.toString()
}

/**
 * Safely converts a string to a float number
 * @param value String value from protobuf message
 * @returns Parsed float or undefined if invalid
 */
export function stringToFloat(value: string | undefined): number | undefined {
	if (!value || value === "") {
		return undefined
	}
	const parsed = parseFloat(value)
	return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * Safely converts a number to a string with optional decimal places
 * @param value Number value for protobuf message
 * @param decimals Optional number of decimal places
 * @returns String representation or undefined if invalid
 */
export function floatToString(value: number | undefined, decimals?: number): string | undefined {
	if (value === undefined || value === null || Number.isNaN(value)) {
		return undefined
	}
	return decimals !== undefined ? value.toFixed(decimals) : value.toString()
}

/**
 * Safely converts a string to a boolean
 * @param value String value from protobuf message
 * @returns Boolean value or undefined if invalid
 */
export function stringToBoolean(value: string | undefined): boolean | undefined {
	if (!value || value === "") {
		return undefined
	}
	const lower = value.toLowerCase()
	if (lower === "true" || lower === "1") {
		return true
	}
	if (lower === "false" || lower === "0") {
		return false
	}
	return undefined
}

/**
 * Safely converts a boolean to a string
 * @param value Boolean value for protobuf message
 * @returns String representation or undefined if invalid
 */
export function booleanToString(value: boolean | undefined): string | undefined {
	if (value === undefined || value === null) {
		return undefined
	}
	return value.toString()
}

/**
 * Safely converts a timestamp number to ISO string
 * @param timestamp Unix timestamp in milliseconds
 * @returns ISO string or undefined if invalid
 */
export function timestampToString(timestamp: number | undefined): string | undefined {
	if (timestamp === undefined || timestamp === null || Number.isNaN(timestamp)) {
		return undefined
	}
	try {
		return new Date(timestamp).toISOString()
	} catch {
		return undefined
	}
}

/**
 * Safely converts an ISO string to timestamp number
 * @param isoString ISO date string from protobuf message
 * @returns Unix timestamp in milliseconds or undefined if invalid
 */
export function stringToTimestamp(isoString: string | undefined): number | undefined {
	if (!isoString || isoString === "") {
		return undefined
	}
	try {
		const timestamp = new Date(isoString).getTime()
		return Number.isNaN(timestamp) ? undefined : timestamp
	} catch {
		return undefined
	}
}

/**
 * Ensures a value is defined or provides a default
 * @param value Value to check
 * @param defaultValue Default value if undefined
 * @returns Original value or default
 */
export function withDefault<T>(value: T | undefined, defaultValue: T): T {
	return value !== undefined ? value : defaultValue
}

/**
 * Safely converts an array of strings to numbers
 * @param values Array of string values
 * @returns Array of numbers, filtering out invalid conversions
 */
export function stringArrayToNumbers(values: string[] | undefined): number[] {
	if (!values || !Array.isArray(values)) {
		return []
	}
	return values.map(stringToNumber).filter((num): num is number => num !== undefined)
}

/**
 * Safely converts an array of numbers to strings
 * @param values Array of number values
 * @returns Array of strings, filtering out invalid conversions
 */
export function numberArrayToStrings(values: number[] | undefined): string[] {
	if (!values || !Array.isArray(values)) {
		return []
	}
	return values.map(numberToString).filter((str): str is string => str !== undefined)
}
