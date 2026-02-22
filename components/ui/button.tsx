import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost" | "destructive";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  default: "bg-indigo-600 text-white hover:bg-indigo-700",
  outline: "border border-slate-300 bg-white hover:bg-slate-50",
  ghost: "hover:bg-slate-100",
  destructive: "bg-rose-600 text-white hover:bg-rose-700"
};

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return <button className={cn("rounded-md px-3 py-2 text-sm font-medium transition", styles[variant], className)} {...props} />;
}
