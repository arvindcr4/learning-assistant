"use client";

import { cn } from "@/utils";
import React, { useEffect, useRef } from "react";

interface ParticlesProps {
  className?: string;
  quantity?: number;
  staticity?: number;
  ease?: number;
  refresh?: boolean;
  color?: string;
  vx?: number;
  vy?: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  translateX: number;
  translateY: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
}

export default function Particles({
  className,
  quantity = 100,
  staticity = 50,
  ease = 50,
  refresh = false,
  color = "#ffffff",
  vx = 0,
  vy = 0,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const particles = useRef<Particle[]>([]);
  const animationId = useRef<number>();

  const mouse = useRef({ x: 0, y: 0 });
  const canvasSize = useRef({ w: 0, h: 0 });

  const initCanvas = () => {
    if (!canvasRef.current || !canvasContainerRef.current) return;

    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    context.current = ctx;
    
    const rect = container.getBoundingClientRect();
    canvasSize.current = { w: rect.width, h: rect.height };
    
    canvas.width = canvasSize.current.w;
    canvas.height = canvasSize.current.h;
  };

  const generateParticles = () => {
    particles.current = [];
    for (let i = 0; i < quantity; i++) {
      const particle: Particle = {
        id: i,
        x: Math.random() * canvasSize.current.w,
        y: Math.random() * canvasSize.current.h,
        translateX: 0,
        translateY: 0,
        size: Math.random() * 2 + 0.5,
        alpha: 0,
        targetAlpha: Math.random() * 0.6 + 0.1,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        magnetism: 0.1 + Math.random() * 4,
      };
      particles.current.push(particle);
    }
  };

  const drawParticles = () => {
    if (!context.current) return;

    context.current.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);

    particles.current.forEach((particle) => {
      // Update position
      particle.x += particle.dx + vx;
      particle.y += particle.dy + vy;

      // Wrap around edges
      if (particle.x < 0) particle.x = canvasSize.current.w;
      if (particle.x > canvasSize.current.w) particle.x = 0;
      if (particle.y < 0) particle.y = canvasSize.current.h;
      if (particle.y > canvasSize.current.h) particle.y = 0;

      // Mouse interaction
      const dx = mouse.current.x - particle.x;
      const dy = mouse.current.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const force = (ease * particle.magnetism) / distance;

      particle.translateX += (dx * force) / staticity;
      particle.translateY += (dy * force) / staticity;

      // Update alpha
      particle.alpha += (particle.targetAlpha - particle.alpha) * 0.05;

      // Draw particle
      context.current.globalAlpha = particle.alpha;
      context.current.fillStyle = color;
      context.current.beginPath();
      context.current.arc(
        particle.x + particle.translateX,
        particle.y + particle.translateY,
        particle.size,
        0,
        2 * Math.PI
      );
      context.current.fill();
    });

    animationId.current = requestAnimationFrame(drawParticles);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!canvasContainerRef.current) return;
    
    const rect = canvasContainerRef.current.getBoundingClientRect();
    mouse.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  useEffect(() => {
    initCanvas();
    generateParticles();
    drawParticles();

    const handleResize = () => {
      initCanvas();
      generateParticles();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      if (animationId.current) {
        cancelAnimationFrame(animationId.current);
      }
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  useEffect(() => {
    if (refresh) {
      generateParticles();
    }
  }, [refresh]);

  return (
    <div
      ref={canvasContainerRef}
      className={cn("relative h-full w-full", className)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none"
      />
    </div>
  );
}