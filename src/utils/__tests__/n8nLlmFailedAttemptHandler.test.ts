import { makeN8nLlmFailedAttemptHandler } from '../n8nLlmFailedAttemptHandler';
import { NodeApiError } from 'n8n-workflow';
import type { ISupplyDataFunctions } from 'n8n-workflow';

interface RetryableError extends Error {
	code?: string;
	status?: number;
	retriesLeft?: number;
}

describe('n8nLlmFailedAttemptHandler', () => {
	const mockGetNode = jest.fn(() => ({
		name: 'test-node',
		type: 'test',
	}));

	const mockCtx: ISupplyDataFunctions = {
		getNode: mockGetNode,
	} as unknown as ISupplyDataFunctions;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should wrap error in NodeApiError when custom handler throws', () => {
		const customHandler = jest.fn(() => {
			throw new Error('Custom handler error');
		});

		const handler = makeN8nLlmFailedAttemptHandler(mockCtx, customHandler);
		const error: RetryableError = new Error('Test error');
		error.status = 400;

		expect(() => {
			handler(error);
		}).toThrow(NodeApiError);

		expect(customHandler).toHaveBeenCalledWith(error);
	});

	it('should use default handler when custom handler does not throw', () => {
		const customHandler = jest.fn(); // Does not throw

		const handler = makeN8nLlmFailedAttemptHandler(mockCtx, customHandler);
		const error: RetryableError = new Error('Test error');
		error.status = 500; // Retryable error
		error.retriesLeft = 1; // Has retries left

		// Should not throw for retryable errors when retries are left
		expect(() => {
			handler(error);
		}).not.toThrow();

		expect(customHandler).toHaveBeenCalledWith(error);
	});

	it('should not throw when retries are left', () => {
		const handler = makeN8nLlmFailedAttemptHandler(mockCtx);
		const error: RetryableError = new Error('Test error');
		error.status = 500; // Retryable error
		error.retriesLeft = 3;

		expect(() => {
			handler(error);
		}).not.toThrow();
	});

	it('should throw NodeApiError when no retries left', () => {
		const handler = makeN8nLlmFailedAttemptHandler(mockCtx);
		const error: RetryableError = new Error('Test error');
		error.retriesLeft = 0;

		expect(() => {
			handler(error);
		}).toThrow(NodeApiError);
	});

	it('should throw NodeApiError when retriesLeft is undefined', () => {
		const handler = makeN8nLlmFailedAttemptHandler(mockCtx);
		const error: RetryableError = new Error('Test error');
		// retriesLeft is undefined

		expect(() => {
			handler(error);
		}).toThrow(NodeApiError);
	});

	it('should handle network errors through default handler', () => {
		const handler = makeN8nLlmFailedAttemptHandler(mockCtx);
		const error: RetryableError = new Error('Network error');
		error.code = 'ECONNRESET';
		error.retriesLeft = 1;

		// Should not throw for retryable network errors
		expect(() => {
			handler(error);
		}).not.toThrow();
	});

	it('should handle server errors through default handler', () => {
		const handler = makeN8nLlmFailedAttemptHandler(mockCtx);
		const error: RetryableError = new Error('Server error');
		error.status = 500;
		error.retriesLeft = 1;

		// Should not throw for retryable server errors
		expect(() => {
			handler(error);
		}).not.toThrow();
	});

	it('should work without custom handler', () => {
		const handler = makeN8nLlmFailedAttemptHandler(mockCtx);
		const error: RetryableError = new Error('Test error');
		error.status = 500;
		error.retriesLeft = 1;

		expect(() => {
			handler(error);
		}).not.toThrow();
	});
});
