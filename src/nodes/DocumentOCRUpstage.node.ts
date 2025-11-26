import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { handleNodeError } from '../utils/errorHandling';
import {
	validateFileSize,
	validateFileSizeFromMetadata,
} from '../utils/fileValidation';
import {
	isDocumentOCRResponse,
	type DocumentOCRResponse,
} from '../utils/typeGuards';

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
		icon: 'file:../upstage_v2.svg',
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

				// Validate file size (50MB limit) - check metadata first if available
				validateFileSizeFromMetadata(binaryData.fileSize, 50);

				const buffer = await this.helpers.getBinaryDataBuffer(
					i,
					binaryPropertyName
				);

				// Validate file size from actual buffer
				validateFileSize(buffer, 50);

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

				// Validate response structure using type guard
				if (!isDocumentOCRResponse(response)) {
					throw new Error('Invalid response format from Upstage OCR API');
				}

				const ocrResponse = response;

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
						ocrResponse?.pages?.flatMap(page => page.words || []) || [];
					returnData.push({
						json: { words: allWords },
						pairedItem: { item: i },
					});
				} else if (returnMode === 'confidence') {
					returnData.push({
						json: {
							confidence: ocrResponse?.confidence ?? 0,
							modelVersion: ocrResponse?.modelVersion ?? '',
							numBilledPages: ocrResponse?.numBilledPages ?? 0,
						},
						pairedItem: { item: i },
					});
				} else {
					// Full response
					returnData.push({
						json: ocrResponse as JsonObject,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				handleNodeError(this, error, i, 'Upstage Document OCR', returnData);
			}
		}

		return [returnData];
	}
}
