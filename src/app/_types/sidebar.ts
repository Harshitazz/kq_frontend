export interface HistoryItem {
  task_id: string;
  source: string;
  node_count: number;
  relationship_count: number;
  created_at: string;
}

export type SidebarTab = "upload" | "query" | "history";
