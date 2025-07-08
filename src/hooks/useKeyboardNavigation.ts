'use client';

import { useEffect, useCallback, useRef } from 'react';
import { handleKeyboardNavigation, FocusManager } from '@/utils/accessibility';
import { useAccessibility } from '@/contexts/AccessibilityContext';

export interface KeyboardNavigationOptions {
  // Element selection
  focusableSelector?: string;
  containerRef?: React.RefObject<HTMLElement>;
  
  // Navigation behavior
  loop?: boolean;
  skipDisabled?: boolean;
  escapeHandler?: () => void;
  
  // Roving tabindex
  useRovingTabIndex?: boolean;
  initialFocus?: number;
  
  // Arrow key handlers
  horizontal?: boolean;
  vertical?: boolean;
  
  // Custom handlers
  onEnter?: (activeIndex: number) => void;
  onSpace?: (activeIndex: number) => void;
  onHome?: () => void;
  onEnd?: () => void;
  
  // Accessibility announcements
  announceNavigation?: boolean;
  itemLabelGetter?: (element: HTMLElement, index: number) => string;
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const {
    focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    containerRef,
    loop = true,
    skipDisabled = true,
    escapeHandler,
    useRovingTabIndex = false,
    initialFocus = 0,
    horizontal = false,
    vertical = true,
    onEnter,
    onSpace,
    onHome,
    onEnd,
    announceNavigation = false,
    itemLabelGetter
  } = options;

  const { announceToScreenReader } = useAccessibility();
  const currentFocusIndex = useRef<number>(initialFocus);
  const elementsRef = useRef<HTMLElement[]>([]);

  // Get focusable elements
  const getFocusableElements = useCallback(() => {
    const container = containerRef?.current || document;
    const elements = Array.from(container.querySelectorAll(focusableSelector)) as HTMLElement[];
    
    if (skipDisabled) {
      return elements.filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-disabled'));
    }
    
    return elements;
  }, [focusableSelector, containerRef, skipDisabled]);

  // Update roving tabindex
  const updateRovingTabIndex = useCallback((activeIndex: number) => {
    if (!useRovingTabIndex) return;
    
    elementsRef.current.forEach((element, index) => {
      element.setAttribute('tabindex', index === activeIndex ? '0' : '-1');
    });
  }, [useRovingTabIndex]);

  // Focus element at index
  const focusElementAtIndex = useCallback((index: number, announce = false) => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;
    
    const targetIndex = loop 
      ? ((index % elements.length) + elements.length) % elements.length
      : Math.max(0, Math.min(index, elements.length - 1));
    
    const targetElement = elements[targetIndex];
    if (targetElement) {
      targetElement.focus();
      currentFocusIndex.current = targetIndex;
      updateRovingTabIndex(targetIndex);
      
      if (announce && announceNavigation && itemLabelGetter) {
        const label = itemLabelGetter(targetElement, targetIndex);
        announceToScreenReader(`${label}, ${targetIndex + 1} of ${elements.length}`, 'polite');
      }
    }
  }, [getFocusableElements, loop, updateRovingTabIndex, announceNavigation, itemLabelGetter, announceToScreenReader]);

  // Navigate to next element
  const focusNext = useCallback((announce = false) => {
    focusElementAtIndex(currentFocusIndex.current + 1, announce);
  }, [focusElementAtIndex]);

  // Navigate to previous element
  const focusPrevious = useCallback((announce = false) => {
    focusElementAtIndex(currentFocusIndex.current - 1, announce);
  }, [focusElementAtIndex]);

  // Navigate to first element
  const focusFirst = useCallback((announce = false) => {
    focusElementAtIndex(0, announce);
  }, [focusElementAtIndex]);

  // Navigate to last element
  const focusLast = useCallback((announce = false) => {
    const elements = getFocusableElements();
    focusElementAtIndex(elements.length - 1, announce);
  }, [focusElementAtIndex, getFocusableElements]);

  // Keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key, target } = event;
    const elements = getFocusableElements();
    
    if (elements.length === 0) return;
    
    // Update current focus index based on actually focused element
    const activeElement = target as HTMLElement;
    const activeIndex = elements.indexOf(activeElement);
    if (activeIndex !== -1) {
      currentFocusIndex.current = activeIndex;
    }

    handleKeyboardNavigation(event, {
      onEscape: escapeHandler,
      onEnter: onEnter ? () => onEnter(currentFocusIndex.current) : undefined,
      onSpace: onSpace ? () => onSpace(currentFocusIndex.current) : undefined,
      onArrowUp: vertical ? () => {
        event.preventDefault();
        focusPrevious(true);
      } : undefined,
      onArrowDown: vertical ? () => {
        event.preventDefault();
        focusNext(true);
      } : undefined,
      onArrowLeft: horizontal ? () => {
        event.preventDefault();
        focusPrevious(true);
      } : undefined,
      onArrowRight: horizontal ? () => {
        event.preventDefault();
        focusNext(true);
      } : undefined,
      onHome: () => {
        event.preventDefault();
        if (onHome) {
          onHome();
        } else {
          focusFirst(true);
        }
      },
      onEnd: () => {
        event.preventDefault();
        if (onEnd) {
          onEnd();
        } else {
          focusLast(true);
        }
      },
      preventDefault: false
    });
  }, [
    getFocusableElements,
    escapeHandler,
    onEnter,
    onSpace,
    onHome,
    onEnd,
    vertical,
    horizontal,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast
  ]);

  // Initialize and cleanup
  useEffect(() => {
    const container = containerRef?.current || document;
    const elements = getFocusableElements();
    elementsRef.current = elements;
    
    // Setup roving tabindex
    if (useRovingTabIndex && elements.length > 0) {
      updateRovingTabIndex(initialFocus);
    }
    
    container.addEventListener('keydown', handleKeyDown);
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, containerRef, getFocusableElements, updateRovingTabIndex, useRovingTabIndex, initialFocus]);

  // Update elements when DOM changes
  useEffect(() => {
    const updateElements = () => {
      elementsRef.current = getFocusableElements();
    };
    
    const container = containerRef?.current || document;
    const observer = new MutationObserver(updateElements);
    
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled', 'tabindex']
    });
    
    return () => observer.disconnect();
  }, [getFocusableElements, containerRef]);

  return {
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    focusElementAtIndex,
    currentFocusIndex: currentFocusIndex.current,
    elementsCount: elementsRef.current.length
  };
}

// Hook for focus trap (useful for modals and dialogs)
export function useFocusTrap(isActive: boolean, containerRef: React.RefObject<HTMLElement>) {
  const { announceToScreenReader } = useAccessibility();

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const cleanup = FocusManager.trapFocus(container);
    
    // Announce focus trap activation
    announceToScreenReader('Focus trapped in dialog', 'assertive');
    
    return () => {
      cleanup();
      announceToScreenReader('Focus trap released', 'polite');
    };
  }, [isActive, containerRef, announceToScreenReader]);
}

// Hook for managing focus restoration
export function useFocusRestore() {
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    previouslyFocusedElement.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previouslyFocusedElement.current && previouslyFocusedElement.current.focus) {
      previouslyFocusedElement.current.focus();
      previouslyFocusedElement.current = null;
    }
  }, []);

  return { saveFocus, restoreFocus };
}

// Hook for keyboard shortcuts
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { key, ctrlKey, altKey, shiftKey, metaKey } = event;
      
      // Build shortcut key string
      const modifiers = [];
      if (ctrlKey) modifiers.push('ctrl');
      if (altKey) modifiers.push('alt');
      if (shiftKey) modifiers.push('shift');
      if (metaKey) modifiers.push('meta');
      
      const shortcutKey = [...modifiers, key.toLowerCase()].join('+');
      
      if (shortcuts[shortcutKey]) {
        event.preventDefault();
        shortcuts[shortcutKey]();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

export default useKeyboardNavigation;