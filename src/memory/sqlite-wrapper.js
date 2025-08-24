/**
 * JavaScript version of SQLite wrapper for Claude-Flow compatibility
 * This file provides JavaScript exports that some legacy components expect
 */

// Import the TypeScript module - use require for Node.js compatibility
let sqliteWrapper
try {
	// Try to import the compiled TypeScript module
	sqliteWrapper = require("./sqlite-wrapper")
} catch (_error) {
	// Fallback to basic exports if TypeScript module isn't available
	console.warn("SQLite wrapper TypeScript module not available, using fallback")
	sqliteWrapper = {
		SQLiteWrapper: class SQLiteWrapper {
			constructor(config) {
				this.config = config
				this.db = null
			}

			async initialize() {
				throw new Error("SQLite not available - please install better-sqlite3")
			}

			async shutdown() {
				// No-op
			}
		},
		createSQLiteWrapper: function (config) {
			return new this.SQLiteWrapper(config)
		},
		withTransaction: async (_wrapper, _fn) => {
			throw new Error("SQLite not available")
		},
		withConnection: async (_config, _fn) => {
			throw new Error("SQLite not available")
		},
		isSQLiteAvailable: async () => false,
		getSQLiteDatabase: async () => null,
		getLoadError: () => new Error("SQLite not available"),
		createDatabase: async () => {
			throw new Error("SQLite not available")
		},
		isWindows: () => process.platform === "win32",
		getStorageRecommendations: () => ({
			recommended: "in-memory",
			reason: "SQLite not available",
			alternatives: ["Install better-sqlite3"],
		}),
	}
}

// Re-export everything from the TypeScript sqlite-wrapper module
const {
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
} = sqliteWrapper

// Export for CommonJS compatibility
module.exports = {
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

// Also provide ES6 exports for compatibility
Object.assign(exports, module.exports)
