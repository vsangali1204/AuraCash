import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex min-w-0 items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed",
          // loading fica em opacidade cheia (só o spinner indica estado) — disabled "de verdade" escurece
          disabled && !loading && "opacity-50",
          loading && "cursor-wait",
          {
            "bg-sky-500 text-white shadow-sm shadow-sky-950/50 hover:bg-sky-400 active:translate-y-px active:bg-sky-600":
              variant === "primary",
            "bg-surface-card text-gray-300 border border-surface-border hover:bg-surface-hover hover:text-white":
              variant === "secondary",
            "bg-red-600/10 text-red-400 border border-red-600/20 hover:bg-red-600/20":
              variant === "danger",
            "text-gray-400 hover:text-white hover:bg-surface-hover":
              variant === "ghost",
          },
          {
            "min-h-9 px-3 text-sm": size === "sm",
            "min-h-10 px-4 text-sm": size === "md",
            "h-11 px-6 text-base": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
