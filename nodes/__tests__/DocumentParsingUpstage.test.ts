import { DocumentParsingUpstage } from '../DocumentParsingUpstage.node';
import type { IExecuteFunctions, INodeTypeDescription } from 'n8n-workflow';

describe('DocumentParsingUpstage', () => {
	let node: DocumentParsingUpstage;
	let mockExecuteFunctions: IExecuteFunctions;
	let mockHttpRequest: jest.Mock;

	beforeEach(() => {
		node = new DocumentParsingUpstage();
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
			expect(description.name).toBe('documentParsingUpstage');
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
		it('should validate binary property is provided for sync operation', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {} },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string) => {
					if (param === 'operation') return 'sync';
					if (param === 'binaryPropertyName') return '';
					if (param === 'model') return 'document-parse';
					return undefined;
				}
			);

			await expect(node.execute.call(mockExecuteFunctions)).rejects.toThrow();
		});

		it('should handle sync parse operation successfully', async () => {
			const mockResponse = {
				content: {
					html: '<html>Parsed HTML</html>',
					markdown: '# Parsed Markdown',
					text: 'Parsed document text',
				},
				elements: [],
			};

			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: {}, binary: { data: { mimeType: 'application/pdf' } } },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'operation') return 'sync';
					if (param === 'binaryPropertyName') return 'data';
					if (param === 'model') return 'document-parse';
					if (param === 'ocr') return 'auto';
					if (param === 'base64Categories') return [];
					if (param === 'merge_multipage_tables') return false;
					if (param === 'outputFormats') return ['html'];
					if (param === 'coordinates') return true;
					if (param === 'chartRecognition') return true;
					return defaultValue;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			(
				mockExecuteFunctions.helpers.getBinaryDataBuffer as jest.Mock
			).mockResolvedValue(Buffer.from('test file content'));
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
				{ json: {}, binary: { data: { mimeType: 'application/pdf' } } },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(param: string, _i: number, defaultValue?: unknown) => {
					if (param === 'operation') return 'sync';
					if (param === 'binaryPropertyName') return 'data';
					if (param === 'model') return 'document-parse';
					if (param === 'ocr') return 'auto';
					if (param === 'base64Categories') return [];
					if (param === 'merge_multipage_tables') return false;
					if (param === 'outputFormats') return ['html'];
					if (param === 'coordinates') return true;
					if (param === 'chartRecognition') return true;
					return defaultValue;
				}
			);
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				apiKey: 'test-key',
			});
			(
				mockExecuteFunctions.helpers.getBinaryDataBuffer as jest.Mock
			).mockResolvedValue(Buffer.from('test file content'));
			mockHttpRequest.mockRejectedValue(new Error('API Error'));

			const result = await node.execute.call(mockExecuteFunctions);

			expect(result).toBeDefined();
			expect(result[0]).toBeDefined();
			expect(result[0][0].json.error).toBeDefined();
		});
	});
});
