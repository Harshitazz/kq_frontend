"use client";
import { useEffect, useRef, useState, useCallback } from "react";
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

interface KnowledgeGraphWebGLProps {
  apiUrl: string;
  selectedTaskIds?: string[] | null;
}

// Highly differentiable color scheme
const NODE_COLORS: Record<string, string> = {
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

const EDGE_COLORS = [
  "#14B8A6", "#10B981", "#059669", "#0D9488", "#0891B2",
  "#0284C7", "#2563EB", "#6366F1", "#7C3AED", "#A855F7",
  "#C026D3", "#DB2777", "#E11D48", "#DC2626", "#EA580C",
  "#D97706", "#CA8A04",
];

export default function KnowledgeGraphWebGL({ apiUrl, selectedTaskIds: propSelectedTaskIds }: KnowledgeGraphWebGLProps) {
  const { getToken } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(propSelectedTaskIds || []);
  const [nodeExplanation, setNodeExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [highlightedNodeNames, setHighlightedNodeNames] = useState<string[]>([]);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Listen for highlight events
  useEffect(() => {
    const handleHighlight = (event: CustomEvent<string[]>) => {
      setHighlightedNodeNames(event.detail);
    };
    
    window.addEventListener('highlightNodes', handleHighlight as EventListener);
    return () => {
      window.removeEventListener('highlightNodes', handleHighlight as EventListener);
    };
  }, []);

  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let token = null;
      try {
        token = await getToken();
      } catch (tokenError) {
        await new Promise(resolve => setTimeout(resolve, 500));
        token = await getToken();
      }
      
      if (!token) {
        throw new Error("Authentication token not available");
      }
      
      const taskIds = propSelectedTaskIds || selectedTaskIds;
      
      if (taskIds.length === 0) {
        const url = `${apiUrl}/knowledge_graph?limit=30`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setGraphData(data);
        }
      } else {
        const fetchPromises = taskIds.map(taskId =>
          fetch(`${apiUrl}/knowledge_graph?limit=30&task_id=${taskId}`, {
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

  // Initialize Sigma.js WebGL graph
  useEffect(() => {
    if (!isClient || typeof window === "undefined" || !containerRef.current || graphData.nodes.length === 0) return;

    let Graph: any;
    let Sigma: any;
    let forceAtlas2: any;
    let noverlap: any;
    let edgeTooltip: HTMLDivElement | null = null;
    let tooltipUpdateHandler: ((e: MouseEvent) => void) | null = null;

    // Dynamically import libraries to avoid SSR issues
    Promise.all([
      import("graphology"),
      import("sigma"),
      import("graphology-layout-forceatlas2"),
      import("graphology-layout-noverlap"),
    ]).then(([graphologyModule, sigmaModule, forceAtlas2Module, noverlapModule]) => {
      Graph = graphologyModule.default;
      Sigma = sigmaModule.default;
      forceAtlas2 = forceAtlas2Module.default;
      noverlap = noverlapModule.default;

      if (!containerRef.current || graphData.nodes.length === 0) return;

      // Clean up previous instance
      if (sigmaRef.current) {
        sigmaRef.current.kill();
        sigmaRef.current = null;
      }

      const graph = new Graph();

      // Add nodes
      graphData.nodes.forEach((node) => {
        const nodeType = node.type || "OTHER";
        const baseColor = NODE_COLORS[nodeType] || NODE_COLORS.OTHER;
        // Highlight nodes if they're in the highlighted list
        const isHighlighted = highlightedNodeNames.includes(node.name);
        const color = isHighlighted ? "#EF4444" : baseColor; // Red for highlighted nodes
        const size = isHighlighted 
          ? Math.max(12, Math.min(25, node.name.length * 1.0)) // Larger size for highlighted
          : Math.max(8, Math.min(20, node.name.length * 0.8));
        
        graph.addNode(node.id.toString(), {
          label: node.name,
          size: size,
          color: color,
          x: Math.random() * 1000,
          y: Math.random() * 1000,
          nodeType: nodeType, // Use 'nodeType' instead of 'type' to avoid conflict with Sigma.js
          nodeData: node,
          highlighted: isHighlighted,
        });
      });

      // Add edges
      graphData.links.forEach((link) => {
        const sourceId = typeof link.source === "object" ? link.source.id : link.source;
        const targetId = typeof link.target === "object" ? link.target.id : link.target;
        
        if (graph.hasNode(sourceId.toString()) && graph.hasNode(targetId.toString())) {
          const edgeColorIndex = Math.abs(
            (sourceId + targetId + link.type).toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
          ) % EDGE_COLORS.length;
          const edgeColor = EDGE_COLORS[edgeColorIndex];
          
          try {
            // Keep full relationship name for edge labels
            graph.addEdge(sourceId.toString(), targetId.toString(), {
              label: link.type, // Full relationship type for label rendering
              color: edgeColor,
              size: 5,  // Increased from 4 to make edges more visible and readable
              weight: 1,
              type: "line",
            });
          } catch (e) {
            // Edge might already exist, skip
          }
        }
      });

      // Apply noverlap layout first to prevent node overlaps (more aggressive)
      noverlap.assign(graph, {
        maxIterations: 200,
        settings: {
          ratio: 2.0, // Increased from 1.5 to create more space between nodes
        },
      });

      // Apply ForceAtlas2 layout for better positioning (more iterations for better layout)
      const positions = forceAtlas2(graph, {
        iterations: 300, // Increased from 200 for better layout
        settings: {
          gravity: 0.3, // Increased gravity to keep graph more compact
          scalingRatio: 2.5, // Increased to spread nodes more
          strongGravityMode: false,
          outboundAttractionDistribution: true,
          linLogMode: false,
          adjustSizes: true,
        },
      });

      // Update node positions
      graph.forEachNode((nodeId: string) => {
        const pos = positions[nodeId];
        if (pos) {
          graph.setNodeAttribute(nodeId, "x", pos.x);
          graph.setNodeAttribute(nodeId, "y", pos.y);
        }
      });

      // Create Sigma instance with WebGL rendering
      const sigma = new Sigma(graph, containerRef.current, {
        renderLabels: true,
        labelFont: "Inter, sans-serif",
        labelSize: 11,
        labelWeight: "bold",
        labelColor: { attribute: "color", defaultValue: "#1F2937" },
        defaultNodeColor: "#6B7280",
        defaultEdgeColor: "#9CA3AF",
        minCameraRatio: 0.05,
        maxCameraRatio: 20,
        allowInvalidContainer: false,
        defaultEdgeType: "line",
      });

      // Handle node clicks
      sigma.on("clickNode", async ({ node }: { node: string }) => {
        const nodeData = graph.getNodeAttributes(node);
        setSelectedNode(nodeData.nodeData);
        
        // Fetch explanation
        setLoadingExplanation(true);
        try {
          const token = await getToken();
          const taskIds = propSelectedTaskIds || selectedTaskIds;
          const taskIdParam = taskIds.length === 1 ? `&task_id=${taskIds[0]}` : '';
          const response = await fetch(`${apiUrl}/knowledge_graph/node/explain?node_name=${encodeURIComponent(nodeData.nodeData.name)}${taskIdParam}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            setNodeExplanation(data.explanation);
          }
        } catch (error) {
          setNodeExplanation("Unable to load explanation");
        } finally {
          setLoadingExplanation(false);
        }
      });

      // Handle background clicks
      sigma.on("clickStage", () => {
        setSelectedNode(null);
      });

      // Handle edge hover to show relationship type with tooltip
      sigma.on("enterEdge", ({ edge }: { edge: string }) => {
        const edgeData = graph.getEdgeAttributes(edge);
        if (edgeData.label) {
          // Create or show tooltip
          if (!edgeTooltip) {
            edgeTooltip = document.createElement('div');
            edgeTooltip.setAttribute('data-edge-tooltip', 'true');
            edgeTooltip.style.position = 'fixed';
            edgeTooltip.style.background = 'rgba(0, 0, 0, 0.9)';
            edgeTooltip.style.color = 'white';
            edgeTooltip.style.padding = '8px 14px';
            edgeTooltip.style.borderRadius = '8px';
            edgeTooltip.style.fontSize = '13px';
            edgeTooltip.style.fontWeight = 'bold';
            edgeTooltip.style.pointerEvents = 'none';
            edgeTooltip.style.zIndex = '10000';
            edgeTooltip.style.fontFamily = 'Inter, sans-serif';
            edgeTooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            edgeTooltip.style.display = 'none';
            document.body.appendChild(edgeTooltip);
          }
          
          edgeTooltip.textContent = `Relationship: ${edgeData.label}`;
          edgeTooltip.style.display = 'block';
          
          // Update tooltip position on mouse move
          tooltipUpdateHandler = (e: MouseEvent) => {
            if (edgeTooltip) {
              edgeTooltip.style.left = `${e.clientX + 15}px`;
              edgeTooltip.style.top = `${e.clientY + 15}px`;
            }
          };
          
          window.addEventListener('mousemove', tooltipUpdateHandler);
        }
      });

      sigma.on("leaveEdge", () => {
        if (edgeTooltip) {
          edgeTooltip.style.display = 'none';
        }
        if (tooltipUpdateHandler) {
          window.removeEventListener('mousemove', tooltipUpdateHandler);
          tooltipUpdateHandler = null;
        }
      });

      // Handle edge click to show relationship details in panel
      sigma.on("clickEdge", ({ edge }: { edge: string }) => {
        const edgeData = graph.getEdgeAttributes(edge);
        const sourceNode = graph.source(edge);
        const targetNode = graph.target(edge);
        const sourceData = graph.getNodeAttributes(sourceNode);
        const targetData = graph.getNodeAttributes(targetNode);
        
        if (edgeData.label) {
          setSelectedNode({
            id: 0,
            name: `${sourceData.label} → ${targetData.label}`,
            type: 'RELATIONSHIP',
            label: edgeData.label,
            properties: {
              relationship: edgeData.label,
              source: sourceData.label,
              target: targetData.label,
            }
          });
          setNodeExplanation(`Relationship Type: ${edgeData.label}\n\nFrom: ${sourceData.label}\nTo: ${targetData.label}\n\nThis relationship connects the two entities in the knowledge graph.`);
        }
      });

      // Add custom edge label rendering using Canvas overlay
      const renderEdgeLabels = () => {
        if (!containerRef.current || !sigma) return;
        
        // Get canvas context for edge labels
        const container = containerRef.current;
        let labelCanvas = container.querySelector('canvas[data-edge-labels]') as HTMLCanvasElement;
        
        if (!labelCanvas) {
          labelCanvas = document.createElement('canvas');
          labelCanvas.setAttribute('data-edge-labels', 'true');
          labelCanvas.style.position = 'absolute';
          labelCanvas.style.top = '0';
          labelCanvas.style.left = '0';
          labelCanvas.style.pointerEvents = 'none';
          labelCanvas.style.zIndex = '10';
          container.appendChild(labelCanvas);
        }
        
        const ctx = labelCanvas.getContext('2d');
        if (!ctx) return;
        
        // Match canvas size to container
        const rect = container.getBoundingClientRect();
        labelCanvas.width = rect.width;
        labelCanvas.height = rect.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
        
        // Get camera state
        const camera = sigma.getCamera();
        const ratio = camera.ratio;
        const angle = camera.angle;
        const x = camera.x;
        const y = camera.y;
        
        // Render edge labels
        graph.forEachEdge((edge: string) => {
          const edgeData = graph.getEdgeAttributes(edge);
          if (!edgeData.label) return;
          
          const sourceId = graph.source(edge);
          const targetId = graph.target(edge);
          const sourceData = graph.getNodeAttributes(sourceId);
          const targetData = graph.getNodeAttributes(targetId);
          
          // Calculate edge midpoint in graph coordinates
          const sourceX = sourceData.x;
          const sourceY = sourceData.y;
          const targetX = targetData.x;
          const targetY = targetData.y;
          
          const midX = (sourceX + targetX) / 2;
          const midY = (sourceY + targetY) / 2;
          
          // Transform to screen coordinates
          const screenX = (midX - x) * ratio + labelCanvas.width / 2;
          const screenY = (midY - y) * ratio + labelCanvas.height / 2;
          
          // Only render if on screen
          if (screenX < 0 || screenX > labelCanvas.width || screenY < 0 || screenY > labelCanvas.height) {
            return;
          }
          
          // Draw label background
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const text = edgeData.label.length > 20 ? edgeData.label.substring(0, 17) + '...' : edgeData.label;
          const metrics = ctx.measureText(text);
          const textWidth = metrics.width;
          const textHeight = 16;
          const padding = 6;
          
          // Draw rounded rectangle background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.strokeStyle = edgeData.color || '#9CA3AF';
          ctx.lineWidth = 2;
          
          const rectX = screenX - textWidth / 2 - padding;
          const rectY = screenY - textHeight / 2 - padding;
          const rectWidth = textWidth + padding * 2;
          const rectHeight = textHeight + padding * 2;
          const radius = 6;
          
          ctx.beginPath();
          ctx.moveTo(rectX + radius, rectY);
          ctx.lineTo(rectX + rectWidth - radius, rectY);
          ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
          ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
          ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight);
          ctx.lineTo(rectX + radius, rectY + rectHeight);
          ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
          ctx.lineTo(rectX, rectY + radius);
          ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          // Draw text
          ctx.fillStyle = '#1F2937';
          ctx.fillText(text, screenX, screenY);
        });
      };
      
      // Render edge labels initially and on camera changes
      renderEdgeLabels();
      sigma.on('afterRender', renderEdgeLabels);
      
      sigmaRef.current = sigma;
    }).catch((err) => {
      console.error("Error loading graph libraries:", err);
      setError("Failed to load graph visualization libraries");
    });

    // Cleanup
    return () => {
      if (sigmaRef.current) {
        sigmaRef.current.kill();
        sigmaRef.current = null;
      }
      // Clean up edge tooltip
      const tooltip = document.querySelector('[data-edge-tooltip]') as HTMLDivElement;
      if (tooltip) {
        tooltip.remove();
      }
    };
  }, [isClient, graphData, apiUrl, getToken, propSelectedTaskIds, selectedTaskIds, highlightedNodeNames]);

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
    <div className="w-full h-full relative bg-white">
      {/* WebGL Canvas Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ 
          cursor: 'grab',
        }}
      />
      
      {/* Node Info Panel */}
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

      {/* Stats Panel */}
      <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-teal-200 p-4">
        <div className="text-xs space-y-1">
          <div className="font-semibold text-teal-700 mb-2">Graph Stats</div>
          <div className="text-gray-700">Nodes: {graphData.nodes.length}</div>
          <div className="text-gray-700">Edges: {graphData.links.length}</div>
        </div>
        <div className="mt-3 pt-3 border-t border-teal-200 text-xs text-gray-600">
          <div className="font-medium text-teal-600">WebGL Rendering</div>
          <div className="text-[10px] mt-1 text-gray-500">Drag to pan • Scroll to zoom</div>
        </div>
      </div>
    </div>
  );
}
