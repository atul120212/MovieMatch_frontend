"use client";

import React from "react";

interface VideoLoaderProps {
  text?: string;
  className?: string;
}

export default function VideoLoader({ text = "Loading...", className = "" }: VideoLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-6 ${className}`}>
      {/* Glow wrapper */}
      <div className="relative w-48 h-48 rounded-2xl overflow-hidden glass border border-indigo-500/20 flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.2)] hover:shadow-[0_0_60px_rgba(219,39,119,0.3)] transition-shadow duration-500 animate-pulse-slow">
        {/* Subtle background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-pink-500/10 pointer-events-none" />
        
        {/* Loader Video */}
        <video
          src="/loaders/loader.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-[92%] h-[92%] object-cover rounded-xl relative z-10 mix-blend-screen"
        />
      </div>
      
      {/* Loading Text */}
      {text && (
        <p className="text-sm font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 animate-pulse text-center">
          {text}
        </p>
      )}
    </div>
  );
}
