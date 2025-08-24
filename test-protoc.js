const { execSync } = require("child_process")
const path = require("path")

const protoc = path.join(__dirname, "node_modules", "grpc-tools", "bin", "protoc.exe")
const tsProtoPlugin = path.join(__dirname, "node_modules", "ts-proto", "protoc-gen-ts_proto")
const protoDir = path.join(__dirname, "proto")
const outDir = path.join(__dirname, "src", "shared", "proto")

console.log("Protoc path:", protoc)
console.log("Plugin path:", tsProtoPlugin)
console.log("Proto dir:", protoDir)
console.log("Output dir:", outDir)

try {
	// Test protoc version
	console.log("\nTesting protoc version:")
	const version = execSync(`"${protoc}" --version`, { encoding: "utf8" })
	console.log("Version:", version)

	// Test simple proto compilation
	console.log("\nTesting simple proto compilation:")
	const command = `"${protoc}" --proto_path="${protoDir}" --plugin=protoc-gen-ts_proto="${tsProtoPlugin}" --ts_proto_out="${outDir}" --ts_proto_opt=env=node,esModuleInterop=true,outputServices=generic-definitions,outputIndex=true,useOptionals=messages,useDate=false "cline/common.proto"`

	console.log("Command:", command)

	const result = execSync(command, {
		encoding: "utf8",
		stdio: ["pipe", "pipe", "pipe"],
	})

	console.log("Success! Output:", result)
} catch (error) {
	console.error("Error:", error.message)
	console.error("Status:", error.status)
	console.error("Signal:", error.signal)
	if (error.stdout) {
		console.error("Stdout:", error.stdout)
	}
	if (error.stderr) {
		console.error("Stderr:", error.stderr)
	}
}
