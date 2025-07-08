#!/usr/bin/env python3

"""
Performance Regression Analysis Script
Analyzes performance metrics and detects regressions
"""

import json
import argparse
import os
import glob
import statistics
from datetime import datetime
from typing import Dict, List, Any, Optional
import pandas as pd
import numpy as np

class PerformanceRegressionAnalyzer:
    def __init__(self, threshold: float = 0.1):
        """
        Initialize the regression analyzer
        
        Args:
            threshold: Regression threshold (0.1 = 10% degradation)
        """
        self.threshold = threshold
        self.baseline_data = {}
        self.current_data = {}
        self.regressions = []
        self.improvements = []
        
    def load_baseline(self, baseline_file: str) -> bool:
        """Load baseline performance data"""
        try:
            with open(baseline_file, 'r') as f:
                self.baseline_data = json.load(f)
            print(f"✅ Loaded baseline data from {baseline_file}")
            return True
        except Exception as e:
            print(f"❌ Failed to load baseline: {e}")
            return False
    
    def load_current_data(self, data_dir: str) -> bool:
        """Load current performance test results"""
        try:
            # Load Lighthouse results
            lighthouse_files = glob.glob(f"{data_dir}/**/lighthouse-summary-*.json", recursive=True)
            lighthouse_data = []
            
            for file in lighthouse_files:
                with open(file, 'r') as f:
                    data = json.load(f)
                    lighthouse_data.append(data)
            
            # Load test results
            load_test_files = glob.glob(f"{data_dir}/**/load-test-summary-*.json", recursive=True)
            load_test_data = []
            
            for file in load_test_files:
                with open(file, 'r') as f:
                    data = json.load(f)
                    load_test_data.append(data)
            
            # Load benchmark results
            benchmark_files = glob.glob(f"{data_dir}/**/benchmark-summary.json", recursive=True)
            benchmark_data = {}
            
            for file in benchmark_files:
                with open(file, 'r') as f:
                    benchmark_data = json.load(f)
                    break  # Take the first one found
            
            # Load bundle analysis
            bundle_files = glob.glob(f"{data_dir}/**/bundle-analysis-summary.json", recursive=True)
            bundle_data = {}
            
            for file in bundle_files:
                with open(file, 'r') as f:
                    bundle_data = json.load(f)
                    break  # Take the first one found
            
            self.current_data = {
                'lighthouse': lighthouse_data,
                'loadTests': load_test_data,
                'benchmarks': benchmark_data,
                'bundle': bundle_data,
                'timestamp': datetime.now().isoformat()
            }
            
            print(f"✅ Loaded current performance data from {data_dir}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to load current data: {e}")
            return False
    
    def analyze_lighthouse_regression(self) -> List[Dict]:
        """Analyze Lighthouse performance regression"""
        regressions = []
        
        baseline_lighthouse = self.baseline_data.get('lighthouse', [])
        current_lighthouse = self.current_data.get('lighthouse', [])
        
        # Group by device and page for comparison
        baseline_grouped = {}
        for item in baseline_lighthouse:
            key = f"{item.get('device', 'unknown')}-{item.get('page', 'unknown')}"
            baseline_grouped[key] = item
        
        current_grouped = {}
        for item in current_lighthouse:
            key = f"{item.get('device', 'unknown')}-{item.get('page', 'unknown')}"
            current_grouped[key] = item
        
        # Compare metrics
        metrics = ['performance', 'accessibility', 'bestPractices', 'seo']
        
        for key in baseline_grouped:
            if key not in current_grouped:
                continue
                
            baseline_item = baseline_grouped[key]
            current_item = current_grouped[key]
            
            for metric in metrics:
                baseline_value = baseline_item.get(metric, 0)
                current_value = current_item.get(metric, 0)
                
                if baseline_value > 0:
                    change = (baseline_value - current_value) / baseline_value
                    
                    if change > self.threshold:
                        regressions.append({
                            'type': 'lighthouse',
                            'metric': f"{key}-{metric}",
                            'baseline': baseline_value,
                            'current': current_value,
                            'change': change,
                            'severity': 'critical' if change > 0.2 else 'moderate',
                            'description': f"Lighthouse {metric} degraded by {change:.1%} for {key}"
                        })
        
        return regressions
    
    def analyze_load_test_regression(self) -> List[Dict]:
        """Analyze load test performance regression"""
        regressions = []
        
        baseline_load = self.baseline_data.get('loadTests', [])
        current_load = self.current_data.get('loadTests', [])
        
        # Group by scenario
        baseline_grouped = {item.get('scenario', 'unknown'): item for item in baseline_load}
        current_grouped = {item.get('scenario', 'unknown'): item for item in current_load}
        
        for scenario in baseline_grouped:
            if scenario not in current_grouped:
                continue
                
            baseline_item = baseline_grouped[scenario]
            current_item = current_grouped[scenario]
            
            # Analyze response time regression
            baseline_rt = baseline_item.get('metrics', {}).get('http_req_duration', {}).get('avg', 0)
            current_rt = current_item.get('metrics', {}).get('http_req_duration', {}).get('avg', 0)
            
            if baseline_rt > 0:
                rt_change = (current_rt - baseline_rt) / baseline_rt
                
                if rt_change > self.threshold:
                    regressions.append({
                        'type': 'load_test',
                        'metric': f"{scenario}-response_time",
                        'baseline': baseline_rt,
                        'current': current_rt,
                        'change': rt_change,
                        'severity': 'critical' if rt_change > 0.5 else 'moderate',
                        'description': f"Response time increased by {rt_change:.1%} for {scenario} scenario"
                    })
            
            # Analyze error rate regression
            baseline_errors = baseline_item.get('metrics', {}).get('http_req_failed', {}).get('rate', 0)
            current_errors = current_item.get('metrics', {}).get('http_req_failed', {}).get('rate', 0)
            
            error_change = current_errors - baseline_errors
            
            if error_change > 0.01:  # 1% increase in error rate
                regressions.append({
                    'type': 'load_test',
                    'metric': f"{scenario}-error_rate",
                    'baseline': baseline_errors,
                    'current': current_errors,
                    'change': error_change,
                    'severity': 'critical',
                    'description': f"Error rate increased by {error_change:.1%} for {scenario} scenario"
                })
        
        return regressions
    
    def analyze_benchmark_regression(self) -> List[Dict]:
        """Analyze benchmark performance regression"""
        regressions = []
        
        baseline_benchmarks = self.baseline_data.get('benchmarks', {})
        current_benchmarks = self.current_data.get('benchmarks', {})
        
        for test_type in ['memory', 'cpu', 'algorithm']:
            baseline_test = baseline_benchmarks.get(test_type, {})
            current_test = current_benchmarks.get(test_type, {})
            
            if not baseline_test or not current_test:
                continue
            
            # Analyze test results (assuming Jest performance test format)
            baseline_results = baseline_test.get('testResults', [])
            current_results = current_test.get('testResults', [])
            
            for i, baseline_result in enumerate(baseline_results):
                if i >= len(current_results):
                    continue
                    
                current_result = current_results[i]
                
                baseline_time = baseline_result.get('duration', 0)
                current_time = current_result.get('duration', 0)
                
                if baseline_time > 0:
                    time_change = (current_time - baseline_time) / baseline_time
                    
                    if time_change > self.threshold:
                        test_name = baseline_result.get('title', f"{test_type}-test-{i}")
                        regressions.append({
                            'type': 'benchmark',
                            'metric': f"{test_type}-{test_name}",
                            'baseline': baseline_time,
                            'current': current_time,
                            'change': time_change,
                            'severity': 'moderate',
                            'description': f"Benchmark {test_name} execution time increased by {time_change:.1%}"
                        })
        
        return regressions
    
    def analyze_bundle_regression(self) -> List[Dict]:
        """Analyze bundle size regression"""
        regressions = []
        
        baseline_bundle = self.baseline_data.get('bundle', {})
        current_bundle = self.current_data.get('bundle', {})
        
        if not baseline_bundle or not current_bundle:
            return regressions
        
        baseline_size = baseline_bundle.get('totalSize', 0)
        current_size = current_bundle.get('totalSize', 0)
        
        if baseline_size > 0:
            size_change = (current_size - baseline_size) / baseline_size
            
            if size_change > self.threshold:
                regressions.append({
                    'type': 'bundle',
                    'metric': 'total_size',
                    'baseline': baseline_size,
                    'current': current_size,
                    'change': size_change,
                    'severity': 'moderate',
                    'description': f"Bundle size increased by {size_change:.1%} ({current_size - baseline_size} bytes)"
                })
        
        return regressions
    
    def analyze_regressions(self) -> Dict[str, Any]:
        """Perform comprehensive regression analysis"""
        print("🔍 Analyzing performance regressions...")
        
        all_regressions = []
        
        # Analyze different types of performance data
        all_regressions.extend(self.analyze_lighthouse_regression())
        all_regressions.extend(self.analyze_load_test_regression())
        all_regressions.extend(self.analyze_benchmark_regression())
        all_regressions.extend(self.analyze_bundle_regression())
        
        # Categorize regressions
        critical_regressions = [r for r in all_regressions if r['severity'] == 'critical']
        moderate_regressions = [r for r in all_regressions if r['severity'] == 'moderate']
        
        # Generate summary
        summary = f"Found {len(all_regressions)} performance regressions"
        if critical_regressions:
            summary += f" ({len(critical_regressions)} critical)"
        
        # Generate recommendations
        recommendations = self.generate_recommendations(all_regressions)
        
        return {
            'summary': summary,
            'regressions': all_regressions,
            'criticalRegressions': critical_regressions,
            'moderateRegressions': moderate_regressions,
            'recommendations': recommendations,
            'threshold': self.threshold,
            'timestamp': datetime.now().isoformat()
        }
    
    def generate_recommendations(self, regressions: List[Dict]) -> List[str]:
        """Generate recommendations based on detected regressions"""
        recommendations = []
        
        # Bundle size recommendations
        bundle_regressions = [r for r in regressions if r['type'] == 'bundle']
        if bundle_regressions:
            recommendations.append(
                "📦 Bundle size increased - consider code splitting, tree shaking, or dependency analysis"
            )
        
        # Lighthouse recommendations
        lighthouse_regressions = [r for r in regressions if r['type'] == 'lighthouse']
        if lighthouse_regressions:
            recommendations.append(
                "🔍 Lighthouse scores degraded - review Core Web Vitals, optimize images, and minimize JavaScript"
            )
        
        # Load test recommendations
        load_regressions = [r for r in regressions if r['type'] == 'load_test']
        if load_regressions:
            recommendations.append(
                "⚡ Load test performance degraded - check database queries, API responses, and server resources"
            )
        
        # Benchmark recommendations
        benchmark_regressions = [r for r in regressions if r['type'] == 'benchmark']
        if benchmark_regressions:
            recommendations.append(
                "🧮 Benchmark performance degraded - review algorithm implementations and memory usage"
            )
        
        # Critical regression recommendations
        critical_regressions = [r for r in regressions if r['severity'] == 'critical']
        if critical_regressions:
            recommendations.append(
                "🚨 Critical regressions detected - consider blocking deployment until resolved"
            )
        
        if not recommendations:
            recommendations.append("✅ No significant performance regressions detected")
        
        return recommendations
    
    def save_report(self, output_file: str, report: Dict[str, Any]) -> bool:
        """Save regression analysis report"""
        try:
            with open(output_file, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"✅ Regression report saved to {output_file}")
            return True
        except Exception as e:
            print(f"❌ Failed to save report: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description='Performance Regression Analysis')
    parser.add_argument('--baseline', required=True, help='Baseline performance data file')
    parser.add_argument('--current', required=True, help='Current performance data directory')
    parser.add_argument('--output', required=True, help='Output report file')
    parser.add_argument('--threshold', type=float, default=0.1, help='Regression threshold (default: 0.1)')
    
    args = parser.parse_args()
    
    analyzer = PerformanceRegressionAnalyzer(threshold=args.threshold)
    
    # Load data
    if not analyzer.load_baseline(args.baseline):
        return 1
    
    if not analyzer.load_current_data(args.current):
        return 1
    
    # Analyze regressions
    report = analyzer.analyze_regressions()
    
    # Save report
    if not analyzer.save_report(args.output, report):
        return 1
    
    # Print summary
    print(f"\n📊 Regression Analysis Summary:")
    print(f"   - Total regressions: {len(report['regressions'])}")
    print(f"   - Critical regressions: {len(report['criticalRegressions'])}")
    print(f"   - Moderate regressions: {len(report['moderateRegressions'])}")
    print(f"   - Threshold: {args.threshold:.1%}")
    
    if report['recommendations']:
        print(f"\n💡 Recommendations:")
        for rec in report['recommendations']:
            print(f"   - {rec}")
    
    # Exit with error code if critical regressions found
    if report['criticalRegressions']:
        print(f"\n❌ Critical performance regressions detected!")
        return 1
    
    print(f"\n✅ Performance regression analysis completed")
    return 0

if __name__ == '__main__':
    exit(main())