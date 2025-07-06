import React from 'react';
import { cn } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  Lightbulb,
  Target,
  Trophy,
  Move
} from 'lucide-react';

export interface DragDropItem {
  id: string;
  content: string;
  category?: string;
  description?: string;
  image?: string;
}

export interface DropZone {
  id: string;
  label: string;
  description?: string;
  acceptedCategories?: string[];
  maxItems?: number;
}

export interface DragDropActivityProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  instructions: string;
  items: DragDropItem[];
  dropZones: DropZone[];
  correctAnswers: Record<string, string[]>; // dropZoneId -> itemIds
  onComplete?: (isCorrect: boolean, userAnswers: Record<string, string[]>) => void;
  onReset?: () => void;
  showHints?: boolean;
  maxAttempts?: number;
  feedback?: {
    correct: string;
    incorrect: string;
    partial: string;
  };
}

const DragDropActivity = React.forwardRef<HTMLDivElement, DragDropActivityProps>(
  ({ 
    className, 
    title, 
    description, 
    instructions,
    items,
    dropZones,
    correctAnswers,
    onComplete,
    onReset,
    showHints = true,
    maxAttempts = 3,
    feedback = {
      correct: "Excellent! All items are correctly placed.",
      incorrect: "Some items need to be moved. Try again!",
      partial: "You're on the right track! Check the highlighted items."
    },
    ...props 
  }, ref) => {
    const [draggedItem, setDraggedItem] = React.useState<string | null>(null);
    const [droppedItems, setDroppedItems] = React.useState<Record<string, string[]>>({});
    const [isComplete, setIsComplete] = React.useState(false);
    const [showResults, setShowResults] = React.useState(false);
    const [attempts, setAttempts] = React.useState(0);
    const [score, setScore] = React.useState(0);
    const [itemFeedback, setItemFeedback] = React.useState<Record<string, 'correct' | 'incorrect' | 'neutral'>>({});

    // Initialize drop zones
    React.useEffect(() => {
      const initialDropped: Record<string, string[]> = {};
      dropZones.forEach(zone => {
        initialDropped[zone.id] = [];
      });
      setDroppedItems(initialDropped);
    }, [dropZones]);

    const handleDragStart = (e: React.DragEvent, itemId: string) => {
      setDraggedItem(itemId);
      e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, dropZoneId: string) => {
      e.preventDefault();
      
      if (!draggedItem) return;

      const dropZone = dropZones.find(zone => zone.id === dropZoneId);
      if (!dropZone) return;

      // Check if drop zone has capacity
      if (dropZone.maxItems && droppedItems[dropZoneId].length >= dropZone.maxItems) {
        return;
      }

      // Check if item category is accepted
      const item = items.find(i => i.id === draggedItem);
      if (item && dropZone.acceptedCategories && !dropZone.acceptedCategories.includes(item.category || '')) {
        return;
      }

      // Remove item from previous location
      const newDroppedItems = { ...droppedItems };
      Object.keys(newDroppedItems).forEach(zoneId => {
        newDroppedItems[zoneId] = newDroppedItems[zoneId].filter(id => id !== draggedItem);
      });

      // Add item to new location
      newDroppedItems[dropZoneId] = [...newDroppedItems[dropZoneId], draggedItem];
      
      setDroppedItems(newDroppedItems);
      setDraggedItem(null);
    };

    const removeItemFromZone = (itemId: string, zoneId: string) => {
      const newDroppedItems = { ...droppedItems };
      newDroppedItems[zoneId] = newDroppedItems[zoneId].filter(id => id !== itemId);
      setDroppedItems(newDroppedItems);
    };

    const checkAnswers = () => {
      if (attempts >= maxAttempts) return;

      let correctCount = 0;
      let totalItems = 0;
      const newItemFeedback: Record<string, 'correct' | 'incorrect' | 'neutral'> = {};

      // Check each drop zone
      Object.entries(correctAnswers).forEach(([zoneId, correctItemIds]) => {
        const userItems = droppedItems[zoneId] || [];
        
        correctItemIds.forEach(itemId => {
          totalItems++;
          if (userItems.includes(itemId)) {
            correctCount++;
            newItemFeedback[itemId] = 'correct';
          } else {
            newItemFeedback[itemId] = 'incorrect';
          }
        });

        // Mark incorrectly placed items
        userItems.forEach(itemId => {
          if (!correctItemIds.includes(itemId)) {
            newItemFeedback[itemId] = 'incorrect';
          }
        });
      });

      const scorePercentage = Math.round((correctCount / totalItems) * 100);
      const isCorrect = correctCount === totalItems;

      setScore(scorePercentage);
      setItemFeedback(newItemFeedback);
      setShowResults(true);
      setAttempts(prev => prev + 1);

      if (isCorrect) {
        setIsComplete(true);
      }

      onComplete?.(isCorrect, droppedItems);
    };

    const resetActivity = () => {
      const resetDropped: Record<string, string[]> = {};
      dropZones.forEach(zone => {
        resetDropped[zone.id] = [];
      });
      
      setDroppedItems(resetDropped);
      setIsComplete(false);
      setShowResults(false);
      setAttempts(0);
      setScore(0);
      setItemFeedback({});
      setDraggedItem(null);
      onReset?.();
    };

    const getItemsNotInZones = () => {
      const itemsInZones = new Set(Object.values(droppedItems).flat());
      return items.filter(item => !itemsInZones.has(item.id));
    };

    const getItemStatusClass = (itemId: string) => {
      const status = itemFeedback[itemId];
      switch (status) {
        case 'correct':
          return 'border-learning-secondary bg-learning-secondary/10';
        case 'incorrect':
          return 'border-destructive bg-destructive/10';
        default:
          return 'border-input hover:border-ring';
      }
    };

    const getFeedbackMessage = () => {
      if (score === 100) return feedback.correct;
      if (score > 0) return feedback.partial;
      return feedback.incorrect;
    };

    return (
      <Card ref={ref} className={cn("w-full", className)} {...props}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Move className="h-5 w-5 text-learning-primary" />
                <span>{title}</span>
              </CardTitle>
              {description && (
                <CardDescription className="mt-1">{description}</CardDescription>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                Attempt {attempts + 1}/{maxAttempts}
              </Badge>
              {showResults && (
                <Badge variant={score === 100 ? 'success' : score > 0 ? 'warning' : 'destructive'}>
                  {score}%
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Instructions */}
          <div className="p-3 bg-learning-primary/5 rounded-lg border border-learning-primary/20">
            <p className="text-sm text-learning-primary font-medium">
              {instructions}
            </p>
          </div>

          {/* Results Feedback */}
          {showResults && (
            <div className={cn(
              "p-4 rounded-lg border",
              score === 100 
                ? "bg-learning-secondary/10 border-learning-secondary/20 text-learning-secondary"
                : score > 0 
                ? "bg-learning-accent/10 border-learning-accent/20 text-learning-accent"
                : "bg-destructive/10 border-destructive/20 text-destructive"
            )}>
              <div className="flex items-center space-x-2">
                {score === 100 ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <span className="font-medium">{getFeedbackMessage()}</span>
              </div>
            </div>
          )}

          {/* Drop Zones */}
          <div className="space-y-4">
            <h3 className="font-medium">Drop Zones</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dropZones.map((zone) => (
                <div
                  key={zone.id}
                  className={cn(
                    "min-h-32 p-4 border-2 border-dashed rounded-lg transition-colors",
                    draggedItem && "border-learning-primary bg-learning-primary/5",
                    !draggedItem && "border-muted-foreground"
                  )}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, zone.id)}
                >
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">{zone.label}</h4>
                    {zone.description && (
                      <p className="text-xs text-muted-foreground">{zone.description}</p>
                    )}
                    
                    {/* Items in this zone */}
                    <div className="space-y-2">
                      {droppedItems[zone.id]?.map((itemId) => {
                        const item = items.find(i => i.id === itemId);
                        if (!item) return null;
                        
                        return (
                          <div
                            key={itemId}
                            className={cn(
                              "p-2 rounded border bg-background cursor-move transition-colors",
                              getItemStatusClass(itemId)
                            )}
                            draggable
                            onDragStart={(e) => handleDragStart(e, itemId)}
                            onClick={() => removeItemFromZone(itemId, zone.id)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm">{item.content}</span>
                              {showResults && itemFeedback[itemId] && (
                                <div className="flex-shrink-0 ml-2">
                                  {itemFeedback[itemId] === 'correct' ? (
                                    <CheckCircle className="h-4 w-4 text-learning-secondary" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {droppedItems[zone.id]?.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">
                        Drag items here
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Available Items */}
          {getItemsNotInZones().length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Available Items</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {getItemsNotInZones().map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "p-3 rounded-lg border cursor-move transition-all duration-200",
                      "hover:shadow-md hover:scale-105",
                      getItemStatusClass(item.id),
                      draggedItem === item.id && "opacity-50"
                    )}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.content}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                      {item.category && (
                        <Badge variant="outline" className="text-xs">
                          {item.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              {showHints && (
                <Button variant="ghost" size="sm">
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Show Hint
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={resetActivity}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              {isComplete && (
                <Badge variant="success">
                  <Trophy className="h-3 w-3 mr-1" />
                  Completed!
                </Badge>
              )}
              <Button 
                onClick={checkAnswers}
                disabled={isComplete || attempts >= maxAttempts || getItemsNotInZones().length > 0}
              >
                <Target className="h-4 w-4 mr-2" />
                Check Answers
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

DragDropActivity.displayName = 'DragDropActivity';

export { DragDropActivity };