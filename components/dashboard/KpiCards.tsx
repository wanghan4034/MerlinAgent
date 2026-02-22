import { Card, CardContent } from "@/components/ui/card";

export function KpiCards({ data, isLoading, isError }: { data?: Record<string, number>; isLoading: boolean; isError: boolean }) {
  const entries = [
    ["总商品数", data?.totalItems],
    ["活跃关键词", data?.activeKeywords],
    ["已售商品", data?.soldItems],
    ["均价", data?.avgPrice],
    ["24h新增", data?.new24h],
    ["成功率/耗时", data ? `${data.successRate}% / ${data.avgDurationSec}s` : undefined]
  ];
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {entries.map(([label, value]) => (
        <Card key={String(label)}>
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">{String(label)}</div>
            <div className="mt-1 text-xl font-bold">{isLoading ? "..." : isError ? "错误" : String(value ?? "-")}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
