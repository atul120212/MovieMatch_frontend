"use client";

import { useEffect, useRef } from "react";

export default function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const colors = ["#6366f1", "#a855f7", "#ec4899", "#f43f5e", "#0ea5e9", "#10b981", "#f59e0b"];

    interface Particle {
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
    }

    let particles: Particle[] = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // Create particles
    for (let i = 0; i < 180; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height - 20, // Start above the viewport
        width: Math.random() * 8 + 6,
        height: Math.random() * 12 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: Math.random() * 4 - 2,
        speedY: Math.random() * 5 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 6 - 3,
        opacity: Math.random() * 0.4 + 0.6,
      });
    }

    const startTime = Date.now();

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let activeCount = 0;

      particles.forEach((p) => {
        if (p.opacity <= 0) return;

        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotationSpeed;
        activeCount++;

        // Apply a little wind fluctuation
        p.speedX += Math.sin(p.y / 30) * 0.05;

        // Reset if it goes below screen (only if under 3 seconds elapsed)
        if (p.y > canvas.height + 20) {
          if (Date.now() - startTime < 3000) {
            p.y = -20;
            p.x = Math.random() * canvas.width;
            p.speedY = Math.random() * 5 + 4;
            p.speedX = Math.random() * 4 - 2;
          } else {
            p.opacity = 0;
            return;
          }
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        
        // Draw standard rectangular confetti or ribbon-like
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        
        ctx.restore();
      });

      if (activeCount > 0) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-50 w-screen h-screen" 
    />
  );
}
