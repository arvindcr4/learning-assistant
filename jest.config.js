/** @type {import('jest').Config} */
const config = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/__tests__/setup.ts'],
  
  // Preset for TypeScript support
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
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        target: 'ES2017',
        module: 'CommonJS',
      },
    }],
  },
  
  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Coverage collection
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Test patterns
  testMatch: [
    '**/__tests__/**/*.(test|spec).(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    '/node_modules/(?!(.*\\.mjs$|@supabase|@testing-library|msw|uuid))',
  ],
  
  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>/'],
  
  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
  
  // Verbose output
  verbose: true,
  
  // Max worker processes
  maxWorkers: '50%',
  
  // Test timeout
  testTimeout: 15000,
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },
  
  // Global setup and teardown
  globalSetup: '<rootDir>/__tests__/global-setup.js',
  globalTeardown: '<rootDir>/__tests__/global-teardown.js',
  
  // Collect coverage from specific files
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
  
  // Error handling
  errorOnDeprecated: true,
  
  // Silent mode for CI
  silent: process.env.CI === 'true',
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
}

module.exports = config