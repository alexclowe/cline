/**
 * SQLite Wrapper with Windows Fallback Support
 * Provides graceful fallback when better-sqlite3 fails to load
 */

import { createRequire } from "module"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let Database: any = null
let sqliteAvailable = false
let loadError: Error | null = null

/**
 * SQLite configuration interface
 */
export interface SQLiteConfig {
	path: string
	timeout?: number
	verbose?: boolean
	readonly?: boolean
	fileMustExist?: boolean
	memory?: boolean
}

/**
 * SQLite wrapper class
 */
export class SQLiteWrapper {
	private db: any = null
	private config: SQLiteConfig

	constructor(config: SQLiteConfig) {
		this.config = config
	}

	async initialize(): Promise<void> {
		const DB = await getSQLiteDatabase()
		if (!DB) {
			throw new Error("SQLite is not available")
		}

		try {
			this.db = new DB(this.config.path, {
				timeout: this.config.timeout || 5000,
				verbose: this.config.verbose ? console.log : undefined,
				readonly: this.config.readonly || false,
				fileMustExist: this.config.fileMustExist || false,
			})
		} catch (err: any) {
			if (err.message.includes("EPERM") || err.message.includes("access denied")) {
				throw new Error(`Cannot create database at ${this.config.path}. Permission denied.`)
			}
			throw err
		}
	}

	async shutdown(): Promise<void> {
		if (this.db) {
			this.db.close()
			this.db = null
		}
	}

	prepare(sql: string): any {
		if (!this.db) {
			throw new Error("Database not initialized")
		}
		return this.db.prepare(sql)
	}

	exec(sql: string): void {
		if (!this.db) {
			throw new Error("Database not initialized")
		}
		this.db.exec(sql)
	}

	transaction(fn: () => void): any {
		if (!this.db) {
			throw new Error("Database not initialized")
		}
		return this.db.transaction(fn)
	}

	get database(): any {
		return this.db
	}
}

/**
 * Try to load better-sqlite3 with comprehensive error handling
 */
async function tryLoadSQLite(): Promise<boolean> {
	try {
		// Try CommonJS require first (more reliable in Node.js)
		const require = createRequire(import.meta.url)
		Database = require("better-sqlite3")
		sqliteAvailable = true
		return true
	} catch (requireErr: any) {
		// Fallback to ES module import
		try {
			const module = await import("better-sqlite3")
			Database = module.default
			sqliteAvailable = true
			return true
		} catch (importErr: any) {
			loadError = importErr

			// Check for specific Windows errors
			if (
				requireErr.message.includes("was compiled against a different Node.js version") ||
				requireErr.message.includes("Could not locate the bindings file") ||
				requireErr.message.includes("The specified module could not be found") ||
				requireErr.code === "MODULE_NOT_FOUND"
			) {
				console.warn(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                     Windows SQLite Installation Issue                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  The native SQLite module failed to load. This is common on Windows when    ║
║  using 'npx' or when node-gyp build tools are not available.               ║
║                                                                              ║
║  Claude Flow will continue with in-memory storage (non-persistent).         ║
║                                                                              ║
║  To enable persistent storage on Windows:                                    ║
║                                                                              ║
║  Option 1 - Install Windows Build Tools:                                    ║
║  > npm install --global windows-build-tools                                 ║
║  > npm install claude-flow@alpha                                           ║
║                                                                              ║
║  Option 2 - Use Pre-built Binaries:                                        ║
║  > npm config set python python3                                           ║
║  > npm install claude-flow@alpha --build-from-source=false                 ║
║                                                                              ║
║  Option 3 - Use WSL (Windows Subsystem for Linux):                         ║
║  Install WSL and run Claude Flow inside a Linux environment                 ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`)
			}

			return false
		}
	}
}

/**
 * Check if SQLite is available
 */
export async function isSQLiteAvailable(): Promise<boolean> {
	if (sqliteAvailable !== null) {
		return sqliteAvailable
	}

	await tryLoadSQLite()
	return sqliteAvailable
}

/**
 * Get SQLite Database constructor or null
 */
export async function getSQLiteDatabase(): Promise<any> {
	if (!sqliteAvailable && loadError === null) {
		await tryLoadSQLite()
	}

	return Database
}

/**
 * Get the load error if any
 */
export function getLoadError(): Error | null {
	return loadError
}

/**
 * Create a SQLite database instance with fallback
 */
export async function createDatabase(dbPath: string): Promise<any> {
	const DB = await getSQLiteDatabase()

	if (!DB) {
		throw new Error("SQLite is not available. Use fallback storage instead.")
	}

	try {
		return new DB(dbPath)
	} catch (err: any) {
		// Additional Windows-specific error handling
		if (err.message.includes("EPERM") || err.message.includes("access denied")) {
			throw new Error(
				`Cannot create database at ${dbPath}. Permission denied. Try using a different directory or running with administrator privileges.`,
			)
		}
		throw err
	}
}

/**
 * Create SQLite wrapper instance
 */
export function createSQLiteWrapper(config: SQLiteConfig): SQLiteWrapper {
	return new SQLiteWrapper(config)
}

/**
 * Execute a function within a transaction
 */
export async function withTransaction<T>(wrapper: SQLiteWrapper, fn: () => Promise<T> | T): Promise<T> {
	const transaction = wrapper.transaction(() => {
		return fn()
	})
	return transaction()
}

/**
 * Execute a function with a connection
 */
export async function withConnection<T>(config: SQLiteConfig, fn: (wrapper: SQLiteWrapper) => Promise<T> | T): Promise<T> {
	const wrapper = createSQLiteWrapper(config)
	try {
		await wrapper.initialize()
		return await fn(wrapper)
	} finally {
		await wrapper.shutdown()
	}
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
	return process.platform === "win32"
}

/**
 * Storage recommendation interface
 */
interface StorageRecommendation {
	recommended: string
	reason: string
	alternatives: string[]
}

/**
 * Get platform-specific storage recommendations
 */
export function getStorageRecommendations(): StorageRecommendation {
	if (isWindows()) {
		return {
			recommended: "in-memory",
			reason: "Windows native module compatibility",
			alternatives: [
				"Install Windows build tools for SQLite support",
				"Use WSL (Windows Subsystem for Linux)",
				"Use Docker container with Linux",
			],
		}
	}

	return {
		recommended: "sqlite",
		reason: "Best performance and persistence",
		alternatives: ["in-memory for testing"],
	}
}

// Pre-load SQLite on module import
tryLoadSQLite().catch(() => {
	// Silently handle initial load failure
})

export default {
	SQLiteWrapper,
	createSQLiteWrapper,
	withTransaction,
	withConnection,
	isSQLiteAvailable,
	getSQLiteDatabase,
	getLoadError,
	createDatabase,
	isWindows,
	getStorageRecommendations,
}
