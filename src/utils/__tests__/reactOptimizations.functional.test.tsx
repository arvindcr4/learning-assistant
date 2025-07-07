/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the performance monitoring hook
jest.mock('@/hooks/usePerformanceMonitoring', () => ({
  useRenderTracking: jest.fn(),
}));

import {
  createOptimizedMemo,
  deepEqual,
  ReactOptimizations,
} from '../reactOptimizations';

describe('React Optimizations - Functional Tests', () => {
  describe('deepEqual function', () => {
    it('should work as exported function', () => {
      expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });
  });

  describe('createOptimizedMemo', () => {
    it('should create working memoized components', () => {
      const TestComponent = ({ value }: { value: number }) => (
        <div data-testid="memo-test">{value}</div>
      );
      
      const MemoizedComponent = createOptimizedMemo(TestComponent);
      
      render(<MemoizedComponent value={42} />);
      expect(screen.getByTestId('memo-test')).toHaveTextContent('42');
    });

    it('should handle tracking enabled components', () => {
      const TestComponent = ({ value }: { value: number }) => (
        <div data-testid="tracked-test">{value}</div>
      );
      
      const TrackedComponent = createOptimizedMemo(TestComponent, {
        trackRenders: true,
        componentName: 'TrackedTest'
      });
      
      render(<TrackedComponent value={123} />);
      expect(screen.getByTestId('tracked-test')).toHaveTextContent('123');
    });
  });

  describe('ReactOptimizations export', () => {
    it('should export all required functions', () => {
      expect(ReactOptimizations.createOptimizedMemo).toBeDefined();
      expect(ReactOptimizations.deepEqual).toBeDefined();
      expect(ReactOptimizations.createDeepMemo).toBeDefined();
      expect(ReactOptimizations.createShallowMemo).toBeDefined();
      expect(ReactOptimizations.useDeferredValue).toBeDefined();
    });
  });
});