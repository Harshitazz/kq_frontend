"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import KnowledgeGraph from "../_components/KnowledgeGraph";
import GraphSidebar from "../_components/GraphSidebar";
import { ProcessingOverlay } from "../_components/ProcessingOverlay";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://news-ai-394571818909.us-central1.run.app";

interface TaskStatus {
  task_id: string;
  status: string;
  progress?: number;
  message?: string;
}

export default function GraphPage() {
  const { isSignedIn } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasActiveTasks, setHasActiveTasks] = useState(false);
  const [activeTasks, setActiveTasks] = useState<TaskStatus[]>([]);
  
  // Use refs to track previous values and avoid unnecessary updates
  const prevHasActiveRef = useRef(false);
  const prevTasksRef = useRef<TaskStatus[]>([]);

  const handleTaskSelect = useCallback((taskIds: string[]) => {
    setSelectedTaskIds(taskIds);
    setRefreshKey(prev => prev + 1); // Trigger graph refresh
  }, []);

  const handleActiveTasksChange = useCallback((hasActive: boolean, tasks: TaskStatus[]) => {
    // Only update if values actually changed
    if (hasActive !== prevHasActiveRef.current || 
        tasks.length !== prevTasksRef.current.length ||
        tasks.some((task, idx) => task.task_id !== prevTasksRef.current[idx]?.task_id || 
                              task.status !== prevTasksRef.current[idx]?.status)) {
      prevHasActiveRef.current = hasActive;
      prevTasksRef.current = tasks;
      setHasActiveTasks(hasActive);
      setActiveTasks(tasks);
    }
  }, []);

  // Get the first active task's status for display
  const firstActiveTask = activeTasks.length > 0 ? activeTasks[0] : null;
  const processingMessage = firstActiveTask?.status === 'Processing' 
    ? 'Processing your documents...'
    : firstActiveTask?.status === 'Pending'
    ? 'Preparing to process...'
    : 'Processing your documents...';

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-800">Please sign in to view your knowledge graph</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 font-sans">
      {/* Processing Overlay */}
      <ProcessingOverlay
        isVisible={hasActiveTasks}
        message={processingMessage}
        progress={firstActiveTask?.progress}
        taskCount={activeTasks.length}
      />

      {/* Collapsible Sidebar */}
      <GraphSidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        apiUrl={API_URL}
        selectedTaskIds={selectedTaskIds}
        onTaskSelect={handleTaskSelect}
        onActiveTasksChange={handleActiveTasksChange}
      />
      
      {/* Main Graph Area */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-80' : 'ml-0'}`}>
        <div className="h-full w-full">
          <KnowledgeGraph key={refreshKey} apiUrl={API_URL} selectedTaskIds={selectedTaskIds} />
        </div>
      </div>
    </div>
  );
}
