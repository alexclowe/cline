declare module "./base.js" {
	interface StrategyMetrics {
		queriesExecuted?: number
		averageResponseTime?: number
		cacheHits?: number
		cacheMisses?: number
		credibilityScores?: Record<string, number>
	}
}
