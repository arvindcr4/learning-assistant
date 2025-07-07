import React from 'react';
import { 
  Clock, 
  Target, 
  CheckCircle, 
  XCircle, 
  PlayCircle, 
  RotateCcw,
  Trophy,
  Star,
  Users,
  TrendingUp
} from 'lucide-react';

import { cn } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import type { Quiz } from '@/types';

export interface QuizCardProps extends React.HTMLAttributes<HTMLDivElement> {
  quiz: Quiz;
  progress?: {
    completed: boolean;
    score?: number;
    attempts: number;
    bestScore?: number;
    timeSpent?: number;
  };
  onStart?: () => void;
  onRetry?: () => void;
  onViewResults?: () => void;
  variant?: 'default' | 'compact' | 'detailed';
  showProgress?: boolean;
}

const QuizCard = React.memo(React.forwardRef<HTMLDivElement, QuizCardProps>(
  ({ 
    className, 
    quiz, 
    progress, 
    onStart, 
    onRetry, 
    onViewResults,
    variant = 'default',
    showProgress = true,
    ...props 
  }, ref) => {
    const formatTime = (minutes: number) => {
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) return `${hours}h`;
      return `${hours}h ${remainingMinutes}m`;
    };

    const getScoreColor = (score: number) => {
      if (score >= 90) return 'text-learning-secondary';
      if (score >= 70) return 'text-learning-accent';
      return 'text-destructive';
    };

    const getScoreBadge = (score: number) => {
      if (score >= 90) return 'success';
      if (score >= 70) return 'warning';
      return 'destructive';
    };

    const isPassed = progress?.score !== undefined && progress.score >= quiz.passingScore;

    if (variant === 'compact') {
      return (
        <Card ref={ref} className={cn("w-full", className)} {...props}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{quiz.title}</h3>
                <div className="flex items-center space-x-4 mt-1">
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Target className="h-3 w-3" />
                    <span>{quiz.questions.length} questions</span>
                  </div>
                  {quiz.timeLimit && (
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(quiz.timeLimit)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {progress?.completed && progress.score !== undefined && (
                  <Badge variant={getScoreBadge(progress.score)}>
                    {progress.score}%
                  </Badge>
                )}
                {progress?.completed ? (
                  <Button size="sm" variant="outline" onClick={onViewResults}>
                    View Results
                  </Button>
                ) : (
                  <Button size="sm" onClick={onStart}>
                    Start
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card ref={ref} className={cn("w-full", className)} {...props}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{quiz.title}</CardTitle>
              <CardDescription className="mt-1">
                {quiz.description}
              </CardDescription>
            </div>
            {progress?.completed && (
              <div className="flex items-center space-x-2">
                {isPassed ? (
                  <CheckCircle className="h-5 w-5 text-learning-secondary" data-testid="check-circle" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" data-testid="x-circle" />
                )}
                {progress.score !== undefined && (
                  <Badge variant={getScoreBadge(progress.score)}>
                    {progress.score}%
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Quiz Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Questions:</span>
                <span className="font-medium">{quiz.questions.length}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Pass Score:</span>
                <span className="font-medium">{quiz.passingScore}%</span>
              </div>
            </div>
            <div className="space-y-2">
              {quiz.timeLimit && (
                <div className="flex items-center space-x-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Time Limit:</span>
                  <span className="font-medium">{formatTime(quiz.timeLimit)}</span>
                </div>
              )}
              {progress?.attempts !== undefined && (
                <div className="flex items-center space-x-2 text-sm">
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Attempts:</span>
                  <span className="font-medium">{progress.attempts}</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress Section */}
          {showProgress && progress && (
            <div className="space-y-3">
              {progress.completed && progress.score !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Your Score</span>
                    <span className={cn("text-sm font-bold", getScoreColor(progress.score))}>
                      {progress.score}%
                    </span>
                  </div>
                  <Progress
                    value={progress.score}
                    max={100}
                    variant="learning"
                    size="sm"
                    label={`Quiz score: ${progress.score} out of 100 percent`}
                    showPercentage={false}
                  />
                </div>
              )}

              {progress.bestScore !== undefined && progress.bestScore !== progress.score && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Best Score:</span>
                  <span className={cn("font-medium", getScoreColor(progress.bestScore))}>
                    {progress.bestScore}%
                  </span>
                </div>
              )}

              {progress.timeSpent !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Time Spent:</span>
                  <span className="font-medium">{formatTime(progress.timeSpent)}</span>
                </div>
              )}
            </div>
          )}

          {/* Detailed Stats for detailed variant */}
          {variant === 'detailed' && (
            <div className="space-y-3 pt-3 border-t">
              <h4 className="text-sm font-medium">Question Breakdown</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Multiple Choice:</span>
                    <span>{quiz.questions.filter(q => q.type === 'multiple-choice').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">True/False:</span>
                    <span>{quiz.questions.filter(q => q.type === 'true-false').length}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Short Answer:</span>
                    <span>{quiz.questions.filter(q => q.type === 'short-answer').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Points:</span>
                    <span>{quiz.questions.reduce((sum, q) => sum + q.points, 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            {!progress?.completed ? (
              <Button onClick={onStart} className="flex-1">
                <PlayCircle className="h-4 w-4 mr-2" />
                Start Quiz
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={onViewResults} className="flex-1">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Results
                </Button>
                <Button onClick={onRetry} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
));

QuizCard.displayName = 'QuizCard';

export { QuizCard };