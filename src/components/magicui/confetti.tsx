"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";

interface ConfettiProps {
  className?: string;
  particleCount?: number;
  duration?: number;
  colors?: string[];
  trigger?: boolean;
  onComplete?: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  opacity: number;
}

export default function Confetti({
  className,
  particleCount = 50,
  duration = 3000,
  colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"],
  trigger = false,
  onComplete,
}: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const createParticle = (id: number): Particle => ({
    id,
    x: Math.random() * 100,
    y: -10,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3 + 2,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 8 + 4,
    opacity: 1,
  });

  useEffect(() => {
    if (!trigger) return;

    setIsAnimating(true);
    const newParticles = Array.from({ length: particleCount }, (_, i) =>
      createParticle(i)
    );
    setParticles(newParticles);

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((particle) => ({
            ...particle,
            x: particle.x + particle.vx,
            y: particle.y + particle.vy,
            vy: particle.vy + 0.1, // gravity
            rotation: particle.rotation + particle.rotationSpeed,
            opacity: particle.opacity - 0.01,
          }))
          .filter((particle) => particle.y < 110 && particle.opacity > 0)
      );
    }, 16);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setParticles([]);
      setIsAnimating(false);
      onComplete?.();
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [trigger, particleCount, duration, colors, onComplete]);

  if (!isAnimating && particles.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 pointer-events-none z-50 overflow-hidden",
        className
      )}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 transition-all duration-75"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            backgroundColor: particle.color,
            transform: `rotate(${particle.rotation}deg)`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: particle.opacity,
          }}
        />
      ))}
    </div>
  );
}