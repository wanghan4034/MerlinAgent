export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type ItemStatus = "active" | "sold";

export interface TaskConfig {
  minPrice?: number;
  maxPrice?: number;
  includeSold: boolean;
  matchMode: "any" | "all";
  sortBy: "latest" | "priceAsc" | "priceDesc";
}

export interface TaskStats {
  items: number;
  totalNew: number;
  sold: number;
  avgPrice: number;
  recommendedCount: number;
  errorCount: number;
}

export interface Task {
  id: string;
  keyword: string;
  pageCount: number;
  status: TaskStatus;
  progress: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  stats: TaskStats;
  config: TaskConfig;
  rawParams: Record<string, unknown>;
  logs: string[];
}

export interface Item {
  id: string;
  title: string;
  price: number;
  currency: "JPY";
  status: ItemStatus;
  listedAt: string;
  imageUrl: string;
  url: string;
  matchedKeywords: string[];
  valueScore: number;
  isRecommended: boolean;
  taskId: string;
}

export interface ItemFilters {
  title?: string;
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: "all" | ItemStatus;
  recommendedOnly?: boolean;
  tab?: "latest" | "recommended" | "all" | "sold";
}
