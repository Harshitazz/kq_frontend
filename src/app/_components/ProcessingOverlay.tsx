"use client";
import React from 'react';
import { Loader2, Zap } from 'lucide-react';

interface ProcessingOverlayProps {
  isVisible: boolean;
  message?: string;
  progress?: number;
  taskCount?: number;
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ 
  isVisible, 
  message = "Processing your documents...",
  progress,
  taskCount = 0
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-purple-900/95 via-blue-900/95 to-indigo-900/95 backdrop-blur-md">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/10 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${Math.random() * 3 + 2}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center space-y-8 px-6 max-w-md mx-auto">
        {/* Animated icon container */}
        <div className="relative">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 rounded-full border-4 border-purple-400/30 animate-spin" 
               style={{ animationDuration: '3s' }} />
          
          {/* Middle pulsing ring */}
          <div className="absolute inset-2 rounded-full border-4 border-blue-400/50 animate-pulse" 
               style={{ animationDuration: '2s' }} />
          
          {/* Inner icon */}
          <div className="relative w-24 h-24 flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500 rounded-full shadow-2xl">
            <Loader2 className="w-12 h-12 text-white animate-spin" style={{ animationDuration: '1s' }} />
          </div>
          
          {/* Sparkle effects */}
          <Zap className="absolute -top-2 -right-2 w-6 h-6 text-yellow-300 animate-pulse fill-yellow-300" />
          <Zap className="absolute -bottom-2 -left-2 w-5 h-5 text-pink-300 animate-pulse fill-pink-300" 
                    style={{ animationDelay: '0.5s' }} />
        </div>

        {/* Message text */}
        <div className="text-center space-y-3">
          <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-blue-200 to-indigo-200">
            {message}
          </h3>
          {taskCount > 0 && (
            <p className="text-sm text-purple-200/80 font-medium">
              Processing {taskCount} task{taskCount > 1 ? 's' : ''}...
            </p>
          )}
        </div>

        {/* Progress bar */}
        {progress !== undefined && (
          <div className="w-full max-w-xs space-y-2">
            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden backdrop-blur-sm">
              <div
                className="h-full bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 rounded-full transition-all duration-500 ease-out shadow-lg"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <p className="text-center text-sm text-purple-200/70 font-medium">
              {Math.round(progress)}% Complete
            </p>
          </div>
        )}

        {/* Loading dots animation */}
        <div className="flex space-x-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 bg-white/60 rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1s',
              }}
            />
          ))}
        </div>

        {/* Info text */}
        <p className="text-xs text-center text-purple-200/60 max-w-sm">
          This may take a few moments. Your documents are being processed and your knowledge graph is being built.
        </p>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-full bg-gradient-to-t from-purple-800/20 to-transparent">
          <svg
            className="absolute bottom-0 w-full h-20"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M0,60 C300,100 600,20 900,60 C1050,80 1125,40 1200,60 L1200,120 L0,120 Z"
              fill="rgba(255,255,255,0.05)"
              className="animate-pulse"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
