import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("space-y-3", className)}>{children}</div>;
}

export function TabsList({ children }: React.PropsWithChildren) {
  return <div className="inline-flex rounded-md border bg-white p-1">{children}</div>;
}

export function TabsTrigger({ active, onClick, children }: React.PropsWithChildren<{ active?: boolean; onClick?: () => void }>) {
  return <button onClick={onClick} className={cn("rounded px-3 py-1 text-sm", active ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100")}>{children}</button>;
}
