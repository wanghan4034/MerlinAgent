"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const schema = z.object({
  keyword: z.string().trim().min(1, "关键词必填"),
  pageCount: z.coerce.number().min(1, "最小 1 页").max(50, "最大 50 页"),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  includeSold: z.boolean().default(false),
  matchMode: z.enum(["prefix", "contains"]).default("contains"),
  sortBy: z.enum(["newest", "priceAsc", "valueScore"]).default("newest")
}).refine((v) => (v.minPrice == null || v.maxPrice == null ? true : v.minPrice <= v.maxPrice), {
  message: "最低价不能大于最高价",
  path: ["maxPrice"]
});

export type NewTaskPayload = z.infer<typeof schema> & { extractedKeywords: string[] };

type FormValues = z.infer<typeof schema>;

const stopWords = ["想", "找", "看看", "一下", "我", "要", "帮我", "一个", "的", "和"];

function extractKeywords(keyword: string): string[] {
  const raw = keyword
    .replace(/[，。！？、,.!?]/g, " ")
    .split(/[\s/]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !stopWords.includes(x));
  const dedup = Array.from(new Set(raw));
  return dedup.slice(0, 6);
}

export function NewTaskCard({ onSubmit, isPending }: { onSubmit: (v: NewTaskPayload) => void; isPending: boolean }) {
  const [open, setOpen] = React.useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { keyword: "chanel / 想找香奈儿包", pageCount: 2, includeSold: false, matchMode: "contains", sortBy: "newest" }
  });

  const submit = (values: FormValues) => {
    const extractedKeywords = extractKeywords(values.keyword);
    onSubmit({ ...values, extractedKeywords });
    reset({ ...values, keyword: "", pageCount: 2 });
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>新建抓取任务</CardTitle>
        <p className="text-xs text-slate-500">输入品牌词或中文句子，系统会 mock 提取关键词并创建任务。</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">关键词</label>
          <Input {...register("keyword")} placeholder="例：chanel / 想找香奈儿包" />
          {errors.keyword && <p className="text-xs text-rose-600">{errors.keyword.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-sm font-medium">页数</label>
            <Input type="number" {...register("pageCount")} />
            {errors.pageCount && <p className="text-xs text-rose-600">{errors.pageCount.message}</p>}
          </div>
        </div>

        <button className="text-sm text-indigo-600" onClick={() => setOpen((v) => !v)} type="button">高级设置 {open ? "▲" : "▼"}</button>
        {open && (
          <div className="rounded-md border bg-slate-50 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-700">筛选与匹配策略</div>
            <div className="grid gap-2 md:grid-cols-2">
              <Input type="number" placeholder="最低价" {...register("minPrice")} />
              <Input type="number" placeholder="最高价" {...register("maxPrice")} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("includeSold")} />包含已售</label>
              <select className="h-9 rounded-md border border-slate-300 px-2 text-sm" {...register("matchMode")}>
                <option value="prefix">prefix</option>
                <option value="contains">contains</option>
              </select>
              <select className="h-9 rounded-md border border-slate-300 px-2 text-sm md:col-span-2" {...register("sortBy")}>
                <option value="newest">newest</option>
                <option value="priceAsc">priceAsc</option>
                <option value="valueScore">valueScore</option>
              </select>
            </div>
            {errors.maxPrice && <p className="mt-1 text-xs text-rose-600">{errors.maxPrice.message}</p>}
          </div>
        )}

        <Button className="w-full" onClick={handleSubmit(submit)} disabled={isPending}>{isPending ? "创建中..." : "开始抓取"}</Button>
      </CardContent>
    </Card>
  );
}
