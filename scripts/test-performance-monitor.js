#!/usr/bin/env node

/**
 * Test Performance Monitor
 * Analyzes test execution performance and generates optimization recommendations
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class TestPerformanceMonitor {
  constructor() {
    this.testResultsDir = path.join(process.cwd(), 'test-results');
    this.performanceData = [];
    this.recommendations = [];
  }

  async analyzeTestPerformance() {
    console.log('🔍 Analyzing test performance...');
    
    try {
      // Read performance data from previous runs
      await this.loadHistoricalData();
      
      // Analyze current test execution
      await this.analyzeCurrentExecution();
      
      // Generate recommendations
      this.generateRecommendations();
      
      // Generate report
      await this.generateReport();
      
      console.log('✅ Performance analysis completed');
      
    } catch (error) {
      console.error('❌ Performance analysis failed:', error);
      process.exit(1);
    }
  }

  async loadHistoricalData() {
    const historyFile = path.join(this.testResultsDir, 'test-history.json');
    
    if (fs.existsSync(historyFile)) {
      try {
        const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        this.performanceData = history.slice(-50); // Last 50 runs
        console.log(`📊 Loaded ${this.performanceData.length} historical data points`);
      } catch (error) {
        console.warn('⚠️  Could not load historical data:', error.message);
      }
    } else {
      console.log('📊 No historical data found');
    }
  }

  async analyzeCurrentExecution() {
    const analyticsFile = path.join(this.testResultsDir, 'test-analytics.json');
    
    if (fs.existsSync(analyticsFile)) {
      try {
        const analytics = JSON.parse(fs.readFileSync(analyticsFile, 'utf8'));
        this.currentAnalytics = analytics;
        console.log('📈 Current test analytics loaded');
      } catch (error) {
        console.warn('⚠️  Could not load current analytics:', error.message);
      }
    }
  }

  generateRecommendations() {
    console.log('💡 Generating performance recommendations...');
    
    if (!this.currentAnalytics) {
      this.recommendations.push({
        type: 'warning',
        title: 'No Analytics Data',
        description: 'Test analytics data is not available. Enable performance monitoring.',
        impact: 'medium',
        action: 'Set ENABLE_PERFORMANCE_MONITORING=true in test environment',
      });
      return;
    }

    const { summary, performance: perf, testSuites } = this.currentAnalytics;

    // Analyze test execution time
    if (summary.totalTime > 60000) { // > 1 minute
      this.recommendations.push({
        type: 'optimization',
        title: 'Slow Test Execution',
        description: `Total test time is ${(summary.totalTime / 1000).toFixed(1)}s. Consider optimizations.`,
        impact: 'high',
        action: 'Enable test sharding and parallel execution',
      });
    }

    // Analyze average test time
    if (perf.averageTestTime > 1000) { // > 1 second per test
      this.recommendations.push({
        type: 'optimization',
        title: 'Slow Individual Tests',
        description: `Average test time is ${perf.averageTestTime.toFixed(1)}ms per test.`,
        impact: 'medium',
        action: 'Review slowest tests and optimize test data generation',
      });
    }

    // Analyze slowest test suites
    const slowThreshold = 5000; // 5 seconds
    const slowSuites = perf.slowestSuites.filter(suite => suite.duration > slowThreshold);
    
    if (slowSuites.length > 0) {
      this.recommendations.push({
        type: 'optimization',
        title: 'Slow Test Suites Detected',
        description: `${slowSuites.length} test suites are taking longer than ${slowThreshold}ms.`,
        impact: 'high',
        action: 'Optimize or split slow test suites: ' + slowSuites.map(s => s.name).join(', '),
        details: slowSuites,
      });
    }

    // Analyze test failure patterns
    const failedTests = summary.failedTests;
    if (failedTests > 0) {
      const failureRate = (failedTests / summary.totalTests) * 100;
      
      if (failureRate > 10) {
        this.recommendations.push({
          type: 'quality',
          title: 'High Test Failure Rate',
          description: `${failureRate.toFixed(1)}% of tests are failing.`,
          impact: 'critical',
          action: 'Review and fix failing tests before optimizing performance',
        });
      }
    }

    // Analyze historical trends
    if (this.performanceData.length >= 5) {
      const recentRuns = this.performanceData.slice(-5);
      const averageTime = recentRuns.reduce((sum, run) => sum + run.totalTime, 0) / recentRuns.length;
      
      if (summary.totalTime > averageTime * 1.2) { // 20% slower than average
        this.recommendations.push({
          type: 'trend',
          title: 'Performance Regression',
          description: `Current run is ${((summary.totalTime / averageTime - 1) * 100).toFixed(1)}% slower than recent average.`,
          impact: 'medium',
          action: 'Investigate recent changes that may have impacted test performance',
        });
      }
    }

    // Analyze pass rate trends
    if (this.performanceData.length >= 10) {
      const recentPassRates = this.performanceData.slice(-10).map(run => run.passRate);
      const averagePassRate = recentPassRates.reduce((sum, rate) => sum + rate, 0) / recentPassRates.length;
      const currentPassRate = summary.passedTests / summary.totalTests * 100;
      
      if (currentPassRate < averagePassRate - 5) { // 5% lower than average
        this.recommendations.push({
          type: 'quality',
          title: 'Declining Pass Rate',
          description: `Pass rate has decreased by ${(averagePassRate - currentPassRate).toFixed(1)}% compared to recent runs.`,
          impact: 'high',
          action: 'Review recent changes and fix unstable tests',
        });
      }
    }

    // Environment-specific recommendations
    if (this.currentAnalytics.environment.ci) {
      if (summary.totalTime > 300000) { // > 5 minutes in CI
        this.recommendations.push({
          type: 'ci',
          title: 'CI Execution Too Slow',
          description: `CI test execution is taking ${(summary.totalTime / 60000).toFixed(1)} minutes.`,
          impact: 'high',
          action: 'Implement more aggressive test sharding and parallel execution in CI',
        });
      }
    }

    console.log(`💡 Generated ${this.recommendations.length} recommendations`);
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      recommendations: this.recommendations,
      trends: this.analyzeTrends(),
      optimizations: this.suggestOptimizations(),
    };

    // Write performance report
    const reportPath = path.join(this.testResultsDir, 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const markdownPath = path.join(this.testResultsDir, 'performance-report.md');
    fs.writeFileSync(markdownPath, markdownReport);

    console.log(`📄 Performance report saved to: ${reportPath}`);
    console.log(`📄 Markdown report saved to: ${markdownPath}`);
  }

  generateSummary() {
    if (!this.currentAnalytics) {
      return {
        status: 'no-data',
        message: 'No analytics data available',
      };
    }

    const { summary } = this.currentAnalytics;
    const criticalIssues = this.recommendations.filter(r => r.impact === 'critical').length;
    const highImpactIssues = this.recommendations.filter(r => r.impact === 'high').length;

    let status = 'good';
    if (criticalIssues > 0) {
      status = 'critical';
    } else if (highImpactIssues > 2) {
      status = 'poor';
    } else if (highImpactIssues > 0) {
      status = 'warning';
    }

    return {
      status,
      totalTests: summary.totalTests,
      totalTime: summary.totalTime,
      passRate: (summary.passedTests / summary.totalTests * 100).toFixed(1) + '%',
      averageTestTime: this.currentAnalytics.performance.averageTestTime.toFixed(1) + 'ms',
      criticalIssues,
      highImpactIssues,
      totalRecommendations: this.recommendations.length,
    };
  }

  analyzeTrends() {
    if (this.performanceData.length < 5) {
      return {
        available: false,
        message: 'Insufficient historical data for trend analysis',
      };
    }

    const recent = this.performanceData.slice(-10);
    const older = this.performanceData.slice(-20, -10);

    if (older.length === 0) {
      return {
        available: false,
        message: 'Insufficient historical data for comparison',
      };
    }

    const recentAvgTime = recent.reduce((sum, run) => sum + run.totalTime, 0) / recent.length;
    const olderAvgTime = older.reduce((sum, run) => sum + run.totalTime, 0) / older.length;
    
    const recentAvgPassRate = recent.reduce((sum, run) => sum + run.passRate, 0) / recent.length;
    const olderAvgPassRate = older.reduce((sum, run) => sum + run.passRate, 0) / older.length;

    const timeChange = ((recentAvgTime - olderAvgTime) / olderAvgTime) * 100;
    const passRateChange = recentAvgPassRate - olderAvgPassRate;

    return {
      available: true,
      timeChange: {
        value: timeChange.toFixed(1) + '%',
        trend: timeChange > 5 ? 'slower' : timeChange < -5 ? 'faster' : 'stable',
      },
      passRateChange: {
        value: passRateChange.toFixed(1) + '%',
        trend: passRateChange > 2 ? 'improving' : passRateChange < -2 ? 'declining' : 'stable',
      },
    };
  }

  suggestOptimizations() {
    const optimizations = [
      {
        category: 'Test Execution',
        suggestions: [
          'Enable test sharding for large test suites',
          'Use parallel execution where possible',
          'Implement intelligent test selection based on changed files',
          'Cache test dependencies and build artifacts',
        ],
      },
      {
        category: 'Test Data',
        suggestions: [
          'Use test data factories for efficient data generation',
          'Implement data caching for reusable test scenarios',
          'Optimize database setup and teardown procedures',
          'Use in-memory databases for unit tests',
        ],
      },
      {
        category: 'CI/CD Pipeline',
        suggestions: [
          'Implement matrix builds for parallel test execution',
          'Use dependency caching in CI environments',
          'Optimize Docker image builds and caching',
          'Implement smart test scheduling based on historical data',
        ],
      },
      {
        category: 'Test Quality',
        suggestions: [
          'Remove or fix flaky tests',
          'Optimize slow test cases',
          'Implement proper test isolation',
          'Use mocking strategically to reduce external dependencies',
        ],
      },
    ];

    return optimizations;
  }

  generateMarkdownReport(report) {
    const { summary, recommendations, trends, optimizations } = report;

    return `# Test Performance Report

Generated on ${new Date(report.timestamp).toLocaleString()}

## 📊 Summary

- **Status**: ${this.getStatusEmoji(summary.status)} ${summary.status.toUpperCase()}
- **Total Tests**: ${summary.totalTests}
- **Execution Time**: ${(summary.totalTime / 1000).toFixed(1)}s
- **Pass Rate**: ${summary.passRate}
- **Average Test Time**: ${summary.averageTestTime}
- **Issues Found**: ${summary.criticalIssues} critical, ${summary.highImpactIssues} high impact

## 🎯 Recommendations

${recommendations.length === 0 ? 'No recommendations at this time.' : 
  recommendations.map((rec, index) => `
### ${index + 1}. ${rec.title}

- **Type**: ${rec.type}
- **Impact**: ${rec.impact}
- **Description**: ${rec.description}
- **Action**: ${rec.action}
${rec.details ? `\n**Details**: ${JSON.stringify(rec.details, null, 2)}` : ''}
`).join('\n')}

## 📈 Trends

${trends.available ? `
- **Execution Time**: ${trends.timeChange.value} (${trends.timeChange.trend})
- **Pass Rate**: ${trends.passRateChange.value} (${trends.passRateChange.trend})
` : trends.message}

## 🚀 Optimization Suggestions

${optimizations.map(category => `
### ${category.category}

${category.suggestions.map(suggestion => `- ${suggestion}`).join('\n')}
`).join('\n')}

## 📋 Action Items

${recommendations.filter(r => r.impact === 'critical' || r.impact === 'high').map((rec, index) => `
${index + 1}. **${rec.title}**: ${rec.action}
`).join('\n')}

---
*Report generated by Test Performance Monitor*
`;
  }

  getStatusEmoji(status) {
    const emojis = {
      good: '✅',
      warning: '⚠️',
      poor: '🔶',
      critical: '🔴',
      'no-data': '❓',
    };
    return emojis[status] || '❓';
  }
}

// CLI interface
async function main() {
  const monitor = new TestPerformanceMonitor();
  
  const args = process.argv.slice(2);
  const command = args[0] || 'analyze';

  switch (command) {
    case 'analyze':
      await monitor.analyzeTestPerformance();
      break;
    case 'help':
      console.log(`
Test Performance Monitor

Usage:
  node test-performance-monitor.js [command]

Commands:
  analyze  Analyze test performance and generate recommendations (default)
  help     Show this help message

Examples:
  node test-performance-monitor.js
  node test-performance-monitor.js analyze
`);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Use "help" for usage information.');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Monitor failed:', error);
    process.exit(1);
  });
}

module.exports = TestPerformanceMonitor;