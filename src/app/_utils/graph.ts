import type { GraphNode, GraphLink } from "../_types/graph";

export const NODE_COLORS: Record<string, string> = {
  TOPIC: "#DBEAFE",
  CONCEPT: "#D1FAE5",
  THEORY: "#FEF3C7",
  METHOD: "#FCE7F3",
  PERSON: "#FED7AA",
  ORGANIZATION: "#E9D5FF",
  LOCATION: "#BFDBFE",
  EVENT: "#FECACA",
  PRODUCT: "#FEF08A",
  BUDGET_ITEM: "#FCA5A5",
  CATEGORY: "#C7D2FE",
  TECHNOLOGY: "#A7F3D0",
  TOOL: "#BAE6FD",
  PROCESS: "#DDD6FE",
  METRIC: "#99F6E4",
  OTHER: "#E5E7EB",
};

export const NODE_BORDER_COLORS: Record<string, string> = {
  TOPIC: "#3B82F6",
  CONCEPT: "#10B981",
  THEORY: "#EAB308",
  METHOD: "#EC4899",
  PERSON: "#F97316",
  ORGANIZATION: "#9333EA",
  LOCATION: "#2563EB",
  EVENT: "#DC2626",
  PRODUCT: "#84CC16",
  BUDGET_ITEM: "#EF4444",
  CATEGORY: "#6366F1",
  TECHNOLOGY: "#059669",
  TOOL: "#0891B2",
  PROCESS: "#7C3AED",
  METRIC: "#14B8A6",
  OTHER: "#6B7280",
};

export function normalizeNodeType(value: GraphNode["type"] | GraphLink["type"] | unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidate = value as { type?: string; text?: string };
    if (typeof candidate.type === "string") return candidate.type;
    if (typeof candidate.text === "string") return candidate.text;
    return "OTHER";
  }
  return "OTHER";
}

export function safeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidate = value as { text?: string; type?: string; content?: string; explanation?: string };
    if (typeof candidate.text === "string") return candidate.text;
    if (typeof candidate.type === "string") return candidate.type;
    if (typeof candidate.content === "string") return candidate.content;
    if (typeof candidate.explanation === "string") return candidate.explanation;
    return JSON.stringify(value);
  }
  return String(value ?? "");
}

export function getExplanationText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.explanation === "string") return obj.explanation;
    return JSON.stringify(value);
  }
  return String(value ?? "");
}

export const EDGE_COLORS = [
  "#14B8A6",
  "#10B981",
  "#059669",
  "#0D9488",
  "#0891B2",
  "#0284C7",
  "#2563EB",
  "#6366F1",
  "#7C3AED",
  "#A855F7",
  "#C026D3",
  "#DB2777",
  "#E11D48",
  "#DC2626",
  "#EA580C",
  "#D97706",
  "#CA8A04",
];

export function getEdgeColor(sourceId: string | number, targetId: string | number, linkType: unknown): string {
  const seed = `${sourceId}${targetId}${String(linkType ?? "")}`;
  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  return EDGE_COLORS[Math.abs(hash) % EDGE_COLORS.length];
}

export function getLinkLabelText(value: unknown): string {
  const resolved =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? (value as { type?: string; text?: string }).type || (value as { text?: string }).text || JSON.stringify(value)
        : String(value ?? "");

  return resolved.length > 20 ? `${resolved.substring(0, 17)}...` : resolved;
}
