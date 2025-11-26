import { logAiEvent } from '../telemetry';
import type { IExecuteFunctions, ISupplyDataFunctions } from 'n8n-workflow';

describe('telemetry', () => {
	describe('logAiEvent', () => {
		it('should call sendTelemetry when method exists', () => {
			const mockSendTelemetry = jest.fn();
			const mockExecuteFunctions = {
				sendTelemetry: mockSendTelemetry,
			} as unknown as IExecuteFunctions;

			logAiEvent(mockExecuteFunctions, 'test-event', { key: 'value' });

			expect(mockSendTelemetry).toHaveBeenCalledWith('test-event', {
				key: 'value',
			});
		});

		it('should not throw when sendTelemetry does not exist', () => {
			const mockExecuteFunctions = {} as IExecuteFunctions;

			expect(() => {
				logAiEvent(mockExecuteFunctions, 'test-event');
			}).not.toThrow();
		});

		it('should not throw when sendTelemetry is not a function', () => {
			const mockExecuteFunctions = {
				sendTelemetry: 'not-a-function',
			} as unknown as IExecuteFunctions;

			expect(() => {
				logAiEvent(mockExecuteFunctions, 'test-event');
			}).not.toThrow();
		});

		it('should log error when sendTelemetry throws an error', () => {
			const mockSendTelemetry = jest.fn(() => {
				throw new Error('Telemetry error');
			});
			const mockLogger = {
				debug: jest.fn(),
			};
			const mockExecuteFunctions = {
				sendTelemetry: mockSendTelemetry,
				logger: mockLogger,
			} as unknown as IExecuteFunctions;

			expect(() => {
				logAiEvent(mockExecuteFunctions, 'test-event');
			}).not.toThrow();

			expect(mockLogger.debug).toHaveBeenCalledWith(
				'Failed to send telemetry event',
				{
					event: 'test-event',
					error: 'Telemetry error',
				}
			);
		});

		it('should work with ISupplyDataFunctions', () => {
			const mockSendTelemetry = jest.fn();
			const mockSupplyDataFunctions = {
				sendTelemetry: mockSendTelemetry,
			} as unknown as ISupplyDataFunctions;

			logAiEvent(mockSupplyDataFunctions, 'test-event', { key: 'value' });

			expect(mockSendTelemetry).toHaveBeenCalledWith('test-event', {
				key: 'value',
			});
		});

		it('should handle undefined data parameter', () => {
			const mockSendTelemetry = jest.fn();
			const mockExecuteFunctions = {
				sendTelemetry: mockSendTelemetry,
			} as unknown as IExecuteFunctions;

			logAiEvent(mockExecuteFunctions, 'test-event');

			expect(mockSendTelemetry).toHaveBeenCalledWith('test-event', undefined);
		});
	});
});
