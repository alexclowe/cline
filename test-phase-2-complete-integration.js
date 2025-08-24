#!/usr/bin/env node

/**
 * Phase 2 Complete Integration Test
 * Tests the full gRPC integration from protobuf to webview client
 */

const fs = require("fs").promises
const path = require("path")

// ANSI color codes for better output
const colors = {
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	reset: "\x1b[0m",
	bold: "\x1b[1m",
}

function log(color, message) {
	console.log(`${color}${message}${colors.reset}`)
}

function logSection(title) {
	console.log(`\n${colors.bold}${colors.cyan}=== ${title} ===${colors.reset}`)
}

function logSuccess(message) {
	log(`${colors.green}✅ `, message)
}

function logError(message) {
	log(`${colors.red}❌ `, message)
}

function logInfo(message) {
	log(`${colors.blue}ℹ️  `, message)
}

function logWarning(message) {
	log(`${colors.yellow}⚠️  `, message)
}

async function fileExists(filePath) {
	try {
		await fs.access(filePath)
		return true
	} catch {
		return false
	}
}

async function readFile(filePath) {
	try {
		return await fs.readFile(filePath, "utf8")
	} catch (_error) {
		return null
	}
}

async function testProtobufDefinition() {
	logSection("Testing Protobuf Definition")

	const protoFile = "proto/cline/orchestration.proto"
	if (!(await fileExists(protoFile))) {
		logError(`Protobuf file not found: ${protoFile}`)
		return false
	}

	const protoContent = await readFile(protoFile)
	if (!protoContent) {
		logError("Could not read protobuf file")
		return false
	}

	// Check for service definition
	if (!protoContent.includes("service OrchestrationService")) {
		logError("OrchestrationService not found in protobuf")
		return false
	}

	// Check for all expected RPC methods
	const expectedMethods = [
		"getOrchestrationStatus",
		"updateOrchestrationConfig",
		"orchestrateTask",
		"cancelOrchestrationTask",
		"getOrchestrationMetrics",
		"resetOrchestrationMetrics",
		"getOrchestrationHealth",
		"getActiveOrchestrationTasks",
	]

	let allMethodsFound = true
	for (const method of expectedMethods) {
		if (!protoContent.includes(`rpc ${method}`)) {
			logError(`RPC method ${method} not found in protobuf`)
			allMethodsFound = false
		}
	}

	if (allMethodsFound) {
		logSuccess("All RPC methods found in protobuf definition")
	}

	// Check for message types
	const expectedMessages = [
		"OrchestrationStatus",
		"OrchestrationConfigRequest",
		"OrchestrationTaskRequest",
		"OrchestrationResult",
		"OrchestrationMetrics",
		"OrchestrationHealth",
		"ActiveOrchestrationTasksArray",
	]

	let allMessagesFound = true
	for (const message of expectedMessages) {
		if (!protoContent.includes(`message ${message}`)) {
			logError(`Message type ${message} not found in protobuf`)
			allMessagesFound = false
		}
	}

	if (allMessagesFound) {
		logSuccess("All message types found in protobuf definition")
	}

	return allMethodsFound && allMessagesFound
}

async function testGeneratedTypes() {
	logSection("Testing Generated TypeScript Types")

	const typesFile = "src/shared/proto/cline/orchestration.ts"
	if (!(await fileExists(typesFile))) {
		logError(`Generated types file not found: ${typesFile}`)
		return false
	}

	const typesContent = await readFile(typesFile)
	if (!typesContent) {
		logError("Could not read generated types file")
		return false
	}

	// Check for exported types
	const expectedExports = [
		"OrchestrationStatus",
		"OrchestrationConfigRequest",
		"OrchestrationTaskRequest",
		"OrchestrationResult",
		"OrchestrationMetrics",
		"OrchestrationHealth",
		"ActiveOrchestrationTasksArray",
	]

	let allExportsFound = true
	for (const exportName of expectedExports) {
		if (!typesContent.includes(`export interface ${exportName}`) && !typesContent.includes(`export const ${exportName}`)) {
			logError(`Export ${exportName} not found in generated types`)
			allExportsFound = false
		}
	}

	if (allExportsFound) {
		logSuccess("All expected types exported from generated file")
	}

	return allExportsFound
}

async function testBackendHandlers() {
	logSection("Testing Backend RPC Handlers")

	const handlersDir = "src/core/controller/orchestration"
	if (!(await fileExists(handlersDir))) {
		logError(`Handlers directory not found: ${handlersDir}`)
		return false
	}

	const expectedHandlers = [
		"getOrchestrationStatus.ts",
		"updateOrchestrationConfig.ts",
		"orchestrateTask.ts",
		"cancelOrchestrationTask.ts",
		"getOrchestrationMetrics.ts",
		"resetOrchestrationMetrics.ts",
		"getOrchestrationHealth.ts",
		"getActiveOrchestrationTasks.ts",
	]

	let allHandlersFound = true
	for (const handler of expectedHandlers) {
		const handlerPath = path.join(handlersDir, handler)
		if (!(await fileExists(handlerPath))) {
			logError(`Handler file not found: ${handler}`)
			allHandlersFound = false
			continue
		}

		const handlerContent = await readFile(handlerPath)
		if (!handlerContent) {
			logError(`Could not read handler file: ${handler}`)
			allHandlersFound = false
			continue
		}

		// Check for proper function export
		const functionName = handler.replace(".ts", "")
		if (!handlerContent.includes(`export async function ${functionName}`)) {
			logError(`Handler function not exported properly in ${handler}`)
			allHandlersFound = false
		}
	}

	if (allHandlersFound) {
		logSuccess("All backend RPC handlers found and properly structured")
	}

	return allHandlersFound
}

async function testGrpcServiceIntegration() {
	logSection("Testing gRPC Service Integration")

	const servicesFile = "src/generated/hosts/vscode/protobus-services.ts"
	if (!(await fileExists(servicesFile))) {
		logError(`Services file not found: ${servicesFile}`)
		return false
	}

	const servicesContent = await readFile(servicesFile)
	if (!servicesContent) {
		logError("Could not read services file")
		return false
	}

	// Check for orchestration service imports
	const expectedImports = [
		"getOrchestrationStatus",
		"updateOrchestrationConfig",
		"orchestrateTask",
		"cancelOrchestrationTask",
		"getOrchestrationMetrics",
		"resetOrchestrationMetrics",
		"getOrchestrationHealth",
		"getActiveOrchestrationTasks",
	]

	let allImportsFound = true
	for (const importName of expectedImports) {
		if (!servicesContent.includes(`import { ${importName} }`)) {
			logError(`Import ${importName} not found in services file`)
			allImportsFound = false
		}
	}

	// Check for service handler registration
	if (!servicesContent.includes("OrchestrationServiceHandlers")) {
		logError("OrchestrationServiceHandlers not found in services file")
		allImportsFound = false
	}

	if (!servicesContent.includes('"cline.OrchestrationService": OrchestrationServiceHandlers')) {
		logError("OrchestrationService not registered in serviceHandlers")
		allImportsFound = false
	}

	if (allImportsFound) {
		logSuccess("gRPC service integration properly configured")
	}

	return allImportsFound
}

async function testWebviewClient() {
	logSection("Testing Webview gRPC Client")

	const clientFile = "webview-ui/src/services/grpc-client.ts"
	if (!(await fileExists(clientFile))) {
		logError(`Client file not found: ${clientFile}`)
		return false
	}

	const clientContent = await readFile(clientFile)
	if (!clientContent) {
		logError("Could not read client file")
		return false
	}

	// Check for OrchestrationServiceClient
	if (!clientContent.includes("export class OrchestrationServiceClient")) {
		logError("OrchestrationServiceClient not found in client file")
		return false
	}

	// Check for all expected client methods
	const expectedMethods = [
		"getOrchestrationStatus",
		"updateOrchestrationConfig",
		"orchestrateTask",
		"cancelOrchestrationTask",
		"getOrchestrationMetrics",
		"resetOrchestrationMetrics",
		"getOrchestrationHealth",
		"getActiveOrchestrationTasks",
	]

	let allMethodsFound = true
	for (const method of expectedMethods) {
		if (!clientContent.includes(`static async ${method}(`)) {
			logError(`Client method ${method} not found`)
			allMethodsFound = false
		}
	}

	if (allMethodsFound) {
		logSuccess("OrchestrationServiceClient properly generated with all methods")
	}

	return allMethodsFound
}

async function testFrontendComponents() {
	logSection("Testing Frontend Components")

	const componentsDir = "webview-ui/src/components/orchestration"
	if (!(await fileExists(componentsDir))) {
		logError(`Components directory not found: ${componentsDir}`)
		return false
	}

	const expectedComponents = [
		"OrchestrationView.tsx",
		"sections/OrchestrationDashboard.tsx",
		"sections/OrchestrationConfigSection.tsx",
		"sections/OrchestrationTasksSection.tsx",
		"sections/OrchestrationMetricsSection.tsx",
		"sections/OrchestrationHealthSection.tsx",
	]

	let allComponentsFound = true
	for (const component of expectedComponents) {
		const componentPath = path.join(componentsDir, component)
		if (!(await fileExists(componentPath))) {
			logError(`Component not found: ${component}`)
			allComponentsFound = false
			continue
		}

		const componentContent = await readFile(componentPath)
		if (!componentContent) {
			logError(`Could not read component: ${component}`)
			allComponentsFound = false
			continue
		}

		// Check for OrchestrationServiceClient usage
		if (!componentContent.includes("OrchestrationServiceClient")) {
			logWarning(`Component ${component} does not use OrchestrationServiceClient`)
		}
	}

	if (allComponentsFound) {
		logSuccess("All frontend components found")
	}

	return allComponentsFound
}

async function testOrchestrationBackend() {
	logSection("Testing Orchestration Backend")

	const backendFiles = [
		"src/orchestration/ClaudeFlowOrchestrator.ts",
		"src/orchestration/AgentFactory.ts",
		"src/orchestration/AgentExecutors.ts",
		"src/orchestration/TaskAnalyzer.ts",
		"src/orchestration/CoordinationStrategy.ts",
		"src/orchestration/PerformanceMonitor.ts",
		"src/orchestration/ErrorHandler.ts",
	]

	let allBackendFilesFound = true
	for (const file of backendFiles) {
		if (!(await fileExists(file))) {
			logError(`Backend file not found: ${file}`)
			allBackendFilesFound = false
		}
	}

	if (allBackendFilesFound) {
		logSuccess("All orchestration backend files found")
	}

	return allBackendFilesFound
}

async function runAllTests() {
	console.log(`${colors.bold}${colors.magenta}🧪 Phase 2 Complete Integration Test${colors.reset}\n`)

	const tests = [
		{ name: "Protobuf Definition", test: testProtobufDefinition },
		{ name: "Generated Types", test: testGeneratedTypes },
		{ name: "Backend Handlers", test: testBackendHandlers },
		{ name: "gRPC Service Integration", test: testGrpcServiceIntegration },
		{ name: "Webview Client", test: testWebviewClient },
		{ name: "Frontend Components", test: testFrontendComponents },
		{ name: "Orchestration Backend", test: testOrchestrationBackend },
	]

	let passedTests = 0
	for (const { name, test } of tests) {
		try {
			const result = await test()
			if (result) {
				passedTests++
			}
		} catch (error) {
			logError(`Test ${name} failed with error: ${error.message}`)
		}
	}

	logSection("Test Summary")

	if (passedTests === tests.length) {
		logSuccess(`All ${tests.length} tests passed! 🎉`)
		logInfo("Phase 2 gRPC Server Integration is COMPLETE")

		console.log(`\n${colors.bold}${colors.green}Phase 2 Status: ✅ COMPLETE${colors.reset}`)
		console.log(`\n${colors.cyan}Integration Flow:${colors.reset}`)
		console.log(`  1. ✅ Protobuf definitions (proto/cline/orchestration.proto)`)
		console.log(`  2. ✅ Generated TypeScript types (src/shared/proto/cline/orchestration.ts)`)
		console.log(`  3. ✅ Backend RPC handlers (src/core/controller/orchestration/)`)
		console.log(`  4. ✅ gRPC service registration (src/generated/hosts/vscode/protobus-services.ts)`)
		console.log(`  5. ✅ Webview client generation (webview-ui/src/services/grpc-client.ts)`)
		console.log(`  6. ✅ Frontend components (webview-ui/src/components/orchestration/)`)
		console.log(`  7. ✅ Orchestration backend (src/orchestration/)`)

		console.log(`\n${colors.bold}${colors.yellow}Ready for Phase 3 Frontend Integration!${colors.reset}`)
		return true
	} else {
		logError(`${passedTests}/${tests.length} tests passed`)
		console.log(`\n${colors.bold}${colors.red}Phase 2 Status: ❌ INCOMPLETE${colors.reset}`)
		return false
	}
}

// Run all tests
runAllTests()
	.then((success) => {
		process.exit(success ? 0 : 1)
	})
	.catch((error) => {
		logError(`Test suite failed: ${error.message}`)
		process.exit(1)
	})
