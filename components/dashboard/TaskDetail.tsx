import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Task } from "@/lib/types";

export function TaskDetailSummary({ task }: { task?: Task }) {
  if (!task) return <Card><CardHeader><CardTitle>任务结果摘要</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">请选择任务</CardContent></Card>;
  return (
    <Card>
      <CardHeader><CardTitle>任务结果摘要</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 text-sm">
        <div>状态：{task.status}</div><div>进度：{task.progress}%</div>
        <div>抓取量：{task.stats.items}</div><div>新增：{task.stats.totalNew}</div>
        <div>已售：{task.stats.sold}</div><div>推荐：{task.stats.recommendedCount}</div>
      </CardContent>
    </Card>
  );
}

export function TaskRawInfo({ task }: { task?: Task }) {
  if (!task) return <Card><CardHeader><CardTitle>任务原始信息</CardTitle></CardHeader><CardContent className="text-sm text-slate-500">请选择任务</CardContent></Card>;
  return (
    <Card>
      <CardHeader><CardTitle>任务原始信息</CardTitle></CardHeader>
      <CardContent>
        <details>
          <summary className="cursor-pointer text-sm text-slate-700">参数 JSON</summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-100 p-2 text-xs">{JSON.stringify(task.rawParams, null, 2)}</pre>
        </details>
        <div className="mt-3"><Sheet title="任务日志" triggerLabel="查看日志"><pre className="text-xs whitespace-pre-wrap">{task.logs.join("\n")}</pre></Sheet></div>
      </CardContent>
    </Card>
  );
}
