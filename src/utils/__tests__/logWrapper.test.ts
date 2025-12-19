import {
	logWrapper,
	callMethodAsync,
} from '../../nodes/EmbeddingsUpstageModel.node';
import type { IExecuteFunctions, ISupplyDataFunctions } from 'n8n-workflow';
import { logAiEvent } from '../telemetry';

// Mock telemetry
jest.mock('../telemetry', () => ({
	logAiEvent: jest.fn(),
}));

/**
 * Mock Embeddings interface implementation
 */
class MockEmbeddings {
	async embedDocuments(texts: string[]): Promise<number[][]> {
		return texts.map(() => Array.from({ length: 3 }, () => Math.random()));
	}

	async embedQuery(text: string): Promise<number[]> {
		return Array.from({ length: 3 }, () => Math.random());
	}
}

describe('logWrapper', () => {
	let mockExecuteFunctions: IExecuteFunctions | ISupplyDataFunctions;
	let mockAddInputData: jest.Mock;
	let mockAddOutputData: jest.Mock;
	let mockGetNode: jest.Mock;

	beforeEach(() => {
		mockAddInputData = jest.fn(() => ({ index: 0 }));
		mockAddOutputData = jest.fn();
		mockGetNode = jest.fn(() => ({
			name: 'test-node',
			type: 'test',
		}));

		mockExecuteFunctions = {
			addInputData: mockAddInputData,
			addOutputData: mockAddOutputData,
			getNode: mockGetNode,
		} as unknown as IExecuteFunctions;

		jest.clearAllMocks();
	});

	describe('embedDocuments', () => {
		it('should wrap embedDocuments method and integrate with n8n data flow', async () => {
			const mockEmbeddings = new MockEmbeddings();
			const wrapped = logWrapper(mockEmbeddings, mockExecuteFunctions);
			const documents = ['doc1', 'doc2'];
			const result = await wrapped.embedDocuments(documents);

			expect(mockAddInputData).toHaveBeenCalledWith('ai_embedding', [
				[{ json: { documents } }],
			]);
			expect(mockAddOutputData).toHaveBeenCalled();
			const outputCall = (mockAddOutputData as jest.Mock).mock.calls[0];
			expect(outputCall[0]).toBe('ai_embedding');
			expect(outputCall[1]).toBe(0);
			expect(Array.isArray(outputCall[2])).toBe(true);
			expect(Array.isArray(outputCall[2][0])).toBe(true);
			expect(outputCall[2][0][0]).toHaveProperty('json');
			expect(outputCall[2][0][0].json).toHaveProperty('response');
			expect(logAiEvent).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'ai-document-embedded'
			);
			// Verify structure and type
			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(2);
			expect(Array.isArray(result[0])).toBe(true);
			expect(result[0]).toHaveLength(3);
			expect(Array.isArray(result[1])).toBe(true);
			expect(result[1]).toHaveLength(3);
			// Verify all values are numbers
			result.forEach(embedding => {
				embedding.forEach(value => {
					expect(typeof value).toBe('number');
				});
			});
		});

		it('should handle errors in embedDocuments', async () => {
			const mockEmbeddings = {
				embedDocuments: jest
					.fn()
					.mockRejectedValue(new Error('Embedding error')),
				embedQuery: jest.fn(),
			} as any;

			const wrapped = logWrapper(mockEmbeddings, mockExecuteFunctions);

			await expect(wrapped.embedDocuments(['doc1'])).rejects.toThrow();

			expect(mockAddInputData).toHaveBeenCalled();
		});
	});

	describe('embedQuery', () => {
		it('should wrap embedQuery method and integrate with n8n data flow', async () => {
			const mockEmbeddings = new MockEmbeddings();
			const wrapped = logWrapper(mockEmbeddings, mockExecuteFunctions);
			const query = 'test query';
			const result = await wrapped.embedQuery(query);

			expect(mockAddInputData).toHaveBeenCalled();
			expect(mockAddOutputData).toHaveBeenCalled();
			expect(logAiEvent).toHaveBeenCalled();
			// Verify structure and type
			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(3);
			result.forEach(value => {
				expect(typeof value).toBe('number');
			});
		});

		it('should handle errors in embedQuery', async () => {
			const mockEmbeddings = {
				embedDocuments: jest.fn(),
				embedQuery: jest
					.fn()
					.mockRejectedValue(new Error('Query embedding error')),
			} as any;

			const wrapped = logWrapper(mockEmbeddings, mockExecuteFunctions);

			await expect(wrapped.embedQuery('test')).rejects.toThrow();

			expect(mockAddInputData).toHaveBeenCalled();
		});
	});

	describe('other properties', () => {
		it('should pass through non-wrapped properties', () => {
			const mockEmbeddings = {
				embedDocuments: jest.fn(),
				someOtherProperty: 'test-value',
			} as any;

			const wrapped = logWrapper(mockEmbeddings, mockExecuteFunctions);

			expect(
				(wrapped as unknown as Record<string, unknown>).someOtherProperty
			).toBe('test-value');
		});
	});
});

describe('callMethodAsync', () => {
	let mockExecuteFunctions: IExecuteFunctions | ISupplyDataFunctions;
	let mockGetNode: jest.Mock;

	beforeEach(() => {
		mockGetNode = jest.fn(() => ({
			name: 'test-node',
			type: 'test',
		}));

		mockExecuteFunctions = {
			getNode: mockGetNode,
		} as unknown as IExecuteFunctions;

		jest.clearAllMocks();
	});

	it('should call method successfully', async () => {
		const mockMethod = jest.fn().mockResolvedValue('success');
		const context = {};

		const result = await callMethodAsync.call(context, {
			executeFunctions: mockExecuteFunctions,
			connectionType: 'ai_embedding',
			currentNodeRunIndex: 0,
			method: mockMethod,
			arguments: ['arg1', 'arg2'],
		});

		expect(mockMethod).toHaveBeenCalledWith('arg1', 'arg2');
		expect(result).toBe('success');
	});

	it('should wrap errors in NodeOperationError', async () => {
		const mockMethod = jest.fn().mockRejectedValue(new Error('Method error'));
		const context = {};

		await expect(
			callMethodAsync.call(context, {
				executeFunctions: mockExecuteFunctions,
				connectionType: 'ai_embedding',
				currentNodeRunIndex: 0,
				method: mockMethod,
				arguments: [],
			})
		).rejects.toThrow();
	});
});
