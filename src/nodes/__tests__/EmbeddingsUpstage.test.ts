import { EmbeddingsUpstage } from '../EmbeddingsUpstage.node';
import type { IExecuteFunctions, INodeTypeDescription } from 'n8n-workflow';

describe('EmbeddingsUpstage', () => {
	let node: EmbeddingsUpstage;
	let mockExecuteFunctions: IExecuteFunctions;
	let mockHttpRequest: jest.Mock;

	beforeEach(() => {
		node = new EmbeddingsUpstage();
		mockHttpRequest = jest.fn();
		mockExecuteFunctions = {
			getInputData: jest.fn(),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn(),
			helpers: {
				httpRequestWithAuthentication: {
					call: mockHttpRequest,
				},
			},
			getNode: jest.fn(() => ({
				name: 'test-node',
				type: 'test',
			})),
			continueOnFail: jest.fn().mockReturnValue(false),
			logger: {
				error: jest.fn(),
				debug: jest.fn(),
			},
		} as unknown as IExecuteFunctions;
	});

	describe('description', () => {
		it('should have correct node description structure', () => {
			const description = node.description as INodeTypeDescription;
			expect(description).toBeDefined();
			expect(description.displayName).toBeDefined();
			expect(description.name).toBe('embeddingsUpstage');
			expect(description.group).toBeDefined();
			expect(description.version).toBeDefined();
		});

		it('should have credentials configured', () => {
			const description = node.description as INodeTypeDescription;
			expect(description.credentials).toBeDefined();
			if (description.credentials) {
				expect(description.credentials).toHaveLength(1);
				expect(description.credentials[0].name).toBe('upstageApi');
			}
		});
	});

	describe('execute', () => {
		it('should validate input text is provided for single input', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'model') return 'embedding-query';
					if (param === 'inputType') return 'single';
					if (param === 'textField') return '';
					if (param === 'text') return '';
					return defaultValue;
				}
			);

			await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'No input text provided'
			);
		});

		it('should validate input text is provided for array input', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'model') return 'embedding-query';
					if (param === 'inputType') return 'array';
					if (param === 'texts') return '';
					return undefined;
				}
			);

			await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'No input text provided'
			);
		});

		it('should handle single text input from parameter', async () => {
			// Use dynamic mock values instead of hardcoded embeddings
			const mockEmbedding = Array.from({ length: 3 }, () => Math.random());
			const mockResponse = {
				data: [
					{
						index: 0,
						embedding: mockEmbedding,
					},
				],
			};

			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'model') return 'embedding-query';
					if (param === 'inputType') return 'single';
					if (param === 'textField') return '';
					if (param === 'text') return 'test text';
					return defaultValue;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			mockHttpRequest.mockResolvedValue(mockResponse);

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toBeDefined();
			expect(result[0]).toBeDefined();
			expect(result[0][0].json).toBeDefined();
			// Verify response structure instead of exact values
			expect(result[0][0].json).toHaveProperty('embedding');
			expect(Array.isArray(result[0][0].json.embedding)).toBe(true);
			expect(result[0][0].json.embedding).toHaveLength(3);
			// Verify API was called with correct parameters
			expect(mockHttpRequest).toHaveBeenCalled();
			expect(mockHttpRequest.mock.calls.length).toBeGreaterThan(0);
			const requestOptions = mockHttpRequest.mock.calls[0][2];
			expect(requestOptions).toBeDefined();
			expect(requestOptions.body).toBeDefined();
			expect(requestOptions.body.input).toBe('test text');
			expect(requestOptions.body.model).toBe('embedding-query');
		});

		it('should handle single text input from input data field', async () => {
			// Use dynamic mock values instead of hardcoded embeddings
			const mockEmbedding = Array.from({ length: 3 }, () => Math.random());
			const mockResponse = {
				data: [
					{
						index: 0,
						embedding: mockEmbedding,
					},
				],
			};

			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: { textField: 'test text from field' } },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'model') return 'embedding-query';
					if (param === 'inputType') return 'single';
					if (param === 'textField') return 'textField';
					return defaultValue;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			mockHttpRequest.mockResolvedValue(mockResponse);

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toBeDefined();
			// Verify API was called with correct parameters
			expect(mockHttpRequest).toHaveBeenCalled();
			expect(mockHttpRequest.mock.calls.length).toBeGreaterThan(0);
			const requestOptions = mockHttpRequest.mock.calls[0][2];
			expect(requestOptions).toBeDefined();
			expect(requestOptions.body).toBeDefined();
			expect(requestOptions.body.input).toBe('test text from field');
			expect(requestOptions.body.model).toBe('embedding-query');
		});

		it('should handle array text input', async () => {
			// Use dynamic mock values instead of hardcoded embeddings
			const mockEmbeddings = [
				Array.from({ length: 2 }, () => Math.random()),
				Array.from({ length: 2 }, () => Math.random()),
			];
			const mockResponse = {
				data: [
					{ index: 0, embedding: mockEmbeddings[0] },
					{ index: 1, embedding: mockEmbeddings[1] },
				],
			};

			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'model') return 'embedding-query';
					if (param === 'inputType') return 'array';
					if (param === 'texts') return 'text1\ntext2';
					return undefined;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			mockHttpRequest.mockResolvedValue(mockResponse);

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toBeDefined();
			expect(result[0]).toBeDefined();
			// Verify response structure - array input returns single item with embeddings array
			expect(result[0]).toHaveLength(1);
			const resultItem = result[0][0];
			expect(resultItem).toBeDefined();
			expect(resultItem.json).toHaveProperty('embeddings');
			const embeddings = resultItem.json.embeddings as Array<{
				embedding: number[];
			}>;
			expect(Array.isArray(embeddings)).toBe(true);
			expect(embeddings).toHaveLength(2);
			embeddings.forEach((item: { embedding: number[] }) => {
				expect(item).toHaveProperty('embedding');
				expect(Array.isArray(item.embedding)).toBe(true);
				expect(item.embedding).toHaveLength(2);
			});
			// Verify API was called with correct parameters
			expect(mockHttpRequest).toHaveBeenCalled();
			expect(mockHttpRequest.mock.calls.length).toBeGreaterThan(0);
			const requestOptions = mockHttpRequest.mock.calls[0][2];
			expect(requestOptions).toBeDefined();
			expect(requestOptions.body).toBeDefined();
			expect(requestOptions.body.input).toEqual(['text1', 'text2']);
			expect(requestOptions.body.model).toBe('embedding-query');
		});
	});
});
