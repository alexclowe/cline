/**
 * Environment Detection Utility
 * Detects the current runtime environment and provides environment-specific information
 */

export type RuntimeEnvironment = "node" | "deno" | "browser"

// Type guard for Deno global
declare global {
	const Deno: any
}

/**
 * Detect the current runtime environment
 */
export function detectEnvironment(): RuntimeEnvironment {
	// Check for Deno
	if (typeof (globalThis as any).Deno !== "undefined") {
		return "deno"
	}

	// Check for Node.js
	if (typeof process !== "undefined" && process.versions?.node) {
		return "node"
	}

	// Check for browser
	if (typeof window !== "undefined") {
		return "browser"
	}

	// Default to Node.js if we can't determine
	return "node"
}

/**
 * Check if running in Node.js environment
 */
export function isNodeEnvironment(): boolean {
	return typeof process !== "undefined" && process.versions?.node !== undefined
}

/**
 * Check if running in Deno environment
 */
export function isDenoEnvironment(): boolean {
	return typeof (globalThis as any).Deno !== "undefined"
}

/**
 * Check if running in browser environment
 */
export function isBrowserEnvironment(): boolean {
	return typeof window !== "undefined"
}

/**
 * Get detailed environment information
 */
export function getEnvironmentInfo(): Record<string, any> {
	const env = detectEnvironment()
	const info: Record<string, any> = {
		runtime: env,
		platform: typeof process !== "undefined" ? process.platform : "unknown",
		arch: typeof process !== "undefined" ? process.arch : "unknown",
	}

	if (env === "node") {
		info.nodeVersion = process.version
		info.versions = process.versions
		info.execPath = process.execPath
		info.cwd = process.cwd()
		info.env = process.env
	} else if (env === "deno") {
		// Note: This will only work if actually running in Deno
		try {
			const denoGlobal = (globalThis as any).Deno
			if (typeof denoGlobal !== "undefined") {
				info.denoVersion = denoGlobal.version.deno
				info.v8Version = denoGlobal.version.v8
				info.typescriptVersion = denoGlobal.version.typescript
			}
		} catch (_error) {
			info.denoError = "Could not access Deno environment info"
		}
	} else if (env === "browser") {
		info.userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "unknown"
		info.location = typeof location !== "undefined" ? location.href : "unknown"
	}

	return info
}

/**
 * Get environment-specific file system operations
 */
export function getFileSystemOperations() {
	const env = detectEnvironment()

	if (env === "node") {
		return {
			readFile: async (path: string): Promise<string> => {
				const fs = await import("fs/promises")
				return fs.readFile(path, "utf-8")
			},
			writeFile: async (path: string, content: string): Promise<void> => {
				const fs = await import("fs/promises")
				return fs.writeFile(path, content, "utf-8")
			},
			exists: async (path: string): Promise<boolean> => {
				try {
					const fs = await import("fs/promises")
					await fs.access(path)
					return true
				} catch {
					return false
				}
			},
		}
	} else if (env === "deno") {
		return {
			readFile: async (path: string): Promise<string> => {
				const denoGlobal = (globalThis as any).Deno
				if (typeof denoGlobal !== "undefined") {
					return await denoGlobal.readTextFile(path)
				}
				throw new Error("Deno not available")
			},
			writeFile: async (path: string, content: string): Promise<void> => {
				const denoGlobal = (globalThis as any).Deno
				if (typeof denoGlobal !== "undefined") {
					return await denoGlobal.writeTextFile(path, content)
				}
				throw new Error("Deno not available")
			},
			exists: async (path: string): Promise<boolean> => {
				try {
					const denoGlobal = (globalThis as any).Deno
					if (typeof denoGlobal !== "undefined") {
						const stat = await denoGlobal.stat(path)
						return stat !== null
					}
					return false
				} catch {
					return false
				}
			},
		}
	} else {
		// Browser environment - use localStorage or IndexedDB
		return {
			readFile: async (path: string): Promise<string> => {
				const item = localStorage.getItem(path)
				return item || ""
			},
			writeFile: async (path: string, content: string): Promise<void> => {
				localStorage.setItem(path, content)
			},
			exists: async (path: string): Promise<boolean> => {
				return localStorage.getItem(path) !== null
			},
		}
	}
}

/**
 * Get environment-specific path separator
 */
export function getPathSeparator(): string {
	if (typeof process !== "undefined" && process.platform === "win32") {
		return "\\"
	}
	return "/"
}

/**
 * Get environment-specific temporary directory
 */
export function getTempDir(): string {
	if (typeof process !== "undefined") {
		return process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp"
	}
	return "/tmp"
}

/**
 * Check if we're running in a CI environment
 */
export function isCIEnvironment(): boolean {
	if (typeof process !== "undefined") {
		return !!(
			process.env.CI ||
			process.env.CONTINUOUS_INTEGRATION ||
			process.env.BUILD_NUMBER ||
			process.env.TRAVIS ||
			process.env.CIRCLECI ||
			process.env.APPVEYOR ||
			process.env.GITLAB_CI ||
			process.env.BUILDKITE ||
			process.env.DRONE
		)
	}
	return false
}

/**
 * Check if we're running in development mode
 */
export function isDevelopmentMode(): boolean {
	if (typeof process !== "undefined") {
		return process.env.NODE_ENV === "development"
	}
	return false
}

/**
 * Check if we're running in production mode
 */
export function isProductionMode(): boolean {
	if (typeof process !== "undefined") {
		return process.env.NODE_ENV === "production"
	}
	return false
}
