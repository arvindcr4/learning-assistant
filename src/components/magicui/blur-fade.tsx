"use client";

import { cn } from "@/utils";
import { motion } from "framer-motion";
import React from "react";

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  variant?: {
    hidden: { y: number; opacity: number; filter: string };
    visible: { y: number; opacity: number; filter: string };
  };
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
  inViewMargin?: string;
  blur?: string;
}

const BlurFade = React.forwardRef<HTMLDivElement, BlurFadeProps>(
  (
    {
      children,
      className,
      variant,
      duration = 0.4,
      delay = 0,
      yOffset = 6,
      inView = false,
      inViewMargin = "-50px",
      blur = "6px",
    },
    ref
  ) => {
    const defaultVariants = {
      hidden: {
        y: yOffset,
        opacity: 0,
        filter: `blur(${blur})`,
      },
      visible: {
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
      },
    };

    const combinedVariants = variant || defaultVariants;

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        variants={combinedVariants}
        transition={{
          duration,
          delay,
          ease: "easeOut",
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        className={cn(className)}
      >
        {children}
      </motion.div>
    );
  }
);

BlurFade.displayName = "BlurFade";

export default BlurFade;