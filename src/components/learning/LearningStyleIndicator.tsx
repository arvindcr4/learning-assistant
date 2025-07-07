import React from 'react';
import { 
  Eye, 
  Headphones, 
  Type, 
  Activity,
  TrendingUp,
  Brain,
  Lightbulb,
  Target,
  Users
} from 'lucide-react';

import { cn } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { CircularProgress } from '@/components/ui/CircularProgress';
import type { LearningStyleType, LearningStyle, LearningProfile } from '@/types';

export interface LearningStyleIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  profile: LearningProfile;
  variant?: 'compact' | 'detailed' | 'circular' | 'horizontal';
  showConfidence?: boolean;
  showRecommendations?: boolean;
  onStyleSelect?: (style: LearningStyleType) => void;
}

const LearningStyleIndicator = React.forwardRef<HTMLDivElement, LearningStyleIndicatorProps>(
  ({ 
    className, 
    profile, 
    variant = 'detailed',
    showConfidence = true,
    showRecommendations = true,
    onStyleSelect,
    ...props 
  }, ref) => {
    const getStyleIcon = (style: LearningStyleType) => {
      switch (style) {
        case LearningStyleType.VISUAL:
          return <Eye className="h-5 w-5" />;
        case LearningStyleType.AUDITORY:
          return <Headphones className="h-5 w-5" />;
        case LearningStyleType.READING:
          return <Type className="h-5 w-5" />;
        case LearningStyleType.KINESTHETIC:
          return <Activity className="h-5 w-5" />;
        default:
          return <Brain className="h-5 w-5" />;
      }
    };

    const getStyleColor = (style: LearningStyleType) => {
      switch (style) {
        case LearningStyleType.VISUAL:
          return 'text-visual';
        case LearningStyleType.AUDITORY:
          return 'text-auditory';
        case LearningStyleType.READING:
          return 'text-reading';
        case LearningStyleType.KINESTHETIC:
          return 'text-kinesthetic';
        default:
          return 'text-foreground';
      }
    };

    const getStyleVariant = (style: LearningStyleType) => {
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

    const getStyleDescription = (style: LearningStyleType) => {
      switch (style) {
        case LearningStyleType.VISUAL:
          return 'Learn best through visual aids, diagrams, and imagery';
        case LearningStyleType.AUDITORY:
          return 'Learn best through listening, discussions, and audio content';
        case LearningStyleType.READING:
          return 'Learn best through reading and writing activities';
        case LearningStyleType.KINESTHETIC:
          return 'Learn best through hands-on activities and movement';
        default:
          return 'Balanced learning approach across multiple styles';
      }
    };

    const getRecommendations = (style: LearningStyleType) => {
      switch (style) {
        case LearningStyleType.VISUAL:
          return [
            'Use mind maps and diagrams',
            'Watch educational videos',
            'Create visual notes and charts',
            'Use color coding systems'
          ];
        case LearningStyleType.AUDITORY:
          return [
            'Listen to podcasts and lectures',
            'Participate in discussions',
            'Read content aloud',
            'Use music and mnemonics'
          ];
        case LearningStyleType.READING:
          return [
            'Take detailed written notes',
            'Read extensively on topics',
            'Write summaries and outlines',
            'Use text-based resources'
          ];
        case LearningStyleType.KINESTHETIC:
          return [
            'Use hands-on activities',
            'Take breaks during study',
            'Practice through simulations',
            'Use physical objects and models'
          ];
        default:
          return ['Combine multiple learning approaches'];
      }
    };

    const sortedStyles = [...profile.styles].sort((a, b) => b.score - a.score);
    const dominantStyle = sortedStyles[0];

    if (variant === 'compact') {
      return (
        <div ref={ref} className={cn("flex items-center space-x-2", className)} {...props}>
          <div className={cn("flex items-center space-x-1", getStyleColor(profile.dominantStyle))}>
            {getStyleIcon(profile.dominantStyle)}
            <span className="text-sm font-medium capitalize">
              {profile.dominantStyle}
            </span>
          </div>
          {profile.isMultimodal && (
            <Badge variant="outline" className="text-xs">
              Multimodal
            </Badge>
          )}
          {showConfidence && dominantStyle && (
            <Badge variant="outline" className="text-xs">
              {Math.round(dominantStyle.confidence * 100)}% confidence
            </Badge>
          )}
        </div>
      );
    }

    if (variant === 'circular') {
      return (
        <Card ref={ref} className={cn("w-full", className)} {...props}>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2">
              {getStyleIcon(profile.dominantStyle)}
              <span className="capitalize">{profile.dominantStyle} Learner</span>
            </CardTitle>
            <CardDescription>
              Your primary learning style
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <CircularProgress
              value={dominantStyle?.score || 0}
              max={100}
              size={120}
              variant={getStyleVariant(profile.dominantStyle)}
              label="Preference"
            />
          </CardContent>
        </Card>
      );
    }

    if (variant === 'horizontal') {
      return (
        <Card ref={ref} className={cn("w-full", className)} {...props}>
          <CardContent className="p-4">
            <div className="space-y-3">
              {sortedStyles.map((style) => (
                <div
                  key={style.type}
                  className={cn(
                    "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
                    "hover:bg-accent/50 cursor-pointer",
                    style.type === profile.dominantStyle && "bg-accent border-learning-primary"
                  )}
                  onClick={() => onStyleSelect?.(style.type)}
                >
                  <div className={getStyleColor(style.type)}>
                    {getStyleIcon(style.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{style.type}</span>
                      <span className="text-sm text-muted-foreground">{style.score}%</span>
                    </div>
                    <Progress
                      value={style.score}
                      max={100}
                      variant={getStyleVariant(style.type)}
                      size="sm"
                      showPercentage={false}
                    />
                  </div>
                  {style.type === profile.dominantStyle && (
                    <Badge variant="success" className="text-xs">
                      Primary
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Default detailed variant
    return (
      <Card ref={ref} className={cn("w-full", className)} {...props}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-learning-primary" />
                <span>Learning Style Profile</span>
              </CardTitle>
              <CardDescription>
                Your personalized learning preferences and recommendations
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {profile.isMultimodal && (
                <Badge variant="info">
                  <Users className="h-3 w-3 mr-1" />
                  Multimodal
                </Badge>
              )}
              <Badge variant="outline">
                <Target className="h-3 w-3 mr-1" />
                {Math.round(profile.adaptationLevel)}% Adapted
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Dominant Style */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center space-x-2">
              <div className={getStyleColor(profile.dominantStyle)}>
                {getStyleIcon(profile.dominantStyle)}
              </div>
              <span className="capitalize">{profile.dominantStyle} Learner</span>
              <Badge variant={getStyleVariant(profile.dominantStyle)}>
                Primary
              </Badge>
            </h3>
            <p className="text-muted-foreground">
              {getStyleDescription(profile.dominantStyle)}
            </p>
            
            {dominantStyle && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Preference Strength:</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <Progress
                      value={dominantStyle.score}
                      max={100}
                      variant={getStyleVariant(profile.dominantStyle)}
                      size="sm"
                      showPercentage={false}
                    />
                    <span className="text-sm font-medium">{dominantStyle.score}%</span>
                  </div>
                </div>
                {showConfidence && (
                  <div>
                    <span className="text-sm text-muted-foreground">Confidence Level:</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <Progress
                        value={dominantStyle.confidence * 100}
                        max={100}
                        variant="learning"
                        size="sm"
                        showPercentage={false}
                      />
                      <span className="text-sm font-medium">
                        {Math.round(dominantStyle.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* All Styles Breakdown */}
          <div className="space-y-3">
            <h4 className="font-medium">Style Distribution</h4>
            <div className="space-y-2">
              {sortedStyles.map((style) => (
                <div key={style.type} className="flex items-center space-x-3">
                  <div className={cn("w-8 flex justify-center", getStyleColor(style.type))}>
                    {getStyleIcon(style.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{style.type}</span>
                      <span className="text-muted-foreground">{style.score}%</span>
                    </div>
                    <Progress
                      value={style.score}
                      max={100}
                      variant={getStyleVariant(style.type)}
                      size="sm"
                      showPercentage={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {showRecommendations && (
            <div className="space-y-3">
              <h4 className="font-medium flex items-center space-x-2">
                <Lightbulb className="h-4 w-4 text-learning-accent" />
                <span>Learning Recommendations</span>
              </h4>
              <div className="space-y-2">
                {getRecommendations(profile.dominantStyle).map((recommendation, index) => (
                  <div key={index} className="flex items-start space-x-2 text-sm">
                    <div className="w-1 h-1 bg-learning-primary rounded-full mt-2 flex-shrink-0" />
                    <span className="text-muted-foreground">{recommendation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assessment Info */}
          <div className="pt-3 border-t space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last Assessment:</span>
              <span className="font-medium">
                {new Date(profile.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Data Points:</span>
              <span className="font-medium">{profile.behavioralIndicators.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Adaptation Level:</span>
              <div className="flex items-center space-x-2">
                <Progress
                  value={profile.adaptationLevel}
                  max={100}
                  variant="learning"
                  size="sm"
                  showPercentage={false}
                  className="w-16"
                />
                <span className="font-medium">{Math.round(profile.adaptationLevel)}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

LearningStyleIndicator.displayName = 'LearningStyleIndicator';

export { LearningStyleIndicator };