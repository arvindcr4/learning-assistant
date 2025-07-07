"use client";

import React, { useState } from 'react';
import { AnimatedList, AnimatedListItem } from './animated-list';
import { BentoGrid, BentoGridItem } from './bento-grid';
import BlurFade from './blur-fade';
import Confetti from './confetti';
import Marquee from './marquee';
import Particles from './particles';
import ShimmerButton from './shimmer-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { GraduationCap, BookOpen, Trophy, Star, Users, Zap } from 'lucide-react';

interface LearningAchievement {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'quiz' | 'milestone' | 'streak' | 'skill';
}

const achievements: LearningAchievement[] = [
  {
    id: '1',
    title: 'Quiz Master',
    description: 'Completed 10 quizzes with 90% accuracy',
    timestamp: '2 minutes ago',
    type: 'quiz'
  },
  {
    id: '2',
    title: 'Learning Streak',
    description: '7 days consecutive learning',
    timestamp: '1 hour ago',
    type: 'streak'
  },
  {
    id: '3',
    title: 'New Skill Unlocked',
    description: 'Mastered React Fundamentals',
    timestamp: '3 hours ago',
    type: 'skill'
  },
  {
    id: '4',
    title: 'Course Milestone',
    description: '50% progress in JavaScript Advanced',
    timestamp: '1 day ago',
    type: 'milestone'
  }
];

const learningTopics = [
  'JavaScript ES6+',
  'React Components',
  'TypeScript Basics',
  'Node.js API',
  'Database Design',
  'UI/UX Principles'
];

export default function MagicUIDemo() {
  const [showConfetti, setShowConfetti] = useState(false);
  const [inView, setInView] = useState(true);

  const handleCelebration = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <BlurFade delay={0.2} inView={inView}>
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-learning bg-clip-text text-transparent">
              Magic UI Learning Assistant
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience next-generation UI components designed for educational platforms
            </p>
          </div>
        </BlurFade>

        {/* Confetti Component */}
        <Confetti 
          trigger={showConfetti}
          particleCount={100}
          colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']}
          onComplete={() => setShowConfetti(false)}
        />

        {/* Particles Background */}
        <div className="relative h-96 rounded-2xl overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600">
          <Particles
            className="absolute inset-0"
            quantity={50}
            color="#ffffff"
            vx={0.1}
            vy={-0.1}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <BlurFade delay={0.5} inView={inView}>
              <div className="text-center text-white space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold">
                  Interactive Learning Environment
                </h2>
                <p className="text-lg opacity-90">
                  Immersive background effects enhance engagement
                </p>
                <ShimmerButton
                  onClick={handleCelebration}
                  background="rgba(255, 255, 255, 0.1)"
                  shimmerColor="#ffffff"
                  className="text-white border border-white/20"
                >
                  🎉 Celebrate Achievement
                </ShimmerButton>
              </div>
            </BlurFade>
          </div>
        </div>

        {/* Marquee of Learning Topics */}
        <BlurFade delay={0.3} inView={inView}>
          <Card className="p-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-learning-primary" />
                Trending Learning Topics
              </CardTitle>
              <CardDescription>
                Popular subjects being studied by our community
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Marquee pauseOnHover className="py-4">
                {learningTopics.map((topic, index) => (
                  <div
                    key={index}
                    className="mx-4 px-4 py-2 bg-learning-primary/10 text-learning-primary rounded-full text-sm font-medium whitespace-nowrap"
                  >
                    {topic}
                  </div>
                ))}
              </Marquee>
            </CardContent>
          </Card>
        </BlurFade>

        {/* Bento Grid Layout */}
        <BlurFade delay={0.4} inView={inView}>
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center">Learning Dashboard</h2>
            <BentoGrid className="auto-rows-[200px]">
              <BentoGridItem
                className="md:col-span-2"
                title="Progress Overview"
                description="Track your learning journey with detailed analytics"
                header={
                  <div className="flex h-full w-full bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg items-center justify-center">
                    <Trophy className="h-12 w-12 text-white" />
                  </div>
                }
                icon={<GraduationCap className="h-4 w-4 text-learning-primary" />}
              />
              
              <BentoGridItem
                title="AI Tutor Chat"
                description="Get instant help from your personal AI learning assistant"
                header={
                  <div className="flex h-full w-full bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg items-center justify-center">
                    <Zap className="h-12 w-12 text-white" />
                  </div>
                }
                icon={<Star className="h-4 w-4 text-learning-primary" />}
              />
              
              <BentoGridItem
                title="Study Groups"
                description="Connect with peers and join collaborative learning sessions"
                header={
                  <div className="flex h-full w-full bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg items-center justify-center">
                    <Users className="h-12 w-12 text-white" />
                  </div>
                }
                icon={<BookOpen className="h-4 w-4 text-learning-primary" />}
              />
              
              <BentoGridItem
                className="md:col-span-2"
                title="Interactive Exercises"
                description="Hands-on learning with immediate feedback and adaptive difficulty"
                header={
                  <div className="flex h-full w-full bg-gradient-to-br from-orange-500 to-red-500 rounded-lg items-center justify-center">
                    <GraduationCap className="h-12 w-12 text-white" />
                  </div>
                }
                icon={<Trophy className="h-4 w-4 text-learning-primary" />}
              />
            </BentoGrid>
          </div>
        </BlurFade>

        {/* Animated Learning Achievements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <BlurFade delay={0.5} inView={inView}>
            <Card className="p-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-learning-primary" />
                  Recent Achievements
                </CardTitle>
                <CardDescription>
                  Your latest learning milestones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnimatedList delay={2000} className="max-h-96 overflow-hidden">
                  {achievements.map((achievement) => (
                    <AnimatedListItem key={achievement.id} index={0}>
                      <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className={`p-2 rounded-full ${
                          achievement.type === 'quiz' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' :
                          achievement.type === 'streak' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' :
                          achievement.type === 'skill' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300' :
                          'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300'
                        }`}>
                          {achievement.type === 'quiz' && <BookOpen className="h-4 w-4" />}
                          {achievement.type === 'streak' && <Zap className="h-4 w-4" />}
                          {achievement.type === 'skill' && <Star className="h-4 w-4" />}
                          {achievement.type === 'milestone' && <Trophy className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {achievement.title}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {achievement.description}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                            {achievement.timestamp}
                          </p>
                        </div>
                      </div>
                    </AnimatedListItem>
                  ))}
                </AnimatedList>
              </CardContent>
            </Card>
          </BlurFade>

          <BlurFade delay={0.6} inView={inView}>
            <Card className="p-6">
              <CardHeader>
                <CardTitle>Interactive Components</CardTitle>
                <CardDescription>
                  Explore Magic UI components in action
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ShimmerButton
                  onClick={() => setInView(!inView)}
                  background="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                  shimmerColor="#ffffff"
                  className="w-full text-white"
                >
                  Toggle Blur Fade Animation
                </ShimmerButton>
                
                <Button
                  onClick={handleCelebration}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                >
                  🎊 Trigger Celebration
                </Button>
                
                <div className="p-4 bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-900 dark:to-purple-900 rounded-lg">
                  <h4 className="font-medium mb-2">Theme Integration</h4>
                  <p className="text-sm text-muted-foreground">
                    Magic UI components seamlessly integrate with the learning assistant's 
                    design system, supporting dark mode and custom color schemes.
                  </p>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </div>

        {/* Features Overview */}
        <BlurFade delay={0.7} inView={inView}>
          <Card className="p-8">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Magic UI Integration Features</CardTitle>
              <CardDescription>
                Enhanced user experience through animated and interactive components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div className="text-center space-y-2">
                  <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Zap className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                  </div>
                  <h3 className="font-semibold">Smooth Animations</h3>
                  <p className="text-sm text-muted-foreground">
                    Framer Motion powered animations for engaging user interactions
                  </p>
                </div>
                <div className="text-center space-y-2">
                  <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-green-600 dark:text-green-300" />
                  </div>
                  <h3 className="font-semibold">Learning-Focused</h3>
                  <p className="text-sm text-muted-foreground">
                    Components designed specifically for educational platforms
                  </p>
                </div>
                <div className="text-center space-y-2">
                  <div className="mx-auto w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                    <Star className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                  </div>
                  <h3 className="font-semibold">Accessible Design</h3>
                  <p className="text-sm text-muted-foreground">
                    Built with accessibility and performance in mind
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </BlurFade>
      </div>
    </div>
  );
}