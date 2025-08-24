import { EmptyRequest } from "@shared/proto/cline/common"
import { OrchestrationMetrics } from "@shared/proto/cline/orchestration"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { BarChart3, Clock, RefreshCw, TrendingUp, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { OrchestrationServiceClient } from "@/services/grpc-client"

type OrchestrationMetricsSectionProps = {
	onRefresh: () => void
	renderSectionHeader: (tabId: string) => React.ReactNode
}

const OrchestrationMetricsSection = ({ onRefresh, renderSectionHeader }: OrchestrationMetricsSectionProps) => {
	const [metrics, setMetrics] = useState<OrchestrationMetrics | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)

	const loadMetrics = useCallback(async () => {
		try {
			setIsLoading(true)
			const response = await OrchestrationServiceClient.getOrchestrationMetrics(EmptyRequest.create({}))
			setMetrics(response)
		} catch (error) {
			console.error("Failed to load metrics:", error)
		} finally {
			setIsLoading(false)
		}
	}, [])

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true)
		try {
			await loadMetrics()
			onRefresh()
		} finally {
			setIsRefreshing(false)
		}
	}, [loadMetrics, onRefresh])

	const handleResetMetrics = useCallback(async () => {
		try {
			await OrchestrationServiceClient.resetOrchestrationMetrics(EmptyRequest.create({}))
			await loadMetrics()
		} catch (error) {
			console.error("Failed to reset metrics:", error)
		}
	}, [loadMetrics])

	useEffect(() => {
		loadMetrics()
	}, [loadMetrics])

	if (isLoading) {
		return (
			<div className="p-4 space-y-6">
				{renderSectionHeader("metrics")}
				<div className="text-center py-8">
					<div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
					<p>Loading metrics...</p>
				</div>
			</div>
		)
	}

	if (!metrics) {
		return (
			<div className="p-4 space-y-6">
				{renderSectionHeader("metrics")}
				<div className="text-center py-8">
					<BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
					<h3 className="text-lg font-semibold mb-2">No Metrics Available</h3>
					<p className="text-[var(--vscode-descriptionForeground)]">
						No orchestration metrics have been collected yet.
					</p>
				</div>
			</div>
		)
	}

	const successRate = metrics.totalTasks > 0 ? (metrics.successfulTasks / metrics.totalTasks) * 100 : 0

	return (
		<div className="p-4 space-y-6">
			{renderSectionHeader("metrics")}

			{/* Header with actions */}
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-2">
					<BarChart3 className="w-5 h-5" />
					<h2 className="text-lg font-semibold">Performance Metrics</h2>
				</div>
				<div className="flex gap-2">
					<VSCodeButton appearance="secondary" onClick={handleResetMetrics}>
						Reset
					</VSCodeButton>
					<VSCodeButton appearance="secondary" disabled={isRefreshing} onClick={handleRefresh}>
						<RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
						Refresh
					</VSCodeButton>
				</div>
			</div>

			{/* Key metrics cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<TrendingUp className="w-5 h-5 text-green-600" />
							<span className="font-medium">Success Rate</span>
						</div>
					</div>
					<div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
					<p className="text-sm text-[var(--vscode-descriptionForeground)]">
						{metrics.successfulTasks} of {metrics.totalTasks} tasks
					</p>
				</div>

				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<Clock className="w-5 h-5 text-blue-600" />
							<span className="font-medium">Avg Duration</span>
						</div>
					</div>
					<div className="text-2xl font-bold">{(metrics.averageExecutionTime / 1000).toFixed(1)}s</div>
					<p className="text-sm text-[var(--vscode-descriptionForeground)]">Per task execution</p>
				</div>

				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<Users className="w-5 h-5 text-purple-600" />
							<span className="font-medium">Avg Agents</span>
						</div>
					</div>
					<div className="text-2xl font-bold">{metrics.averageAgentsUsed.toFixed(1)}</div>
					<p className="text-sm text-[var(--vscode-descriptionForeground)]">Per orchestration</p>
				</div>

				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<BarChart3 className="w-5 h-5 text-orange-600" />
							<span className="font-medium">Efficiency</span>
						</div>
					</div>
					<div className="text-2xl font-bold">{(metrics.efficiency * 100).toFixed(1)}%</div>
					<p className="text-sm text-[var(--vscode-descriptionForeground)]">System efficiency</p>
				</div>
			</div>

			{/* Task breakdown */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{/* Task status breakdown */}
				<div className="space-y-4">
					<h3 className="text-md font-semibold">Task Status</h3>
					<div className="space-y-3">
						<div className="flex items-center justify-between p-3 border border-[var(--vscode-panel-border)] rounded-lg">
							<span className="font-medium">Total Tasks</span>
							<span className="text-lg font-bold">{metrics.totalTasks}</span>
						</div>
						<div className="flex items-center justify-between p-3 border border-green-200 bg-green-50 rounded-lg">
							<span className="font-medium text-green-800">Successful</span>
							<span className="text-lg font-bold text-green-800">{metrics.successfulTasks}</span>
						</div>
						<div className="flex items-center justify-between p-3 border border-red-200 bg-red-50 rounded-lg">
							<span className="font-medium text-red-800">Failed</span>
							<span className="text-lg font-bold text-red-800">{metrics.failedTasks}</span>
						</div>
					</div>
				</div>

				{/* Coordination strategies */}
				<div className="space-y-4">
					<h3 className="text-md font-semibold">Coordination Strategies</h3>
					<div className="space-y-2">
						{Object.entries(metrics.coordinationStrategyUsage).map(([strategy, count]) => (
							<div
								className="flex items-center justify-between p-3 border border-[var(--vscode-panel-border)] rounded-lg"
								key={strategy}>
								<span className="font-medium capitalize">{strategy.replace(/([A-Z])/g, " $1").trim()}</span>
								<span className="text-lg font-bold">{count}</span>
							</div>
						))}
						{Object.keys(metrics.coordinationStrategyUsage).length === 0 && (
							<p className="text-sm text-[var(--vscode-descriptionForeground)] text-center py-4">
								No coordination strategy data available
							</p>
						)}
					</div>
				</div>
			</div>

			{/* Agent types usage */}
			{Object.keys(metrics.agentTypeUsage).length > 0 && (
				<div className="space-y-4">
					<h3 className="text-md font-semibold">Agent Type Usage</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{Object.entries(metrics.agentTypeUsage).map(([agentType, count]) => (
							<div
								className="flex items-center justify-between p-3 border border-[var(--vscode-panel-border)] rounded-lg"
								key={agentType}>
								<span className="font-medium capitalize">{agentType.replace(/([A-Z])/g, " $1").trim()}</span>
								<span className="text-lg font-bold">{count}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Performance insights */}
			<div className="p-4 bg-[var(--vscode-textPreformat-background)] rounded-lg">
				<h4 className="font-medium mb-2">Performance Insights</h4>
				<div className="space-y-2 text-sm">
					{successRate >= 90 && (
						<div className="flex items-center gap-2 text-green-600">
							<TrendingUp className="w-4 h-4" />
							<span>Excellent success rate - system performing well</span>
						</div>
					)}
					{successRate < 70 && (
						<div className="flex items-center gap-2 text-yellow-600">
							<TrendingUp className="w-4 h-4" />
							<span>Success rate could be improved - consider adjusting configuration</span>
						</div>
					)}
					{metrics.averageAgentsUsed > 5 && (
						<div className="flex items-center gap-2 text-blue-600">
							<Users className="w-4 h-4" />
							<span>High agent usage - consider optimizing task complexity threshold</span>
						</div>
					)}
					{metrics.efficiency > 0.8 && (
						<div className="flex items-center gap-2 text-green-600">
							<BarChart3 className="w-4 h-4" />
							<span>High efficiency - orchestration is well-optimized</span>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default OrchestrationMetricsSection
