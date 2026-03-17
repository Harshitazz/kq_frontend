import { useState, useEffect, useCallback, useRef } from 'react';
import { toast, Id } from 'react-toastify';
import { ProcessingToast } from '../_components/ProcessingToast';

interface TaskStatus {
  task_id: string;
  status: string;
  progress?: number;
  message?: string;
}

interface UseTaskPollingOptions {
  apiUrl: string;
  getToken: () => Promise<string | null>;
  onComplete?: (taskId: string) => void;
  onError?: (taskId: string, error: string) => void;
  pollInterval?: number;
  enabled?: boolean;
}

export function useTaskPolling({
  apiUrl,
  getToken,
  onComplete,
  onError,
  pollInterval = 3000,
  enabled = true,
}: UseTaskPollingOptions) {
  const [activeTasks, setActiveTasks] = useState<Map<string, TaskStatus>>(new Map());
  const pollingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastStatusRef = useRef<Map<string, string>>(new Map());
  const toastRefs = useRef<Map<string, Id>>(new Map());

  const checkTaskStatus = useCallback(async (taskId: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${apiUrl}/task_status/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch task status');
      }

      const data: TaskStatus = await response.json();
      const currentStatus = data.status || 'Unknown';
      const lastStatus = lastStatusRef.current.get(taskId);

      // Update task status
      setActiveTasks((prev) => {
        const newMap = new Map(prev);
        newMap.set(taskId, data);
        return newMap;
      });

      // Show notification on status change
      if (lastStatus && lastStatus !== currentStatus) {
        // Dismiss previous toast for this task
        const existingToast = toastRefs.current.get(taskId);
        if (existingToast) {
          toast.dismiss(existingToast);
        }

        if (currentStatus === 'Completed') {
          toast.success(
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">✓ Processing Complete!</span>
            </div>,
            {
              position: 'top-right',
              autoClose: 3000,
              className: 'minimal-toast',
            }
          );
          toastRefs.current.delete(taskId);
          onComplete?.(taskId);
        } else if (currentStatus.startsWith('Failed')) {
          toast.error(
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">✗ Processing Failed</span>
            </div>,
            {
              position: 'top-right',
              autoClose: 5000,
              className: 'minimal-toast',
            }
          );
          toastRefs.current.delete(taskId);
          onError?.(taskId, currentStatus);
        } else if (currentStatus === 'Processing' || currentStatus === 'Pending') {
          // Determine message based on status
          let message = 'Processing your input...';
          if (currentStatus.includes('embedding') || currentStatus.toLowerCase().includes('embedding')) {
            message = 'Creating embeddings...';
          } else if (currentStatus.includes('graph') || currentStatus.toLowerCase().includes('knowledge')) {
            message = 'Creating knowledge graph...';
          } else if (currentStatus === 'Processing') {
            message = 'Processing your input...';
          }

          const toastId = toast(
            <ProcessingToast message={message} progress={data.progress} />,
            {
              position: 'top-right',
              autoClose: false,
              closeButton: false,
              className: 'minimal-toast-processing',
            }
          );
          toastRefs.current.set(taskId, toastId);
        }
      } else if (!lastStatus && (currentStatus === 'Processing' || currentStatus === 'Pending')) {
        // First time seeing this status
        let message = 'Processing your input...';
        if (currentStatus.includes('embedding') || currentStatus.toLowerCase().includes('embedding')) {
          message = 'Creating embeddings...';
        } else if (currentStatus.includes('graph') || currentStatus.toLowerCase().includes('knowledge')) {
          message = 'Creating knowledge graph...';
        }

        const toastId = toast(
          <ProcessingToast message={message} progress={data.progress} />,
          {
            position: 'top-right',
            autoClose: false,
            closeButton: false,
            className: 'minimal-toast-processing',
          }
        );
        toastRefs.current.set(taskId, toastId);
      }

      lastStatusRef.current.set(taskId, currentStatus);

      // Stop polling if task is complete or failed
      if (currentStatus === 'Completed' || currentStatus.startsWith('Failed')) {
        const intervalId = pollingRefs.current.get(taskId);
        if (intervalId) {
          clearInterval(intervalId);
          pollingRefs.current.delete(taskId);
        }
        // Remove from active tasks after a short delay to allow UI to update
        setTimeout(() => {
          setActiveTasks((prev) => {
            const newMap = new Map(prev);
            newMap.delete(taskId);
            return newMap;
          });
        }, 1000);
        return false; // Stop polling
      }

      return true; // Continue polling
    } catch (error) {
      console.error(`Error checking task status for ${taskId}:`, error);
      return false; // Stop polling on error
    }
  }, [apiUrl, getToken, onComplete, onError]);

  const startPolling = useCallback((taskId: string) => {
    if (!enabled) return;

    // Clear existing polling for this task
    const existingInterval = pollingRefs.current.get(taskId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Show initial processing toast
    const initialToastId = toast(
      <ProcessingToast message="Processing your input..." />,
      {
        position: 'top-right',
        autoClose: false,
        closeButton: false,
        className: 'minimal-toast-processing',
      }
    );
    toastRefs.current.set(taskId, initialToastId);

    // Initial check
    checkTaskStatus(taskId);

    // Set up polling interval
    const intervalId = setInterval(() => {
      checkTaskStatus(taskId).then((shouldContinue) => {
        if (!shouldContinue) {
          clearInterval(intervalId);
          pollingRefs.current.delete(taskId);
        }
      });
    }, pollInterval);

    pollingRefs.current.set(taskId, intervalId);
  }, [enabled, checkTaskStatus, pollInterval]);

  const stopPolling = useCallback((taskId: string) => {
    const intervalId = pollingRefs.current.get(taskId);
    if (intervalId) {
      clearInterval(intervalId);
      pollingRefs.current.delete(taskId);
    }
    setActiveTasks((prev) => {
      const newMap = new Map(prev);
      newMap.delete(taskId);
      return newMap;
    });
    lastStatusRef.current.delete(taskId);
  }, []);

  const stopAllPolling = useCallback(() => {
    pollingRefs.current.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    pollingRefs.current.clear();
    setActiveTasks(new Map());
    lastStatusRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllPolling();
    };
  }, [stopAllPolling]);

  const getTaskStatus = useCallback((taskId: string): TaskStatus | undefined => {
    return activeTasks.get(taskId);
  }, [activeTasks]);

  // Only consider tasks as "active" if they're actually processing, not completed
  const hasActiveTasks = Array.from(activeTasks.values()).some(
    (task) => task.status === 'Processing' || task.status === 'Pending'
  );
  const hasCompletedTasks = Array.from(activeTasks.values()).some(
    (task) => task.status === 'Completed'
  );

  return {
    activeTasks: Array.from(activeTasks.values()),
    startPolling,
    stopPolling,
    stopAllPolling,
    getTaskStatus,
    hasActiveTasks,
    hasCompletedTasks,
  };
}
