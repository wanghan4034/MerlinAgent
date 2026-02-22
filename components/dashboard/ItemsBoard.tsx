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

export function ItemsBoard({ data, loading, error, filters, setFilters, refresh }: { data: Item[]; loading: boolean; error: boolean; filters: ItemFilters; setFilters: (f: ItemFilters) => void; refresh: () => void }) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "listedAt", desc: true }]);
  const columns = React.useMemo<ColumnDef<Item>[]>(() => [
    { accessorKey: "imageUrl", header: "图片", cell: ({ row }) => <img className="h-12 w-16 rounded object-cover" src={row.original.imageUrl} alt="item" /> },
    { accessorKey: "title", header: "标题" },
    { accessorKey: "price", header: "价格", cell: ({ row }) => `¥${row.original.price}` },
    { accessorKey: "status", header: "状态", cell: ({ row }) => <Badge>{row.original.status}</Badge> },
    { accessorKey: "matchedKeywords", header: "匹配关键词", cell: ({ row }) => row.original.matchedKeywords.join(", ") },
    { accessorKey: "listedAt", header: "上架时间" },
    { accessorKey: "valueScore", header: "性价比分" },
    { id: "action", header: "操作", cell: ({ row }) => <a href={row.original.url} target="_blank" className="text-indigo-600">查看</a> }
  ], []);

  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel() });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between"><CardTitle>商品看板</CardTitle><Button variant="outline" onClick={refresh}>刷新</Button></CardHeader>
      <CardContent className="space-y-3">
        <Tabs>
          <TabsList>
            {(["latest", "recommended", "all", "sold"] as const).map((t) => <TabsTrigger key={t} active={filters.tab === t} onClick={() => setFilters({ ...filters, tab: t })}>{t === "latest" ? "最新" : t === "recommended" ? "推荐" : t === "all" ? "全部" : "已售"}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="grid gap-2 md:grid-cols-6">
          <Input placeholder="标题关键词" value={filters.title ?? ""} onChange={(e) => setFilters({ ...filters, title: e.target.value })} />
          <Input placeholder="包含关键词" value={filters.keyword ?? ""} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} />
          <Input placeholder="最低价" type="number" value={filters.minPrice ?? ""} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value ? Number(e.target.value) : undefined })} />
          <Input placeholder="最高价" type="number" value={filters.maxPrice ?? ""} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value ? Number(e.target.value) : undefined })} />
          <select className="h-9 rounded-md border border-slate-300 px-2 text-sm" value={filters.status ?? "all"} onChange={(e) => setFilters({ ...filters, status: e.target.value as ItemFilters["status"] })}>
            <option value="all">全部状态</option><option value="active">在售</option><option value="sold">已售</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!filters.recommendedOnly} onChange={(e) => setFilters({ ...filters, recommendedOnly: e.target.checked })} />仅看推荐</label>
        </div>

        {loading && <div className="text-sm text-slate-500">商品加载中...</div>}
        {error && <div className="text-sm text-rose-600">商品加载失败</div>}
        {!loading && !error && data.length === 0 && <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">暂无商品数据</div>}

        {!loading && !error && data.length > 0 && (
          <>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => <TableRow key={hg.id}>{hg.headers.map((h) => <TableHead key={h.id} onClick={h.column.getToggleSortingHandler()} className="cursor-pointer">{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>)}</TableRow>)}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>上一页</Button>
              <Button variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>下一页</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
