/**
 * Comprehensive accessibility utility functions for WCAG 2.2 AA compliance
 */

export interface AccessibilityOptions {
  role?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaExpanded?: boolean;
  ariaSelected?: boolean;
  ariaChecked?: boolean;
  ariaDisabled?: boolean;
  ariaHidden?: boolean;
  ariaInvalid?: boolean;
  ariaRequired?: boolean;
  ariaLive?: 'polite' | 'assertive' | 'off';
  tabIndex?: number;
  focusable?: boolean;
}

/**
 * Generate ARIA attributes for accessibility
 */
export function generateAriaAttributes(options: AccessibilityOptions): Record<string, any> {
  const attributes: Record<string, any> = {};

  if (options.role) attributes.role = options.role;
  if (options.ariaLabel) attributes['aria-label'] = options.ariaLabel;
  if (options.ariaLabelledBy) attributes['aria-labelledby'] = options.ariaLabelledBy;
  if (options.ariaDescribedBy) attributes['aria-describedby'] = options.ariaDescribedBy;
  if (options.ariaExpanded !== undefined) attributes['aria-expanded'] = options.ariaExpanded;
  if (options.ariaSelected !== undefined) attributes['aria-selected'] = options.ariaSelected;
  if (options.ariaChecked !== undefined) attributes['aria-checked'] = options.ariaChecked;
  if (options.ariaDisabled !== undefined) attributes['aria-disabled'] = options.ariaDisabled;
  if (options.ariaHidden !== undefined) attributes['aria-hidden'] = options.ariaHidden;
  if (options.ariaInvalid !== undefined) attributes['aria-invalid'] = options.ariaInvalid;
  if (options.ariaRequired !== undefined) attributes['aria-required'] = options.ariaRequired;
  if (options.ariaLive) attributes['aria-live'] = options.ariaLive;
  if (options.tabIndex !== undefined) attributes.tabIndex = options.tabIndex;

  return attributes;
}

/**
 * Check if color contrast meets WCAG AA standards
 */
export function checkColorContrast(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): { ratio: number; passes: boolean } {
  const getLuminance = (color: string): number => {
    const rgb = hexToRgb(color);
    if (!rgb) return 0;

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const foregroundLuminance = getLuminance(foreground);
  const backgroundLuminance = getLuminance(background);

  const ratio = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
                (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);

  const requiredRatio = isLargeText ? 3 : 4.5;
  const passes = ratio >= requiredRatio;

  return { ratio, passes };
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Generate unique ID for accessibility purposes
 */
export function generateAccessibilityId(prefix: string = 'a11y'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Keyboard navigation handler
 */
export interface KeyboardNavigationOptions {
  onEnter?: () => void;
  onSpace?: () => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  onTab?: () => void;
  preventDefault?: boolean;
}

export function handleKeyboardNavigation(
  event: KeyboardEvent,
  options: KeyboardNavigationOptions
): void {
  const { key, shiftKey } = event;

  switch (key) {
    case 'Enter':
      if (options.onEnter) {
        if (options.preventDefault) event.preventDefault();
        options.onEnter();
      }
      break;
    case ' ':
      if (options.onSpace) {
        if (options.preventDefault) event.preventDefault();
        options.onSpace();
      }
      break;
    case 'Escape':
      if (options.onEscape) {
        if (options.preventDefault) event.preventDefault();
        options.onEscape();
      }
      break;
    case 'ArrowUp':
      if (options.onArrowUp) {
        if (options.preventDefault) event.preventDefault();
        options.onArrowUp();
      }
      break;
    case 'ArrowDown':
      if (options.onArrowDown) {
        if (options.preventDefault) event.preventDefault();
        options.onArrowDown();
      }
      break;
    case 'ArrowLeft':
      if (options.onArrowLeft) {
        if (options.preventDefault) event.preventDefault();
        options.onArrowLeft();
      }
      break;
    case 'ArrowRight':
      if (options.onArrowRight) {
        if (options.preventDefault) event.preventDefault();
        options.onArrowRight();
      }
      break;
    case 'Home':
      if (options.onHome) {
        if (options.preventDefault) event.preventDefault();
        options.onHome();
      }
      break;
    case 'End':
      if (options.onEnd) {
        if (options.preventDefault) event.preventDefault();
        options.onEnd();
      }
      break;
    case 'Tab':
      if (options.onTab) {
        if (options.preventDefault) event.preventDefault();
        options.onTab();
      }
      break;
  }
}

/**
 * Focus management utilities
 */
export class FocusManager {
  private static focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    'audio[controls]',
    'video[controls]',
    'details',
    'iframe'
  ].join(', ');

  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(this.focusableSelectors));
  }

  static getFirstFocusableElement(container: HTMLElement): HTMLElement | null {
    const focusableElements = this.getFocusableElements(container);
    return focusableElements.length > 0 ? focusableElements[0] : null;
  }

  static getLastFocusableElement(container: HTMLElement): HTMLElement | null {
    const focusableElements = this.getFocusableElements(container);
    return focusableElements.length > 0 ? focusableElements[focusableElements.length - 1] : null;
  }

  static trapFocus(container: HTMLElement): () => void {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return () => {};

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    
    // Focus the first element
    firstElement.focus();

    return () => {
      document.removeEventListener('keydown', handleTabKey);
    };
  }

  static restoreFocus(element: HTMLElement | null): void {
    if (element && element.focus) {
      element.focus();
    }
  }
}

/**
 * Screen reader utilities
 */
export class ScreenReaderUtils {
  private static announceRegion: HTMLElement | null = null;

  static announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.announceRegion) {
      this.announceRegion = document.createElement('div');
      this.announceRegion.setAttribute('aria-live', 'polite');
      this.announceRegion.setAttribute('aria-atomic', 'true');
      this.announceRegion.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(this.announceRegion);
    }

    this.announceRegion.setAttribute('aria-live', priority);
    this.announceRegion.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (this.announceRegion) {
        this.announceRegion.textContent = '';
      }
    }, 1000);
  }

  static describeElement(element: HTMLElement, description: string): void {
    const descriptionId = generateAccessibilityId('desc');
    
    // Create description element
    const descriptionElement = document.createElement('div');
    descriptionElement.id = descriptionId;
    descriptionElement.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    descriptionElement.textContent = description;
    
    document.body.appendChild(descriptionElement);
    element.setAttribute('aria-describedby', descriptionId);
  }
}

/**
 * Validate accessibility of an element
 */
export interface AccessibilityViolation {
  type: 'error' | 'warning';
  message: string;
  element: HTMLElement;
  wcagReference: string;
}

export function validateAccessibility(element: HTMLElement): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];

  // Check for missing alt text on images
  const images = element.querySelectorAll('img');
  images.forEach(img => {
    if (!img.hasAttribute('alt')) {
      violations.push({
        type: 'error',
        message: 'Image missing alt attribute',
        element: img,
        wcagReference: 'WCAG 1.1.1'
      });
    }
  });

  // Check for missing labels on form inputs
  const inputs = element.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    const hasLabel = input.hasAttribute('aria-label') || 
                    input.hasAttribute('aria-labelledby') ||
                    element.querySelector(`label[for="${input.id}"]`);
    
    if (!hasLabel) {
      violations.push({
        type: 'error',
        message: 'Form input missing label',
        element: input,
        wcagReference: 'WCAG 1.3.1'
      });
    }
  });

  // Check for missing heading hierarchy
  const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let previousLevel = 0;
  headings.forEach(heading => {
    const level = parseInt(heading.tagName.charAt(1));
    if (level > previousLevel + 1) {
      violations.push({
        type: 'warning',
        message: `Heading level ${level} skips level ${previousLevel + 1}`,
        element: heading,
        wcagReference: 'WCAG 1.3.1'
      });
    }
    previousLevel = level;
  });

  // Check for interactive elements without proper roles
  const buttons = element.querySelectorAll('[onclick], [onkeydown]');
  buttons.forEach(button => {
    if (!button.hasAttribute('role') && button.tagName.toLowerCase() !== 'button') {
      violations.push({
        type: 'warning',
        message: 'Interactive element should have button role',
        element: button,
        wcagReference: 'WCAG 4.1.2'
      });
    }
  });

  return violations;
}

/**
 * Color blind friendly palette utilities
 */
export const colorBlindFriendlyPalette = {
  // Safe colors for all types of color blindness
  blue: '#0173B2',
  orange: '#DE8F05',
  green: '#029E73',
  pink: '#CC78BC',
  brown: '#A0522D',
  purple: '#7B68EE',
  gray: '#666666',
  black: '#000000',
  white: '#FFFFFF'
};

/**
 * Generate color blind friendly alternatives
 */
export function getColorBlindFriendlyColor(intention: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'): string {
  switch (intention) {
    case 'primary':
      return colorBlindFriendlyPalette.blue;
    case 'secondary':
      return colorBlindFriendlyPalette.gray;
    case 'success':
      return colorBlindFriendlyPalette.green;
    case 'warning':
      return colorBlindFriendlyPalette.orange;
    case 'error':
      return colorBlindFriendlyPalette.pink;
    case 'info':
      return colorBlindFriendlyPalette.purple;
    default:
      return colorBlindFriendlyPalette.black;
  }
}

/**
 * Motion utilities for reduced motion preferences
 */
export function getMotionPreference(): 'no-preference' | 'reduce' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return mediaQuery.matches ? 'reduce' : 'no-preference';
  }
  return 'no-preference';
}

export function shouldReduceMotion(): boolean {
  return getMotionPreference() === 'reduce';
}

/**
 * Font size utilities for accessibility
 */
export function calculateAccessibleFontSize(baseFontSize: number, scale: number = 1): number {
  const minFontSize = 16; // WCAG minimum recommended
  const scaledSize = baseFontSize * scale;
  return Math.max(scaledSize, minFontSize);
}

/**
 * Skip link utilities
 */
export function createSkipLink(target: string, text: string = 'Skip to main content'): HTMLElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${target}`;
  skipLink.textContent = text;
  skipLink.className = 'skip-link';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 6px;
    background: #000;
    color: #fff;
    padding: 8px;
    text-decoration: none;
    transition: top 0.3s;
    z-index: 1000;
  `;
  
  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '6px';
  });
  
  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });
  
  return skipLink;
}

export default {
  generateAriaAttributes,
  checkColorContrast,
  generateAccessibilityId,
  handleKeyboardNavigation,
  FocusManager,
  ScreenReaderUtils,
  validateAccessibility,
  colorBlindFriendlyPalette,
  getColorBlindFriendlyColor,
  getMotionPreference,
  shouldReduceMotion,
  calculateAccessibleFontSize,
  createSkipLink
};