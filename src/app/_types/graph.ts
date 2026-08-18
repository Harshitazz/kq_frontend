export interface GraphNode {
  id: number;
  name: string;
  type: string | { type?: string; text?: string; [key: string]: any };
  label: string;
  properties?: Record<string, any>;
}

export interface GraphLink {
  source: number | GraphNode;
  target: number | GraphNode;
  type: string | { type?: string; text?: string; [key: string]: any };
  label: string;
  properties?: Record<string, any>;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface HistoryItem {
  task_id: string;
  source: string;
  node_count: number;
  relationship_count: number;
  created_at: string;
}

export type SidebarTab = "upload" | "query" | "history";

export interface TaskStatus {
  task_id: string;
  status: string;
  progress?: number;
  message?: string;
}
