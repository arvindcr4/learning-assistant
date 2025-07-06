import React from 'react';
import { cn } from '@/utils';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function Layout({ children, className }: LayoutProps) {
  return (
    <div className={cn('min-h-screen bg-background', className)}>
      {children}
    </div>
  );
}

export function Header({ children, className }: LayoutProps) {
  return (
    <header className={cn('border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60', className)}>
      <div className="container mx-auto px-4 py-4">
        {children}
      </div>
    </header>
  );
}

export function Main({ children, className }: LayoutProps) {
  return (
    <main className={cn('flex-1 container mx-auto px-4 py-8', className)}>
      {children}
    </main>
  );
}

export function Sidebar({ children, className }: LayoutProps) {
  return (
    <aside className={cn('w-64 bg-muted/30 border-r min-h-screen', className)}>
      <div className="p-4">
        {children}
      </div>
    </aside>
  );
}

export function Footer({ children, className }: LayoutProps) {
  return (
    <footer className={cn('border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60', className)}>
      <div className="container mx-auto px-4 py-4">
        {children}
      </div>
    </footer>
  );
}