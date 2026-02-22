import { Item, ItemFilters, Task } from "@/lib/types";

let tasks: Task[] = [];
let items: Item[] = [];

const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const seedTitles = [
  "CHANEL Classic Flap Bag",
  "Hermes Garden Party",
  "Vintage Chanel Tote",
  "Hermes Silk Shirt",
  "Chanel Lambskin Bag",
  "Used wool coat"
];

function createMockItems(task: Task, count: number): Item[] {
  return Array.from({ length: count }).map((_, i) => {
    const title = seedTitles[i % seedTitles.length];
    const isBag = /bag|tote|party|flap/i.test(title);
    const price = isBag ? Math.floor(45000 + Math.random() * 120000) : Math.floor(6000 + Math.random() * 20000);
    return {
      id: uid("item"),
      title,
      price,
      currency: "JPY",
      status: Math.random() > 0.22 ? "active" : "sold",
      listedAt: now(),
      imageUrl: `https://picsum.photos/seed/${task.id}-${i}/320/240`,
      url: `https://jp.mercari.com/item/${uid("m")}`,
      matchedKeywords: task.extractedKeywords.length ? task.extractedKeywords : task.keyword.split(/[ ,/]+/).filter(Boolean),
      valueScore: Math.max(45, 100 - Math.floor(price / 2600)),
      isRecommended: isBag ? price < 98000 : price < 13000,
      taskId: task.id
    };
  });
}

function updateTask(id: string, patch: Partial<Task>) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

function appendLog(id: string, line: string) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  updateTask(id, { logs: [...task.logs, `${now()} ${line}`] });
}

function simulateLifecycle(task: Task) {
  setTimeout(() => {
    updateTask(task.id, { status: "running", progress: 15, startedAt: now() });
    appendLog(task.id, "[INFO] task started");
  }, 800);

  let progress = 15;
  const timer = setInterval(() => {
    const current = tasks.find((t) => t.id === task.id);
    if (!current || current.status !== "running") {
      clearInterval(timer);
      return;
    }
    progress = Math.min(92, progress + Math.floor(Math.random() * 18));
    updateTask(task.id, { progress });
  }, 900);

  setTimeout(() => {
    const failed = Math.random() < 0.14;
    clearInterval(timer);

    if (failed) {
      updateTask(task.id, {
        status: "failed",
        finishedAt: now(),
        progress: 100,
        errorMessage: "目标站点响应超时，请稍后重试",
        stats: { ...task.stats, errorCount: 1 }
      });
      appendLog(task.id, "[ERROR] upstream timeout");
      return;
    }

    const generated = createMockItems(task, 20 + Math.floor(Math.random() * 24));
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
      }
    });
    appendLog(task.id, `[INFO] completed with ${generated.length} items`);
  }, 6200);
}

export const mockApi = {
  async createTask(payload: { keyword: string; extractedKeywords: string[]; pageCount: number; config: Task["config"] }): Promise<Task> {
    await wait(250);
    const task: Task = {
      id: uid("task"),
      keyword: payload.keyword,
      extractedKeywords: payload.extractedKeywords,
      pageCount: payload.pageCount,
      status: "queued",
      progress: 0,
      createdAt: now(),
      stats: { items: 0, totalNew: 0, sold: 0, avgPrice: 0, recommendedCount: 0, errorCount: 0 },
      config: payload.config,
      rawParams: payload,
      logs: [`${now()} [INFO] task queued`]
    };
    tasks = [task, ...tasks];
    simulateLifecycle(task);
    return task;
  },

  async listTasks(): Promise<Task[]> {
    await wait();
    return [...tasks].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async cancelTask(id: string): Promise<void> {
    await wait(180);
    updateTask(id, { status: "canceled", finishedAt: now(), progress: 100 });
    appendLog(id, "[WARN] canceled by user");
  },

  async retryTask(id: string): Promise<Task | undefined> {
    const t = tasks.find((x) => x.id === id);
    if (!t) return undefined;
    return this.createTask({ keyword: t.keyword, extractedKeywords: t.extractedKeywords, pageCount: t.pageCount, config: t.config });
  },

  async listItems(taskId?: string, filters: ItemFilters = {}): Promise<Item[]> {
    await wait(350);
    let data = [...items];
    const targetTask = taskId || tasks.find((t) => t.status === "succeeded")?.id;
    if (targetTask) data = data.filter((x) => x.taskId === targetTask);

    if (filters.tab === "recommended") filters.recommendedOnly = true;
    if (filters.tab === "sold") filters.status = "sold";

    if (filters.title) data = data.filter((x) => x.title.toLowerCase().includes(filters.title!.toLowerCase()));
    if (filters.containsKeyword) data = data.filter((x) => x.matchedKeywords.join(" ").toLowerCase().includes(filters.containsKeyword!.toLowerCase()));
    if (filters.minPrice != null) data = data.filter((x) => x.price >= filters.minPrice!);
    if (filters.maxPrice != null) data = data.filter((x) => x.price <= filters.maxPrice!);
    if (filters.status && filters.status !== "all") data = data.filter((x) => x.status === filters.status);
    if (filters.recommendedOnly) data = data.filter((x) => x.isRecommended);

    switch (filters.sortBy) {
      case "priceAsc": data.sort((a, b) => a.price - b.price); break;
      case "priceDesc": data.sort((a, b) => b.price - a.price); break;
      case "valueScore": data.sort((a, b) => b.valueScore - a.valueScore); break;
      default: data.sort((a, b) => +new Date(b.listedAt) - +new Date(a.listedAt));
    }

    return data;
  },

  async getKpi() {
    await wait(220);
    const totalItems = items.length;
    const soldItems = items.filter((i) => i.status === "sold").length;
    const avgPrice = totalItems ? Math.round(items.reduce((s, i) => s + i.price, 0) / totalItems) : 0;
    const activeKeywords = new Set(items.flatMap((i) => i.matchedKeywords.map((k) => k.toLowerCase()))).size;
    const recent = tasks.slice(0, 30);
    const done = recent.filter((t) => ["succeeded", "failed", "canceled"].includes(t.status));
    const succ = done.filter((t) => t.status === "succeeded").length;
    const durations = recent
      .filter((t) => t.startedAt && t.finishedAt)
      .map((t) => (+new Date(t.finishedAt!) - +new Date(t.startedAt!)) / 1000);

    return {
      totalItems,
      activeKeywords,
      soldItems,
      avgPrice,
      new24h: items.filter((i) => +new Date(i.listedAt) > Date.now() - 24 * 3600 * 1000).length,
      successRate: done.length ? Math.round((succ / done.length) * 100) : 0,
      avgDurationSec: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
    };
  }
};
