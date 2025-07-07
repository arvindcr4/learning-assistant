
# OpenCode Agent Instructions

This document provides instructions for AI agents working on this codebase.

## Commands

- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Test**: `npm test`
- **Run a single test file**: `jest <path_to_file>`
- **Unit tests**: `npm run test:unit`
- **Integration tests**: `npm run test:integration`
- **E2E tests**: `npm run test:e2e`

## Code Style

- **Formatting**: This project uses `prettier` for code formatting. Run `npm run lint:fix` to format your code.
- **Imports**: Use absolute paths with `@/` for project-level imports.
- **Types**: This is a TypeScript project. Add types for all new code.
- **Naming Conventions**: Use `PascalCase` for components and `camelCase` for functions and variables.
- **Error Handling**: For API routes, return a JSON object with a `success` or `error` key.

