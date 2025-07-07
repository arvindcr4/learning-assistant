"use client";

import { cn } from "@/utils";
import { motion } from "framer-motion";
import React from "react";

interface ShimmerButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "#ffffff",
      shimmerSize = "0.05em",
      shimmerDuration = "3s",
      borderRadius = "100px",
      background = "rgba(0, 0, 0, 1)",
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        style={
          {
            "--spread": "90deg",
            "--shimmer-color": shimmerColor,
            "--radius": borderRadius,
            "--speed": shimmerDuration,
            "--cut": shimmerSize,
            "--bg": background,
          } as React.CSSProperties
        }
        className={cn(
          "group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap px-6 py-3 text-white [background:var(--bg)] [border-radius:var(--radius)] transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[var(--shimmer-color)]/25",
          "before:absolute before:inset-0 before:overflow-hidden before:rounded-[inherit] before:border before:border-white/10 before:content-[''] before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100",
          "after:absolute after:inset-0 after:rounded-[inherit] after:bg-[linear-gradient(var(--spread),transparent_74%,var(--shimmer-color)_86%,transparent_100%)] after:opacity-0 after:transition-opacity after:duration-500 hover:after:opacity-100",
          className
        )}
        ref={ref}
        {...props}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="relative z-10">{children}</span>
        <style jsx>{`
          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
          .group:hover::after {
            animation: shimmer var(--speed) infinite;
          }
        `}</style>
      </motion.button>
    );
  }
);

ShimmerButton.displayName = "ShimmerButton";

export default ShimmerButton;