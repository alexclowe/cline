import { EmptyRequest } from "@shared/proto/cline/common"
import { OrchestrationHealth } from "@shared/proto/cline/orchestration"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Activity, AlertCircle, CheckCircle, Clock, Heart, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { OrchestrationServiceClient } from "@/services/grpc-client"

type OrchestrationHealthSectionProps = {
	onRefresh: () => void
	renderSectionHeader: (tabId: string) => React.ReactNode
}

const OrchestrationHealthSection = ({ onRefresh, renderSectionHeader }: OrchestrationHealthSectionProps) => {
	const [health, setHealth] = useState<OrchestrationHealth | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)

	const loadHealth = useCallback(async () => {
		try {
			setIsLoading(true)
			const response = await OrchestrationServiceClient.getOrchestrationHealth(EmptyRequest.create({}))
			setHealth(response)
		} catch (error) {
			console.error("Failed to load health:", error)
		} finally {
			setIsLoading(false)
		}
	}, [])

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true)
		try {
			await loadHealth()
			onRefresh()
		} finally {
			setIsRefreshing(false)
		}
	}, [loadHealth, onRefresh])

	useEffect(() => {
		loadHealth()
	}, [loadHealth])

	// Format uptime
	const formatUptime = (seconds: number) => {
		const days = Math.floor(seconds / 86400)
		const hours = Math.floor((seconds % 86400) / 3600)
		const minutes = Math.floor((seconds % 3600) / 60)

		if (days > 0) {
			return `${days}d ${hours}h ${minutes}m`
		}
		if (hours > 0) {
			return `${hours}h ${minutes}m`
		}
		return `${minutes}m`
	}

	// Format memory usage
	const formatMemory = (bytes: number) => {
		const mb = bytes / (1024 * 1024)
		const gb = mb / 1024
		if (gb >= 1) {
			return `${gb.toFixed(1)} GB`
		}
		return `${mb.toFixed(1)} MB`
	}

	if (isLoading) {
		return (
			<div className="p-4 space-y-6">
				{renderSectionHeader("health")}
				<div className="text-center py-8">
					<div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
					<p>Loading health status...</p>
				</div>
			</div>
		)
	}

	if (!health) {
		return (
			<div className="p-4 space-y-6">
				{renderSectionHeader("health")}
				<div className="text-center py-8">
					<Heart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
					<h3 className="text-lg font-semibold mb-2">No Health Data</h3>
					<p className="text-[var(--vscode-descriptionForeground)]">Health monitoring data is not available.</p>
				</div>
			</div>
		)
	}

	const memoryUsagePercent = health.maxMemoryUsage > 0 ? (health.memoryUsage / health.maxMemoryUsage) * 100 : 0

	return (
		<div className="p-4 space-y-6">
			{renderSectionHeader("health")}

			{/* Header with refresh button */}
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-2">
					<Heart className={`w-5 h-5 ${health.isHealthy ? "text-green-600" : "text-red-600"}`} />
					<h2 className="text-lg font-semibold">System Health</h2>
					<span
						className={`text-xs px-2 py-1 rounded font-medium ${
							health.isHealthy ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
						}`}>
						{health.isHealthy ? "Healthy" : "Issues Detected"}
					</span>
				</div>
				<VSCodeButton appearance="secondary" disabled={isRefreshing} onClick={handleRefresh}>
					<RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
					Refresh
				</VSCodeButton>
			</div>

			{/* Health status cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							{health.isHealthy ? (
								<CheckCircle className="w-5 h-5 text-green-600" />
							) : (
								<AlertCircle className="w-5 h-5 text-red-600" />
							)}
							<span className="font-medium">Overall Status</span>
						</div>
					</div>
					<div className={`text-2xl font-bold ${health.isHealthy ? "text-green-600" : "text-red-600"}`}>
						{health.isHealthy ? "Healthy" : "Unhealthy"}
					</div>
					<p className="text-sm text-[var(--vscode-descriptionForeground)]">System overall health</p>
				</div>

				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<Activity className="w-5 h-5 text-blue-600" />
							<span className="font-medium">Active Tasks</span>
						</div>
					</div>
					<div className="text-2xl font-bold">{health.activeTasks}</div>
					<p className="text-sm text-[var(--vscode-descriptionForeground)]">Currently running</p>
				</div>

				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<Clock className="w-5 h-5 text-purple-600" />
							<span className="font-medium">Uptime</span>
						</div>
					</div>
					<div className="text-2xl font-bold">{formatUptime(health.uptime)}</div>
					<p className="text-sm text-[var(--vscode-descriptionForeground)]">System uptime</p>
				</div>

				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<Heart className="w-5 h-5 text-orange-600" />
							<span className="font-medium">Efficiency</span>
						</div>
					</div>
					<div className="text-2xl font-bold">{(health.efficiency * 100).toFixed(1)}%</div>
					<p className="text-sm text-[var(--vscode-descriptionForeground)]">System efficiency</p>
				</div>
			</div>

			{/* Memory usage */}
			<div className="space-y-4">
				<h3 className="text-md font-semibold">Resource Usage</h3>
				<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex justify-between items-center mb-2">
						<span className="font-medium">Memory Usage</span>
						<span className="text-sm text-[var(--vscode-descriptionForeground)]">
							{formatMemory(health.memoryUsage)} / {formatMemory(health.maxMemoryUsage)}
						</span>
					</div>
					<div className="w-full bg-gray-200 rounded-full h-2 mb-2">
						<div
							className={`h-2 rounded-full ${
								memoryUsagePercent > 80
									? "bg-red-500"
									: memoryUsagePercent > 60
										? "bg-yellow-500"
										: "bg-green-500"
							}`}
							style={{ width: `${Math.min(memoryUsagePercent, 100)}%` }}></div>
					</div>
					<p className="text-sm text-[var(--vscode-descriptionForeground)]">
						{memoryUsagePercent.toFixed(1)}% of available memory
					</p>
				</div>
			</div>

			{/* Issues */}
			{health.issues && health.issues.length > 0 && (
				<div className="space-y-4">
					<h3 className="text-md font-semibold flex items-center gap-2 text-red-600">
						<AlertCircle className="w-4 h-4" />
						Health Issues ({health.issues.length})
					</h3>
					<div className="space-y-2">
						{health.issues.map((issue, index) => (
							<div className="p-3 border border-red-200 bg-red-50 rounded-lg flex items-start gap-2" key={index}>
								<AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
								<p className="text-sm text-red-800">{issue}</p>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Recommendations */}
			{health.recommendations && health.recommendations.length > 0 && (
				<div className="space-y-4">
					<h3 className="text-md font-semibold flex items-center gap-2 text-blue-600">
						<CheckCircle className="w-4 h-4" />
						Recommendations ({health.recommendations.length})
					</h3>
					<div className="space-y-2">
						{health.recommendations.map((recommendation, index) => (
							<div className="p-3 border border-blue-200 bg-blue-50 rounded-lg flex items-start gap-2" key={index}>
								<CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
								<p className="text-sm text-blue-800">{recommendation}</p>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Health summary */}
			<div className="p-4 bg-[var(--vscode-textPreformat-background)] rounded-lg">
				<h4 className="font-medium mb-2">Health Summary</h4>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
					<div>
						<div className="font-medium mb-1">System Status</div>
						<div className={health.isHealthy ? "text-green-600" : "text-red-600"}>
							{health.isHealthy ? "All systems operational" : `${health.issues.length} issues detected`}
						</div>
					</div>
					<div>
						<div className="font-medium mb-1">Performance</div>
						<div
							className={
								health.efficiency > 0.8
									? "text-green-600"
									: health.efficiency > 0.6
										? "text-yellow-600"
										: "text-red-600"
							}>
							{health.efficiency > 0.8 ? "Excellent" : health.efficiency > 0.6 ? "Good" : "Needs attention"}
						</div>
					</div>
					<div>
						<div className="font-medium mb-1">Memory Usage</div>
						<div
							className={
								memoryUsagePercent > 80
									? "text-red-600"
									: memoryUsagePercent > 60
										? "text-yellow-600"
										: "text-green-600"
							}>
							{memoryUsagePercent > 80 ? "High" : memoryUsagePercent > 60 ? "Moderate" : "Low"}
						</div>
					</div>
					<div>
						<div className="font-medium mb-1">Active Load</div>
						<div className={health.activeTasks > 5 ? "text-yellow-600" : "text-green-600"}>
							{health.activeTasks > 5 ? "High load" : "Normal load"}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default OrchestrationHealthSection
