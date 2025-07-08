'use client';

import React, { useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { 
  reportError, 
  setUserContext, 
  setSentryTag, 
  trackLearningEvent, 
  measurePerformance,
  trackCustomMetric 
} from '@/lib/sentry';

interface TestResult {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  timestamp: number;
}

export function SentryTestDashboard() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addTestResult = (result: Omit<TestResult, 'id' | 'timestamp'>) => {
    const testResult: TestResult = {
      ...result,
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    setTests(prev => [...prev, testResult]);
    return testResult;
  };

  const updateTestResult = (id: string, updates: Partial<TestResult>) => {
    setTests(prev => prev.map(test => 
      test.id === id ? { ...test, ...updates } : test
    ));
  };

  const runTest = async (
    name: string,
    testFn: () => Promise<void> | void
  ): Promise<void> => {
    const test = addTestResult({ name, status: 'pending' });
    
    try {
      await testFn();
      updateTestResult(test.id, { 
        status: 'success', 
        message: 'Test completed successfully' 
      });
    } catch (error) {
      updateTestResult(test.id, { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  };

  const testBasicErrorCapture = async () => {
    const error = new Error('Test error from Sentry dashboard');
    reportError(error, { testContext: 'dashboard' });
  };

  const testUserContexts = async () => {
    setUserContext({
      id: 'test-user-123',
      email: 'test@example.com',
      username: 'testuser',
      role: 'student',
    });
    
    const error = new Error('Test error with user context');
    reportError(error, { testType: 'user_context' });
  };

  const testCustomTags = async () => {
    setSentryTag('test_scenario', 'custom_tags');
    setSentryTag('feature_flag', 'sentry_testing');
    
    const error = new Error('Test error with custom tags');
    reportError(error, { testType: 'custom_tags' });
  };

  const testLearningEvents = async () => {
    trackLearningEvent({
      type: 'lesson_start',
      lessonId: 'test-lesson-123',
      userId: 'test-user-123',
      difficulty: 'intermediate',
    });

    trackLearningEvent({
      type: 'quiz_attempt',
      lessonId: 'test-lesson-123',
      score: 85,
      duration: 30000,
      userId: 'test-user-123',
    });

    trackLearningEvent({
      type: 'lesson_complete',
      lessonId: 'test-lesson-123',
      score: 92,
      duration: 45000,
      userId: 'test-user-123',
    });
  };

  const testPerformanceMonitoring = async () => {
    await measurePerformance('test-operation', async () => {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Simulate API call
      await fetch('/api/monitoring?action=test-performance');
    });
  };

  const testCustomMetrics = async () => {
    trackCustomMetric('test_duration', 1500, { test_type: 'dashboard' });
    trackCustomMetric('test_score', 95, { test_type: 'dashboard' });
    trackCustomMetric('test_attempts', 3, { test_type: 'dashboard' });
  };

  const testApiErrorHandling = async () => {
    try {
      const response = await fetch('/api/monitoring?action=test-error');
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // This should be captured by the API error handler
      console.log('Expected API error captured');
    }
  };

  const testUnhandledPromiseRejection = async () => {
    // This will trigger the unhandled promise rejection handler
    Promise.reject(new Error('Test unhandled promise rejection'));
  };

  const testWarningMessage = async () => {
    Sentry.captureMessage('This is a test warning message', 'warning');
  };

  const testInfoMessage = async () => {
    Sentry.captureMessage('This is a test info message', 'info');
  };

  const testComponentError = () => {
    // This will be caught by the error boundary
    throw new Error('Test component error');
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTests([]);

    try {
      await runTest('Basic Error Capture', testBasicErrorCapture);
      await runTest('User Context', testUserContexts);
      await runTest('Custom Tags', testCustomTags);
      await runTest('Learning Events', testLearningEvents);
      await runTest('Performance Monitoring', testPerformanceMonitoring);
      await runTest('Custom Metrics', testCustomMetrics);
      await runTest('API Error Handling', testApiErrorHandling);
      await runTest('Warning Message', testWarningMessage);
      await runTest('Info Message', testInfoMessage);
      
      // Note: These tests are commented out as they would actually throw errors
      // await runTest('Unhandled Promise Rejection', testUnhandledPromiseRejection);
      // await runTest('Component Error', testComponentError);
    } finally {
      setIsRunning(false);
    }
  };

  const clearTests = () => {
    setTests([]);
  };

  const exportResults = () => {
    const data = {
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.status === 'success').length,
        failed: tests.filter(t => t.status === 'error').length,
        pending: tests.filter(t => t.status === 'pending').length,
      },
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentry-test-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-semibold text-yellow-800">Sentry Test Dashboard</h3>
        <p className="text-yellow-700 text-sm mt-1">
          This dashboard is only available in development mode.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Sentry Testing Dashboard
        </h2>
        <p className="text-gray-600">
          Test Sentry error monitoring, performance tracking, and user context features.
        </p>
      </div>

      {/* Control Panel */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>
        
        <button
          onClick={clearTests}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Clear Results
        </button>
        
        {tests.length > 0 && (
          <button
            onClick={exportResults}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Export Results
          </button>
        )}
      </div>

      {/* Individual Test Buttons */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Individual Tests</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <button
            onClick={() => runTest('Basic Error', testBasicErrorCapture)}
            className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
          >
            Test Error
          </button>
          
          <button
            onClick={() => runTest('User Context', testUserContexts)}
            className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
          >
            User Context
          </button>
          
          <button
            onClick={() => runTest('Custom Tags', testCustomTags)}
            className="px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm"
          >
            Custom Tags
          </button>
          
          <button
            onClick={() => runTest('Learning Events', testLearningEvents)}
            className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
          >
            Learning Events
          </button>
          
          <button
            onClick={() => runTest('Performance', testPerformanceMonitoring)}
            className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-sm"
          >
            Performance
          </button>
          
          <button
            onClick={() => runTest('Metrics', testCustomMetrics)}
            className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-sm"
          >
            Custom Metrics
          </button>
        </div>
      </div>

      {/* Test Results */}
      {tests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Test Results</h3>
          
          {/* Summary */}
          <div className="mb-4 grid grid-cols-4 gap-4">
            <div className="bg-gray-100 p-3 rounded text-center">
              <div className="text-2xl font-bold text-gray-800">{tests.length}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="bg-green-100 p-3 rounded text-center">
              <div className="text-2xl font-bold text-green-800">
                {tests.filter(t => t.status === 'success').length}
              </div>
              <div className="text-sm text-green-600">Passed</div>
            </div>
            <div className="bg-red-100 p-3 rounded text-center">
              <div className="text-2xl font-bold text-red-800">
                {tests.filter(t => t.status === 'error').length}
              </div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
            <div className="bg-yellow-100 p-3 rounded text-center">
              <div className="text-2xl font-bold text-yellow-800">
                {tests.filter(t => t.status === 'pending').length}
              </div>
              <div className="text-sm text-yellow-600">Pending</div>
            </div>
          </div>

          {/* Test List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tests.map(test => (
              <div
                key={test.id}
                className={`p-3 rounded border-l-4 ${
                  test.status === 'success'
                    ? 'bg-green-50 border-green-500'
                    : test.status === 'error'
                    ? 'bg-red-50 border-red-500'
                    : 'bg-yellow-50 border-yellow-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{test.name}</div>
                    {test.message && (
                      <div className="text-sm text-gray-600 mt-1">{test.message}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(test.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h4 className="font-semibold text-blue-800 mb-2">Instructions</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Click "Run All Tests" to execute all Sentry integration tests</li>
          <li>• Check your Sentry dashboard to see captured errors and events</li>
          <li>• Individual test buttons allow you to test specific features</li>
          <li>• Export results to save test outcomes for documentation</li>
          <li>• This dashboard is only available in development mode</li>
        </ul>
      </div>
    </div>
  );
}

export default SentryTestDashboard;