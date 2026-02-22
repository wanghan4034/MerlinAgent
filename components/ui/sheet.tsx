import * as React from "react";
import { Button } from "@/components/ui/button";

export function Sheet({ title, triggerLabel = "查看", children }: React.PropsWithChildren<{ title: string; triggerLabel?: string }>) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>{triggerLabel}</Button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-[420px] overflow-auto bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h4 className="font-semibold">{title}</h4><Button variant="ghost" onClick={() => setOpen(false)}>关闭</Button></div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
