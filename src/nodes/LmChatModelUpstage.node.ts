import { ChatOpenAI } from '@langchain/openai';
import {
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
	type IDataObject,
} from 'n8n-workflow';
import { N8nLlmTracing, type TokensUsageParser } from '../utils/N8nLlmTracing';
import { makeN8nLlmFailedAttemptHandler } from '../utils/n8nLlmFailedAttemptHandler';
import { getConnectionHintNoticeField } from '../utils/sharedFields';
import { compareModelNames } from '../utils/modelHelpers';

interface ModelOption {
	id: string;
	name?: string;
	created?: number;
}

interface ModelListResponse {
	data: ModelOption[];
}

interface ModelConfig extends IDataObject {
	apiKey: string;
	model: string;
	configuration: IDataObject;
	maxTokens?: number;
	temperature?: number;
	streaming?: boolean;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	responseFormat?: IDataObject;
}

export class LmChatModelUpstage implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Upstage Solar Chat for Agent',
		name: 'lmChatModelUpstage',
		icon: 'file:../upstage_v2.svg',
		group: ['transform'],
		version: 1,
		description: 'For advanced usage with an AI chain',
		defaults: {
			name: 'Upstage Solar Chat for Agent',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatupstage/',
					},
				],
			},
		},
		inputs: [],
		outputs: ['ai_languageModel'],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'upstageApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: 'https://api.upstage.ai/v1',
		},
		properties: [
			getConnectionHintNoticeField(['ai_chain', 'ai_agent']),
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				description:
					'The model which will generate the completion. <a href="https://developers.upstage.ai/docs/apis/chat">Learn more</a>.',
				typeOptions: {
					loadOptions: {
						routing: {
							request: {
								method: 'GET',
								url: '/models',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data',
										},
									},
									{
										type: 'filter',
										properties: {
											pass: "={{ $responseItem && $responseItem.id && $responseItem.id.toLowerCase().includes('solar') }}",
										},
									},
									{
										type: 'setKeyValue',
										properties: {
											name: '={{ $responseItem.id }}',
											value: '={{ $responseItem.id }}',
										},
									},
									{
										type: 'sort',
										properties: {
											key: 'name',
										},
									},
								],
							},
						},
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'model',
					},
				},
				default: '',
			},
			{
				displayName: 'Response Format',
				name: 'response_format',
				type: 'options',
				placeholder: 'Add Response Format',
				options: [
					{
						name: 'Text (Default)',
						value: 'default',
						description: 'This configuration does not utilise the response format parameter. The response is provided in the standard format.',
					},
					{
						name: 'JSON Object',
						value: 'json_object',
						description:
							'Generate JSON object without schema (JSON Mode). Requires "JSON" in prompt. Only compatible with solar-pro-2 model.',
					},
					{
						name: 'JSON Schema',
						value: 'json_schema',
						description:
							'Generate JSON with custom schema (Structured outputs). Only compatible with solar-pro-2 model.',
					},
				],
				default: 'default',
				description: 'Format for model output. JSON formats only work with solar-pro-2 model.',
			},
			{
				displayName: 'JSON Schema',
				name: 'json_schema',
				type: 'json',
				default: '{}',
				displayOptions: {
					show: {
						response_format: ['json_schema'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxTokens',
						default: -1,
						description:
							'The maximum number of tokens to generate in the completion. Most models have a context length of 2048 tokens (except for the newest models, which support 32,768).',
						type: 'number',
						typeOptions: {
							maxValue: 32768,
						},
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						default: 0.7,
						typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
						description:
							'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
						type: 'number',
					},
					{
						displayName: 'Streaming',
						name: 'streaming',
						default: false,
						description: 'Whether to stream the response',
						type: 'boolean',
					},
					{
						displayName: 'Top P',
						name: 'topP',
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
						name: 'frequencyPenalty',
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
						name: 'presencePenalty',
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

	methods = {
		loadOptions: {
			async getModels(
				this: ILoadOptionsFunctions
			): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('upstageApi');
				const requestOptions = {
					method: 'GET' as const,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
				};

				try {
					const response = await this.helpers.request(
						'https://api.upstage.ai/v1/models',
						requestOptions
					);

					if (!response?.data || !Array.isArray(response.data)) {
						this.logger.warn('Invalid response format from models API');
						return [{ name: 'solar-mini', value: 'solar-mini' }];
					}

					// Filter for Solar models only, remove duplicates, and sort by version/date (latest first)
					const modelResponse = response as ModelListResponse;
					const solarModels = modelResponse.data
						.filter((model: ModelOption) =>
							model?.id?.toLowerCase().includes('solar')
						)
						.map((model: ModelOption) => ({
							name: model.id,
							value: model.id,
							...model,
						}))
						.filter(
							(
								model: INodePropertyOptions,
								index: number,
								self: INodePropertyOptions[]
							) => self.findIndex(m => m.value === model.value) === index
						)
						.sort((a: INodePropertyOptions, b: INodePropertyOptions) =>
							compareModelNames(a.name, b.name)
						);

					if (solarModels.length === 0) {
						this.logger.warn('No Solar models found in API response');
						return [{ name: 'solar-mini', value: 'solar-mini' }];
					}

					return solarModels;
				} catch (error) {
					this.logger.error('Error fetching models', { error });
					return [{ name: 'solar-mini', value: 'solar-mini' }];
				}
			},
		},
	};

	async supplyData(
		this: ISupplyDataFunctions,
		itemIndex: number
	): Promise<SupplyData> {
		const credentials = await this.getCredentials('upstageApi');

		let modelName = this.getNodeParameter('model', itemIndex) as string;

		if (!modelName) {
			try {
				const requestOptions = {
					method: 'GET' as const,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
				};

				const response = await this.helpers.request(
					'https://api.upstage.ai/v1/models',
					requestOptions
				);

				if (response?.data && Array.isArray(response.data)) {
					const solarModels = response.data
						.filter((model: ModelOption) =>
							model?.id?.toLowerCase().includes('solar')
						)
						.map((model: ModelOption) => model.id)
						.sort(compareModelNames);

					if (solarModels.length > 0) {
						modelName = solarModels[0];
						this.logger.debug(`Auto-selected latest Solar model: ${modelName}`);
					}
				}
			} catch (error) {
				this.logger.warn('Failed to fetch models dynamically, using fallback', {
					error,
				});
			}

			if (!modelName) {
				const fallbackModels = [
					'solar-pro2-preview',
					'solar-pro',
					'solar-mini',
				];
				modelName = fallbackModels[0];
				this.logger.debug(`Using fallback model: ${modelName}`);
			}
		}

		const responseFormat = this.getNodeParameter('response_format', itemIndex, 'default') as string;
		const jsonSchema = this.getNodeParameter('json_schema', itemIndex, '{}') as string;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			maxTokens?: number;
			temperature?: number;
			streaming?: boolean;
			topP?: number;
			reasoning_effort?: string;
			frequencyPenalty?: number;
			presencePenalty?: number;
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

		const configuration = {
			baseURL: 'https://api.upstage.ai/v1',
			// Note: Proxy configuration should be handled at the n8n instance level
			// Users should configure proxy through n8n's global settings
			defaultHeaders: {
				'Content-Type': 'application/json',
			},
		};

		const upstageTokensParser: TokensUsageParser = llmOutput => {
			if (!llmOutput || typeof llmOutput !== 'object') {
				return {
					completionTokens: 0,
					promptTokens: 0,
					totalTokens: 0,
				};
			}
			const llmOutputObj = llmOutput as Record<string, unknown>;
			const usage = llmOutputObj?.tokenUsage || llmOutputObj?.usage;
			if (usage && typeof usage === 'object') {
				const usageObj = usage as Record<string, unknown>;
				const completionTokens =
					(typeof usageObj.completion_tokens === 'number'
						? usageObj.completion_tokens
						: 0) ||
					(typeof usageObj.completionTokens === 'number'
						? usageObj.completionTokens
						: 0) ||
					0;
				const promptTokens =
					(typeof usageObj.prompt_tokens === 'number'
						? usageObj.prompt_tokens
						: 0) ||
					(typeof usageObj.promptTokens === 'number'
						? usageObj.promptTokens
						: 0) ||
					0;
				const totalTokens =
					(typeof usageObj.total_tokens === 'number'
						? usageObj.total_tokens
						: 0) ||
					(typeof usageObj.totalTokens === 'number'
						? usageObj.totalTokens
						: 0) ||
					completionTokens + promptTokens;

				// Token usage logging removed (use n8n logger in tracing if needed)

				return {
					completionTokens,
					promptTokens,
					totalTokens,
				};
			}

			// No token usage data found (logging removed)
			return {
				completionTokens: 0,
				promptTokens: 0,
				totalTokens: 0,
			};
		};

		// Create tracing and failure handler using our implementations
		const tracing = new N8nLlmTracing(this, {
			tokensUsageParser: upstageTokensParser,
		});
		const failureHandler = makeN8nLlmFailedAttemptHandler(this);

		// Handle response_format properly according to Upstage API documentation:
		// - Default: response_format parameter is not sent (standard text response)
		// - JSON Mode: {"type": "json_object"}
		// - Structured outputs: {"type": "json_schema", "json_schema": {...schema...}}
		let responseFormatObj: IDataObject | undefined;
		if (responseFormat === 'json_object') {
			// JSON Mode: Generate JSON object without schema
			responseFormatObj = { type: 'json_object' };
		} else if (responseFormat === 'json_schema') {
			// Structured outputs: Generate JSON with custom schema
			if (!jsonSchema || jsonSchema.trim() === '' || jsonSchema === '{}') {
				throw new Error(
					'JSON Schema is required when Response Format is set to "JSON Schema"'
				);
			}
			try {
				const schema = JSON.parse(jsonSchema);
				responseFormatObj = {
					type: 'json_schema',
					json_schema: schema,
				};
			} catch (error) {
				throw new Error(
					`Invalid JSON schema provided: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
		// If responseFormat is 'default', responseFormatObj remains undefined and won't be sent

		const modelConfig: ModelConfig = {
			apiKey: credentials.apiKey as string,
			model: modelName, // Use 'model' instead of 'modelName' for better API compatibility
			configuration: configuration as IDataObject,
			maxTokens: options.maxTokens,
			temperature: options.temperature,
			streaming: options.streaming || false,
			topP: options.topP,
			frequencyPenalty: options.frequencyPenalty,
			presencePenalty: options.presencePenalty,
		};

		// Add response_format if specified (not empty)
		if (responseFormatObj) {
			modelConfig.responseFormat = responseFormatObj;
		}

		// Add reasoning_effort as model kwargs if specified
		if (options.reasoning_effort) {
			modelConfig.modelKwargs = {
				...(modelConfig.modelKwargs as Record<string, unknown> || {}),
				reasoning_effort: options.reasoning_effort,
			};
		}

		// Process function_calling tools if provided
		const functionCallingConfig = options.function_calling?.config;
		if (functionCallingConfig?.tools?.tool && functionCallingConfig.tools.tool.length > 0) {
			const tools = functionCallingConfig.tools.tool.map(toolRaw => {
				const parameters =
					typeof toolRaw.parameters === 'string'
						? JSON.parse(toolRaw.parameters)
						: toolRaw.parameters;
				return {
					type: 'function' as const,
					function: {
						name: toolRaw.name,
						description: toolRaw.description,
						parameters,
					},
				};
			});
			modelConfig.tools = tools;

			// Handle tool_choice
			const toolChoiceRaw = functionCallingConfig.tool_choice || 'auto';
			if (toolChoiceRaw === 'specific') {
				const functionName = functionCallingConfig.function_name;
				if (functionName) {
					modelConfig.toolChoice = {
						type: 'function',
						function: { name: functionName },
					};
				}
			} else if (toolChoiceRaw !== 'auto') {
				modelConfig.toolChoice = toolChoiceRaw;
			}
		}

		// Add tracing callbacks if available (when installed in n8n core)
		if (tracing) {
			modelConfig.callbacks = [tracing];
		}

		// Add failure handler if available
		if (failureHandler) {
			modelConfig.onFailedAttempt = failureHandler;
		}

		const model = new ChatOpenAI(modelConfig);

		// Tools are managed by the AI Agent node, not here
		return {
			response: model,
		};
	}
}
