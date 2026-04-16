import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "income" | "expense" | "transfer" | "neutral";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-violet-500/10 text-violet-400": variant === "default",
          "bg-emerald-500/10 text-emerald-400": variant === "income",
          "bg-red-500/10 text-red-400": variant === "expense",
          "bg-blue-500/10 text-blue-400": variant === "transfer",
          "bg-gray-500/10 text-gray-400": variant === "neutral",
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
