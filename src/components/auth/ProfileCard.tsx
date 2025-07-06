import React from 'react';
import { cn } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { 
  Settings, 
  Trophy, 
  Clock, 
  BookOpen, 
  Target,
  Calendar,
  TrendingUp,
  User
} from 'lucide-react';
import { User as UserType, LearningStyleType } from '@/types';

export interface ProfileCardProps extends React.HTMLAttributes<HTMLDivElement> {
  user: UserType;
  stats?: {
    totalStudyTime: number;
    completedModules: number;
    currentStreak: number;
    level: number;
    experience: number;
    nextLevelExperience: number;
  };
  onEdit?: () => void;
  onViewProgress?: () => void;
  compact?: boolean;
}

const ProfileCard = React.forwardRef<HTMLDivElement, ProfileCardProps>(
  ({ className, user, stats, onEdit, onViewProgress, compact = false, ...props }, ref) => {
    const formatStudyTime = (minutes: number) => {
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) return `${hours}h`;
      return `${hours}h ${remainingMinutes}m`;
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

    const getDifficultyVariant = (difficulty: string) => {
      switch (difficulty) {
        case 'beginner':
          return 'beginner';
        case 'intermediate':
          return 'intermediate';
        case 'advanced':
          return 'advanced';
        default:
          return 'default';
      }
    };

    if (compact) {
      return (
        <div ref={ref} className={cn("flex items-center space-x-3", className)} {...props}>
          <Avatar
            src={user.avatar}
            alt={user.name}
            fallback={user.name}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      );
    }

    return (
      <Card ref={ref} className={cn("w-full", className)} {...props}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar
                src={user.avatar}
                alt={user.name}
                fallback={user.name}
                size="lg"
              />
              <div>
                <CardTitle className="text-xl">{user.name}</CardTitle>
                <CardDescription className="text-base">
                  {user.email}
                </CardDescription>
              </div>
            </div>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Settings className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Learning Profile */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Learning Profile</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant={getStyleVariant(user.learningProfile.dominantStyle)}>
                {user.learningProfile.dominantStyle.charAt(0).toUpperCase() + user.learningProfile.dominantStyle.slice(1)} Learner
              </Badge>
              <Badge variant={getDifficultyVariant(user.preferences.difficultyLevel)}>
                {user.preferences.difficultyLevel.charAt(0).toUpperCase() + user.preferences.difficultyLevel.slice(1)}
              </Badge>
              {user.learningProfile.isMultimodal && (
                <Badge variant="info">
                  Multimodal
                </Badge>
              )}
            </div>
          </div>

          {/* Learning Goals */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Learning Goals</h4>
            <div className="flex flex-wrap gap-2">
              {user.preferences.learningGoals.slice(0, 3).map((goal, index) => (
                <Badge key={index} variant="outline">
                  <Target className="h-3 w-3 mr-1" />
                  {goal}
                </Badge>
              ))}
              {user.preferences.learningGoals.length > 3 && (
                <Badge variant="outline">
                  +{user.preferences.learningGoals.length - 3} more
                </Badge>
              )}
            </div>
          </div>

          {/* Study Schedule */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Study Schedule</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{user.preferences.studySchedule.dailyGoal} min/day</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{user.preferences.studySchedule.daysPerWeek} days/week</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">Progress</h4>
                {onViewProgress && (
                  <Button variant="ghost" size="sm" onClick={onViewProgress}>
                    <TrendingUp className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{formatStudyTime(stats.totalStudyTime)}</p>
                    <p className="text-xs text-muted-foreground">Total study time</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{stats.completedModules}</p>
                    <p className="text-xs text-muted-foreground">Modules completed</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{stats.currentStreak} days</p>
                    <p className="text-xs text-muted-foreground">Current streak</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Level {stats.level}</p>
                    <p className="text-xs text-muted-foreground">Current level</p>
                  </div>
                </div>
              </div>

              {/* Level Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Level {stats.level}</span>
                  <span>Level {stats.level + 1}</span>
                </div>
                <Progress
                  value={stats.experience}
                  max={stats.nextLevelExperience}
                  variant="learning"
                  size="sm"
                />
                <p className="text-xs text-muted-foreground text-center">
                  {stats.experience} / {stats.nextLevelExperience} XP
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

ProfileCard.displayName = 'ProfileCard';

export { ProfileCard };