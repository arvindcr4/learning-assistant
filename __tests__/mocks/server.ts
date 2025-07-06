import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Setup MSW server with handlers
export const server = setupServer(...handlers)

// Setup for tests
export const setupMockServer = () => {
  // Start server before all tests
  beforeAll(() => {
    server.listen({
      onUnhandledRequest: 'warn',
    })
  })

  // Reset handlers after each test
  afterEach(() => {
    server.resetHandlers()
  })

  // Close server after all tests
  afterAll(() => {
    server.close()
  })
}

// Helper to use error handlers for specific tests
export const useErrorHandlers = () => {
  const { errorHandlers } = require('./handlers')
  server.use(...errorHandlers)
}

// Helper to use slow handlers for performance tests
export const useSlowHandlers = () => {
  const { slowHandlers } = require('./handlers')
  server.use(...slowHandlers)
}

// Helper to simulate network errors
export const simulateNetworkError = (endpoint: string) => {
  const { http, HttpResponse } = require('msw')
  server.use(
    http.all(endpoint, () => {
      return HttpResponse.error()
    })
  )
}

// Helper to simulate specific HTTP status codes
export const simulateStatusCode = (endpoint: string, status: number, message?: string) => {
  const { http, HttpResponse } = require('msw')
  const { createMockAPIResponse } = require('./test-data')
  
  server.use(
    http.all(endpoint, () => {
      return HttpResponse.json(
        createMockAPIResponse(null, false, undefined, message || `HTTP ${status} Error`),
        { status }
      )
    })
  )
}