import React from 'react';
import { 
  BookOpen, 
  Clock, 
  Star, 
  PlayCircle, 
  CheckCircle,
  Eye,
  Headphones,
  Type,
  Activity,
  Users,
  TrendingUp,
  Target,
  Calendar
} from 'lucide-react';

import { cn } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Avatar } from '@/components/ui/Avatar';
import type { LearningModule, LearningStyleType, ContentFormat } from '@/types';

export interface ContentCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'content'> {
  content: LearningModule;
  progress?: {
    completed: boolean;
    score?: number;
    timeSpent: number;
    lastAccessed?: Date;
  };
  onStart?: () => void;
  onContinue?: () => void;
  onComplete?: () => void;
  variant?: 'default' | 'compact' | 'detailed' | 'grid';
  showProgress?: boolean;
  adaptedFor?: LearningStyleType;
  recommendationScore?: number;
}

const ContentCard = React.memo(React.forwardRef<HTMLDivElement, ContentCardProps>(
  ({ 
    className, 
    content, 
    progress, 
    onStart, 
    onContinue, 
    onComplete,
    variant = 'default',
    showProgress = true,
    adaptedFor,
    recommendationScore,
    ...props 
  }, ref) => {
    const formatDuration = (minutes: number) => {
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) return `${hours}h`;
      return `${hours}h ${remainingMinutes}m`;
    };

    const getContentTypeIcon = (type: string) => {
      switch (type) {
        case 'video':
          return <PlayCircle className="h-4 w-4" />;
        case 'reading':
          return <BookOpen className="h-4 w-4" />;
        case 'interactive':
          return <Activity className="h-4 w-4" />;
        case 'quiz':
          return <Target className="h-4 w-4" />;
        default:
          return <BookOpen className="h-4 w-4" />;
      }
    };

    const getLearningStyleIcon = (style: LearningStyleType) => {
      switch (style) {
        case LearningStyleType.VISUAL:
          return <Eye className="h-3 w-3" />;
        case LearningStyleType.AUDITORY:
          return <Headphones className="h-3 w-3" />;
        case LearningStyleType.READING:
          return <Type className="h-3 w-3" />;
        case LearningStyleType.KINESTHETIC:
          return <Activity className="h-3 w-3" />;
        default:
          return <BookOpen className="h-3 w-3" />;
      }
    };

    const getLearningStyleVariant = (style: LearningStyleType) => {
      switch (style) {
        case LearningStyleType.VISUAL:
          return 'visual';
        case LearningStyleType.AUDITORY:
          return 'auditory';
        case LearningStyleType.READING:
          return 'reading';
        case LearningStyleType.KINESTHETIC:
          return 'kinesthetic';
        default:
          return 'default';
      }
    };

    const getRecommendationBadge = (score: number) => {
      if (score >= 90) return { text: 'Highly Recommended', variant: 'success' as const };
      if (score >= 70) return { text: 'Recommended', variant: 'info' as const };
      if (score >= 50) return { text: 'Good Match', variant: 'warning' as const };
      return { text: 'Optional', variant: 'outline' as const };
    };

    if (variant === 'compact') {
      return (
        <Card ref={ref} className={cn("w-full", className)} {...props}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {getContentTypeIcon(content.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{content.title}</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatDuration(content.duration)}</span>
                  </div>
                  {progress?.completed && (
                    <CheckCircle className="h-3 w-3 text-learning-secondary" />
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant={progress?.completed ? "outline" : "default"}
                onClick={progress?.completed ? onContinue : onStart}
              >
                {progress?.completed ? 'Review' : 'Start'}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (variant === 'grid') {
      return (
        <Card ref={ref} className={cn("w-full h-full", className)} {...props}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                {getContentTypeIcon(content.type)}
                <Badge variant="outline" className="text-xs">
                  {content.type}
                </Badge>
              </div>
              {progress?.completed && (
                <CheckCircle className="h-4 w-4 text-learning-secondary" />
              )}
            </div>
            <CardTitle className="text-base line-clamp-2">{content.title}</CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              {content.description}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{formatDuration(content.duration)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Star className="h-3 w-3 fill-current" />
                <span>4.8</span>
              </div>
            </div>

            {showProgress && progress && (
              <Progress
                value={progress.completed ? 100 : (progress.timeSpent / content.duration) * 100}
                max={100}
                variant="learning"
                size="sm"
              />
            )}

            <Button 
              size="sm" 
              className="w-full"
              onClick={progress?.completed ? onContinue : onStart}
            >
              {progress?.completed ? 'Review' : 'Start Learning'}
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card ref={ref} className={cn("w-full", className)} {...props}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-2">
                {getContentTypeIcon(content.type)}
                <Badge variant="outline">
                  {content.type}
                </Badge>
                {adaptedFor && (
                  <Badge variant={getLearningStyleVariant(adaptedFor)}>
                    {getLearningStyleIcon(adaptedFor)}
                    <span className="ml-1 capitalize">{adaptedFor}</span>
                  </Badge>
                )}
                {recommendationScore !== undefined && (
                  <Badge variant={getRecommendationBadge(recommendationScore).variant}>
                    {getRecommendationBadge(recommendationScore).text}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg">{content.title}</CardTitle>
              <CardDescription>{content.description}</CardDescription>
            </div>
            {progress?.completed && (
              <CheckCircle className="h-6 w-6 text-learning-secondary" />
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Content Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-medium">{formatDuration(content.duration)}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Order:</span>
              <span className="font-medium">#{content.order}</span>
            </div>
            {variant === 'detailed' && (
              <>
                <div className="flex items-center space-x-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Enrolled:</span>
                  <span className="font-medium">1,234</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Rating:</span>
                  <span className="font-medium">4.8/5</span>
                </div>
              </>
            )}
          </div>

          {/* Progress Section */}
          {showProgress && progress && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Progress</span>
                <span className="text-muted-foreground">
                  {progress.completed ? '100%' : `${Math.round((progress.timeSpent / content.duration) * 100)}%`}
                </span>
              </div>
              <Progress
                value={progress.completed ? 100 : (progress.timeSpent / content.duration) * 100}
                max={100}
                variant="learning"
                size="sm"
              />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Time Spent:</span>
                  <p className="font-medium">{formatDuration(progress.timeSpent)}</p>
                </div>
                {progress.lastAccessed && (
                  <div>
                    <span className="text-muted-foreground">Last Accessed:</span>
                    <p className="font-medium">
                      {new Date(progress.lastAccessed).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {progress.score !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Score:</span>
                  <Badge variant={progress.score >= 80 ? 'success' : progress.score >= 60 ? 'warning' : 'destructive'}>
                    {progress.score}%
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Resources */}
          {variant === 'detailed' && content.resources.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Resources</h4>
              <div className="grid grid-cols-1 gap-2">
                {content.resources.slice(0, 3).map((resource, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    <BookOpen className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground truncate">{resource.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {resource.type}
                    </Badge>
                  </div>
                ))}
                {content.resources.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{content.resources.length - 3} more resources
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            {!progress?.completed ? (
              <Button onClick={onStart} className="flex-1">
                <PlayCircle className="h-4 w-4 mr-2" />
                Start Learning
              </Button>
            ) : (
              <>
                <Button onClick={onContinue} variant="outline" className="flex-1">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Review
                </Button>
                {progress.score !== undefined && progress.score < 80 && (
                  <Button onClick={onStart} variant="outline">
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Retake
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
));

ContentCard.displayName = 'ContentCard';

export { ContentCard };