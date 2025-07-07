import React from 'react';
import { cn } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { 
  X, 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare, 
  Send,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Target,
  Clock,
  Trophy
} from 'lucide-react';

export interface FeedbackModalProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSubmit'> {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackData) => void;
  type: 'lesson' | 'quiz' | 'general' | 'performance';
  title: string;
  description?: string;
  contentData?: {
    score?: number;
    timeSpent?: number;
    completionRate?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
  };
  showRating?: boolean;
  showDifficulty?: boolean;
  showSuggestions?: boolean;
  customQuestions?: Array<{
    id: string;
    question: string;
    type: 'text' | 'rating' | 'boolean';
    required?: boolean;
  }>;
}

export interface FeedbackData {
  rating?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  helpful?: boolean;
  comments: string;
  improvements?: string;
  wouldRecommend?: boolean;
  customResponses?: Record<string, any>;
}

const FeedbackModal = React.forwardRef<HTMLDivElement, FeedbackModalProps>(
  ({ 
    className, 
    isOpen, 
    onClose, 
    onSubmit,
    type,
    title,
    description,
    contentData,
    showRating = true,
    showDifficulty = true,
    showSuggestions = true,
    customQuestions = [],
    ...props 
  }, ref) => {
    const [rating, setRating] = React.useState<number>(0);
    const [difficulty, setDifficulty] = React.useState<'easy' | 'medium' | 'hard' | ''>('');
    const [helpful, setHelpful] = React.useState<boolean | null>(null);
    const [comments, setComments] = React.useState('');
    const [improvements, setImprovements] = React.useState('');
    const [wouldRecommend, setWouldRecommend] = React.useState<boolean | null>(null);
    const [customResponses, setCustomResponses] = React.useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleOverlayClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    };

    const handleSubmit = async () => {
      setIsSubmitting(true);
      
      const feedbackData: FeedbackData = {
        rating: showRating ? rating : undefined,
        difficulty: showDifficulty ? (difficulty as 'easy' | 'medium' | 'hard') : undefined,
        helpful,
        comments,
        improvements: showSuggestions ? improvements : undefined,
        wouldRecommend,
        customResponses: Object.keys(customResponses).length > 0 ? customResponses : undefined,
      };

      try {
        await onSubmit(feedbackData);
        onClose();
        resetForm();
      } catch (error) {
        console.error('Failed to submit feedback:', error);
      } finally {
        setIsSubmitting(false);
      }
    };

    const resetForm = () => {
      setRating(0);
      setDifficulty('');
      setHelpful(null);
      setComments('');
      setImprovements('');
      setWouldRecommend(null);
      setCustomResponses({});
    };

    const isFormValid = () => {
      if (showRating && rating === 0) return false;
      if (comments.trim().length === 0) return false;
      
      // Check required custom questions
      const requiredQuestions = customQuestions.filter(q => q.required);
      return requiredQuestions.every(q => 
        customResponses[q.id] !== undefined && 
        customResponses[q.id] !== '' && 
        customResponses[q.id] !== null
      );
    };

    const handleCustomResponse = (questionId: string, value: any) => {
      setCustomResponses(prev => ({
        ...prev,
        [questionId]: value
      }));
    };

    const getDifficultyColor = (diff: string) => {
      switch (diff) {
        case 'easy': return 'text-learning-secondary';
        case 'medium': return 'text-learning-accent';
        case 'hard': return 'text-destructive';
        default: return 'text-muted-foreground';
      }
    };

    if (!isOpen) return null;

    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={handleOverlayClick}
      >
        <Card 
          ref={ref} 
          className={cn("w-full max-w-2xl max-h-[90vh] overflow-y-auto", className)} 
          {...props}
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5 text-learning-primary" />
                  <span>{title}</span>
                </CardTitle>
                {description && (
                  <CardDescription>{description}</CardDescription>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content Performance Summary */}
            {contentData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-lg">
                {contentData.score !== undefined && (
                  <div className="text-center">
                    <Trophy className="h-4 w-4 mx-auto text-learning-primary mb-1" />
                    <p className="text-sm font-medium">{contentData.score}%</p>
                    <p className="text-xs text-muted-foreground">Score</p>
                  </div>
                )}
                {contentData.timeSpent !== undefined && (
                  <div className="text-center">
                    <Clock className="h-4 w-4 mx-auto text-learning-primary mb-1" />
                    <p className="text-sm font-medium">{Math.round(contentData.timeSpent)}m</p>
                    <p className="text-xs text-muted-foreground">Time</p>
                  </div>
                )}
                {contentData.completionRate !== undefined && (
                  <div className="text-center">
                    <Target className="h-4 w-4 mx-auto text-learning-primary mb-1" />
                    <p className="text-sm font-medium">{contentData.completionRate}%</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                )}
                {contentData.difficulty && (
                  <div className="text-center">
                    <TrendingUp className="h-4 w-4 mx-auto text-learning-primary mb-1" />
                    <p className={cn("text-sm font-medium capitalize", getDifficultyColor(contentData.difficulty))}>
                      {contentData.difficulty}
                    </p>
                    <p className="text-xs text-muted-foreground">Difficulty</p>
                  </div>
                )}
              </div>
            )}
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Rating */}
            {showRating && (
              <div className="space-y-3">
                <label className="text-sm font-medium">How would you rate this content?</label>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={cn(
                        "p-1 rounded transition-colors",
                        star <= rating ? "text-learning-accent" : "text-muted-foreground hover:text-learning-accent"
                      )}
                    >
                      <Star className={cn("h-6 w-6", star <= rating && "fill-current")} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {rating > 0 && `${rating} star${rating !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
            )}

            {/* Difficulty */}
            {showDifficulty && (
              <div className="space-y-3">
                <label className="text-sm font-medium">How was the difficulty level?</label>
                <div className="flex space-x-2">
                  {[
                    { value: 'easy', label: 'Too Easy', color: 'learning-secondary' },
                    { value: 'medium', label: 'Just Right', color: 'learning-accent' },
                    { value: 'hard', label: 'Too Hard', color: 'destructive' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDifficulty(option.value as 'easy' | 'medium' | 'hard')}
                      className={cn(
                        "px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors",
                        difficulty === option.value
                          ? `border-${option.color} bg-${option.color}/10 text-${option.color}`
                          : "border-input hover:border-ring"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Helpfulness */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Was this content helpful?</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setHelpful(true)}
                  className={cn(
                    "flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-colors",
                    helpful === true
                      ? "border-learning-secondary bg-learning-secondary/10 text-learning-secondary"
                      : "border-input hover:border-ring"
                  )}
                >
                  <ThumbsUp className="h-4 w-4" />
                  <span>Yes</span>
                </button>
                <button
                  onClick={() => setHelpful(false)}
                  className={cn(
                    "flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-colors",
                    helpful === false
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-input hover:border-ring"
                  )}
                >
                  <ThumbsDown className="h-4 w-4" />
                  <span>No</span>
                </button>
              </div>
            </div>

            {/* Comments */}
            <div className="space-y-3">
              <Textarea
                label="Your feedback *"
                placeholder="Tell us about your experience with this content..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                maxLength={500}
                showCharCount
                helpText="Help us improve by sharing your thoughts, what worked well, or what could be better."
              />
            </div>

            {/* Suggestions */}
            {showSuggestions && (
              <div className="space-y-3">
                <Textarea
                  label="Suggestions for improvement"
                  placeholder="How can we make this content better?"
                  value={improvements}
                  onChange={(e) => setImprovements(e.target.value)}
                  maxLength={300}
                  showCharCount
                />
              </div>
            )}

            {/* Recommendation */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Would you recommend this to other learners?</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setWouldRecommend(true)}
                  className={cn(
                    "px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors",
                    wouldRecommend === true
                      ? "border-learning-secondary bg-learning-secondary/10 text-learning-secondary"
                      : "border-input hover:border-ring"
                  )}
                >
                  Yes
                </button>
                <button
                  onClick={() => setWouldRecommend(false)}
                  className={cn(
                    "px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors",
                    wouldRecommend === false
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-input hover:border-ring"
                  )}
                >
                  No
                </button>
              </div>
            </div>

            {/* Custom Questions */}
            {customQuestions.map((question) => (
              <div key={question.id} className="space-y-3">
                <label className="text-sm font-medium">
                  {question.question}
                  {question.required && <span className="text-destructive ml-1">*</span>}
                </label>
                
                {question.type === 'text' && (
                  <Textarea
                    placeholder="Your answer..."
                    value={customResponses[question.id] || ''}
                    onChange={(e) => handleCustomResponse(question.id, e.target.value)}
                    maxLength={300}
                  />
                )}
                
                {question.type === 'rating' && (
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleCustomResponse(question.id, star)}
                        className={cn(
                          "p-1 rounded transition-colors",
                          star <= (customResponses[question.id] || 0) 
                            ? "text-learning-accent" 
                            : "text-muted-foreground hover:text-learning-accent"
                        )}
                      >
                        <Star className={cn("h-5 w-5", star <= (customResponses[question.id] || 0) && "fill-current")} />
                      </button>
                    ))}
                  </div>
                )}
                
                {question.type === 'boolean' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleCustomResponse(question.id, true)}
                      className={cn(
                        "px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors",
                        customResponses[question.id] === true
                          ? "border-learning-secondary bg-learning-secondary/10 text-learning-secondary"
                          : "border-input hover:border-ring"
                      )}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleCustomResponse(question.id, false)}
                      className={cn(
                        "px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors",
                        customResponses[question.id] === false
                          ? "border-destructive bg-destructive/10 text-destructive"
                          : "border-input hover:border-ring"
                      )}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Submit Button */}
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Your feedback helps us improve the learning experience
              </p>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={!isFormValid() || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-b-transparent mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
);

FeedbackModal.displayName = 'FeedbackModal';

export { FeedbackModal };