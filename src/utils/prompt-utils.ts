/**
 * Utility functions for prompt handling and manipulation
 */

export interface PromptTemplate {
	id: string
	name: string
	content: string
	variables?: string[]
	category?: string
}

export interface PromptCopyOptions {
	includeVariables?: boolean
	format?: "markdown" | "plain" | "json"
	destination?: string
}

/**
 * Copies prompts with optional formatting and filtering
 */
export function copyPrompts(prompts: PromptTemplate[], options: PromptCopyOptions = {}): string {
	const { includeVariables = true, format = "markdown" } = options

	return prompts
		.map((prompt) => {
			switch (format) {
				case "json":
					return JSON.stringify(prompt, null, 2)
				case "plain":
					return `${prompt.name}: ${prompt.content}`
				case "markdown":
				default:
					let result = `## ${prompt.name}\n\n${prompt.content}`
					if (includeVariables && prompt.variables?.length) {
						result += `\n\n**Variables:** ${prompt.variables.join(", ")}`
					}
					return result
			}
		})
		.join("\n\n---\n\n")
}

/**
 * Validates prompt template structure
 */
export function validatePromptTemplate(prompt: any): prompt is PromptTemplate {
	return (
		typeof prompt === "object" &&
		prompt !== null &&
		typeof prompt.id === "string" &&
		typeof prompt.name === "string" &&
		typeof prompt.content === "string"
	)
}

/**
 * Merges prompt templates with variable substitution
 */
export function mergePromptTemplate(template: PromptTemplate, variables: Record<string, string>): string {
	let content = template.content

	// Replace variables in the format {{variableName}}
	Object.entries(variables).forEach(([key, value]) => {
		const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g")
		content = content.replace(regex, value)
	})

	return content
}

/**
 * Extracts variables from prompt template content
 */
export function extractPromptVariables(content: string): string[] {
	const regex = /\{\{(\w+)\}\}/g
	const variables: string[] = []
	let match

	while ((match = regex.exec(content)) !== null) {
		if (!variables.includes(match[1])) {
			variables.push(match[1])
		}
	}

	return variables
}
