import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/utils';

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Learning specific variants
        visual: "border-transparent bg-visual text-white hover:opacity-80",
        auditory: "border-transparent bg-auditory text-white hover:opacity-80",
        reading: "border-transparent bg-reading text-white hover:opacity-80",
        kinesthetic: "border-transparent bg-kinesthetic text-white hover:opacity-80",
        // Difficulty levels
        beginner: "border-transparent bg-beginner text-white hover:bg-beginner/80",
        intermediate: "border-transparent bg-intermediate text-white hover:bg-intermediate/80",
        advanced: "border-transparent bg-advanced text-white hover:bg-advanced/80",
        // Status badges
        success: "border-transparent bg-learning-secondary text-white hover:bg-learning-secondary/80",
        warning: "border-transparent bg-learning-accent text-black hover:bg-learning-accent/80",
        info: "border-transparent bg-learning-primary text-white hover:bg-learning-primary/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
}

function Badge({ className, variant, icon, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };