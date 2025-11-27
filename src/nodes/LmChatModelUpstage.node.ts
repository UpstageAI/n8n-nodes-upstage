import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
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
import { jsonSchemaToZod } from '@n8n/json-schema-to-zod';
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
				],
			},
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
					'A list of tools the model may call. These tools will be bound to the model using LangChain bindTools.',
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
								description: 'The name of the function to be called',
							},
							{
								displayName: 'Description',
								name: 'description',
								type: 'string',
								required: true,
								default: '',
								description: 'A description of what the function does',
							},
							{
								displayName: 'Parameters',
								name: 'parameters',
								type: 'json',
								required: true,
								description:
									'The parameters the functions accepts, described as a JSON Schema object',
								default: '{\n  "type": "object",\n  "properties": {}\n}',
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

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			maxTokens?: number;
			temperature?: number;
			streaming?: boolean;
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

		const modelConfig: ModelConfig = {
			apiKey: credentials.apiKey as string,
			model: modelName, // Use 'model' instead of 'modelName' for better API compatibility
			configuration: configuration as IDataObject,
			maxTokens: options.maxTokens,
			temperature: options.temperature,
			streaming: options.streaming || false,
		};

		// Add tracing callbacks if available (when installed in n8n core)
		if (tracing) {
			modelConfig.callbacks = [tracing];
		}

		// Add failure handler if available
		if (failureHandler) {
			modelConfig.onFailedAttempt = failureHandler;
		}

		const model = new ChatOpenAI(modelConfig);

		// Process tools parameter for Function Calling
		const toolsRaw = this.getNodeParameter(
			'tools.tool',
			itemIndex,
			[]
		) as Array<{
			name: string;
			description: string;
			parameters: string | IDataObject;
		}>;

		// If tools are provided, bind them to the model
		if (toolsRaw && toolsRaw.length > 0) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const langChainTools: any[] = [];

			for (const toolRaw of toolsRaw) {
				try {
					const parameters =
						typeof toolRaw.parameters === 'string'
							? JSON.parse(toolRaw.parameters)
							: toolRaw.parameters;

					// Convert JSON Schema to Zod schema
					const zodSchema = jsonSchemaToZod(parameters as any);

					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const tool = new DynamicStructuredTool({
						name: toolRaw.name,
						description: toolRaw.description,
						schema: zodSchema as any,
						func: async (input: any) => {
							// Actual function execution is handled by the AI Agent node
							// This is just a placeholder that returns the input as JSON
							return JSON.stringify(input);
						},
					}) as any;

					langChainTools.push(tool);
				} catch (error) {
					throw new Error(
						`Invalid tool parameters JSON for tool "${toolRaw.name}": ${error instanceof Error ? error.message : String(error)}`
					);
				}
			}

			// Bind tools to the model using LangChain's bindTools
			// Type assertion needed due to LangChain's complex generic types
			return {
				response: model.bindTools(langChainTools),
			};
		}

		return {
			response: model,
		};
	}
}
