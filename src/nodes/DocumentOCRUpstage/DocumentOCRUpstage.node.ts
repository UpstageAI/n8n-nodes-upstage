import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IHttpRequestOptions,
} from 'n8n-workflow';

// Response type definitions
interface DocumentOCRResponse {
	text?: string;
	pages?: any[];
}

// Helper function to create multipart/form-data without external dependencies
function createMultipartFormData(
	fields: Record<string, string>,
	file: { buffer: Buffer; filename: string; contentType: string }
): { body: Buffer; contentType: string } {
	const boundary =
		'----WebKitFormBoundary' + Math.random().toString(36).substring(2);
	const parts: Buffer[] = [];

	// Add text fields
	for (const [name, value] of Object.entries(fields)) {
		parts.push(
			Buffer.from(
				`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="${name}"\r\n\r\n` +
					`${value}\r\n`
			)
		);
	}

	// Add file
	parts.push(
		Buffer.from(
			`--${boundary}\r\n` +
				`Content-Disposition: form-data; name="document"; filename="${file.filename}"\r\n` +
				`Content-Type: ${file.contentType}\r\n\r\n`
		)
	);
	parts.push(file.buffer);
	parts.push(Buffer.from('\r\n'));

	// End boundary
	parts.push(Buffer.from(`--${boundary}--\r\n`));

	return {
		body: Buffer.concat(parts),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

export class DocumentOCRUpstage implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Upstage Document OCR',
		name: 'documentOCRUpstage',
		icon: 'file:upstage_v2.svg',
		group: ['transform'],
		version: 1,
		description:
			'Extract text from document images using Upstage Document OCR. Supports JPEG, PNG, BMP, PDF, TIFF, HEIC, DOCX, PPTX, XLSX, HWP, HWPX formats.',
		defaults: { name: 'Upstage Document OCR' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'upstageApi', required: true }],
		properties: [
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				placeholder: 'e.g. data, document, file',
				description:
					'Name of the input item binary property that contains the file',
				required: true,
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: [
					{ name: 'ocr (recommended)', value: 'ocr' },
					{ name: 'ocr-250904', value: 'ocr-250904' },
				],
				default: 'ocr',
				description:
					'The OCR model to use. We recommend using the alias "ocr" which always points to the latest stable model.',
			},
			{
				displayName: 'Schema',
				name: 'schema',
				type: 'options',
				options: [
					{ name: 'Default (Upstage)', value: '' },
					{ name: 'Clova', value: 'clova' },
					{ name: 'Google', value: 'google' },
				],
				default: '',
				description:
					'Optional parameter that specifies the response format. If set, the output is converted to the format of the corresponding OCR API.',
			},
			{
				displayName: 'Return',
				name: 'returnMode',
				type: 'options',
				options: [
					{ name: 'Full Response', value: 'full' },
					{ name: 'Text Only', value: 'text' },
					{ name: 'Pages Array', value: 'pages' },
					{ name: 'Words Array', value: 'words' },
					{ name: 'Confidence Score', value: 'confidence' },
				],
				default: 'full',
				description: 'Choose what data to return from the OCR response',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const binaryPropertyName = this.getNodeParameter(
					'binaryPropertyName',
					i
				) as string;
				const model = this.getNodeParameter('model', i) as string;
				const schema = this.getNodeParameter('schema', i) as string;
				const returnMode = this.getNodeParameter('returnMode', i) as string;

				const item = items[i];
				if (!item.binary || !item.binary[binaryPropertyName]) {
					throw new Error(
						`No binary data found in property "${binaryPropertyName}".`
					);
				}

				const binaryData = item.binary[binaryPropertyName];

				// Validate file size (50MB limit)
				if (
					binaryData.fileSize &&
					typeof binaryData.fileSize === 'number' &&
					binaryData.fileSize > 50 * 1024 * 1024
				) {
					throw new Error('File size exceeds 50MB limit');
				}

				const buffer = await this.helpers.getBinaryDataBuffer(
					i,
					binaryPropertyName
				);

				// Prepare form fields
				const fields: Record<string, string> = {
					model,
				};

				if (schema) {
					fields.schema = schema;
				}

				// Create multipart/form-data without external dependencies
				const { body, contentType } = createMultipartFormData(fields, {
					buffer,
					filename: binaryData.fileName || 'upload',
					contentType: binaryData.mimeType || 'application/octet-stream',
				});

				const requestOptions: IHttpRequestOptions = {
					method: 'POST',
					url: 'https://api.upstage.ai/v1/document-digitization',
					body,
					headers: {
						'Content-Type': contentType,
					},
					// Response will be JSON (request body is already Buffer)
				};

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'upstageApi',
					requestOptions
				);

				const ocrResponse = response as DocumentOCRResponse;

				// Validate response structure
				if (!ocrResponse || typeof ocrResponse !== 'object') {
					throw new Error('Invalid response format from Upstage OCR API');
				}

				// Process response based on return mode
				if (returnMode === 'text') {
					returnData.push({
						json: { text: ocrResponse?.text ?? '' },
						pairedItem: { item: i },
					});
				} else if (returnMode === 'pages') {
					returnData.push({
						json: { pages: ocrResponse?.pages ?? [] },
						pairedItem: { item: i },
					});
				} else if (returnMode === 'words') {
					// Extract all words from all pages
					const allWords =
						ocrResponse?.pages?.flatMap((page: any) => page.words || []) || [];
					returnData.push({
						json: { words: allWords },
						pairedItem: { item: i },
					});
				} else if (returnMode === 'confidence') {
					returnData.push({
						json: {
							confidence: (ocrResponse as any)?.confidence ?? 0,
							modelVersion: (ocrResponse as any)?.modelVersion ?? '',
							numBilledPages: (ocrResponse as any)?.numBilledPages ?? 0,
						},
						pairedItem: { item: i },
					});
				} else {
					// Full response
					returnData.push({
						json: ocrResponse as any,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown error';
				const statusCode =
					typeof error === 'object' &&
					error !== null &&
					'statusCode' in error &&
					typeof error.statusCode === 'number'
						? error.statusCode
						: undefined;

				// Log detailed error information
				console.error('🚫 Upstage Document OCR Error:', {
					error: errorMessage,
					statusCode,
					itemIndex: i,
					timestamp: new Date().toISOString(),
				});

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: errorMessage,
							statusCode,
							error_code: (error as any)?.code || 'unknown_error',
							timestamp: new Date().toISOString(),
						},
						pairedItem: { item: i },
					});
				} else {
					throw new Error(
						`Upstage Document OCR failed for item ${i}: ${errorMessage}`
					);
				}
			}
		}

		return [returnData];
	}
}
