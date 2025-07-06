/**
 * Global test setup file
 * This file is run before all tests
 */

// Import test utilities and setup
import './utils/test-utils'

// Global test configuration
beforeAll(() => {
  // Console warnings and errors can be noisy during tests
  const originalError = console.error
  const originalWarn = console.warn
  
  console.error = (...args: any[]) => {
    // Allow specific errors that we want to see
    const message = args[0]
    if (
      typeof message === 'string' && 
      (
        message.includes('Warning: ReactDOM.render is deprecated') ||
        message.includes('Warning: validateDOMNesting') ||
        message.includes('Error: Not implemented')
      )
    ) {
      // Suppress these warnings during tests
      return
    }
    originalError.apply(console, args)
  }
  
  console.warn = (...args: any[]) => {
    const message = args[0]
    if (
      typeof message === 'string' && 
      (
        message.includes('componentWillReceiveProps') ||
        message.includes('componentWillMount') ||
        message.includes('componentWillUpdate')
      )
    ) {
      // Suppress these warnings during tests
      return
    }
    originalWarn.apply(console, args)
  }
})

afterAll(() => {
  // Cleanup after all tests
  jest.restoreAllMocks()
})

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks()
  
  // Clear localStorage and sessionStorage
  if (typeof Storage !== 'undefined') {
    localStorage.clear()
    sessionStorage.clear()
  }
})

afterEach(() => {
  // Cleanup after each test
  jest.clearAllTimers()
  jest.useRealTimers()
})