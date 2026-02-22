import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Task } from "@/lib/types";

function MetricBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs"><span>{label}</span><span>{value}</span></div>
      <div className="h-2 rounded bg-slate-200"><div className="h-full rounded bg-indigo-600" style={{ width: `${width}%` }} /></div>
    </div>
  );
}

export function TaskDetailSummary({ task, loading }: { task?: Task; loading?: boolean }) {
  if (loading) return <Card><CardHeader><CardTitle>任务结果摘要</CardTitle></CardHeader><CardContent className="space-y-2"><div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" /><div className="h-16 animate-pulse rounded bg-slate-100" /></CardContent></Card>;
  if (!task) return <Card><CardHeader><CardTitle>任务结果摘要</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">请选择任务，或先创建任务</CardContent></Card>;

  const maxBase = Math.max(task.stats.items, task.stats.totalNew, task.stats.sold, task.stats.recommendedCount, 1);
  return (
    <Card>
      <CardHeader><CardTitle>任务结果摘要</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>items: {task.stats.items}</div><div>totalNew: {task.stats.totalNew}</div>
          <div>sold: {task.stats.sold}</div><div>avgPrice: ¥{task.stats.avgPrice || 0}</div>
          <div>recommended: {task.stats.recommendedCount}</div><div>errorCount: {task.stats.errorCount}</div>
        </div>
        <MetricBar label="抓取总量" value={task.stats.items} max={maxBase} />
        <MetricBar label="新增" value={task.stats.totalNew} max={maxBase} />
        <MetricBar label="推荐" value={task.stats.recommendedCount} max={maxBase} />
      </CardContent>
    </Card>
  );
}

export function TaskRawInfo({ task, loading }: { task?: Task; loading?: boolean }) {
  if (loading) return <Card><CardHeader><CardTitle>任务原始信息</CardTitle></CardHeader><CardContent><div className="h-24 animate-pulse rounded bg-slate-100" /></CardContent></Card>;
  if (!task) return <Card><CardHeader><CardTitle>任务原始信息</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">暂无任务可展示</CardContent></Card>;

  const sortedLogs = [...task.logs].sort();
  return (
    <Card>
      <CardHeader><CardTitle>任务原始信息</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded border bg-slate-50 p-2 text-xs">
          <div>matchMode: {task.config.matchMode}</div>
          <div>sortBy: {task.config.sortBy}</div>
          <div>includeSold: {String(task.config.includeSold)}</div>
          <div>priceRange: {task.config.minPrice ?? "-"} ~ {task.config.maxPrice ?? "-"}</div>
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-slate-700">rawParams JSON</summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-100 p-2 text-xs">{JSON.stringify(task.rawParams, null, 2)}</pre>
        </details>
        <div className="flex items-center gap-2">
          <Sheet title="任务日志" triggerLabel="查看日志">
            <div className="mb-2">
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(sortedLogs.join("\n"))}>复制日志</Button>
            </div>
            <pre className="text-xs whitespace-pre-wrap">{sortedLogs.join("\n")}</pre>
          </Sheet>
        </div>
      </CardContent>
    </Card>
  );
}
