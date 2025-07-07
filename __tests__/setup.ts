/**
 * Global test setup file
 * This file is run before all tests
 */

// Import test utilities and setup
import './utils/test-utils'

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