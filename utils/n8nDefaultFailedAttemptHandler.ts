interface RetryableError extends Error {
	code?: string;
	status?: number;
}

/**
 * Default failed attempt handler for n8n LLM requests
 * Provides basic retry logic and error handling
 */
export const n8nDefaultFailedAttemptHandler = (error: RetryableError) => {
	// Basic retry logic - if the error indicates we should retry, don't throw
	if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') {
		// Network errors that might be temporary
		return;
	}

	const status = error?.status;
	if (status !== undefined && status >= 500 && status < 600) {
		// Server errors that might be temporary
		return;
	}

	if (status === 429) {
		// Rate limiting - should retry
		return;
	}

	// For all other errors, throw to stop retrying
	throw error;
};
