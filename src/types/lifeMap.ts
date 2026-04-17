// Shared types for Life Map graph + analytics.
export type EntityType = "event" | "person" | "topic" | "emotion";

export interface DbEntity {
  id: string;
  type: EntityType;
  label: string;
  mentions: number;
  last_seen_at: string;
  pinned?: boolean;
  hidden?: boolean;
  category?: string | null;
  custom_label?: string | null;
}

export interface DbEdge {
  id: string;
  a_id: string;
  b_id: string;
  strength: number;
  last_seen_at: string;
}

export interface PingRow {
  created_at: string;
  mood: number;
  note: string | null;
  activities: string[];
}

export interface CheckinRow {
  created_at: string;
  mood: number | null;
  note: string | null;
  intent: string | null;
  tags: string[];
}

export const TYPE_LABEL: Record<EntityType, string> = {
  event: "События",
  person: "Люди",
  topic: "Темы",
  emotion: "Эмоции",
};

export const TYPE_TOKEN: Record<EntityType, string> = {
  person: "var(--stat-relationships)",
  event: "var(--ring-exercise)",
  topic: "var(--stat-career)",
  emotion: "var(--stat-emotions)",
};

export const displayLabel = (e: DbEntity) => e.custom_label || e.label;
