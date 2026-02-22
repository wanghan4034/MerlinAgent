"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Task } from "@/lib/types";

export function TaskList({ tasks, selectedId, onSelect, onCancel, onRetry, loading }: { tasks: Task[]; selectedId?: string; onSelect: (id: string) => void; onCancel: (id: string) => void; onRetry: (id: string) => void; loading: boolean }) {
  return (
    <Card className="h-full">
      <CardHeader><CardTitle>任务队列</CardTitle></CardHeader>
      <CardContent className="space-y-2 max-h-[360px] overflow-auto">
        {loading && <div className="text-sm text-slate-500">加载中...</div>}
        {!loading && tasks.length === 0 && <div className="text-sm text-slate-500">暂无任务</div>}
        {tasks.map((t) => (
          <div key={t.id} className={`rounded-md border p-2 ${selectedId === t.id ? "border-indigo-500 bg-indigo-50" : ""}`}>
            <button className="w-full text-left" onClick={() => onSelect(t.id)}>
              <div className="flex items-center justify-between"><div className="font-medium text-sm truncate">{t.keyword}</div><Badge>{t.status}</Badge></div>
              <div className="text-xs text-slate-500">进度 {t.progress}% · 抓取 {t.stats.items} · 错误 {t.stats.errorCount}</div>
            </button>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" className="h-7 px-2 py-0 text-xs" onClick={() => onCancel(t.id)}>取消</Button>
              <Button variant="outline" className="h-7 px-2 py-0 text-xs" onClick={() => onRetry(t.id)}>重试</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
