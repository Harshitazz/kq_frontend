import React from 'react';
import { Loader2 } from 'lucide-react';

interface ProcessingToastProps {
  message: string;
  progress?: number;
}

export const ProcessingToast: React.FC<ProcessingToastProps> = ({ message, progress }) => {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[280px]">
      <div className="flex-shrink-0">
        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{message}</p>
        {progress !== undefined && (
          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
