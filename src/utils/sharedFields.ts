import type { INodeProperties } from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

/**
 * Known AI connection types that follow the standard pattern
 */
const KNOWN_AI_TYPES = new Set<NodeConnectionType>([
	'ai_agent',
	'ai_chain',
	'ai_document',
	'ai_embedding',
	'ai_languageModel',
	'ai_memory',
	'ai_outputParser',
	'ai_retriever',
	'ai_textSplitter',
	'ai_tool',
	'ai_vectorStore',
]);

/**
 * Converts a NodeConnectionType string to a human-readable display name
 *
 * Pattern for known AI types:
 * - Removes 'ai_' prefix
 * - Converts underscores to spaces
 * - Splits camelCase words (e.g., 'languageModel' -> 'language Model')
 * - Capitalizes first letter of each word
 * - Adds 'AI' prefix
 *
 * For unknown types, returns the original value as-is.
 *
 * Examples:
 * - 'ai_agent' -> 'AI Agent'
 * - 'ai_languageModel' -> 'AI Language Model'
 * - 'ai_outputParser' -> 'AI Output Parser'
 * - 'unknown_type' -> 'unknown_type' (unchanged)
 */
function formatConnectionType(type: NodeConnectionType): string {
	// For unknown types, return as-is
	if (!KNOWN_AI_TYPES.has(type)) {
		return type;
	}

	// Remove 'ai_' prefix
	let formatted = type.slice(3);

	// Split camelCase: insert space before uppercase letters
	formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');

	// Replace underscores with spaces
	formatted = formatted.replace(/_/g, ' ');

	// Capitalize first letter of each word
	formatted = formatted
		.split(' ')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');

	// Add 'AI' prefix
	return `AI ${formatted}`;
}

/**
 * Get the connection hint field for a node
 *
 * Creates a notice field that displays which node types can be connected
 * to this node. Used primarily in LangChain-compatible nodes.
 *
 * @param allowedConnectionTypes - Array of NodeConnectionType values that this node accepts
 * @returns INodeProperties object representing a notice field
 */
export function getConnectionHintNoticeField(
	allowedConnectionTypes: NodeConnectionType[]
): INodeProperties {
	const connectionTypes = allowedConnectionTypes
		.map(formatConnectionType)
		.join(', ');

	return {
		displayName: '',
		name: 'notice',
		type: 'notice',
		default: '',
		description: `Connect this node to: ${connectionTypes}`,
	};
}
