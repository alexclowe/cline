/**
 * Type guards and safety utilities for memory and provider safety
 */

export interface ProviderConfig {
	apiKey: string
	endpoint?: string
	model?: string
	[key: string]: any
}

export interface KnowledgeEntry {
	id: string
	content: string
	metadata?: Record<string, any>
	timestamp?: number
}

export interface ContextData {
	[key: string]: any
}

/**
 * Type guard to check if a value is a valid provider configuration
 */
export function isValidProviderConfig(config: any): config is ProviderConfig {
	return config && typeof config === "object" && typeof config.apiKey === "string" && config.apiKey.length > 0
}

/**
 * Type guard to check if a value is a valid knowledge entry
 */
export function isValidKnowledgeEntry(entry: any): entry is KnowledgeEntry {
	return entry && typeof entry === "object" && typeof entry.id === "string" && typeof entry.content === "string"
}

/**
 * Safely access array length with null/undefined check
 */
export function safeArrayLength<T>(arr: T[] | undefined | null): number {
	return Array.isArray(arr) ? arr.length : 0
}

/**
 * Safely access array element with bounds checking
 */
export function safeArrayAccess<T>(arr: T[] | undefined | null, index: number): T | undefined {
	if (!Array.isArray(arr) || index < 0 || index >= arr.length) {
		return undefined
	}
	return arr[index]
}

/**
 * Safely access object property with null/undefined check
 */
export function safeObjectAccess<T, K extends keyof T>(obj: T | undefined | null, key: K): T[K] | undefined {
	if (!obj || typeof obj !== "object") {
		return undefined
	}
	return obj[key]
}

/**
 * Safe string access with default value
 */
export function safeStringAccess(value: any, defaultValue: string = ""): string {
	if (typeof value === "string") {
		return value
	}
	return defaultValue
}

/**
 * Safe number access with default value
 */
export function safeNumberAccess(value: any, defaultValue: number = 0): number {
	if (typeof value === "number" && !Number.isNaN(value)) {
		return value
	}
	return defaultValue
}

/**
 * Safe boolean access with default value
 */
export function safeBooleanAccess(value: any, defaultValue: boolean = false): boolean {
	if (typeof value === "boolean") {
		return value
	}
	return defaultValue
}

/**
 * Validate and normalize knowledge entries array
 */
export function validateKnowledgeEntries(entries: any[] | undefined | null): KnowledgeEntry[] {
	if (!Array.isArray(entries)) {
		return []
	}

	return entries.filter(isValidKnowledgeEntry)
}

/**
 * Validate and normalize context data
 */
export function validateContextData(data: any[] | undefined | null): ContextData[] {
	if (!Array.isArray(data)) {
		return []
	}

	return data.filter((item) => item && typeof item === "object" && !Array.isArray(item))
}

/**
 * Ensure string is not undefined, with fallback
 */
export function ensureString(value: string | undefined, fallback: string = ""): string {
	return value ?? fallback
}

/**
 * Ensure number is not undefined, with fallback
 */
export function ensureNumber(value: number | undefined, fallback: number = 0): number {
	return value ?? fallback
}

/**
 * Type conversion utilities for maxTokens mismatches
 */
export function normalizeMaxTokens(value: string | number | undefined): number | undefined {
	if (value === undefined || value === null) {
		return undefined
	}

	if (typeof value === "number") {
		return value
	}

	if (typeof value === "string") {
		const parsed = parseInt(value, 10)
		return Number.isNaN(parsed) ? undefined : parsed
	}

	return undefined
}

/**
 * Convert number to string for compatibility
 */
export function numberToString(value: number | undefined): string | undefined {
	if (value === undefined || value === null) {
		return undefined
	}

	return value.toString()
}

/**
 * Safe property check for objects
 */
export function hasProperty<T extends object, K extends keyof T>(
	obj: T | undefined | null,
	prop: K,
): obj is T & Record<K, NonNullable<T[K]>> {
	return obj != null && typeof obj === "object" && prop in obj && obj[prop] != null
}

/**
 * Safe array operation wrapper
 */
export function safeArrayOperation<T, R>(arr: T[] | undefined | null, operation: (arr: T[]) => R, fallback: R): R {
	if (Array.isArray(arr)) {
		try {
			return operation(arr)
		} catch (error) {
			console.warn("Safe array operation failed:", error)
			return fallback
		}
	}
	return fallback
}
