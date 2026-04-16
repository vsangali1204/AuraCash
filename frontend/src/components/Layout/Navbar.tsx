import { useAuthStore } from "@/store/authStore";
import { LogOut, Menu, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface NavbarProps {
  onMobileMenuToggle: () => void;
}

export function Navbar({ onMobileMenuToggle }: NavbarProps) {
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-surface-border bg-surface-card px-4 md:px-6">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMobileMenuToggle}
        className="rounded-lg p-2 text-gray-400 hover:bg-surface-hover hover:text-white transition-colors md:hidden"
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Spacer — desktop */}
      <div className="hidden md:block" />

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-surface-hover hover:text-white transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600/20 text-violet-400">
            <User size={14} />
          </div>
          <span className="hidden sm:block max-w-[120px] truncate">{user?.name}</span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-surface-border bg-surface-card p-1 shadow-xl z-50">
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <div className="my-1 border-t border-surface-border" />
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
