import type {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	SupplyData,
	IExecuteFunctions,
	NodeConnectionType,
	IHttpRequestOptions,
	INode,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

interface EmbeddingResponseItem {
	index: number;
	embedding: number[];
}

interface EmbeddingAPIResponse {
	data: EmbeddingResponseItem[];
}

import { getConnectionHintNoticeField } from '../utils/sharedFields';
import { logAiEvent } from '../utils/telemetry';

export class EmbeddingsUpstageModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Upstage Embed for Agent',
		name: 'embeddingsUpstageModel',
		icon: 'file:../upstage_v2.svg',
		group: ['transform'],
		version: 1,
		description:
			'Embedding Model for Vector DB - Upstage Solar Embeddings. Supports up to 100 strings per request with max 204,800 total tokens. Each text should be under 4000 tokens (optimal: under 512 tokens).',
		defaults: {
			name: 'Upstage Embed for Agent',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://js.langchain.com/docs/modules/data_connection/text_embedding/',
					},
				],
			},
		},
		inputs: [],
		outputs: ['ai_embedding'],
		outputNames: ['Embeddings'],
		usableAsTool: true,
		credentials: [
			{
				name: 'upstageApi',
				required: true,
			},
		],
		properties: [
			getConnectionHintNoticeField(['ai_vectorStore']),
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				description: 'The Upstage embedding model to use',
				default: 'embedding-query',
				options: [
					{
						name: 'Embedding Query',
						value: 'embedding-query',
						description: 'Optimized for search queries and questions',
					},
					{
						name: 'Embedding Passage',
						value: 'embedding-passage',
						description: 'Optimized for documents and passages',
					},
				],
			},
		],
	};

	async supplyData(
		this: ISupplyDataFunctions,
		itemIndex: number
	): Promise<SupplyData> {
		this.logger.debug('Supply data for embeddings');
		const model = this.getNodeParameter('model', itemIndex) as string;

		// Create HTTP request wrapper using n8n's helpers
		const executeFunctions = this;
		const httpRequest = async (
			requestOptions: IHttpRequestOptions
		): Promise<EmbeddingAPIResponse> => {
			const response =
				await executeFunctions.helpers.httpRequestWithAuthentication.call(
					executeFunctions,
					'upstageApi',
					requestOptions
				);
			return response as EmbeddingAPIResponse;
		};

		// Create a custom embedding model that implements the Embeddings interface
		const embeddingModel = new UpstageEmbeddings({
			model,
			node: this.getNode(),
			httpRequest,
		});

		return {
			response: logWrapper(embeddingModel, this),
		};
	}
}

// ============================================================================
// Helper functions for wrapping Embeddings with n8n data flow integration
// ============================================================================

type MethodArgs = unknown[];

/**
 * Wraps async method calls with error handling
 * @internal Exported for testing purposes
 */
export async function callMethodAsync<T>(
	this: T,
	parameters: {
		executeFunctions: IExecuteFunctions | ISupplyDataFunctions;
		connectionType: NodeConnectionType;
		currentNodeRunIndex: number;
		method: (...args: MethodArgs) => Promise<unknown>;
		arguments: unknown[];
	}
): Promise<unknown> {
	try {
		return await parameters.method.call(this, ...parameters.arguments);
	} catch (e) {
		const connectedNode = parameters.executeFunctions.getNode();

		const error = new NodeOperationError(connectedNode, e as Error, {
			functionality: 'configuration-node',
		});

		throw error;
	}
}

/**
 * Wraps Embeddings instance to integrate with n8n data flow
 * Adds input/output data tracking and telemetry logging
 * @internal Exported for testing purposes
 */
export function logWrapper<T extends EmbeddingsInterface>(
	originalInstance: T,
	executeFunctions: IExecuteFunctions | ISupplyDataFunctions
): T {
	return new Proxy(originalInstance, {
		get: (target, prop) => {
			// ========== Embeddings ==========
			// Docs -> Embeddings
			if (prop === 'embedDocuments' && 'embedDocuments' in target) {
				return async (documents: string[]): Promise<number[][]> => {
					const connectionType = 'ai_embedding';
					const { index } = executeFunctions.addInputData(connectionType, [
						[{ json: { documents } }],
					]);

					const response = (await callMethodAsync.call(target, {
						executeFunctions,
						connectionType,
						currentNodeRunIndex: index,
						method: target[prop] as (
							...args: MethodArgs
						) => Promise<number[][]>,
						arguments: [documents],
					})) as number[][];

					logAiEvent(executeFunctions, 'ai-document-embedded');
					executeFunctions.addOutputData(connectionType, index, [
						[{ json: { response } }],
					]);
					return response;
				};
			}
			// Query -> Embeddings
			if (prop === 'embedQuery' && 'embedQuery' in target) {
				return async (query: string): Promise<number[]> => {
					const connectionType = 'ai_embedding';
					const { index } = executeFunctions.addInputData(connectionType, [
						[{ json: { query } }],
					]);

					const response = (await callMethodAsync.call(target, {
						executeFunctions,
						connectionType,
						currentNodeRunIndex: index,
						method: target[prop] as (...args: MethodArgs) => Promise<number[]>,
						arguments: [query],
					})) as number[];
					logAiEvent(executeFunctions, 'ai-query-embedded');
					executeFunctions.addOutputData(connectionType, index, [
						[{ json: { response } }],
					]);
					return response;
				};
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
			return (target as Record<string, unknown>)[prop as string] as any;
		},
	});
}

// Custom Embeddings implementation for Upstage Solar (LangChain-free)
interface UpstageEmbeddingsParams {
	model: string;
	node: INode;
	httpRequest: (requestOptions: IHttpRequestOptions) => Promise<EmbeddingAPIResponse>;
	baseURL?: string;
	batchSize?: number;
	stripNewLines?: boolean;
}

/**
 * Embeddings interface compatible with n8n AI Vector Store nodes
 */
interface EmbeddingsInterface {
	embedDocuments(texts: string[]): Promise<number[][]>;
	embedQuery(text: string): Promise<number[]>;
}

class UpstageEmbeddings implements EmbeddingsInterface {
	public model: string;
	public baseURL: string;
	public batchSize: number;
	public stripNewLines: boolean;
	private node: INode;
	private httpRequest: (requestOptions: IHttpRequestOptions) => Promise<EmbeddingAPIResponse>;

	constructor(fields: UpstageEmbeddingsParams) {
		this.model = fields.model;
		this.node = fields.node;
		this.httpRequest = fields.httpRequest;
		this.baseURL = fields.baseURL ?? 'https://api.upstage.ai/v1';
		this.batchSize = fields.batchSize ?? 100; // Upstage API limit
		this.stripNewLines = fields.stripNewLines ?? true;
	}

	/**
	 * Embed documents (batch processing)
	 */
	async embedDocuments(texts: string[]): Promise<number[][]> {
		// Validate all inputs are strings before preprocessing
		for (let i = 0; i < texts.length; i++) {
			if (!texts[i] || typeof texts[i] !== 'string') {
				throw new NodeOperationError(
					this.node,
					`Invalid input at index ${i}: expected a non-empty string, got ${typeof texts[i]}`
				);
			}
		}

		// Preprocess texts (strip newlines if enabled)
		const processedTexts = this.stripNewLines
			? texts.map(text => text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
			: texts;

		// Process in batches to respect API limits
		const results: number[][] = [];
		for (let i = 0; i < processedTexts.length; i += this.batchSize) {
			const batch = processedTexts.slice(i, i + this.batchSize);
			const batchResults = await this.callUpstageAPI(batch);
			results.push(...batchResults);
		}

		return results;
	}

	/**
	 * Embed a single query
	 */
	async embedQuery(text: string): Promise<number[]> {
		if (!text || typeof text !== 'string') {
			throw new NodeOperationError(
				this.node,
				`Invalid input: expected a non-empty string, got ${typeof text}`
			);
		}

		// Preprocess text
		const processedText = this.stripNewLines
			? text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
			: text;

		const result = await this.callUpstageAPI([processedText]);
		return result[0];
	}

	private async callUpstageAPI(input: string[]): Promise<number[][]> {
		// Validate input - reject invalid/empty strings to maintain 1:1 alignment
		for (let i = 0; i < input.length; i++) {
			if (!input[i] || typeof input[i] !== 'string' || input[i].trim().length === 0) {
				throw new NodeOperationError(
					this.node,
					`Invalid or empty input at index ${i}. All inputs must be non-empty strings.`
				);
			}
		}

		const cleanInput = input.map(text => text.trim());

		if (cleanInput.length === 0) {
			throw new NodeOperationError(this.node, 'No input texts provided for embedding');
		}

		// Check batch size (Upstage limit: 100 strings)
		if (cleanInput.length > 100) {
			throw new NodeOperationError(
				this.node,
				`Too many texts: ${cleanInput.length}. Upstage API supports max 100 strings per request`
			);
		}

		// Use single string for single input, array for multiple
		const requestBody = {
			model: this.model,
			input: cleanInput.length === 1 ? cleanInput[0] : cleanInput,
		};

		const requestOptions: IHttpRequestOptions = {
			method: 'POST',
			url: `${this.baseURL}/embeddings`,
			body: requestBody,
			json: true,
		};

		const data = await this.httpRequest(requestOptions);

		if (!data.data || !Array.isArray(data.data)) {
			throw new NodeOperationError(this.node, 'Invalid response format from Upstage API');
		}

		// Sort by index to ensure correct order
		const sortedData = data.data.sort((a, b) => a.index - b.index);

		// Ensure we return the same number of embeddings as input texts
		if (sortedData.length !== cleanInput.length) {
			throw new NodeOperationError(
				this.node,
				`Expected ${cleanInput.length} embeddings, got ${sortedData.length}`
			);
		}

		return sortedData.map(item => item.embedding);
	}
}
