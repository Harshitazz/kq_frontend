import { Mic, Volume2 } from "lucide-react";

interface QueryPanelProps {
  question: string;
  selectedLanguage: string;
  isLoading: boolean;
  hasActiveTasks: boolean;
  selectedTaskIds: string[];
  activeTasks: Array<{ task_id: string; status: string }>;
  answer: string;
  sourceChunks: any[];
  relevantNodes: any[];
  highlightedNodes: string[];
  isRecording: boolean;
  isVoiceSupported: boolean;
  onQuestionChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onAskQuestion: () => void;
  onToggleRecording: () => void;
  onReadAnswer: () => void;
  onHighlightNodes: () => void;
  onSetHighlightedNodes: (nodeNames: string[]) => void;
}

const LANGUAGE_OPTIONS = [
  ["en", "English"],
  ["hi", "Hindi"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
  ["ar", "Arabic"],
  ["ru", "Russian"],
] as const;

export function QueryPanel({
  question,
  selectedLanguage,
  isLoading,
  hasActiveTasks,
  selectedTaskIds,
  activeTasks,
  answer,
  sourceChunks,
  relevantNodes,
  highlightedNodes,
  isRecording,
  isVoiceSupported,
  onQuestionChange,
  onLanguageChange,
  onAskQuestion,
  onToggleRecording,
  onReadAnswer,
  onHighlightNodes,
  onSetHighlightedNodes,
}: QueryPanelProps) {
  const formatAnswerHtml = (text: string) => {
    if (!text) return "";

    const escapeHtml = (unsafe: string) =>
      unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");

    let out = escapeHtml(text);
    out = out.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    const lines = out.split(/\r?\n/);
    const isList = lines.every((line) => line.trim().match(/^(-|\d+\.)\s+/) || line.trim() === "");

    if (isList) {
      const items = lines.filter((line) => line.trim()).map((line) => line.replace(/^(-|\d+\.)\s+/, ""));
      return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
    }

    return out.replace(/\n/g, "<br/>");
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-800">Language</label>
        <select
          value={selectedLanguage}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="w-full px-3 py-2 border rounded text-sm text-gray-800"
          disabled={isLoading}
        >
          {LANGUAGE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

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
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder="Enter your question about the documents..."
            className="flex-1 px-3 py-2 border rounded text-sm h-24 resize-none text-gray-800 placeholder-gray-400"
            disabled={isLoading}
          />
          {isVoiceSupported && (
            <button
              onClick={onToggleRecording}
              className={`p-2 rounded-lg transition-colors ${
                isRecording ? "bg-red-500 hover:bg-red-600 text-white" : "bg-teal-500 hover:bg-teal-600 text-white"
              }`}
              disabled={isLoading}
              title={isRecording ? "Stop recording" : "Start voice input"}
              type="button"
            >
              <Mic size={18} />
            </button>
          )}
        </div>
        <button
          onClick={onAskQuestion}
          disabled={isLoading || !question.trim() || hasActiveTasks || selectedTaskIds.length === 0}
          className="mt-2 w-full px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 shadow-sm transition-all duration-200 font-medium"
          type="button"
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
                  onClick={onReadAnswer}
                  className="p-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded transition-colors"
                  title="Read answer aloud"
                  type="button"
                >
                  <Volume2 size={16} />
                </button>
              )}
            </div>
            <div
              className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
              dangerouslySetInnerHTML={{ __html: formatAnswerHtml(answer) }}
            />
          </div>

          {sourceChunks.length > 0 && (
            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-700">Source Chunks ({sourceChunks.length})</p>
                {relevantNodes.length > 0 && (
                  <button
                    onClick={onHighlightNodes}
                    className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                    type="button"
                  >
                    Highlight Nodes in Graph
                  </button>
                )}
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sourceChunks.map((chunk, idx) => (
                  <div key={`${chunk.source}-${idx}`} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs font-semibold text-gray-600 mb-2">
                      {chunk.source} {chunk.page !== "?" && `(Page ${chunk.page}${chunk.total_pages !== "?" ? ` of ${chunk.total_pages}` : ""})`}
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{chunk.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {relevantNodes.length > 0 && (
            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm font-bold text-gray-700 mb-2">Relevant Graph Nodes ({relevantNodes.length})</p>
              <div className="flex flex-wrap gap-2">
                {relevantNodes.map((node, idx) => (
                  <span
                    key={`${node.name}-${idx}`}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium ${
                      highlightedNodes.includes(node.name) ? "bg-teal-600 text-white" : "bg-teal-100 text-teal-700"
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
  );
}
