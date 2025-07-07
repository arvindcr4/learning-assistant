/**
 * Global setup for Jest tests
 * This file runs once before all tests
 */

const { spawn } = require('child_process');
const path = require('path');

module.exports = async () => {
  // Set up environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  
  // Set up database connection for testing
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/learning_assistant_test';
  
  // Disable analytics and external services in tests
  process.env.DISABLE_ANALYTICS = 'true';
  process.env.DISABLE_SENTRY = 'true';
  process.env.DISABLE_EXTERNAL_SERVICES = 'true';
  
  // Mock JWT secrets for testing
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-only';
  
  // Mock CSRF secret for testing
  process.env.CSRF_SECRET = 'test-csrf-secret-key-for-testing-only';
  
  // Mock encryption key for testing
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing-only-must-be-32-chars';
  
  // Mock API keys for testing
  process.env.OPENAI_API_KEY = 'test-openai-api-key';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-api-key';
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY = 'test-supabase-anon-key';
  
  // Set up test database (if needed)
  if (process.env.SETUP_TEST_DB) {
    console.log('Setting up test database...');
    // Add database setup logic here if needed
  }
  
  // Start mock server for API tests
  if (process.env.SETUP_MOCK_SERVER) {
    console.log('Starting mock server...');
    // Add mock server setup logic here if needed
  }
  
  console.log('Global test setup completed');
};