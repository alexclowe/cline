/**
 * TaskAnalyzer - Analyzes Cline tasks for complexity and execution strategy
 *
 * This component determines:
 * - Task complexity level (0.0 to 1.0)
 * - Required agent types and capabilities
 * - Estimated execution time and resources
 * - Optimal coordination strategy
 */

import { Logger } from "../services/logging/Logger"

export interface TaskAnalysis {
	complexity: number // 0.0 (simple) to 1.0 (highly complex)
	estimatedDuration: number // in minutes
	requiredAgentTypes: AgentType[]
	coordinationStrategy: CoordinationStrategy
	resourceRequirements: ResourceRequirements
	riskLevel: RiskLevel
	taskCategories: TaskCategory[]
}

export enum AgentType {
	CODER = "coder",
	PLANNER = "planner",
	RESEARCHER = "researcher",
	TESTER = "tester",
	REVIEWER = "reviewer",
	DOCUMENTATION = "documentation",
	DEBUGGER = "debugger",
	ARCHITECT = "architect",
}

export enum CoordinationStrategy {
	SINGLE_AGENT = "single",
	SEQUENTIAL = "sequential",
	PARALLEL = "parallel",
	PIPELINE = "pipeline",
	HIERARCHICAL = "hierarchical",
	SWARM = "swarm",
}

export enum RiskLevel {
	LOW = "low",
	MEDIUM = "medium",
	HIGH = "high",
	CRITICAL = "critical",
}

export enum TaskCategory {
	CODE_GENERATION = "code_generation",
	CODE_REFACTORING = "code_refactoring",
	BUG_FIXING = "bug_fixing",
	TESTING = "testing",
	DOCUMENTATION = "documentation",
	RESEARCH = "research",
	ARCHITECTURE = "architecture",
	DEPLOYMENT = "deployment",
	MAINTENANCE = "maintenance",
}

export interface ResourceRequirements {
	memoryMB: number
	cpuCores: number
	networkBandwidth: number
	apiCallsEstimate: number
	timeoutMinutes: number
}

export interface StrategyScores {
	sequential: number
	parallel: number
	pipeline: number
	hierarchical: number
	swarm: number
}

export interface StrategyRecommendation {
	recommendedStrategy: CoordinationStrategy
	confidence: number
	explanation: string
	alternativeStrategies: CoordinationStrategy[]
	scores: StrategyScores
}

export class TaskAnalyzer {
	private static readonly COMPLEXITY_WEIGHTS = {
		fileCount: 0.2,
		lineCount: 0.15,
		keywordComplexity: 0.25,
		domainSpecificity: 0.2,
		interdependencies: 0.2,
	}

	private static readonly COMPLEXITY_KEYWORDS = {
		high: [
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
			"neural network",
			"blockchain",
		],
		medium: [
			"refactor",
			"test",
			"integration",
			"api",
			"interface",
			"framework",
			"library",
			"configuration",
			"deployment",
			"monitoring",
		],
		low: ["fix", "update", "add", "remove", "modify", "format", "rename", "comment", "documentation", "style", "cleanup"],
	}

	/**
	 * Analyzes a task string and returns detailed analysis
	 */
	public static async analyzeTask(taskDescription: string, context?: TaskContext): Promise<TaskAnalysis> {
		Logger.log(`Analyzing task: ${taskDescription.substring(0, 100)}...`)

		const complexity = TaskAnalyzer.calculateComplexity(taskDescription, context)
		const categories = TaskAnalyzer.identifyTaskCategories(taskDescription)
		const agentTypes = TaskAnalyzer.determineRequiredAgents(categories, complexity)
		const strategy = TaskAnalyzer.selectCoordinationStrategy(complexity, agentTypes.length, categories, context)
		const resources = TaskAnalyzer.estimateResourceRequirements(complexity, agentTypes.length)
		const risk = TaskAnalyzer.assessRiskLevel(complexity, categories)
		const duration = TaskAnalyzer.estimateDuration(complexity, agentTypes.length, categories)

		const analysis: TaskAnalysis = {
			complexity,
			estimatedDuration: duration,
			requiredAgentTypes: agentTypes,
			coordinationStrategy: strategy,
			resourceRequirements: resources,
			riskLevel: risk,
			taskCategories: categories,
		}

		Logger.log(
			`Task analysis complete - Complexity: ${complexity.toFixed(2)}, Strategy: ${strategy}, Agents: ${agentTypes.length}`,
		)

		return analysis
	}

	/**
	 * Calculates task complexity based on multiple factors
	 */
	private static calculateComplexity(taskDescription: string, context?: TaskContext): number {
		let complexity = 0

		// Keyword-based complexity analysis
		const keywordScore = TaskAnalyzer.analyzeKeywords(taskDescription)
		complexity += keywordScore * TaskAnalyzer.COMPLEXITY_WEIGHTS.keywordComplexity

		// Length and detail analysis
		const lengthScore = Math.min(taskDescription.length / 1000, 1.0)
		complexity += lengthScore * TaskAnalyzer.COMPLEXITY_WEIGHTS.lineCount

		// Context-based complexity (if available)
		if (context) {
			const fileScore = Math.min(context.affectedFiles.length / 10, 1.0)
			complexity += fileScore * TaskAnalyzer.COMPLEXITY_WEIGHTS.fileCount

			const domainScore = TaskAnalyzer.analyzeDomainSpecificity(taskDescription, context)
			complexity += domainScore * TaskAnalyzer.COMPLEXITY_WEIGHTS.domainSpecificity

			const interdependencyScore = TaskAnalyzer.analyzeInterdependencies(context)
			complexity += interdependencyScore * TaskAnalyzer.COMPLEXITY_WEIGHTS.interdependencies
		}

		return Math.min(Math.max(complexity, 0.1), 1.0) // Clamp between 0.1 and 1.0
	}

	/**
	 * Analyzes keywords to determine complexity
	 */
	private static analyzeKeywords(text: string): number {
		const lowercaseText = text.toLowerCase()
		let score = 0

		// High complexity keywords
		const highMatches = TaskAnalyzer.COMPLEXITY_KEYWORDS.high.filter((keyword) => lowercaseText.includes(keyword)).length
		score += highMatches * 0.8

		// Medium complexity keywords
		const mediumMatches = TaskAnalyzer.COMPLEXITY_KEYWORDS.medium.filter((keyword) => lowercaseText.includes(keyword)).length
		score += mediumMatches * 0.5

		// Low complexity keywords (reduce score)
		const lowMatches = TaskAnalyzer.COMPLEXITY_KEYWORDS.low.filter((keyword) => lowercaseText.includes(keyword)).length
		score -= lowMatches * 0.2

		return Math.max(score / 10, 0) // Normalize
	}

	/**
	 * Identifies the categories this task falls into
	 */
	private static identifyTaskCategories(taskDescription: string): TaskCategory[] {
		const text = taskDescription.toLowerCase()
		const categories: TaskCategory[] = []

		if (text.includes("create") || text.includes("generate") || text.includes("implement")) {
			categories.push(TaskCategory.CODE_GENERATION)
		}
		if (text.includes("refactor") || text.includes("restructure") || text.includes("reorganize")) {
			categories.push(TaskCategory.CODE_REFACTORING)
		}
		if (text.includes("fix") || text.includes("bug") || text.includes("error") || text.includes("debug")) {
			categories.push(TaskCategory.BUG_FIXING)
		}
		if (text.includes("test") || text.includes("unittest") || text.includes("integration test")) {
			categories.push(TaskCategory.TESTING)
		}
		if (text.includes("document") || text.includes("readme") || text.includes("comment")) {
			categories.push(TaskCategory.DOCUMENTATION)
		}
		if (text.includes("research") || text.includes("analyze") || text.includes("investigate")) {
			categories.push(TaskCategory.RESEARCH)
		}
		if (text.includes("architect") || text.includes("design") || text.includes("structure")) {
			categories.push(TaskCategory.ARCHITECTURE)
		}
		if (text.includes("deploy") || text.includes("release") || text.includes("publish")) {
			categories.push(TaskCategory.DEPLOYMENT)
		}

		// Default to code generation if no specific categories identified
		if (categories.length === 0) {
			categories.push(TaskCategory.CODE_GENERATION)
		}

		return categories
	}

	/**
	 * Determines which agent types are needed based on task categories and complexity
	 */
	private static determineRequiredAgents(categories: TaskCategory[], complexity: number): AgentType[] {
		const agents: Set<AgentType> = new Set()

		// Always need a coder for most tasks
		agents.add(AgentType.CODER)

		// Add specialists based on categories
		categories.forEach((category) => {
			switch (category) {
				case TaskCategory.TESTING:
					agents.add(AgentType.TESTER)
					break
				case TaskCategory.DOCUMENTATION:
					agents.add(AgentType.DOCUMENTATION)
					break
				case TaskCategory.RESEARCH:
					agents.add(AgentType.RESEARCHER)
					break
				case TaskCategory.BUG_FIXING:
					agents.add(AgentType.DEBUGGER)
					break
				case TaskCategory.ARCHITECTURE:
					agents.add(AgentType.ARCHITECT)
					break
			}
		})

		// Add planner for complex tasks that need strategic planning
		if (complexity > 0.5 || categories.length > 2) {
			agents.add(AgentType.PLANNER)
		}

		// Add reviewer for complex tasks
		if (complexity > 0.6) {
			agents.add(AgentType.REVIEWER)
		}

		// Add researcher for highly complex tasks
		if (complexity > 0.8) {
			agents.add(AgentType.RESEARCHER)
		}

		return Array.from(agents)
	}

	/**
	 * Selects the optimal coordination strategy based on task characteristics
	 */
	private static selectCoordinationStrategy(
		complexity: number,
		agentCount: number,
		categories?: TaskCategory[],
		context?: TaskContext,
	): CoordinationStrategy {
		if (agentCount === 1) {
			return CoordinationStrategy.SINGLE_AGENT
		}

		// Strategy selection based on task characteristics
		const strategyScores = TaskAnalyzer.calculateStrategyScores(complexity, agentCount, categories, context)

		// Find the strategy with the highest score
		let bestStrategy = CoordinationStrategy.SEQUENTIAL
		let highestScore = strategyScores.sequential

		if (strategyScores.parallel > highestScore) {
			bestStrategy = CoordinationStrategy.PARALLEL
			highestScore = strategyScores.parallel
		}

		if (strategyScores.pipeline > highestScore) {
			bestStrategy = CoordinationStrategy.PIPELINE
			highestScore = strategyScores.pipeline
		}

		if (strategyScores.hierarchical > highestScore) {
			bestStrategy = CoordinationStrategy.HIERARCHICAL
			highestScore = strategyScores.hierarchical
		}

		if (strategyScores.swarm > highestScore) {
			bestStrategy = CoordinationStrategy.SWARM
			highestScore = strategyScores.swarm
		}

		Logger.log(`Strategy selection scores: ${JSON.stringify(strategyScores)}, Selected: ${bestStrategy}`)
		return bestStrategy
	}

	/**
	 * Calculates suitability scores for each coordination strategy
	 */
	private static calculateStrategyScores(
		complexity: number,
		agentCount: number,
		categories?: TaskCategory[],
		context?: TaskContext,
	): StrategyScores {
		const scores: StrategyScores = {
			sequential: 0,
			parallel: 0,
			pipeline: 0,
			hierarchical: 0,
			swarm: 0,
		}

		// Base scores based on complexity and agent count
		TaskAnalyzer.addComplexityScores(scores, complexity, agentCount)

		// Category-specific scores
		if (categories) {
			TaskAnalyzer.addCategoryScores(scores, categories)
		}

		// Context-specific scores
		if (context) {
			TaskAnalyzer.addContextScores(scores, context, complexity)
		}

		// Normalize scores
		const maxScore = Math.max(...Object.values(scores))
		if (maxScore > 0) {
			Object.keys(scores).forEach((key) => {
				scores[key as keyof StrategyScores] = scores[key as keyof StrategyScores] / maxScore
			})
		}

		return scores
	}

	/**
	 * Adds complexity-based scores for strategies
	 */
	private static addComplexityScores(scores: StrategyScores, complexity: number, agentCount: number): void {
		// Sequential: Good for simple, ordered tasks
		scores.sequential = (1 - complexity) * 0.8 + (agentCount <= 3 ? 0.5 : 0.2)

		// Parallel: Good for independent tasks with moderate complexity
		scores.parallel = complexity > 0.2 && complexity < 0.7 ? 0.8 : 0.3
		scores.parallel += agentCount >= 2 && agentCount <= 5 ? 0.4 : 0.1

		// Pipeline: Good for sequential data processing tasks
		scores.pipeline = complexity > 0.3 && complexity < 0.8 ? 0.7 : 0.2
		scores.pipeline += agentCount >= 3 && agentCount <= 6 ? 0.5 : 0.2

		// Hierarchical: Good for complex tasks requiring management
		scores.hierarchical = complexity > 0.5 ? 0.8 : 0.3
		scores.hierarchical += agentCount >= 4 ? 0.6 : 0.2

		// Swarm: Good for highly complex, adaptive tasks
		scores.swarm = complexity > 0.7 ? 1.0 : complexity * 0.5
		scores.swarm += agentCount >= 5 ? 0.7 : agentCount * 0.1
	}

	/**
	 * Adds category-specific scores for strategies
	 */
	private static addCategoryScores(scores: StrategyScores, categories: TaskCategory[]): void {
		categories.forEach((category) => {
			switch (category) {
				case TaskCategory.CODE_GENERATION:
					scores.sequential += 0.3
					scores.parallel += 0.4
					scores.pipeline += 0.5
					break

				case TaskCategory.CODE_REFACTORING:
					scores.sequential += 0.4
					scores.hierarchical += 0.3
					break

				case TaskCategory.BUG_FIXING:
					scores.sequential += 0.5
					scores.parallel += 0.2
					break

				case TaskCategory.TESTING:
					scores.parallel += 0.6
					scores.pipeline += 0.4
					break

				case TaskCategory.DOCUMENTATION:
					scores.sequential += 0.4
					scores.pipeline += 0.3
					break

				case TaskCategory.RESEARCH:
					scores.parallel += 0.5
					scores.swarm += 0.4
					break

				case TaskCategory.ARCHITECTURE:
					scores.hierarchical += 0.6
					scores.swarm += 0.3
					break

				case TaskCategory.DEPLOYMENT:
					scores.sequential += 0.5
					scores.hierarchical += 0.4
					break

				case TaskCategory.MAINTENANCE:
					scores.sequential += 0.3
					scores.parallel += 0.2
					break
			}
		})
	}

	/**
	 * Adds context-specific scores for strategies
	 */
	private static addContextScores(scores: StrategyScores, context: TaskContext, complexity: number): void {
		const fileCount = context.affectedFiles.length
		const hasImports = (context.imports?.length || 0) > 0

		// Many files suggest need for coordination
		if (fileCount > 5) {
			scores.hierarchical += 0.3
			scores.swarm += 0.2
		}

		// Complex interdependencies suggest pipeline or hierarchical
		if (hasImports && fileCount > 3) {
			scores.pipeline += 0.4
			scores.hierarchical += 0.3
		}

		// High complexity with many dependencies suggests swarm
		if (complexity > 0.6 && fileCount > 7) {
			scores.swarm += 0.5
		}

		// Simple file operations can be parallelized
		if (fileCount <= 5 && complexity < 0.5) {
			scores.parallel += 0.3
		}
	}

	/**
	 * Gets recommended strategy with explanation
	 */
	public static getStrategyRecommendation(task: string, context?: TaskContext): StrategyRecommendation {
		const categories = TaskAnalyzer.identifyTaskCategories(task)
		const complexity = TaskAnalyzer.calculateComplexity(task, context)
		const agentTypes = TaskAnalyzer.determineRequiredAgents(categories, complexity)
		const strategy = TaskAnalyzer.selectCoordinationStrategy(complexity, agentTypes.length, categories, context)
		const scores = TaskAnalyzer.calculateStrategyScores(complexity, agentTypes.length, categories, context)

		return {
			recommendedStrategy: strategy,
			confidence: Math.max(...Object.values(scores)),
			explanation: TaskAnalyzer.generateStrategyExplanation(strategy, complexity, agentTypes.length, categories),
			alternativeStrategies: TaskAnalyzer.getAlternativeStrategies(scores, strategy),
			scores,
		}
	}

	/**
	 * Generates explanation for strategy selection
	 */
	private static generateStrategyExplanation(
		strategy: CoordinationStrategy,
		complexity: number,
		agentCount: number,
		categories: TaskCategory[],
	): string {
		const complexityDesc = complexity < 0.3 ? "low" : complexity < 0.7 ? "medium" : "high"
		const categoryDesc = categories.join(", ")

		switch (strategy) {
			case CoordinationStrategy.SEQUENTIAL:
				return `Sequential strategy selected for ${complexityDesc} complexity task (${categoryDesc}) with ${agentCount} agents. Tasks will be executed in order with dependencies.`

			case CoordinationStrategy.PARALLEL:
				return `Parallel strategy selected for ${complexityDesc} complexity task (${categoryDesc}) with ${agentCount} agents. Independent tasks will be executed simultaneously.`

			case CoordinationStrategy.PIPELINE:
				return `Pipeline strategy selected for ${complexityDesc} complexity task (${categoryDesc}) with ${agentCount} agents. Data will flow through processing stages.`

			case CoordinationStrategy.HIERARCHICAL:
				return `Hierarchical strategy selected for ${complexityDesc} complexity task (${categoryDesc}) with ${agentCount} agents. Master-worker delegation will manage complexity.`

			case CoordinationStrategy.SWARM:
				return `Swarm strategy selected for ${complexityDesc} complexity task (${categoryDesc}) with ${agentCount} agents. Distributed coordination will handle adaptive requirements.`

			default:
				return `Single agent strategy selected for simple task.`
		}
	}

	/**
	 * Gets alternative strategies in order of preference
	 */
	private static getAlternativeStrategies(
		scores: StrategyScores,
		selectedStrategy: CoordinationStrategy,
	): CoordinationStrategy[] {
		const alternatives = Object.entries(scores)
			.filter(([strategy]) => strategy !== selectedStrategy)
			.sort(([, a], [, b]) => b - a)
			.map(([strategy]) => strategy as CoordinationStrategy)

		return alternatives.slice(0, 2) // Return top 2 alternatives
	}

	/**
	 * Estimates resource requirements
	 */
	private static estimateResourceRequirements(complexity: number, agentCount: number): ResourceRequirements {
		const baseMemory = 100 // MB
		const baseCpu = 1
		const baseBandwidth = 1 // Mbps
		const baseApiCalls = 10
		const baseTimeout = 5 // minutes

		const complexityMultiplier = 1 + complexity * 2
		const agentMultiplier = Math.sqrt(agentCount)

		return {
			memoryMB: Math.ceil(baseMemory * complexityMultiplier * agentMultiplier),
			cpuCores: Math.ceil(baseCpu * complexityMultiplier),
			networkBandwidth: Math.ceil(baseBandwidth * complexityMultiplier),
			apiCallsEstimate: Math.ceil(baseApiCalls * complexityMultiplier * agentCount),
			timeoutMinutes: Math.ceil(baseTimeout * complexityMultiplier * agentMultiplier),
		}
	}

	/**
	 * Assesses the risk level of the task
	 */
	private static assessRiskLevel(complexity: number, categories: TaskCategory[]): RiskLevel {
		let riskScore = complexity

		// Increase risk for certain categories
		if (categories.includes(TaskCategory.ARCHITECTURE)) {
			riskScore += 0.2
		}
		if (categories.includes(TaskCategory.DEPLOYMENT)) {
			riskScore += 0.3
		}
		if (categories.includes(TaskCategory.CODE_REFACTORING)) {
			riskScore += 0.1
		}

		if (riskScore < 0.3) {
			return RiskLevel.LOW
		}
		if (riskScore < 0.6) {
			return RiskLevel.MEDIUM
		}
		if (riskScore < 0.8) {
			return RiskLevel.HIGH
		}
		return RiskLevel.CRITICAL
	}

	/**
	 * Estimates task duration in minutes
	 */
	private static estimateDuration(complexity: number, agentCount: number, categories: TaskCategory[]): number {
		const baseDuration = 10 // minutes
		const complexityMultiplier = 1 + complexity * 5
		const categoryMultiplier = categories.length * 0.5

		// More agents can reduce time through parallelization, but with diminishing returns
		const agentEfficiency = agentCount > 1 ? Math.log(agentCount) + 1 : 1

		return Math.ceil((baseDuration * complexityMultiplier * categoryMultiplier) / agentEfficiency)
	}

	/**
	 * Analyzes domain specificity (requires context)
	 */
	private static analyzeDomainSpecificity(taskDescription: string, _context: TaskContext): number {
		// Check for domain-specific terms and technologies
		const domainKeywords = [
			"react",
			"vue",
			"angular",
			"node.js",
			"python",
			"java",
			"c#",
			"rust",
			"docker",
			"kubernetes",
			"aws",
			"azure",
			"gcp",
			"terraform",
			"mongodb",
			"postgresql",
			"redis",
			"elasticsearch",
		]

		const text = taskDescription.toLowerCase()
		const matches = domainKeywords.filter((keyword) => text.includes(keyword)).length

		return Math.min(matches / 5, 1.0)
	}

	/**
	 * Analyzes interdependencies (requires context)
	 */
	private static analyzeInterdependencies(context: TaskContext): number {
		// Simple heuristic based on file count and import relationships
		const fileCount = context.affectedFiles.length
		const importCount = context.imports?.length || 0

		return Math.min((fileCount + importCount) / 20, 1.0)
	}
}

/**
 * Additional context about the task (optional)
 */
export interface TaskContext {
	affectedFiles: string[]
	imports?: string[]
	codeMetrics?: {
		totalLines: number
		complexity: number
		testCoverage: number
	}
	dependencies?: string[]
	environment?: string
}
