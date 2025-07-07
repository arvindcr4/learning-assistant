"use client";

import { cn } from "@/lib/utils";
import React from "react";

export interface BentoGridProps {
  className?: string;
  children?: React.ReactNode;
}

export interface BentoGridItemProps {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const BentoGrid = React.forwardRef<HTMLDivElement, BentoGridProps>(
  ({ className, children }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "grid grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto",
          className
        )}
      >
        {children}
      </div>
    );
  }
);

BentoGrid.displayName = "BentoGrid";

export const BentoGridItem = React.forwardRef<
  HTMLDivElement,
  BentoGridItemProps
>(({ className, title, description, header, icon, children }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "row-span-1 rounded-xl group/bento hover:shadow-xl transition duration-200 shadow-input dark:shadow-none p-4 bg-white dark:bg-black border border-transparent justify-between flex flex-col space-y-4",
        className
      )}
    >
      {header}
      <div className="group-hover/bento:translate-x-2 transition duration-200">
        {icon}
        <div className="font-sans font-bold text-neutral-600 dark:text-neutral-200 mb-2 mt-2">
          {title}
        </div>
        <div className="font-sans font-normal text-neutral-600 text-xs dark:text-neutral-300">
          {description}
        </div>
        {children}
      </div>
    </div>
  );
});

BentoGridItem.displayName = "BentoGridItem";