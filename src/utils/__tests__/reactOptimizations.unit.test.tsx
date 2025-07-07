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
  createDeepMemo,
  createShallowMemo,
  deepEqual,
  ReactOptimizations,
} from '../reactOptimizations';

describe('reactOptimizations - Unit Tests', () => {
  describe('deepEqual', () => {
    it('should correctly compare primitive values', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual('test', 'test')).toBe(true);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      
      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual('test', 'other')).toBe(false);
      expect(deepEqual(true, false)).toBe(false);
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it('should correctly compare objects', () => {
      expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
      
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    });

    it('should correctly compare arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([{ a: 1 }], [{ a: 1 }])).toBe(true);
      
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
    });
  });

  describe('createOptimizedMemo', () => {
    it('should create a memoized component', () => {
      const TestComponent = ({ value }: { value: number }) => <div>{value}</div>;
      const MemoizedComponent = createOptimizedMemo(TestComponent);
      
      expect(MemoizedComponent).toBeDefined();
      expect(MemoizedComponent.displayName).toBe('Memo(TestComponent)');
    });

    it('should render the memoized component correctly', () => {
      const TestComponent = ({ value }: { value: number }) => <div data-testid="test">{value}</div>;
      const MemoizedComponent = createOptimizedMemo(TestComponent);
      
      render(<MemoizedComponent value={42} />);
      expect(screen.getByTestId('test')).toHaveTextContent('42');
    });
  });

  describe('createDeepMemo', () => {
    it('should create a deep memoized component', () => {
      const TestComponent = ({ data }: { data: { value: number } }) => <div>{data.value}</div>;
      const DeepMemoizedComponent = createDeepMemo(TestComponent);
      
      expect(DeepMemoizedComponent).toBeDefined();
      expect(DeepMemoizedComponent.displayName).toBe('Memo(TestComponent)');
    });
  });

  describe('createShallowMemo', () => {
    it('should create a shallow memoized component', () => {
      const TestComponent = ({ value }: { value: number }) => <div>{value}</div>;
      const ShallowMemoizedComponent = createShallowMemo(TestComponent);
      
      expect(ShallowMemoizedComponent).toBeDefined();
      expect(ShallowMemoizedComponent.displayName).toBe('Tracked(TestComponent)');
    });
  });

  describe('ReactOptimizations', () => {
    it('should export all optimization utilities', () => {
      expect(ReactOptimizations).toBeDefined();
      expect(ReactOptimizations.createOptimizedMemo).toBe(createOptimizedMemo);
      expect(ReactOptimizations.createDeepMemo).toBe(createDeepMemo);
      expect(ReactOptimizations.createShallowMemo).toBe(createShallowMemo);
      expect(ReactOptimizations.deepEqual).toBe(deepEqual);
    });
  });
});