import {
	extractErrorMessage,
	extractStatusCode,
	extractErrorCode,
	handleNodeError,
} from '../errorHandling';
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

describe('errorHandling', () => {
	describe('extractErrorMessage', () => {
		it('should extract message from Error instance', () => {
			const error = new Error('Test error message');
			expect(extractErrorMessage(error)).toBe('Test error message');
		});

		it('should return default message for non-Error objects', () => {
			expect(extractErrorMessage('string error')).toBe('Unknown error');
			expect(extractErrorMessage(null)).toBe('Unknown error');
			expect(extractErrorMessage(undefined)).toBe('Unknown error');
			expect(extractErrorMessage({})).toBe('Unknown error');
		});
	});

	describe('extractStatusCode', () => {
		it('should extract statusCode from error object', () => {
			const error = { statusCode: 404 };
			expect(extractStatusCode(error)).toBe(404);
		});

		it('should return undefined for errors without statusCode', () => {
			expect(extractStatusCode(new Error('test'))).toBeUndefined();
			expect(extractStatusCode({})).toBeUndefined();
			expect(extractStatusCode(null)).toBeUndefined();
		});

		it('should return undefined for non-numeric statusCode', () => {
			const error = { statusCode: '404' };
			expect(extractStatusCode(error)).toBeUndefined();
		});
	});

	describe('extractErrorCode', () => {
		it('should extract code from error object', () => {
			const error = { code: 'ECONNREFUSED' };
			expect(extractErrorCode(error)).toBe('ECONNREFUSED');
		});

		it('should return default code for errors without code', () => {
			expect(extractErrorCode(new Error('test'))).toBe('unknown_error');
			expect(extractErrorCode({})).toBe('unknown_error');
			expect(extractErrorCode(null)).toBe('unknown_error');
		});

		it('should return default code for non-string code', () => {
			const error = { code: 404 };
			expect(extractErrorCode(error)).toBe('unknown_error');
		});
	});

	describe('handleNodeError', () => {
		let mockExecuteFunctions: IExecuteFunctions;
		let mockLogger: { error: jest.Mock };
		let mockContinueOnFail: jest.Mock;
		let returnData: INodeExecutionData[];

		beforeEach(() => {
			mockLogger = {
				error: jest.fn(),
			};
			mockContinueOnFail = jest.fn();
			returnData = [];

			mockExecuteFunctions = {
				logger: mockLogger,
				continueOnFail: mockContinueOnFail,
				getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
			} as unknown as IExecuteFunctions;
		});

		it('should log error and throw when continueOnFail is false', () => {
			mockContinueOnFail.mockReturnValue(false);
			const error = new Error('Test error');

			expect(() => {
				handleNodeError(
					mockExecuteFunctions,
					error,
					0,
					'Test Node',
					returnData
				);
			}).toThrow('Test Node failed for item 0: Test error');

			expect(mockLogger.error).toHaveBeenCalledWith('Test Node Error', {
				error: 'Test error',
				statusCode: undefined,
				itemIndex: 0,
			});
			expect(returnData).toHaveLength(0);
		});

		it('should log error and add to returnData when continueOnFail is true', () => {
			mockContinueOnFail.mockReturnValue(true);
			const error = new Error('Test error');

			handleNodeError(mockExecuteFunctions, error, 1, 'Test Node', returnData);

			expect(mockLogger.error).toHaveBeenCalledWith('Test Node Error', {
				error: 'Test error',
				statusCode: undefined,
				itemIndex: 1,
			});
			expect(returnData).toHaveLength(1);
			expect(returnData[0].json).toMatchObject({
				error: 'Test error',
				error_code: 'unknown_error',
				statusCode: undefined,
			});
			expect(returnData[0].json.timestamp).toBeDefined();
			expect(returnData[0].pairedItem).toEqual({ item: 1 });
		});

		it('should extract statusCode and errorCode from error object', () => {
			mockContinueOnFail.mockReturnValue(true);
			const error = {
				message: 'API Error',
				statusCode: 429,
				code: 'RATE_LIMIT_EXCEEDED',
			};

			handleNodeError(mockExecuteFunctions, error, 2, 'Test Node', returnData);

			expect(mockLogger.error).toHaveBeenCalledWith('Test Node Error', {
				error: 'Unknown error',
				statusCode: 429,
				itemIndex: 2,
			});
			expect(returnData[0].json).toMatchObject({
				error: 'Unknown error',
				error_code: 'RATE_LIMIT_EXCEEDED',
				statusCode: 429,
			});
		});

		it('should handle Error instance with statusCode property', () => {
			mockContinueOnFail.mockReturnValue(true);
			const error = Object.assign(new Error('Network error'), {
				statusCode: 500,
				code: 'ECONNRESET',
			});

			handleNodeError(mockExecuteFunctions, error, 3, 'Test Node', returnData);

			expect(mockLogger.error).toHaveBeenCalledWith('Test Node Error', {
				error: 'Network error',
				statusCode: 500,
				itemIndex: 3,
			});
			expect(returnData[0].json).toMatchObject({
				error: 'Network error',
				error_code: 'ECONNRESET',
				statusCode: 500,
			});
		});
	});
});
