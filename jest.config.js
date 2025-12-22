module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>'],
	testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
	collectCoverageFrom: [
		'credentials/**/*.ts',
		'nodes/**/*.ts',
		'utils/**/*.ts',
		'!**/*.d.ts',
		'!**/__tests__/**',
		'!index.ts',
	],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/$1',
	},
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	moduleFileExtensions: ['ts', 'js', 'json'],
	verbose: true,
	globals: {
		'ts-jest': {
			tsconfig: {
				esModuleInterop: true,
			},
		},
	},
};
