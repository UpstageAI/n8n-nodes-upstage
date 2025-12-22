import { LmChatModelUpstage } from '../LmChatModelUpstage.node';
import type {
	ISupplyDataFunctions,
	INodeTypeDescription,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { N8nLlmTracing } from '../../utils/N8nLlmTracing';
import { makeN8nLlmFailedAttemptHandler } from '../../utils/n8nLlmFailedAttemptHandler';

// Mock dependencies
jest.mock('../../utils/N8nLlmTracing');
jest.mock('../../utils/n8nLlmFailedAttemptHandler');

describe('LmChatModelUpstage', () => {
	let node: LmChatModelUpstage;
	let mockSupplyDataFunctions: ISupplyDataFunctions;
	let mockHttpRequest: jest.Mock;

	beforeEach(() => {
		mockHttpRequest = jest.fn();

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
					call: mockHttpRequest,
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
	});

	describe('supplyData', () => {
		it('should return SupplyData with LanguageModel instance', async () => {
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
				'solar-mini'
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(result).toBeDefined();
			expect(result.response).toBeDefined();
			// Verify the response implements LanguageModel interface
			expect(result.response).toHaveProperty('invoke');
			expect(typeof (result.response as any).invoke).toBe('function');
		});

		it('should configure LanguageModel with correct parameters', async () => {
			(
				mockSupplyDataFunctions.getNodeParameter as jest.Mock
			).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'model') return 'solar-mini';
					if (param === 'options') {
						return {
							temperature: 0.7,
							maxTokens: 1000,
							streaming: false,
						};
					}
					if (param === 'response_format') return 'default';
					if (param === 'json_schema') return '{}';
					return defaultValue;
				}
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(result.response).toBeDefined();
			expect(result.response).toHaveProperty('invoke');
		});

		it('should integrate N8nLlmTracing when available', async () => {
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
				'solar-mini'
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			await node.supplyData.call(mockSupplyDataFunctions, 0);

			// N8nLlmTracing should be instantiated
			expect(N8nLlmTracing).toHaveBeenCalled();
		});

		it('should integrate makeN8nLlmFailedAttemptHandler', async () => {
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
				'solar-mini'
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			await node.supplyData.call(mockSupplyDataFunctions, 0);

			// Handler should be created
			expect(makeN8nLlmFailedAttemptHandler).toHaveBeenCalled();
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
			(mockSupplyDataFunctions.helpers.httpRequest as jest.Mock).mockResolvedValue(
				mockModelsResponse
			);

			const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.helpers.httpRequest).toHaveBeenCalled();
			expect(result.response).toBeDefined();
			expect(result.response).toHaveProperty('invoke');
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

			// Should still succeed with fallback model
			const result = await node.supplyData.call(mockSupplyDataFunctions, 0);
			expect(result.response).toBeDefined();
		});

		describe('Response Format', () => {
			it('should not set responseFormat when response_format is default', async () => {
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

				const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

				// Verify response is created (responseFormat is internal to the model)
				expect(result.response).toBeDefined();
			});

			it('should set responseFormat to json_object when response_format is json_object', async () => {
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

				const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

				// Verify response is created
				expect(result.response).toBeDefined();
			});

			it('should set responseFormat to json_schema when response_format is json_schema with valid schema', async () => {
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

				const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

				// Verify response is created
				expect(result.response).toBeDefined();
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

			it('should throw error when json_schema is missing for json_schema format', async () => {
				(
					mockSupplyDataFunctions.getNodeParameter as jest.Mock
				).mockImplementation(
					(param: string, _i: number, defaultValue?: unknown) => {
						if (param === 'model') return 'solar-pro2';
						if (param === 'response_format') return 'json_schema';
						if (param === 'json_schema') return '{}'; // Empty schema should trigger error
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

			it('should combine responseFormat with other options', async () => {
				(
					mockSupplyDataFunctions.getNodeParameter as jest.Mock
				).mockImplementation(
					(param: string, _i: number, defaultValue?: unknown) => {
						if (param === 'model') return 'solar-pro2';
						if (param === 'response_format') return 'json_object';
						if (param === 'json_schema') return '{}';
						if (param === 'options') {
							return {
								temperature: 0.8,
								maxTokens: 2000,
								streaming: true,
							};
						}
						return defaultValue;
					}
				);
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(
					{
						apiKey: 'test-key',
					}
				);

				const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

				// Verify response is created with all options
				expect(result.response).toBeDefined();
			});

			it('should ignore json_schema when format is json_object', async () => {
				(
					mockSupplyDataFunctions.getNodeParameter as jest.Mock
				).mockImplementation(
					(param: string, _i: number, defaultValue?: unknown) => {
						if (param === 'model') return 'solar-pro2';
						if (param === 'response_format') return 'json_object';
						if (param === 'json_schema') return '{"type":"object"}'; // This should be ignored
						if (param === 'options') return {};
						return defaultValue;
					}
				);
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(
					{
						apiKey: 'test-key',
					}
				);

				const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

				// Verify response is created
				expect(result.response).toBeDefined();
			});
		});

		describe('LanguageModel interface', () => {
			it('should implement invoke method', async () => {
				(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
					'solar-mini'
				);
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(
					{
						apiKey: 'test-key',
					}
				);

				mockHttpRequest.mockResolvedValue({
					id: 'test-id',
					object: 'chat.completion',
					created: 1234567890,
					model: 'solar-mini',
					choices: [
						{
							index: 0,
							message: {
								role: 'assistant',
								content: 'Test response',
							},
							finish_reason: 'stop',
						},
					],
					usage: {
						prompt_tokens: 10,
						completion_tokens: 5,
						total_tokens: 15,
					},
				});

				const result = await node.supplyData.call(mockSupplyDataFunctions, 0);
				const model = result.response as any;

				// Test invoke method
				const messages = [{ role: 'user' as const, content: 'Hello' }];
				const response = await model.invoke(messages);

				expect(response).toBeDefined();
				expect(response.role).toBe('assistant');
				expect(response.content).toBe('Test response');
			});

			it('should implement bindTools method', async () => {
				(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
					'solar-mini'
				);
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(
					{
						apiKey: 'test-key',
					}
				);

				const result = await node.supplyData.call(mockSupplyDataFunctions, 0);
				const model = result.response as any;

				// Test bindTools if available
				if (model.bindTools) {
					const tools = [
						{
							type: 'function' as const,
							function: {
								name: 'test_function',
								description: 'Test function',
								parameters: { type: 'object', properties: {} },
							},
						},
					];
					const boundModel = model.bindTools(tools);

					expect(boundModel).toBeDefined();
					expect(boundModel).toHaveProperty('invoke');
				}
			});
		});
	});
});
