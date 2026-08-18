import type { Dispatch, SetStateAction } from "react";
import { NODE_COLORS, NODE_BORDER_COLORS } from "../../_utils/graph";

interface GraphFilterPanelProps {
  nodeTypes: string[];
  selectedTaskIds: string[];
  filteredNodeTypes: Set<string>;
  onToggleFilters: () => void;
  showFilters: boolean;
  onFilterChange: Dispatch<SetStateAction<Set<string>>>;
  graphNodeCount: number;
  graphLinkCount: number;
  onRefresh: () => void;
}

export function GraphFilterPanel({
  nodeTypes,
  selectedTaskIds,
  filteredNodeTypes,
  onToggleFilters,
  showFilters,
  onFilterChange,
  graphNodeCount,
  graphLinkCount,
  onRefresh,
}: GraphFilterPanelProps) {
  return (
    <div className="bg-gradient-to-br from-white via-teal-50 to-emerald-50 rounded-xl shadow-2xl border border-teal-200 p-5 max-w-xs z-10 max-h-[90vh] overflow-y-auto backdrop-blur-sm animate-in fade-in slide-in-from-top-5 duration-300">
      <div className="text-sm font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">
        Selected Graphs
      </div>

      {selectedTaskIds.length > 0 ? (
        <div className="mb-3 space-y-1">
          {selectedTaskIds.map((taskId, idx) => (
            <div key={taskId} className="px-2 py-1 text-xs bg-gradient-to-r from-teal-100 to-emerald-100 border border-teal-300 rounded-lg shadow-sm">
              {idx + 1}. {taskId.substring(0, 12)}...
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-3 px-2 py-1 text-xs text-gray-700 bg-gray-50 rounded-lg">All Graphs</div>
      )}

      <button
        onClick={onToggleFilters}
        className="mb-2 px-3 py-1 text-xs bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-lg w-full shadow-md transition-all duration-200 font-medium"
        type="button"
      >
        {showFilters ? "Hide" : "Show"} Filters
      </button>

      {showFilters && nodeTypes.length > 0 && (
        <div className="mb-3 p-3 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-lg border border-teal-200 shadow-sm">
          <div className="text-xs font-semibold mb-2 text-teal-700">Filter Node Types:</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {nodeTypes.map((type) => (
              <label key={type} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={!filteredNodeTypes.has(type)}
                  onChange={(e) => {
                    onFilterChange((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) {
                        next.delete(type);
                      } else {
                        next.add(type);
                      }
                      return next;
                    });
                  }}
                  className="w-3 h-3"
                />
                <span>{type}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="text-sm font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">Legend</div>
      <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
        {nodeTypes.map((type) => {
          const color = NODE_COLORS[type] || NODE_COLORS.OTHER;
          return (
            <div key={type} className="flex items-center gap-2 p-1 hover:bg-teal-50 rounded transition-colors">
              <div className="w-5 h-5 rounded-lg shadow-sm border border-gray-300" style={{ background: color }} />
              <span className="font-medium text-gray-700">{type}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-xs text-gray-800">
        <div className="font-semibold">Nodes: {graphNodeCount} | Links: {graphLinkCount}</div>
        {filteredNodeTypes.size > 0 && (
          <div className="text-orange-700 font-medium mt-1">{filteredNodeTypes.size} type(s) hidden</div>
        )}
      </div>

      <button
        onClick={onRefresh}
        className="mt-2 px-3 py-2 text-xs bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-lg w-full shadow-md transition-all duration-200 font-semibold"
        type="button"
      >
        Refresh
      </button>
    </div>
  );
}
