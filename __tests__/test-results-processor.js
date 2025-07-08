/**
 * Test Results Processor for Analytics and Reporting
 * Processes Jest test results and generates analytics data
 */

const fs = require('fs');
const path = require('path');

module.exports = function testResultsProcessor(testResults) {
  const analytics = {
    summary: {
      totalTests: testResults.numTotalTests,
      passedTests: testResults.numPassedTests,
      failedTests: testResults.numFailedTests,
      pendingTests: testResults.numPendingTests,
      todoTests: testResults.numTodoTests,
      totalTime: testResults.runTime,
      success: testResults.success,
      timestamp: new Date().toISOString(),
    },
    testSuites: testResults.testResults.map(suite => ({
      name: suite.testFilePath.replace(process.cwd(), ''),
      duration: suite.endTime - suite.startTime,
      tests: suite.numPassingTests + suite.numFailingTests,
      passed: suite.numPassingTests,
      failed: suite.numFailingTests,
      pending: suite.numPendingTests,
      todo: suite.numTodoTests,
      coverage: suite.coverage || null,
      failureMessages: suite.failureMessage ? [suite.failureMessage] : [],
      skipped: suite.skipped,
    })),
    performance: {
      averageTestTime: testResults.runTime / testResults.numTotalTests,
      slowestSuites: testResults.testResults
        .map(suite => ({
          name: suite.testFilePath.replace(process.cwd(), ''),
          duration: suite.endTime - suite.startTime,
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10),
      fastestSuites: testResults.testResults
        .map(suite => ({
          name: suite.testFilePath.replace(process.cwd(), ''),
          duration: suite.endTime - suite.startTime,
        }))
        .sort((a, b) => a.duration - b.duration)
        .slice(0, 10),
    },
    coverage: testResults.coverageMap ? {
      global: testResults.coverageMap.getCoverageSummary(),
      files: Object.keys(testResults.coverageMap.data).map(file => ({
        file: file.replace(process.cwd(), ''),
        coverage: testResults.coverageMap.fileCoverageFor(file).toSummary(),
      })),
    } : null,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      ci: process.env.CI === 'true',
      maxWorkers: process.env.JEST_WORKERS || 'auto',
      shard: process.env.JEST_SHARD || null,
    },
  };

  // Ensure test-results directory exists
  const resultsDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Write analytics data
  try {
    fs.writeFileSync(
      path.join(resultsDir, 'test-analytics.json'),
      JSON.stringify(analytics, null, 2)
    );

    // Write performance metrics
    const performanceMetrics = {
      timestamp: new Date().toISOString(),
      totalTime: testResults.runTime,
      averageTestTime: analytics.performance.averageTestTime,
      testCount: testResults.numTotalTests,
      passRate: (testResults.numPassedTests / testResults.numTotalTests) * 100,
      failRate: (testResults.numFailedTests / testResults.numTotalTests) * 100,
      slowestTests: analytics.performance.slowestSuites.slice(0, 5),
    };

    fs.writeFileSync(
      path.join(resultsDir, 'performance-metrics.json'),
      JSON.stringify(performanceMetrics, null, 2)
    );

    // Generate markdown summary
    const markdownSummary = generateMarkdownSummary(analytics);
    fs.writeFileSync(
      path.join(resultsDir, 'test-summary.md'),
      markdownSummary
    );

    // Append to historical data
    appendHistoricalData(performanceMetrics);

    console.log('\n📊 Test Analytics Generated:');
    console.log(`   - Test Analytics: ${path.join(resultsDir, 'test-analytics.json')}`);
    console.log(`   - Performance Metrics: ${path.join(resultsDir, 'performance-metrics.json')}`);
    console.log(`   - Summary Report: ${path.join(resultsDir, 'test-summary.md')}`);
    console.log(`   - Pass Rate: ${performanceMetrics.passRate.toFixed(1)}%`);
    console.log(`   - Average Test Time: ${performanceMetrics.averageTestTime.toFixed(2)}ms`);

  } catch (error) {
    console.error('Error writing test analytics:', error);
  }

  return testResults;
};

function generateMarkdownSummary(analytics) {
  const { summary, performance, coverage } = analytics;
  
  return `# Test Results Summary

## 📊 Test Statistics
- **Total Tests**: ${summary.totalTests}
- **Passed**: ${summary.passedTests} (${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%)
- **Failed**: ${summary.failedTests} (${((summary.failedTests / summary.totalTests) * 100).toFixed(1)}%)
- **Pending**: ${summary.pendingTests}
- **Todo**: ${summary.todoTests}
- **Total Time**: ${(summary.totalTime / 1000).toFixed(2)}s
- **Average Test Time**: ${performance.averageTestTime.toFixed(2)}ms

## 🚀 Performance Metrics

### Slowest Test Suites
${performance.slowestSuites.map((suite, index) => 
  `${index + 1}. ${suite.name} (${suite.duration}ms)`
).join('\n')}

### Fastest Test Suites
${performance.fastestSuites.map((suite, index) => 
  `${index + 1}. ${suite.name} (${suite.duration}ms)`
).join('\n')}

${coverage ? `## 📈 Coverage Summary
- **Lines**: ${coverage.global.lines.pct}%
- **Functions**: ${coverage.global.functions.pct}%
- **Branches**: ${coverage.global.branches.pct}%
- **Statements**: ${coverage.global.statements.pct}%
` : ''}

## 🔧 Environment
- **Node.js**: ${analytics.environment.node}
- **Platform**: ${analytics.environment.platform}
- **Architecture**: ${analytics.environment.arch}
- **CI**: ${analytics.environment.ci ? 'Yes' : 'No'}
- **Max Workers**: ${analytics.environment.maxWorkers}
${analytics.environment.shard ? `- **Shard**: ${analytics.environment.shard}` : ''}

---
*Generated on ${new Date().toISOString()}*
`;
}

function appendHistoricalData(metrics) {
  const historyFile = path.join(process.cwd(), 'test-results', 'test-history.json');
  let history = [];
  
  try {
    if (fs.existsSync(historyFile)) {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    }
  } catch (error) {
    console.warn('Could not read test history file:', error.message);
  }

  // Keep only last 100 entries
  history.push(metrics);
  if (history.length > 100) {
    history = history.slice(-100);
  }

  try {
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  } catch (error) {
    console.warn('Could not write test history file:', error.message);
  }
}