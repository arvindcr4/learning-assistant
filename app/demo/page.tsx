'use client';

import React from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  Button,
  Badge,
  Progress,
  CircularProgress,
  Avatar,
  StatsCard,
  ProgressChart,
  LoginForm,
  RegisterForm,
  ProfileCard,
  QuizCard,
  ContentCard,
  LearningStyleIndicator,
  Alert,
  ToastProvider,
  useToastHelpers
} from '@/components';
import { 
  BookOpen, 
  TrendingUp, 
  Users, 
  Clock,
  Trophy,
  Target,
  Star,
  CheckCircle
} from 'lucide-react';
import { User, LearningStyleType, Quiz, LearningModule, LearningProfile } from '@/types';

// Demo data
const demoUser: User = {
  id: '1',
  name: 'Alice Johnson',
  email: 'alice@example.com',
  avatar: '',
  preferences: {
    learningGoals: ['Web Development', 'Data Science', 'Machine Learning'],
    preferredTopics: ['JavaScript', 'Python', 'React'],
    difficultyLevel: 'intermediate',
    studySchedule: {
      dailyGoal: 60,
      preferredTimes: ['morning', 'evening'],
      daysPerWeek: 5
    },
    notifications: {
      email: true,
      push: false,
      reminders: true
    }
  },
  learningProfile: {
    id: '1',
    userId: '1',
    styles: [
      {
        type: LearningStyleType.VISUAL,
        score: 85,
        confidence: 0.9,
        lastUpdated: new Date()
      },
      {
        type: LearningStyleType.AUDITORY,
        score: 45,
        confidence: 0.7,
        lastUpdated: new Date()
      },
      {
        type: LearningStyleType.READING,
        score: 70,
        confidence: 0.8,
        lastUpdated: new Date()
      },
      {
        type: LearningStyleType.KINESTHETIC,
        score: 60,
        confidence: 0.6,
        lastUpdated: new Date()
      }
    ],
    dominantStyle: LearningStyleType.VISUAL,
    isMultimodal: true,
    assessmentHistory: [],
    behavioralIndicators: [],
    adaptationLevel: 75,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

const demoQuiz: Quiz = {
  id: '1',
  moduleId: '1',
  title: 'React Fundamentals Assessment',
  description: 'Test your understanding of React core concepts including components, props, and state management.',
  questions: [
    {
      id: '1',
      text: 'What is JSX?',
      type: 'multiple-choice',
      options: ['A JavaScript extension', 'A CSS framework', 'A database', 'A server'],
      correctAnswer: 0,
      explanation: 'JSX is a syntax extension for JavaScript',
      points: 10
    }
  ],
  timeLimit: 30,
  passingScore: 70
};

const demoContent: LearningModule = {
  id: '1',
  pathId: '1',
  title: 'Introduction to React Hooks',
  description: 'Learn how to use React Hooks to manage state and side effects in functional components.',
  content: 'React Hooks are functions that let you use state and other React features...',
  type: 'interactive',
  duration: 45,
  order: 1,
  completed: false,
  resources: [
    {
      id: '1',
      title: 'Official React Hooks Documentation',
      type: 'link',
      url: 'https://reactjs.org/docs/hooks-intro.html'
    }
  ]
};

const chartData = [
  { name: 'Mon', progress: 65, time: 45 },
  { name: 'Tue', progress: 75, time: 60 },
  { name: 'Wed', progress: 55, time: 30 },
  { name: 'Thu', progress: 85, time: 75 },
  { name: 'Fri', progress: 95, time: 90 },
  { name: 'Sat', progress: 70, time: 50 },
  { name: 'Sun', progress: 80, time: 65 }
];

const pieData = [
  { name: 'Visual', value: 35, fill: 'hsl(var(--visual-primary))' },
  { name: 'Auditory', value: 25, fill: 'hsl(var(--auditory-primary))' },
  { name: 'Reading', value: 20, fill: 'hsl(var(--reading-primary))' },
  { name: 'Kinesthetic', value: 20, fill: 'hsl(var(--kinesthetic-primary))' }
];

function ToastDemo() {
  const { success, error, warning, info } = useToastHelpers();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Toast Notifications</h3>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => success('Success!', 'Your action was completed successfully.')}>
          Success Toast
        </Button>
        <Button onClick={() => error('Error!', 'Something went wrong. Please try again.')}>
          Error Toast
        </Button>
        <Button onClick={() => warning('Warning!', 'Please review your input before continuing.')}>
          Warning Toast
        </Button>
        <Button onClick={() => info('Info', 'Here is some useful information for you.')}>
          Info Toast
        </Button>
      </div>
    </div>
  );
}

export default function DemoPage() {
  const [showLoginForm, setShowLoginForm] = React.useState(false);
  const [showRegisterForm, setShowRegisterForm] = React.useState(false);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold gradient-learning bg-clip-text text-transparent">
              Learning Assistant UI Components
            </h1>
            <p className="text-xl text-muted-foreground">
              A comprehensive design system for personalized learning experiences
            </p>
          </div>

          {/* Color Palette */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Color Palette</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="h-16 bg-learning-primary rounded-lg"></div>
                <p className="text-sm font-medium">Learning Primary</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 bg-learning-secondary rounded-lg"></div>
                <p className="text-sm font-medium">Learning Secondary</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 bg-visual rounded-lg"></div>
                <p className="text-sm font-medium">Visual Learning</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 bg-auditory rounded-lg"></div>
                <p className="text-sm font-medium">Auditory Learning</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 bg-reading rounded-lg"></div>
                <p className="text-sm font-medium">Reading Learning</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 bg-kinesthetic rounded-lg"></div>
                <p className="text-sm font-medium">Kinesthetic Learning</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 bg-beginner rounded-lg"></div>
                <p className="text-sm font-medium">Beginner</p>
              </div>
              <div className="space-y-2">
                <div className="h-16 bg-intermediate rounded-lg"></div>
                <p className="text-sm font-medium">Intermediate</p>
              </div>
            </div>
          </section>

          {/* Basic UI Components */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Basic Components</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Buttons */}
              <Card>
                <CardHeader>
                  <CardTitle>Buttons</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button>Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm">Small</Button>
                    <Button size="lg">Large</Button>
                    <Button disabled>Disabled</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Badges */}
              <Card>
                <CardHeader>
                  <CardTitle>Badges</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge>Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="success">Success</Badge>
                    <Badge variant="warning">Warning</Badge>
                    <Badge variant="destructive">Error</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="visual">Visual</Badge>
                    <Badge variant="auditory">Auditory</Badge>
                    <Badge variant="reading">Reading</Badge>
                    <Badge variant="kinesthetic">Kinesthetic</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="beginner">Beginner</Badge>
                    <Badge variant="intermediate">Intermediate</Badge>
                    <Badge variant="advanced">Advanced</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Progress */}
              <Card>
                <CardHeader>
                  <CardTitle>Progress Indicators</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={75} label="Course Progress" />
                  <Progress value={60} variant="visual" label="Visual Learning" />
                  <Progress value={45} variant="auditory" size="sm" />
                  <div className="flex justify-center">
                    <CircularProgress value={85} label="Completion" />
                  </div>
                </CardContent>
              </Card>

              {/* Avatars */}
              <Card>
                <CardHeader>
                  <CardTitle>Avatars</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center space-x-3">
                  <Avatar fallback="AJ" size="xs" />
                  <Avatar fallback="BK" size="sm" />
                  <Avatar fallback="CL" size="md" />
                  <Avatar fallback="DM" size="lg" />
                  <Avatar fallback="EN" size="xl" />
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Stats Cards */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Stats Cards</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Total Study Time"
                value="24h 30m"
                description="This week"
                icon={Clock}
                change={{ value: 15, label: 'from last week', trend: 'up' }}
              />
              <StatsCard
                title="Courses Completed"
                value={12}
                description="Out of 15 enrolled"
                icon={BookOpen}
                progress={{ value: 12, max: 15 }}
                variant="gradient"
              />
              <StatsCard
                title="Learning Streak"
                value="7 days"
                description="Keep it up!"
                icon={Trophy}
                badge={{ text: 'On Fire!', variant: 'success' }}
              />
              <StatsCard
                title="Average Score"
                value="85%"
                description="Across all assessments"
                icon={Target}
                change={{ value: 5, label: 'improvement', trend: 'up' }}
                variant="outline"
              />
            </div>
          </section>

          {/* Charts */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Progress Charts</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProgressChart
                title="Weekly Progress"
                description="Your learning activity over the past week"
                type="line"
                data={chartData}
                dataKey="progress"
                xAxisKey="name"
                badge={{ text: 'This Week', variant: 'info' }}
              />
              <ProgressChart
                title="Learning Style Distribution"
                description="Your learning preferences breakdown"
                type="pie"
                data={pieData}
                dataKey="value"
                showLegend={true}
              />
            </div>
          </section>

          {/* Authentication Forms */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Authentication</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Button onClick={() => setShowLoginForm(!showLoginForm)}>
                  {showLoginForm ? 'Hide' : 'Show'} Login Form
                </Button>
                {showLoginForm && (
                  <LoginForm
                    onSubmit={(email, password) => {
                      console.log('Login:', { email, password });
                    }}
                    onSignUp={() => setShowRegisterForm(true)}
                  />
                )}
              </div>
              <div className="space-y-4">
                <Button onClick={() => setShowRegisterForm(!showRegisterForm)}>
                  {showRegisterForm ? 'Hide' : 'Show'} Register Form
                </Button>
                {showRegisterForm && (
                  <RegisterForm
                    onSubmit={(data) => {
                      console.log('Register:', data);
                    }}
                    onSignIn={() => setShowLoginForm(true)}
                  />
                )}
              </div>
            </div>
          </section>

          {/* Profile Card */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Profile Components</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProfileCard
                user={demoUser}
                stats={{
                  totalStudyTime: 1470, // 24.5 hours
                  completedModules: 12,
                  currentStreak: 7,
                  level: 5,
                  experience: 2750,
                  nextLevelExperience: 3000
                }}
                onEdit={() => console.log('Edit profile')}
                onViewProgress={() => console.log('View progress')}
              />
              <LearningStyleIndicator
                profile={demoUser.learningProfile}
                variant="detailed"
              />
            </div>
          </section>

          {/* Learning Components */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Learning Components</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ContentCard
                content={demoContent}
                progress={{
                  completed: false,
                  timeSpent: 25,
                  lastAccessed: new Date()
                }}
                adaptedFor={LearningStyleType.VISUAL}
                recommendationScore={92}
                onStart={() => console.log('Start content')}
              />
              <QuizCard
                quiz={demoQuiz}
                progress={{
                  completed: true,
                  score: 85,
                  attempts: 2,
                  bestScore: 85,
                  timeSpent: 25
                }}
                onStart={() => console.log('Start quiz')}
                onRetry={() => console.log('Retry quiz')}
                onViewResults={() => console.log('View results')}
              />
            </div>
          </section>

          {/* Alerts */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Alerts & Notifications</h2>
            <div className="space-y-4">
              <Alert
                variant="success"
                title="Module Completed!"
                description="You've successfully completed the React Hooks module. Great work!"
                dismissible
              />
              <Alert
                variant="warning"
                title="Assignment Due Soon"
                description="Your JavaScript fundamentals assignment is due in 2 days."
                dismissible
              />
              <Alert
                variant="info"
                title="New Feature Available"
                description="Check out our new adaptive learning recommendations in your dashboard."
                dismissible
              />
              <Alert
                variant="destructive"
                title="Connection Error"
                description="Unable to sync your progress. Please check your internet connection."
                dismissible
              />
            </div>
          </section>

          {/* Toast Demo */}
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">Interactive Elements</h2>
            <Card>
              <CardContent className="p-6">
                <ToastDemo />
              </CardContent>
            </Card>
          </section>

          {/* Footer */}
          <footer className="text-center text-muted-foreground py-8">
            <p>Learning Assistant UI Components - Built with React, TypeScript, and Tailwind CSS</p>
          </footer>
        </div>
      </div>
    </ToastProvider>
  );
}