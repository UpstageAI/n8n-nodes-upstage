import { n8nDefaultFailedAttemptHandler } from '../n8nDefaultFailedAttemptHandler';

interface RetryableError extends Error {
	code?: string;
	status?: number;
}

describe('n8nDefaultFailedAttemptHandler', () => {
	it('should not throw for ECONNRESET network error', () => {
		const error: RetryableError = new Error('Connection reset');
		error.code = 'ECONNRESET';

		expect(() => {
			n8nDefaultFailedAttemptHandler(error);
		}).not.toThrow();
	});

	it('should not throw for ETIMEDOUT network error', () => {
		const error: RetryableError = new Error('Connection timeout');
		error.code = 'ETIMEDOUT';

		expect(() => {
			n8nDefaultFailedAttemptHandler(error);
		}).not.toThrow();
	});

	it('should not throw for 500 server error', () => {
		const error: RetryableError = new Error('Internal server error');
		error.status = 500;

		expect(() => {
			n8nDefaultFailedAttemptHandler(error);
		}).not.toThrow();
	});

	it('should not throw for 503 server error', () => {
		const error: RetryableError = new Error('Service unavailable');
		error.status = 503;

		expect(() => {
			n8nDefaultFailedAttemptHandler(error);
		}).not.toThrow();
	});

	it('should not throw for 599 server error', () => {
		const error: RetryableError = new Error('Network timeout');
		error.status = 599;

		expect(() => {
			n8nDefaultFailedAttemptHandler(error);
		}).not.toThrow();
	});

	it('should not throw for 429 rate limiting error', () => {
		const error: RetryableError = new Error('Too many requests');
		error.status = 429;

		expect(() => {
			n8nDefaultFailedAttemptHandler(error);
		}).not.toThrow();
	});

	it('should throw for 400 client error', () => {
		const error: RetryableError = new Error('Bad request');
		error.status = 400;

		expect(() => {
			n8nDefaultFailedAttemptHandler(error);
		}).toThrow(error);
	});

	it('should throw for 401 unauthorized error', () => {
		const error: RetryableError = new Error('Unauthorized');
		error.status = 401;

		expect(() => {
			n8nDefaultFailedAttemptHandler(error);
		}).toThrow(error);
	});

	it('should throw for 404 not found error', () => {
		const error: RetryableError = new Error('Not found');
		error.status = 404;

		expect(() => {
			n8nDefaultFailedAttemptHandler(error);
		}).toThrow(error);
	});

	it('should throw for error without status or code', () => {
		const error: RetryableError = new Error('Generic error');

		expect(() => {
			n8nDefaultFailedAttemptHandler(error);
		}).toThrow(error);
	});

	it('should throw for error with status 499 (below 500)', () => {
		const error: RetryableError = new Error('Client error');
		error.status = 499;

		expect(() => {
			n8nDefaultFailedAttemptHandler(error);
		}).toThrow(error);
	});

	it('should throw for error with status 600 (above 599)', () => {
		const error: RetryableError = new Error('Unknown error');
		error.status = 600;

		expect(() => {
			n8nDefaultFailedAttemptHandler(error);
		}).toThrow(error);
	});
});
