# Magic UI Components Usage Guide

This guide provides comprehensive documentation on how to use Magic UI components in the Learning Assistant application.

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Core Components](#core-components)
3. [Enhanced Components](#enhanced-components)
4. [Animation Configuration](#animation-configuration)
5. [Accessibility Features](#accessibility-features)
6. [Performance Considerations](#performance-considerations)
7. [Examples & Patterns](#examples--patterns)
8. [Troubleshooting](#troubleshooting)

## Installation & Setup

### Prerequisites

Magic UI components are already integrated into the learning assistant. They require:

- React 18+
- Framer Motion 10+
- Tailwind CSS 3+
- TypeScript 4+

### Import Components

```typescript
import { 
  AnimatedList,
  BentoGrid,
  ShimmerButton,
  BlurFade,
  Confetti,
  AnimatedProgress,
  EnhancedCard 
} from '@/components/magicui';
```

## Core Components

### 🎨 AnimatedList

Perfect for displaying dynamic content feeds, achievements, or notifications.

```typescript
import { AnimatedList, AnimatedListItem } from '@/components/magicui';

// Basic usage
<AnimatedList delay={1000}>
  {items.map(item => (
    <AnimatedListItem key={item.id}>
      <div className="p-4 bg-white rounded-lg shadow">
        {item.content}
      </div>
    </AnimatedListItem>
  ))}
</AnimatedList>
```

**Props:**
- `delay` (number): Time between item animations (default: 1000ms)
- `className` (string): Additional CSS classes
- `children` (ReactNode): List items to animate

**Learning Assistant Use Cases:**
- Recent achievements feed
- Learning activity timeline
- Notification center
- Progress milestones

### 🏗️ BentoGrid

Modern grid layout system for dashboard and content organization.

```typescript
import { BentoGrid, BentoGridItem } from '@/components/magicui';

<BentoGrid className="auto-rows-[200px]">
  <BentoGridItem
    className="md:col-span-2"
    title="Learning Progress"
    description="Track your educational journey"
    header={<ProgressVisualization />}
    icon={<BookOpen className="h-4 w-4" />}
  />
  
  <BentoGridItem
    title="AI Tutor"
    description="Get personalized help"
    header={<ChatPreview />}
    icon={<Star className="h-4 w-4" />}
  />
</BentoGrid>
```

**Props:**
- `className` (string): Grid layout classes
- `children` (ReactNode): BentoGridItem components

**BentoGridItem Props:**
- `title` (string | ReactNode): Item title
- `description` (string | ReactNode): Item description
- `header` (ReactNode): Visual header content
- `icon` (ReactNode): Small icon for the item
- `className` (string): Additional styling

**Learning Assistant Use Cases:**
- Main dashboard layout
- Course overview pages
- Feature showcase sections
- Settings panels

### 🌊 BlurFade

Smooth entrance animations for content reveals.

```typescript
import BlurFade from '@/components/magicui/blur-fade';

<BlurFade 
  delay={0.2} 
  inView={true}
  yOffset={20}
  blur="6px"
>
  <Card>
    <CardContent>
      Content that fades in smoothly
    </CardContent>
  </Card>
</BlurFade>
```

**Props:**
- `delay` (number): Animation delay in seconds
- `inView` (boolean): Trigger animation when in view
- `yOffset` (number): Vertical offset for animation
- `blur` (string): Blur amount for effect
- `duration` (number): Animation duration

**Learning Assistant Use Cases:**
- Page section reveals
- Modal content entrance
- Step-by-step tutorials
- Achievement announcements

### 🎊 Confetti

Celebration animations for achievements and milestones.

```typescript
import Confetti from '@/components/magicui/confetti';

const [celebrate, setCelebrate] = useState(false);

<Confetti
  trigger={celebrate}
  particleCount={100}
  colors={['#3b82f6', '#10b981', '#f59e0b']}
  duration={3000}
  onComplete={() => setCelebrate(false)}
/>
```

**Props:**
- `trigger` (boolean): When to start animation
- `particleCount` (number): Number of particles
- `colors` (string[]): Array of colors to use
- `duration` (number): Animation duration in ms
- `onComplete` (function): Callback when animation ends

**Learning Assistant Use Cases:**
- Quiz completion celebrations
- Achievement unlocks
- Course completions
- Learning milestones

### 📜 Marquee

Scrolling content display for announcements and highlights.

```typescript
import Marquee from '@/components/magicui/marquee';

<Marquee 
  pauseOnHover={true}
  reverse={false}
  repeat={4}
>
  {topics.map(topic => (
    <div key={topic.id} className="mx-4 px-3 py-1 bg-blue-100 rounded-full">
      {topic.name}
    </div>
  ))}
</Marquee>
```

**Props:**
- `pauseOnHover` (boolean): Pause animation on hover
- `reverse` (boolean): Reverse scroll direction
- `vertical` (boolean): Vertical scrolling
- `repeat` (number): Number of repetitions

**Learning Assistant Use Cases:**
- Trending topics display
- Announcement banners
- Feature highlights
- Course recommendations

### ✨ Particles

Interactive background effects for immersive experiences.

```typescript
import Particles from '@/components/magicui/particles';

<div className="relative h-96 bg-gradient-to-r from-blue-600 to-purple-600">
  <Particles
    className="absolute inset-0"
    quantity={50}
    color="#ffffff"
    vx={0.1}
    vy={-0.1}
  />
  <div className="relative z-10">
    {/* Your content here */}
  </div>
</div>
```

**Props:**
- `quantity` (number): Number of particles
- `color` (string): Particle color
- `vx`, `vy` (number): Velocity components
- `staticity` (number): Movement randomness
- `ease` (number): Mouse interaction strength

**Learning Assistant Use Cases:**
- Hero section backgrounds
- Interactive learning environments
- Immersive course intros
- Achievement celebration backgrounds

### 🔆 ShimmerButton

Enhanced buttons with engaging hover effects.

```typescript
import ShimmerButton from '@/components/magicui/shimmer-button';

<ShimmerButton
  onClick={startLearningSession}
  background="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
  shimmerColor="#ffffff"
  className="text-white px-6 py-3"
>
  Start Learning Session
</ShimmerButton>
```

**Props:**
- `shimmerColor` (string): Color of shimmer effect
- `shimmerSize` (string): Size of shimmer
- `shimmerDuration` (string): Animation duration
- `background` (string): Button background
- `borderRadius` (string): Button border radius

**Learning Assistant Use Cases:**
- Primary action buttons
- Quiz start buttons
- Course enrollment
- Achievement claim buttons

## Enhanced Components

### 📊 AnimatedProgress

Advanced progress indicators with smooth animations.

```typescript
import { AnimatedProgress, AnimatedCircularProgress, AnimatedStepProgress } from '@/components/magicui';

// Linear progress
<AnimatedProgress
  value={75}
  color="primary"
  size="lg"
  showLabel={true}
  animated={true}
  striped={false}
>
  Course Progress
</AnimatedProgress>

// Circular progress
<AnimatedCircularProgress
  value={80}
  size={120}
  color="success"
  showLabel={true}
/>

// Step progress
<AnimatedStepProgress
  steps={[
    { label: "Introduction", completed: true },
    { label: "Basics", completed: true, current: false },
    { label: "Advanced", completed: false, current: true },
    { label: "Assessment", completed: false }
  ]}
  orientation="horizontal"
/>
```

**AnimatedProgress Props:**
- `value` (number): Progress value (0-100)
- `color` ('primary' | 'secondary' | 'success' | 'warning' | 'error')
- `size` ('sm' | 'md' | 'lg')
- `showLabel` (boolean): Show percentage label
- `animated` (boolean): Enable animations
- `striped` (boolean): Show striped pattern

**Learning Assistant Use Cases:**
- Course completion tracking
- Skill development indicators
- Quiz progress bars
- Learning path advancement

### 🎯 EnhancedCard

Advanced card components with animations and interactions.

```typescript
import { EnhancedCard, ExpandableCard, FlipCard, AchievementCard } from '@/components/magicui';

// Basic enhanced card
<EnhancedCard
  hover={true}
  clickable={true}
  onCardClick={() => handleCardClick()}
  variant="elevated"
  size="md"
  loading={isLoading}
>
  <CardContent>
    Enhanced card content
  </CardContent>
</EnhancedCard>

// Expandable card
<ExpandableCard
  title="Course Details"
  icon={<BookOpen className="h-5 w-5" />}
  preview={<p>Brief course description...</p>}
  expandedContent={<DetailedCourseInfo />}
/>

// Achievement card
<AchievementCard
  title="Quiz Master"
  description="Complete 10 quizzes with 90% accuracy"
  icon={<Trophy className="h-6 w-6" />}
  achieved={true}
  progress={100}
  onAchieve={() => triggerCelebration()}
/>
```

**EnhancedCard Props:**
- `hover` (boolean): Enable hover effects
- `clickable` (boolean): Make card clickable
- `variant` ('default' | 'elevated' | 'outlined' | 'filled')
- `size` ('sm' | 'md' | 'lg')
- `loading` (boolean): Show loading state
- `animated` (boolean): Enable entrance animations

**Learning Assistant Use Cases:**
- Course cards
- Achievement displays
- Learning module cards
- Interactive content previews

## Animation Configuration

### Motion Preferences

All Magic UI components respect user motion preferences:

```typescript
import { useAnimationPreferences } from '@/lib/animation-config';

function Component() {
  const { animationsEnabled, toggleAnimations } = useAnimationPreferences();
  
  return (
    <BlurFade inView={animationsEnabled}>
      <Content />
    </BlurFade>
  );
}
```

### Custom Animation Variants

Create custom animations using the configuration utilities:

```typescript
import { 
  fadeInUp, 
  scaleIn, 
  cardHover,
  getAnimationDuration,
  SPRING_CONFIG 
} from '@/lib/animation-config';

<motion.div
  variants={fadeInUp}
  initial="initial"
  animate="animate"
  transition={SPRING_CONFIG.gentle}
>
  Custom animated content
</motion.div>
```

### Performance Optimization

```typescript
import { 
  prefersReducedMotion,
  reduceMotionForLowPerformance 
} from '@/lib/animation-config';

// Check if animations should be disabled
const shouldAnimate = !prefersReducedMotion() && !reduceMotionForLowPerformance();
```

## Accessibility Features

### Reduced Motion Support

All components automatically respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  /* Animations are automatically disabled */
}
```

### Keyboard Navigation

Enhanced components maintain full keyboard accessibility:

```typescript
<ShimmerButton
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleAction();
    }
  }}
>
  Accessible Button
</ShimmerButton>
```

### Screen Reader Support

All components include proper ARIA attributes:

```typescript
<AnimatedProgress
  value={75}
  aria-label="Course completion progress"
  aria-valuenow={75}
  aria-valuemin={0}
  aria-valuemax={100}
/>
```

## Performance Considerations

### Bundle Optimization

Import only the components you need:

```typescript
// ✅ Good - specific imports
import { BlurFade } from '@/components/magicui/blur-fade';
import { ShimmerButton } from '@/components/magicui/shimmer-button';

// ❌ Avoid - imports entire library
import * as MagicUI from '@/components/magicui';
```

### Animation Performance

Use CSS animations for simple effects:

```css
/* Better performance for simple animations */
.simple-fade {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Memory Management

Components automatically clean up animations:

```typescript
useEffect(() => {
  // Animations are automatically cleaned up
  return () => {
    // Cleanup handled internally
  };
}, []);
```

## Examples & Patterns

### Learning Dashboard

```typescript
function LearningDashboard() {
  const [showConfetti, setShowConfetti] = useState(false);
  
  return (
    <div className="space-y-6">
      <BlurFade delay={0.1}>
        <h1 className="text-3xl font-bold">Your Learning Journey</h1>
      </BlurFade>
      
      <BentoGrid className="auto-rows-[200px]">
        <BentoGridItem
          className="md:col-span-2"
          title="Progress Overview"
          header={
            <AnimatedProgress 
              value={75} 
              color="primary" 
              showLabel={true}
            />
          }
        />
        
        <BentoGridItem
          title="Recent Achievements"
          header={
            <AnimatedList delay={1000}>
              {achievements.map(achievement => (
                <AchievementCard key={achievement.id} {...achievement} />
              ))}
            </AnimatedList>
          }
        />
      </BentoGrid>
      
      <Confetti 
        trigger={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />
    </div>
  );
}
```

### Interactive Course Card

```typescript
function CourseCard({ course }) {
  return (
    <ExpandableCard
      title={course.title}
      icon={<BookOpen className="h-5 w-5" />}
      preview={
        <div className="space-y-2">
          <p className="text-sm text-gray-600">{course.description}</p>
          <AnimatedProgress 
            value={course.progress} 
            size="sm"
            showLabel={true}
          />
        </div>
      }
      expandedContent={
        <div className="space-y-4">
          <AnimatedStepProgress steps={course.modules} />
          <ShimmerButton
            onClick={() => continueCourse(course.id)}
            className="w-full"
          >
            Continue Learning
          </ShimmerButton>
        </div>
      }
    />
  );
}
```

### Achievement Celebration

```typescript
function AchievementUnlock({ achievement }) {
  const [showCelebration, setShowCelebration] = useState(false);
  
  useEffect(() => {
    if (achievement.unlocked) {
      setShowCelebration(true);
    }
  }, [achievement.unlocked]);
  
  return (
    <>
      <AchievementCard
        {...achievement}
        onAchieve={() => setShowCelebration(true)}
      />
      
      <Confetti
        trigger={showCelebration}
        particleCount={150}
        colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444']}
        onComplete={() => setShowCelebration(false)}
      />
    </>
  );
}
```

## Troubleshooting

### Common Issues

#### 1. Animations Not Working

**Problem:** Components appear but animations don't trigger.

**Solutions:**
- Check if `prefers-reduced-motion` is enabled
- Verify Framer Motion is properly installed
- Ensure `inView` prop is set correctly for BlurFade

```typescript
// Debug animation state
const shouldAnimate = !prefersReducedMotion();
console.log('Animations enabled:', shouldAnimate);
```

#### 2. Performance Issues

**Problem:** Page feels slow with many animated components.

**Solutions:**
- Use CSS animations for simple effects
- Implement intersection observer for `inView` detection
- Reduce particle count in Particles component

```typescript
// Optimize particle count based on device
const particleCount = window.innerWidth < 768 ? 30 : 50;
```

#### 3. Import Errors

**Problem:** Cannot import Magic UI components.

**Solutions:**
- Check file paths are correct
- Ensure all dependencies are installed
- Verify TypeScript configuration

```typescript
// Check if component exists
import { BlurFade } from '@/components/magicui';
console.log(BlurFade); // Should not be undefined
```

#### 4. Styling Conflicts

**Problem:** Components don't match design system.

**Solutions:**
- Use CSS custom properties for consistent theming
- Override component styles with Tailwind utilities
- Check for CSS specificity issues

```css
/* Override component styles */
.magic-ui-card {
  @apply bg-card text-card-foreground border-border;
}
```

### Performance Monitoring

Monitor animation performance:

```typescript
import { trackAnimationPerformance } from '@/lib/animation-config';

// Track performance
trackAnimationPerformance('card-hover', 0.3);
```

### Browser Support

Magic UI components support:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

For older browsers, animations gracefully degrade.

## Best Practices

### 1. Use Semantic HTML

```typescript
// ✅ Good - semantic structure
<section>
  <h2>Learning Progress</h2>
  <AnimatedProgress value={75} aria-label="Course completion" />
</section>

// ❌ Avoid - non-semantic
<div>
  <div>Learning Progress</div>
  <AnimatedProgress value={75} />
</div>
```

### 2. Provide Fallbacks

```typescript
// ✅ Good - graceful degradation
<BlurFade fallback={<div>Content</div>}>
  <Content />
</BlurFade>

// Or use conditional rendering
{supportsAnimations ? (
  <BlurFade><Content /></BlurFade>
) : (
  <Content />
)}
```

### 3. Optimize for Touch Devices

```typescript
// ✅ Good - touch-friendly
<ShimmerButton
  className="min-h-[44px] min-w-[44px]" // Touch target size
  onTouchStart={handleTouchStart}
>
  Touch Friendly Button
</ShimmerButton>
```

### 4. Test with Real Content

```typescript
// ✅ Good - test with various content lengths
<ExpandableCard
  title="Very Long Course Title That Might Wrap to Multiple Lines"
  preview={<LongContentPreview />}
  expandedContent={<VeryLongExpandedContent />}
/>
```

---

This guide covers the core functionality of Magic UI components in the Learning Assistant. For additional examples and advanced usage patterns, refer to the demo page and component source code.

**Need Help?**
- Check the [troubleshooting section](#troubleshooting)
- Review component props in TypeScript definitions
- Test components in the demo environment
- Refer to Framer Motion documentation for advanced animations

*Last updated: 2025-01-07*