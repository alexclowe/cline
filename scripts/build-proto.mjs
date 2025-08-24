#!/usr/bin/env node

import chalk from "chalk"
import { execFileSync } from "child_process"
import * as fs from "fs/promises"
import { globby } from "globby"
import { createRequire } from "module"
import os from "os"
import * as path from "path"
import { rmrf } from "./file-utils.mjs"
import { main as generateHostBridgeClient } from "./generate-host-bridge-client.mjs"
import { main as generateProtoBusSetup } from "./generate-protobus-setup.mjs"
import { loadProtoDescriptorSet } from "./proto-utils.mjs"

const require = createRequire(import.meta.url)
const isWindows = process.platform === "win32"

// Resolve protoc from grpc-tools explicitly (avoid PATH conflicts)
const PROTOC = path.join(path.dirname(require.resolve("grpc-tools")), "bin", isWindows ? "protoc.exe" : "protoc")

// Resolve ts-proto plugin: use the .cmd shim on Windows (NOT the .ps1)
const TS_PROTO_PLUGIN = isWindows
	? path.resolve("node_modules", ".bin", "protoc-gen-ts_proto.cmd")
	: require.resolve("ts-proto/protoc-gen-ts_proto")

const PROTO_DIR = path.resolve("proto")
const TS_OUT_DIR = path.resolve("src/shared/proto")
const GRPC_JS_OUT_DIR = path.resolve("src/generated/grpc-js")
const NICE_JS_OUT_DIR = path.resolve("src/generated/nice-grpc")
const DESCRIPTOR_OUT_DIR = path.resolve("dist-standalone/proto")

const TS_PROTO_OPTIONS = [
	"env=node",
	"esModuleInterop=true",
	"outputServices=generic-definitions",
	"outputIndex=true",
	"useOptionals=messages",
	"useDate=false",
	"forceLong=string",
]

function log_verbose(s) {
	if (process.argv.includes("-v") || process.argv.includes("--verbose")) {
		console.log(s)
	}
}

// Build the env we pass to execFileSync (no PATH tricks needed now)
function makeEnv() {
	return { ...process.env }
}

async function main() {
	await cleanup()
	await compileProtos()
	await checkProtos()
	await generateProtoBusSetup()
	await generateHostBridgeClient()
}

async function compileProtos() {
	console.log(chalk.bold.blue("Compiling Protocol Buffers..."))

	// Show tool paths when verbose
	log_verbose(chalk.gray(`protoc:        ${PROTOC}`))
	log_verbose(chalk.gray(`ts-proto plug: ${TS_PROTO_PLUGIN}`))

	checkAppleSiliconCompatibility()

	for (const dir of [TS_OUT_DIR, GRPC_JS_OUT_DIR, NICE_JS_OUT_DIR, DESCRIPTOR_OUT_DIR]) {
		await fs.mkdir(dir, { recursive: true })
	}

	const protoFiles = await globby("**/*.proto", { cwd: PROTO_DIR, realpath: true })
	console.log(chalk.cyan(`Processing ${protoFiles.length} proto files from`), PROTO_DIR)

	tsProtoc(TS_OUT_DIR, protoFiles, TS_PROTO_OPTIONS)
	tsProtoc(GRPC_JS_OUT_DIR, protoFiles, ["outputServices=grpc-js,outputClientImpl=false", ...TS_PROTO_OPTIONS])
	tsProtoc(NICE_JS_OUT_DIR, protoFiles, ["outputServices=nice-grpc,useExactTypes=false", ...TS_PROTO_OPTIONS])

	// Descriptor set
	const descriptorFile = path.join(DESCRIPTOR_OUT_DIR, "descriptor_set.pb")
	const descArgs = [`--proto_path=${PROTO_DIR}`, `--descriptor_set_out=${descriptorFile}`, "--include_imports", ...protoFiles]
	try {
		log_verbose(chalk.cyan("Generating descriptor set..."))
		execFileSync(PROTOC, descArgs, { stdio: "inherit", env: makeEnv() })
	} catch (error) {
		console.error(chalk.red("Error generating descriptor set for proto file:"), error)
		process.exit(1)
	}

	log_verbose(chalk.green("Protocol Buffer code generation completed successfully."))
	log_verbose(chalk.green(`TypeScript files generated in: ${TS_OUT_DIR}`))
}

function tsProtoc(outDir, protoFiles, protoOptions) {
	// Build args as an array to avoid shell quoting issues
	const args = [
		`--proto_path=${PROTO_DIR}`,
		// Explicit plugin path (bypasses .ps1 shim and PATH)
		`--plugin=protoc-gen-ts_proto=${TS_PROTO_PLUGIN}`,
		`--ts_proto_out=${outDir}`,
		`--ts_proto_opt=${protoOptions.join(",")}`,
		...protoFiles,
	]

	try {
		log_verbose(chalk.cyan(`Generating TypeScript code in ${outDir} for:\n${protoFiles.map((p) => `  ${p}`).join("\n")}\n`))
		log_verbose([PROTOC, ...args].join(" "))
		execFileSync(PROTOC, args, { stdio: "inherit", env: makeEnv() })
	} catch (error) {
		console.error(chalk.red("Error generating TypeScript for proto files:"), error)
		process.exit(1)
	}
}

async function cleanup() {
	log_verbose(chalk.cyan("Cleaning up existing generated TypeScript files..."))
	await rmrf(TS_OUT_DIR)
	await rmrf("src/generated")

	// Clean up generated files that were moved.
	await rmrf("src/standalone/services/host-grpc-client.ts")
	await rmrf("src/standalone/server-setup.ts")
	await rmrf("src/hosts/vscode/host-grpc-service-config.ts")
	await rmrf("src/core/controller/grpc-service-config.ts")
	const oldhostbridgefiles = [
		"src/hosts/vscode/workspace/methods.ts",
		"src/hosts/vscode/workspace/index.ts",
		"src/hosts/vscode/diff/methods.ts",
		"src/hosts/vscode/diff/index.ts",
		"src/hosts/vscode/env/methods.ts",
		"src/hosts/vscode/env/index.ts",
		"src/hosts/vscode/window/methods.ts",
		"src/hosts/vscode/window/index.ts",
		"src/hosts/vscode/watch/methods.ts",
		"src/hosts/vscode/watch/index.ts",
		"src/hosts/vscode/uri/methods.ts",
		"src/hosts/vscode/uri/index.ts",
	]
	const oldprotobusfiles = [
		"src/core/controller/account/index.ts",
		"src/core/controller/account/methods.ts",
		"src/core/controller/browser/index.ts",
		"src/core/controller/browser/methods.ts",
		"src/core/controller/checkpoints/index.ts",
		"src/core/controller/checkpoints/methods.ts",
		"src/core/controller/file/index.ts",
		"src/core/controller/file/methods.ts",
		"src/core/controller/mcp/index.ts",
		"src/core/controller/mcp/methods.ts",
		"src/core/controller/models/index.ts",
		"src/core/controller/models/methods.ts",
		"src/core/controller/slash/index.ts",
		"src/core/controller/slash/methods.ts",
		"src/core/controller/state/index.ts",
		"src/core/controller/state/methods.ts",
		"src/core/controller/task/index.ts",
		"src/core/controller/task/methods.ts",
		"src/core/controller/ui/index.ts",
		"src/core/controller/ui/methods.ts",
		"src/core/controller/web/index.ts",
		"src/core/controller/web/methods.ts",
	]
	for (const file of [...oldhostbridgefiles, ...oldprotobusfiles]) {
		await rmrf(file)
	}
}

function checkAppleSiliconCompatibility() {
	if (process.platform !== "darwin") {
		return
	}

	const cpuArchitecture = os.arch()
	if (cpuArchitecture === "arm64") {
		try {
			const rosettaCheck = execFileSync("/usr/bin/pgrep", ["oahd"], { stdio: "pipe" }).toString().trim()
			if (!rosettaCheck) {
				throw new Error("NOT_INSTALLED")
			}
		} catch (_error) {
			console.log(chalk.yellow("Detected Apple Silicon (ARM64) architecture."))
			console.log(
				chalk.red("Rosetta 2 may NOT be installed. The npm version of protoc is not compatible with Apple Silicon."),
			)
			console.log(chalk.cyan("Please install Rosetta 2 using the following command:"))
			console.log(chalk.cyan("  softwareupdate --install-rosetta --agree-to-license"))
			console.log(chalk.red("Aborting build process."))
			process.exit(1)
		}
	}
}

const int64TypeNames = ["TYPE_INT64", "TYPE_UINT64", "TYPE_SINT64", "TYPE_FIXED64", "TYPE_SFIXED64"]

async function checkProtos() {
	const proto = await loadProtoDescriptorSet()
	const int64Fields = []

	for (const [packageName, packageDef] of Object.entries(proto)) {
		for (const [messageName, def] of Object.entries(packageDef)) {
			if (def && typeof def === "object" && "service" in def) {
				continue
			}
			if (def && def.type && def.type.field) {
				for (const field of def.type.field) {
					if (int64TypeNames.includes(field.type)) {
						const name = `${packageName}.${messageName}.${field.name}`
						int64Fields.push({ name, type: field.type })
					}
				}
			}
		}
	}

	if (int64Fields.length > 0) {
		console.log(chalk.yellow(`\nWarning: Found ${int64Fields.length} fields using 64-bit integer types`))
		for (const field of int64Fields) {
			const typeNames = {
				TYPE_INT64: "int64",
				TYPE_UINT64: "uint64",
				TYPE_SINT64: "sint64",
				TYPE_FIXED64: "fixed64",
				TYPE_SFIXED64: "sfixed64",
			}
			log_verbose(chalk.yellow(`  - ${field.name} (${typeNames[field.type]})`))
		}
		log_verbose(chalk.yellow("\nWARNING: 64-bit integer fields detected in proto definitions"))
		log_verbose(chalk.yellow("JavaScript cannot safely represent integers larger than 2^53-1 (Number.MAX_SAFE_INTEGER)."))
		log_verbose(chalk.yellow("Consider using string representation for large numbers or implementing BigInt support.\n"))
	}
}

main().catch((error) => {
	console.error(chalk.red("Error:"), error)
	process.exit(1)
})
