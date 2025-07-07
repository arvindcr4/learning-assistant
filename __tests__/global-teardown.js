/**
 * Global teardown for Jest tests
 * This file runs once after all tests
 */

module.exports = async () => {
  // Clean up test database
  if (process.env.CLEANUP_TEST_DB) {
    console.log('Cleaning up test database...');
    // Add database cleanup logic here if needed
  }
  
  // Stop mock server
  if (process.env.CLEANUP_MOCK_SERVER) {
    console.log('Stopping mock server...');
    // Add mock server cleanup logic here if needed
  }
  
  // Clean up any global test artifacts
  if (global.testCleanup) {
    await global.testCleanup();
  }
  
  console.log('Global test teardown completed');
};