// Temporary stub file for event bus
// This will be replaced with the actual event bus once the Claude-Flow integration is complete

export interface IEventBus {
	emit(event: string, data?: any): void
	on(event: string, handler: (data?: any) => void): void
	off(event: string, handler: (data?: any) => void): void
}

export class EventBus implements IEventBus {
	private static instance: EventBus
	private listeners = new Map<string, Set<(data?: any) => void>>()

	static getInstance(): EventBus {
		if (!EventBus.instance) {
			EventBus.instance = new EventBus()
		}
		return EventBus.instance
	}

	emit(event: string, data?: any): void {
		const handlers = this.listeners.get(event)
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(data)
				} catch (error) {
					console.error(`Error in event handler for ${event}:`, error)
				}
			})
		}
	}

	on(event: string, handler: (data?: any) => void): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set())
		}
		this.listeners.get(event)!.add(handler)
	}

	off(event: string, handler: (data?: any) => void): void {
		const handlers = this.listeners.get(event)
		if (handlers) {
			handlers.delete(handler)
			if (handlers.size === 0) {
				this.listeners.delete(event)
			}
		}
	}
}
