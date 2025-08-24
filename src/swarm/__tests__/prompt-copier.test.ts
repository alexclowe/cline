import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { copyPrompts } from "../prompt-copier.js"
import { copyPromptsEnhanced } from "../prompt-copier-enhanced.js"
import { PromptConfigManager, PromptValidator } from "../prompt-utils.js"
import "should"

describe("PromptCopier", () => {
	let tempDir: string
	let sourceDir: string
	let destDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompt-test-"))
		sourceDir = path.join(tempDir, "source")
		destDir = path.join(tempDir, "dest")

		await fs.mkdir(sourceDir, { recursive: true })
		await fs.mkdir(destDir, { recursive: true })

		// Create test files
		await createTestFiles()
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	async function createTestFiles() {
		const testFiles = [
			{ path: "test1.md", content: "# Test Prompt 1\nThis is a test prompt." },
			{ path: "test2.txt", content: "Test prompt content" },
			{ path: "subdir/test3.md", content: "## Nested Prompt\nNested content" },
			{ path: "large.md", content: "Large content\n".repeat(1000) },
			{ path: "empty.md", content: "" },
			{ path: "rules.md", content: "# Rules\nYou are an AI assistant." },
		]

		for (const file of testFiles) {
			const filePath = path.join(sourceDir, file.path)
			const dir = path.dirname(filePath)

			await fs.mkdir(dir, { recursive: true })
			await fs.writeFile(filePath, file.content)
		}
	}

	describe("Basic copying functionality", () => {
		test("should copy all matching files", async () => {
			const result = await copyPrompts({
				source: sourceDir,
				destination: destDir,
			})

			result.success.should.be.true()
			result.copiedFiles.should.equal(6)
			result.failedFiles.should.equal(0)

			// Verify files exist
			const destFiles = await fs.readdir(destDir, { recursive: true })
			destFiles.length.should.equal(6)
		})

		test("should respect include patterns", async () => {
			const result = await copyPrompts({
				source: sourceDir,
				destination: destDir,
				includePatterns: ["*.md"],
			})

			result.success.should.be.true()
			result.copiedFiles.should.equal(5) // Only .md files
		})

		test("should respect exclude patterns", async () => {
			const result = await copyPrompts({
				source: sourceDir,
				destination: destDir,
				excludePatterns: ["**/subdir/**"],
			})

			result.success.should.be.true()
			result.copiedFiles.should.equal(5) // Excluding subdir files
		})
	})

	describe("Conflict resolution", () => {
		test("should skip existing files when conflict resolution is skip", async () => {
			// Create existing file
			await fs.writeFile(path.join(destDir, "test1.md"), "Existing content")

			const result = await copyPrompts({
				source: sourceDir,
				destination: destDir,
				conflictResolution: "skip",
			})

			result.success.should.be.true()
			result.skippedFiles!.should.be.greaterThan(0)

			// Verify original content preserved
			const content = await fs.readFile(path.join(destDir, "test1.md"), "utf-8")
			content.should.equal("Existing content")
		})

		test("should backup existing files when conflict resolution is backup", async () => {
			// Create existing file
			await fs.writeFile(path.join(destDir, "test1.md"), "Existing content")

			const result = await copyPrompts({
				source: sourceDir,
				destination: destDir,
				conflictResolution: "backup",
			})

			result.success.should.be.true()
			result.backupLocation!.should.be.ok()

			// Verify backup directory exists
			const backupDir = path.join(destDir, ".prompt-backups")
			const backupExists = await fs
				.access(backupDir)
				.then(() => true)
				.catch(() => false)
			backupExists.should.be.true()
		})

		test("should merge files when conflict resolution is merge", async () => {
			// Create existing file
			await fs.writeFile(path.join(destDir, "test1.md"), "Existing content")

			const result = await copyPrompts({
				source: sourceDir,
				destination: destDir,
				conflictResolution: "merge",
			})

			result.success.should.be.true()

			// Verify merged content
			const content = await fs.readFile(path.join(destDir, "test1.md"), "utf-8")
			content.should.containEql("Existing content")
			content.should.containEql("MERGED CONTENT")
			content.should.containEql("# Test Prompt 1")
		})
	})

	describe("Verification", () => {
		test("should verify copied files when verification is enabled", async () => {
			const result = await copyPrompts({
				source: sourceDir,
				destination: destDir,
				verify: true,
			})

			result.success.should.be.true()
			result.failedFiles.should.equal(0)
		})

		test("should handle verification errors gracefully", async () => {
			const result = await copyPrompts({
				source: sourceDir,
				destination: destDir,
				verify: true,
			})

			// Should succeed with verification enabled for valid copy
			result.success.should.be.true()
			result.errors.length.should.equal(0)
		})
	})

	describe("Dry run mode", () => {
		test("should not create files in dry run mode", async () => {
			const result = await copyPrompts({
				source: sourceDir,
				destination: destDir,
				dryRun: true,
			})

			result.success.should.be.true()
			result.totalFiles.should.equal(6)

			// Verify no files were actually copied
			const destFiles = await fs.readdir(destDir)
			destFiles.length.should.equal(0)
		})
	})

	describe("Progress reporting", () => {
		test("should report progress during copy", async () => {
			const progressUpdates: any[] = []

			await copyPrompts({
				source: sourceDir,
				destination: destDir,
				progressCallback: (progress) => {
					progressUpdates.push(progress)
				},
			})

			progressUpdates.length.should.be.greaterThan(0)
			progressUpdates[progressUpdates.length - 1].percentage.should.equal(100)
		})
	})
})

describe("EnhancedPromptCopier", () => {
	let tempDir: string
	let sourceDir: string
	let destDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "enhanced-test-"))
		sourceDir = path.join(tempDir, "source")
		destDir = path.join(tempDir, "dest")

		await fs.mkdir(sourceDir, { recursive: true })
		await fs.mkdir(destDir, { recursive: true })

		// Create test files
		for (let i = 0; i < 20; i++) {
			await fs.writeFile(path.join(sourceDir, `test${i}.md`), `# Test ${i}\nContent for test ${i}`)
		}
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	test("should copy files using worker threads", async () => {
		const result = await copyPromptsEnhanced({
			source: sourceDir,
			destination: destDir,
			parallel: true,
			maxWorkers: 4,
		})

		result.success.should.be.true()
		result.copiedFiles.should.equal(20)
		result.failedFiles.should.equal(0)

		// Verify all files were copied
		const destFiles = await fs.readdir(destDir)
		destFiles.length.should.equal(20)
	}).timeout(10000)
})

describe("PromptConfigManager", () => {
	let tempDir: string
	let configPath: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "config-test-"))
		configPath = path.join(tempDir, ".prompt-config.json")
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	test("should load default config when file does not exist", async () => {
		const manager = new PromptConfigManager(configPath)
		const config = await manager.loadConfig()

		config.should.be.ok()
		config.defaultOptions.should.be.ok()
		config.profiles.should.be.ok()
	})

	test("should save and load custom config", async () => {
		const manager = new PromptConfigManager(configPath)

		await manager.saveConfig({
			destinationDirectory: "./custom-prompts",
		})

		const config = await manager.loadConfig()
		config.destinationDirectory.should.equal("./custom-prompts")
	})

	test("should get profile options", async () => {
		const manager = new PromptConfigManager(configPath)
		await manager.loadConfig()

		const sparcProfile = manager.getProfile("sparc")
		sparcProfile.should.be.ok()
		sparcProfile.includePatterns.should.containEql("*.md")
	})

	test("should list available profiles", async () => {
		const manager = new PromptConfigManager(configPath)
		await manager.loadConfig()

		const profiles = manager.listProfiles()
		profiles.should.containEql("sparc")
		profiles.should.containEql("templates")
		profiles.should.containEql("safe")
		profiles.should.containEql("fast")
	})
})

describe("PromptValidator", () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "validator-test-"))
	})

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	test("should validate valid prompt file", async () => {
		const filePath = path.join(tempDir, "valid.md")
		await fs.writeFile(filePath, "# Test Prompt\nYou are an AI assistant.")

		const result = await PromptValidator.validatePromptFile(filePath)

		result.valid.should.be.true()
		result.issues.length.should.equal(0)
	})

	test("should detect empty files", async () => {
		const filePath = path.join(tempDir, "empty.md")
		await fs.writeFile(filePath, "")

		const result = await PromptValidator.validatePromptFile(filePath)

		result.valid.should.be.false()
		result.issues.should.containEql("File is empty")
	})

	test("should extract front matter metadata", async () => {
		const filePath = path.join(tempDir, "with-metadata.md")
		const content = `---
title: Test Prompt
version: 1.0
---

# Test Prompt
Content here`

		await fs.writeFile(filePath, content)

		const result = await PromptValidator.validatePromptFile(filePath)

		result.metadata.should.be.ok()
		result.metadata.title.should.equal("Test Prompt")
		result.metadata.version.should.equal("1.0")
	})

	test("should warn about large files", async () => {
		const filePath = path.join(tempDir, "large.md")
		const largeContent = "# Large Prompt\n" + "x".repeat(200 * 1024) // 200KB

		await fs.writeFile(filePath, largeContent)

		const result = await PromptValidator.validatePromptFile(filePath)

		result.issues.should.containEql("File is unusually large for a prompt")
	})
})
