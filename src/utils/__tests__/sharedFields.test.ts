import { getConnectionHintNoticeField } from '../sharedFields';
import { NodeConnectionType } from 'n8n-workflow';

describe('sharedFields', () => {
	describe('getConnectionHintNoticeField', () => {
		it('should return correct notice field for single connection type', () => {
			const result = getConnectionHintNoticeField(['ai_agent']);

			expect(result).toEqual({
				displayName: '',
				name: 'notice',
				type: 'notice',
				default: '',
				description: 'Connect this node to: AI Agent',
			});
		});

		it('should return correct notice field for multiple connection types', () => {
			const result = getConnectionHintNoticeField([
				'ai_agent',
				'ai_chain',
				'ai_languageModel',
			]);

			expect(result).toEqual({
				displayName: '',
				name: 'notice',
				type: 'notice',
				default: '',
				description:
					'Connect this node to: AI Agent, AI Chain, AI Language Model',
			});
		});

		it('should handle all known connection types correctly', () => {
			const allTypes: NodeConnectionType[] = [
				'ai_agent',
				'ai_chain',
				'ai_document',
				'ai_embedding',
				'ai_languageModel',
				'ai_memory',
				'ai_outputParser',
				'ai_retriever',
				'ai_textSplitter',
				'ai_tool',
				'ai_vectorStore',
			];

			const result = getConnectionHintNoticeField(allTypes);

			expect(result.description).toContain('AI Agent');
			expect(result.description).toContain('AI Chain');
			expect(result.description).toContain('AI Document');
			expect(result.description).toContain('AI Embedding');
			expect(result.description).toContain('AI Language Model');
			expect(result.description).toContain('AI Memory');
			expect(result.description).toContain('AI Output Parser');
			expect(result.description).toContain('AI Retriever');
			expect(result.description).toContain('AI Text Splitter');
			expect(result.description).toContain('AI Tool');
			expect(result.description).toContain('AI Vector Store');
		});

		it('should handle unknown connection types by returning the type as-is', () => {
			const result = getConnectionHintNoticeField([
				'unknown_type' as NodeConnectionType,
			]);

			expect(result.description).toBe('Connect this node to: unknown_type');
		});

		it('should handle empty array', () => {
			const result = getConnectionHintNoticeField([]);

			expect(result).toEqual({
				displayName: '',
				name: 'notice',
				type: 'notice',
				default: '',
				description: 'Connect this node to: ',
			});
		});

		it('should handle mixed known and unknown types', () => {
			const result = getConnectionHintNoticeField([
				'ai_agent',
				'unknown_type' as NodeConnectionType,
				'ai_chain',
			]);

			expect(result.description).toBe(
				'Connect this node to: AI Agent, unknown_type, AI Chain'
			);
		});
	});
});
