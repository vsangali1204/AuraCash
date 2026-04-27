import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop — clicável apenas no desktop (mobile usa swipe/botão) */}
      <div
        className="hidden sm:block absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Mobile: bottom-sheet */}
      <div
        className={cn(
          "sm:hidden fixed inset-x-0 bottom-0 z-10 flex flex-col rounded-t-2xl bg-surface-card max-h-[94vh]",
          "border-t border-surface-border shadow-2xl"
        )}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-surface-border" />
        </div>
        {title && (
          <div className="flex items-center justify-between border-b border-surface-border px-4 py-3 shrink-0">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-surface-hover hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-4 pb-8">{children}</div>
      </div>

      {/* Desktop: side panel from right */}
      <div className="hidden sm:flex ml-auto relative z-10 h-full w-full max-w-md flex-col bg-surface-card border-l border-surface-border shadow-2xl">
        {title && (
          <div className="flex items-center justify-between border-b border-surface-border px-6 py-4 shrink-0">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-surface-hover hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}
