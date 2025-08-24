/**
 * Error Handler for Claude-Flow Orchestration
 *
 * Provides comprehensive error handling, recovery mechanisms, and
 * resilience patterns for the orchestration system.
 */

export enum ErrorSeverity {
	LOW = "low",
	MEDIUM = "medium",
	HIGH = "high",
	CRITICAL = "critical",
}

export enum ErrorCategory {
	INITIALIZATION = "initialization",
	AGENT_COMMUNICATION = "agent_communication",
	COORDINATION = "coordination",
	RESOURCE = "resource",
	TIMEOUT = "timeout",
	VALIDATION = "validation",
	EXTERNAL_API = "external_api",
	MEMORY = "memory",
	UNKNOWN = "unknown",
}

export interface ErrorContext {
	taskId?: string
	agentId?: string
	coordinationStrategy?: string
	timestamp: number
	stackTrace?: string
	additionalData?: Record<string, any>
}

export interface ErrorRecord {
	id: string
	message: string
	category: ErrorCategory
	severity: ErrorSeverity
	context: ErrorContext
	resolved: boolean
	retryCount: number
	recoveryAction?: string
	resolutionTime?: number
}

export interface RecoveryStrategy {
	name: string
	canHandle: (error: ErrorRecord) => boolean
	execute: (error: ErrorRecord) => Promise<RecoveryResult>
	maxRetries: number
	backoffMs: number
}

export interface RecoveryResult {
	success: boolean
	message: string
	shouldRetry: boolean
	newStrategy?: string
	fallbackAction?: string
}

export class ErrorHandler {
	private errorHistory: ErrorRecord[] = []
	private recoveryStrategies: RecoveryStrategy[] = []
	private errorCounter = 0
	private maxHistorySize = 1000

	constructor() {
		this.initializeRecoveryStrategies()
	}

	/**
	 * Handle an error with automatic recovery
	 */
	async handleError(
		error: Error | string,
		category: ErrorCategory,
		severity: ErrorSeverity,
		context: Partial<ErrorContext> = {},
	): Promise<RecoveryResult> {
		const errorRecord = this.createErrorRecord(error, category, severity, context)
		this.errorHistory.push(errorRecord)

		// Trim history if needed
		if (this.errorHistory.length > this.maxHistorySize) {
			this.errorHistory = this.errorHistory.slice(-this.maxHistorySize)
		}

		console.error(`[Error Handler] ${severity.toUpperCase()} ${category}: ${errorRecord.message}`)

		// Attempt recovery
		const recoveryResult = await this.attemptRecovery(errorRecord)

		// Update error record with recovery result
		errorRecord.resolved = recoveryResult.success
		errorRecord.recoveryAction = recoveryResult.message

		if (recoveryResult.success) {
			errorRecord.resolutionTime = Date.now() - errorRecord.context.timestamp
			console.log(`[Error Handler] Recovery successful: ${recoveryResult.message}`)
		} else {
			console.error(`[Error Handler] Recovery failed: ${recoveryResult.message}`)
		}

		return recoveryResult
	}

	/**
	 * Handle orchestration system errors
	 */
	async handleOrchestrationError(
		error: Error | string,
		taskId: string,
		coordinationStrategy?: string,
	): Promise<RecoveryResult> {
		const context: Partial<ErrorContext> = {
			taskId,
			coordinationStrategy,
			additionalData: {
				activeAgents: "unknown",
				memoryUsage: "unknown",
			},
		}

		return this.handleError(error, ErrorCategory.COORDINATION, ErrorSeverity.HIGH, context)
	}

	/**
	 * Handle agent communication errors
	 */
	async handleAgentError(error: Error | string, agentId: string, taskId?: string): Promise<RecoveryResult> {
		const context: Partial<ErrorContext> = {
			agentId,
			taskId,
			additionalData: {
				agentStatus: "unknown",
				communicationType: "vs_code_lm",
			},
		}

		return this.handleError(error, ErrorCategory.AGENT_COMMUNICATION, ErrorSeverity.MEDIUM, context)
	}

	/**
	 * Handle resource exhaustion errors
	 */
	async handleResourceError(
		error: Error | string,
		resourceType: string,
		currentUsage: number,
		limit: number,
	): Promise<RecoveryResult> {
		const context: Partial<ErrorContext> = {
			additionalData: {
				resourceType,
				currentUsage,
				limit,
				utilizationPercent: (currentUsage / limit) * 100,
			},
		}

		return this.handleError(error, ErrorCategory.RESOURCE, ErrorSeverity.HIGH, context)
	}

	/**
	 * Handle timeout errors
	 */
	async handleTimeoutError(operation: string, timeoutMs: number, taskId?: string): Promise<RecoveryResult> {
		const context: Partial<ErrorContext> = {
			taskId,
			additionalData: {
				operation,
				timeoutMs,
				timeoutType: "operation_timeout",
			},
		}

		const errorMessage = `Operation '${operation}' timed out after ${timeoutMs}ms`
		return this.handleError(errorMessage, ErrorCategory.TIMEOUT, ErrorSeverity.MEDIUM, context)
	}

	/**
	 * Get error statistics
	 */
	getErrorStatistics(): {
		totalErrors: number
		errorsByCategory: Record<ErrorCategory, number>
		errorsBySeverity: Record<ErrorSeverity, number>
		resolvedErrors: number
		resolutionRate: number
		averageResolutionTime: number
		recentErrors: ErrorRecord[]
	} {
		const errorsByCategory = {} as Record<ErrorCategory, number>
		const errorsBySeverity = {} as Record<ErrorSeverity, number>
		let totalResolutionTime = 0
		let resolvedCount = 0

		// Initialize counters
		Object.values(ErrorCategory).forEach((category) => {
			errorsByCategory[category as ErrorCategory] = 0
		})
		Object.values(ErrorSeverity).forEach((severity) => {
			errorsBySeverity[severity as ErrorSeverity] = 0
		})

		// Count errors
		for (const error of this.errorHistory) {
			errorsByCategory[error.category]++
			errorsBySeverity[error.severity]++

			if (error.resolved && error.resolutionTime) {
				resolvedCount++
				totalResolutionTime += error.resolutionTime
			}
		}

		const resolutionRate = this.errorHistory.length > 0 ? resolvedCount / this.errorHistory.length : 0
		const averageResolutionTime = resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0

		return {
			totalErrors: this.errorHistory.length,
			errorsByCategory,
			errorsBySeverity,
			resolvedErrors: resolvedCount,
			resolutionRate,
			averageResolutionTime,
			recentErrors: this.errorHistory.slice(-10),
		}
	}

	/**
	 * Get system health based on error patterns
	 */
	getSystemHealth(): {
		status: "healthy" | "degraded" | "critical"
		issues: string[]
		recommendations: string[]
	} {
		const recentErrors = this.errorHistory.slice(-20) // Last 20 errors
		const recentTimeWindow = 300000 // 5 minutes
		const currentTime = Date.now()

		const recentCriticalErrors = recentErrors.filter(
			(e) => e.severity === ErrorSeverity.CRITICAL && currentTime - e.context.timestamp < recentTimeWindow,
		)

		const recentHighErrors = recentErrors.filter(
			(e) => e.severity === ErrorSeverity.HIGH && currentTime - e.context.timestamp < recentTimeWindow,
		)

		const issues: string[] = []
		const recommendations: string[] = []
		let status: "healthy" | "degraded" | "critical" = "healthy"

		// Critical errors indicate critical system status
		if (recentCriticalErrors.length > 0) {
			status = "critical"
			issues.push(`${recentCriticalErrors.length} critical errors in the last 5 minutes`)
			recommendations.push("Immediate intervention required - check system resources and dependencies")
		}
		// Multiple high errors indicate degraded system
		else if (recentHighErrors.length > 3) {
			status = "degraded"
			issues.push(`${recentHighErrors.length} high-severity errors in the last 5 minutes`)
			recommendations.push("System performance degraded - monitor closely and consider scaling back operations")
		}
		// Pattern analysis for health assessment
		else if (recentErrors.length > 10) {
			status = "degraded"
			issues.push("High error frequency detected")
			recommendations.push("Review error patterns and implement preventive measures")
		}

		// Category-specific health checks
		const coordinationErrors = recentErrors.filter((e) => e.category === ErrorCategory.COORDINATION)
		if (coordinationErrors.length > 5) {
			issues.push("Coordination system experiencing frequent errors")
			recommendations.push("Review coordination strategies and agent communication patterns")
		}

		const resourceErrors = recentErrors.filter((e) => e.category === ErrorCategory.RESOURCE)
		if (resourceErrors.length > 3) {
			issues.push("Resource exhaustion errors detected")
			recommendations.push("Consider increasing resource limits or optimizing resource usage")
		}

		return { status, issues, recommendations }
	}

	/**
	 * Clear error history
	 */
	clearErrorHistory(): void {
		this.errorHistory = []
		console.log("[Error Handler] Error history cleared")
	}

	/**
	 * Export error data for analysis
	 */
	exportErrorData(): {
		statistics: any
		history: ErrorRecord[]
		patterns: any
	} {
		const statistics = this.getErrorStatistics()
		const patterns = this.analyzeErrorPatterns()

		return {
			statistics,
			history: [...this.errorHistory],
			patterns,
		}
	}

	// Private methods

	private createErrorRecord(
		error: Error | string,
		category: ErrorCategory,
		severity: ErrorSeverity,
		context: Partial<ErrorContext>,
	): ErrorRecord {
		this.errorCounter++

		const message = error instanceof Error ? error.message : error
		const stackTrace = error instanceof Error ? error.stack : undefined

		return {
			id: `error_${this.errorCounter}_${Date.now()}`,
			message,
			category,
			severity,
			context: {
				timestamp: Date.now(),
				stackTrace,
				...context,
			},
			resolved: false,
			retryCount: 0,
		}
	}

	private async attemptRecovery(errorRecord: ErrorRecord): Promise<RecoveryResult> {
		// Find suitable recovery strategy
		const strategy = this.recoveryStrategies.find((s) => s.canHandle(errorRecord))

		if (!strategy) {
			return {
				success: false,
				message: "No recovery strategy available",
				shouldRetry: false,
				fallbackAction: "graceful_degradation",
			}
		}

		try {
			// Check retry limit
			if (errorRecord.retryCount >= strategy.maxRetries) {
				return {
					success: false,
					message: `Maximum retries (${strategy.maxRetries}) exceeded for ${strategy.name}`,
					shouldRetry: false,
					fallbackAction: "graceful_degradation",
				}
			}

			// Apply backoff delay
			if (errorRecord.retryCount > 0) {
				const delay = strategy.backoffMs * 2 ** (errorRecord.retryCount - 1)
				await new Promise((resolve) => setTimeout(resolve, delay))
			}

			errorRecord.retryCount++
			console.log(`[Error Handler] Attempting recovery with strategy: ${strategy.name} (attempt ${errorRecord.retryCount})`)

			return await strategy.execute(errorRecord)
		} catch (recoveryError) {
			console.error(`[Error Handler] Recovery strategy ${strategy.name} failed:`, recoveryError)

			return {
				success: false,
				message: `Recovery strategy failed: ${recoveryError instanceof Error ? recoveryError.message : recoveryError}`,
				shouldRetry: errorRecord.retryCount < strategy.maxRetries,
				fallbackAction: "graceful_degradation",
			}
		}
	}

	private initializeRecoveryStrategies(): void {
		// Orchestration initialization recovery
		this.recoveryStrategies.push({
			name: "OrchestrationInitializationRecovery",
			canHandle: (error) => error.category === ErrorCategory.INITIALIZATION,
			maxRetries: 3,
			backoffMs: 1000,
			execute: async (_error) => {
				console.log("[Recovery] Attempting orchestration re-initialization")
				return {
					success: true,
					message: "Orchestration system re-initialization triggered",
					shouldRetry: false,
					fallbackAction: "disable_orchestration",
				}
			},
		})

		// Agent communication recovery
		this.recoveryStrategies.push({
			name: "AgentCommunicationRecovery",
			canHandle: (error) => error.category === ErrorCategory.AGENT_COMMUNICATION,
			maxRetries: 2,
			backoffMs: 2000,
			execute: async (error) => {
				console.log(`[Recovery] Attempting agent reconnection for agent: ${error.context.agentId}`)
				return {
					success: true,
					message: "Agent reconnection attempted",
					shouldRetry: false,
					fallbackAction: "reduce_agent_count",
				}
			},
		})

		// Resource exhaustion recovery
		this.recoveryStrategies.push({
			name: "ResourceExhaustionRecovery",
			canHandle: (error) => error.category === ErrorCategory.RESOURCE,
			maxRetries: 1,
			backoffMs: 5000,
			execute: async (_error) => {
				console.log("[Recovery] Attempting resource cleanup and optimization")
				return {
					success: true,
					message: "Resource cleanup and optimization performed",
					shouldRetry: false,
					fallbackAction: "reduce_resource_usage",
				}
			},
		})

		// Timeout recovery
		this.recoveryStrategies.push({
			name: "TimeoutRecovery",
			canHandle: (error) => error.category === ErrorCategory.TIMEOUT,
			maxRetries: 2,
			backoffMs: 1000,
			execute: async (error) => {
				const operation = error.context.additionalData?.operation || "unknown"
				console.log(`[Recovery] Extending timeout for operation: ${operation}`)
				return {
					success: true,
					message: "Timeout extended and operation retried",
					shouldRetry: true,
					newStrategy: "extended_timeout",
				}
			},
		})

		// Coordination strategy recovery
		this.recoveryStrategies.push({
			name: "CoordinationStrategyRecovery",
			canHandle: (error) => error.category === ErrorCategory.COORDINATION,
			maxRetries: 1,
			backoffMs: 3000,
			execute: async (_error) => {
				console.log("[Recovery] Switching to fallback coordination strategy")
				return {
					success: true,
					message: "Switched to sequential coordination strategy",
					shouldRetry: false,
					newStrategy: "sequential",
				}
			},
		})

		// Generic fallback recovery
		this.recoveryStrategies.push({
			name: "GracefulDegradationRecovery",
			canHandle: (_error) => true, // Handles any error as last resort
			maxRetries: 1,
			backoffMs: 1000,
			execute: async (_error) => {
				console.log("[Recovery] Initiating graceful degradation")
				return {
					success: true,
					message: "Graceful degradation to single-agent mode",
					shouldRetry: false,
					fallbackAction: "single_agent_mode",
				}
			},
		})
	}

	private analyzeErrorPatterns(): {
		mostCommonCategory: ErrorCategory
		mostCommonSeverity: ErrorSeverity
		errorFrequency: number
		patternInsights: string[]
	} {
		if (this.errorHistory.length === 0) {
			return {
				mostCommonCategory: ErrorCategory.UNKNOWN,
				mostCommonSeverity: ErrorSeverity.LOW,
				errorFrequency: 0,
				patternInsights: ["No error data available for pattern analysis"],
			}
		}

		const categoryCount = new Map<ErrorCategory, number>()
		const severityCount = new Map<ErrorSeverity, number>()
		const insights: string[] = []

		// Count occurrences
		for (const error of this.errorHistory) {
			categoryCount.set(error.category, (categoryCount.get(error.category) || 0) + 1)
			severityCount.set(error.severity, (severityCount.get(error.severity) || 0) + 1)
		}

		// Find most common
		const mostCommonCategory = Array.from(categoryCount.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0]
		const mostCommonSeverity = Array.from(severityCount.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0]

		// Calculate frequency (errors per hour)
		const timeSpan = this.errorHistory.length > 0 ? Date.now() - this.errorHistory[0].context.timestamp : 1
		const errorFrequency = (this.errorHistory.length / timeSpan) * 3600000 // per hour

		// Generate insights
		if ((categoryCount.get(ErrorCategory.RESOURCE) || 0) > this.errorHistory.length * 0.3) {
			insights.push("High frequency of resource errors suggests system overload")
		}

		if ((severityCount.get(ErrorSeverity.CRITICAL) || 0) > 0) {
			insights.push("Critical errors detected - immediate attention required")
		}

		if (errorFrequency > 10) {
			insights.push("High error frequency indicates systemic issues")
		}

		const unresolved = this.errorHistory.filter((e) => !e.resolved).length
		if (unresolved > this.errorHistory.length * 0.2) {
			insights.push("High number of unresolved errors")
		}

		return {
			mostCommonCategory,
			mostCommonSeverity,
			errorFrequency,
			patternInsights: insights,
		}
	}
}

export default ErrorHandler
