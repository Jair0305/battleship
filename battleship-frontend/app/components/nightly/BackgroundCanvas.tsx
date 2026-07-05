"use client";

import { useRef } from "react";
import { useMountEffect } from "../../hooks/useMountEffect";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
};

const PARTICLE_COUNT = 42;

export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useMountEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    const particles = createParticles();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawGrid = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#090909";
      ctx.fillRect(0, 0, width, height);

      const grid = 48;
      const drift = media.matches ? 0 : (time / 80) % grid;
      ctx.strokeStyle = "rgba(185,249,90,0.045)";
      ctx.lineWidth = 1;

      for (let x = -grid + drift; x < width + grid; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = -grid + drift * 0.4; y < height + grid; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    };

    const drawParticles = (time: number) => {
      for (const particle of particles) {
        if (!media.matches) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < -40) particle.x = width + 40;
          if (particle.x > width + 40) particle.x = -40;
          if (particle.y < -40) particle.y = height + 40;
          if (particle.y > height + 40) particle.y = -40;
        }

        const alpha = 0.14 + Math.sin(time / 1000 + particle.phase) * 0.06;
        ctx.fillStyle = `rgba(185,249,90,${alpha})`;
        const size = particle.size;
        ctx.fillRect(Math.round(particle.x / 8) * 8, Math.round(particle.y / 8) * 8, size, size);
        ctx.fillRect(Math.round((particle.x + size) / 8) * 8, Math.round((particle.y + size) / 8) * 8, size, size);
      }

      ctx.strokeStyle = "rgba(185,249,90,0.08)";
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length - 1; i += 3) {
        const a = particles[i];
        const b = particles[i + 1];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance < 150) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    };

    const render = (time: number) => {
      drawGrid(time);
      drawParticles(time);
      if (!media.matches) frame = window.requestAnimationFrame(render);
    };

    resize();
    render(0);
    window.addEventListener("resize", resize);
    if (!media.matches) frame = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  });

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-20 h-full w-full opacity-80"
    />
  );
}

function createParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, index): Particle => {
    const column = index % 7;
    const row = Math.floor(index / 7);
    return {
      x: 80 + column * 190 + Math.random() * 110,
      y: 90 + row * 130 + Math.random() * 70,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.16,
      size: 6 + Math.floor(Math.random() * 8),
      phase: Math.random() * Math.PI * 2,
    };
  });
}
