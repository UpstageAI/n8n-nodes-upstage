import { DocumentClassificationUpstage } from '../DocumentClassificationUpstage.node';
import type { IExecuteFunctions, INodeTypeDescription } from 'n8n-workflow';

describe('DocumentClassificationUpstage', () => {
	let node: DocumentClassificationUpstage;
	let mockExecuteFunctions: IExecuteFunctions;
	let mockHttpRequest: jest.Mock;

	beforeEach(() => {
		node = new DocumentClassificationUpstage();
		mockHttpRequest = jest.fn();
		mockExecuteFunctions = {
			getInputData: jest.fn(),
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn(),
			helpers: {
				httpRequestWithAuthentication: {
					call: mockHttpRequest,
				},
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
			expect(description.name).toBe('documentClassificationUpstage');
			expect(description.group).toBeDefined();
			expect(description.version).toBeDefined();
		});

		it('should have credentials configured', () => {
			const description = node.description as INodeTypeDescription;
			expect(description.credentials).toBeDefined();
			if (description.credentials) {
				expect(description.credentials).toHaveLength(1);
				expect(description.credentials[0].name).toBe('upstageApi');
				expect(description.credentials[0].required).toBe(true);
			}
		});

		it('should have correct inputs and outputs', () => {
			const description = node.description as INodeTypeDescription;
			expect(description.inputs).toBeDefined();
			expect(description.outputs).toBeDefined();
			expect(description.inputs).toEqual(['main']);
			expect(description.outputs).toEqual(['main']);
		});
	});

	describe('execute', () => {
		it('should validate binary property is provided for binary input type', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'inputType') return 'binary';
					if (param === 'binaryPropertyName') return '';
					if (param === 'model') return 'document-classify';
					return undefined;
				}
			);

			await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow();
		});

		it('should validate image URL is provided for URL input type', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'inputType') return 'url';
					if (param === 'imageUrl') return '';
					if (param === 'model') return 'document-classify';
					return undefined;
				}
			);

			await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow();
		});

		it('should handle binary input type successfully', async () => {
			const mockResponse = {
				category: 'invoice',
				confidence: 0.95,
			};

			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {}, binary: { data: { mimeType: 'image/png' } } },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'inputType') return 'binary';
					if (param === 'binaryPropertyName') return 'data';
					if (param === 'model') return 'document-classify';
					if (param === 'schemaName') return 'default';
					if (param === 'schemaInputType') return 'form';
					if (param === 'categories') return { values: [] };
					if (param === 'returnMode') return 'simple';
					return defaultValue;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			(
				mockExecuteFunctions.helpers.getBinaryDataBuffer as jest.Mock
			).mockResolvedValue(Buffer.from('test image content'));
			mockHttpRequest.mockResolvedValue(mockResponse);

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toBeDefined();
			expect(result[0]).toBeDefined();
			expect(result[0][0].json).toBeDefined();
			expect(mockHttpRequest).toHaveBeenCalled();
		});

		it('should handle URL input type successfully', async () => {
			const mockResponse = {
				category: 'invoice',
				confidence: 0.95,
			};

			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'inputType') return 'url';
					if (param === 'imageUrl') return 'https://example.com/image.jpg';
					if (param === 'model') return 'document-classify';
					if (param === 'schemaName') return 'default';
					if (param === 'schemaInputType') return 'form';
					if (param === 'categories') return { values: [] };
					if (param === 'returnMode') return 'simple';
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
			expect(mockHttpRequest).toHaveBeenCalled();
		});

		it('should handle continueOnFail when enabled', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {}, binary: { data: { mimeType: 'image/png' } } },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'inputType') return 'binary';
					if (param === 'binaryPropertyName') return 'data';
					if (param === 'model') return 'document-classify';
					if (param === 'schemaName') return 'default';
					if (param === 'schemaInputType') return 'form';
					if (param === 'categories') return { values: [] };
					if (param === 'returnMode') return 'simple';
					return defaultValue;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			(
				mockExecuteFunctions.helpers.getBinaryDataBuffer as jest.Mock
			).mockResolvedValue(Buffer.from('test image content'));
			mockHttpRequest.mockRejectedValue(new Error('API Error'));

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toBeDefined();
			expect(result[0]).toBeDefined();
			expect(result[0][0].json.error).toBeDefined();
		});
	});
});
