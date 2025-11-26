import { InformationExtractionUpstage } from '../InformationExtractionUpstage.node';
import type { IExecuteFunctions, INodeTypeDescription } from 'n8n-workflow';

describe('InformationExtractionUpstage', () => {
	let node: InformationExtractionUpstage;
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		node = new InformationExtractionUpstage();
		mockExecuteFunctions = {
			getInputData: jest.fn(),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn(),
			helpers: {
				httpRequestWithAuthentication: jest.fn(),
				getBinaryDataBuffer: jest.fn(),
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
			expect(description.name).toBe('informationExtractionUpstage');
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

	describe('JSON schema validation', () => {
		it('should handle valid JSON schema', async () => {
			const validSchema = JSON.stringify({
				type: 'object',
				properties: {
					name: { type: 'string' },
				},
			});

			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'model') return 'solar-pro2';
					if (param === 'inputType') return 'url';
					if (param === 'imageUrl') return 'https://example.com/image.jpg';
					if (param === 'json_schema') return validSchema;
					if (param === 'operation') return 'sync';
					return undefined;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			(
				mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock
			).mockResolvedValue({
				choices: [
					{
						message: {
							content: '{"name": "test"}',
						},
					},
				],
			});

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toBeDefined();
			expect(
				mockExecuteFunctions.helpers.httpRequestWithAuthentication
			).toHaveBeenCalled();
		});

		it('should handle JSON schema with missing closing braces', async () => {
			const invalidSchema = '{"type": "object", "properties": {';

			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'model') return 'solar-pro2';
					if (param === 'inputType') return 'url';
					if (param === 'imageUrl') return 'https://example.com/image.jpg';
					if (param === 'json_schema') return invalidSchema;
					if (param === 'operation') return 'sync';
					return undefined;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			(
				mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock
			).mockResolvedValue({
				choices: [
					{
						message: {
							content: '{"name": "test"}',
						},
					},
				],
			});

			// Should attempt to fix the JSON schema and complete successfully
			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toBeDefined();
			// The function should handle invalid JSON schema gracefully
		});

		it('should handle JSON schema with extra closing braces', async () => {
			const invalidSchema = '{"type": "object"}}}';

			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'model') return 'solar-pro2';
					if (param === 'inputType') return 'url';
					if (param === 'imageUrl') return 'https://example.com/image.jpg';
					if (param === 'json_schema') return invalidSchema;
					if (param === 'operation') return 'sync';
					return undefined;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			(
				mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock
			).mockResolvedValue({
				choices: [
					{
						message: {
							content: '{"name": "test"}',
						},
					},
				],
			});

			// Should attempt to fix the JSON schema and complete successfully
			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toBeDefined();
			// The function should handle invalid JSON schema gracefully
		});
	});

	describe('binary data handling', () => {
		it('should handle binary input type', async () => {
			const mockBuffer = Buffer.from('test-image-data');
			const mockResponse = {
				choices: [
					{
						message: {
							content: '{"extracted": "data"}',
						},
					},
				],
			};

			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{
					json: {},
					binary: {
						image: {
							mimeType: 'image/png',
							data: 'base64data',
						},
					},
				},
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'model') return 'solar-pro2';
					if (param === 'inputType') return 'binary';
					if (param === 'binaryPropertyName') return 'image';
					if (param === 'json_schema') return '{}';
					if (param === 'operation') return 'sync';
					return undefined;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			(
				mockExecuteFunctions.helpers.getBinaryDataBuffer as jest.Mock
			).mockResolvedValue(mockBuffer);
			(
				mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock
			).mockResolvedValue(mockResponse);

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toBeDefined();
			expect(
				mockExecuteFunctions.helpers.getBinaryDataBuffer
			).toHaveBeenCalled();
		});

		it('should throw error when binary data is missing', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {}, binary: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'model') return 'solar-pro2';
					if (param === 'inputType') return 'binary';
					if (param === 'binaryPropertyName') return 'image';
					if (param === 'json_schema') return '{}';
					if (param === 'operation') return 'sync';
					return undefined;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});

			await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'No binary data found'
			);
		});
	});
});
