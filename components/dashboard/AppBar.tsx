"use client";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function AppBar({ onNewTask, onRefreshAll, onRefreshTasks, onRefreshItems }: { onNewTask: () => void; onRefreshAll: () => void; onRefreshTasks: () => void; onRefreshItems: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">Mercari 爬虫可视化控制台 Pro</h1>
        <p className="text-sm text-slate-500">新建抓取任务 → 监控任务 → 查看结果 → 筛选商品</p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onNewTask}>新建任务</Button>
        <DropdownMenu trigger={<Button variant="outline">刷新</Button>}>
          <DropdownMenuItem onClick={onRefreshTasks}>刷新任务</DropdownMenuItem>
          <DropdownMenuItem onClick={onRefreshItems}>刷新商品</DropdownMenuItem>
          <DropdownMenuItem onClick={onRefreshAll}>刷新全部</DropdownMenuItem>
        </DropdownMenu>
        <Button variant="outline">设置</Button>
      </div>
    </div>
  );
}
