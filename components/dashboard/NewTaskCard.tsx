"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import React from "react";

const schema = z.object({ keyword: z.string().min(1, "关键词必填"), pageCount: z.coerce.number().min(1).max(50) });

type FormValues = z.infer<typeof schema>;

export function NewTaskCard({ onSubmit, isPending }: { onSubmit: (v: FormValues) => void; isPending: boolean }) {
  const [open, setOpen] = React.useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { keyword: "想找香奈儿包包", pageCount: 2 } });

  return (
    <Card className="h-full">
      <CardHeader><CardTitle>新建抓取任务</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="mb-1 block text-sm">关键词</label>
          <Input {...register("keyword")} placeholder="支持中文一句话" />
          {errors.keyword && <p className="text-xs text-rose-600">{errors.keyword.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm">页数</label>
          <Input type="number" {...register("pageCount")} />
          {errors.pageCount && <p className="text-xs text-rose-600">{errors.pageCount.message}</p>}
        </div>
        <button className="text-sm text-indigo-600" onClick={() => setOpen((v) => !v)} type="button">高级设置 {open ? "▲" : "▼"}</button>
        {open && <div className="rounded-md border bg-slate-50 p-2 text-xs text-slate-600">minPrice/maxPrice/includeSold/matchMode/sortBy 已内置 mock 配置。</div>}
        <Button className="w-full" onClick={handleSubmit(onSubmit)} disabled={isPending}>{isPending ? "创建中..." : "开始抓取"}</Button>
      </CardContent>
    </Card>
  );
}
