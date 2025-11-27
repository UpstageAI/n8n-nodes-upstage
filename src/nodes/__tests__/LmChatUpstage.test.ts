import { LmChatUpstage } from '../LmChatUpstage.node';
import type { IExecuteFunctions, INodeTypeDescription } from 'n8n-workflow';

describe('LmChatUpstage', () => {
	let node: LmChatUpstage;
	let mockExecuteFunctions: IExecuteFunctions;

	let mockHttpRequest: jest.Mock;

	beforeEach(() => {
		node = new LmChatUpstage();
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
				warn: jest.fn(),
			},
		} as unknown as IExecuteFunctions;
	});

	describe('description', () => {
		it('should have correct node description structure', () => {
			const description = node.description as INodeTypeDescription;
			expect(description).toBeDefined();
			expect(description.displayName).toBeDefined();
			expect(description.name).toBe('lmChatUpstage');
			expect(description.group).toBeDefined();
			expect(description.version).toBeDefined();
			expect(description.description).toBeDefined();
		});

		it('should have credentials configured', () => {
			const description = node.description as INodeTypeDescription;
			expect(description.credentials).toBeDefined();
			if (description.credentials) {
				expect(description.credentials).toHaveLength(1);
				expect(description.credentials[0].name).toBe('upstageApi');
			}
		});

		it('should have correct inputs and outputs', () => {
			const description = node.description as INodeTypeDescription;
			expect(description.inputs).toBeDefined();
			expect(description.outputs).toBeDefined();
		});
	});

	describe('execute', () => {
		it('should validate messages array is not empty', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'model') return 'solar-mini';
					if (param === 'messages.message') return [];
					if (param === 'options') return {};
					return undefined;
				}
			);

			await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'At least one message is required'
			);
		});

		it('should validate message content is not empty', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'model') return 'solar-mini';
					if (param === 'messages.message')
						return [{ role: 'user', content: '' }];
					if (param === 'options') return {};
					return undefined;
				}
			);

			await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'All messages must have non-empty content'
			);
		});

		it('should validate message role is valid', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'model') return 'solar-mini';
					if (param === 'messages.message')
						return [{ role: 'invalid', content: 'test' }];
					if (param === 'options') return {};
					return undefined;
				}
			);

			await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Invalid message role'
			);
		});

		it('should handle API success response', async () => {
			const mockResponse = {
				choices: [
					{
						message: {
							role: 'assistant',
							content: 'Test response',
						},
					},
				],
			};

			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'model') return 'solar-mini';
					if (param === 'messages.message')
						return [{ role: 'user', content: 'Hello' }];
					if (param === 'options') return {};
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
			expect(result[0][0].json).toBeDefined();
		});

		it('should handle continueOnFail when enabled', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'model') return 'solar-mini';
					if (param === 'messages.message')
						return [{ role: 'user', content: 'Hello' }];
					if (param === 'options') return {};
					return undefined;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			mockHttpRequest.mockRejectedValue(new Error('API Error'));

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toBeDefined();
			expect(result[0]).toBeDefined();
			expect(result[0][0].json.error).toBeDefined();
		});

		describe('Function Calling', () => {
			it('should include tools in request when provided', async () => {
				const mockResponse = {
					choices: [
						{
							message: {
								role: 'assistant',
								content: null,
								tool_calls: [
									{
										id: 'call_123',
										type: 'function',
										function: {
											name: 'get_weather',
											arguments: '{"location": "Seoul"}',
										},
									},
								],
							},
						},
					],
					usage: { prompt_tokens: 10, completion_tokens: 5 },
					model: 'solar-mini',
					created: 1234567890,
				};

				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
					{ json: {} },
				]);
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(param: string) => {
						if (param === 'model') return 'solar-mini';
						if (param === 'messages.message')
							return [{ role: 'user', content: 'What is the weather?' }];
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
						if (param === 'tool_choice') return 'auto';
						return undefined;
					}
				);
				(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
					apiKey: 'test-key',
				});
				mockHttpRequest.mockResolvedValue(mockResponse);

				await node.execute.call(mockExecuteFunctions);

				expect(mockHttpRequest).toHaveBeenCalled();
				const callArgs = mockHttpRequest.mock.calls[0];
				const requestBody = callArgs[2].body;

				expect(requestBody.tools).toBeDefined();
				expect(requestBody.tools).toHaveLength(1);
				expect(requestBody.tools[0].function.name).toBe('get_weather');
				expect(requestBody.tool_choice).toBe('auto');
			});

			it('should handle tool_calls in response', async () => {
				const mockResponse = {
					choices: [
						{
							message: {
								role: 'assistant',
								content: null,
								tool_calls: [
									{
										id: 'call_123',
										type: 'function',
										function: {
											name: 'get_weather',
											arguments: '{"location": "Seoul"}',
										},
									},
								],
							},
						},
					],
					usage: { prompt_tokens: 10, completion_tokens: 5 },
					model: 'solar-mini',
					created: 1234567890,
				};

				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
					{ json: {} },
				]);
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(param: string) => {
						if (param === 'model') return 'solar-mini';
						if (param === 'messages.message')
							return [{ role: 'user', content: 'What is the weather?' }];
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
						if (param === 'tool_choice') return 'auto';
						return undefined;
					}
				);
				(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
					apiKey: 'test-key',
				});
				mockHttpRequest.mockResolvedValue(mockResponse);

				const result = await node.execute.call(mockExecuteFunctions);

				expect(result[0][0].json.tool_calls).toBeDefined();
				const toolCalls = result[0][0].json.tool_calls as Array<{
					function: { name: string };
				}>;
				expect(toolCalls).toHaveLength(1);
				expect(toolCalls[0].function.name).toBe('get_weather');
				expect(result[0][0].json.has_tool_calls).toBe(true);
			});

			it('should handle specific tool_choice', async () => {
				const mockResponse = {
					choices: [
						{
							message: {
								role: 'assistant',
								content: null,
								tool_calls: [
									{
										id: 'call_123',
										type: 'function',
										function: {
											name: 'get_weather',
											arguments: '{"location": "Seoul"}',
										},
									},
								],
							},
						},
					],
					usage: { prompt_tokens: 10, completion_tokens: 5 },
					model: 'solar-mini',
					created: 1234567890,
				};

				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
					{ json: {} },
				]);
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(param: string) => {
						if (param === 'model') return 'solar-mini';
						if (param === 'messages.message')
							return [{ role: 'user', content: 'What is the weather?' }];
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
						if (param === 'tool_choice') return 'specific';
						if (param === 'function_name') return 'get_weather';
						return undefined;
					}
				);
				(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
					apiKey: 'test-key',
				});
				mockHttpRequest.mockResolvedValue(mockResponse);

				await node.execute.call(mockExecuteFunctions);

				expect(mockHttpRequest).toHaveBeenCalled();
				const callArgs = mockHttpRequest.mock.calls[0];
				const requestBody = callArgs[2].body;

				expect(requestBody.tool_choice).toEqual({
					type: 'function',
					function: { name: 'get_weather' },
				});
			});

			it('should throw error for invalid tool parameters JSON', async () => {
				(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
					{ json: {} },
				]);
				(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
					(param: string) => {
						if (param === 'model') return 'solar-mini';
						if (param === 'messages.message')
							return [{ role: 'user', content: 'Hello' }];
						if (param === 'options') return {};
						if (param === 'tools.tool')
							return [
								{
									name: 'get_weather',
									description: 'Get weather information',
									parameters: 'invalid json',
								},
							];
						if (param === 'tool_choice') return 'auto';
						return undefined;
					}
				);

				await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow(
					'Invalid tool parameters JSON'
				);
			});
		});
	});
});
