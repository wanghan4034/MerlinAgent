"use client";

import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppBar } from "@/components/dashboard/AppBar";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { NewTaskCard } from "@/components/dashboard/NewTaskCard";
import { TaskList } from "@/components/dashboard/TaskList";
import { TaskDetailSummary, TaskRawInfo } from "@/components/dashboard/TaskDetail";
import { ItemsBoard } from "@/components/dashboard/ItemsBoard";
import { mockApi } from "@/lib/mockApi";
import { ItemFilters } from "@/lib/types";

export default function DashboardPage() {
  const qc = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | undefined>();
  const [filters, setFilters] = React.useState<ItemFilters>({ status: "all", tab: "latest", recommendedOnly: false });

  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => mockApi.listTasks(), refetchInterval: 1500 });
  const selectedTask = tasksQ.data?.find((t) => t.id === selectedTaskId) ?? tasksQ.data?.[0];

  React.useEffect(() => {
    if (!selectedTaskId && tasksQ.data?.length) setSelectedTaskId(tasksQ.data[0].id);
  }, [selectedTaskId, tasksQ.data]);

  const kpiQ = useQuery({ queryKey: ["kpi"], queryFn: () => mockApi.getKpi() });
  const itemsQ = useQuery({ queryKey: ["items", selectedTask?.id, filters], queryFn: () => mockApi.listItems(selectedTask?.id, filters) });

  const createM = useMutation({
    mutationFn: (v: { keyword: string; pageCount: number }) => mockApi.createTask({ keyword: v.keyword, pageCount: v.pageCount, config: { includeSold: false, matchMode: "all", sortBy: "latest" } }),
    onSuccess: (task) => {
      setSelectedTaskId(task.id);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    }
  });

  const cancelM = useMutation({ mutationFn: (id: string) => mockApi.cancelTask(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }) });
  const retryM = useMutation({ mutationFn: (id: string) => mockApi.retryTask(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }) });

  const refreshAll = () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["items"] }); qc.invalidateQueries({ queryKey: ["kpi"] }); };

  return (
    <main className="mx-auto max-w-[1440px] p-4">
      <AppBar onNewTask={() => document.getElementById("new-task-anchor")?.scrollIntoView({ behavior: "smooth" })} onRefreshAll={refreshAll} onRefreshTasks={() => qc.invalidateQueries({ queryKey: ["tasks"] })} onRefreshItems={() => qc.invalidateQueries({ queryKey: ["items"] })} />

      <KpiCards data={kpiQ.data} isLoading={kpiQ.isLoading} isError={kpiQ.isError} />

      <section id="new-task-anchor" className="mb-4 grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2"><NewTaskCard onSubmit={(v) => createM.mutate(v)} isPending={createM.isPending} /></div>
        <TaskList tasks={tasksQ.data ?? []} selectedId={selectedTask?.id} onSelect={setSelectedTaskId} onCancel={(id) => cancelM.mutate(id)} onRetry={(id) => retryM.mutate(id)} loading={tasksQ.isLoading} />
      </section>

      <section className="mb-4 grid gap-3 lg:grid-cols-2">
        <TaskDetailSummary task={selectedTask} />
        <TaskRawInfo task={selectedTask} />
      </section>

      <ItemsBoard data={itemsQ.data ?? []} loading={itemsQ.isLoading} error={itemsQ.isError} filters={filters} setFilters={setFilters} refresh={() => qc.invalidateQueries({ queryKey: ["items"] })} />
    </main>
  );
}
