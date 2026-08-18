import type { ReactNode } from "react";
import ReactFlow, { Background, BackgroundVariant, ConnectionMode, Controls, MiniMap, Panel, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { NODE_COLORS, safeText } from "../../_utils/graph";
import type { GraphData } from "../../_types/graph";
import { GraphFilterPanel } from "./GraphFilterPanel";

interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any[]) => void;
  onEdgesChange: (changes: any[]) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  graphData: GraphData;
  nodeTypes: string[];
  selectedTaskIds: string[];
  filteredNodeTypes: Set<string>;
  setFilteredNodeTypes: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  fetchGraphData: () => void;
  showFilters: boolean;
  onToggleFilters: () => void;
}

export function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onPaneClick,
  graphData,
  nodeTypes,
  selectedTaskIds,
  filteredNodeTypes,
  setFilteredNodeTypes,
  fetchGraphData,
  showFilters,
  onToggleFilters,
}: GraphCanvasProps) {
  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 2, minZoom: 0.2, includeHiddenNodes: false }}
        attributionPosition="bottom-left"
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        minZoom={0.1}
        maxZoom={2}
        elevateEdgesOnSelect={false}
        elevateNodesOnSelect={true}
        defaultEdgeOptions={{ style: { strokeWidth: 4, opacity: 1 }, type: "step" }}
        nodeOrigin={[0.5, 0.5]}
      >
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const nodeData = node.data?.nodeData;
            return nodeData ? NODE_COLORS[safeText(nodeData.type)] || NODE_COLORS.OTHER : "#C7CEEA";
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />

        <Panel position="top-right">
          <GraphFilterPanel
            nodeTypes={nodeTypes}
            selectedTaskIds={selectedTaskIds}
            filteredNodeTypes={filteredNodeTypes}
            showFilters={showFilters}
            onToggleFilters={onToggleFilters}
            onFilterChange={setFilteredNodeTypes}
            graphNodeCount={graphData.nodes.length}
            graphLinkCount={graphData.links.length}
            onRefresh={fetchGraphData}
          />
        </Panel>
      </ReactFlow>
    </div>
  );
}
