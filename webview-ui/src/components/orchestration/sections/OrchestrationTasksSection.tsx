import { EmptyRequest, StringRequest } from "@shared/proto/cline/common"
import { ActiveOrchestrationTask, OrchestrationMode } from "@shared/proto/cline/orchestration"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Activity, Clock, GitBranch, RefreshCw, Users, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { OrchestrationServiceClient } from "@/services/grpc-client"

type OrchestrationTasksSectionProps = {
	onRefresh: () => void
	renderSectionHeader: (tabId: string) => React.ReactNode
}

const OrchestrationTasksSection = ({ onRefresh, renderSectionHeader }: OrchestrationTasksSectionProps) => {
	const [activeTasks, setActiveTasks] = useState<ActiveOrchestrationTask[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)

	const loadActiveTasks = useCallback(async () => {
		try {
			setIsLoading(true)
			const response = await OrchestrationServiceClient.getActiveOrchestrationTasks(EmptyRequest.create({}))
			setActiveTasks(response.tasks)
		} catch (error) {
			console.error("Failed to load active tasks:", error)
		} finally {
			setIsLoading(false)
		}
	}, [])

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true)
		try {
			await loadActiveTasks()
			onRefresh()
		} finally {
			setIsRefreshing(false)
		}
	}, [loadActiveTasks, onRefresh])

	const handleCancelTask = useCallback(
		async (taskId: string) => {
			try {
				await OrchestrationServiceClient.cancelOrchestrationTask(StringRequest.create({ value: taskId }))
				await loadActiveTasks()
			} catch (error) {
				console.error("Failed to cancel task:", error)
			}
		},
		[loadActiveTasks],
	)

	useEffect(() => {
		loadActiveTasks()
	}, [loadActiveTasks])

	// Get mode display info
	const getModeInfo = (mode: OrchestrationMode) => {
		switch (mode) {
			case OrchestrationMode.ORCHESTRATION_ANALYSIS_ONLY:
				return { label: "Analysis", color: "text-blue-600", bgColor: "bg-blue-100" }
			case OrchestrationMode.ORCHESTRATION_SINGLE_AGENT_FALLBACK:
				return { label: "Fallback", color: "text-yellow-600", bgColor: "bg-yellow-100" }
			case OrchestrationMode.ORCHESTRATION_FULL_ORCHESTRATION:
				return { label: "Full", color: "text-green-600", bgColor: "bg-green-100" }
			case OrchestrationMode.ORCHESTRATION_ADAPTIVE:
				return { label: "Adaptive", color: "text-purple-600", bgColor: "bg-purple-100" }
			default:
				return { label: "Unknown", color: "text-gray-500", bgColor: "bg-gray-100" }
		}
	}

	// Format duration
	const formatDuration = (startTime: number) => {
		const now = Date.now()
		const duration = Math.floor((now - startTime) / 1000)
		const hours = Math.floor(duration / 3600)
		const minutes = Math.floor((duration % 3600) / 60)
		const seconds = duration % 60

		if (hours > 0) {
			return `${hours}h ${minutes}m ${seconds}s`
		}
		if (minutes > 0) {
			return `${minutes}m ${seconds}s`
		}
		return `${seconds}s`
	}

	return (
		<div className="p-4 space-y-6">
			{renderSectionHeader("tasks")}

			{/* Header with refresh button */}
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-2">
					<GitBranch className="w-5 h-5" />
					<h2 className="text-lg font-semibold">Active Tasks</h2>
					<span className="text-sm text-[var(--vscode-descriptionForeground)]">({activeTasks.length} active)</span>
				</div>
				<VSCodeButton appearance="secondary" disabled={isRefreshing} onClick={handleRefresh}>
					<RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
					Refresh
				</VSCodeButton>
			</div>

			{/* Loading state */}
			{isLoading ? (
				<div className="text-center py-8">
					<div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
					<p>Loading active tasks...</p>
				</div>
			) : activeTasks.length === 0 ? (
				/* Empty state */
				<div className="text-center py-8">
					<GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
					<h3 className="text-lg font-semibold mb-2">No Active Tasks</h3>
					<p className="text-[var(--vscode-descriptionForeground)]">
						There are currently no orchestration tasks running.
					</p>
				</div>
			) : (
				/* Tasks list */
				<div className="space-y-4">
					{activeTasks.map((task) => {
						const modeInfo = getModeInfo(task.mode)
						return (
							<div className="p-4 border border-[var(--vscode-panel-border)] rounded-lg" key={task.id}>
								<div className="flex justify-between items-start mb-3">
									<div className="flex-1">
										<h4 className="font-medium text-sm mb-1">{task.description}</h4>
										<div className="flex items-center gap-4 text-xs text-[var(--vscode-descriptionForeground)]">
											<span className="flex items-center gap-1">
												<Users className="w-3 h-3" />
												{task.agentCount} agents
											</span>
											<span className="flex items-center gap-1">
												<Activity className="w-3 h-3" />
												{task.status}
											</span>
											<span className="flex items-center gap-1">
												<Clock className="w-3 h-3" />
												{formatDuration(task.startTime)}
											</span>
											<span
												className={`inline-block px-2 py-1 rounded text-xs font-medium ${modeInfo.color} ${modeInfo.bgColor}`}>
												{modeInfo.label}
											</span>
										</div>
									</div>
									<VSCodeButton
										appearance="secondary"
										className="ml-2"
										onClick={() => handleCancelTask(task.id)}>
										<X className="w-4 h-4" />
									</VSCodeButton>
								</div>

								{/* Task details */}
								<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-[var(--vscode-panel-border)]">
									<div>
										<div className="text-xs font-medium text-[var(--vscode-descriptionForeground)]">
											Task ID
										</div>
										<div className="text-sm font-mono truncate">{task.id}</div>
									</div>
									<div>
										<div className="text-xs font-medium text-[var(--vscode-descriptionForeground)]">
											Complexity
										</div>
										<div className="text-sm">{task.complexityScore.toFixed(2)}</div>
									</div>
									<div>
										<div className="text-xs font-medium text-[var(--vscode-descriptionForeground)]">
											Started
										</div>
										<div className="text-sm">{new Date(task.startTime).toLocaleTimeString()}</div>
									</div>
									<div>
										<div className="text-xs font-medium text-[var(--vscode-descriptionForeground)]">Mode</div>
										<div className="text-sm">{modeInfo.label}</div>
									</div>
								</div>
							</div>
						)
					})}
				</div>
			)}

			{/* Summary stats */}
			{activeTasks.length > 0 && (
				<div className="p-4 bg-[var(--vscode-textPreformat-background)] rounded-lg">
					<h4 className="font-medium mb-2">Summary</h4>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
						<div>
							<div className="font-medium">{activeTasks.length}</div>
							<div className="text-[var(--vscode-descriptionForeground)]">Total Tasks</div>
						</div>
						<div>
							<div className="font-medium">{activeTasks.reduce((sum, task) => sum + task.agentCount, 0)}</div>
							<div className="text-[var(--vscode-descriptionForeground)]">Total Agents</div>
						</div>
						<div>
							<div className="font-medium">
								{(activeTasks.reduce((sum, task) => sum + task.complexityScore, 0) / activeTasks.length).toFixed(
									2,
								)}
							</div>
							<div className="text-[var(--vscode-descriptionForeground)]">Avg Complexity</div>
						</div>
						<div>
							<div className="font-medium">
								{Math.floor(
									activeTasks.reduce((sum, task) => sum + (Date.now() - task.startTime), 0) /
										activeTasks.length /
										1000,
								)}
								s
							</div>
							<div className="text-[var(--vscode-descriptionForeground)]">Avg Duration</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default OrchestrationTasksSection
