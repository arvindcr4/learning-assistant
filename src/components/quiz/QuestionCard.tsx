import React from 'react';
import { 
  Clock, 
  HelpCircle, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Lightbulb,
  Flag,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

import { cn } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { Progress } from '@/components/ui/Progress';
import type { Question } from '@/types';

export interface QuestionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer?: string | number;
  onAnswerSelect?: (answer: string | number) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onFlag?: () => void;
  onShowHint?: () => void;
  showCorrectAnswer?: boolean;
  showExplanation?: boolean;
  timeRemaining?: number;
  isFlagged?: boolean;
  isAnswered?: boolean;
  isCorrect?: boolean;
  disabled?: boolean;
  variant?: 'quiz' | 'review' | 'practice';
}

const QuestionCard = React.forwardRef<HTMLDivElement, QuestionCardProps>(
  ({ 
    className, 
    question, 
    questionNumber, 
    totalQuestions, 
    selectedAnswer,
    onAnswerSelect,
    onNext,
    onPrevious,
    onFlag,
    onShowHint,
    showCorrectAnswer = false,
    showExplanation = false,
    timeRemaining,
    isFlagged = false,
    isAnswered = false,
    isCorrect,
    disabled = false,
    variant = 'quiz',
    ...props 
  }, ref) => {
    const [shortAnswer, setShortAnswer] = React.useState('');
    const [showHint, setShowHint] = React.useState(false);

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAnswerChange = (answer: string | number) => {
      if (disabled) return;
      
      if (question.type === 'short-answer') {
        setShortAnswer(answer as string);
        onAnswerSelect?.(answer);
      } else {
        onAnswerSelect?.(answer);
      }
    };

    const getAnswerStatus = (option: string, index: number) => {
      if (!showCorrectAnswer) return 'default';
      
      const isSelected = selectedAnswer === option || selectedAnswer === index;
      const isCorrect = question.correctAnswer === option || question.correctAnswer === index;
      
      if (isSelected && isCorrect) return 'correct';
      if (isSelected && !isCorrect) return 'incorrect';
      if (!isSelected && isCorrect) return 'correct-not-selected';
      return 'default';
    };

    const getOptionClasses = (status: string) => {
      switch (status) {
        case 'correct':
          return 'border-learning-secondary bg-learning-secondary/10 text-learning-secondary';
        case 'incorrect':
          return 'border-destructive bg-destructive/10 text-destructive';
        case 'correct-not-selected':
          return 'border-learning-secondary bg-learning-secondary/5 text-learning-secondary';
        default:
          return 'border-input hover:border-ring hover:bg-accent/50';
      }
    };

    const renderQuestionContent = () => {
      switch (question.type) {
        case 'multiple-choice':
          return (
            <div className="space-y-3">
              {question.options?.map((option, index) => {
                const status = getAnswerStatus(option, index);
                const isSelected = selectedAnswer === option || selectedAnswer === index;
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerChange(option)}
                    disabled={disabled}
                    className={cn(
                      "w-full p-4 text-left rounded-lg border-2 transition-all duration-200",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      getOptionClasses(status),
                      isSelected && !showCorrectAnswer && "border-learning-primary bg-learning-primary/10"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                        isSelected && !showCorrectAnswer && "border-learning-primary bg-learning-primary text-white",
                        status === 'correct' && "border-learning-secondary bg-learning-secondary text-white",
                        status === 'incorrect' && "border-destructive bg-destructive text-white",
                        status === 'correct-not-selected' && "border-learning-secondary bg-learning-secondary text-white",
                        status === 'default' && "border-muted-foreground"
                      )}>
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="flex-1">{option}</span>
                      {showCorrectAnswer && (
                        <div className="flex items-center space-x-1">
                          {status === 'correct' && <CheckCircle className="h-4 w-4 text-learning-secondary" />}
                          {status === 'incorrect' && <XCircle className="h-4 w-4 text-destructive" />}
                          {status === 'correct-not-selected' && <CheckCircle className="h-4 w-4 text-learning-secondary" />}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );

        case 'true-false':
          return (
            <div className="space-y-3">
              {['True', 'False'].map((option, index) => {
                const status = getAnswerStatus(option, index);
                const isSelected = selectedAnswer === option || selectedAnswer === index;
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerChange(option)}
                    disabled={disabled}
                    className={cn(
                      "w-full p-4 text-left rounded-lg border-2 transition-all duration-200",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      getOptionClasses(status),
                      isSelected && !showCorrectAnswer && "border-learning-primary bg-learning-primary/10"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                        isSelected && !showCorrectAnswer && "border-learning-primary bg-learning-primary text-white",
                        status === 'correct' && "border-learning-secondary bg-learning-secondary text-white",
                        status === 'incorrect' && "border-destructive bg-destructive text-white",
                        status === 'correct-not-selected' && "border-learning-secondary bg-learning-secondary text-white",
                        status === 'default' && "border-muted-foreground"
                      )}>
                        {option === 'True' ? 'T' : 'F'}
                      </div>
                      <span className="flex-1 font-medium">{option}</span>
                      {showCorrectAnswer && (
                        <div className="flex items-center space-x-1">
                          {status === 'correct' && <CheckCircle className="h-4 w-4 text-learning-secondary" />}
                          {status === 'incorrect' && <XCircle className="h-4 w-4 text-destructive" />}
                          {status === 'correct-not-selected' && <CheckCircle className="h-4 w-4 text-learning-secondary" />}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );

        case 'short-answer':
          return (
            <div className="space-y-3">
              <Textarea
                placeholder="Enter your answer here..."
                value={shortAnswer}
                onChange={(e) => handleAnswerChange(e.target.value)}
                disabled={disabled}
                className="min-h-[120px]"
                maxLength={500}
                showCharCount
              />
              {showCorrectAnswer && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Correct Answer:</p>
                  <p className="text-sm">{question.correctAnswer}</p>
                </div>
              )}
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <Card ref={ref} className={cn("w-full max-w-4xl mx-auto", className)} {...props}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Badge variant="outline">
                Question {questionNumber} of {totalQuestions}
              </Badge>
              <Badge variant="outline">
                {question.points} {question.points === 1 ? 'point' : 'points'}
              </Badge>
              {isFlagged && (
                <Badge variant="warning">
                  <Flag className="h-3 w-3 mr-1" />
                  Flagged
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {timeRemaining !== undefined && (
                <div className="flex items-center space-x-1 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className={cn(
                    "font-medium",
                    timeRemaining < 300 && "text-destructive", // Less than 5 minutes
                    timeRemaining < 60 && "text-destructive animate-pulse" // Less than 1 minute
                  )}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              )}
              {onFlag && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onFlag}
                  className={cn(isFlagged && "text-warning")}
                >
                  <Flag className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <Progress
            value={questionNumber}
            max={totalQuestions}
            variant="learning"
            size="sm"
            className="mt-2"
          />
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Question */}
          <div className="space-y-4">
            <CardTitle className="text-lg leading-relaxed">
              {question.text}
            </CardTitle>
            
            {/* Answer Options */}
            {renderQuestionContent()}
          </div>

          {/* Hint */}
          {showHint && question.explanation && (
            <div className="p-4 bg-learning-primary/5 border border-learning-primary/20 rounded-lg">
              <div className="flex items-start space-x-2">
                <Lightbulb className="h-5 w-5 text-learning-primary mt-0.5" />
                <div>
                  <p className="font-medium text-learning-primary mb-1">Hint:</p>
                  <p className="text-sm text-muted-foreground">{question.explanation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Explanation */}
          {showExplanation && question.explanation && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start space-x-2">
                <HelpCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground mb-1">Explanation:</p>
                  <p className="text-sm text-muted-foreground">{question.explanation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Answer Status */}
          {showCorrectAnswer && isCorrect !== undefined && (
            <div className={cn(
              "p-4 rounded-lg border",
              isCorrect 
                ? "bg-learning-secondary/10 border-learning-secondary/20 text-learning-secondary" 
                : "bg-destructive/10 border-destructive/20 text-destructive"
            )}>
              <div className="flex items-center space-x-2">
                {isCorrect ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <span className="font-medium">
                  {isCorrect ? 'Correct!' : 'Incorrect'}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              {onPrevious && (
                <Button variant="outline" onClick={onPrevious} disabled={questionNumber === 1}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              )}
              {onShowHint && !showHint && (
                <Button variant="ghost" onClick={() => setShowHint(true)}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Show Hint
                </Button>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {variant === 'quiz' && !isAnswered && (
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              )}
              {onNext && (
                <Button 
                  onClick={onNext} 
                  disabled={!isAnswered && variant === 'quiz'}
                >
                  {questionNumber === totalQuestions ? 'Finish' : 'Next'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

QuestionCard.displayName = 'QuestionCard';

export { QuestionCard };