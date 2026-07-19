import { cn } from "@/lib/utils";
import { type SelectHTMLAttributes, forwardRef, useId } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const generatedId = useId();
    const errorId = useId();
    const selectId = id || (label ? generatedId : undefined);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            // text-base (16px) no mobile evita zoom automático do iOS Safari ao focar o campo
            "h-11 w-full rounded-xl border border-surface-border bg-surface px-3.5 text-base sm:text-sm text-white transition-colors",
            "hover:border-gray-600 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p id={errorId} className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
