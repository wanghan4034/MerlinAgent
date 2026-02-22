import * as React from "react";
import { cn } from "@/lib/utils";

export function DropdownMenu({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative inline-block">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && <div className="absolute right-0 z-20 mt-2 min-w-[180px] rounded-md border bg-white p-1 shadow">{children}</div>}
    </div>
  );
}

export function DropdownMenuItem({ className, onClick, children }: React.PropsWithChildren<{ className?: string; onClick?: () => void }>) {
  return <button className={cn("block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100", className)} onClick={onClick}>{children}</button>;
}
