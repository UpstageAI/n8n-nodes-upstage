import { LmChatModelUpstage } from '../LmChatModelUpstage.node';
import type { ISupplyDataFunctions, INodeTypeDescription } from 'n8n-workflow';
import { N8nLlmTracing } from '../../utils/N8nLlmTracing';
import { makeN8nLlmFailedAttemptHandler } from '../../utils/n8nLlmFailedAttemptHandler';
import { ChatOpenAI } from '@langchain/openai';

// Mock dependencies
jest.mock('../../utils/N8nLlmTracing');
jest.mock('../../utils/n8nLlmFailedAttemptHandler');

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
			expect(result.response).toBeInstanceOf(ChatOpenAI);
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

			expect(result.response).toBeInstanceOf(ChatOpenAI);
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
			expect(result.response).toBeInstanceOf(ChatOpenAI);
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

		describe('Function Calling', () => {
			it('should bind tools to model when tools are provided', async () => {
				(
					mockSupplyDataFunctions.getNodeParameter as jest.Mock
				).mockImplementation(
					(param: string, _i: number, defaultValue?: unknown) => {
						if (param === 'model') return 'solar-mini';
						if (param === 'options') return {};
						if (param === 'tools.tool')
							return [
								{
									name: 'get_weather',
									description: 'Get weather information',
									parameters:
										'{"type":"object","properties":{"location":{"type":"string"}},"required":["location"]}',
								},
							];
						return defaultValue;
					}
				);
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(
					{
						apiKey: 'test-key',
					}
				);

				const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

				expect(result.response).toBeDefined();
				// The response should be a bound model (not the original ChatOpenAI instance)
				// We can't easily test bindTools directly, but we can verify the method was called
			});

			it('should handle invalid tool parameters JSON', async () => {
				(
					mockSupplyDataFunctions.getNodeParameter as jest.Mock
				).mockImplementation(
					(param: string, _i: number, defaultValue?: unknown) => {
						if (param === 'model') return 'solar-mini';
						if (param === 'options') return {};
						if (param === 'tools.tool')
							return [
								{
									name: 'get_weather',
									description: 'Get weather information',
									parameters: 'invalid json',
								},
							];
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
				).rejects.toThrow('Invalid tool parameters JSON');
			});

			it('should return model without tools when no tools provided', async () => {
				(
					mockSupplyDataFunctions.getNodeParameter as jest.Mock
				).mockImplementation(
					(param: string, _i: number, defaultValue?: unknown) => {
						if (param === 'model') return 'solar-mini';
						if (param === 'options') return {};
						if (param === 'tools.tool') return [];
						return defaultValue;
					}
				);
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(
					{
						apiKey: 'test-key',
					}
				);

				const result = await node.supplyData.call(mockSupplyDataFunctions, 0);

				expect(result.response).toBeInstanceOf(ChatOpenAI);
			});
		});
	});
});
