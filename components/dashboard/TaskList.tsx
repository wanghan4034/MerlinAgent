"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Task } from "@/lib/types";

function fmtDuration(t: Task) {
  if (!t.startedAt || !t.finishedAt) return "-";
  return `${Math.round((+new Date(t.finishedAt) - +new Date(t.startedAt)) / 1000)}s`;
}

export function TaskList({ tasks, selectedId, onSelect, onCancel, onRetry, loading }: { tasks: Task[]; selectedId?: string; onSelect: (id: string) => void; onCancel: (id: string) => void; onRetry: (id: string) => void; loading: boolean }) {
  const list = [...tasks].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8);

  return (
    <Card className="h-full">
      <CardHeader><CardTitle>任务队列</CardTitle></CardHeader>
      <CardContent className="space-y-2 max-h-[390px] overflow-auto">
        {loading && <div className="text-sm text-slate-500">加载中...</div>}
        {!loading && list.length === 0 && <div className="text-sm text-slate-500">暂无任务</div>}
        {list.map((t) => (
          <div key={t.id} className={`rounded-md border p-2 ${selectedId === t.id ? "border-indigo-500 bg-indigo-50" : ""}`}>
            <button className="w-full text-left" onClick={() => onSelect(t.id)}>
              <div className="flex items-center justify-between gap-2"><div className="truncate text-sm font-medium">{t.keyword}</div><Badge>{t.status}</Badge></div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-200"><div className="h-full bg-indigo-600" style={{ width: `${t.progress}%` }} /></div>
              <div className="mt-1 grid grid-cols-2 gap-x-2 text-xs text-slate-500">
                <div>页数: {t.pageCount}</div><div>开始: {t.startedAt ? new Date(t.startedAt).toLocaleTimeString() : "-"}</div>
                <div>耗时: {fmtDuration(t)}</div><div>items/new/sold: {t.stats.items}/{t.stats.totalNew}/{t.stats.sold}</div>
                <div>错误数: {t.stats.errorCount}</div>
              </div>
            </button>

            {t.status === "failed" && (
              <div className="mt-2 rounded bg-rose-50 p-2 text-xs text-rose-700">
                {t.errorMessage || "任务失败"}
                <div className="mt-1"><Sheet title="任务错误日志" triggerLabel="查看日志"><pre className="text-xs whitespace-pre-wrap">{t.logs.join("\n")}</pre></Sheet></div>
              </div>
            )}

            <div className="mt-2 flex gap-2">
              {(t.status === "running" || t.status === "queued") && <Button variant="outline" className="h-7 px-2 py-0 text-xs" onClick={() => onCancel(t.id)}>取消</Button>}
              {t.status === "failed" && <Button variant="outline" className="h-7 px-2 py-0 text-xs" onClick={() => onRetry(t.id)}>重试</Button>}
              {t.status === "succeeded" && <Button variant="outline" className="h-7 px-2 py-0 text-xs" onClick={() => onSelect(t.id)}>查看</Button>}
            </div>
          </div>
        ))}
        <button className="w-full text-center text-xs text-indigo-600">查看全部（占位）</button>
      </CardContent>
    </Card>
  );
}
