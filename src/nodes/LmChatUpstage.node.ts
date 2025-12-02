import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IHttpRequestOptions,
	IDataObject,
} from 'n8n-workflow';
import { handleNodeError } from '../utils/errorHandling';

interface ToolFunction {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, unknown>;
		required?: string[];
	};
}

interface Tool {
	type: 'function';
	function: ToolFunction;
}

interface ToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string; // JSON string
	};
}

interface ChatMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string | null;
	tool_calls?: ToolCall[];
	tool_call_id?: string; // tool role일 때
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
	tools?: Tool[];
	tool_choice?:
		| 'auto'
		| 'none'
		| 'required'
		| { type: 'function'; function: { name: string } };
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
						type: 'fixedCollection',
						default: {},
						description:
							'Format for model output. JSON formats only work with solar-pro2 model.',
						options: [
							{
								displayName: 'Response Format',
								name: 'values',
								values: [
									{
										displayName: 'Format',
										name: 'format',
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
												description:
													'Generate JSON object (requires "JSON" in prompt)',
											},
											{
												name: 'JSON Schema',
												value: 'json_schema',
												description:
													'Generate JSON with custom schema (structured outputs)',
											},
										],
										default: 'text',
										description: 'Select the response format type',
									},
									{
										displayName: 'JSON Schema',
										name: 'json_schema',
										type: 'json',
										default: '{}',
										displayOptions: {
											show: {
												format: ['json_schema'],
											},
										},
										description:
											'JSON schema for structured outputs when using json_schema format',
									},
								],
							},
						],
					},
					{
						displayName: 'Function Calling',
						name: 'function_calling',
						type: 'fixedCollection',
						default: {},
						description:
							'Configure tools/functions the model can call and how they are selected',
						options: [
							{
								displayName: 'Configuration',
								name: 'config',
								values: [
									{
										displayName: 'Tools',
										name: 'tools',
										type: 'fixedCollection',
										typeOptions: {
											multipleValues: true,
										},
										default: {},
										placeholder: 'Add Tool',
										description:
											'A list of tools the model may call. Currently, only functions are supported as a tool.',
										options: [
											{
												displayName: 'Tool',
												name: 'tool',
												values: [
													{
														displayName: 'Name',
														name: 'name',
														type: 'string',
														required: true,
														default: '',
														description:
															'The name of the function to be called',
													},
													{
														displayName: 'Description',
														name: 'description',
														type: 'string',
														required: true,
														default: '',
														description:
															'A description of what the function does',
													},
													{
														displayName: 'Parameters',
														name: 'parameters',
														type: 'json',
														required: true,
														description:
															'The parameters the functions accepts, described as a JSON Schema object',
														default:
															'{\n  "type": "object",\n  "properties": {}\n}',
													},
												],
											},
										],
									},
									{
										displayName: 'Tool Choice',
										name: 'tool_choice',
										type: 'options',
										options: [
											{
												name: 'Auto',
												value: 'auto',
												description:
													'Model can pick between generating a message or calling a function',
											},
											{
												name: 'None',
												value: 'none',
												description:
													'Model will not call any function and instead generate a message',
											},
											{
												name: 'Required',
												value: 'required',
												description: 'Model must call a function',
											},
											{
												name: 'Specific Function',
												value: 'specific',
												description:
													'Force the model to call a specific function',
											},
										],
										default: 'auto',
										description:
											'Controls which (if any) function is called by the model',
									},
									{
										displayName: 'Function Name',
										name: 'function_name',
										type: 'string',
										default: '',
										displayOptions: {
											show: {
												tool_choice: ['specific'],
											},
										},
										description:
											'The name of the function to call when tool_choice is "specific"',
									},
								],
							},
						],
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
					response_format?: {
						values?: {
							format?: string;
							json_schema?: string;
						};
					};
					function_calling?: {
						config?: {
							tools?: {
								tool?: Array<{
									name: string;
									description: string;
									parameters: string | IDataObject;
								}>;
							};
							tool_choice?: string;
							function_name?: string;
						};
					};
				};

				// Process tools parameter from options.function_calling
				const functionCallingConfig = options.function_calling?.config;
				const toolsRaw = (functionCallingConfig?.tools?.tool || []) as Array<{
					name: string;
					description: string;
					parameters: string | IDataObject;
				}>;

				const tools: Tool[] = [];
				if (toolsRaw && toolsRaw.length > 0) {
					for (const toolRaw of toolsRaw) {
						try {
							const parameters =
								typeof toolRaw.parameters === 'string'
									? JSON.parse(toolRaw.parameters)
									: toolRaw.parameters;

							tools.push({
								type: 'function',
								function: {
									name: toolRaw.name,
									description: toolRaw.description,
									parameters: parameters as {
										type: 'object';
										properties: Record<string, unknown>;
										required?: string[];
									},
								},
							});
						} catch (error) {
							throw new Error(
								`Invalid tool parameters JSON: ${error instanceof Error ? error.message : String(error)}`
							);
						}
					}
				}

				// Process tool_choice parameter from options.function_calling
				const toolChoiceRaw = functionCallingConfig?.tool_choice || 'auto';
				let toolChoice: ChatRequestBody['tool_choice'] = 'auto';

				if (toolChoiceRaw === 'specific') {
					const functionName = functionCallingConfig?.function_name;
					if (!functionName) {
						throw new Error(
							'Function name is required when tool_choice is "specific"'
						);
					}
					toolChoice = {
						type: 'function',
						function: { name: functionName },
					};
				} else {
					toolChoice = toolChoiceRaw as 'auto' | 'none' | 'required';
				}

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

				// Add tools and tool_choice if tools are provided
				if (tools.length > 0) {
					requestBody.tools = tools;
					requestBody.tool_choice = toolChoice;
				}

				// Handle response_format properly
				const responseFormatConfig = options.response_format?.values;
				if (responseFormatConfig?.format && responseFormatConfig.format !== 'text') {
					if (responseFormatConfig.format === 'json_object') {
						requestBody.response_format = { type: 'json_object' };
					} else if (
						responseFormatConfig.format === 'json_schema' &&
						responseFormatConfig.json_schema
					) {
						try {
							const schema = JSON.parse(responseFormatConfig.json_schema);
							requestBody.response_format = {
								type: 'json_schema',
								json_schema: schema,
							};
						} catch (error) {
							throw new Error('Invalid JSON schema provided');
						}
					}
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
				const message = choice?.message || {};
				const content = message.content || '';
				const toolCalls = message.tool_calls || [];

				// Build response data
				const responseData: IDataObject = {
					content,
					usage: response.usage,
					model: response.model,
					created: response.created,
					full_response: response,
				};

				// Add tool_calls if present
				if (toolCalls.length > 0) {
					responseData.tool_calls = toolCalls.map((tc: ToolCall) => ({
						id: tc.id,
						type: tc.type,
						function: {
							name: tc.function.name,
							arguments:
								typeof tc.function.arguments === 'string'
									? JSON.parse(tc.function.arguments)
									: tc.function.arguments,
						},
					}));
					responseData.has_tool_calls = true;
				} else {
					responseData.has_tool_calls = false;
				}

				returnData.push({
					json: responseData,
					pairedItem: { item: i },
				});
			} catch (error) {
				handleNodeError(this, error, i, 'Upstage Solar LLM', returnData);
			}
		}

		return [returnData];
	}
}
