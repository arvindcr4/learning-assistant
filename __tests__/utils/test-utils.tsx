import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// MSW disabled due to module resolution issues
// import { setupMockServer } from '../mocks/server'
// setupMockServer()

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <div data-testid="test-wrapper">
      {children}
    </div>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: AllTheProviders, ...options })
}

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Custom user event setup
export const user = userEvent.setup()

// Common test utilities
export const waitForLoadingToFinish = async () => {
  const { findByRole } = await import('@testing-library/react')
  // Wait for any loading spinners to disappear
  try {
    await findByRole(document.body, 'progressbar', {}, { timeout: 100 })
    // If found, wait for it to disappear
    await new Promise(resolve => setTimeout(resolve, 100))
  } catch {
    // No loading spinner found, continue
  }
}

export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn()
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  })
  window.IntersectionObserver = mockIntersectionObserver
}

export const mockResizeObserver = () => {
  const mockResizeObserver = jest.fn()
  mockResizeObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  })
  window.ResizeObserver = mockResizeObserver
}

export const mockMatchMedia = (matches = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Performance testing utilities
export const measurePerformance = async (fn: () => Promise<void> | void) => {
  const start = performance.now()
  await fn()
  const end = performance.now()
  return end - start
}

export const expectPerformance = (executionTime: number, maxTime: number) => {
  expect(executionTime).toBeLessThan(maxTime)
}

// Accessibility testing utilities
export const setupAccessibilityTest = () => {
  // Add any global accessibility testing setup
  mockIntersectionObserver()
  mockResizeObserver()
  mockMatchMedia()
}

// Mock local storage
export const mockLocalStorage = () => {
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }
  
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  })
  
  return localStorageMock
}

// Mock session storage
export const mockSessionStorage = () => {
  const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }
  
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
  })
  
  return sessionStorageMock
}

// Mock fetch
export const mockFetch = (responses: Array<{ url: string; response: any }>) => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const mockResponse = responses.find(r => url.includes(r.url))
    
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse?.response || {}),
      text: () => Promise.resolve(JSON.stringify(mockResponse?.response || {})),
    })
  })
}

// Test data generators
export const generateTestUser = (id = 'test-user') => ({
  id,
  name: 'Test User',
  email: 'test@example.com',
  preferences: {
    learningGoals: ['JavaScript', 'React'],
    preferredTopics: ['Programming'],
    difficultyLevel: 'intermediate' as const,
    studySchedule: {
      dailyGoal: 60,
      preferredTimes: ['09:00'],
      daysPerWeek: 5,
    },
    notifications: {
      email: true,
      push: true,
      reminders: true,
    },
  },
  learningProfile: {} as any,
  createdAt: new Date(),
  updatedAt: new Date(),
})

export const generateTestQuiz = (id = 'test-quiz') => ({
  id,
  moduleId: 'test-module',
  title: 'Test Quiz',
  description: 'A test quiz for testing',
  questions: [
    {
      id: 'q1',
      text: 'Test question?',
      type: 'multiple-choice' as const,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      explanation: 'Test explanation',
      points: 10,
    },
  ],
  timeLimit: 30,
  passingScore: 70,
})

// Animation and timer utilities
export const skipAnimations = () => {
  // Disable CSS animations and transitions for testing
  const style = document.createElement('style')
  style.innerHTML = `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
  `
  document.head.appendChild(style)
  
  return () => {
    document.head.removeChild(style)
  }
}

export const advanceTimersByTime = (ms: number) => {
  jest.advanceTimersByTime(ms)
}

// Error boundary for testing
export class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Test Error Boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <div data-testid="error-boundary">Something went wrong.</div>
    }

    return this.props.children
  }
}

// Custom matchers
export const customMatchers = {
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },
}

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R
    }
  }
}

// Setup custom matchers
expect.extend(customMatchers)

// Additional test utilities for component testing
export const waitFor = async (callback: () => boolean, timeout = 5000) => {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    if (callback()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`)
}

export const findByTextContent = (container: HTMLElement, text: string) => {
  return Array.from(container.querySelectorAll('*')).find(element => 
    element.textContent?.includes(text)
  )
}

export const queryByTextContent = (container: HTMLElement, text: string) => {
  return Array.from(container.querySelectorAll('*')).find(element => 
    element.textContent?.includes(text)
  ) || null
}

export const getAllByTextContent = (container: HTMLElement, text: string) => {
  return Array.from(container.querySelectorAll('*')).filter(element => 
    element.textContent?.includes(text)
  )
}

// Test ID utilities
export const getTestId = (testId: string) => `[data-testid="${testId}"]`
export const getByTestId = (container: HTMLElement, testId: string) => {
  return container.querySelector(getTestId(testId))
}

// Component testing utilities
export const renderWithProviders = (ui: ReactElement, options?: RenderOptions) => {
  return customRender(ui, options)
}

export const createMockProps = <T,>(defaults: T, overrides: Partial<T> = {}): T => {
  return { ...defaults, ...overrides }
}

// Mock component utility for testing
export const MockComponent = ({ 
  children, 
  testId = 'mock-component',
  ...props 
}: { 
  children?: React.ReactNode 
  testId?: string 
  [key: string]: any 
}) => (
  <div data-testid={testId} {...props}>
    {children}
  </div>
)