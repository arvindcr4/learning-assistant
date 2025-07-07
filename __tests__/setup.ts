/**
 * Global test setup file
 * This file is run before all tests
 */

// Import test utilities and setup
import './utils/test-utils'

// Define global test state
declare global {
  var testState: any
  var testCleanup: (() => void) | undefined
}

// Initialize global test state
global.testState = {}
global.testCleanup = undefined

// Global test configuration
beforeAll(() => {
  // Mock HTMLCanvasElement.getContext to fix axe-core color contrast testing
  const mockGetContext = jest.fn((type) => {
    if (type === '2d') {
      return {
        fillRect: jest.fn(),
        clearRect: jest.fn(),
        getImageData: jest.fn(() => ({
          data: new Uint8ClampedArray(4).fill(255) // White color
        })),
        putImageData: jest.fn(),
        createImageData: jest.fn(() => ({
          data: new Uint8ClampedArray(4).fill(255)
        })),
        setTransform: jest.fn(),
        drawImage: jest.fn(),
        save: jest.fn(),
        fillText: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        closePath: jest.fn(),
        stroke: jest.fn(),
        translate: jest.fn(),
        scale: jest.fn(),
        rotate: jest.fn(),
        arc: jest.fn(),
        fill: jest.fn(),
        measureText: jest.fn(() => ({ width: 100 })),
        transform: jest.fn(),
        rect: jest.fn(),
        clip: jest.fn(),
        font: '10px sans-serif',
        textAlign: 'start',
        textBaseline: 'alphabetic',
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        miterLimit: 10,
        canvas: {
          width: 300,
          height: 150,
          toDataURL: jest.fn(() => 'data:image/png;base64,'),
          toBlob: jest.fn()
        }
      }
    }
    return null
  })

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: mockGetContext,
    writable: true,
    configurable: true
  })

  // Also mock the canvas width and height properties
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
    value: 300,
    writable: true,
    configurable: true
  })

  Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
    value: 150,
    writable: true,
    configurable: true
  })

  // Mock TextEncoder/TextDecoder for JSDOM
  if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = require('util').TextEncoder
  }
  if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = require('util').TextDecoder
  }
  
  // Mock URL.createObjectURL for file uploads
  if (typeof global.URL.createObjectURL === 'undefined') {
    global.URL.createObjectURL = jest.fn(() => 'mocked-object-url')
  }
  if (typeof global.URL.revokeObjectURL === 'undefined') {
    global.URL.revokeObjectURL = jest.fn()
  }
  
  // Mock window.scrollTo
  if (typeof window.scrollTo === 'undefined') {
    window.scrollTo = jest.fn()
  }
  
  // Mock window.alert, confirm, prompt
  if (typeof window.alert === 'undefined') {
    window.alert = jest.fn()
  }
  if (typeof window.confirm === 'undefined') {
    window.confirm = jest.fn(() => true)
  }
  if (typeof window.prompt === 'undefined') {
    window.prompt = jest.fn(() => 'test-input')
  }
  
  // Mock performance.mark and performance.measure
  if (typeof performance.mark === 'undefined') {
    performance.mark = jest.fn()
  }
  if (typeof performance.measure === 'undefined') {
    performance.measure = jest.fn()
  }
  if (typeof performance.clearMarks === 'undefined') {
    performance.clearMarks = jest.fn()
  }
  if (typeof performance.clearMeasures === 'undefined') {
    performance.clearMeasures = jest.fn()
  }
  
  // Mock console methods but allow important errors to show
  const originalError = console.error
  const originalWarn = console.warn
  
  console.error = jest.fn((...args: any[]) => {
    const message = args[0]
    if (
      typeof message === 'string' && 
      (
        message.includes('Warning: ReactDOM.render is deprecated') ||
        message.includes('Warning: validateDOMNesting') ||
        message.includes('Error: Not implemented') ||
        message.includes('Warning: Each child in a list should have a unique "key" prop')
      )
    ) {
      // Suppress these warnings during tests
      return
    }
    originalError.apply(console, args)
  })
  
  console.warn = jest.fn((...args: any[]) => {
    const message = args[0]
    if (
      typeof message === 'string' && 
      (
        message.includes('componentWillReceiveProps') ||
        message.includes('componentWillMount') ||
        message.includes('componentWillUpdate') ||
        message.includes('Warning: Function components cannot be given refs')
      )
    ) {
      // Suppress these warnings during tests
      return
    }
    originalWarn.apply(console, args)
  })
})

afterAll(() => {
  // Cleanup after all tests
  jest.restoreAllMocks()
  
  // Clean up any persistent state
  if (global.testCleanup) {
    global.testCleanup()
  }
  
  // Reset console methods
  if (console.error.mockRestore) {
    console.error.mockRestore()
  }
  if (console.warn.mockRestore) {
    console.warn.mockRestore()
  }
})

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks()
  
  // Clear localStorage and sessionStorage
  if (typeof Storage !== 'undefined') {
    localStorage.clear()
    sessionStorage.clear()
  }
  
  // Clear any pending timers
  jest.clearAllTimers()
  
  // Reset DOM state
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  
  // Reset any global state
  if (global.testState) {
    global.testState = {}
  }
})

afterEach(() => {
  // Cleanup after each test
  jest.clearAllTimers()
  jest.useRealTimers()
  
  // Clean up any React roots
  const rootElements = document.querySelectorAll('[data-testid="test-wrapper"]')
  rootElements.forEach(element => {
    if (element.parentNode) {
      element.parentNode.removeChild(element)
    }
  })
  
  // Reset fetch mock
  if (global.fetch && global.fetch.mockReset) {
    global.fetch.mockReset()
  }
})