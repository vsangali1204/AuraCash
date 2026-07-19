import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { type InputHTMLAttributes, forwardRef, useId, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, type, ...props }, ref) => {
    const generatedId = useId();
    const errorId = useId();
    const inputId = id || (label ? generatedId : undefined);
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword ? (showPassword ? "text" : "password") : type}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              // text-base (16px) no mobile evita zoom automático do iOS Safari ao focar o campo
              "h-11 w-full rounded-xl border border-surface-border bg-surface px-3.5 text-base sm:text-sm text-white placeholder:text-gray-500 transition-colors",
              "hover:border-gray-600 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30",
              "disabled:cursor-not-allowed disabled:opacity-50",
              isPassword && "pr-10",
              error && "border-red-500 focus:border-red-500 focus:ring-red-500",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error && <p id={errorId} className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
