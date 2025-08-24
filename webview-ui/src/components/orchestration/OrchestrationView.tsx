import { EmptyRequest } from "@shared/proto/cline/common"
import { OrchestrationMode, OrchestrationStatus } from "@shared/proto/cline/orchestration"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Activity, AlertCircle, BarChart3, Cog, GitBranch, Heart, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { OrchestrationServiceClient } from "@/services/grpc-client"
import { Tab, TabContent, TabHeader, TabList, TabTrigger } from "../common/Tab"
import SectionHeader from "../settings/SectionHeader"
import OrchestrationConfigSection from "./sections/OrchestrationConfigSection"
import OrchestrationDashboard from "./sections/OrchestrationDashboard"
import OrchestrationHealthSection from "./sections/OrchestrationHealthSection"
import OrchestrationMetricsSection from "./sections/OrchestrationMetricsSection"
import OrchestrationTasksSection from "./sections/OrchestrationTasksSection"
import SwarmControlSection from "./sections/SwarmControlSection"

// Styles for the tab system (matching SettingsView)
const orchestrationTabsContainer = "flex flex-1 overflow-hidden [&.narrow_.tab-label]:hidden"
const orchestrationTabList =
	"w-48 data-[compact=true]:w-12 flex-shrink-0 flex flex-col overflow-y-auto overflow-x-hidden border-r border-[var(--vscode-sideBar-background)]"
const orchestrationTabTrigger =
	"whitespace-nowrap overflow-hidden min-w-0 h-12 px-4 py-3 box-border flex items-center border-l-2 border-transparent text-[var(--vscode-foreground)] opacity-70 bg-transparent hover:bg-[var(--vscode-list-hoverBackground)] data-[compact=true]:w-12 data-[compact=true]:p-4 cursor-pointer"
const orchestrationTabTriggerActive =
	"opacity-100 border-l-2 border-l-[var(--vscode-focusBorder)] border-t-0 border-r-0 border-b-0 bg-[var(--vscode-list-activeSelectionBackground)]"

// Tab definitions for orchestration
interface OrchestrationTab {
	id: string
	name: string
	tooltipText: string
	headerText: string
	icon: React.ComponentType<{ className?: string }>
}

export const ORCHESTRATION_TABS: OrchestrationTab[] = [
	{
		id: "dashboard",
		name: "Dashboard",
		tooltipText: "Orchestration Overview",
		headerText: "Orchestration Dashboard",
		icon: Activity,
	},
	{
		id: "swarm",
		name: "Swarm Control",
		tooltipText: "Agent Swarm Control",
		headerText: "Swarm Control",
		icon: Users,
	},
	{
		id: "config",
		name: "Configuration",
		tooltipText: "Orchestration Settings",
		headerText: "Orchestration Configuration",
		icon: Cog,
	},
	{
		id: "tasks",
		name: "Active Tasks",
		tooltipText: "Active Orchestration Tasks",
		headerText: "Active Tasks",
		icon: GitBranch,
	},
	{
		id: "metrics",
		name: "Metrics",
		tooltipText: "Performance Metrics",
		headerText: "Performance Metrics",
		icon: BarChart3,
	},
	{
		id: "health",
		name: "Health",
		tooltipText: "System Health",
		headerText: "System Health",
		icon: Heart,
	},
]

type OrchestrationViewProps = {
	onDone: () => void
	targetSection?: string
}

const OrchestrationView = ({ onDone, targetSection }: OrchestrationViewProps) => {
	// Track active tab
	const [activeTab, setActiveTab] = useState<string>(targetSection || ORCHESTRATION_TABS[0].id)

	// Orchestration state
	const [orchestrationStatus, setOrchestrationStatus] = useState<OrchestrationStatus | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	// Load orchestration status on mount
	const loadOrchestrationStatus = useCallback(async () => {
		try {
			setIsLoading(true)
			setError(null)
			const status = await OrchestrationServiceClient.getOrchestrationStatus(EmptyRequest.create({}))
			setOrchestrationStatus(status)
		} catch (err) {
			console.error("Failed to load orchestration status:", err)
			setError(err instanceof Error ? err.message : "Failed to load orchestration status")
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		loadOrchestrationStatus()
	}, [loadOrchestrationStatus])

	// Update active tab when targetSection changes
	useEffect(() => {
		if (targetSection) {
			setActiveTab(targetSection)
		}
	}, [targetSection])

	// Tab change handler
	const handleTabChange = useCallback((tabId: string) => {
		setActiveTab(tabId)
	}, [])

	// Compact mode handling
	const [isCompactMode, _setIsCompactMode] = useState(false)

	// Helper function to render section header
	const renderSectionHeader = (tabId: string) => {
		const tab = ORCHESTRATION_TABS.find((t) => t.id === tabId)
		if (!tab) {
			return null
		}

		return (
			<SectionHeader>
				<div className="flex items-center gap-2">
					<tab.icon className="w-4 h-4" />
					<div>{tab.headerText}</div>
				</div>
			</SectionHeader>
		)
	}

	// Error display
	if (error) {
		return (
			<Tab>
				<TabHeader className="flex justify-between items-center gap-2">
					<div className="flex items-center gap-2">
						<AlertCircle className="w-4 h-4 text-red-500" />
						<h3 className="text-[var(--vscode-foreground)] m-0">Orchestration Error</h3>
					</div>
					<VSCodeButton onClick={onDone}>Done</VSCodeButton>
				</TabHeader>
				<TabContent className="flex-1 overflow-auto p-4">
					<div className="text-center">
						<AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
						<h4 className="text-lg font-semibold mb-2">Failed to Load Orchestration</h4>
						<p className="text-[var(--vscode-descriptionForeground)] mb-4">{error}</p>
						<VSCodeButton onClick={loadOrchestrationStatus}>Retry</VSCodeButton>
					</div>
				</TabContent>
			</Tab>
		)
	}

	// Loading display
	if (isLoading) {
		return (
			<Tab>
				<TabHeader className="flex justify-between items-center gap-2">
					<div className="flex items-center gap-2">
						<Users className="w-4 h-4" />
						<h3 className="text-[var(--vscode-foreground)] m-0">Orchestration</h3>
					</div>
					<VSCodeButton onClick={onDone}>Done</VSCodeButton>
				</TabHeader>
				<TabContent className="flex-1 overflow-auto p-4">
					<div className="text-center">
						<div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
						<p>Loading orchestration system...</p>
					</div>
				</TabContent>
			</Tab>
		)
	}

	return (
		<Tab>
			<TabHeader className="flex justify-between items-center gap-2">
				<div className="flex items-center gap-2">
					<Users className="w-4 h-4" />
					<h3 className="text-[var(--vscode-foreground)] m-0">Orchestration</h3>
					{orchestrationStatus?.enabled && (
						<span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
							{orchestrationStatus.currentMode === OrchestrationMode.ORCHESTRATION_DISABLED ? "Disabled" : "Active"}
						</span>
					)}
				</div>
				<VSCodeButton onClick={onDone}>Done</VSCodeButton>
			</TabHeader>

			{/* Vertical tabs layout */}
			<div className={`${orchestrationTabsContainer} ${isCompactMode ? "narrow" : ""}`}>
				{/* Tab sidebar */}
				<TabList
					className={orchestrationTabList}
					data-compact={isCompactMode}
					onValueChange={handleTabChange}
					value={activeTab}>
					{ORCHESTRATION_TABS.map((tab) => (
						<TabTrigger
							className={`${
								activeTab === tab.id
									? `${orchestrationTabTrigger} ${orchestrationTabTriggerActive}`
									: orchestrationTabTrigger
							} focus:ring-0`}
							data-compact={isCompactMode}
							data-testid={`tab-${tab.id}`}
							key={tab.id}
							value={tab.id}>
							<div className={`flex items-center gap-2 ${isCompactMode ? "justify-center" : ""}`}>
								<tab.icon className="w-4 h-4" />
								<span className="tab-label">{tab.name}</span>
							</div>
						</TabTrigger>
					))}
				</TabList>

				<TabContent className="flex-1 overflow-auto">
					{/* Dashboard Tab */}
					{activeTab === "dashboard" && orchestrationStatus && (
						<OrchestrationDashboard
							onRefresh={loadOrchestrationStatus}
							renderSectionHeader={renderSectionHeader}
							status={orchestrationStatus}
						/>
					)}

					{/* Swarm Control Tab */}
					{activeTab === "swarm" && (
						<SwarmControlSection onRefresh={loadOrchestrationStatus} renderSectionHeader={renderSectionHeader} />
					)}

					{/* Configuration Tab */}
					{activeTab === "config" && orchestrationStatus && (
						<OrchestrationConfigSection
							onConfigUpdate={loadOrchestrationStatus}
							renderSectionHeader={renderSectionHeader}
							status={orchestrationStatus}
						/>
					)}

					{/* Active Tasks Tab */}
					{activeTab === "tasks" && (
						<OrchestrationTasksSection
							onRefresh={loadOrchestrationStatus}
							renderSectionHeader={renderSectionHeader}
						/>
					)}

					{/* Metrics Tab */}
					{activeTab === "metrics" && (
						<OrchestrationMetricsSection
							onRefresh={loadOrchestrationStatus}
							renderSectionHeader={renderSectionHeader}
						/>
					)}

					{/* Health Tab */}
					{activeTab === "health" && (
						<OrchestrationHealthSection
							onRefresh={loadOrchestrationStatus}
							renderSectionHeader={renderSectionHeader}
						/>
					)}
				</TabContent>
			</div>
		</Tab>
	)
}

export default OrchestrationView
