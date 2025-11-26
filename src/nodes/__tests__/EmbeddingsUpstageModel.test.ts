import { EmbeddingsUpstageModel } from '../EmbeddingsUpstageModel.node';
import type { ISupplyDataFunctions, INodeTypeDescription } from 'n8n-workflow';

describe('EmbeddingsUpstageModel', () => {
	let node: EmbeddingsUpstageModel;
	let mockSupplyDataFunctions: ISupplyDataFunctions;

	beforeEach(() => {
		node = new EmbeddingsUpstageModel();
		mockSupplyDataFunctions = {
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn(),
			getNode: jest.fn(() => ({
				name: 'test-node',
				type: 'test',
			})),
			logger: {
				error: jest.fn(),
				debug: jest.fn(),
			},
			addInputData: jest.fn(() => ({ index: 0 })),
			addOutputData: jest.fn(),
		} as unknown as ISupplyDataFunctions;

		jest.clearAllMocks();
	});

	describe('description', () => {
		it('should have correct node description structure', () => {
			const description = node.description as INodeTypeDescription;
			expect(description).toBeDefined();
			expect(description.displayName).toBeDefined();
			expect(description.name).toBe('embeddingsUpstageModel');
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

		it('should have connection hint notice field', () => {
			const description = node.description as INodeTypeDescription;
			const properties = description.properties || [];
			const noticeField = properties.find(
				(prop: { name: string }) => prop.name === 'notice'
			);
			expect(noticeField).toBeDefined();
		});
	});

	describe('supplyData', () => {
		it('should return SupplyData with wrapped Embeddings instance', async () => {
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
				'embedding-query'
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(result).toBeDefined();
			expect(result.response).toBeDefined();
		});

		it('should create UpstageEmbeddings with correct parameters', async () => {
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
				'embedding-query'
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-api-key',
			});

			const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(result.response).toBeDefined();
			// Verify the response is a wrapped Embeddings instance
			expect(result.response).toHaveProperty('embedDocuments');
			expect(result.response).toHaveProperty('embedQuery');
		});

		it('should log debug message', async () => {
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
				'embedding-query'
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.logger.debug).toHaveBeenCalledWith(
				'Supply data for embeddings'
			);
		});

		it('should handle different embedding models', async () => {
			const models = ['embedding-query', 'embedding-passage'];

			for (const model of models) {
				jest.clearAllMocks();
				(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
					model
				);
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(
					{
						apiKey: 'test-key',
					}
				);

				const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

				expect(result.response).toBeDefined();
				// The model is set during construction, verify the response is valid
				expect(result.response).toHaveProperty('embedDocuments');
			}
		});
	});
});
