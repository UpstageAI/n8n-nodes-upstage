import type {
	IDataObject,
	IExecuteFunctions,
	ISupplyDataFunctions,
} from 'n8n-workflow';

/**
 * Log AI events for telemetry
 */
export function logAiEvent(
	executeFunctions: IExecuteFunctions | ISupplyDataFunctions,
	event: string,
	data?: IDataObject
): void {
	try {
		// Check if sendTelemetry method exists before calling
		if (
			'sendTelemetry' in executeFunctions &&
			typeof executeFunctions.sendTelemetry === 'function'
		) {
			executeFunctions.sendTelemetry(event, data);
		}
	} catch (error) {
		// Log telemetry failure for debugging, but don't throw
		// IExecuteFunctions and ISupplyDataFunctions always have logger
		executeFunctions.logger.debug('Failed to send telemetry event', {
			event,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
