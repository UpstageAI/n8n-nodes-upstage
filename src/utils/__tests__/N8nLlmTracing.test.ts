import { N8nLlmTracing } from '../N8nLlmTracing';
import type { ISupplyDataFunctions } from 'n8n-workflow';

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

			// Mock LLM object
			const llm = {
				type: 'constructor',
				kwargs: {
					model: 'solar-mini',
					temperature: 0.7,
				},
			};

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
				type: 'constructor',
				kwargs: {
					model: 'solar-mini',
				},
			};

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
				type: 'constructor',
				kwargs: {},
			};

			await tracing.handleLLMStart(llm, prompts, runId);

			const output = {
				generations: [
					[
						{
							text: 'Test response',
							generationInfo: { finish_reason: 'stop' },
						},
					],
				],
				llmOutput: {
					tokenUsage: {
						promptTokens: 10,
						completionTokens: 5,
						totalTokens: 15,
					},
				},
			};

			await tracing.handleLLMEnd(output, runId);

			expect(mockAddOutputData).toHaveBeenCalled();
			const outputCall = mockAddOutputData.mock.calls[0];
			expect(outputCall[0]).toBe('ai_languageModel');
			expect(outputCall[1]).toBe(0);
			expect(Array.isArray(outputCall[2])).toBe(true);
		});

		it('should use token usage estimate when actual usage is not available', async () => {
			const prompts = ['test prompt'];
			const runId = 'test-run-id';
			const llm = {
				type: 'constructor',
				kwargs: {},
			};

			await tracing.handleLLMStart(llm, prompts, runId);

			const output = {
				generations: [
					[
						{
							text: 'Test response',
							generationInfo: {},
						},
					],
				],
				llmOutput: {
					tokenUsage: {
						promptTokens: 0,
						completionTokens: 0,
						totalTokens: 0,
					},
				},
			};

			await tracing.handleLLMEnd(output, runId);

			expect(mockAddOutputData).toHaveBeenCalled();
		});
	});

	describe('handleLLMError', () => {
		it('should handle NodeError', async () => {
			const runId = 'test-run-id';
			const error = new Error('Test error') as any;
			error.description = 'Test error description';

			await tracing.handleLLMError(error, runId);

			expect(mockAddOutputData).toHaveBeenCalled();
		});

		it('should handle regular Error', async () => {
			const runId = 'test-run-id';
			const error = new Error('Test error');

			await tracing.handleLLMError(error, runId);

			expect(mockAddOutputData).toHaveBeenCalled();
		});

		it('should filter out non-x- headers from error', async () => {
			const runId = 'test-run-id';
			const error = {
				message: 'Test error',
				headers: {
					authorization: 'Bearer token',
					'x-request-id': '123',
					'content-type': 'application/json',
				},
			};

			await tracing.handleLLMError(error, runId);

			// Verify headers were filtered
			expect(error.headers.authorization).toBeUndefined();
			expect(error.headers['content-type']).toBeUndefined();
			expect(error.headers['x-request-id']).toBe('123');
		});
	});

	describe('token estimation', () => {
		it('should estimate tokens from string list', async () => {
			const list = ['Hello world', 'Test message'];
			const tokens = await tracing.estimateTokensFromStringList(list);

			expect(typeof tokens).toBe('number');
			expect(tokens).toBeGreaterThan(0);
		});

		it('should estimate tokens from generations', async () => {
			const generations = [
				[
					{ text: 'Response 1', generationInfo: {} },
					{ text: 'Response 2', generationInfo: {} },
				],
			];
			const tokens = await tracing.estimateTokensFromGeneration(generations);

			expect(typeof tokens).toBe('number');
			expect(tokens).toBeGreaterThan(0);
		});
	});
});
