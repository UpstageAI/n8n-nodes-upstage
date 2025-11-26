import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IHttpRequestOptions,
	IDataObject,
} from 'n8n-workflow';
import { handleNodeError } from '../utils/errorHandling';

interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

interface ChatRequestBody extends IDataObject {
	model: string;
	messages: ChatMessage[];
	temperature?: number;
	max_tokens?: number;
	top_p?: number;
	stream?: boolean;
	reasoning_effort?: string;
	frequency_penalty?: number;
	presence_penalty?: number;
	response_format?: IDataObject;
}

export class LmChatUpstage implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Upstage Solar Chat',
		name: 'lmChatUpstage',
		icon: 'file:../upstage_v2.svg',
		group: ['transform'],
		version: 1,
		description: 'Use Upstage Solar models for chat completions',
		defaults: {
			name: 'Upstage Solar Chat',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'upstageApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: [
					{
						name: 'solar-mini',
						value: 'solar-mini',
						description: 'Fast and efficient model for basic tasks',
					},
					{
						name: 'solar-pro',
						value: 'solar-pro',
						description: 'Powerful model for complex tasks',
					},
					{
						name: 'solar-pro2',
						value: 'solar-pro2',
						description: 'Latest and most advanced Solar model',
					},
				],
				default: 'solar-mini',
				description: 'The Solar model to use',
			},
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				placeholder: 'Add message',
				options: [
					{
						displayName: 'Message',
						name: 'message',
						values: [
							{
								displayName: 'Role',
								name: 'role',
								type: 'options',
								options: [
									{
										name: 'System',
										value: 'system',
									},
									{
										name: 'User',
										value: 'user',
									},
									{
										name: 'Assistant',
										value: 'assistant',
									},
								],
								default: 'user',
							},
							{
								displayName: 'Content',
								name: 'content',
								type: 'string',
								typeOptions: {
									rows: 2,
								},
								default: '',
								description: 'Message content',
							},
						],
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						default: 0.7,
						typeOptions: {
							minValue: 0,
							maxValue: 2,
							numberPrecision: 1,
						},
						description:
							'Controls randomness in output. Higher values make output more random.',
					},
					{
						displayName: 'Max Tokens',
						name: 'max_tokens',
						type: 'number',
						default: 1000,
						typeOptions: {
							minValue: 1,
							maxValue: 4000,
						},
						description: 'Maximum number of tokens to generate',
					},
					{
						displayName: 'Top P',
						name: 'top_p',
						type: 'number',
						default: 0.9,
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberPrecision: 2,
						},
						description: 'Nucleus sampling parameter',
					},
					{
						displayName: 'Stream',
						name: 'stream',
						type: 'boolean',
						default: false,
						description:
							'Whether to stream the response. Note: Streaming is not fully supported in n8n community nodes and will be processed as non-streaming.',
					},
					{
						displayName: 'Reasoning Effort',
						name: 'reasoning_effort',
						type: 'options',
						options: [
							{
								name: 'Low',
								value: 'low',
								description: 'Disable reasoning for faster responses',
							},
							{
								name: 'High',
								value: 'high',
								description:
									'Enable reasoning for complex tasks (may increase token usage)',
							},
						],
						default: 'low',
						description:
							'Controls the level of reasoning effort. Only applicable to Reasoning models.',
					},
					{
						displayName: 'Frequency Penalty',
						name: 'frequency_penalty',
						type: 'number',
						default: 0,
						typeOptions: {
							minValue: -2,
							maxValue: 2,
							numberPrecision: 2,
						},
						description:
							'Controls model tendency to repeat tokens. Positive values reduce repetition, negative values allow more repetition.',
					},
					{
						displayName: 'Presence Penalty',
						name: 'presence_penalty',
						type: 'number',
						default: 0,
						typeOptions: {
							minValue: -2,
							maxValue: 2,
							numberPrecision: 2,
						},
						description:
							'Adjusts tendency to include tokens already present. Positive values encourage new ideas, negative values maintain consistency.',
					},
					{
						displayName: 'Response Format',
						name: 'response_format',
						type: 'options',
						options: [
							{
								name: 'Text (Default)',
								value: 'text',
								description: 'Standard text response',
							},
							{
								name: 'JSON Object',
								value: 'json_object',
								description: 'Generate JSON object (requires "JSON" in prompt)',
							},
							{
								name: 'JSON Schema',
								value: 'json_schema',
								description:
									'Generate JSON with custom schema (structured outputs)',
							},
						],
						default: 'text',
						description:
							'Format for model output. JSON formats only work with solar-pro2 model.',
					},
					{
						displayName: 'JSON Schema',
						name: 'json_schema',
						type: 'json',
						displayOptions: {
							show: {
								response_format: ['json_schema'],
							},
						},
						default: '{}',
						description:
							'JSON schema for structured outputs when using json_schema format',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const model = this.getNodeParameter('model', i) as string;
				const messagesRaw = this.getNodeParameter(
					'messages.message',
					i,
					[]
				) as Array<{
					role: string;
					content: string;
				}>;
				const options = this.getNodeParameter('options', i, {}) as {
					temperature?: number;
					max_tokens?: number;
					top_p?: number;
					stream?: boolean;
					reasoning_effort?: string;
					frequency_penalty?: number;
					presence_penalty?: number;
					response_format?: string;
					json_schema?: string;
				};

				// Validate messages array
				if (!messagesRaw || messagesRaw.length === 0) {
					throw new Error(
						'At least one message is required for chat completion'
					);
				}

				// Validate message content and convert to ChatMessage[]
				const messages: ChatMessage[] = [];
				for (const message of messagesRaw) {
					if (!message.content || message.content.trim() === '') {
						throw new Error('All messages must have non-empty content');
					}
					if (!['system', 'user', 'assistant'].includes(message.role)) {
						throw new Error(
							`Invalid message role: ${message.role}. Must be 'system', 'user', or 'assistant'`
						);
					}
					messages.push({
						role: message.role as 'system' | 'user' | 'assistant',
						content: message.content,
					});
				}

				// Build request body
				const requestBody: ChatRequestBody = {
					model,
					messages,
					temperature: options.temperature,
					max_tokens: options.max_tokens,
					top_p: options.top_p,
					stream: options.stream,
					reasoning_effort: options.reasoning_effort,
					frequency_penalty: options.frequency_penalty,
					presence_penalty: options.presence_penalty,
				};

				// Handle response_format properly
				if (options.response_format && options.response_format !== 'text') {
					if (options.response_format === 'json_object') {
						requestBody.response_format = { type: 'json_object' };
					} else if (
						options.response_format === 'json_schema' &&
						options.json_schema
					) {
						try {
							const schema = JSON.parse(options.json_schema);
							requestBody.response_format = {
								type: 'json_schema',
								json_schema: schema,
							};
						} catch (error) {
							throw new Error('Invalid JSON schema provided');
						}
					}
					// Remove the raw response_format and json_schema from body
					delete requestBody.json_schema;
				}

				// Make API request
				const requestOptions: IHttpRequestOptions = {
					method: 'POST',
					url: 'https://api.upstage.ai/v1/chat/completions',
					body: requestBody,
					json: true,
				};

				// Note: Proxy configuration is handled at the n8n instance level
				// Individual node proxy settings are not directly supported in n8n's HTTP helpers
				// Users should configure proxy through n8n's global settings or environment

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'upstageApi',
					requestOptions
				);

				// Handle streaming vs non-streaming response
				// Note: n8n's httpRequestWithAuthentication does not support streaming responses.
				// When streaming is requested, we process the response as non-streaming.
				if (options.stream) {
					this.logger.warn(
						'Streaming is not fully supported in n8n community nodes. Processing response as non-streaming.'
					);
				}

				// Extract the assistant's message
				const choice = response.choices?.[0];
				const content = choice?.message?.content || '';

				returnData.push({
					json: {
						content,
						usage: response.usage,
						model: response.model,
						created: response.created,
						full_response: response,
					},
					pairedItem: { item: i },
				});
			} catch (error) {
				handleNodeError(this, error, i, 'Upstage Solar LLM', returnData);
			}
		}

		return [returnData];
	}
}
