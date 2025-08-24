import { OrchestrationConfigRequest, OrchestrationMode, OrchestrationStatus } from "@shared/proto/cline/orchestration"
import { VSCodeButton, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Cog, Save } from "lucide-react"
import { useCallback, useState } from "react"
import { OrchestrationServiceClient } from "@/services/grpc-client"

type OrchestrationConfigSectionProps = {
	status: OrchestrationStatus
	onConfigUpdate: () => void
	renderSectionHeader: (tabId: string) => React.ReactNode
}

const OrchestrationConfigSection = ({ status, onConfigUpdate, renderSectionHeader }: OrchestrationConfigSectionProps) => {
	const [isSaving, setIsSaving] = useState(false)
	const [config, setConfig] = useState(
		status.config || {
			enabled: false,
			maxConcurrentAgents: 3,
			maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
			timeoutMinutes: 30,
			fallbackToSingleAgent: true,
			debugMode: false,
			autoOptimization: true,
			resourceMonitoring: true,
			complexityThreshold: 0.7,
		},
	)

	const handleSave = useCallback(async () => {
		setIsSaving(true)
		try {
			await OrchestrationServiceClient.updateOrchestrationConfig(OrchestrationConfigRequest.create(config))
			onConfigUpdate()
		} catch (error) {
			console.error("Failed to update orchestration config:", error)
		} finally {
			setIsSaving(false)
		}
	}, [config, onConfigUpdate])

	const updateConfig = (updates: Partial<typeof config>) => {
		setConfig((prev) => ({ ...prev, ...updates }))
	}

	// Format memory size for display
	const formatMemorySize = (bytes: number) => {
		const gb = bytes / (1024 * 1024 * 1024)
		const mb = bytes / (1024 * 1024)
		if (gb >= 1) {
			return `${gb.toFixed(1)} GB`
		}
		return `${mb.toFixed(0)} MB`
	}

	return (
		<div className="p-4 space-y-6">
			{renderSectionHeader("config")}

			{/* Header with save button */}
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-2">
					<Cog className="w-5 h-5" />
					<h2 className="text-lg font-semibold">Configuration Settings</h2>
				</div>
				<VSCodeButton disabled={isSaving} onClick={handleSave}>
					<Save className={`w-4 h-4 mr-2 ${isSaving ? "animate-pulse" : ""}`} />
					{isSaving ? "Saving..." : "Save Changes"}
				</VSCodeButton>
			</div>

			{/* Basic Settings */}
			<div className="space-y-4">
				<h3 className="text-md font-semibold">Basic Settings</h3>

				<div className="grid gap-4">
					{/* Enable/Disable */}
					<div className="flex items-center gap-3">
						<VSCodeCheckbox
							checked={config.enabled}
							onChange={(e) => updateConfig({ enabled: (e.target as HTMLInputElement).checked })}
						/>
						<div>
							<label className="font-medium">Enable Orchestration</label>
							<p className="text-sm text-[var(--vscode-descriptionForeground)]">
								Turn on the Claude-Flow orchestration system
							</p>
						</div>
					</div>

					{/* Max Concurrent Agents */}
					<div className="space-y-2">
						<label className="font-medium">Maximum Concurrent Agents</label>
						<div className="flex items-center gap-4">
							<input
								className="flex-1"
								max="10"
								min="1"
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									updateConfig({ maxConcurrentAgents: parseInt(e.target.value, 10) })
								}
								type="range"
								value={config.maxConcurrentAgents}
							/>
							<span className="text-sm w-8">{config.maxConcurrentAgents}</span>
						</div>
						<p className="text-sm text-[var(--vscode-descriptionForeground)]">
							Maximum number of agents that can run simultaneously
						</p>
					</div>

					{/* Memory Usage Limit */}
					<div className="space-y-2">
						<label className="font-medium">Memory Usage Limit</label>
						<div className="flex items-center gap-4">
							<input
								className="flex-1"
								max={8 * 1024 * 1024 * 1024} // 512MB
								min={512 * 1024 * 1024} // 8GB
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									updateConfig({ maxMemoryUsage: parseInt(e.target.value, 10) })
								}
								type="range"
								value={config.maxMemoryUsage}
							/>
							<span className="text-sm w-16">{formatMemorySize(config.maxMemoryUsage)}</span>
						</div>
						<p className="text-sm text-[var(--vscode-descriptionForeground)]">
							Maximum memory usage for orchestration system
						</p>
					</div>

					{/* Timeout */}
					<div className="space-y-2">
						<label className="font-medium">Task Timeout (minutes)</label>
						<div className="flex items-center gap-4">
							<input
								className="flex-1"
								max="120"
								min="5"
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									updateConfig({ timeoutMinutes: parseInt(e.target.value, 10) })
								}
								type="range"
								value={config.timeoutMinutes}
							/>
							<span className="text-sm w-12">{config.timeoutMinutes}m</span>
						</div>
						<p className="text-sm text-[var(--vscode-descriptionForeground)]">
							Maximum time before a task is considered failed
						</p>
					</div>

					{/* Complexity Threshold */}
					<div className="space-y-2">
						<label className="font-medium">Complexity Threshold</label>
						<div className="flex items-center gap-4">
							<input
								className="flex-1"
								max="1.0"
								min="0.1"
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									updateConfig({ complexityThreshold: parseFloat(e.target.value) })
								}
								step="0.1"
								type="range"
								value={config.complexityThreshold}
							/>
							<span className="text-sm w-8">{config.complexityThreshold.toFixed(1)}</span>
						</div>
						<p className="text-sm text-[var(--vscode-descriptionForeground)]">
							Threshold for determining when to use orchestration vs single agent
						</p>
					</div>
				</div>
			</div>

			{/* Advanced Settings */}
			<div className="space-y-4">
				<h3 className="text-md font-semibold">Advanced Settings</h3>

				<div className="grid gap-4">
					{/* Fallback to Single Agent */}
					<div className="flex items-center gap-3">
						<VSCodeCheckbox
							checked={config.fallbackToSingleAgent}
							onChange={(e) => updateConfig({ fallbackToSingleAgent: (e.target as HTMLInputElement).checked })}
						/>
						<div>
							<label className="font-medium">Fallback to Single Agent</label>
							<p className="text-sm text-[var(--vscode-descriptionForeground)]">
								Automatically fallback to single agent if orchestration fails
							</p>
						</div>
					</div>

					{/* Auto Optimization */}
					<div className="flex items-center gap-3">
						<VSCodeCheckbox
							checked={config.autoOptimization}
							onChange={(e) => updateConfig({ autoOptimization: (e.target as HTMLInputElement).checked })}
						/>
						<div>
							<label className="font-medium">Auto Optimization</label>
							<p className="text-sm text-[var(--vscode-descriptionForeground)]">
								Automatically optimize orchestration strategies based on performance
							</p>
						</div>
					</div>

					{/* Resource Monitoring */}
					<div className="flex items-center gap-3">
						<VSCodeCheckbox
							checked={config.resourceMonitoring}
							onChange={(e) => updateConfig({ resourceMonitoring: (e.target as HTMLInputElement).checked })}
						/>
						<div>
							<label className="font-medium">Resource Monitoring</label>
							<p className="text-sm text-[var(--vscode-descriptionForeground)]">
								Enable detailed resource usage monitoring and reporting
							</p>
						</div>
					</div>

					{/* Debug Mode */}
					<div className="flex items-center gap-3">
						<VSCodeCheckbox
							checked={config.debugMode}
							onChange={(e) => updateConfig({ debugMode: (e.target as HTMLInputElement).checked })}
						/>
						<div>
							<label className="font-medium">Debug Mode</label>
							<p className="text-sm text-[var(--vscode-descriptionForeground)]">
								Enable verbose logging and debugging information
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Current Status */}
			<div className="space-y-4">
				<h3 className="text-md font-semibold">Current Status</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="p-3 border border-[var(--vscode-panel-border)] rounded-lg">
						<div className="text-sm font-medium">System Enabled</div>
						<div className="text-lg">{status.enabled ? "Yes" : "No"}</div>
					</div>
					<div className="p-3 border border-[var(--vscode-panel-border)] rounded-lg">
						<div className="text-sm font-medium">Current Mode</div>
						<div className="text-lg">
							{status.currentMode === OrchestrationMode.ORCHESTRATION_DISABLED && "Disabled"}
							{status.currentMode === OrchestrationMode.ORCHESTRATION_ANALYSIS_ONLY && "Analysis Only"}
							{status.currentMode === OrchestrationMode.ORCHESTRATION_SINGLE_AGENT_FALLBACK &&
								"Single Agent Fallback"}
							{status.currentMode === OrchestrationMode.ORCHESTRATION_FULL_ORCHESTRATION && "Full Orchestration"}
							{status.currentMode === OrchestrationMode.ORCHESTRATION_ADAPTIVE && "Adaptive"}
						</div>
					</div>
					<div className="p-3 border border-[var(--vscode-panel-border)] rounded-lg">
						<div className="text-sm font-medium">Active Tasks</div>
						<div className="text-lg">{status.activeTasks.length}</div>
					</div>
					<div className="p-3 border border-[var(--vscode-panel-border)] rounded-lg">
						<div className="text-sm font-medium">System Health</div>
						<div className="text-lg">{status.health?.isHealthy ? "Healthy" : "Issues"}</div>
					</div>
				</div>
			</div>

			{/* Help Text */}
			<div className="p-4 bg-[var(--vscode-textPreformat-background)] rounded-lg">
				<h4 className="font-medium mb-2">Configuration Guidelines</h4>
				<ul className="text-sm space-y-1 text-[var(--vscode-descriptionForeground)]">
					<li>• Start with 2-3 concurrent agents for optimal performance</li>
					<li>• Higher complexity thresholds result in more single-agent tasks</li>
					<li>• Enable resource monitoring for detailed performance insights</li>
					<li>• Debug mode provides verbose logging but may impact performance</li>
					<li>• Auto optimization learns from usage patterns over time</li>
				</ul>
			</div>
		</div>
	)
}

export default OrchestrationConfigSection
