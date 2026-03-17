"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  useNodesState,
  useEdgesState,
  ConnectionMode,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { useAuth } from "@clerk/nextjs";

interface GraphNode {
  id: number;
  name: string;
  type: string;
  label: string;
  properties?: Record<string, any>;
}

interface GraphLink {
  source: number | GraphNode;
  target: number | GraphNode;
  type: string;
  label: string;
  properties?: Record<string, any>;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface KnowledgeGraphProps {
  apiUrl: string;
  selectedTaskIds?: string[] | null;
}

// Highly differentiable color scheme - distinct colors for each type
const NODE_COLORS: Record<string, string> = {
  TOPIC: "#DBEAFE",        // Blue-200
  CONCEPT: "#D1FAE5",      // Green-200
  THEORY: "#FEF3C7",       // Yellow-200
  METHOD: "#FCE7F3",       // Pink-200
  PERSON: "#FED7AA",       // Orange-200
  ORGANIZATION: "#E9D5FF", // Purple-200
  LOCATION: "#BFDBFE",     // Blue-200
  EVENT: "#FECACA",        // Red-200
  PRODUCT: "#FEF08A",      // Yellow-200
  BUDGET_ITEM: "#FCA5A5",  // Red-300
  CATEGORY: "#C7D2FE",     // Indigo-200
  TECHNOLOGY: "#A7F3D0",   // Emerald-200
  TOOL: "#BAE6FD",         // Cyan-200
  PROCESS: "#DDD6FE",      // Violet-200
  METRIC: "#99F6E4",       // Teal-200
  OTHER: "#E5E7EB",        // Gray-200
};

const NODE_BORDER_COLORS: Record<string, string> = {
  TOPIC: "#3B82F6",        // Blue-500
  CONCEPT: "#10B981",      // Emerald-600
  THEORY: "#EAB308",       // Yellow-600
  METHOD: "#EC4899",       // Pink-600
  PERSON: "#F97316",       // Orange-600
  ORGANIZATION: "#9333EA", // Purple-600
  LOCATION: "#2563EB",     // Blue-600
  EVENT: "#DC2626",        // Red-600
  PRODUCT: "#84CC16",      // Lime-600
  BUDGET_ITEM: "#EF4444",  // Red-500
  CATEGORY: "#6366F1",     // Indigo-500
  TECHNOLOGY: "#059669",   // Emerald-700
  TOOL: "#0891B2",         // Cyan-600
  PROCESS: "#7C3AED",      // Violet-600
  METRIC: "#14B8A6",       // Teal-600
  OTHER: "#6B7280",        // Gray-500
};

export default function KnowledgeGraph({ apiUrl, selectedTaskIds: propSelectedTaskIds }: KnowledgeGraphProps) {
  const { getToken } = useAuth();
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(propSelectedTaskIds || []);
  const [nodeExplanation, setNodeExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [filteredNodeTypes, setFilteredNodeTypes] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Wait for token to be available
      let token = null;
      try {
        token = await getToken();
      } catch (tokenError) {
        // Token might not be ready yet, wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 500));
        token = await getToken();
      }
      
      if (!token) {
        throw new Error("Authentication token not available");
      }
      
      const taskIds = propSelectedTaskIds || selectedTaskIds;
      // Fetch data for all selected task IDs and combine them
      if (taskIds.length === 0) {
        const url = `${apiUrl}/knowledge_graph?limit=50`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setGraphData(data);
        }
      } else {
        // Fetch and combine multiple graphs
        const fetchPromises = taskIds.map(taskId =>
          fetch(`${apiUrl}/knowledge_graph?limit=50&task_id=${taskId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(res => res.ok ? res.json() : null)
        );
        const results = await Promise.all(fetchPromises);
        const combinedData: GraphData = { nodes: [], links: [] };
        const nodeMap = new Map<number, GraphNode>();
        const linkSet = new Set<string>();
        
        results.forEach(data => {
          if (data) {
            data.nodes?.forEach((node: GraphNode) => {
              if (!nodeMap.has(node.id)) {
                nodeMap.set(node.id, node);
              }
            });
            data.links?.forEach((link: GraphLink) => {
              const linkKey = `${link.source}-${link.target}-${link.type}`;
              if (!linkSet.has(linkKey)) {
                linkSet.add(linkKey);
                combinedData.links.push(link);
              }
            });
          }
        });
        combinedData.nodes = Array.from(nodeMap.values());
        setGraphData(combinedData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load graph";
      setError(errorMessage);
      console.error("Error fetching graph data:", err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getToken, propSelectedTaskIds, selectedTaskIds]);

  useEffect(() => {
    const newTaskIds = propSelectedTaskIds || [];
    if (JSON.stringify(newTaskIds.sort()) !== JSON.stringify(selectedTaskIds.sort())) {
      setSelectedTaskIds(newTaskIds);
    }
  }, [propSelectedTaskIds, selectedTaskIds]);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  const nodeTypes = useMemo(() => {
    const types = new Set<string>();
    graphData.nodes.forEach((node) => {
      types.add(node.type);
    });
    return Array.from(types).sort();
  }, [graphData.nodes]);

  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
    if (!graphData.nodes.length) {
      return { nodes: [], edges: [] };
    }
    
    const nodesToUse = filteredNodeTypes.size > 0
      ? graphData.nodes.filter(node => !filteredNodeTypes.has(node.type))
      : graphData.nodes;
    
    if (!nodesToUse.length) {
      return { nodes: [], edges: [] };
    }
    
    const visibleNodeIds = new Set(nodesToUse.map(n => n.id));
    const edgesToUse = graphData.links.filter(link => {
      const sourceId = typeof link.source === "object" ? link.source.id : link.source;
      const targetId = typeof link.target === "object" ? link.target.id : link.target;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });

    const nodeIdMap = new Map<number, string>();
    
    const initialNodes: Node[] = nodesToUse.map((node) => {
      const flowId = `node-${node.id}`;
      nodeIdMap.set(node.id, flowId);
      
      const nodeName = node.name || "Unknown";
      const nodeType = node.type || "OTHER";
      const nodeColor = NODE_COLORS[nodeType] || NODE_COLORS.OTHER;
      const borderColor = NODE_BORDER_COLORS[nodeType] || NODE_BORDER_COLORS.OTHER;
      const width = Math.max(160, Math.min(250, nodeName.length * 9 + 50));
      const height = 80;

      return {
        id: flowId,
        type: "default",
        position: { x: 0, y: 0 },
        data: {
          label: (
            <div className="text-center font-sans">
              <div className="font-medium text-sm leading-tight text-gray-900">{nodeName}</div>
              <div className="text-xs text-gray-600 mt-1 font-normal">{nodeType}</div>
            </div>
          ),
          nodeData: node,
        },
        style: {
          background: nodeColor,
          border: `2px solid ${borderColor}`,
          borderRadius: "16px",
          padding: "12px",
          width: `${width}px`,
          height: `${height}px`,
          color: "#111827",
          fontSize: "14px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)",
          fontWeight: 500,
          fontFamily: "'Inter', sans-serif",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          cursor: "pointer",
        },
      };
    });

    const initialEdges: Edge[] = edgesToUse
      .map((link) => {
        const sourceId = typeof link.source === "object" ? link.source.id : link.source;
        const targetId = typeof link.target === "object" ? link.target.id : link.target;
        
        const sourceFlowId = nodeIdMap.get(sourceId);
        const targetFlowId = nodeIdMap.get(targetId);

        if (!sourceFlowId || !targetFlowId) {
          return null;
        }

        // Generate a unique color for each edge based on its ID for better differentiation
        // Modern color palette - teal/emerald/slate based for better differentiation
        const edgeColors = [
          "#14B8A6", // teal
          "#10B981", // emerald
          "#059669", // emerald-600
          "#0D9488", // teal-600
          "#0891B2", // cyan-600
          "#0284C7", // sky-600
          "#2563EB", // blue-600
          "#6366F1", // indigo-500
          "#7C3AED", // violet-600
          "#A855F7", // purple-500
          "#C026D3", // fuchsia-600
          "#DB2777", // pink-600
          "#E11D48", // rose-600
          "#DC2626", // red-600
          "#EA580C", // orange-600
          "#D97706", // amber-600
          "#CA8A04", // yellow-600
        ];
        const edgeColorIndex = Math.abs(
          (sourceFlowId + targetFlowId + link.type).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        ) % edgeColors.length;
        const edgeColor = edgeColors[edgeColorIndex];

        return {
          id: `edge-${sourceFlowId}-${targetFlowId}-${link.type}`,
          source: sourceFlowId,
          target: targetFlowId,
          label: link.type.length > 20 ? link.type.substring(0, 17) + "..." : link.type,
          labelStyle: { 
            fill: "#111827", 
            fontSize: "12px", 
            fontWeight: 700, 
            background: "rgba(255,255,255,1)", 
            padding: "6px 10px", 
            borderRadius: "8px", 
            fontFamily: "'Inter', sans-serif",
            pointerEvents: "none",
            border: `2px solid ${edgeColor}`,
            boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
          },
          style: { 
            stroke: edgeColor, 
            strokeWidth: 4, 
            opacity: 1,
          },
          markerEnd: {
            type: "arrowclosed",
            width: 24,
            height: 24,
            color: edgeColor,
          },
          type: "step",
          animated: false,
        } as Edge;
      })
      .filter((edge): edge is Edge => edge !== null);

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ 
      rankdir: "TB",
      nodesep: 60,   // Reduced for more compact layout
      ranksep: 80,   // Reduced for more compact layout
      align: "UL",
      ranker: "network-simplex",  // Better algorithm for avoiding overlaps
      acyclicer: "greedy",
      edgesep: 40,   // Reduced edge separation
      marginx: 40,
      marginy: 40,
    });

    initialNodes.forEach((node) => {
      const nodeData = node.data?.nodeData;
      const nodeName = nodeData?.name || "Node";
      const nodeWidth = Math.max(160, Math.min(250, nodeName.length * 9 + 50));
      // Reduced padding for more compact layout
      dagreGraph.setNode(node.id, { 
        width: nodeWidth + 20,  // Reduced padding
        height: 80  // Reduced height
      });
    });

    initialEdges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = initialNodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      const nodeData = node.data?.nodeData;
      const nodeName = nodeData?.name || "Unknown";
      const nodeWidth = Math.max(160, Math.min(250, nodeName.length * 9 + 50));
      // Account for the padding we added in dagre layout
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - nodeWidth / 2,
          y: nodeWithPosition.y - 40,  // Adjusted for reduced padding
        },
      };
    });

    return { nodes: layoutedNodes, edges: initialEdges };
  }, [graphData, filteredNodeTypes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update nodes and edges when graphData changes
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(async (_event: React.MouseEvent, node: Node) => {
    const nodeData = node.data.nodeData;
    setSelectedNode(nodeData);
    
    // Fetch explanation for the node
    setLoadingExplanation(true);
    setNodeExplanation(null);
    
    try {
      const token = await getToken();
      const taskIds = propSelectedTaskIds || selectedTaskIds;
      const taskIdParam = taskIds.length === 1 ? `&task_id=${taskIds[0]}` : '';
      const url = `${apiUrl}/knowledge_graph/node/explain?node_name=${encodeURIComponent(nodeData.name)}${taskIdParam}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setNodeExplanation(data.explanation);
      }
    } catch (error) {
      console.error("Error fetching node explanation:", error);
      setNodeExplanation("Unable to load explanation");
    } finally {
      setLoadingExplanation(false);
    }
  }, [apiUrl, getToken, propSelectedTaskIds, selectedTaskIds]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-200 border-t-teal-600 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              Building Your Knowledge Graph
            </p>
            <p className="text-sm text-gray-600 animate-pulse">Connecting the dots...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-800">Something went wrong</h3>
            <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
              {error}
            </p>
          </div>
          <button
            onClick={fetchGraphData}
            className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl hover:from-teal-600 hover:to-emerald-600 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center space-y-4 max-w-md mx-auto p-8">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              No Knowledge Graph Yet
            </h3>
            <p className="text-gray-700 font-medium">
              Start building your knowledge graph by uploading PDFs or processing URLs
            </p>
            <div className="mt-6 space-y-2 text-sm text-gray-600">
              <p>Upload PDF documents</p>
              <p>Process web URLs</p>
              <p>Watch your knowledge graph grow</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        defaultEdgeOptions={{
          style: { strokeWidth: 4, opacity: 1 },
          type: "step",
        }}
        nodeOrigin={[0.5, 0.5]}
      >
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const nodeData = node.data?.nodeData;
            return nodeData ? NODE_COLORS[nodeData.type] || NODE_COLORS.OTHER : "#C7CEEA";
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
        
        <Panel position="top-right" className="bg-gradient-to-br from-white via-teal-50 to-emerald-50 rounded-xl shadow-2xl border border-teal-200 p-5 max-w-xs z-10 max-h-[90vh] overflow-y-auto backdrop-blur-sm animate-in fade-in slide-in-from-top-5 duration-300">
          <div className="text-sm font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">Selected Graphs</div>
          {selectedTaskIds.length > 0 ? (
            <div className="mb-3 space-y-1">
              {selectedTaskIds.map((taskId, idx) => (
                <div key={taskId} className="px-2 py-1 text-xs bg-gradient-to-r from-teal-100 to-emerald-100 border border-teal-300 rounded-lg shadow-sm">
                  {idx + 1}. {taskId.substring(0, 12)}...
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-3 px-2 py-1 text-xs text-gray-700 bg-gray-50 rounded-lg">
              All Graphs
            </div>
          )}
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="mb-2 px-3 py-1 text-xs bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-lg w-full shadow-md transition-all duration-200 font-medium"
          >
            {showFilters ? "Hide" : "Show"} Filters
          </button>
          
          {/* Node Type Filters */}
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
                        const newFilters = new Set(filteredNodeTypes);
                        if (e.target.checked) {
                          newFilters.delete(type);
                        } else {
                          newFilters.add(type);
                        }
                        setFilteredNodeTypes(newFilters);
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
              const borderColor = NODE_BORDER_COLORS[type] || NODE_BORDER_COLORS.OTHER;
              return (
                <div key={type} className="flex items-center gap-2 p-1 hover:bg-teal-50 rounded transition-colors">
                  <div
                    className="w-5 h-5 rounded-lg shadow-sm border border-gray-300"
                    style={{ background: color }}
                  />
                  <span className="font-medium text-gray-700">{type}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-gray-800">
            <div className="font-semibold">Nodes: {graphData.nodes.length} | Links: {graphData.links.length}</div>
            {filteredNodeTypes.size > 0 && (
              <div className="text-orange-700 font-medium mt-1">
                {filteredNodeTypes.size} type(s) hidden
              </div>
            )}
          </div>
          <button
            onClick={fetchGraphData}
            className="mt-2 px-3 py-2 text-xs bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-lg w-full shadow-md transition-all duration-200 font-semibold"
          >
            Refresh
          </button>
        </Panel>
      </ReactFlow>

      {selectedNode && (
        <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200 p-6 max-w-sm max-h-[80vh] overflow-y-auto font-sans">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-xl text-gray-900">{selectedNode.name}</h3>
            <button
              onClick={() => {
                setSelectedNode(null);
                setNodeExplanation(null);
              }}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition-colors"
            >
              ×
            </button>
          </div>
          
          <div className="text-sm space-y-3 text-gray-900">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Type:</span> 
              <span className="text-gray-900">{selectedNode.type}</span>
            </div>
            {selectedNode.properties?.source && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">Source:</span>
                <span className="text-xs text-gray-900">{selectedNode.properties.source}</span>
              </div>
            )}
            
            {/* Explanation Section */}
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
      )}
    </div>
  );
}
