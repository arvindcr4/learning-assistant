// Simple ESLint config for production compatibility
import js from '@eslint/js';

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'dist/**',
      '**/*.d.ts',
      'build/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        global: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-undef': 'off', // TypeScript handles this
      'no-redeclare': 'off', // TypeScript handles this
    },
  },
];