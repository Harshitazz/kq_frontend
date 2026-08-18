"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import { useTaskPolling } from "../_hooks/useTaskPolling";
import { useVoice } from "../_hooks/useVoice";
import { SidebarTabs } from "./sidebar/SidebarTabs";
import { UploadPanel } from "./sidebar/UploadPanel";
import { QueryPanel } from "./sidebar/QueryPanel";
import { HistoryPanel } from "./sidebar/HistoryPanel";
import type { HistoryItem, SidebarTab } from "../_types/graph";

interface GraphSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  apiUrl: string;
  selectedTaskIds: string[];
  onTaskSelect: (taskIds: string[]) => void;
  onActiveTasksChange?: (hasActiveTasks: boolean, activeTasks: any[]) => void;
}

export default function GraphSidebar({
  isOpen,
  onToggle,
  apiUrl,
  selectedTaskIds: propSelectedTaskIds,
  onTaskSelect,
  onActiveTasksChange,
}: GraphSidebarProps) {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<SidebarTab>("upload");
  const [urls, setUrls] = useState([""]);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sourceChunks, setSourceChunks] = useState<any[]>([]);
  const [relevantNodes, setRelevantNodes] = useState<any[]>([]);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [kgHistory, setKgHistory] = useState<HistoryItem[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(propSelectedTaskIds || []);
  const [selectedLanguage, setSelectedLanguage] = useState("en");

  const fetchHistory = useCallback(async () => {
    try {
      const token = await getToken();
      const kgRes = await fetch(`${apiUrl}/knowledge_graph/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (kgRes.ok) {
        const kgData = await kgRes.json();
        setKgHistory(kgData.history || []);
      }
    } catch {
      // Silent fail: history refresh is non-critical and should not spam the console.
    }
  }, [apiUrl, getToken]);

  const {
    activeTasks,
    startPolling,
    hasActiveTasks,
  } = useTaskPolling({
    apiUrl,
    getToken,
    onComplete: useCallback(
      (taskId: string) => {
        const nextTaskIds = [...selectedTaskIds, taskId];
        setSelectedTaskIds(nextTaskIds);
        onTaskSelect(nextTaskIds);
        setTimeout(() => fetchHistory(), 1000);
      },
      [selectedTaskIds, onTaskSelect, fetchHistory]
    ),
    pollInterval: 3000,
    enabled: isOpen,
  });

  const prevHasActiveRef = useRef(hasActiveTasks);
  const prevTasksRef = useRef(activeTasks);

  useEffect(() => {
    const hasActiveChanged = prevHasActiveRef.current !== hasActiveTasks;
    const currentTasksStr = JSON.stringify(
      activeTasks
        .map((task) => ({ id: task.task_id, status: task.status }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );
    const prevTasksStr = JSON.stringify(
      prevTasksRef.current
        .map((task) => ({ id: task.task_id, status: task.status }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );
    const tasksChanged = currentTasksStr !== prevTasksStr;

    if (hasActiveChanged || tasksChanged) {
      prevHasActiveRef.current = hasActiveTasks;
      prevTasksRef.current = activeTasks;
      onActiveTasksChange?.(hasActiveTasks, activeTasks);
    }
  }, [hasActiveTasks, activeTasks, onActiveTasksChange]);

  const {
    isRecording,
    isSupported: isVoiceSupported,
    startSpeechRecognition,
    stopSpeechRecognition,
    textToSpeech,
  } = useVoice({
    onTranscript: (text) => {
      setQuestion(text);
      stopSpeechRecognition();
    },
    language: selectedLanguage,
  });

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  useEffect(() => {
    setSelectedTaskIds(propSelectedTaskIds || []);
  }, [propSelectedTaskIds]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setPdfs((current) => [...current, ...Array.from(event.target.files || [])]);
    }
  };

  const removeFile = (index: number) => {
    setPdfs((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const uploadPDFs = async () => {
    if (pdfs.length === 0) {
      toast.error("Please select at least one PDF file.");
      return;
    }

    const formData = new FormData();
    pdfs.forEach((file) => formData.append("files", file));
    setIsLoading(true);

    try {
      const token = await getToken({ template: "first" });
      if (!token) {
        toast.error("Failed to retrieve authentication token.");
        return;
      }

      const response = await axios.post(`${apiUrl}/upload_pdfs/`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const taskId = response.data.task_id;
      if (taskId) {
        startPolling(taskId);
        toast.success("PDFs uploaded successfully! Processing started. You'll be notified when complete.");
      } else {
        toast.success("PDFs uploaded successfully! Processing started.");
      }

      setPdfs([]);
      setTimeout(() => fetchHistory(), 2000);
    } catch {
      toast.error("Error uploading PDFs. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const initializeVectorIndex = async () => {
    if (urls.filter((url) => url.trim()).length === 0) {
      toast.error("Please enter at least one URL.");
      return;
    }

    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(`${apiUrl}/initialize_vector_index`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ urls: urls.filter((url) => url.trim()) }),
      });

      const data = await response.json();
      if (response.ok) {
        const taskId = data.task_id;
        if (taskId) {
          startPolling(taskId);
          toast.success("URLs processing started! You'll be notified when complete.");
        } else {
          toast.success("URLs processing started!");
        }
        setUrls([""]);
        setTimeout(() => fetchHistory(), 2000);
      } else {
        toast.error("Error: " + data.detail);
      }
    } catch (error) {
      toast.error("Network error: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const askQuestion = async () => {
    if (!question.trim()) {
      toast.error("Please enter a question.");
      return;
    }

    if (selectedTaskIds.length === 0) {
      toast.error("Please select at least one graph from Graphs tab to query.");
      return;
    }

    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(`${apiUrl}/ask_pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question,
          task_ids: Array.from(selectedTaskIds),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setAnswer(data.answer || "");
        setSourceChunks(data.source_chunks || []);
        setRelevantNodes(data.relevant_nodes || []);
        setHighlightedNodes([]);
      } else {
        toast.error("Error: " + data.detail);
      }
    } catch {
      toast.error("Error asking question");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTaskSelection = (taskId: string, checked?: boolean) => {
    const shouldSelect = checked ?? !selectedTaskIds.includes(taskId);
    const nextTaskIds = shouldSelect
      ? [...selectedTaskIds, taskId]
      : selectedTaskIds.filter((id) => id !== taskId);

    setSelectedTaskIds(nextTaskIds);
    onTaskSelect(nextTaskIds);
  };

  const [sidebarWidth, setSidebarWidth] = useState<number>(320);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = event.clientX - startXRef.current;
      const nextWidth = Math.max(240, Math.min(720, startWidthRef.current + deltaX));
      setSidebarWidth(nextWidth);
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const startResize = (event: React.MouseEvent) => {
    isResizingRef.current = true;
    startXRef.current = event.clientX;
    startWidthRef.current = sidebarWidth;
  };

  return (
    <>
      <div
        style={{ width: sidebarWidth }}
        className={`fixed left-0 top-0 h-full bg-white/95 backdrop-blur-sm shadow-xl border-r border-gray-200 z-50 transition-transform duration-300 text-gray-900 font-sans ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } overflow-y-auto`}
      >
        <div
          onMouseDown={startResize}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize z-50"
          style={{ touchAction: "none" }}
          aria-hidden
        />

        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Knowledge Graph</h2>
          <button onClick={onToggle} className="p-1.5 hover:bg-teal-100 rounded-lg transition-colors" aria-label="Close sidebar" type="button">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <SidebarTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="p-4">
          {activeTab === "upload" && (
            <UploadPanel
              pdfs={pdfs}
              urls={urls}
              isLoading={isLoading}
              onFileChange={handleFileChange}
              onRemoveFile={removeFile}
              onUploadPdfs={uploadPDFs}
              onUrlsChange={setUrls}
              onInitializeVectorIndex={initializeVectorIndex}
            />
          )}

          {activeTab === "query" && (
            <QueryPanel
              question={question}
              selectedLanguage={selectedLanguage}
              isLoading={isLoading}
              hasActiveTasks={hasActiveTasks}
              selectedTaskIds={selectedTaskIds}
              activeTasks={activeTasks}
              answer={answer}
              sourceChunks={sourceChunks}
              relevantNodes={relevantNodes}
              highlightedNodes={highlightedNodes}
              isRecording={isRecording}
              isVoiceSupported={isVoiceSupported}
              onQuestionChange={setQuestion}
              onLanguageChange={setSelectedLanguage}
              onAskQuestion={askQuestion}
              onToggleRecording={() => (isRecording ? stopSpeechRecognition() : startSpeechRecognition())}
              onReadAnswer={() => textToSpeech(answer, selectedLanguage)}
              onHighlightNodes={() => {
                const nodeNames = relevantNodes.map((node) => node.name);
                setHighlightedNodes(nodeNames);
                window.dispatchEvent(new CustomEvent("highlightNodes", { detail: nodeNames }));
              }}
              onSetHighlightedNodes={setHighlightedNodes}
            />
          )}

          {activeTab === "history" && (
            <HistoryPanel
              kgHistory={kgHistory}
              selectedTaskIds={selectedTaskIds}
              isLoading={isLoading}
              onToggleTask={toggleTaskSelection}
              onClearAll={() => {
                setSelectedTaskIds([]);
                onTaskSelect([]);
              }}
            />
          )}
        </div>
      </div>

      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed left-4 top-4 z-40 p-3 bg-gray-900 text-white shadow-lg rounded-full hover:bg-gray-800 transition-all duration-200 hover:scale-110"
          aria-label="Open sidebar"
          type="button"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </>
  );
}
