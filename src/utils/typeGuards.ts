/**
 * Type guard utilities for n8n nodes
 */

import type { IDataObject } from 'n8n-workflow';

/**
 * Type guard for chat completion response
 */
export interface ChatCompletionResponse {
	choices?: Array<{
		message?: {
			content?: string;
			role?: string;
		};
		finish_reason?: string;
	}>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
	model?: string;
	created?: number;
}

/**
 * Checks if an object is a valid chat completion response
 */
export function isChatCompletionResponse(
	obj: unknown
): obj is ChatCompletionResponse {
	if (!obj || typeof obj !== 'object') {
		return false;
	}

	const response = obj as Record<string, unknown>;

	// Check if choices array exists and has at least one element
	if (
		!Array.isArray(response.choices) ||
		response.choices.length === 0 ||
		!response.choices[0] ||
		typeof response.choices[0] !== 'object'
	) {
		return false;
	}

	const firstChoice = response.choices[0] as Record<string, unknown>;

	// Check if message exists and has content
	if (
		!firstChoice.message ||
		typeof firstChoice.message !== 'object' ||
		!(firstChoice.message as Record<string, unknown>).content
	) {
		return false;
	}

	return true;
}

/**
 * Type guard for embedding response
 */
export interface EmbeddingResponse {
	data?: Array<{
		embedding?: number[];
		index?: number;
		text?: string;
	}>;
}

/**
 * Checks if an object is a valid embedding response
 */
export function isEmbeddingResponse(obj: unknown): obj is EmbeddingResponse {
	if (!obj || typeof obj !== 'object') {
		return false;
	}

	const response = obj as Record<string, unknown>;

	// Check if data array exists
	if (!Array.isArray(response.data)) {
		return false;
	}

	// Check if at least one item has embedding array
	return response.data.some(
		item =>
			item &&
			typeof item === 'object' &&
			Array.isArray((item as Record<string, unknown>).embedding)
	);
}

/**
 * Type guard for document parsing response
 */
export interface DocumentParsingResponse {
	content?: {
		html?: string;
		markdown?: string;
		text?: string;
	};
	elements?: IDataObject[];
}

/**
 * Checks if an object is a valid document parsing response
 */
export function isDocumentParsingResponse(
	obj: unknown
): obj is DocumentParsingResponse {
	if (!obj || typeof obj !== 'object') {
		return false;
	}

	const response = obj as Record<string, unknown>;

	// Check if content exists and is an object
	if (response.content && typeof response.content !== 'object') {
		return false;
	}

	// Check if elements exists and is an array
	if (response.elements && !Array.isArray(response.elements)) {
		return false;
	}

	// At least one of content or elements should exist
	return !!(response.content || response.elements);
}

/**
 * Type guard for document OCR response
 */
export interface DocumentOCRResponse {
	text?: string;
	pages?: Array<{
		text?: string;
		words?: Array<{
			text?: string;
			confidence?: number;
			boundingBox?: IDataObject;
		}>;
		pageNumber?: number;
	}>;
	confidence?: number;
	modelVersion?: string;
	numBilledPages?: number;
}

/**
 * Checks if an object is a valid document OCR response
 */
export function isDocumentOCRResponse(
	obj: unknown
): obj is DocumentOCRResponse {
	if (!obj || typeof obj !== 'object') {
		return false;
	}

	const response = obj as Record<string, unknown>;

	// At least one of text, pages, or confidence should exist
	return !!(
		response.text ||
		response.pages ||
		response.confidence !== undefined
	);
}
