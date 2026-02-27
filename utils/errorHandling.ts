import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/**
 * Extracts error message from an error object
 */
export function extractErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Extracts HTTP status code from an error object
 */
export function extractStatusCode(error: unknown): number | undefined {
	if (
		typeof error === 'object' &&
		error !== null &&
		'statusCode' in error &&
		typeof error.statusCode === 'number'
	) {
		return error.statusCode;
	}
	return undefined;
}

/**
 * Extracts error code from an error object
 */
export function extractErrorCode(error: unknown): string {
	if (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		typeof error.code === 'string'
	) {
		return error.code;
	}
	return 'unknown_error';
}

/**
 * Standard error handling for n8n nodes
 * Handles error logging, continueOnFail logic, and error response formatting
 */
export function handleNodeError(
	executeFunctions: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
	nodeName: string,
	returnData: INodeExecutionData[]
): void {
	const errorMessage = extractErrorMessage(error);
	const statusCode = extractStatusCode(error);

	// Log detailed error information
	executeFunctions.logger.error(`${nodeName} Error`, {
		error: errorMessage,
		statusCode,
		itemIndex,
	});

	if (executeFunctions.continueOnFail()) {
		const errorCode = extractErrorCode(error);
		returnData.push({
			json: {
				error: errorMessage,
				error_code: errorCode,
				statusCode,
				timestamp: new Date().toISOString(),
			},
			pairedItem: { item: itemIndex },
		});
	} else {
		throw new NodeOperationError(
			executeFunctions.getNode(),
			`${nodeName} failed for item ${itemIndex}: ${errorMessage}`
		);
	}
}
