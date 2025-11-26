import { N8nLlmTracing } from '../N8nLlmTracing';
import type { ISupplyDataFunctions } from 'n8n-workflow';
import type { LLMResult } from '@langchain/core/outputs';

describe('N8nLlmTracing', () => {
	let tracing: N8nLlmTracing;
	let mockSupplyDataFunctions: ISupplyDataFunctions;
	let mockAddInputData: jest.Mock;
	let mockAddOutputData: jest.Mock;
	let mockSendTelemetry: jest.Mock;

	beforeEach(() => {
		mockAddInputData = jest.fn(() => ({ index: 0 }));
		mockAddOutputData = jest.fn();
		mockSendTelemetry = jest.fn();

		mockSupplyDataFunctions = {
			addInputData: mockAddInputData,
			addOutputData: mockAddOutputData,
			sendTelemetry: mockSendTelemetry,
			getNode: jest.fn(() => ({
				name: 'test-node',
				type: 'test',
			})),
			logger: {
				debug: jest.fn(),
				error: jest.fn(),
				warn: jest.fn(),
			},
		} as unknown as ISupplyDataFunctions;

		tracing = new N8nLlmTracing(mockSupplyDataFunctions);
		jest.clearAllMocks();
	});

	describe('handleLLMStart', () => {
		it('should add input data when LLM starts', async () => {
			const prompts = ['test prompt'];
			const runId = 'test-run-id';

			// Mock LLM object with proper Serialized structure
			const llm = {
				lc: 1,
				id: ['test', 'llm'],
				type: 'llm',
				kwargs: {},
			} as any;

			await tracing.handleLLMStart(llm, prompts, runId);

			expect(mockAddInputData).toHaveBeenCalled();
			expect(mockAddInputData).toHaveBeenCalledWith('ai_languageModel', [
				[
					{
						json: expect.objectContaining({
							messages: prompts,
							estimatedTokens: expect.any(Number),
							options: expect.anything(),
						}),
					},
				],
			]);
		});

		it('should store run details in runsMap', async () => {
			const prompts = ['test prompt 1', 'test prompt 2'];
			const runId = 'test-run-id-2';

			const llm = {
				lc: 1,
				id: ['test', 'llm'],
				type: 'llm',
				kwargs: {},
			} as any;

			await tracing.handleLLMStart(llm, prompts, runId);

			expect((tracing as any).runsMap[runId]).toBeDefined();
			expect((tracing as any).runsMap[runId].messages).toEqual(prompts);
		});
	});

	describe('handleLLMEnd', () => {
		it('should add output data when LLM ends', async () => {
			// First set up a run in runsMap
			const prompts = ['test prompt'];
			const runId = 'test-run-id';
			const llm = {
				lc: 1,
				id: ['test', 'llm'],
				type: 'llm',
				kwargs: {},
			} as any;

			await tracing.handleLLMStart(llm, prompts, runId);

			const output: LLMResult = {
				generations: [
					[
						{
							text: 'test output',
							generationInfo: {},
						},
					],
				],
				llmOutput: {
					tokenUsage: {
						completionTokens: 10,
						promptTokens: 20,
						totalTokens: 30,
					},
				},
			};

			await tracing.handleLLMEnd(output, runId);

			expect(mockAddOutputData).toHaveBeenCalled();
			expect(mockAddOutputData).toHaveBeenCalledWith(
				'ai_languageModel',
				0,
				expect.arrayContaining([
					expect.arrayContaining([
						expect.objectContaining({
							json: expect.objectContaining({
								response: expect.objectContaining({
									generations: expect.any(Array),
								}),
								tokenUsage: expect.objectContaining({
									completionTokens: 10,
									promptTokens: 20,
									totalTokens: 30,
								}),
							}),
						}),
					]),
				])
			);
		});

		it('should handle token usage parsing with usage format', async () => {
			const prompts = ['test prompt'];
			const runId = 'test-run-id-usage';
			const llm = {
				lc: 1,
				id: ['test', 'llm'],
				type: 'llm',
				kwargs: {},
			} as any;

			await tracing.handleLLMStart(llm, prompts, runId);

			const output: LLMResult = {
				generations: [[{ text: 'test', generationInfo: {} }]],
				llmOutput: {
					usage: {
						completion_tokens: 5,
						prompt_tokens: 15,
						total_tokens: 20,
					},
				},
			};

			await tracing.handleLLMEnd(output, runId);

			expect(mockAddOutputData).toHaveBeenCalled();
		});

		it('should estimate tokens when usage not available', async () => {
			const prompts = ['test prompt'];
			const runId = 'test-run-id-estimate';
			const llm = {
				lc: 1,
				id: ['test', 'llm'],
				type: 'llm',
				kwargs: {},
			} as any;

			await tracing.handleLLMStart(llm, prompts, runId);

			const output: LLMResult = {
				generations: [[{ text: 'test', generationInfo: {} }]],
				llmOutput: {},
			};

			await tracing.handleLLMEnd(output, runId);

			expect(mockAddOutputData).toHaveBeenCalled();
			const outputCall = (mockAddOutputData as jest.Mock).mock.calls[0];
			expect(outputCall[2][0][0].json).toHaveProperty('tokenUsageEstimate');
		});
	});

	describe('handleLLMError', () => {
		it('should handle LLM errors', async () => {
			// First set up a run in runsMap
			const prompts = ['test prompt'];
			const runId = 'test-run-id-error';
			const llm = {
				lc: 1,
				id: ['test', 'llm'],
				type: 'llm',
				kwargs: {},
			} as any;

			await tracing.handleLLMStart(llm, prompts, runId);

			const error = new Error('LLM error');

			await tracing.handleLLMError(error, runId);

			expect(mockAddOutputData).toHaveBeenCalled();
			// Verify that addOutputData was called with error handling
			const outputCalls = (mockAddOutputData as jest.Mock).mock.calls;
			expect(outputCalls.length).toBeGreaterThan(0);
			// The error is passed directly to addOutputData, so verify it was called
			expect(outputCalls[outputCalls.length - 1][0]).toBe('ai_languageModel');
		});
	});

	describe('token usage parsing', () => {
		it('should parse tokenUsage format', () => {
			const llmOutput = {
				tokenUsage: {
					completionTokens: 10,
					promptTokens: 20,
					totalTokens: 30,
				},
			};

			const parser = (tracing as any).options.tokensUsageParser;
			const result = parser(llmOutput);

			expect(result).toEqual({
				completionTokens: 10,
				promptTokens: 20,
				totalTokens: 30,
			});
		});

		it('should parse usage format', () => {
			// Create a custom tracing instance with Upstage parser
			const customTracing = new N8nLlmTracing(mockSupplyDataFunctions, {
				tokensUsageParser: llmOutput => {
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

						return {
							completionTokens,
							promptTokens,
							totalTokens,
						};
					}
					return {
						completionTokens: 0,
						promptTokens: 0,
						totalTokens: 0,
					};
				},
			});

			const llmOutput = {
				usage: {
					completion_tokens: 5,
					prompt_tokens: 15,
					total_tokens: 20,
				},
			};

			const parser = (customTracing as any).options.tokensUsageParser;
			const result = parser(llmOutput);

			expect(result).toEqual({
				completionTokens: 5,
				promptTokens: 15,
				totalTokens: 20,
			});
		});

		it('should return zeros for invalid output', () => {
			const parser = (tracing as any).options.tokensUsageParser;
			const result = parser(null);

			expect(result).toEqual({
				completionTokens: 0,
				promptTokens: 0,
				totalTokens: 0,
			});
		});
	});
});
