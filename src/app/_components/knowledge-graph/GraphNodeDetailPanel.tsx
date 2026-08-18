import { safeText } from "../../_utils/graph";
import type { GraphNode } from "../../_types/graph";

interface GraphNodeDetailPanelProps {
  selectedNode: GraphNode | null;
  loadingExplanation: boolean;
  nodeExplanation: string | null;
  onClose: () => void;
}

export function GraphNodeDetailPanel({
  selectedNode,
  loadingExplanation,
  nodeExplanation,
  onClose,
}: GraphNodeDetailPanelProps) {
  if (!selectedNode) return null;

  return (
    <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200 p-6 max-w-sm max-h-[80vh] overflow-y-auto font-sans">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-xl text-gray-900">{safeText(selectedNode.name)}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition-colors"
          type="button"
        >
          ×
        </button>
      </div>

      <div className="text-sm space-y-3 text-gray-900">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Type:</span>
          <span className="text-gray-900">{safeText(selectedNode.type)}</span>
        </div>

        {selectedNode.properties?.source && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Source:</span>
            <span className="text-xs text-gray-900">{safeText(selectedNode.properties.source)}</span>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="font-semibold mb-3 text-gray-900">Explanation:</div>
          {loadingExplanation ? (
            <div className="text-sm text-gray-900 font-medium">Loading explanation...</div>
          ) : nodeExplanation ? (
            <p className="text-sm text-gray-900 leading-relaxed">{nodeExplanation}</p>
          ) : (
            <p className="text-sm text-gray-600">Click to load explanation</p>
          )}
        </div>
      </div>
    </div>
  );
}
