import React from 'react';
import { cn } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

export interface StatsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  change?: {
    value: number;
    label: string;
    trend: 'up' | 'down' | 'neutral';
  };
  progress?: {
    value: number;
    max: number;
    label?: string;
  };
  badge?: {
    text: string;
    variant?: 'default' | 'success' | 'warning' | 'info' | 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  };
  variant?: 'default' | 'gradient' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
  ({ 
    className, 
    title, 
    value, 
    description, 
    icon: Icon, 
    change, 
    progress, 
    badge,
    variant = 'default',
    size = 'md',
    ...props 
  }, ref) => {
    const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
      switch (trend) {
        case 'up':
          return <TrendingUp className="h-3 w-3" />;
        case 'down':
          return <TrendingDown className="h-3 w-3" />;
        case 'neutral':
          return <Minus className="h-3 w-3" />;
      }
    };

    const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
      switch (trend) {
        case 'up':
          return 'text-learning-secondary';
        case 'down':
          return 'text-destructive';
        case 'neutral':
          return 'text-muted-foreground';
      }
    };

    const sizeClasses = {
      sm: {
        card: 'p-3',
        title: 'text-sm',
        value: 'text-lg',
        icon: 'h-4 w-4',
        content: 'space-y-1'
      },
      md: {
        card: 'p-4',
        title: 'text-sm',
        value: 'text-2xl',
        icon: 'h-5 w-5',
        content: 'space-y-2'
      },
      lg: {
        card: 'p-6',
        title: 'text-base',
        value: 'text-3xl',
        icon: 'h-6 w-6',
        content: 'space-y-3'
      }
    };

    const cardClasses = cn(
      "transition-all duration-200 hover:shadow-md",
      variant === 'gradient' && "bg-gradient-to-r from-learning-primary to-learning-secondary text-white",
      variant === 'outline' && "border-2 border-learning-primary/20",
      className
    );

    const textClasses = variant === 'gradient' ? 'text-white' : 'text-foreground';
    const mutedTextClasses = variant === 'gradient' ? 'text-white/80' : 'text-muted-foreground';

    return (
      <Card ref={ref} className={cardClasses} {...props}>
        <CardContent className={cn(sizeClasses[size].card, sizeClasses[size].content)}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {Icon && (
                <Icon className={cn(sizeClasses[size].icon, mutedTextClasses)} />
              )}
              <CardTitle className={cn(sizeClasses[size].title, mutedTextClasses)}>
                {title}
              </CardTitle>
            </div>
            {badge && (
              <Badge 
                variant={badge.variant} 
                className={cn(
                  "text-xs",
                  variant === 'gradient' && "bg-white/20 text-white hover:bg-white/30"
                )}
              >
                {badge.text}
              </Badge>
            )}
          </div>

          {/* Value */}
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <p className={cn(sizeClasses[size].value, "font-bold", textClasses)}>
                {value}
              </p>
              {description && (
                <CardDescription className={cn(
                  "text-xs",
                  variant === 'gradient' ? 'text-white/70' : 'text-muted-foreground'
                )}>
                  {description}
                </CardDescription>
              )}
            </div>

            {/* Change indicator */}
            {change && (
              <div className={cn(
                "flex items-center space-x-1 text-xs",
                variant === 'gradient' 
                  ? change.trend === 'up' ? 'text-green-200' : change.trend === 'down' ? 'text-red-200' : 'text-white/70'
                  : getTrendColor(change.trend)
              )}>
                {getTrendIcon(change.trend)}
                <span className="font-medium">
                  {change.value > 0 ? '+' : ''}{change.value}
                </span>
                <span className="opacity-75">{change.label}</span>
              </div>
            )}
          </div>

          {/* Progress */}
          {progress && (
            <div className="space-y-1">
              <Progress
                value={progress.value}
                max={progress.max}
                label={progress.label}
                variant={variant === 'gradient' ? 'default' : 'learning'}
                size="sm"
                showPercentage={false}
                className={cn(
                  variant === 'gradient' && "[&>div]:bg-white/20 [&>div>div]:bg-white"
                )}
              />
              <div className="flex justify-between text-xs">
                <span className={mutedTextClasses}>
                  {progress.value} / {progress.max}
                </span>
                <span className={mutedTextClasses}>
                  {Math.round((progress.value / progress.max) * 100)}%
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

StatsCard.displayName = 'StatsCard';

export { StatsCard };