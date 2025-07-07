/**
 * Animation Configuration for Magic UI Components
 * Handles motion preferences, performance optimization, and accessibility
 */

// Animation duration constants
export const ANIMATION_DURATION = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  extra_slow: 0.8,
} as const;

// Easing curves for different animation types
export const EASING = {
  linear: 'linear',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  spring: [0.25, 0.46, 0.45, 0.94],
  bounce: [0.68, -0.55, 0.265, 1.55],
  anticipate: [0.175, 0.885, 0.32, 1.275],
} as const;

// Spring animation configurations
export const SPRING_CONFIG = {
  gentle: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
  },
  bouncy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 20,
  },
  stiff: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 40,
  },
  slow: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 25,
  },
} as const;

// Check if user prefers reduced motion
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Get appropriate animation duration based on user preferences
export const getAnimationDuration = (duration: keyof typeof ANIMATION_DURATION): number => {
  if (prefersReducedMotion()) return 0;
  return ANIMATION_DURATION[duration];
};

// Common animation variants for Magic UI components
export const fadeInUp = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: getAnimationDuration('normal'),
      ease: EASING.easeOut,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: getAnimationDuration('fast'),
      ease: EASING.easeIn,
    },
  },
};

export const fadeInDown = {
  initial: {
    opacity: 0,
    y: -20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: getAnimationDuration('normal'),
      ease: EASING.easeOut,
    },
  },
  exit: {
    opacity: 0,
    y: 20,
    transition: {
      duration: getAnimationDuration('fast'),
      ease: EASING.easeIn,
    },
  },
};

export const fadeIn = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: getAnimationDuration('normal'),
      ease: EASING.easeOut,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: getAnimationDuration('fast'),
      ease: EASING.easeIn,
    },
  },
};

export const scaleIn = {
  initial: {
    opacity: 0,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: getAnimationDuration('normal'),
      ease: EASING.easeOut,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: {
      duration: getAnimationDuration('fast'),
      ease: EASING.easeIn,
    },
  },
};

export const slideInLeft = {
  initial: {
    opacity: 0,
    x: -50,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: getAnimationDuration('normal'),
      ease: EASING.easeOut,
    },
  },
  exit: {
    opacity: 0,
    x: -50,
    transition: {
      duration: getAnimationDuration('fast'),
      ease: EASING.easeIn,
    },
  },
};

export const slideInRight = {
  initial: {
    opacity: 0,
    x: 50,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: getAnimationDuration('normal'),
      ease: EASING.easeOut,
    },
  },
  exit: {
    opacity: 0,
    x: 50,
    transition: {
      duration: getAnimationDuration('fast'),
      ease: EASING.easeIn,
    },
  },
};

// Learning-specific animations
export const progressGrow = {
  initial: {
    scaleX: 0,
  },
  animate: {
    scaleX: 1,
    transition: {
      duration: getAnimationDuration('slow'),
      ease: EASING.easeInOut,
    },
  },
};

export const achievementPop = {
  initial: {
    scale: 0,
    rotate: -180,
  },
  animate: {
    scale: 1,
    rotate: 0,
    transition: {
      ...SPRING_CONFIG.bouncy,
      duration: getAnimationDuration('slow'),
    },
  },
};

export const cardHover = {
  rest: {
    scale: 1,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  hover: {
    scale: 1.02,
    boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1)',
    transition: {
      duration: getAnimationDuration('fast'),
      ease: EASING.easeOut,
    },
  },
};

export const buttonPress = {
  whileTap: {
    scale: 0.98,
    transition: {
      duration: getAnimationDuration('fast'),
      ease: EASING.easeInOut,
    },
  },
};

// Stagger animations for lists
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export const staggerItem = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: getAnimationDuration('normal'),
      ease: EASING.easeOut,
    },
  },
};

// Utility function to create consistent page transitions
export const createPageTransition = (direction: 'up' | 'down' | 'left' | 'right' = 'up') => {
  const directions = {
    up: { initial: { y: 20 }, animate: { y: 0 }, exit: { y: -20 } },
    down: { initial: { y: -20 }, animate: { y: 0 }, exit: { y: 20 } },
    left: { initial: { x: 20 }, animate: { x: 0 }, exit: { x: -20 } },
    right: { initial: { x: -20 }, animate: { x: 0 }, exit: { x: 20 } },
  };

  return {
    initial: {
      opacity: 0,
      ...directions[direction].initial,
    },
    animate: {
      opacity: 1,
      ...directions[direction].animate,
      transition: {
        duration: getAnimationDuration('normal'),
        ease: EASING.easeOut,
      },
    },
    exit: {
      opacity: 0,
      ...directions[direction].exit,
      transition: {
        duration: getAnimationDuration('fast'),
        ease: EASING.easeIn,
      },
    },
  };
};

// Hook for managing animation preferences
export const useAnimationPreferences = () => {
  const [animationsEnabled, setAnimationsEnabled] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    
    // Check localStorage preference first
    const saved = localStorage.getItem('animations-enabled');
    if (saved !== null) return JSON.parse(saved);
    
    // Default to user's system preference
    return !prefersReducedMotion();
  });

  React.useEffect(() => {
    localStorage.setItem('animations-enabled', JSON.stringify(animationsEnabled));
  }, [animationsEnabled]);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('animations-enabled')) {
        setAnimationsEnabled(!e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return {
    animationsEnabled,
    setAnimationsEnabled,
    toggleAnimations: () => setAnimationsEnabled(!animationsEnabled),
  };
};

// Performance optimization utilities
export const reduceMotionForLowPerformance = () => {
  if (typeof window === 'undefined') return false;
  
  // Check for performance hints
  const connection = (navigator as any).connection;
  if (connection) {
    // Reduce animations on slow connections or low-end devices
    return connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
  }
  
  // Check device memory (if available)
  const memory = (navigator as any).deviceMemory;
  if (memory && memory < 4) {
    return true; // Reduce animations on devices with less than 4GB RAM
  }
  
  return false;
};

// Animation performance monitoring
export const trackAnimationPerformance = (animationName: string, duration: number) => {
  if (typeof window === 'undefined') return;
  
  // Use Performance API to track animation performance
  performance.mark(`${animationName}-start`);
  
  setTimeout(() => {
    performance.mark(`${animationName}-end`);
    performance.measure(animationName, `${animationName}-start`, `${animationName}-end`);
    
    const measure = performance.getEntriesByName(animationName)[0];
    if (measure && measure.duration > duration * 1000 * 1.5) {
      console.warn(`Animation "${animationName}" took longer than expected: ${measure.duration}ms`);
    }
  }, duration * 1000);
};

import React from 'react';