import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IHttpRequestOptions,
	IDataObject,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { handleNodeError } from '../utils/errorHandling';
import {
	validateFileSize,
	validateFileSizeFromMetadata,
} from '../utils/fileValidation';

interface InformationExtractionMessage {
	role: 'user';
	content: Array<{
		type: 'image_url';
		image_url: { url: string };
	}>;
}

interface InformationExtractionRequestBody {
	model: string;
	messages: InformationExtractionMessage[];
	response_format?: IDataObject;
	chunking?: {
		pages_per_chunk: number;
	};
	location?: boolean;
	confidence?: boolean;
	split?: boolean;
}

export class InformationExtractionUpstage implements INodeType {
	// JSON structure validation and fix method
	private static validateAndFixJsonStructure(
		jsonString: string,
		logger?: IExecuteFunctions['logger']
	): string {
		try {
			if (logger) {
				logger.debug('=== JSON Structure Analysis ===', {
					originalLength: jsonString.length,
					last20Chars: jsonString.substring(jsonString.length - 20),
				});
			}

			// Step 1: Basic bracket balance check
			const openBraces = (jsonString.match(/\{/g) || []).length;
			const closeBraces = (jsonString.match(/\}/g) || []).length;
			const openBrackets = (jsonString.match(/\[/g) || []).length;
			const closeBrackets = (jsonString.match(/\]/g) || []).length;

			if (logger) {
				logger.debug('Brace balance check', {
					openBraces,
					closeBraces,
					openBrackets,
					closeBrackets,
				});
			}

			// Step 2: Structural analysis and modification
			let fixedJson = jsonString;

			// Fix brace imbalance
			if (openBraces > closeBraces) {
				const missingBraces = openBraces - closeBraces;
				if (logger) {
					logger.debug(`Adding ${missingBraces} missing closing braces`);
				}
				fixedJson += '}'.repeat(missingBraces);
			} else if (closeBraces > openBraces) {
				const extraBraces = closeBraces - openBraces;
				if (logger) {
					logger.debug(`Removing ${extraBraces} extra closing braces`);
				}
				fixedJson = fixedJson.replace(
					/\}+$/,
					'}'.repeat(closeBraces - extraBraces)
				);
			}

			// Fix bracket imbalance
			if (openBrackets > closeBrackets) {
				const missingBrackets = openBrackets - closeBrackets;
				if (logger) {
					logger.debug(`Adding ${missingBrackets} missing closing brackets`);
				}
				fixedJson += ']'.repeat(missingBrackets);
			} else if (closeBrackets > openBrackets) {
				const extraBrackets = closeBrackets - openBrackets;
				if (logger) {
					logger.debug(`Removing ${extraBrackets} extra closing brackets`);
				}
				fixedJson = fixedJson.replace(
					/\]+$/,
					']'.repeat(closeBrackets - extraBrackets)
				);
			}

			// Step 3: JSON validation
			try {
				JSON.parse(fixedJson);
				if (logger) {
					logger.debug('JSON structure fixed successfully', {
						fixedLength: fixedJson.length,
						last20Chars: fixedJson.substring(fixedJson.length - 20),
					});
				}
				return fixedJson;
			} catch (parseError) {
				if (logger) {
					logger.debug('Basic bracket fix was insufficient, returning original', {
						error: (parseError as Error).message,
					});
				}
				return jsonString; // Return original
			}
		} catch (error) {
			if (logger) {
				logger.debug('Could not fix JSON structure', {
					error: (error as Error).message,
				});
			}
			return jsonString; // Return original
		}
	}

	// Helper method to get image data URL or HTTP URL from binary or URL input
	private static async getImageDataUrlOrHttp(
		executeFunctions: IExecuteFunctions,
		inputType: string,
		itemIndex: number,
		items: INodeExecutionData[]
	): Promise<string> {
		if (inputType === 'binary') {
			const binaryPropertyName = executeFunctions.getNodeParameter(
				'binaryPropertyName',
				itemIndex
			) as string;
			const item = items[itemIndex];
			if (!item.binary || !item.binary[binaryPropertyName]) {
				throw new NodeOperationError(
					executeFunctions.getNode(),
					`No binary data found in property "${binaryPropertyName}".`
				);
			}
			const binaryData = item.binary[binaryPropertyName];

			// Validate file size (50MB limit) - check metadata first if available
			validateFileSizeFromMetadata(binaryData.fileSize, 50, executeFunctions.getNode());

			const buffer = await executeFunctions.helpers.getBinaryDataBuffer(
				itemIndex,
				binaryPropertyName
			);

			// Validate file size from actual buffer
			validateFileSize(buffer, 50, executeFunctions.getNode());

			const mime = binaryData.mimeType || 'application/octet-stream';
			const base64 = buffer.toString('base64');
			return `data:${mime};base64,${base64}`;
		} else {
			const imageUrl = executeFunctions.getNodeParameter(
				'imageUrl',
				itemIndex
			) as string;
			if (!imageUrl) {
				throw new NodeOperationError(executeFunctions.getNode(), 'Image URL is required.');
			}
			if (!imageUrl.startsWith('https://') && !imageUrl.startsWith('http://')) {
				throw new NodeOperationError(
					executeFunctions.getNode(),
					'Image URL must use http:// or https:// protocol'
				);
			}
			return imageUrl;
		}
	}

	description: INodeTypeDescription = {
		displayName: 'Upstage Information Extract',
		name: 'informationExtractionUpstage',
		icon: 'file:../upstage_v2.svg',
		group: ['transform'],
		version: 1,
		description:
			'Extract structured data from documents/images using Upstage Information Extraction',
		defaults: { name: 'Upstage Information Extract' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'upstageApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				options: [
					{ name: 'Extract Information', value: 'extract' },
					{ name: 'Generate Schema', value: 'schema' },
				],
				default: 'extract',
				description:
					'Choose between extracting information with a schema or generating a schema from a document',
			},
			// Input method
			{
				displayName: 'Input Type',
				name: 'inputType',
				type: 'options',
				options: [
					{ name: 'Binary (from previous node)', value: 'binary' },
					{ name: 'Image URL', value: 'url' },
				],
				default: 'binary',
			},

			// When binary
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'document',
				placeholder: 'e.g. document, data, file',
				description: 'Name of the binary property that contains the file',
				displayOptions: { show: { inputType: ['binary'] } },
			},

			// When URL
			{
				displayName: 'Image URL',
				name: 'imageUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/sample.png',
				displayOptions: { show: { inputType: ['url'] } },
			},

			// Model
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: [
					{
						name: 'information-extract (recommended)',
						value: 'information-extract',
					},
				],
				default: 'information-extract',
			},

			// JSON schema (for extract operation)
			{
				displayName: 'Schema Input Type',
				name: 'schemaInputType',
				type: 'options',
				options: [
					{ name: 'Schema Only', value: 'schema' },
					{ name: 'Full Response Format', value: 'full' },
				],
				default: 'schema',
				description: 'How to provide the JSON schema',
				displayOptions: { show: { operation: ['extract'] } },
			},
			{
				displayName: 'Schema Name',
				name: 'schemaName',
				type: 'string',
				default: 'document_schema',
				description: 'Name for the JSON schema in response_format',
				displayOptions: {
					show: { operation: ['extract'], schemaInputType: ['schema'] },
				},
			},
			{
				displayName: 'JSON Schema (object)',
				name: 'json_schema',
				type: 'json',
				default: '{ "type": "object", "properties": {} }',
				description: 'Target JSON schema for extraction (object schema)',
				displayOptions: {
					show: { operation: ['extract'], schemaInputType: ['schema'] },
				},
			},
			{
				displayName: 'Full Response Format JSON',
				name: 'fullResponseFormat',
				type: 'json',
				default:
					'{"type":"json_schema","json_schema":{"name":"document_schema","schema":{"type":"object","properties":{}}}}',
				description:
					'Complete response_format JSON (including type, json_schema, name, and schema)',
				displayOptions: {
					show: { operation: ['extract'], schemaInputType: ['full'] },
				},
			},
			// Guidance for schema generation
			{
				displayName: 'Guidance (optional)',
				name: 'prompt',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				placeholder: 'e.g., Generate a schema suitable for bank statements.',
				description: 'Optional text instruction to influence schema generation',
				displayOptions: { show: { operation: ['schema'] } },
			},

			// Chunking options (for extract operation)
			{
				displayName: 'Pages per Chunk',
				name: 'pagesPerChunk',
				type: 'number',
				default: 0,
				typeOptions: { minValue: 0 },
				description:
					'Chunk pages to improve performance (recommended for 30+ pages). 0 to disable.',
				displayOptions: { show: { operation: ['extract'] } },
			},

			// Additional extraction options
			{
				displayName: 'Include Location',
				name: 'location',
				type: 'boolean',
				default: false,
				description:
					'Whether to return page number and coordinates for each extracted value',
				displayOptions: { show: { operation: ['extract'] } },
			},
			{
				displayName: 'Include Confidence',
				name: 'confidence',
				type: 'boolean',
				default: false,
				description:
					'Whether to return confidence score (high/low) for each extracted field',
				displayOptions: { show: { operation: ['extract'] } },
			},
			{
				displayName: 'Split Multi-Page',
				name: 'split',
				type: 'boolean',
				default: false,
				description:
					'Whether to process multi-page documents with split results per page',
				displayOptions: { show: { operation: ['extract'] } },
			},

			// Return mode
			{
				displayName: 'Return',
				name: 'returnMode',
				type: 'options',
				options: [
					{ name: 'Extracted JSON Only', value: 'extracted' },
					{ name: 'Schema JSON Only', value: 'schema' },
					{ name: 'Full Response', value: 'full' },
				],
				default: 'extracted',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const inputType = this.getNodeParameter('inputType', i) as string;
				const model = this.getNodeParameter('model', i) as string;
				const returnMode = this.getNodeParameter('returnMode', i) as string;

				// Handle different operations
				if (operation === 'extract') {
					// Extract Information operation
					const schemaInputType = this.getNodeParameter(
						'schemaInputType',
						i
					) as string;
					const pagesPerChunk = this.getNodeParameter(
						'pagesPerChunk',
						i,
						0
					) as number;

					// Schema parsing
					let responseFormat: IDataObject | undefined;
					let schemaName: string;
					let schemaObj: IDataObject | undefined;

					if (schemaInputType === 'schema') {
						// Schema Only mode
						schemaName = this.getNodeParameter('schemaName', i) as string;
						const schemaRaw = this.getNodeParameter('json_schema', i) as
							| string
							| IDataObject;

						try {
							if (typeof schemaRaw === 'string') {
								// JSON cleaning: remove leading/trailing spaces and invisible characters
								const cleanedJson = schemaRaw
									.trim()
									.replace(/[\u200B-\u200D\uFEFF]/g, '');
								schemaObj = JSON.parse(cleanedJson) as IDataObject;
							} else if (typeof schemaRaw === 'object' && schemaRaw !== null) {
								schemaObj = schemaRaw as IDataObject;
							} else {
								throw new NodeOperationError(this.getNode(), 'Invalid schema data type');
							}
						} catch (error) {
							throw new NodeOperationError(
								this.getNode(),
								`Invalid JSON schema provided: ${(error as Error).message}`
							);
						}

						responseFormat = {
							type: 'json_schema',
							json_schema: {
								name: schemaName,
								schema: schemaObj,
							},
						};
					} else {
						// Full Response Format mode
						const fullResponseRaw = this.getNodeParameter(
							'fullResponseFormat',
							i
						) as string | IDataObject;

						try {
							if (typeof fullResponseRaw === 'string') {
								// Step 1: Basic cleaning (remove only invisible characters)
								let cleanedJson = fullResponseRaw
									.trim() // Remove leading/trailing spaces
									.replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove BOM and zero-width characters
									.replace(/\r\n/g, '\n') // Normalize Windows line breaks
									.replace(/\r/g, '\n'); // Normalize Mac line breaks

								// Step 2: JSON validation and format detection
								let parsedJson: IDataObject;
								try {
									// First try parsing as original
									parsedJson = JSON.parse(cleanedJson) as IDataObject;
								} catch (firstError) {
									// If failed, consider as compressed JSON and do additional cleaning
									this.logger.debug(
										'First parse failed, trying compressed JSON cleaning',
										{ error: (firstError as Error).message }
									);

									cleanedJson = cleanedJson
										.replace(/\n/g, '') // Remove all line breaks
										.replace(/\s+/g, ' ') // Replace consecutive spaces with single space
										.replace(/\s*([{}[\]":,])/g, '$1') // Remove spaces before JSON separators
										.replace(/([{}[\]":,])\s*/g, '$1') // Remove spaces after JSON separators
										.trim(); // Final space removal

									// Attempt JSON structure validation and modification
									cleanedJson =
										InformationExtractionUpstage.validateAndFixJsonStructure(
											cleanedJson,
											this.logger
										);

									parsedJson = JSON.parse(cleanedJson) as IDataObject;
								}

								// Step 3: JSON object validation
								if (typeof parsedJson !== 'object' || parsedJson === null) {
									throw new NodeOperationError(this.getNode(), 'Parsed result is not a valid JSON object');
								}

								// Step 4: Required structure validation
								if (!parsedJson.type || !parsedJson.json_schema) {
									throw new NodeOperationError(
										this.getNode(),
										'Missing required fields: type or json_schema'
									);
								}

								responseFormat = parsedJson;

								// Debug logging
								this.logger.debug('JSON parsing successful', {
									type: parsedJson.type,
									hasSchema: !!parsedJson.json_schema,
								});
							} else if (
								typeof fullResponseRaw === 'object' &&
								fullResponseRaw !== null
							) {
								responseFormat = fullResponseRaw as IDataObject;
							} else {
								throw new NodeOperationError(this.getNode(), 'Invalid response format data type');
							}
						} catch (error) {
							throw new NodeOperationError(
								this.getNode(),
								`Invalid full response format JSON provided: ${(error as Error).message}`
							);
						}
					}

					// Compose messages
					const dataUrlOrHttp =
						await InformationExtractionUpstage.getImageDataUrlOrHttp(
							this,
							inputType,
							i,
							items
						);

					const requestBody: InformationExtractionRequestBody = {
						model,
						messages: [
							{
								role: 'user',
								content: [
									{
										type: 'image_url',
										image_url: { url: dataUrlOrHttp },
									},
								],
							},
						],
						response_format: responseFormat,
					};

					// chunking options (optional)
					if (pagesPerChunk && pagesPerChunk > 0) {
						requestBody.chunking = { pages_per_chunk: pagesPerChunk };
					}

					// Additional extraction options
					const location = this.getNodeParameter('location', i, false) as boolean;
					const confidence = this.getNodeParameter('confidence', i, false) as boolean;
					const split = this.getNodeParameter('split', i, false) as boolean;
					if (location) requestBody.location = true;
					if (confidence) requestBody.confidence = true;
					if (split) requestBody.split = true;

					const requestOptions: IHttpRequestOptions = {
						method: 'POST',
						url: 'https://api.upstage.ai/v1/information-extraction',
						body: requestBody,
						json: true,
					};

					const response =
						await this.helpers.httpRequestWithAuthentication.call(
							this,
							'upstageApi',
							requestOptions
						);

					if (returnMode === 'full') {
						returnData.push({ json: response, pairedItem: { item: i } });
					} else {
						// Parse extracted JSON
						const content = response?.choices?.[0]?.message?.content ?? '';
						let extracted: IDataObject;
						try {
							extracted = content ? JSON.parse(content) : {};
						} catch {
							// Content may not be JSON string, so return original text on failure
							extracted = { _raw: content };
						}

						returnData.push({
							json: {
								extracted,
								model: response?.model,
								usage: response?.usage,
								full_response: response,
							},
							pairedItem: { item: i },
						});
					}
				} else {
					// Generate Schema operation
					const prompt = (
						this.getNodeParameter('prompt', i, '') as string
					)?.trim();

					// Compose messages
					const dataUrlOrHttp =
						await InformationExtractionUpstage.getImageDataUrlOrHttp(
							this,
							inputType,
							i,
							items
						);

					// Compose messages
					const messages: Array<{
						role: 'user';
						content:
							| string
							| Array<{ type: 'image_url'; image_url: { url: string } }>;
					}> = [];
					if (prompt) {
						messages.push({ role: 'user', content: prompt });
					}
					messages.push({
						role: 'user',
						content: [
							{
								type: 'image_url',
								image_url: { url: dataUrlOrHttp },
							},
						],
					});

					// Request body
					const requestBody: {
						model: string;
						messages: Array<{
							role: 'user';
							content:
								| string
								| Array<{ type: 'image_url'; image_url: { url: string } }>;
						}>;
					} = {
						model,
						messages,
					};

					const requestOptions: IHttpRequestOptions = {
						method: 'POST',
						url: 'https://api.upstage.ai/v1/information-extraction/schema-generation',
						body: requestBody,
						json: true,
					};

					// Call
					const response =
						await this.helpers.httpRequestWithAuthentication.call(
							this,
							'upstageApi',
							requestOptions
						);

					// Response parsing + binary passthrough
					if (returnMode === 'full') {
						const out: INodeExecutionData = {
							json: response,
							pairedItem: { item: i },
						};
						if (items[i].binary) out.binary = items[i].binary; // passthrough
						returnData.push(out);
					} else {
						const contentStr = response?.choices?.[0]?.message?.content ?? '';
						let schemaObj: IDataObject;
						try {
							schemaObj = contentStr ? JSON.parse(contentStr) : {};
						} catch {
							schemaObj = { _raw: contentStr };
						}

						const out: INodeExecutionData = {
							json: {
								schema_type: schemaObj?.type ?? null,
								json_schema: schemaObj?.json_schema ?? null,
								raw: schemaObj,
								model: response?.model,
								usage: response?.usage,
							},
							pairedItem: { item: i },
						};
						if (items[i].binary) out.binary = items[i].binary; // passthrough
						returnData.push(out);
					}
				}
			} catch (error) {
				handleNodeError(
					this,
					error,
					i,
					'Upstage Information Extraction',
					returnData
				);
			}
		}

		return [returnData];
	}
}
