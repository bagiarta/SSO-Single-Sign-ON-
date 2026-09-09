import type { Config } from 'jest';

const config: Config = {
  // Use ts-jest to handle TypeScript files
  preset: 'ts-jest',

  // Test environment
  testEnvironment: 'node',

  // Root directory for tests
  rootDir: '.',

  // Where to find test files
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.ts',
    '<rootDir>/src/**/*.spec.ts',
  ],

  // Module name mapper for TypeScript path aliases (@/*)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/config/(.*)$': '<rootDir>/src/config/$1',
    '^@/controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@/middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@/models/(.*)$': '<rootDir>/src/models/$1',
    '^@/routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/database/(.*)$': '<rootDir>/src/database/$1',
    '^@/auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@/cache/(.*)$': '<rootDir>/src/cache/$1',
  },

  // ts-jest global configuration
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          // Relax some strict checks for tests only
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
      },
    ],
  },

  // Global setup file run once before all test suites
  globalSetup: '<rootDir>/src/__tests__/setup.ts',

  // Coverage configuration
  collectCoverage: false, // Enable via --coverage flag
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/__tests__/**',
    '!src/server.ts',         // Entry point, not unit-testable
    '!src/test-server.ts',    // Dev utility script
    '!src/test-infrastructure.ts', // Dev utility script
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Timeout for each test (10 seconds for integration tests)
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Detect open handles (helps find unclosed DB/Redis connections)
  detectOpenHandles: true,

  // Force exit after all tests complete
  forceExit: true,

  // Reporter configuration
  reporters: ['default'],
};

export default config;
