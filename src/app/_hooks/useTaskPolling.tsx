import { useState, useEffect, useCallback, useRef } from 'react';

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
  const [activeTasks, setActiveTasks] = useState<Map<string, TaskStatus>>(
    new Map()
  );

  const pollingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastStatusRef = useRef<Map<string, string>>(new Map());

  const checkTaskStatus = useCallback(
    async (taskId: string) => {
      try {
        const token = await getToken();

        if (!token) {
          return false;
        }

        const response = await fetch(`${apiUrl}/task_status/${taskId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

        // Handle status changes
        if (lastStatus && lastStatus !== currentStatus) {
          if (currentStatus === 'Completed') {
            onComplete?.(taskId);
          } else if (currentStatus.startsWith('Failed')) {
            onError?.(taskId, currentStatus);
          }
        }

        lastStatusRef.current.set(taskId, currentStatus);

        // Stop polling when task is completed or failed
        if (
          currentStatus === 'Completed' ||
          currentStatus.startsWith('Failed')
        ) {
          const intervalId = pollingRefs.current.get(taskId);

          if (intervalId) {
            clearInterval(intervalId);
            pollingRefs.current.delete(taskId);
          }

          // Keep the final status briefly so the UI can update
          setTimeout(() => {
            setActiveTasks((prev) => {
              const newMap = new Map(prev);
              newMap.delete(taskId);
              return newMap;
            });
          }, 1000);

          return false;
        }

        return true;
      } catch (error) {
        console.error(
          `Error checking task status for ${taskId}:`,
          error
        );

        return false;
      }
    },
    [apiUrl, getToken, onComplete, onError]
  );

  const startPolling = useCallback(
    (taskId: string) => {
      if (!enabled) return;

      // Clear existing polling for this task
      const existingInterval = pollingRefs.current.get(taskId);

      if (existingInterval) {
        clearInterval(existingInterval);
        pollingRefs.current.delete(taskId);
      }

      // Initial status check
      checkTaskStatus(taskId);

      // Start polling
      const intervalId = setInterval(() => {
        checkTaskStatus(taskId).then((shouldContinue) => {
          if (!shouldContinue) {
            clearInterval(intervalId);
            pollingRefs.current.delete(taskId);
          }
        });
      }, pollInterval);

      pollingRefs.current.set(taskId, intervalId);
    },
    [enabled, checkTaskStatus, pollInterval]
  );

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

  const getTaskStatus = useCallback(
    (taskId: string): TaskStatus | undefined => {
      return activeTasks.get(taskId);
    },
    [activeTasks]
  );

  const hasActiveTasks = Array.from(activeTasks.values()).some(
    (task) =>
      task.status === 'Processing' || task.status === 'Pending'
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