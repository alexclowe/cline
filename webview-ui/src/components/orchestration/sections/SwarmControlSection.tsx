import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import {
	Activity,
	AlertCircle,
	Brain,
	CheckCircle,
	Clock,
	Cpu,
	GitBranch,
	PauseCircle,
	PlayCircle,
	Plus,
	RefreshCw,
	StopCircle,
	Users,
	Zap,
} from "lucide-react"
import { useCallback, useState } from "react"

type SwarmControlSectionProps = {
	onRefresh: () => void
	renderSectionHeader: (tabId: string) => React.ReactNode
}

interface Agent {
	id: string
	name: string
	status: "active" | "idle" | "busy" | "error"
	type: "coordinator" | "specialist" | "executor"
	currentTask?: string
	performance: number
	lastActivity: number
	capabilities: string[]
	memoryUsage: number
	responseTime: number
}

// Mock agent data - in real implementation, this would come from the orchestration system
const mockAgents: Agent[] = [
	{
		id: "agent-1",
		name: "Task Coordinator",
		status: "active",
		type: "coordinator",
		currentTask: "Analyzing project structure",
		performance: 0.95,
		lastActivity: Date.now() - 30000,
		capabilities: ["task-analysis", "coordination", "planning"],
		memoryUsage: 128,
		responseTime: 250,
	},
	{
		id: "agent-2",
		name: "Code Specialist",
		status: "busy",
		type: "specialist",
		currentTask: "Implementing UI components",
		performance: 0.88,
		lastActivity: Date.now() - 5000,
		capabilities: ["typescript", "react", "ui-development"],
		memoryUsage: 256,
		responseTime: 180,
	},
	{
		id: "agent-3",
		name: "Test Executor",
		status: "idle",
		type: "executor",
		performance: 0.92,
		lastActivity: Date.now() - 120000,
		capabilities: ["testing", "validation", "qa"],
		memoryUsage: 64,
		responseTime: 320,
	},
	{
		id: "agent-4",
		name: "Documentation Writer",
		status: "active",
		type: "specialist",
		currentTask: "Updating API documentation",
		performance: 0.85,
		lastActivity: Date.now() - 10000,
		capabilities: ["documentation", "markdown", "technical-writing"],
		memoryUsage: 96,
		responseTime: 200,
	},
]

const SwarmControlSection = ({ onRefresh, renderSectionHeader }: SwarmControlSectionProps) => {
	const [agents, setAgents] = useState<Agent[]>(mockAgents)
	const [isLoading, setIsLoading] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
	const [showSpawnDialog, setShowSpawnDialog] = useState(false)

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true)
		try {
			// In real implementation, fetch agent data from orchestration system
			await new Promise((resolve) => setTimeout(resolve, 1000))
			onRefresh()
		} finally {
			setIsRefreshing(false)
		}
	}, [onRefresh])

	const handleSpawnAgent = useCallback(async (agentType: string) => {
		setIsLoading(true)
		try {
			// In real implementation, spawn new agent via orchestration service
			const newAgent: Agent = {
				id: `agent-${Date.now()}`,
				name: `New ${agentType}`,
				status: "idle",
				type: agentType as Agent["type"],
				performance: 1.0,
				lastActivity: Date.now(),
				capabilities:
					agentType === "coordinator"
						? ["coordination", "planning"]
						: agentType === "specialist"
							? ["specialization"]
							: ["execution"],
				memoryUsage: 32,
				responseTime: 150,
			}
			setAgents((prev) => [...prev, newAgent])
			setShowSpawnDialog(false)
		} finally {
			setIsLoading(false)
		}
	}, [])

	const handleAgentAction = useCallback(async (agentId: string, action: "pause" | "resume" | "stop") => {
		setAgents((prev) =>
			prev.map((agent) =>
				agent.id === agentId
					? {
							...agent,
							status: action === "pause" ? "idle" : action === "resume" ? "active" : "idle",
							currentTask: action === "stop" ? undefined : agent.currentTask,
						}
					: agent,
			),
		)
	}, [])

	const handleCoordinateSwarm = useCallback(async () => {
		setIsLoading(true)
		try {
			// In real implementation, trigger swarm coordination
			await new Promise((resolve) => setTimeout(resolve, 1500))
			setAgents((prev) =>
				prev.map((agent) => ({
					...agent,
					status: "active" as const,
					lastActivity: Date.now(),
				})),
			)
		} finally {
			setIsLoading(false)
		}
	}, [])

	// Get status color and icon
	const getStatusInfo = (status: Agent["status"]) => {
		switch (status) {
			case "active":
				return { color: "text-green-600", bgColor: "bg-green-100", icon: PlayCircle }
			case "busy":
				return { color: "text-blue-600", bgColor: "bg-blue-100", icon: Activity }
			case "idle":
				return { color: "text-gray-600", bgColor: "bg-gray-100", icon: PauseCircle }
			case "error":
				return { color: "text-red-600", bgColor: "bg-red-100", icon: AlertCircle }
			default:
				return { color: "text-gray-600", bgColor: "bg-gray-100", icon: PauseCircle }
		}
	}

	// Get type icon
	const getTypeIcon = (type: Agent["type"]) => {
		switch (type) {
			case "coordinator":
				return GitBranch
			case "specialist":
				return Brain
			case "executor":
				return Cpu
			default:
				return Users
		}
	}

	// Format time ago
	const formatTimeAgo = (timestamp: number) => {
		const seconds = Math.floor((Date.now() - timestamp) / 1000)
		if (seconds < 60) {
			return `${seconds}s ago`
		}
		const minutes = Math.floor(seconds / 60)
		if (minutes < 60) {
			return `${minutes}m ago`
		}
		const hours = Math.floor(minutes / 60)
		return `${hours}h ago`
	}

	const activeAgents = agents.filter((a) => a.status === "active" || a.status === "busy")
	const totalAgents = agents.length

	return (
		<div className="p-4 space-y-6">
			{renderSectionHeader("swarm")}

			{/* Header with controls */}
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-2">
					<Users className="w-5 h-5" />
					<h2 className="text-lg font-semibold">Swarm Control</h2>
					<span className="text-sm text-[var(--vscode-descriptionForeground)]">
						({activeAgents.length}/{totalAgents} active)
					</span>
				</div>
				<div className="flex gap-2">
					<VSCodeButton appearance="secondary" disabled={isLoading} onClick={() => setShowSpawnDialog(true)}>
						<Plus className="w-4 h-4 mr-2" />
						Spawn Agent
					</VSCodeButton>
					<VSCodeButton disabled={isLoading} onClick={handleCoordinateSwarm}>
						<Zap className="w-4 h-4 mr-2" />
						Coordinate
					</VSCodeButton>
					<VSCodeButton appearance="secondary" disabled={isRefreshing} onClick={handleRefresh}>
						<RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
						Refresh
					</VSCodeButton>
				</div>
			</div>

			{/* Swarm overview stats */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="p-3 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center gap-2 mb-2">
						<Users className="w-4 h-4 text-blue-600" />
						<span className="font-medium text-sm">Total Agents</span>
					</div>
					<div className="text-xl font-bold">{totalAgents}</div>
				</div>
				<div className="p-3 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center gap-2 mb-2">
						<Activity className="w-4 h-4 text-green-600" />
						<span className="font-medium text-sm">Active</span>
					</div>
					<div className="text-xl font-bold">{activeAgents.length}</div>
				</div>
				<div className="p-3 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center gap-2 mb-2">
						<CheckCircle className="w-4 h-4 text-purple-600" />
						<span className="font-medium text-sm">Avg Performance</span>
					</div>
					<div className="text-xl font-bold">
						{((agents.reduce((sum, a) => sum + a.performance, 0) / agents.length) * 100).toFixed(0)}%
					</div>
				</div>
				<div className="p-3 border border-[var(--vscode-panel-border)] rounded-lg">
					<div className="flex items-center gap-2 mb-2">
						<Clock className="w-4 h-4 text-orange-600" />
						<span className="font-medium text-sm">Avg Response</span>
					</div>
					<div className="text-xl font-bold">
						{Math.round(agents.reduce((sum, a) => sum + a.responseTime, 0) / agents.length)}ms
					</div>
				</div>
			</div>

			{/* Agent cards grid */}
			<div className="space-y-4">
				<h3 className="text-md font-semibold flex items-center gap-2">
					<Users className="w-4 h-4" />
					Agent Fleet
				</h3>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{agents.map((agent) => {
						const statusInfo = getStatusInfo(agent.status)
						const TypeIcon = getTypeIcon(agent.type)
						const StatusIcon = statusInfo.icon

						return (
							<div
								className={`p-4 border rounded-lg cursor-pointer transition-all ${
									selectedAgent === agent.id
										? "border-[var(--vscode-focusBorder)] bg-[var(--vscode-list-activeSelectionBackground)]"
										: "border-[var(--vscode-panel-border)] hover:bg-[var(--vscode-list-hoverBackground)]"
								}`}
								key={agent.id}
								onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}>
								{/* Agent header */}
								<div className="flex justify-between items-start mb-3">
									<div className="flex items-center gap-2">
										<TypeIcon className="w-5 h-5 text-blue-600" />
										<div>
											<h4 className="font-medium text-sm">{agent.name}</h4>
											<div className="flex items-center gap-2 mt-1">
												<span
													className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor}`}>
													<StatusIcon className="w-3 h-3" />
													{agent.status}
												</span>
												<span className="text-xs text-[var(--vscode-descriptionForeground)]">
													{agent.type}
												</span>
											</div>
										</div>
									</div>

									{/* Agent controls */}
									<div className="flex gap-1">
										{agent.status === "active" || agent.status === "busy" ? (
											<VSCodeButton
												appearance="icon"
												onClick={(e) => {
													e.stopPropagation()
													handleAgentAction(agent.id, "pause")
												}}>
												<PauseCircle className="w-4 h-4" />
											</VSCodeButton>
										) : (
											<VSCodeButton
												appearance="icon"
												onClick={(e) => {
													e.stopPropagation()
													handleAgentAction(agent.id, "resume")
												}}>
												<PlayCircle className="w-4 h-4" />
											</VSCodeButton>
										)}
										<VSCodeButton
											appearance="icon"
											onClick={(e) => {
												e.stopPropagation()
												handleAgentAction(agent.id, "stop")
											}}>
											<StopCircle className="w-4 h-4" />
										</VSCodeButton>
									</div>
								</div>

								{/* Current task */}
								{agent.currentTask && (
									<div className="mb-3 p-2 bg-[var(--vscode-textPreformat-background)] rounded text-xs">
										<div className="flex items-center gap-1 mb-1">
											<Activity className="w-3 h-3" />
											<span className="font-medium">Current Task:</span>
										</div>
										<div className="text-[var(--vscode-descriptionForeground)]">{agent.currentTask}</div>
									</div>
								)}

								{/* Agent metrics */}
								<div className="grid grid-cols-3 gap-2 text-xs">
									<div>
										<div className="font-medium text-[var(--vscode-descriptionForeground)]">Performance</div>
										<div className="font-mono">{(agent.performance * 100).toFixed(0)}%</div>
									</div>
									<div>
										<div className="font-medium text-[var(--vscode-descriptionForeground)]">Memory</div>
										<div className="font-mono">{agent.memoryUsage}MB</div>
									</div>
									<div>
										<div className="font-medium text-[var(--vscode-descriptionForeground)]">Response</div>
										<div className="font-mono">{agent.responseTime}ms</div>
									</div>
								</div>

								{/* Expanded details */}
								{selectedAgent === agent.id && (
									<div className="mt-3 pt-3 border-t border-[var(--vscode-panel-border)] space-y-2">
										<div>
											<div className="font-medium text-xs text-[var(--vscode-descriptionForeground)] mb-1">
												Capabilities
											</div>
											<div className="flex flex-wrap gap-1">
												{agent.capabilities.map((cap) => (
													<span
														className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
														key={cap}>
														{cap}
													</span>
												))}
											</div>
										</div>
										<div>
											<div className="font-medium text-xs text-[var(--vscode-descriptionForeground)]">
												Last Activity
											</div>
											<div className="text-xs">{formatTimeAgo(agent.lastActivity)}</div>
										</div>
										<div>
											<div className="font-medium text-xs text-[var(--vscode-descriptionForeground)]">
												Agent ID
											</div>
											<div className="text-xs font-mono">{agent.id}</div>
										</div>
									</div>
								)}
							</div>
						)
					})}
				</div>
			</div>

			{/* Spawn Agent Dialog */}
			{showSpawnDialog && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-lg p-6 max-w-md w-full mx-4">
						<h3 className="text-lg font-semibold mb-4">Spawn New Agent</h3>
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium mb-2">Agent Type</label>
								<div className="space-y-2">
									<VSCodeButton
										className="w-full justify-start"
										onClick={() => handleSpawnAgent("coordinator")}>
										<GitBranch className="w-4 h-4 mr-2" />
										Coordinator Agent
									</VSCodeButton>
									<VSCodeButton className="w-full justify-start" onClick={() => handleSpawnAgent("specialist")}>
										<Brain className="w-4 h-4 mr-2" />
										Specialist Agent
									</VSCodeButton>
									<VSCodeButton className="w-full justify-start" onClick={() => handleSpawnAgent("executor")}>
										<Cpu className="w-4 h-4 mr-2" />
										Executor Agent
									</VSCodeButton>
								</div>
							</div>
						</div>
						<div className="flex gap-2 mt-6">
							<VSCodeButton appearance="secondary" className="flex-1" onClick={() => setShowSpawnDialog(false)}>
								Cancel
							</VSCodeButton>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default SwarmControlSection
