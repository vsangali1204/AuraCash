import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg" | "none";
  interactive?: boolean;
}

export function Card({ className, padding = "md", interactive = false, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-surface-card shadow-card",
        interactive && "transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-surface-raised",
        {
          "p-3": padding === "sm",
          "p-4 sm:p-5": padding === "md",
          "p-6": padding === "lg",
          "p-0": padding === "none",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
