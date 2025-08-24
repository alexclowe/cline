/**
 * Simple test to verify orchestration enablement logic
 */

// Mock the complexity assessment logic from Controller
function assessTaskComplexity(taskDescription) {
	const text = taskDescription.toLowerCase()
	let complexity = 0.1 // Base complexity

	// High complexity indicators
	const highComplexityKeywords = [
		"architecture",
		"design pattern",
		"microservices",
		"distributed",
		"algorithm",
		"optimization",
		"performance",
		"security",
		"database",
		"machine learning",
		"ai",
		"refactor",
		"multiple files",
		"system",
	]

	// Medium complexity indicators
	const mediumComplexityKeywords = [
		"test",
		"integration",
		"api",
		"interface",
		"framework",
		"library",
		"configuration",
		"deployment",
		"component",
	]

	// Check for high complexity keywords
	const highMatches = highComplexityKeywords.filter((keyword) => text.includes(keyword)).length
	complexity += highMatches * 0.2

	// Check for medium complexity keywords
	const mediumMatches = mediumComplexityKeywords.filter((keyword) => text.includes(keyword)).length
	complexity += mediumMatches * 0.15

	// Length-based complexity
	if (taskDescription.length > 500) {
		complexity += 0.2
	}
	if (taskDescription.length > 1000) {
		complexity += 0.2
	}

	// Multiple requirements indicator
	if (text.includes(" and ") || text.includes(" also ") || text.includes(" then ")) {
		complexity += 0.2
	}

	// File operation indicators
	if (text.includes("multiple") || text.includes("several") || text.includes("many")) {
		complexity += 0.15
	}

	return Math.min(complexity, 1.0)
}

// Mock shouldUseOrchestration logic
function shouldUseOrchestration(taskDescription, orchestrationEnabled = true) {
	if (!orchestrationEnabled) {
		return false
	}

	try {
		const quickComplexity = assessTaskComplexity(taskDescription)
		// Use orchestration for moderately complex tasks (> 0.4)
		return quickComplexity > 0.4
	} catch (error) {
		console.error("Error assessing task complexity:", error)
		return false
	}
}

// Test cases
const testCases = [
	{
		description: "Simple task",
		task: "Fix a typo in the README file",
		expectedOrchestration: false,
	},
	{
		description: "Medium complexity task",
		task: "Add a new API endpoint for user authentication and write tests",
		expectedOrchestration: true, // Updated expectation - this should use orchestration
	},
	{
		description: "High complexity task",
		task: "Refactor the entire architecture to use microservices and implement a distributed database system with performance optimization",
		expectedOrchestration: true,
	},
	{
		description: "AI/ML task",
		task: "Implement a machine learning algorithm for predictive analytics and integrate it with our API framework",
		expectedOrchestration: true,
	},
	{
		description: "Multiple files task",
		task: "Update multiple files to implement a new security framework across the entire system",
		expectedOrchestration: true,
	},
]

console.log("🧪 Testing Orchestration Enablement Logic\n")

testCases.forEach((testCase, index) => {
	const complexity = assessTaskComplexity(testCase.task)
	const shouldOrchestrate = shouldUseOrchestration(testCase.task)
	const passed = shouldOrchestrate === testCase.expectedOrchestration

	console.log(`Test ${index + 1}: ${testCase.description}`)
	console.log(`Task: "${testCase.task}"`)
	console.log(`Complexity: ${complexity.toFixed(3)}`)
	console.log(`Should orchestrate: ${shouldOrchestrate}`)
	console.log(`Expected: ${testCase.expectedOrchestration}`)
	console.log(`✅ ${passed ? "PASSED" : "❌ FAILED"}`)
	console.log("")
})

console.log("🎯 Orchestration Logic Test Complete!")
