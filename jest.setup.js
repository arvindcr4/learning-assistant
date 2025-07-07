// Import Jest DOM matchers
import '@testing-library/jest-dom'
import 'jest-axe/extend-expect'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    isFallback: false,
    isReady: true,
    pathname: '/',
    route: '/',
    query: {},
    asPath: '/',
  }),
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: jest.fn(),
  notFound: jest.fn(),
}))

// Mock Next.js headers
jest.mock('next/headers', () => ({
  cookies: () => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(),
    getAll: jest.fn(),
  }),
  headers: () => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(),
    forEach: jest.fn(),
  }),
}))

// Mock Next.js dynamic imports
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (fn) => {
    const DynamicComponent = (props) => {
      return fn().then((mod) => mod.default(props))
    }
    DynamicComponent.displayName = 'DynamicComponent'
    return DynamicComponent
  },
}))

// Mock crypto.randomUUID for tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    getRandomValues: jest.fn(() => new Uint32Array(1)),
    subtle: {
      digest: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
      encrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
      decrypt: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
    },
  },
})

// Mock fetch for tests
Object.defineProperty(global, 'fetch', {
  value: jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })
  ),
  writable: true,
})

// Mock Request and Response for tests
Object.defineProperty(global, 'Request', {
  value: jest.fn().mockImplementation((url, options) => ({
    url,
    method: options?.method || 'GET',
    headers: new Headers(options?.headers),
    body: options?.body,
  })),
  writable: true,
})

Object.defineProperty(global, 'Response', {
  value: jest.fn().mockImplementation((body, options) => ({
    ok: options?.status < 400,
    status: options?.status || 200,
    statusText: options?.statusText || 'OK',
    headers: new Headers(options?.headers),
    body,
    json: () => Promise.resolve(JSON.parse(body || '{}')),
    text: () => Promise.resolve(body || ''),
  })),
  writable: true,
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.sessionStorage = sessionStorageMock

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.DATABASE_URL = 'postgresql://localhost:5432/learning_assistant_test'
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-only'
process.env.CSRF_SECRET = 'test-csrf-secret-key-for-testing-only'
process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing-only-must-be-32-chars'

// Mock external APIs
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  })),
}))

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}))

// Mock pg (PostgreSQL client)
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  })),
  Client: jest.fn(() => ({
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  })),
}))

// Increase test timeout for performance tests
jest.setTimeout(30000)

// Suppress console warnings in tests
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

console.warn = jest.fn((message) => {
  if (typeof message === 'string' && 
      !message.includes('React.createElement: type is invalid') &&
      !message.includes('Warning: validateDOMNesting')) {
    originalConsoleWarn(message)
  }
})

console.error = jest.fn((message) => {
  if (typeof message === 'string' && 
      !message.includes('Error: Not implemented') &&
      !message.includes('Warning: ReactDOM.render is deprecated')) {
    originalConsoleError(message)
  }
})