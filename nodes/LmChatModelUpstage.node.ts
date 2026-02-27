import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { supplyModel, type OpenAiModel } from '@n8n/ai-node-sdk';
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
		usableAsTool: true,
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
						description:
							'This configuration does not utilise the response format parameter. The response is provided in the standard format.',
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
				description:
					'Format for model output. JSON formats only work with solar-pro-2 model.',
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
							'The maximum number of tokens to generate. Use -1 for model default. Limits vary by model (solar-mini: 32K, solar-pro2: 65K, solar-pro3: 128K).',
						type: 'number',
						typeOptions: {
							maxValue: 128000,
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
								description: 'Disable reasoning for fastest responses',
							},
							{
								name: 'Medium',
								value: 'medium',
								description: 'Balanced reasoning depth (default for solar-pro3)',
							},
							{
								name: 'High',
								value: 'high',
								description:
									'Maximum reasoning depth (may increase token usage)',
							},
						],
						default: 'low',
						description:
							'Controls the level of reasoning effort. solar-pro3 defaults to medium, solar-pro2 requires high to enable reasoning.',
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
						displayName: 'Stop Sequences',
						name: 'stop',
						type: 'string',
						default: '',
						description:
							'Comma-separated list of sequences where the model will stop generating.',
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
				const requestOptions: IHttpRequestOptions = {
					method: 'GET',
					url: 'https://api.upstage.ai/v1/models',
				};

				try {
					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'upstageApi',
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
				const requestOptions: IHttpRequestOptions = {
					method: 'GET',
					url: 'https://api.upstage.ai/v1/models',
				};

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'upstageApi',
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
					'solar-pro3',
					'solar-pro2',
					'solar-mini',
				];
				modelName = fallbackModels[0];
				this.logger.debug(`Using fallback model: ${modelName}`);
			}
		}

		const responseFormat = this.getNodeParameter(
			'response_format',
			itemIndex,
			'default'
		) as string;
		const jsonSchema = this.getNodeParameter(
			'json_schema',
			itemIndex,
			'{}'
		) as string;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			maxTokens?: number;
			temperature?: number;
			streaming?: boolean;
			topP?: number;
			reasoning_effort?: string;
			frequencyPenalty?: number;
			presencePenalty?: number;
			stop?: string;
		};

		// Build additionalParams for response_format
		const additionalParams: Record<string, unknown> = {};
		if (responseFormat === 'json_object') {
			additionalParams.response_format = { type: 'json_object' };
		} else if (responseFormat === 'json_schema') {
			if (!jsonSchema || jsonSchema.trim() === '' || jsonSchema === '{}') {
				throw new NodeOperationError(
					this.getNode(),
					'JSON Schema is required when Response Format is set to "JSON Schema"'
				);
			}
			try {
				const schema = JSON.parse(jsonSchema);
				additionalParams.response_format = {
					type: 'json_schema',
					json_schema: schema,
				};
			} catch (error) {
				throw new NodeOperationError(
					this.getNode(),
					`Invalid JSON schema provided: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}

		const modelConfig: OpenAiModel = {
			type: 'openai',
			baseUrl: 'https://api.upstage.ai/v1',
			apiKey: credentials.apiKey as string,
			model: modelName,
			temperature: options.temperature,
			maxTokens:
				options.maxTokens && options.maxTokens > 0
					? options.maxTokens
					: undefined,
			topP: options.topP,
			frequencyPenalty: options.frequencyPenalty,
			presencePenalty: options.presencePenalty,
			streaming: options.streaming ?? false,
			reasoning: options.reasoning_effort
				? { effort: options.reasoning_effort as 'low' | 'medium' | 'high' }
				: undefined,
			stop: options.stop
				? options.stop.split(',').map((s: string) => s.trim()).filter(Boolean)
				: undefined,
			additionalParams: Object.keys(additionalParams).length > 0
				? additionalParams
				: undefined,
		};

		// Type cast needed: n8n-workflow versions differ between project (1.x) and ai-node-sdk (2.x)
		// The interfaces are functionally identical at runtime
		return supplyModel(this as unknown as Parameters<typeof supplyModel>[0], modelConfig);
	}
}
