import { OrchestrationMode, OrchestrationStatus } from "@shared/proto/cline/orchestration"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Activity, AlertCircle, BarChart3, CheckCircle, Clock, GitBranch, Heart, RefreshCw, Users } from "lucide-react"
import { useCallback, useState } from "react"

type OrchestrationDashboardProps = {
	status: OrchestrationStatus
	onRefresh: () => void
	renderSectionHeader: (tabId: string) => React.ReactNode
}

const OrchestrationDashboard = ({ status, onRefresh, renderSectionHeader }: OrchestrationDashboardProps) => {
	const [isRefreshing, setIsRefreshing] = useState(false)

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true)
		try {
			await onRefresh()
		} finally {
			setIsRefreshing(false)
		}
	}, [onRefresh])

	// Get mode display information
	const getModeInfo = (mode: OrchestrationMode) => {
		switch (mode) {
			case OrchestrationMode.ORCHESTRATION_DISABLED:
				return { label: "Disabled", color: "text-gray-500", bgColor: "bg-gray-100" }
			case OrchestrationMode.ORCHESTRATION_ANALYSIS_ONLY:
				return { label: "Analysis Only", color: "text-blue-600", bgColor: "bg-blue-100" }
			case OrchestrationMode.ORCHESTRATION_SINGLE_AGENT_FALLBACK:
				return { label: "Single Agent Fallback", color: "text-yellow-600", bgColor: "bg-yellow-100" }
			case OrchestrationMode.ORCHESTRATION_FULL_ORCHESTRATION:
				return { label: "Full Orchestration", color: "text-green-600", bgColor: "bg-green-100" }
			case OrchestrationMode.ORCHESTRATION_ADAPTIVE:
				return { label: "Adaptive", color: "text-purple-600", bgColor: "bg-purple-100" }
			default:
				return { label: "Unknown", color: "text-gray-500", bgColor: "bg-gray-100" }
		}
	}

	const modeInfo = getModeInfo(status.currentMode)

	// Format uptime
	const formatUptime = (seconds: number) => {
		const hours = Math.floor(seconds / 3600)
		const minutes = Math.floor((seconds % 3600) / 60)
		if (hours > 0) {
			return `${hours}h ${minutes}m`
		}
		return `${minutes}m`
	}

	// Format memory usage
	const _formatMemory = (bytes: number) => {
		const mb = bytes / (1024 * 1024)
		if (mb > 1024) {
			return `${(mb / 1024).toFixed(1)} GB`
		}
		return `${mb.toFixed(1)} MB`
	}

	return (
		<div className="p-4 space-y-6">
			{renderSectionHeader("dashboard")}

			{/* Header with refresh button */}
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-2">
					<Activity className="w-5 h-5" />
					<h2 className="text-lg font-semibold">System Overview</h2>
				</div>
				<VSCodeButton appearance="secondary" disabled={isRefreshing} onClick={handleRefresh}>
					<RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
					Refresh
				</VSCodeButton>
			</div>

			{/* Status cards grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* System Status */}
				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							{status.enabled ? (
								<CheckCircle className="w-5 h-5 text-green-600" />
							) : (
								<AlertCircle className="w-5 h-5 text-gray-500" />
							)}
							<span className="font-medium">System Status</span>
						</div>
					</div>
					<div className="space-y-1">
						<div
							className={`inline-block px-2 py-1 rounded text-xs font-medium ${modeInfo.color} ${modeInfo.bgColor}`}>
							{modeInfo.label}
						</div>
						<p className="text-sm text-[var(--vscode-descriptionForeground)]">
							{status.enabled ? "Orchestration system is running" : "Orchestration system is disabled"}
						</p>
					</div>
				</div>

				{/* Active Tasks */}
				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<GitBranch className="w-5 h-5 text-blue-600" />
							<span className="font-medium">Active Tasks</span>
						</div>
					</div>
					<div className="space-y-1">
						<div className="text-2xl font-bold">{status.activeTasks.length}</div>
						<p className="text-sm text-[var(--vscode-descriptionForeground)]">Currently running tasks</p>
					</div>
				</div>

				{/* Health Status */}
				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<Heart className={`w-5 h-5 ${status.health?.isHealthy ? "text-green-600" : "text-red-600"}`} />
							<span className="font-medium">System Health</span>
						</div>
					</div>
					<div className="space-y-1">
						<div className={`text-sm font-medium ${status.health?.isHealthy ? "text-green-600" : "text-red-600"}`}>
							{status.health?.isHealthy ? "Healthy" : "Issues Detected"}
						</div>
						<p className="text-sm text-[var(--vscode-descriptionForeground)]">
							{status.health?.uptime ? `Uptime: ${formatUptime(status.health.uptime)}` : "No health data"}
						</p>
					</div>
				</div>

				{/* Performance */}
				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<BarChart3 className="w-5 h-5 text-purple-600" />
							<span className="font-medium">Performance</span>
						</div>
					</div>
					<div className="space-y-1">
						<div className="text-sm font-medium">
							{status.metrics?.efficiency ? `${(status.metrics.efficiency * 100).toFixed(1)}%` : "N/A"}
						</div>
						<p className="text-sm text-[var(--vscode-descriptionForeground)]">Efficiency rating</p>
					</div>
				</div>
			</div>

			{/* Recent activity */}
			{status.activeTasks.length > 0 && (
				<div className="space-y-4">
					<h3 className="text-md font-semibold flex items-center gap-2">
						<Clock className="w-4 h-4" />
						Recent Activity
					</h3>
					<div className="space-y-2">
						{status.activeTasks.slice(0, 5).map((task) => (
							<div className="p-3 border border-[var(--vscode-panel-border)] rounded-lg" key={task.id}>
								<div className="flex justify-between items-start">
									<div className="flex-1">
										<h4 className="font-medium text-sm truncate">{task.description}</h4>
										<div className="flex items-center gap-4 mt-1 text-xs text-[var(--vscode-descriptionForeground)]">
											<span className="flex items-center gap-1">
												<Users className="w-3 h-3" />
												{task.agentCount} agents
											</span>
											<span className="flex items-center gap-1">
												<Activity className="w-3 h-3" />
												{task.status}
											</span>
											<span>Complexity: {task.complexityScore.toFixed(1)}</span>
										</div>
									</div>
									<div className="text-xs text-[var(--vscode-descriptionForeground)]">
										{new Date(task.startTime).toLocaleTimeString()}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Quick stats */}
			{status.metrics && (
				<div className="space-y-4">
					<h3 className="text-md font-semibold">Quick Statistics</h3>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div className="text-center">
							<div className="text-xl font-bold">{status.metrics.totalTasks}</div>
							<div className="text-xs text-[var(--vscode-descriptionForeground)]">Total Tasks</div>
						</div>
						<div className="text-center">
							<div className="text-xl font-bold">{status.metrics.successfulTasks}</div>
							<div className="text-xs text-[var(--vscode-descriptionForeground)]">Successful</div>
						</div>
						<div className="text-center">
							<div className="text-xl font-bold">{status.metrics.averageAgentsUsed.toFixed(1)}</div>
							<div className="text-xs text-[var(--vscode-descriptionForeground)]">Avg Agents</div>
						</div>
						<div className="text-center">
							<div className="text-xl font-bold">{(status.metrics.averageExecutionTime / 1000).toFixed(1)}s</div>
							<div className="text-xs text-[var(--vscode-descriptionForeground)]">Avg Duration</div>
						</div>
					</div>
				</div>
			)}

			{/* Health issues */}
			{status.health?.issues && status.health.issues.length > 0 && (
				<div className="space-y-4">
					<h3 className="text-md font-semibold flex items-center gap-2 text-red-600">
						<AlertCircle className="w-4 h-4" />
						Health Issues
					</h3>
					<div className="space-y-2">
						{status.health.issues.map((issue, index) => (
							<div className="p-3 border border-red-200 bg-red-50 rounded-lg" key={index}>
								<p className="text-sm text-red-800">{issue}</p>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Recommendations */}
			{status.health?.recommendations && status.health.recommendations.length > 0 && (
				<div className="space-y-4">
					<h3 className="text-md font-semibold flex items-center gap-2 text-blue-600">
						<CheckCircle className="w-4 h-4" />
						Recommendations
					</h3>
					<div className="space-y-2">
						{status.health.recommendations.map((recommendation, index) => (
							<div className="p-3 border border-blue-200 bg-blue-50 rounded-lg" key={index}>
								<p className="text-sm text-blue-800">{recommendation}</p>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export default OrchestrationDashboard
