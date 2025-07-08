/** @type {import('jest').Config} */
const { cpus } = require('os')
const isCI = process.env.CI === 'true'
const isShard = process.env.JEST_SHARD || process.env.GITHUB_ACTIONS

const config = {
  // Test environment with optimized setup
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/__tests__/setup.ts'],
  
  // Preset for TypeScript support with optimized settings
  preset: 'ts-jest',
  
  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^@/constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@/middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/__mocks__/fileMock.js',
  },
  
  // Optimized transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        target: 'ES2017',
        module: 'CommonJS',
        skipLibCheck: true,
        isolatedModules: true,
      },
    }],
  },
  
  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Performance optimizations
  cache: true,
  cacheDirectory: '.jest-cache',
  
  // Parallel execution settings
  maxWorkers: isCI ? 2 : isShard ? 1 : Math.max(Math.floor(cpus().length / 2), 1),
  
  // Coverage configuration
  coverageProvider: 'v8', // Faster than default babel coverage
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/**/index.ts',
    '!app/**/layout.tsx',
    '!app/**/loading.tsx',
    '!app/**/error.tsx',
    '!app/**/not-found.tsx',
  ],
  
  // Coverage thresholds with branch-specific settings
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Individual file thresholds for critical components
    './src/lib/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/services/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  
  // Test patterns with intelligent selection
  testMatch: [
    '**/__tests__/**/*.(test|spec).(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/test-results/',
    '<rootDir>/coverage/',
  ],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    '/node_modules/(?!(.*\\.mjs$|@supabase|@testing-library|msw|uuid))',
  ],
  
  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>/'],
  
  // Watch plugins for development
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
  
  // Optimized output settings
  verbose: !isCI,
  silent: isCI,
  
  // Test timeout with environment-specific settings
  testTimeout: isCI ? 30000 : 15000,
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },
  
  // Global setup and teardown
  globalSetup: '<rootDir>/__tests__/global-setup.js',
  globalTeardown: '<rootDir>/__tests__/global-teardown.js',
  
  // Error handling
  errorOnDeprecated: true,
  
  // Mock settings
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // Reporter configuration
  reporters: [
    'default',
    // Note: Additional reporters can be added when jest-junit and jest-html-reporter are installed
  ],
  
  // Test result processor for analytics
  testResultsProcessor: '<rootDir>/__tests__/test-results-processor.js',
  
  // Notify settings (disabled to avoid peer dependency issues)
  notify: false,
  
  // Bail settings
  bail: isCI ? 1 : 0,
}

module.exports = config