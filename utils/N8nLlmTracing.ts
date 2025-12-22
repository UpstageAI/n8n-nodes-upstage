import type {
	IDataObject,
	ISupplyDataFunctions,
	JsonObject,
} from 'n8n-workflow';
import {
	NodeConnectionType,
	NodeError,
	NodeOperationError,
} from 'n8n-workflow';
import { logAiEvent } from './telemetry';

/**
 * LLM output structure for token usage parsing
 */
interface LLMOutput {
	tokenUsage?: {
		completionTokens?: number;
		promptTokens?: number;
		totalTokens?: number;
		completion_tokens?: number;
		prompt_tokens?: number;
		total_tokens?: number;
	};
	usage?: {
		completionTokens?: number;
		promptTokens?: number;
		totalTokens?: number;
		completion_tokens?: number;
		prompt_tokens?: number;
		total_tokens?: number;
	};
}

/**
 * Generation result structure
 */
interface Generation {
	text: string;
	generationInfo?: Record<string, unknown>;
}

/**
 * LLM result structure
 */
interface LLMResult {
	generations: Generation[][];
	llmOutput?: LLMOutput;
}

export type TokensUsageParser = (llmOutput?: LLMOutput) => {
	completionTokens: number;
	promptTokens: number;
	totalTokens: number;
};

type RunDetail = {
	index: number;
	messages: string[] | string;
	options: IDataObject;
};

/**
 * Simple token estimation (rough approximation: ~4 characters per token)
 * This is a fallback when actual token counts are not available
 */
function estimateTokens(text: string): number {
	// Rough approximation: ~4 characters per token for most languages
	// This is a simple fallback - actual tokenization would require tiktoken or similar
	return Math.ceil(text.length / 4);
}

/**
 * Callback handler interface for language model tracing
 * Compatible with n8n AI Agent nodes
 */
export class N8nLlmTracing {
	name = 'N8nLlmTracing';

	// This flag makes sure that handlers will wait for completion before continuing
	awaitHandlers = true;

	connectionType = 'ai_languageModel' as NodeConnectionType;

	promptTokensEstimate = 0;

	completionTokensEstimate = 0;

	/**
	 * A map to associate LLM run IDs to run details.
	 * Key: Unique identifier for each LLM run (run ID)
	 * Value: RunDetails object
	 */
	runsMap: Record<string, RunDetail> = {};

	options = {
		// Default parser for token usage
		tokensUsageParser: (llmOutput?: LLMOutput) => {
			const usage = llmOutput?.tokenUsage || llmOutput?.usage;
			const completionTokens =
				(usage?.completionTokens as number) ??
				(usage?.completion_tokens as number) ??
				0;
			const promptTokens =
				(usage?.promptTokens as number) ??
				(usage?.prompt_tokens as number) ??
				0;
			const totalTokens =
				(usage?.totalTokens as number) ??
				(usage?.total_tokens as number) ??
				completionTokens + promptTokens;

			return {
				completionTokens,
				promptTokens,
				totalTokens,
			};
		},
		errorDescriptionMapper: (error: NodeError) => error.description,
	};

	constructor(
		private executionFunctions: ISupplyDataFunctions,
		options?: {
			tokensUsageParser?: TokensUsageParser;
			errorDescriptionMapper?: (error: NodeError) => string;
		}
	) {
		this.options = { ...this.options, ...options };
	}

	/**
	 * Estimate tokens from generation results
	 */
	async estimateTokensFromGeneration(
		generations: Generation[][]
	): Promise<number> {
		const messages = generations.flatMap(gen => gen.map(g => g.text));
		return this.estimateTokensFromStringList(messages);
	}

	/**
	 * Estimate tokens from a list of strings
	 * Uses simple character-based estimation as fallback
	 */
	async estimateTokensFromStringList(list: string[]): Promise<number> {
		return list.reduce((acc, text) => acc + estimateTokens(text), 0);
	}

	/**
	 * Handle LLM end event
	 */
	async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
		// The fallback should never happen since handleLLMStart should always set the run details
		// but just in case, we set the index to the length of the runsMap
		const runDetails = this.runsMap[runId] ?? {
			index: Object.keys(this.runsMap).length,
			messages: [],
			options: {},
		};

		// Extract only text and generationInfo from generations
		const processedGenerations = output.generations.map(gen =>
			gen.map(g => ({
				text: g.text,
				generationInfo: g.generationInfo,
			}))
		);

		const tokenUsageEstimate = {
			completionTokens: 0,
			promptTokens: 0,
			totalTokens: 0,
		};
		const tokenUsage = this.options.tokensUsageParser(output.llmOutput);

		if (processedGenerations.length > 0) {
			tokenUsageEstimate.completionTokens =
				await this.estimateTokensFromGeneration(processedGenerations);

			tokenUsageEstimate.promptTokens = this.promptTokensEstimate;
			tokenUsageEstimate.totalTokens =
				tokenUsageEstimate.completionTokens + this.promptTokensEstimate;
		}
		const response: {
			response: { generations: typeof processedGenerations };
			tokenUsageEstimate?: typeof tokenUsageEstimate;
			tokenUsage?: typeof tokenUsage;
		} = {
			response: { generations: processedGenerations },
		};

		// If the LLM response contains actual tokens usage, otherwise fallback to the estimate
		if (tokenUsage.completionTokens > 0) {
			response.tokenUsage = tokenUsage;
		} else {
			response.tokenUsageEstimate = tokenUsageEstimate;
		}

		const parsedMessages =
			typeof runDetails.messages === 'string'
				? runDetails.messages
				: Array.isArray(runDetails.messages)
					? runDetails.messages.map(message => {
							if (typeof message === 'string') return message;
							if (
								typeof message === 'object' &&
								message !== null &&
								'toJSON' in message &&
								typeof (message as { toJSON: () => unknown }).toJSON ===
									'function'
							) {
								return (message as { toJSON: () => unknown }).toJSON();
							}
							return message;
						})
					: [];

		this.executionFunctions.addOutputData(
			this.connectionType,
			runDetails.index,
			[[{ json: { ...response } }]]
		);

		logAiEvent(this.executionFunctions, 'ai-llm-generated-output', {
			messages: parsedMessages,
			options: runDetails.options,
			response,
		});
	}

	/**
	 * Handle LLM start event
	 */
	async handleLLMStart(
		llm: IDataObject | { type?: string; kwargs?: IDataObject },
		prompts: string[],
		runId: string
	): Promise<void> {
		const estimatedTokens = await this.estimateTokensFromStringList(prompts);

		const options =
			typeof llm === 'object' &&
			llm !== null &&
			'type' in llm &&
			llm.type === 'constructor'
				? (llm.kwargs as IDataObject) || {}
				: (llm as IDataObject);

		const { index } = this.executionFunctions.addInputData(
			this.connectionType,
			[
				[
					{
						json: {
							messages: prompts,
							estimatedTokens,
							options,
						},
					},
				],
			]
		);

		// Save the run details for later use when processing `handleLLMEnd` event
		this.runsMap[runId] = {
			index,
			options,
			messages: prompts,
		};
		this.promptTokensEstimate = estimatedTokens;
	}

	/**
	 * Handle LLM error event
	 */
	async handleLLMError(
		error: IDataObject | Error,
		runId: string,
		parentRunId?: string | undefined
	): Promise<void> {
		const runDetails = this.runsMap[runId] ?? {
			index: Object.keys(this.runsMap).length,
			messages: [],
			options: {},
		};

		// Filter out non-x- headers to avoid leaking sensitive information in logs
		if (
			typeof error === 'object' &&
			error !== null &&
			Object.prototype.hasOwnProperty.call(error, 'headers')
		) {
			const errorWithHeaders = error as { headers: Record<string, unknown> };

			Object.keys(errorWithHeaders.headers).forEach(key => {
				if (!key.startsWith('x-')) {
					delete errorWithHeaders.headers[key];
				}
			});
		}

		if (error instanceof NodeError) {
			if (this.options.errorDescriptionMapper) {
				error.description = this.options.errorDescriptionMapper(error);
			}

			this.executionFunctions.addOutputData(
				this.connectionType,
				runDetails.index,
				error
			);
		} else {
			// If the error is not a NodeError, we wrap it in a NodeOperationError
			this.executionFunctions.addOutputData(
				this.connectionType,
				runDetails.index,
				new NodeOperationError(
					this.executionFunctions.getNode(),
					error as JsonObject,
					{
						functionality: 'configuration-node',
					}
				)
			);
		}

		logAiEvent(this.executionFunctions, 'ai-llm-errored', {
			error:
				typeof error === 'object' && Object.keys(error).length === 0
					? String(error)
					: error,
			runId,
			parentRunId,
		});
	}
}
