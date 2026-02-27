import type { INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/**
 * File validation utilities for n8n nodes
 */

/**
 * Validates file size against a maximum limit
 * @param buffer - The file buffer to validate
 * @param maxSizeMB - Maximum file size in megabytes
 * @throws Error if file size exceeds the limit
 */
export function validateFileSize(buffer: Buffer, maxSizeMB: number, node?: INode): void {
	const maxSizeBytes = maxSizeMB * 1024 * 1024;
	const fileSize = buffer.length;

	if (fileSize > maxSizeBytes) {
		const message = `File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of ${maxSizeMB}MB`;
		if (node) {
			throw new NodeOperationError(node, message);
		}
		throw new Error(message);
	}
}

/**
 * Validates file size from binary data object
 * @param fileSize - File size in bytes (from binary data, can be number or string)
 * @param maxSizeMB - Maximum file size in megabytes
 * @throws Error if file size exceeds the limit
 */
export function validateFileSizeFromMetadata(
	fileSize: number | string | undefined,
	maxSizeMB: number,
	node?: INode
): void {
	if (fileSize === undefined) {
		// If file size is not available, skip validation
		// Actual size will be checked when buffer is loaded
		return;
	}

	// Convert string to number if needed
	const sizeAsNumber =
		typeof fileSize === 'string' ? parseInt(fileSize, 10) : fileSize;

	if (isNaN(sizeAsNumber) || typeof sizeAsNumber !== 'number') {
		// If file size is not a valid number, skip validation
		// Actual size will be checked when buffer is loaded
		return;
	}

	const maxSizeBytes = maxSizeMB * 1024 * 1024;

	if (sizeAsNumber > maxSizeBytes) {
		const message = `File size (${(sizeAsNumber / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of ${maxSizeMB}MB`;
		if (node) {
			throw new NodeOperationError(node, message);
		}
		throw new Error(message);
	}
}
