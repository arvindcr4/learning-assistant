'use client';

import React from 'react';
import { 
  Home, 
  BookOpen, 
  TrendingUp, 
  Settings, 
  HelpCircle, 
  LogOut,
  Menu,
  X,
  MessageSquare,
  Calendar,
  Trophy,
  Target,
  Bell
} from 'lucide-react';

import { cn } from '@/utils';
import { Header, Main, Sidebar } from '@/components/layout/Layout';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { User } from '@/types';

export interface DashboardLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  user: User;
  currentPath?: string;
  onNavigate?: (path: string) => void;
  onLogout?: () => void;
  notifications?: number;
  children: React.ReactNode;
}

const DashboardLayout = React.forwardRef<HTMLDivElement, DashboardLayoutProps>(
  ({ className, user, currentPath = '/', onNavigate, onLogout, notifications = 0, children, ...props }, ref) => {
    const [sidebarOpen, setSidebarOpen] = React.useState(false);

    const navigationItems = [
      { 
        path: '/dashboard', 
        icon: Home, 
        label: 'Dashboard',
        description: 'Overview and progress'
      },
      { 
        path: '/learning', 
        icon: BookOpen, 
        label: 'Learning Paths',
        description: 'Your learning content'
      },
      { 
        path: '/progress', 
        icon: TrendingUp, 
        label: 'Progress',
        description: 'Analytics and insights'
      },
      { 
        path: '/schedule', 
        icon: Calendar, 
        label: 'Schedule',
        description: 'Study planning'
      },
      { 
        path: '/achievements', 
        icon: Trophy, 
        label: 'Achievements',
        description: 'Badges and milestones'
      },
      { 
        path: '/goals', 
        icon: Target, 
        label: 'Goals',
        description: 'Learning objectives'
      },
      { 
        path: '/chat', 
        icon: MessageSquare, 
        label: 'AI Assistant',
        description: 'Get help and guidance'
      },
    ];

    const secondaryItems = [
      { 
        path: '/settings', 
        icon: Settings, 
        label: 'Settings',
        description: 'Account and preferences'
      },
      { 
        path: '/help', 
        icon: HelpCircle, 
        label: 'Help & Support',
        description: 'Get assistance'
      },
    ];

    const handleNavigation = (path: string) => {
      onNavigate?.(path);
      setSidebarOpen(false);
    };

    const isActivePath = (path: string) => {
      return currentPath === path || currentPath.startsWith(path + '/');
    };

    const NavItem = ({ item, isActive }: { item: typeof navigationItems[0]; isActive: boolean }) => (
      <button
        onClick={() => handleNavigation(item.path)}
        className={cn(
          "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive && "bg-learning-primary text-white hover:bg-learning-primary/90"
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.label}</p>
          <p className="text-xs opacity-75 truncate">{item.description}</p>
        </div>
      </button>
    );

    return (
      <div ref={ref} className={cn("flex h-screen bg-background", className)} {...props}>
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex flex-col h-full">
            {/* Sidebar header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-learning-primary rounded-lg flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Learning Assistant</h2>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* User info */}
            <div className="p-4 border-b">
              <div className="flex items-center space-x-3">
                <Avatar
                  src={user.avatar}
                  alt={user.name}
                  fallback={user.name}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {user.preferences.difficultyLevel}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {user.learningProfile.dominantStyle}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              <div className="space-y-1">
                {navigationItems.map((item) => (
                  <NavItem
                    key={item.path}
                    item={item}
                    isActive={isActivePath(item.path)}
                  />
                ))}
              </div>

              <div className="pt-4 mt-4 border-t space-y-1">
                {secondaryItems.map((item) => (
                  <NavItem
                    key={item.path}
                    item={item}
                    isActive={isActivePath(item.path)}
                  />
                ))}
              </div>
            </nav>

            {/* Logout */}
            <div className="p-4 border-t">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header className="shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-xl font-semibold">Welcome back, {user.name.split(' ')[0]}</h1>
                  <p className="text-sm text-muted-foreground">
                    Continue your learning journey
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="h-4 w-4" />
                  {notifications > 0 && (
                    <span className="absolute -top-1 -right-1 bg-learning-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {notifications > 9 ? '9+' : notifications}
                    </span>
                  )}
                </Button>
                <div className="h-6 w-px bg-border" />
                <Avatar
                  src={user.avatar}
                  alt={user.name}
                  fallback={user.name}
                  size="sm"
                />
              </div>
            </div>
          </Header>

          {/* Main content area */}
          <Main className="flex-1 overflow-y-auto">
            {children}
          </Main>
        </div>
      </div>
    );
  }
);

DashboardLayout.displayName = 'DashboardLayout';

export { DashboardLayout };