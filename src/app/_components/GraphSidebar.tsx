"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { ChevronLeft, ChevronRight, Upload, Link as LinkIcon, MessageSquare, History, FileText, Mic, Volume2 } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import { useTaskPolling } from "../_hooks/useTaskPolling";
import { useVoice } from "../_hooks/useVoice";

interface GraphSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  apiUrl: string;
  selectedTaskIds: string[];
  onTaskSelect: (taskIds: string[]) => void;
  onActiveTasksChange?: (hasActiveTasks: boolean, activeTasks: any[]) => void;
}

interface HistoryItem {
  task_id: string;
  source: string;
  node_count: number;
  relationship_count: number;
  created_at: string;
}

export default function GraphSidebar({ isOpen, onToggle, apiUrl, selectedTaskIds: propSelectedTaskIds, onTaskSelect, onActiveTasksChange }: GraphSidebarProps) {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"upload" | "query" | "history">("upload");
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

  // Define fetchHistory
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
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  }, [apiUrl, getToken]);

  // Task polling hook
  const {
    activeTasks,
    startPolling,
    stopPolling,
    getTaskStatus,
    hasActiveTasks,
  } = useTaskPolling({
    apiUrl,
    getToken,
    onComplete: useCallback((taskId: string) => {
      // Auto-select the completed task and display the graph
      const newTaskIds = [...selectedTaskIds, taskId];
      setSelectedTaskIds(newTaskIds);
      onTaskSelect(newTaskIds);
      
      // Refresh history to show the new graph
      setTimeout(() => fetchHistory(), 1000);
    }, [selectedTaskIds, onTaskSelect, fetchHistory]),
    pollInterval: 3000,
    enabled: isOpen,
  });

  // Notify parent of active tasks changes
  const prevHasActiveRef = useRef(hasActiveTasks);
  const prevTasksRef = useRef(activeTasks);
  
  useEffect(() => {
    // Only notify if values actually changed
    const hasActiveChanged = prevHasActiveRef.current !== hasActiveTasks;
    
    // Compare tasks by creating a stable representation
    const currentTasksStr = JSON.stringify(activeTasks.map(t => ({ id: t.task_id, status: t.status })).sort((a, b) => a.id.localeCompare(b.id)));
    const prevTasksStr = JSON.stringify(prevTasksRef.current.map(t => ({ id: t.task_id, status: t.status })).sort((a, b) => a.id.localeCompare(b.id)));
    const tasksChanged = currentTasksStr !== prevTasksStr;
    
    if (hasActiveChanged || tasksChanged) {
      prevHasActiveRef.current = hasActiveTasks;
      prevTasksRef.current = activeTasks;
      onActiveTasksChange?.(hasActiveTasks, activeTasks);
    }
  }, [hasActiveTasks, activeTasks, onActiveTasksChange]);

  // Voice hook
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setPdfs([...pdfs, ...Array.from(event.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setPdfs(pdfs.filter((_, i) => i !== index));
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
    } catch (error) {
      toast.error("Error uploading PDFs. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const initializeVectorIndex = async () => {
    if (urls.filter(u => u.trim()).length === 0) {
      toast.error("Please enter at least one URL.");
      return;
    }

    setIsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${apiUrl}/initialize_vector_index`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ urls: urls.filter(u => u.trim()) }),
      });

      const data = await res.json();
      if (res.ok) {
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
      const res = await fetch(`${apiUrl}/ask_pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          question,
          task_ids: Array.from(selectedTaskIds)  // Send array of task_ids
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAnswer(data.answer || "");
        setSourceChunks(data.source_chunks || []);
        setRelevantNodes(data.relevant_nodes || []);
        setHighlightedNodes([]); // Reset highlights
      } else {
        toast.error("Error: " + data.detail);
      }
    } catch (error) {
      toast.error("Error asking question");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full bg-white/95 backdrop-blur-sm shadow-xl border-r border-gray-200 z-50 transition-transform duration-300 text-gray-900 font-sans ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } w-80 overflow-y-auto`}
      >
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Knowledge Graph</h2>
          <button
            onClick={onToggle}
            className="p-1.5 hover:bg-teal-100 rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === "upload"
                ? "border-b-2 border-teal-600 text-teal-700 bg-teal-50"
                : "text-gray-600 hover:text-teal-700 hover:bg-teal-50"
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab("query")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === "query"
                ? "border-b-2 border-teal-600 text-teal-700 bg-teal-50"
                : "text-gray-600 hover:text-teal-700 hover:bg-teal-50"
            }`}
          >
            Query
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === "history"
                ? "border-b-2 border-teal-600 text-teal-700 bg-teal-50"
                : "text-gray-600 hover:text-teal-700 hover:bg-teal-50"
            }`}
          >
            Graphs
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === "upload" && (
            <div className="space-y-4">
              {/* PDF Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Upload PDFs
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-800 hover:file:bg-blue-100"
                />
                {pdfs.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {pdfs.map((file, index) => (
                      <div key={index} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                        <span className="truncate text-gray-800">{file.name}</span>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={uploadPDFs}
                  disabled={isLoading || pdfs.length === 0}
                  className="mt-2 w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 shadow-sm transition-all duration-200 font-medium"
                >
                  {isLoading ? "Uploading..." : "Upload PDFs"}
                </button>
              </div>

              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-800">
                  <LinkIcon className="w-4 h-4 inline mr-1" />
                  Process URLs
                </label>
                {urls.map((url, index) => (
                  <input
                    key={index}
                    type="text"
                    value={url}
                    onChange={(e) => {
                      const newUrls = [...urls];
                      newUrls[index] = e.target.value;
                      setUrls(newUrls);
                    }}
                    placeholder="Enter URL"
                    className="w-full mb-2 px-3 py-2 border rounded text-sm text-gray-800 placeholder-gray-400"
                  />
                ))}
                <div className="flex gap-2">
                  <button
                    onClick={() => setUrls([...urls, ""])}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Add URL
                  </button>
                  {urls.length > 1 && (
                    <button
                      onClick={() => setUrls(urls.slice(0, -1))}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <button
                  onClick={initializeVectorIndex}
                  disabled={isLoading || urls.filter(u => u.trim()).length === 0}
                  className="mt-2 w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 shadow-sm transition-all duration-200 font-medium"
                >
                  {isLoading ? "Processing..." : "Process URLs"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "query" && (
            <div className="space-y-4">
              {/* Language Selection */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-800">Language</label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm text-gray-800"
                  disabled={isLoading}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="zh">Chinese</option>
                  <option value="ar">Arabic</option>
                  <option value="ru">Russian</option>
                </select>
              </div>

              {/* Active Task Status */}
              {hasActiveTasks && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Processing Tasks:</p>
                  {activeTasks.map((task) => (
                    <div key={task.task_id} className="text-xs text-blue-600 mt-1">
                      <span className="font-mono">{task.task_id.substring(0, 12)}...</span>
                      <span className="ml-2">{task.status}</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-800">Ask a Question</label>
                <div className="flex items-center gap-2">
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Enter your question about the documents..."
                    className="flex-1 px-3 py-2 border rounded text-sm h-24 resize-none text-gray-800 placeholder-gray-400"
                    disabled={isLoading}
                  />
                  {isVoiceSupported && (
                    <button
                      onClick={isRecording ? stopSpeechRecognition : startSpeechRecognition}
                      className={`p-2 rounded-lg transition-colors ${
                        isRecording 
                          ? "bg-red-500 hover:bg-red-600 text-white" 
                          : "bg-teal-500 hover:bg-teal-600 text-white"
                      }`}
                      disabled={isLoading}
                      title={isRecording ? "Stop recording" : "Start voice input"}
                    >
                      <Mic size={18} />
                    </button>
                  )}
                </div>
                <button
                  onClick={askQuestion}
                  disabled={isLoading || !question.trim() || hasActiveTasks || selectedTaskIds.length === 0}
                  className="mt-2 w-full px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 shadow-sm transition-all duration-200 font-medium"
                >
                  {isLoading ? "Thinking..." : "Ask"}
                </button>
                {selectedTaskIds.length === 0 && (
                  <p className="mt-1 text-xs text-orange-600">Please select at least one graph from Graphs tab to query.</p>
                )}
                {hasActiveTasks && (
                  <p className="mt-1 text-xs text-orange-600">Please wait for processing to complete before asking questions.</p>
                )}
              </div>
              {answer && (
                <div className="mt-4 space-y-4">
                  <div className="p-4 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-lg border border-teal-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">Answer:</p>
                      {isVoiceSupported && (
                        <button
                          onClick={() => textToSpeech(answer, selectedLanguage)}
                          className="p-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded transition-colors"
                          title="Read answer aloud"
                        >
                          <Volume2 size={16} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{answer}</p>
                  </div>

                  {/* Source Chunks */}
                  {sourceChunks.length > 0 && (
                    <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-gray-700">Source Chunks ({sourceChunks.length})</p>
                        {relevantNodes.length > 0 && (
                          <button
                            onClick={() => {
                              const nodeNames = relevantNodes.map(n => n.name);
                              setHighlightedNodes(nodeNames);
                              // Trigger graph highlight via custom event
                              window.dispatchEvent(new CustomEvent('highlightNodes', { detail: nodeNames }));
                            }}
                            className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                          >
                            Highlight Nodes in Graph
                          </button>
                        )}
                      </div>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {sourceChunks.map((chunk, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="text-xs font-semibold text-gray-600 mb-2">
                              {chunk.source} {chunk.page !== "?" && `(Page ${chunk.page}${chunk.total_pages !== "?" ? ` of ${chunk.total_pages}` : ""})`}
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {chunk.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Relevant Nodes */}
                  {relevantNodes.length > 0 && (
                    <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <p className="text-sm font-bold text-gray-700 mb-2">Relevant Graph Nodes ({relevantNodes.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {relevantNodes.map((node, idx) => (
                          <span
                            key={idx}
                            className={`px-2.5 py-1 text-xs rounded-lg font-medium ${
                              highlightedNodes.includes(node.name)
                                ? "bg-teal-600 text-white"
                                : "bg-teal-100 text-teal-700"
                            }`}
                          >
                            {node.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-4">
              {/* Selected Graphs Display */}
              {selectedTaskIds.length > 0 && (
                <div className="p-3 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-300 rounded-lg shadow-sm mb-4">
                  <p className="text-xs font-bold mb-2 text-teal-700">
                    Selected Graphs ({selectedTaskIds.length}):
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedTaskIds.map((taskId, idx) => {
                      const kgItem = kgHistory.find(h => h.task_id === taskId);
                      const displayName = kgItem?.source || taskId.substring(0, 20);
                      
                      return (
                        <div key={taskId} className="flex items-center justify-between text-xs bg-white/70 p-2 rounded border border-teal-200">
                          <span className="truncate text-gray-700 flex-1">{idx + 1}. {displayName}</span>
                          <button
                            onClick={() => {
                              const newIds = selectedTaskIds.filter(id => id !== taskId);
                              setSelectedTaskIds(newIds);
                              onTaskSelect(newIds);
                            }}
                            className="text-red-500 hover:text-red-700 ml-2 font-bold"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTaskIds([]);
                      onTaskSelect([]);
                    }}
                    className="mt-2 text-xs text-teal-600 hover:text-teal-800 font-semibold underline"
                  >
                    Clear All
                  </button>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-semibold mb-2 text-gray-800">
                  Knowledge Graphs
                  <span className="text-xs font-normal text-gray-500 ml-2">
                    (Select one or more to view combined graph)
                  </span>
                </h3>
                {isLoading && selectedTaskIds.length > 0 && (
                  <div className="mb-3 p-2 bg-teal-50 border border-teal-200 rounded-lg">
                    <p className="text-xs text-teal-700 font-medium">Loading combined graph...</p>
                  </div>
                )}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {kgHistory.length === 0 ? (
                    <p className="text-xs text-gray-700">No knowledge graphs yet. Upload PDFs to create graphs.</p>
                  ) : (
                    kgHistory.map((item) => {
                      const isSelected = selectedTaskIds.includes(item.task_id);
                      
                      return (
                        <div
                          key={item.task_id}
                          className={`p-3 border rounded-lg transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? "bg-gradient-to-r from-teal-100 to-emerald-100 border-teal-400 shadow-md ring-2 ring-teal-300"
                              : "bg-white border-gray-200 hover:bg-gradient-to-r hover:from-teal-50 hover:to-emerald-50 hover:border-teal-300 hover:shadow-sm"
                          }`}
                          onClick={() => {
                            let newIds: string[];
                            if (isSelected) {
                              newIds = selectedTaskIds.filter(id => id !== item.task_id);
                            } else {
                              newIds = [...selectedTaskIds, item.task_id];
                            }
                            setSelectedTaskIds(newIds);
                            onTaskSelect(newIds);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                let newIds: string[];
                                if (e.target.checked) {
                                  newIds = [...selectedTaskIds, item.task_id];
                                } else {
                                  newIds = selectedTaskIds.filter(id => id !== item.task_id);
                                }
                                setSelectedTaskIds(newIds);
                                onTaskSelect(newIds);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-xs font-semibold truncate text-gray-800">{item.source}</p>
                                {isSelected && (
                                  <span className="text-xs font-semibold text-teal-700 bg-teal-200 px-2 py-0.5 rounded whitespace-nowrap">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600">
                                {item.node_count} nodes • {item.relationship_count} relationships
                              </p>
                              <p className="text-xs text-gray-400 font-mono mt-1 truncate">
                                {item.task_id.substring(0, 16)}...
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed left-4 top-4 z-40 p-3 bg-gray-900 text-white shadow-lg rounded-full hover:bg-gray-800 transition-all duration-200 hover:scale-110"
          aria-label="Open sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </>
  );
}
