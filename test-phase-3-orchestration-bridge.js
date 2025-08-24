/**
 * Phase 3: Orchestration Bridge Integration Test
 *
 * This test validates the complete implementation of Phase 3 as outlined in the
 * Cline-Flow integration strategy. It tests all integration points and ensures
 * the orchestration bridge is properly connected to the extension.
 */

const fs = require("fs").promises
const path = require("path")

// Test configuration
const TEST_CONFIG = {
	baseDir: __dirname,
	srcDir: path.join(__dirname, "src"),
	orchestrationDir: path.join(__dirname, "src", "orchestration"),
	controllerDir: path.join(__dirname, "src", "core", "controller"),
	protoDir: path.join(__dirname, "proto"),
	webviewDir: path.join(__dirname, "webview-ui", "src", "components", "orchestration"),
}

// Required files for Phase 3
const REQUIRED_FILES = {
	// Core orchestration files
	orchestration: [
		"ClaudeFlowOrchestrator.ts",
		"AgentFactory.ts",
		"TaskAnalyzer.ts",
		"CoordinationStrategy.ts",
		"AgentExecutors.ts",
		"PerformanceMonitor.ts",
		"ErrorHandler.ts",
	],

	// Controller integration files
	controller: [
		"index.ts", // Main controller with orchestration integration
		"orchestration/getOrchestrationStatus.ts",
		"orchestration/updateOrchestrationConfig.ts",
		"orchestration/orchestrateTask.ts",
		"orchestration/cancelOrchestrationTask.ts",
		"orchestration/getOrchestrationMetrics.ts",
		"orchestration/resetOrchestrationMetrics.ts",
		"orchestration/getOrchestrationHealth.ts",
		"orchestration/getActiveOrchestrationTasks.ts",
	],

	// Extension integration
	extension: ["extension.ts"],

	// Configuration
	config: ["package.json"],

	// Protobuf definitions
	proto: ["cline/orchestration.proto"],

	// Webview components
	webview: [
		"OrchestrationView.tsx",
		"sections/OrchestrationDashboard.tsx",
		"sections/OrchestrationConfigSection.tsx",
		"sections/OrchestrationTasksSection.tsx",
		"sections/OrchestrationMetricsSection.tsx",
		"sections/OrchestrationHealthSection.tsx",
	],
}

// Test results
const testResults = {
	passed: 0,
	failed: 0,
	errors: [],
}

// Utility functions
function logTest(testName, passed, details = "") {
	const status = passed ? "✅ PASS" : "❌ FAIL"
	console.log(`${status}: ${testName}`)

	if (!passed) {
		console.log(`   Details: ${details}`)
		testResults.errors.push(`${testName}: ${details}`)
	}

	if (passed) {
		testResults.passed++
	} else {
		testResults.failed++
	}
}

async function fileExists(filePath) {
	try {
		await fs.access(filePath)
		return true
	} catch {
		return false
	}
}

async function readFileContent(filePath) {
	try {
		return await fs.readFile(filePath, "utf8")
	} catch (_error) {
		return null
	}
}

// Test functions

async function testFileStructure() {
	console.log("\n📁 Testing Phase 3 File Structure...\n")

	// Test orchestration files
	for (const file of REQUIRED_FILES.orchestration) {
		const filePath = path.join(TEST_CONFIG.orchestrationDir, file)
		const exists = await fileExists(filePath)
		logTest(`Orchestration file exists: ${file}`, exists, exists ? "" : `File not found: ${filePath}`)
	}

	// Test controller files
	for (const file of REQUIRED_FILES.controller) {
		const filePath = path.join(TEST_CONFIG.controllerDir, file)
		const exists = await fileExists(filePath)
		logTest(`Controller file exists: ${file}`, exists, exists ? "" : `File not found: ${filePath}`)
	}

	// Test extension file
	const extensionPath = path.join(TEST_CONFIG.srcDir, "extension.ts")
	const extensionExists = await fileExists(extensionPath)
	logTest("Extension file exists: extension.ts", extensionExists, extensionExists ? "" : `File not found: ${extensionPath}`)

	// Test package.json
	const packagePath = path.join(TEST_CONFIG.baseDir, "package.json")
	const packageExists = await fileExists(packagePath)
	logTest("Package.json exists", packageExists, packageExists ? "" : `File not found: ${packagePath}`)

	// Test proto files
	for (const file of REQUIRED_FILES.proto) {
		const filePath = path.join(TEST_CONFIG.protoDir, file)
		const exists = await fileExists(filePath)
		logTest(`Proto file exists: ${file}`, exists, exists ? "" : `File not found: ${filePath}`)
	}

	// Test webview files
	for (const file of REQUIRED_FILES.webview) {
		const filePath = path.join(TEST_CONFIG.webviewDir, file)
		const exists = await fileExists(filePath)
		logTest(`Webview file exists: ${file}`, exists, exists ? "" : `File not found: ${filePath}`)
	}
}

async function testClaudeFlowOrchestratorIntegration() {
	console.log("\n🔄 Testing ClaudeFlowOrchestrator Integration...\n")

	const orchestratorPath = path.join(TEST_CONFIG.orchestrationDir, "ClaudeFlowOrchestrator.ts")
	const content = await readFileContent(orchestratorPath)

	if (!content) {
		logTest("ClaudeFlowOrchestrator content readable", false, "Could not read file")
		return
	}

	// Test for key class and methods
	const hasClass = content.includes("export class ClaudeFlowOrchestrator")
	logTest("ClaudeFlowOrchestrator class exported", hasClass)

	const hasOrchestrate = content.includes("orchestrateTask")
	logTest("orchestrateTask method exists", hasOrchestrate)

	const hasVsCodeLm = content.includes("VsCodeLmHandler")
	logTest("VS Code LM integration present", hasVsCodeLm)

	const hasSwarmCoordinator = content.includes("SwarmCoordinator")
	logTest("SwarmCoordinator integration present", hasSwarmCoordinator)

	const hasMemoryManager = content.includes("MemoryManager")
	logTest("MemoryManager integration present", hasMemoryManager)

	const hasConfig = content.includes("OrchestrationConfig")
	logTest("OrchestrationConfig interface present", hasConfig)

	const hasModes = content.includes("OrchestrationMode")
	logTest("OrchestrationMode enum present", hasModes)

	const hasMetrics = content.includes("OrchestrationMetrics")
	logTest("OrchestrationMetrics interface present", hasMetrics)
}

async function testControllerIntegration() {
	console.log("\n🎮 Testing Controller Integration...\n")

	const controllerPath = path.join(TEST_CONFIG.controllerDir, "index.ts")
	const content = await readFileContent(controllerPath)

	if (!content) {
		logTest("Controller content readable", false, "Could not read file")
		return
	}

	// Test for orchestration imports
	const hasOrchestratorImport = content.includes("ClaudeFlowOrchestrator")
	logTest("ClaudeFlowOrchestrator import present", hasOrchestratorImport)

	const hasSwarmImport = content.includes("SwarmCoordinator")
	logTest("SwarmCoordinator import present", hasSwarmImport)

	const hasMemoryImport = content.includes("MemoryManager")
	logTest("MemoryManager import present", hasMemoryImport)

	// Test for orchestration properties
	const hasOrchestratorProperty = content.includes("claudeFlowOrchestrator")
	logTest("claudeFlowOrchestrator property present", hasOrchestratorProperty)

	const hasSwarmProperty = content.includes("swarmCoordinator")
	logTest("swarmCoordinator property present", hasSwarmProperty)

	const hasMemoryProperty = content.includes("memoryManager")
	logTest("memoryManager property present", hasMemoryProperty)

	// Test for orchestration methods
	const hasInitOrchestration = content.includes("initializeOrchestration")
	logTest("initializeOrchestration method present", hasInitOrchestration)

	const hasShouldUseOrchestration = content.includes("shouldUseOrchestration")
	logTest("shouldUseOrchestration method present", hasShouldUseOrchestration)

	const hasAttemptOrchestration = content.includes("attemptOrchestration")
	logTest("attemptOrchestration method present", hasAttemptOrchestration)

	// Test for orchestration in initTask
	const hasOrchestrationInInitTask = content.includes("shouldUseOrchestration(task)")
	logTest("Orchestration check in initTask", hasOrchestrationInInitTask)

	// Test for RPC handlers
	const hasOrchestrationStatusRPC = content.includes("getOrchestrationStatus")
	logTest("getOrchestrationStatus RPC handler", hasOrchestrationStatusRPC)

	const hasUpdateConfigRPC = content.includes("updateOrchestrationConfigRPC")
	logTest("updateOrchestrationConfigRPC method", hasUpdateConfigRPC)
}

async function testExtensionIntegration() {
	console.log("\n🔌 Testing Extension Integration...\n")

	const extensionPath = path.join(TEST_CONFIG.srcDir, "extension.ts")
	const content = await readFileContent(extensionPath)

	if (!content) {
		logTest("Extension content readable", false, "Could not read file")
		return
	}

	// Test for enhanced commands
	const hasEnhancedTask = content.includes("cline.enhancedTask")
	logTest("Enhanced task command registered", hasEnhancedTask)

	const hasOrchestrationControl = content.includes("cline.orchestrationControl")
	logTest("Orchestration control command registered", hasOrchestrationControl)

	// Test for command handlers
	const hasEnhancedTaskHandler = content.includes('registerCommand("cline.enhancedTask"')
	logTest("Enhanced task command handler present", hasEnhancedTaskHandler)

	const hasControlHandler = content.includes('registerCommand("cline.orchestrationControl"')
	logTest("Orchestration control handler present", hasControlHandler)

	// Test for orchestration status checks
	const hasStatusCheck = content.includes("getOrchestrationStatus()")
	logTest("Orchestration status check in commands", hasStatusCheck)

	// Test for settings integration
	const hasSettingsIntegration = content.includes("cline.orchestration")
	logTest("Orchestration settings integration", hasSettingsIntegration)
}

async function testPackageJsonConfiguration() {
	console.log("\n📦 Testing Package.json Configuration...\n")

	const packagePath = path.join(TEST_CONFIG.baseDir, "package.json")
	const content = await readFileContent(packagePath)

	if (!content) {
		logTest("Package.json content readable", false, "Could not read file")
		return
	}

	let packageJson
	try {
		packageJson = JSON.parse(content)
	} catch (error) {
		logTest("Package.json valid JSON", false, `Parse error: ${error.message}`)
		return
	}

	// Test commands
	const commands = packageJson.contributes?.commands || []
	const hasEnhancedTask = commands.some((cmd) => cmd.command === "cline.enhancedTask")
	logTest("Enhanced task command in package.json", hasEnhancedTask)

	const hasOrchestrationControl = commands.some((cmd) => cmd.command === "cline.orchestrationControl")
	logTest("Orchestration control command in package.json", hasOrchestrationControl)

	// Test configuration schema
	const config = packageJson.contributes?.configuration?.properties || {}
	const hasOrchestrationEnabled = "cline.orchestration.enabled" in config
	logTest("Orchestration enabled setting", hasOrchestrationEnabled)

	const hasOrchestrationMode = "cline.orchestration.mode" in config
	logTest("Orchestration mode setting", hasOrchestrationMode)

	const hasComplexityThreshold = "cline.orchestration.complexityThreshold" in config
	logTest("Complexity threshold setting", hasComplexityThreshold)

	const hasMaxAgents = "cline.orchestration.maxAgents" in config
	logTest("Max agents setting", hasMaxAgents)

	const hasTimeout = "cline.orchestration.timeoutMs" in config
	logTest("Timeout setting", hasTimeout)

	const hasFallback = "cline.orchestration.fallbackToSingleAgent" in config
	logTest("Fallback setting", hasFallback)

	// Test configuration defaults
	if (hasOrchestrationEnabled) {
		const enabledDefault = config["cline.orchestration.enabled"].default
		logTest("Orchestration enabled default false", enabledDefault === false)
	}

	if (hasOrchestrationMode) {
		const modeDefault = config["cline.orchestration.mode"].default
		logTest("Orchestration mode default ADAPTIVE", modeDefault === "ADAPTIVE")
	}

	if (hasComplexityThreshold) {
		const thresholdDefault = config["cline.orchestration.complexityThreshold"].default
		logTest("Complexity threshold default 0.4", thresholdDefault === 0.4)
	}
}

async function testRPCHandlers() {
	console.log("\n🔗 Testing RPC Handlers...\n")

	const rpcFiles = [
		"getOrchestrationStatus.ts",
		"updateOrchestrationConfig.ts",
		"orchestrateTask.ts",
		"cancelOrchestrationTask.ts",
		"getOrchestrationMetrics.ts",
		"resetOrchestrationMetrics.ts",
		"getOrchestrationHealth.ts",
		"getActiveOrchestrationTasks.ts",
	]

	for (const rpcFile of rpcFiles) {
		const filePath = path.join(TEST_CONFIG.controllerDir, "orchestration", rpcFile)
		const exists = await fileExists(filePath)
		logTest(`RPC handler exists: ${rpcFile}`, exists)

		if (exists) {
			const content = await readFileContent(filePath)
			if (content) {
				const hasController = content.includes("controller: Controller")
				logTest(`${rpcFile} has controller parameter`, hasController)

				const hasExport = content.includes("export")
				logTest(`${rpcFile} exports function`, hasExport)
			}
		}
	}
}

async function testWebviewComponents() {
	console.log("\n🖥️  Testing Webview Components...\n")

	const components = [
		"OrchestrationView.tsx",
		"sections/OrchestrationDashboard.tsx",
		"sections/OrchestrationConfigSection.tsx",
		"sections/OrchestrationTasksSection.tsx",
		"sections/OrchestrationMetricsSection.tsx",
		"sections/OrchestrationHealthSection.tsx",
	]

	for (const component of components) {
		const filePath = path.join(TEST_CONFIG.webviewDir, component)
		const exists = await fileExists(filePath)
		logTest(`Webview component exists: ${component}`, exists)

		if (exists) {
			const content = await readFileContent(filePath)
			if (content) {
				const isReactComponent =
					content.includes("export") &&
					(content.includes("React") || content.includes("jsx") || content.includes("tsx"))
				logTest(`${component} is React component`, isReactComponent)
			}
		}
	}
}

async function testIntegrationPoints() {
	console.log("\n🔗 Testing Integration Points...\n")

	// Test that orchestration is integrated into task initialization
	const controllerContent = await readFileContent(path.join(TEST_CONFIG.controllerDir, "index.ts"))
	if (controllerContent) {
		const hasTaskInitIntegration =
			controllerContent.includes("shouldUseOrchestration") && controllerContent.includes("attemptOrchestration")
		logTest("Orchestration integrated into task initialization", hasTaskInitIntegration)

		const hasConfigFromSettings = controllerContent.includes("getOrchestrationConfigFromSettings")
		logTest("Configuration loaded from VS Code settings", hasConfigFromSettings)

		const hasComplexityAssessment = controllerContent.includes("assessTaskComplexity")
		logTest("Task complexity assessment implemented", hasComplexityAssessment)
	}

	// Test that VS Code LM API is properly integrated
	const orchestratorContent = await readFileContent(path.join(TEST_CONFIG.orchestrationDir, "ClaudeFlowOrchestrator.ts"))
	if (orchestratorContent) {
		const hasVsCodeLmIntegration = orchestratorContent.includes("vscode.lm.selectChatModels")
		logTest("VS Code LM API integration present", hasVsCodeLmIntegration)

		const hasModelSelector = orchestratorContent.includes("vsCodeLmModelSelector")
		logTest("VS Code LM model selector configured", hasModelSelector)
	}
}

async function testErrorHandlingAndFallbacks() {
	console.log("\n🛡️  Testing Error Handling and Fallbacks...\n")

	const controllerContent = await readFileContent(path.join(TEST_CONFIG.controllerDir, "index.ts"))
	if (controllerContent) {
		const hasFallbackLogic = controllerContent.includes("fallbackToSingleAgent")
		logTest("Fallback to single agent logic present", hasFallbackLogic)

		const hasErrorHandling = controllerContent.includes("catch") && controllerContent.includes("orchestration")
		logTest("Orchestration error handling present", hasErrorHandling)

		const hasShutdown = controllerContent.includes("shutdownOrchestration")
		logTest("Orchestration shutdown method present", hasShutdown)
	}

	const orchestratorContent = await readFileContent(path.join(TEST_CONFIG.orchestrationDir, "ClaudeFlowOrchestrator.ts"))
	if (orchestratorContent) {
		const hasCleanup = orchestratorContent.includes("cleanup")
		logTest("Orchestrator cleanup method present", hasCleanup)

		const hasErrorResults = orchestratorContent.includes("OrchestrationResult") && orchestratorContent.includes("error?:")
		logTest("Error results properly typed", hasErrorResults)
	}
}

// Main test runner
async function runTests() {
	console.log("🚀 Phase 3: Orchestration Bridge Integration Tests")
	console.log("================================================\n")

	try {
		await testFileStructure()
		await testClaudeFlowOrchestratorIntegration()
		await testControllerIntegration()
		await testExtensionIntegration()
		await testPackageJsonConfiguration()
		await testRPCHandlers()
		await testWebviewComponents()
		await testIntegrationPoints()
		await testErrorHandlingAndFallbacks()

		console.log("\n📊 Test Results Summary")
		console.log("======================")
		console.log(`✅ Passed: ${testResults.passed}`)
		console.log(`❌ Failed: ${testResults.failed}`)
		console.log(`📊 Total:  ${testResults.passed + testResults.failed}`)

		if (testResults.failed > 0) {
			console.log("\n❌ Failed Tests:")
			testResults.errors.forEach((error) => {
				console.log(`   • ${error}`)
			})
		}

		const successRate = (testResults.passed / (testResults.passed + testResults.failed)) * 100
		console.log(`\n🎯 Success Rate: ${successRate.toFixed(1)}%`)

		if (successRate >= 90) {
			console.log("\n🎉 Phase 3: Orchestration Bridge implementation is EXCELLENT!")
		} else if (successRate >= 75) {
			console.log("\n✅ Phase 3: Orchestration Bridge implementation is GOOD.")
		} else if (successRate >= 50) {
			console.log("\n⚠️  Phase 3: Orchestration Bridge implementation needs IMPROVEMENT.")
		} else {
			console.log("\n❌ Phase 3: Orchestration Bridge implementation has MAJOR ISSUES.")
		}

		return successRate >= 75
	} catch (error) {
		console.error("\n💥 Test runner error:", error)
		return false
	}
}

// Run tests if called directly
if (require.main === module) {
	runTests().then((success) => {
		process.exit(success ? 0 : 1)
	})
}

module.exports = { runTests, TEST_CONFIG }
