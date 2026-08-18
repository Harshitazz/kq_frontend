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
import type { GraphData, GraphLink, GraphNode } from "../_types/graph";
import {
  getEdgeColor,
  getExplanationText,
  getLinkLabelText,
  NODE_BORDER_COLORS,
  NODE_COLORS,
  normalizeNodeType,
  safeText,
} from "../_utils/graph";
import { GraphCanvas } from "./knowledge-graph/GraphCanvas";
import { GraphNodeDetailPanel } from "./knowledge-graph/GraphNodeDetailPanel";

interface KnowledgeGraphProps {
  apiUrl: string;
  selectedTaskIds?: string[] | null;
}

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
      const t = normalizeNodeType(node.type);
      types.add(t);
    });
    return Array.from(types).sort();
  }, [graphData.nodes]);


  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
    if (!graphData.nodes.length) {
      return { nodes: [], edges: [] };
    }
    
    const nodesToUse = filteredNodeTypes.size > 0
      ? graphData.nodes.filter(node => {
          return !filteredNodeTypes.has(normalizeNodeType(node.type));
        })
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
      const nodeName = safeText(node.name) || "Unknown";
      const nodeType = normalizeNodeType(node.type);
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
              <div className="text-xs text-gray-600 mt-1 font-normal">{String(nodeType)}</div>
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

        const edgeColor = getEdgeColor(sourceFlowId, targetFlowId, link.type);

        return {
          id: `edge-${sourceFlowId}-${targetFlowId}-${link.type}`,
          source: sourceFlowId,
          target: targetFlowId,
          label: getLinkLabelText(link.type),
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
      const nodeName = safeText(nodeData?.name) || "Node";
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
      const nodeName = safeText(nodeData?.name) || "Unknown";
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
      const url = `${apiUrl}/knowledge_graph/node/explain?node_name=${encodeURIComponent(safeText(nodeData.name))}${taskIdParam}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setNodeExplanation(getExplanationText(data.explanation));
      }
    } catch {
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
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        graphData={graphData}
        nodeTypes={nodeTypes}
        selectedTaskIds={selectedTaskIds}
        filteredNodeTypes={filteredNodeTypes}
        setFilteredNodeTypes={setFilteredNodeTypes}
        fetchGraphData={fetchGraphData}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((value) => !value)}
      />

      {selectedNode && (
        <GraphNodeDetailPanel
          selectedNode={selectedNode}
          loadingExplanation={loadingExplanation}
          nodeExplanation={nodeExplanation}
          onClose={() => {
            setSelectedNode(null);
            setNodeExplanation(null);
          }}
        />
      )}
    </div>
  );
}
