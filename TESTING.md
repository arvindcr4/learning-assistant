# Testing Suite Documentation

This document provides comprehensive information about the testing suite for the Personal Learning Assistant application.

## Overview

The testing suite includes:
- **Unit Tests**: Testing individual components and functions
- **Integration Tests**: Testing API endpoints and service interactions
- **End-to-End Tests**: Testing complete user workflows
- **Performance Tests**: Testing algorithm efficiency and scalability
- **Accessibility Tests**: Testing compliance with WCAG guidelines
- **Component Tests**: Testing React components with user interactions

## Test Structure

```
__tests__/
├── unit/                     # Unit tests
│   ├── components/          # Component unit tests
│   ├── learning-engine.test.ts
│   └── learning-service.test.ts
├── integration/             # Integration tests
│   └── api-routes.test.ts
├── e2e/                     # End-to-end tests
│   ├── global-setup.ts
│   ├── global-teardown.ts
│   └── learning-flow.spec.ts
├── performance/             # Performance tests
│   └── learning-algorithms.test.ts
├── accessibility/           # Accessibility tests
│   └── components.test.tsx
├── mocks/                   # Test data and mocks
│   ├── test-data.ts
│   ├── handlers.ts
│   └── server.ts
└── utils/                   # Test utilities
    └── test-utils.tsx
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Types
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests
npm run test:performance  # Performance tests
npm run test:accessibility # Accessibility tests
```

### Coverage
```bash
npm run test:coverage     # Run tests with coverage report
```

### Watch Mode
```bash
npm run test:watch        # Run tests in watch mode
```

### CI Mode
```bash
npm run test:ci          # Run tests in CI mode
```

## Test Framework Stack

### Core Testing Libraries
- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **Playwright**: End-to-end testing framework
- **MSW (Mock Service Worker)**: API mocking
- **jest-axe**: Accessibility testing

### Additional Tools
- **jest-environment-jsdom**: DOM environment for tests
- **@testing-library/user-event**: User interaction simulation
- **jest-performance-testing**: Performance benchmarking

## Writing Tests

### Unit Tests

#### Component Tests
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/Button'

describe('Button Component', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Click me</Button>)
    await user.click(screen.getByRole('button'))
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

#### Algorithm Tests
```typescript
import { LearningStyleDetector } from '@/lib/learning-engine'

describe('LearningStyleDetector', () => {
  let detector: LearningStyleDetector

  beforeEach(() => {
    detector = new LearningStyleDetector()
  })

  it('analyzes behavioral patterns correctly', () => {
    const indicators = [/* test data */]
    const result = detector.analyzeBehavioralPatterns(indicators)
    
    expect(result).toBeDefined()
    expect(result.length).toBe(4)
  })
})
```

### Integration Tests

```typescript
import { createMocks } from 'node-mocks-http'
import profileHandler from '@/app/api/learning/profile/route'

describe('/api/learning/profile', () => {
  it('creates learning profile successfully', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { userId: 'user-123' },
    })

    const response = await profileHandler.POST(req as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
```

### End-to-End Tests

```typescript
import { test, expect } from '@playwright/test'

test.describe('Learning Flow', () => {
  test('completes learning session workflow', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Start Learning')
    
    await expect(page.locator('h2')).toContainText('Learning Content')
  })
})
```

### Performance Tests

```typescript
describe('Performance Tests', () => {
  it('processes large datasets efficiently', () => {
    const largeDataset = createLargeDataset(1000)
    
    const startTime = performance.now()
    detector.analyzeBehavioralPatterns(largeDataset.indicators)
    const endTime = performance.now()
    
    expect(endTime - startTime).toBeLessThan(100)
  })
})
```

### Accessibility Tests

```typescript
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<Button>Accessible Button</Button>)
    const results = await axe(container)
    
    expect(results).toHaveNoViolations()
  })
})
```

## Test Data and Mocks

### Using Mock Data
```typescript
import { mockUser, mockLearningProfile } from '../mocks/test-data'

// Use predefined mock data
const user = mockUser
const profile = mockLearningProfile

// Create custom mock data
const customUser = createMockUser({ name: 'Custom User' })
```

### API Mocking with MSW
```typescript
import { server } from '../mocks/server'

// Use default handlers
// (automatically set up in test environment)

// Override for specific tests
server.use(
  http.post('/api/learning/profile', () => {
    return HttpResponse.json({ error: 'Server error' }, { status: 500 })
  })
)
```

## Coverage Requirements

The project maintains high test coverage with the following targets:

- **Lines**: 80% minimum
- **Functions**: 80% minimum
- **Branches**: 80% minimum
- **Statements**: 80% minimum

### Viewing Coverage Reports
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Performance Benchmarks

### Algorithm Performance Targets
- **Behavioral Analysis**: < 100ms for 1000 indicators
- **VARK Processing**: < 10ms for standard questionnaire
- **Content Adaptation**: < 20ms for 50 variants
- **Recommendation Generation**: < 100ms for complex analytics

### Memory Usage Targets
- **No Memory Leaks**: Memory increase < 50MB for large datasets
- **Object Creation**: < 10KB per learning profile
- **Concurrent Processing**: Handles 10+ concurrent operations

## Accessibility Standards

### WCAG Compliance
- **Level AA Compliance**: All components meet WCAG 2.1 AA standards
- **Color Contrast**: Minimum 4.5:1 ratio for normal text
- **Keyboard Navigation**: All interactive elements accessible via keyboard
- **Screen Reader Support**: Proper ARIA labels and semantic markup

### Testing Tools
- **jest-axe**: Automated accessibility testing
- **Manual Testing**: Keyboard navigation verification
- **Screen Reader Testing**: VoiceOver/NVDA compatibility

## Continuous Integration

### GitHub Actions Workflow
The CI pipeline runs:
1. **Unit Tests** (Node.js 18.x, 20.x)
2. **Integration Tests**
3. **E2E Tests** (with Playwright)
4. **Performance Tests**
5. **Accessibility Tests**
6. **Coverage Report**

### Quality Gates
- All tests must pass
- Coverage must meet minimum thresholds
- No accessibility violations
- Performance benchmarks must be met

## Debugging Tests

### Common Issues

#### Test Timeouts
```typescript
// Increase timeout for slow operations
jest.setTimeout(30000)

// Or for specific tests
test('slow operation', async () => {
  // test code
}, 30000)
```

#### Async Testing
```typescript
// Proper async/await usage
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})

// Wait for specific conditions
await waitForElementToBeRemoved(screen.getByText('Loading...'))
```

#### Mock Issues
```typescript
// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks()
})

// Restore original implementations
afterAll(() => {
  jest.restoreAllMocks()
})
```

### Debugging Tools
- **screen.debug()**: Print DOM for debugging
- **logRoles()**: Print available ARIA roles
- **Jest debugging**: Use `--verbose` and `--no-coverage` flags

## Best Practices

### Test Organization
- **Group related tests**: Use `describe` blocks effectively
- **Clear test names**: Describe behavior, not implementation
- **Single assertion per test**: Focus on one thing at a time
- **Setup and teardown**: Use `beforeEach`/`afterEach` for cleanup

### Component Testing
- **Test user interactions**: Focus on what users do
- **Avoid implementation details**: Test behavior, not structure
- **Use semantic queries**: Prefer `getByRole` over `getByTestId`
- **Mock external dependencies**: Keep tests isolated

### Performance Testing
- **Measure what matters**: Focus on user-facing performance
- **Use realistic data**: Test with production-like datasets
- **Set appropriate thresholds**: Balance speed vs. accuracy
- **Monitor trends**: Track performance over time

### Accessibility Testing
- **Automated + Manual**: Combine both approaches
- **Real device testing**: Test on actual assistive technology
- **Multiple scenarios**: Test different user abilities
- **Continuous validation**: Include in CI/CD pipeline

## Troubleshooting

### Common Test Failures

#### "Cannot read property of undefined"
- Check mock data completeness
- Verify API response structure
- Ensure components handle loading states

#### "Element not found"
- Use `findBy` queries for async elements
- Check element rendering conditions
- Verify test data setup

#### "Performance threshold exceeded"
- Profile algorithm bottlenecks
- Check for memory leaks
- Optimize data structures

#### "Accessibility violation"
- Review ARIA labels and roles
- Check color contrast ratios
- Ensure keyboard accessibility

### Getting Help
- Check test logs and error messages
- Review similar test patterns in codebase
- Consult testing library documentation
- Ask team members for assistance

## Maintenance

### Regular Tasks
- **Update dependencies**: Keep testing libraries current
- **Review coverage**: Ensure new code is tested
- **Performance monitoring**: Track algorithm efficiency
- **Accessibility audits**: Regular compliance checks

### Test Cleanup
- **Remove obsolete tests**: Clean up outdated test files
- **Update mock data**: Keep test data relevant
- **Refactor common patterns**: Extract reusable utilities
- **Documentation updates**: Keep this document current