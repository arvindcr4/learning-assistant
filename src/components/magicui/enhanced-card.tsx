"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils';
import { 
  cardHover, 
  buttonPress, 
  scaleIn, 
  fadeIn,
  getAnimationDuration,
  prefersReducedMotion 
} from '@/lib/animation-config';

interface EnhancedCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  clickable?: boolean;
  onCardClick?: () => void;
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  animated?: boolean;
  delay?: number;
}

export function EnhancedCard({
  children,
  className,
  hover = true,
  clickable = false,
  onCardClick,
  variant = 'default',
  size = 'md',
  loading = false,
  disabled = false,
  animated = true,
  delay = 0,
}: EnhancedCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const shouldAnimate = animated && !prefersReducedMotion();

  const baseClasses = 'rounded-xl border transition-colors duration-200';
  
  const variantClasses = {
    default: 'bg-card text-card-foreground border-border shadow-md',
    elevated: 'bg-card text-card-foreground border-border shadow-lg',
    outlined: 'bg-transparent border-2 border-border',
    filled: 'bg-muted text-muted-foreground border-transparent',
  };

  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const cardClasses = cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    {
      'cursor-pointer hover:shadow-lg': clickable && !disabled,
      'opacity-50 cursor-not-allowed': disabled,
      'relative overflow-hidden': loading,
    },
    className
  );

  const cardContent = (
    <>
      {loading && <LoadingOverlay />}
      {children}
    </>
  );

  if (!shouldAnimate) {
    return (
      <div 
        className={cardClasses}
        onClick={!disabled && clickable ? onCardClick : undefined}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <motion.div
      className={cardClasses}
      initial={scaleIn.initial}
      animate={scaleIn.animate}
      exit={scaleIn.exit}
      variants={hover ? cardHover : undefined}
      initial="rest"
      whileHover={!disabled && hover ? "hover" : "rest"}
      whileTap={!disabled && clickable ? buttonPress.whileTap : undefined}
      onClick={!disabled && clickable ? onCardClick : undefined}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      transition={{
        duration: getAnimationDuration('normal'),
        delay: delay,
      }}
    >
      {cardContent}
    </motion.div>
  );
}

// Loading overlay component
function LoadingOverlay() {
  return (
    <motion.div
      className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center rounded-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: getAnimationDuration('fast') }}
    >
      <motion.div
        className="w-8 h-8 border-4 border-learning-primary border-t-transparent rounded-full"
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </motion.div>
  );
}

// Card with expandable content
interface ExpandableCardProps extends EnhancedCardProps {
  title: string;
  preview: React.ReactNode;
  expandedContent: React.ReactNode;
  defaultExpanded?: boolean;
  icon?: React.ReactNode;
}

export function ExpandableCard({
  title,
  preview,
  expandedContent,
  defaultExpanded = false,
  icon,
  className,
  ...cardProps
}: ExpandableCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const shouldAnimate = !prefersReducedMotion();

  return (
    <EnhancedCard
      {...cardProps}
      className={cn('cursor-pointer', className)}
      clickable={true}
      onCardClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {icon && (
              <motion.div
                animate={isExpanded ? { rotate: 90 } : { rotate: 0 }}
                transition={{ duration: getAnimationDuration('fast') }}
              >
                {icon}
              </motion.div>
            )}
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          
          <motion.svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={isExpanded ? { rotate: 180 } : { rotate: 0 }}
            transition={{ duration: getAnimationDuration('fast') }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>

        {/* Preview content */}
        {!isExpanded && (
          <motion.div
            initial={shouldAnimate ? fadeIn.initial : {}}
            animate={shouldAnimate ? fadeIn.animate : {}}
            exit={shouldAnimate ? fadeIn.exit : {}}
          >
            {preview}
          </motion.div>
        )}

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={shouldAnimate ? { opacity: 0, height: 0 } : {}}
              animate={shouldAnimate ? { opacity: 1, height: 'auto' } : {}}
              exit={shouldAnimate ? { opacity: 0, height: 0 } : {}}
              transition={{
                duration: getAnimationDuration('normal'),
                ease: 'easeInOut',
              }}
              className="overflow-hidden"
            >
              {expandedContent}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </EnhancedCard>
  );
}

// Flip card component
interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
  trigger?: 'hover' | 'click';
  defaultFlipped?: boolean;
}

export function FlipCard({
  front,
  back,
  className,
  trigger = 'hover',
  defaultFlipped = false,
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(defaultFlipped);
  const shouldAnimate = !prefersReducedMotion();

  const handleInteraction = () => {
    if (trigger === 'click') {
      setIsFlipped(!isFlipped);
    }
  };

  const hoverProps = trigger === 'hover' ? {
    onHoverStart: () => setIsFlipped(true),
    onHoverEnd: () => setIsFlipped(false),
  } : {};

  return (
    <motion.div
      className={cn('relative w-full h-full preserve-3d', className)}
      animate={shouldAnimate ? { rotateY: isFlipped ? 180 : 0 } : {}}
      transition={{ duration: getAnimationDuration('normal') }}
      onClick={handleInteraction}
      {...hoverProps}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* Front */}
      <div
        className="absolute inset-0 w-full h-full backface-hidden"
        style={{ backfaceVisibility: 'hidden' }}
      >
        {front}
      </div>
      
      {/* Back */}
      <div
        className="absolute inset-0 w-full h-full backface-hidden"
        style={{ 
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
        }}
      >
        {back}
      </div>
    </motion.div>
  );
}

// Achievement card with celebration animation
interface AchievementCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  achieved?: boolean;
  progress?: number;
  className?: string;
  onAchieve?: () => void;
}

export function AchievementCard({
  title,
  description,
  icon,
  achieved = false,
  progress = 0,
  className,
  onAchieve,
}: AchievementCardProps) {
  const [showCelebration, setShowCelebration] = useState(false);
  const shouldAnimate = !prefersReducedMotion();

  React.useEffect(() => {
    if (achieved && !showCelebration) {
      setShowCelebration(true);
      onAchieve?.();
      
      setTimeout(() => {
        setShowCelebration(false);
      }, 2000);
    }
  }, [achieved, showCelebration, onAchieve]);

  return (
    <EnhancedCard
      className={cn(
        'relative overflow-hidden transition-all duration-300',
        achieved 
          ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700'
          : 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800',
        className
      )}
      animated={shouldAnimate}
    >
      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebration && shouldAnimate && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-xl"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: getAnimationDuration('slow') }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-start space-x-4">
        {/* Icon */}
        <motion.div
          className={cn(
            'flex-shrink-0 p-3 rounded-full transition-colors duration-300',
            achieved 
              ? 'bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-300'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
          )}
          animate={showCelebration && shouldAnimate ? {
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0],
          } : {}}
          transition={{
            duration: getAnimationDuration('normal'),
            repeat: showCelebration ? 2 : 0,
          }}
        >
          {icon}
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            'text-lg font-semibold transition-colors duration-300',
            achieved 
              ? 'text-green-800 dark:text-green-200'
              : 'text-gray-700 dark:text-gray-300'
          )}>
            {title}
          </h3>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {description}
          </p>

          {/* Progress bar for unachieved items */}
          {!achieved && progress > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  className="bg-learning-primary rounded-full h-2"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: getAnimationDuration('slow') }}
                />
              </div>
            </div>
          )}

          {/* Achievement badge */}
          {achieved && (
            <motion.div
              className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
              initial={shouldAnimate ? { scale: 0, opacity: 0 } : {}}
              animate={shouldAnimate ? { scale: 1, opacity: 1 } : {}}
              transition={{
                duration: getAnimationDuration('normal'),
                delay: getAnimationDuration('fast'),
                type: 'spring',
                stiffness: 500,
                damping: 30,
              }}
            >
              ✨ Achieved!
            </motion.div>
          )}
        </div>
      </div>
    </EnhancedCard>
  );
}