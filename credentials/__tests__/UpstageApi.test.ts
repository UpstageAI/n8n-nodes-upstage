import { UpstageApi } from '../UpstageApi.credentials';
import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
} from 'n8n-workflow';

describe('UpstageApi', () => {
	let credentials: UpstageApi;

	beforeEach(() => {
		credentials = new UpstageApi();
	});

	it('should implement ICredentialType interface', () => {
		expect(credentials).toBeInstanceOf(UpstageApi);
		expect(credentials).toHaveProperty('name');
		expect(credentials).toHaveProperty('displayName');
		expect(credentials).toHaveProperty('properties');
		expect(credentials).toHaveProperty('authenticate');
		expect(credentials).toHaveProperty('test');
	});

	it('should have correct name', () => {
		expect(credentials.name).toBe('upstageApi');
	});

	it('should have correct displayName', () => {
		expect(credentials.displayName).toBe('Upstage API');
	});

	it('should have correct documentationUrl', () => {
		expect(credentials.documentationUrl).toBe(
			'https://console.upstage.ai/docs/getting-started/quick-start'
		);
	});

	describe('properties', () => {
		it('should have API Key property', () => {
			expect(credentials.properties).toHaveLength(1);
			expect(credentials.properties[0]).toEqual({
				displayName: 'API Key',
				name: 'apiKey',
				type: 'string',
				typeOptions: { password: true },
				required: true,
				default: '',
				description: 'The API Key from Upstage Console',
			});
		});

		it('should have API Key as password type', () => {
			expect(credentials.properties[0].typeOptions).toEqual({
				password: true,
			});
		});

		it('should have API Key as required', () => {
			expect(credentials.properties[0].required).toBe(true);
		});
	});

	describe('authenticate', () => {
		it('should have correct authenticate configuration', () => {
			const authenticate = credentials.authenticate as IAuthenticateGeneric;
			expect(authenticate.type).toBe('generic');
			expect(authenticate.properties).toBeDefined();
			expect(authenticate.properties.headers).toBeDefined();
		});

		it('should have correct Authorization header format', () => {
			const authenticate = credentials.authenticate as IAuthenticateGeneric;
			expect(authenticate.properties.headers).toBeDefined();
			if (authenticate.properties.headers) {
				expect(authenticate.properties.headers.Authorization).toBe(
					'=Bearer {{$credentials.apiKey}}'
				);
			}
		});
	});

	describe('test', () => {
		it('should have correct test configuration', () => {
			const test = credentials.test as ICredentialTestRequest;
			expect(test.request).toBeDefined();
			expect(test.request.baseURL).toBe('https://api.upstage.ai');
			expect(test.request.url).toBe('/v1/models');
			expect(test.request.method).toBe('GET');
		});
	});
});
