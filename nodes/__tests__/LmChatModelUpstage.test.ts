import { LmChatModelUpstage } from '../LmChatModelUpstage.node';
import type {
	ISupplyDataFunctions,
	INodeTypeDescription,
} from 'n8n-workflow';

// Mock @n8n/ai-node-sdk
jest.mock('@n8n/ai-node-sdk', () => ({
	supplyModel: jest.fn(() => ({
		response: { mocked: true },
	})),
}));

import { supplyModel } from '@n8n/ai-node-sdk';

describe('LmChatModelUpstage', () => {
	let node: LmChatModelUpstage;
	let mockSupplyDataFunctions: ISupplyDataFunctions;

	beforeEach(() => {
		node = new LmChatModelUpstage();
		mockSupplyDataFunctions = {
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn(),
			getNode: jest.fn(() => ({
				name: 'test-node',
				type: 'test',
			})),
			helpers: {
				httpRequest: jest.fn(),
				httpRequestWithAuthentication: {
					call: jest.fn(),
				},
			},
			logger: {
				error: jest.fn(),
				debug: jest.fn(),
				warn: jest.fn(),
			},
			addInputData: jest.fn(() => ({ index: 0 })),
			addOutputData: jest.fn(),
		} as unknown as ISupplyDataFunctions;

		jest.clearAllMocks();
		// Re-setup the default mock return after clearAllMocks
		(supplyModel as jest.Mock).mockReturnValue({
			response: { mocked: true },
		});
	});

	describe('description', () => {
		it('should have correct node description structure', () => {
			const description = node.description as INodeTypeDescription;
			expect(description).toBeDefined();
			expect(description.displayName).toBeDefined();
			expect(description.name).toBe('lmChatModelUpstage');
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

		it('should output ai_languageModel', () => {
			const description = node.description as INodeTypeDescription;
			expect(description.outputs).toContain('ai_languageModel');
		});
	});

	describe('supplyData', () => {
		it('should call supplyModel with correct config', async () => {
			(
				mockSupplyDataFunctions.getNodeParameter as jest.Mock
			).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'model') return 'solar-mini';
					if (param === 'response_format') return 'default';
					if (param === 'json_schema') return '{}';
					if (param === 'options') {
						return {
							temperature: 0.7,
							maxTokens: 1000,
							streaming: false,
						};
					}
					return defaultValue;
				}
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(result).toBeDefined();
			expect(supplyModel).toHaveBeenCalledWith(
				mockSupplyDataFunctions,
				expect.objectContaining({
					type: 'openai',
					baseUrl: 'https://api.upstage.ai/v1',
					apiKey: 'test-key',
					model: 'solar-mini',
					temperature: 0.7,
					maxTokens: 1000,
					streaming: false,
				})
			);
		});

		it('should pass frequency and presence penalty', async () => {
			(
				mockSupplyDataFunctions.getNodeParameter as jest.Mock
			).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'model') return 'solar-mini';
					if (param === 'response_format') return 'default';
					if (param === 'json_schema') return '{}';
					if (param === 'options') {
						return {
							frequencyPenalty: 0.5,
							presencePenalty: -0.3,
						};
					}
					return defaultValue;
				}
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(supplyModel).toHaveBeenCalledWith(
				mockSupplyDataFunctions,
				expect.objectContaining({
					frequencyPenalty: 0.5,
					presencePenalty: -0.3,
				})
			);
		});

		it('should pass reasoning effort when provided', async () => {
			(
				mockSupplyDataFunctions.getNodeParameter as jest.Mock
			).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'model') return 'solar-mini';
					if (param === 'response_format') return 'default';
					if (param === 'json_schema') return '{}';
					if (param === 'options') {
						return {
							reasoning_effort: 'high',
						};
					}
					return defaultValue;
				}
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(supplyModel).toHaveBeenCalledWith(
				mockSupplyDataFunctions,
				expect.objectContaining({
					reasoning: { effort: 'high' },
				})
			);
		});

		it('should not include maxTokens when value is <= 0', async () => {
			(
				mockSupplyDataFunctions.getNodeParameter as jest.Mock
			).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'model') return 'solar-mini';
					if (param === 'response_format') return 'default';
					if (param === 'json_schema') return '{}';
					if (param === 'options') {
						return { maxTokens: -1 };
					}
					return defaultValue;
				}
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(supplyModel).toHaveBeenCalledWith(
				mockSupplyDataFunctions,
				expect.objectContaining({
					maxTokens: undefined,
				})
			);
		});

		it('should auto-select model when model parameter is empty', async () => {
			const mockModelsResponse = {
				data: [
					{ id: 'solar-mini-20240101' },
					{ id: 'solar-pro-20240101' },
					{ id: 'other-model' },
				],
			};

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
				''
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			(mockSupplyDataFunctions.helpers.httpRequestWithAuthentication.call as jest.Mock).mockResolvedValue(
				mockModelsResponse
			);

			await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.helpers.httpRequestWithAuthentication.call).toHaveBeenCalled();
			expect(supplyModel).toHaveBeenCalledWith(
				mockSupplyDataFunctions,
				expect.objectContaining({
					type: 'openai',
				})
			);
		});

		it('should handle model auto-selection failure gracefully', async () => {
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
				''
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			(mockSupplyDataFunctions.helpers.httpRequest as jest.Mock).mockRejectedValue(
				new Error('API Error')
			);

			await node.supplyData.call(mockSupplyDataFunctions, 0);

			// Should use fallback model
			expect(supplyModel).toHaveBeenCalledWith(
				mockSupplyDataFunctions,
				expect.objectContaining({
					model: 'solar-pro3',
				})
			);
		});

		describe('Response Format', () => {
			it('should not set additionalParams when response_format is default', async () => {
				(
					mockSupplyDataFunctions.getNodeParameter as jest.Mock
				).mockImplementation(
					(param: string, _i: number, defaultValue?: unknown) => {
						if (param === 'model') return 'solar-mini';
						if (param === 'response_format') return 'default';
						if (param === 'json_schema') return '{}';
						if (param === 'options') return {};
						return defaultValue;
					}
				);
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(
					{
						apiKey: 'test-key',
					}
				);

				await node.supplyData.call(mockSupplyDataFunctions, 0);

				expect(supplyModel).toHaveBeenCalledWith(
					mockSupplyDataFunctions,
					expect.objectContaining({
						additionalParams: undefined,
					})
				);
			});

			it('should set json_object response format', async () => {
				(
					mockSupplyDataFunctions.getNodeParameter as jest.Mock
				).mockImplementation(
					(param: string, _i: number, defaultValue?: unknown) => {
						if (param === 'model') return 'solar-pro2';
						if (param === 'response_format') return 'json_object';
						if (param === 'json_schema') return '{}';
						if (param === 'options') return {};
						return defaultValue;
					}
				);
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(
					{
						apiKey: 'test-key',
					}
				);

				await node.supplyData.call(mockSupplyDataFunctions, 0);

				expect(supplyModel).toHaveBeenCalledWith(
					mockSupplyDataFunctions,
					expect.objectContaining({
						additionalParams: {
							response_format: { type: 'json_object' },
						},
					})
				);
			});

			it('should set json_schema response format with valid schema', async () => {
				const validSchema = {
					type: 'object',
					properties: {
						name: { type: 'string' },
						age: { type: 'number' },
					},
					required: ['name'],
				};

				(
					mockSupplyDataFunctions.getNodeParameter as jest.Mock
				).mockImplementation(
					(param: string, _i: number, defaultValue?: unknown) => {
						if (param === 'model') return 'solar-pro2';
						if (param === 'response_format') return 'json_schema';
						if (param === 'json_schema') return JSON.stringify(validSchema);
						if (param === 'options') return {};
						return defaultValue;
					}
				);
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(
					{
						apiKey: 'test-key',
					}
				);

				await node.supplyData.call(mockSupplyDataFunctions, 0);

				expect(supplyModel).toHaveBeenCalledWith(
					mockSupplyDataFunctions,
					expect.objectContaining({
						additionalParams: {
							response_format: {
								type: 'json_schema',
								json_schema: validSchema,
							},
						},
					})
				);
			});

			it('should throw error when json_schema is invalid JSON', async () => {
				(
					mockSupplyDataFunctions.getNodeParameter as jest.Mock
				).mockImplementation(
					(param: string, _i: number, defaultValue?: unknown) => {
						if (param === 'model') return 'solar-pro2';
						if (param === 'response_format') return 'json_schema';
						if (param === 'json_schema') return 'invalid json string{';
						if (param === 'options') return {};
						return defaultValue;
					}
				);
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(
					{
						apiKey: 'test-key',
					}
				);

				await expect(
					node.supplyData.call(mockSupplyDataFunctions, 0)
				).rejects.toThrow('Invalid JSON schema provided');
			});

			it('should throw error when json_schema is empty for json_schema format', async () => {
				(
					mockSupplyDataFunctions.getNodeParameter as jest.Mock
				).mockImplementation(
					(param: string, _i: number, defaultValue?: unknown) => {
						if (param === 'model') return 'solar-pro2';
						if (param === 'response_format') return 'json_schema';
						if (param === 'json_schema') return '{}';
						if (param === 'options') return {};
						return defaultValue;
					}
				);
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(
					{
						apiKey: 'test-key',
					}
				);

				await expect(
					node.supplyData.call(mockSupplyDataFunctions, 0)
				).rejects.toThrow('JSON Schema is required');
			});
		});
	});
});
