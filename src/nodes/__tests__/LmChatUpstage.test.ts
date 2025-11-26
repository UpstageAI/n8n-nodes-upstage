import { LmChatUpstage } from '../LmChatUpstage.node';
import type { IExecuteFunctions, INodeTypeDescription } from 'n8n-workflow';

describe('LmChatUpstage', () => {
	let node: LmChatUpstage;
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		node = new LmChatUpstage();
		mockExecuteFunctions = {
			getInputData: jest.fn(),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn(),
			helpers: {
				httpRequestWithAuthentication: jest.fn(),
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
			(
				mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock
			).mockResolvedValue(mockResponse);

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
			(
				mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock
			).mockRejectedValue(new Error('API Error'));

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toBeDefined();
			expect(result[0]).toBeDefined();
			expect(result[0][0].json.error).toBeDefined();
		});
	});
});
