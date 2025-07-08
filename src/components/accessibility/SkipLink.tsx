'use client';

import React from 'react';
import { cn } from '@/utils';
import { useAccessibility } from '@/contexts/AccessibilityContext';

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  position?: 'top-left' | 'top-center' | 'top-right';
}

export const SkipLink: React.FC<SkipLinkProps> = ({ 
  href, 
  children, 
  className,
  position = 'top-left'
}) => {
  const { preferences } = useAccessibility();

  const positionClasses = {
    'top-left': 'left-4 top-4',
    'top-center': 'left-1/2 top-4 transform -translate-x-1/2',
    'top-right': 'right-4 top-4'
  };

  return (
    <a
      href={href}
      className={cn(
        // Base styles
        'sr-only focus:not-sr-only focus:absolute z-[9999] px-4 py-2 text-sm font-medium text-white bg-black rounded-md transition-all duration-200',
        // Position
        positionClasses[position],
        // Accessibility preferences
        preferences.largeText && 'text-base px-6 py-3',
        preferences.focusIndicators && 'focus:ring-4 focus:ring-blue-500 focus:ring-offset-2',
        preferences.highContrast && 'bg-black text-white border-2 border-white',
        // Custom classes
        className
      )}
      onFocus={(e) => {
        // Ensure the skip link is visible when focused
        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }}
    >
      {children}
    </a>
  );
};

interface SkipLinksProps {
  links: Array<{
    href: string;
    label: string;
  }>;
  className?: string;
}

export const SkipLinks: React.FC<SkipLinksProps> = ({ links, className }) => {
  return (
    <div className={cn('fixed top-0 left-0 z-[9999]', className)}>
      {links.map((link, index) => (
        <SkipLink 
          key={index} 
          href={link.href}
          position={index === 0 ? 'top-left' : 'top-center'}
          className={index > 0 ? 'mt-2' : ''}
        >
          {link.label}
        </SkipLink>
      ))}
    </div>
  );
};

export default SkipLink;