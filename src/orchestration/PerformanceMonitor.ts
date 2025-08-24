/**
 * Performance Monitor for Claude-Flow Orchestration
 *
 * Provides performance monitoring, optimization, and resource management
 * for the orchestration system to ensure efficient operation.
 */

export interface PerformanceMetrics {
	taskId: string
	startTime: number
	endTime?: number
	duration?: number
	memoryUsage: number
	cpuUsage: number
	agentsUsed: number
	coordinationStrategy: string
	complexityScore: number
	success: boolean
	errorCount: number
	optimizationSuggestions: string[]
}

export interface ResourceLimits {
	maxMemoryMB: number
	maxConcurrentAgents: number
	maxExecutionTimeMs: number
	cpuThrottleThreshold: number
}

export interface OptimizationConfig {
	enableAutoOptimization: boolean
	performanceThreshold: number
	memoryThreshold: number
	adaptiveAgentScaling: boolean
	intelligentCaching: boolean
}

export class PerformanceMonitor {
	private metrics: Map<string, PerformanceMetrics> = new Map()
	private resourceLimits: ResourceLimits
	private optimizationConfig: OptimizationConfig
	private performanceHistory: PerformanceMetrics[] = []
	private startTime = Date.now()

	constructor(resourceLimits: ResourceLimits, optimizationConfig: OptimizationConfig) {
		this.resourceLimits = resourceLimits
		this.optimizationConfig = optimizationConfig
	}

	/**
	 * Start monitoring a task
	 */
	startTask(taskId: string, coordinationStrategy: string, complexityScore: number, agentsUsed: number): void {
		const metric: PerformanceMetrics = {
			taskId,
			startTime: Date.now(),
			memoryUsage: this.getCurrentMemoryUsage(),
			cpuUsage: this.getCurrentCpuUsage(),
			agentsUsed,
			coordinationStrategy,
			complexityScore,
			success: false,
			errorCount: 0,
			optimizationSuggestions: [],
		}

		this.metrics.set(taskId, metric)
	}

	/**
	 * Complete monitoring a task
	 */
	completeTask(taskId: string, success: boolean, errorCount: number = 0): PerformanceMetrics | null {
		const metric = this.metrics.get(taskId)
		if (!metric) {
			return null
		}

		const endTime = Date.now()
		metric.endTime = endTime
		metric.duration = endTime - metric.startTime
		metric.success = success
		metric.errorCount = errorCount
		metric.optimizationSuggestions = this.generateOptimizationSuggestions(metric)

		// Add to history
		this.performanceHistory.push({ ...metric })

		// Remove from active monitoring
		this.metrics.delete(taskId)

		// Trigger auto-optimization if enabled
		if (this.optimizationConfig.enableAutoOptimization) {
			this.performAutoOptimization(metric)
		}

		return metric
	}

	/**
	 * Check if resource limits are exceeded
	 */
	checkResourceLimits(): {
		withinLimits: boolean
		violations: string[]
		recommendations: string[]
	} {
		const violations: string[] = []
		const recommendations: string[] = []

		const currentMemory = this.getCurrentMemoryUsage()
		const _activeTaskCount = this.metrics.size
		const longestRunningTask = this.getLongestRunningTask()

		// Check memory limits
		if (currentMemory > this.resourceLimits.maxMemoryMB) {
			violations.push(`Memory usage (${currentMemory}MB) exceeds limit (${this.resourceLimits.maxMemoryMB}MB)`)
			recommendations.push("Consider reducing concurrent agents or enabling intelligent caching")
		}

		// Check concurrent agents
		const totalAgents = Array.from(this.metrics.values()).reduce((sum, metric) => sum + metric.agentsUsed, 0)
		if (totalAgents > this.resourceLimits.maxConcurrentAgents) {
			violations.push(`Concurrent agents (${totalAgents}) exceeds limit (${this.resourceLimits.maxConcurrentAgents})`)
			recommendations.push("Enable adaptive agent scaling or increase resource limits")
		}

		// Check execution time
		if (longestRunningTask && longestRunningTask.duration > this.resourceLimits.maxExecutionTimeMs) {
			violations.push(`Task execution time exceeds limit`)
			recommendations.push("Consider breaking down complex tasks or increasing timeout limits")
		}

		return {
			withinLimits: violations.length === 0,
			violations,
			recommendations,
		}
	}

	/**
	 * Get performance summary
	 */
	getPerformanceSummary(): {
		totalTasks: number
		successRate: number
		averageDuration: number
		averageMemoryUsage: number
		averageAgentsUsed: number
		topPerformingStrategy: string
		optimizationOpportunities: string[]
	} {
		if (this.performanceHistory.length === 0) {
			return {
				totalTasks: 0,
				successRate: 0,
				averageDuration: 0,
				averageMemoryUsage: 0,
				averageAgentsUsed: 0,
				topPerformingStrategy: "none",
				optimizationOpportunities: [],
			}
		}

		const successfulTasks = this.performanceHistory.filter((m) => m.success)
		const successRate = successfulTasks.length / this.performanceHistory.length

		const averageDuration =
			this.performanceHistory.reduce((sum, m) => sum + (m.duration || 0), 0) / this.performanceHistory.length
		const averageMemoryUsage =
			this.performanceHistory.reduce((sum, m) => sum + m.memoryUsage, 0) / this.performanceHistory.length
		const averageAgentsUsed =
			this.performanceHistory.reduce((sum, m) => sum + m.agentsUsed, 0) / this.performanceHistory.length

		// Find top performing strategy
		const strategyPerformance = new Map<string, { count: number; successRate: number; avgDuration: number }>()

		for (const metric of this.performanceHistory) {
			const strategy = metric.coordinationStrategy
			if (!strategyPerformance.has(strategy)) {
				strategyPerformance.set(strategy, { count: 0, successRate: 0, avgDuration: 0 })
			}

			const perf = strategyPerformance.get(strategy)!
			perf.count++
			perf.successRate = (perf.successRate * (perf.count - 1) + (metric.success ? 1 : 0)) / perf.count
			perf.avgDuration = (perf.avgDuration * (perf.count - 1) + (metric.duration || 0)) / perf.count
		}

		let topPerformingStrategy = "none"
		let bestScore = 0

		for (const [strategy, perf] of strategyPerformance.entries()) {
			// Score based on success rate and efficiency (inverse of duration)
			const score = perf.successRate * (10000 / (perf.avgDuration + 1000))
			if (score > bestScore) {
				bestScore = score
				topPerformingStrategy = strategy
			}
		}

		const optimizationOpportunities = this.identifyOptimizationOpportunities()

		return {
			totalTasks: this.performanceHistory.length,
			successRate,
			averageDuration,
			averageMemoryUsage,
			averageAgentsUsed,
			topPerformingStrategy,
			optimizationOpportunities,
		}
	}

	/**
	 * Get real-time performance status
	 */
	getRealTimeStatus(): {
		activeTasks: number
		currentMemoryUsage: number
		currentCpuUsage: number
		totalAgentsActive: number
		systemHealth: "healthy" | "warning" | "critical"
		uptime: number
	} {
		const activeTasks = this.metrics.size
		const currentMemoryUsage = this.getCurrentMemoryUsage()
		const currentCpuUsage = this.getCurrentCpuUsage()
		const totalAgentsActive = Array.from(this.metrics.values()).reduce((sum, metric) => sum + metric.agentsUsed, 0)
		const uptime = Date.now() - this.startTime

		let systemHealth: "healthy" | "warning" | "critical" = "healthy"

		if (
			currentMemoryUsage > this.resourceLimits.maxMemoryMB * 0.9 ||
			totalAgentsActive > this.resourceLimits.maxConcurrentAgents * 0.9 ||
			currentCpuUsage > this.resourceLimits.cpuThrottleThreshold
		) {
			systemHealth = "critical"
		} else if (
			currentMemoryUsage > this.resourceLimits.maxMemoryMB * 0.7 ||
			totalAgentsActive > this.resourceLimits.maxConcurrentAgents * 0.7 ||
			currentCpuUsage > this.resourceLimits.cpuThrottleThreshold * 0.8
		) {
			systemHealth = "warning"
		}

		return {
			activeTasks,
			currentMemoryUsage,
			currentCpuUsage,
			totalAgentsActive,
			systemHealth,
			uptime,
		}
	}

	/**
	 * Optimize performance based on historical data
	 */
	optimizePerformance(): {
		recommendations: string[]
		appliedOptimizations: string[]
		estimatedImprovement: number
	} {
		const summary = this.getPerformanceSummary()
		const recommendations: string[] = []
		const appliedOptimizations: string[] = []
		let estimatedImprovement = 0

		// Memory optimization
		if (summary.averageMemoryUsage > this.resourceLimits.maxMemoryMB * 0.8) {
			recommendations.push("Enable intelligent caching to reduce memory usage")
			if (this.optimizationConfig.intelligentCaching) {
				appliedOptimizations.push("Intelligent caching enabled")
				estimatedImprovement += 0.2
			}
		}

		// Agent scaling optimization
		if (summary.averageAgentsUsed > this.resourceLimits.maxConcurrentAgents * 0.8) {
			recommendations.push("Implement adaptive agent scaling")
			if (this.optimizationConfig.adaptiveAgentScaling) {
				appliedOptimizations.push("Adaptive agent scaling enabled")
				estimatedImprovement += 0.15
			}
		}

		// Strategy optimization
		if (summary.successRate < this.optimizationConfig.performanceThreshold) {
			recommendations.push(`Consider using ${summary.topPerformingStrategy} strategy more frequently`)
			estimatedImprovement += 0.1
		}

		return {
			recommendations,
			appliedOptimizations,
			estimatedImprovement,
		}
	}

	/**
	 * Reset performance history
	 */
	resetHistory(): void {
		this.performanceHistory = []
	}

	/**
	 * Export performance data for analysis
	 */
	exportPerformanceData(): {
		summary: any
		history: PerformanceMetrics[]
		configuration: {
			resourceLimits: ResourceLimits
			optimizationConfig: OptimizationConfig
		}
	} {
		return {
			summary: this.getPerformanceSummary(),
			history: [...this.performanceHistory],
			configuration: {
				resourceLimits: this.resourceLimits,
				optimizationConfig: this.optimizationConfig,
			},
		}
	}

	// Private helper methods

	private getCurrentMemoryUsage(): number {
		// In a real implementation, this would get actual memory usage
		// For testing, return a simulated value
		const baseUsage = 128 // Base 128MB
		const activeTaskMemory = this.metrics.size * 64 // 64MB per active task
		return baseUsage + activeTaskMemory
	}

	private getCurrentCpuUsage(): number {
		// In a real implementation, this would get actual CPU usage
		// For testing, return a simulated value based on active tasks
		const baseCpu = 5 // Base 5% CPU
		const taskCpu = this.metrics.size * 10 // 10% per active task
		return Math.min(baseCpu + taskCpu, 100)
	}

	private getLongestRunningTask(): (PerformanceMetrics & { duration: number }) | null {
		let longest: (PerformanceMetrics & { duration: number }) | null = null
		const currentTime = Date.now()

		for (const metric of this.metrics.values()) {
			const duration = currentTime - metric.startTime
			if (!longest || duration > longest.duration) {
				longest = { ...metric, duration }
			}
		}

		return longest
	}

	private generateOptimizationSuggestions(metric: PerformanceMetrics): string[] {
		const suggestions: string[] = []

		// Duration-based suggestions
		if (metric.duration && metric.duration > 300000) {
			// 5 minutes
			suggestions.push("Consider breaking down this task into smaller subtasks")
		}

		// Memory-based suggestions
		if (metric.memoryUsage > this.resourceLimits.maxMemoryMB * 0.8) {
			suggestions.push("High memory usage detected - consider reducing agent count")
		}

		// Agent-based suggestions
		if (metric.agentsUsed > 4) {
			suggestions.push("Large number of agents used - verify coordination efficiency")
		}

		// Complexity-based suggestions
		if (metric.complexityScore > 0.8 && !metric.success) {
			suggestions.push("High complexity task failed - consider using hierarchical coordination")
		}

		// Error-based suggestions
		if (metric.errorCount > 2) {
			suggestions.push("Multiple errors detected - review error handling and retry logic")
		}

		return suggestions
	}

	private performAutoOptimization(metric: PerformanceMetrics): void {
		if (!this.optimizationConfig.enableAutoOptimization) {
			return
		}

		// Auto-optimize based on performance patterns
		if (metric.duration && metric.duration > 600000) {
			// 10 minutes
			console.log(`[Performance Monitor] Auto-optimization: Long running task detected (${metric.taskId})`)
		}

		if (metric.memoryUsage > this.resourceLimits.maxMemoryMB * 0.9) {
			console.log(`[Performance Monitor] Auto-optimization: High memory usage detected (${metric.taskId})`)
		}
	}

	private identifyOptimizationOpportunities(): string[] {
		const opportunities: string[] = []

		if (this.performanceHistory.length < 5) {
			return ["Insufficient data for optimization analysis"]
		}

		const recentTasks = this.performanceHistory.slice(-10)
		const avgDuration = recentTasks.reduce((sum, m) => sum + (m.duration || 0), 0) / recentTasks.length
		const avgMemory = recentTasks.reduce((sum, m) => sum + m.memoryUsage, 0) / recentTasks.length
		const failureRate = recentTasks.filter((m) => !m.success).length / recentTasks.length

		if (avgDuration > 300000) {
			// 5 minutes
			opportunities.push("Average task duration is high - consider performance optimization")
		}

		if (avgMemory > this.resourceLimits.maxMemoryMB * 0.7) {
			opportunities.push("Average memory usage is high - consider memory optimization")
		}

		if (failureRate > 0.2) {
			// 20% failure rate
			opportunities.push("High failure rate detected - review error handling")
		}

		// Strategy-specific optimizations
		const strategyStats = new Map<string, { count: number; avgDuration: number; successRate: number }>()

		for (const task of recentTasks) {
			const strategy = task.coordinationStrategy
			if (!strategyStats.has(strategy)) {
				strategyStats.set(strategy, { count: 0, avgDuration: 0, successRate: 0 })
			}

			const stats = strategyStats.get(strategy)!
			stats.count++
			stats.avgDuration = (stats.avgDuration * (stats.count - 1) + (task.duration || 0)) / stats.count
			stats.successRate = (stats.successRate * (stats.count - 1) + (task.success ? 1 : 0)) / stats.count
		}

		for (const [strategy, stats] of strategyStats.entries()) {
			if (stats.successRate < 0.8 && stats.count >= 3) {
				opportunities.push(`${strategy} strategy has low success rate (${(stats.successRate * 100).toFixed(1)}%)`)
			}
		}

		return opportunities
	}
}

export default PerformanceMonitor
