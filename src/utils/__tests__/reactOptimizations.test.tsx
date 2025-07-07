import React from 'react';
import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';
import {
  createOptimizedMemo,
  createDeepMemo,
  createShallowMemo,
  useOptimizedCallback,
  useOptimizedMemo,
  useConditionalRender,
  useDeferredValue,
  deepEqual,
  ReactOptimizations,
} from '../reactOptimizations';

// Mock the performance monitoring hook
jest.mock('@/hooks/usePerformanceMonitoring', () => ({
  useRenderTracking: jest.fn(),
}));

describe('reactOptimizations', () => {
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

  describe('useOptimizedCallback', () => {
    it('should be a function', () => {
      expect(typeof useOptimizedCallback).toBe('function');
    });
  });

  describe('useOptimizedMemo', () => {
    it('should be a function', () => {
      expect(typeof useOptimizedMemo).toBe('function');
    });
  });

  describe('useConditionalRender', () => {
    it('should be a function', () => {
      expect(typeof useConditionalRender).toBe('function');
    });
  });

  describe('useDeferredValue', () => {
    it('should be a function', () => {
      expect(typeof useDeferredValue).toBe('function');
    });
  });

  describe('ReactOptimizations', () => {
    it('should export all optimization utilities', () => {
      expect(ReactOptimizations).toBeDefined();
      expect(ReactOptimizations.createOptimizedMemo).toBe(createOptimizedMemo);
      expect(ReactOptimizations.createDeepMemo).toBe(createDeepMemo);
      expect(ReactOptimizations.createShallowMemo).toBe(createShallowMemo);
      expect(ReactOptimizations.useOptimizedCallback).toBe(useOptimizedCallback);
      expect(ReactOptimizations.useOptimizedMemo).toBe(useOptimizedMemo);
      expect(ReactOptimizations.useConditionalRender).toBe(useConditionalRender);
      expect(ReactOptimizations.useDeferredValue).toBe(useDeferredValue);
      expect(ReactOptimizations.deepEqual).toBe(deepEqual);
    });
  });
});