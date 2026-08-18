import type { HistoryItem } from "../../_types/sidebar";

interface HistoryPanelProps {
  kgHistory: HistoryItem[];
  selectedTaskIds: string[];
  isLoading: boolean;
  onToggleTask: (taskId: string, checked?: boolean) => void;
  onClearAll: () => void;
}

export function HistoryPanel({
  kgHistory,
  selectedTaskIds,
  isLoading,
  onToggleTask,
  onClearAll,
}: HistoryPanelProps) {
  return (
    <div className="space-y-4">
      {selectedTaskIds.length > 0 && (
        <div className="p-3 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-300 rounded-lg shadow-sm mb-4">
          <p className="text-xs font-bold mb-2 text-teal-700">Selected Graphs ({selectedTaskIds.length}):</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {selectedTaskIds.map((taskId, idx) => {
              const kgItem = kgHistory.find((h) => h.task_id === taskId);
              const displayName = kgItem?.source || taskId.substring(0, 20);

              return (
                <div key={taskId} className="flex items-center justify-between text-xs bg-white/70 p-2 rounded border border-teal-200">
                  <span className="truncate text-gray-700 flex-1">{idx + 1}. {displayName}</span>
                  <button
                    onClick={() => onToggleTask(taskId)}
                    className="text-red-500 hover:text-red-700 ml-2 font-bold"
                    type="button"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <button onClick={onClearAll} className="mt-2 text-xs text-teal-600 hover:text-teal-800 font-semibold underline" type="button">
            Clear All
          </button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2 text-gray-800">
          Knowledge Graphs
          <span className="text-xs font-normal text-gray-500 ml-2">(Select one or more to view combined graph)</span>
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
                  onClick={() => onToggleTask(item.task_id)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleTask(item.task_id, e.target.checked);
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
                      <p className="text-xs text-gray-400 font-mono mt-1 truncate">{item.task_id.substring(0, 16)}...</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
