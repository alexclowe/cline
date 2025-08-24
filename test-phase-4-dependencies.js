/**
 * Test script to verify Phase 4 dependencies are properly installed
 * Run this after npm install completes
 */

console.log("🧪 Testing Phase 4 Dependencies...\n")

const dependencies = [
	"better-sqlite3",
	"cohere-ai",
	"@google-ai/generativelanguage",
	"node-cache",
	"p-queue",
	"puppeteer",
	"winston",
	"openai",
	"zod",
]

let allPassed = true

dependencies.forEach((dep) => {
	try {
		require.resolve(dep)
		console.log(`✅ ${dep} - INSTALLED`)
	} catch (_error) {
		console.log(`❌ ${dep} - NOT FOUND`)
		allPassed = false
	}
})

console.log("\n📊 Testing functionality...\n")

// Test SQLite
try {
	const Database = require("better-sqlite3")
	const db = new Database(":memory:")
	db.close()
	console.log("✅ better-sqlite3 - FUNCTIONAL")
} catch (error) {
	console.log(`❌ better-sqlite3 - ERROR: ${error.message}`)
	allPassed = false
}

// Test Node Cache
try {
	const NodeCache = require("node-cache")
	const cache = new NodeCache()
	cache.set("test", "value")
	const value = cache.get("test")
	if (value === "value") {
		console.log("✅ node-cache - FUNCTIONAL")
	} else {
		throw new Error("Cache value mismatch")
	}
} catch (error) {
	console.log(`❌ node-cache - ERROR: ${error.message}`)
	allPassed = false
}

// Test P-Queue
try {
	const PQueue = require("p-queue").default
	const _queue = new PQueue({ concurrency: 1 })
	console.log("✅ p-queue - FUNCTIONAL")
} catch (error) {
	console.log(`❌ p-queue - ERROR: ${error.message}`)
	allPassed = false
}

// Test Winston
try {
	const winston = require("winston")
	const _logger = winston.createLogger({
		level: "info",
		format: winston.format.json(),
		transports: [new winston.transports.Console({ silent: true })],
	})
	console.log("✅ winston - FUNCTIONAL")
} catch (error) {
	console.log(`❌ winston - ERROR: ${error.message}`)
	allPassed = false
}

// Test Zod
try {
	const { z } = require("zod")
	const schema = z.string()
	schema.parse("test")
	console.log("✅ zod - FUNCTIONAL")
} catch (error) {
	console.log(`❌ zod - ERROR: ${error.message}`)
	allPassed = false
}

console.log("\n🏁 Phase 4 Dependencies Test Results:")
if (allPassed) {
	console.log("✅ ALL TESTS PASSED - Phase 4 Complete!")
	console.log("\n🚀 Ready for Phase 5: Provider Integration")
} else {
	console.log("❌ SOME TESTS FAILED - Check installation")
}

console.log("\n📋 Summary:")
console.log("- SQLite database support: better-sqlite3")
console.log("- AI provider support: cohere-ai, @google-ai/generativelanguage")
console.log("- Caching system: node-cache")
console.log("- Queue management: p-queue")
console.log("- Browser automation: puppeteer")
console.log("- Logging framework: winston")
console.log("- Schema validation: zod")
console.log("- OpenAI integration: openai")
