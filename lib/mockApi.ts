import { Item, ItemFilters, Task, TaskStatus } from "@/lib/types";

let tasks: Task[] = [];
let items: Item[] = [];

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const seedTitles = ["CHANEL Classic Flap", "Hermes Garden Party", "Vintage Chanel Tote", "Hermes Silk Shirt", "Chanel Lambskin Bag"];

function createMockItems(task: Task, count: number): Item[] {
  return Array.from({ length: count }).map((_, i) => {
    const title = seedTitles[i % seedTitles.length];
    const isBag = /bag|tote|flap|party/i.test(title);
    const price = isBag ? Math.floor(45000 + Math.random() * 120000) : Math.floor(6000 + Math.random() * 18000);
    return {
      id: uid("item"),
      title,
      price,
      currency: "JPY",
      status: Math.random() > 0.2 ? "active" : "sold",
      listedAt: now(),
      imageUrl: `https://picsum.photos/seed/${task.id}-${i}/300/220`,
      url: `https://jp.mercari.com/item/${uid("m")}`,
      matchedKeywords: task.keyword.split(/[ ,]+/).filter(Boolean),
      valueScore: Math.max(50, 100 - Math.floor(price / 3000)),
      isRecommended: isBag ? price < 95000 : price < 13000,
      taskId: task.id
    } as Item;
  });
}

function updateTask(id: string, patch: Partial<Task>) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

function simulateLifecycle(task: Task) {
  setTimeout(() => {
    updateTask(task.id, { status: "running", progress: 20, startedAt: now() });
  }, 1000);
  setTimeout(() => updateTask(task.id, { progress: 55 }), 2500);
  setTimeout(() => updateTask(task.id, { progress: 88 }), 4000);
  setTimeout(() => {
    const failed = Math.random() < 0.12;
    if (failed) {
      updateTask(task.id, {
        status: "failed",
        finishedAt: now(),
        progress: 100,
        stats: { ...task.stats, errorCount: 1 },
        logs: [...task.logs, "[ERROR] mock timeout from upstream"]
      });
      return;
    }

    const generated = createMockItems(task, 24 + Math.floor(Math.random() * 20));
    items = [...generated, ...items];
    const sold = generated.filter((x) => x.status === "sold").length;
    const avg = Math.round(generated.reduce((a, b) => a + b.price, 0) / generated.length);
    const recommendedCount = generated.filter((x) => x.isRecommended).length;
    updateTask(task.id, {
      status: "succeeded",
      progress: 100,
      finishedAt: now(),
      stats: {
        items: generated.length,
        totalNew: generated.length,
        sold,
        avgPrice: avg,
        recommendedCount,
        errorCount: 0
      },
      logs: [...task.logs, `[INFO] completed with ${generated.length} items`]
    });
  }, 5600);
}

export const mockApi = {
  async createTask(payload: { keyword: string; pageCount: number; config: Task["config"] }): Promise<Task> {
    await wait(350);
    const task: Task = {
      id: uid("task"),
      keyword: payload.keyword,
      pageCount: payload.pageCount,
      status: "queued",
      progress: 0,
      createdAt: now(),
      stats: { items: 0, totalNew: 0, sold: 0, avgPrice: 0, recommendedCount: 0, errorCount: 0 },
      config: payload.config,
      rawParams: payload,
      logs: ["[INFO] task queued"]
    };
    tasks = [task, ...tasks];
    simulateLifecycle(task);
    return task;
  },

  async listTasks(): Promise<Task[]> {
    await wait();
    return [...tasks].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async getTask(id: string): Promise<Task | undefined> {
    await wait(150);
    return tasks.find((t) => t.id === id);
  },

  async cancelTask(id: string): Promise<void> {
    await wait(200);
    updateTask(id, { status: "canceled", finishedAt: now(), progress: 100 });
  },

  async retryTask(id: string): Promise<Task | undefined> {
    const task = tasks.find((t) => t.id === id);
    if (!task) return undefined;
    return this.createTask({ keyword: task.keyword, pageCount: task.pageCount, config: task.config });
  },

  async listItems(taskId?: string, filters: ItemFilters = {}): Promise<Item[]> {
    await wait(450);
    let data = items;
    const targetTask = taskId || tasks.find((t) => t.status === "succeeded")?.id;
    if (targetTask) data = data.filter((x) => x.taskId === targetTask);
    if (filters.title) data = data.filter((x) => x.title.toLowerCase().includes(filters.title!.toLowerCase()));
    if (filters.keyword) data = data.filter((x) => x.matchedKeywords.join(" ").toLowerCase().includes(filters.keyword!.toLowerCase()));
    if (filters.minPrice != null) data = data.filter((x) => x.price >= filters.minPrice!);
    if (filters.maxPrice != null) data = data.filter((x) => x.price <= filters.maxPrice!);
    if (filters.status && filters.status !== "all") data = data.filter((x) => x.status === filters.status);
    if (filters.tab === "recommended") data = data.filter((x) => x.isRecommended);
    if (filters.tab === "sold") data = data.filter((x) => x.status === "sold");
    if (filters.recommendedOnly) data = data.filter((x) => x.isRecommended);
    if (filters.tab === "latest") data = [...data].sort((a, b) => +new Date(b.listedAt) - +new Date(a.listedAt));
    return data;
  },

  async getKpi() {
    await wait(220);
    const totalItems = items.length;
    const sold = items.filter((x) => x.status === "sold").length;
    const avgPrice = totalItems ? Math.round(items.reduce((s, i) => s + i.price, 0) / totalItems) : 0;
    const keywords = new Set(items.flatMap((i) => i.matchedKeywords.map((x) => x.toLowerCase()))).size;
    const recentTasks = tasks.slice(0, 20);
    const succ = recentTasks.filter((t) => t.status === "succeeded").length;
    const done = recentTasks.filter((t) => ["succeeded", "failed", "canceled"].includes(t.status)).length;
    const durations = recentTasks
      .filter((t) => t.startedAt && t.finishedAt)
      .map((t) => (+new Date(t.finishedAt!) - +new Date(t.startedAt!)) / 1000);

    return {
      totalItems,
      activeKeywords: keywords,
      soldItems: sold,
      avgPrice,
      new24h: items.filter((i) => +new Date(i.listedAt) > Date.now() - 24 * 3600 * 1000).length,
      successRate: done ? Math.round((succ / done) * 100) : 0,
      avgDurationSec: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
    };
  }
};
