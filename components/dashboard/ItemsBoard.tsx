"use client";

import React from "react";
import { ColumnDef, flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, SortingState, useReactTable } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Item, ItemFilters } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";

function fromNow(iso: string) {
  const diff = Date.now() - +new Date(iso);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

export function ItemsBoard({ data, loading, error, filters, setFilters, refresh }: { data: Item[]; loading: boolean; error: boolean; filters: ItemFilters; setFilters: (f: ItemFilters) => void; refresh: () => void }) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "listedAt", desc: true }]);
  const [pageSize, setPageSize] = React.useState(10);
  const [activeRow, setActiveRow] = React.useState<Item | null>(null);

  const columns = React.useMemo<ColumnDef<Item>[]>(() => [
    { accessorKey: "imageUrl", header: "图片", cell: ({ row }) => <img className="h-12 w-12 rounded object-cover" src={row.original.imageUrl} alt="item" loading="lazy" /> },
    { accessorKey: "title", header: "标题", cell: ({ row }) => <div className="line-clamp-2 max-w-[240px]">{row.original.title}</div> },
    { accessorKey: "price", header: "价格", cell: ({ row }) => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(row.original.price) },
    { accessorKey: "status", header: "状态", cell: ({ row }) => <Badge>{row.original.status}</Badge> },
    {
      accessorKey: "matchedKeywords", header: "匹配关键词", cell: ({ row }) => {
        const words = row.original.matchedKeywords;
        const first = words.slice(0, 2).join(", ");
        const rest = words.length > 2 ? ` +${words.length - 2}` : "";
        return `${first}${rest}`;
      }
    },
    { accessorKey: "listedAt", header: "上架时间", cell: ({ row }) => fromNow(row.original.listedAt) },
    { accessorKey: "valueScore", header: "性价比分" },
    {
      id: "action", header: "操作", cell: ({ row }) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <a href={row.original.url} target="_blank" className="text-indigo-600">打开</a>
          <button className="text-indigo-600" onClick={() => navigator.clipboard.writeText(row.original.url)}>复制链接</button>
        </div>
      )
    }
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination: { pageIndex: 0, pageSize } },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  const resetFilters = () => setFilters({ status: "all", tab: "latest", sortBy: "newest", recommendedOnly: false });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between"><CardTitle>商品看板</CardTitle><Button variant="outline" onClick={refresh}>刷新</Button></CardHeader>
      <CardContent className="space-y-3">
        <Tabs>
          <TabsList>
            {(["latest", "recommended", "all", "sold"] as const).map((t) => (
              <TabsTrigger key={t} active={filters.tab === t} onClick={() => setFilters({ ...filters, tab: t, recommendedOnly: t === "recommended" ? true : filters.recommendedOnly })}>
                {t === "latest" ? "最新" : t === "recommended" ? "推荐" : t === "all" ? "全部" : "已售"}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid gap-2 md:grid-cols-8">
          <Input placeholder="标题关键词" value={filters.title ?? ""} onChange={(e) => setFilters({ ...filters, title: e.target.value })} />
          <Input placeholder="包含关键词" value={filters.containsKeyword ?? ""} onChange={(e) => setFilters({ ...filters, containsKeyword: e.target.value })} />
          <Input placeholder="最低价" type="number" value={filters.minPrice ?? ""} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value ? Number(e.target.value) : undefined })} />
          <Input placeholder="最高价" type="number" value={filters.maxPrice ?? ""} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value ? Number(e.target.value) : undefined })} />
          <select className="h-9 rounded-md border border-slate-300 px-2 text-sm" value={filters.status ?? "all"} onChange={(e) => setFilters({ ...filters, status: e.target.value as ItemFilters["status"] })}>
            <option value="all">状态 all</option><option value="active">active</option><option value="sold">sold</option>
          </select>
          <select className="h-9 rounded-md border border-slate-300 px-2 text-sm" value={filters.sortBy ?? "newest"} onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as ItemFilters["sortBy"] })}>
            <option value="newest">newest</option><option value="priceAsc">priceAsc</option><option value="priceDesc">priceDesc</option><option value="valueScore">valueScore</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!filters.recommendedOnly || filters.tab === "recommended"} onChange={(e) => setFilters({ ...filters, recommendedOnly: e.target.checked })} disabled={filters.tab === "recommended"} />仅看性价比推荐</label>
          <Button variant="outline" onClick={resetFilters}>重置筛选</Button>
        </div>

        {loading && <div className="text-sm text-slate-500">商品加载中...</div>}
        {error && <div className="text-sm text-rose-600">商品加载失败</div>}
        {!loading && !error && data.length === 0 && <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">暂无数据，请调整筛选或等待任务完成。</div>}

        {!loading && !error && data.length > 0 && (
          <>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => <TableRow key={hg.id}>{hg.headers.map((h) => <TableHead key={h.id} onClick={h.column.getToggleSortingHandler()} className="cursor-pointer">{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>)}</TableRow>)}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="cursor-pointer" onClick={() => setActiveRow(row.original)}>
                      {row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <select className="h-9 rounded-md border border-slate-300 px-2 text-sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                <option value={10}>10/页</option><option value={20}>20/页</option><option value={50}>50/页</option>
              </select>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>上一页</Button>
                <Button variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>下一页</Button>
              </div>
            </div>
          </>
        )}

        <Sheet title="商品详情" open={!!activeRow} onOpenChange={(v) => { if (!v) setActiveRow(null); }}>
          {activeRow && (
            <>
              <img src={activeRow.imageUrl} alt={activeRow.title} className="mb-3 w-full rounded" />
              <div className="space-y-1 text-sm">
                <div className="font-semibold">{activeRow.title}</div>
                <div>价格: ¥{activeRow.price}</div>
                <div>关键词: {activeRow.matchedKeywords.join(", ")}</div>
                <div>valueScore: {activeRow.valueScore}</div>
                <a href={activeRow.url} target="_blank" className="text-indigo-600">打开链接</a>
              </div>
            </>
          )}
        </Sheet>
      </CardContent>
    </Card>
  );
}
