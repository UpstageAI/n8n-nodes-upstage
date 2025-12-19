import { LmChatModelUpstage } from '../LmChatModelUpstage.node';
import type { ISupplyDataFunctions, INodeTypeDescription } from 'n8n-workflow';
import { N8nLlmTracing } from '../../utils/N8nLlmTracing';
import { makeN8nLlmFailedAttemptHandler } from '../../utils/n8nLlmFailedAttemptHandler';
import { ChatOpenAI } from '@langchain/openai';

// Mock dependencies
jest.mock('../../utils/N8nLlmTracing');
jest.mock('../../utils/n8nLlmFailedAttemptHandler');

// Track ChatOpenAI constructor calls
let chatOpenAIConstructorArgs: any[] = [];

// Mock ChatOpenAI at module level to track constructor calls
jest.mock('@langchain/openai', () => {
	const actualModule = jest.requireActual('@langchain/openai');
	const MockChatOpenAI = jest.fn().mockImplementation((config: any) => {
		chatOpenAIConstructorArgs.push(config);
		return new actualModule.ChatOpenAI(config);
	}) as any;
	// Preserve prototype for instanceof checks
	MockChatOpenAI.prototype = actualModule.ChatOpenAI.prototype;
	return {
		...actualModule,
		ChatOpenAI: MockChatOpenAI,
	};
});

describe('LmChatModelUpstage', () => {
	let node: LmChatModelUpstage;
	let mockSupplyDataFunctions: ISupplyDataFunctions;

	beforeEach(() => {
		chatOpenAIConstructorArgs = [];

		node = new LmChatModelUpstage();
		mockSupplyDataFunctions = {
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn(),
			getNode: jest.fn(() => ({
				name: 'test-node',
				type: 'test',
			})),
			helpers: {
				request: jest.fn(),
			},
			logger: {
				error: jest.fn(),
				debug: jest.fn(),
			},
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
		it('should return SupplyData with ChatOpenAI instance', async () => {
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
				'solar-mini'
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(result).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response).toBeDefined();
			const MockedChatOpenAI = require('@langchain/openai').ChatOpenAI;
			expect(MockedChatOpenAI).toHaveBeenCalled();
		});

		it('should configure ChatOpenAI with correct parameters', async () => {
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
					return defaultValue;
				}
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(result.response).toBeDefined();
			const MockedChatOpenAI = require('@langchain/openai').ChatOpenAI;
			expect(MockedChatOpenAI).toHaveBeenCalled();
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
			(mockSupplyDataFunctions.helpers.request as jest.Mock).mockResolvedValue(
				mockModelsResponse
			);

			const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.helpers.request).toHaveBeenCalled();
			expect(result.response).toBeDefined();
			const MockedChatOpenAI = require('@langchain/openai').ChatOpenAI;
			expect(MockedChatOpenAI).toHaveBeenCalled();
		});

		it('should handle model auto-selection failure gracefully', async () => {
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock).mockReturnValue(
				''
			);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			(mockSupplyDataFunctions.helpers.request as jest.Mock).mockRejectedValue(
				new Error('API Error')
			);

			await expect(
				node.supplyData.call(mockSupplyDataFunctions, 0)
			).rejects.toThrow();
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

				await node.supplyData.call(mockSupplyDataFunctions, 0);

				// Check that responseFormat was not passed to ChatOpenAI
				expect(chatOpenAIConstructorArgs.length).toBeGreaterThan(0);
				const lastConfig = chatOpenAIConstructorArgs[chatOpenAIConstructorArgs.length - 1];
				expect(lastConfig.responseFormat).toBeUndefined();
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

				await node.supplyData.call(mockSupplyDataFunctions, 0);

				// Check that responseFormat was passed correctly to ChatOpenAI
				expect(chatOpenAIConstructorArgs.length).toBeGreaterThan(0);
				const lastConfig = chatOpenAIConstructorArgs[chatOpenAIConstructorArgs.length - 1];
				expect(lastConfig.responseFormat).toBeDefined();
				expect(lastConfig.responseFormat).toEqual({ type: 'json_object' });
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

				await node.supplyData.call(mockSupplyDataFunctions, 0);

				// Check that responseFormat was passed correctly to ChatOpenAI
				expect(chatOpenAIConstructorArgs.length).toBeGreaterThan(0);
				const lastConfig = chatOpenAIConstructorArgs[chatOpenAIConstructorArgs.length - 1];
				expect(lastConfig.responseFormat).toBeDefined();
				expect(lastConfig.responseFormat).toEqual({
					type: 'json_schema',
					json_schema: validSchema,
				});
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

				await node.supplyData.call(mockSupplyDataFunctions, 0);

				// Check that all options including responseFormat are passed correctly
				expect(chatOpenAIConstructorArgs.length).toBeGreaterThan(0);
				const lastConfig = chatOpenAIConstructorArgs[chatOpenAIConstructorArgs.length - 1];
				expect(lastConfig.responseFormat).toEqual({ type: 'json_object' });
				expect(lastConfig.temperature).toBe(0.8);
				expect(lastConfig.maxTokens).toBe(2000);
				expect(lastConfig.streaming).toBe(true);
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

				await node.supplyData.call(mockSupplyDataFunctions, 0);

				// Check that responseFormat is json_object, not json_schema
				expect(chatOpenAIConstructorArgs.length).toBeGreaterThan(0);
				const lastConfig = chatOpenAIConstructorArgs[chatOpenAIConstructorArgs.length - 1];
				expect(lastConfig.responseFormat).toEqual({ type: 'json_object' });
			});
		});
	});
});
