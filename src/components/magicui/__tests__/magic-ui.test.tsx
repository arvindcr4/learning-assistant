import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AnimatedList, AnimatedListItem } from '../animated-list';
import { BentoGrid, BentoGridItem } from '../bento-grid';
import BlurFade from '../blur-fade';
import Marquee from '../marquee';
import ShimmerButton from '../shimmer-button';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Magic UI Components', () => {
  describe('AnimatedList', () => {
    it('renders children correctly', () => {
      render(
        <AnimatedList>
          <div>Item 1</div>
          <div>Item 2</div>
        </AnimatedList>
      );
      
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  describe('BentoGrid', () => {
    it('renders grid layout correctly', () => {
      render(
        <BentoGrid data-testid="bento-grid">
          <BentoGridItem
            title="Test Item"
            description="Test Description"
          />
        </BentoGrid>
      );
      
      expect(screen.getByTestId('bento-grid')).toBeInTheDocument();
      expect(screen.getByText('Test Item')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
    });
  });

  describe('BlurFade', () => {
    it('renders content with blur fade effect', () => {
      render(
        <BlurFade>
          <div>Blur Fade Content</div>
        </BlurFade>
      );
      
      expect(screen.getByText('Blur Fade Content')).toBeInTheDocument();
    });
  });

  describe('Marquee', () => {
    it('renders marquee content', () => {
      render(
        <Marquee>
          <div>Scrolling Content</div>
        </Marquee>
      );
      
      expect(screen.getByText('Scrolling Content')).toBeInTheDocument();
    });
  });

  describe('ShimmerButton', () => {
    it('renders button with shimmer effect', () => {
      render(
        <ShimmerButton>
          Click me
        </ShimmerButton>
      );
      
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });
  });
});