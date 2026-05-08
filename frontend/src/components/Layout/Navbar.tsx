import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { LogOut, Menu, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/accounts": "Contas",
  "/transactions": "Lançamentos",
  "/categories": "Categorias",
  "/credit-cards": "Cartões de Crédito",
  "/invoices": "Faturas",
  "/recurrences": "Recorrências",
  "/receivables": "A Receber",
  "/calendar": "Calendário",
  "/reports": "Relatórios",
};

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface NavbarProps {
  onMobileMenuToggle: () => void;
}

export function Navbar({ onMobileMenuToggle }: NavbarProps) {
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const pageTitle = pageTitles[location.pathname] ?? "AuraCash";
  const initials = getInitials(user?.name);
  const firstName = user?.name?.split(" ")[0] ?? "";

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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-surface-border bg-surface-card px-4 md:px-6">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-white/[0.05] hover:text-gray-300 transition-colors md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
        <h1 className="hidden text-sm font-semibold text-white sm:block">{pageTitle}</h1>
      </div>

      {/* Right — user menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.05]"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-[11px] font-bold text-white shadow-md shadow-sky-900/30">
            {initials}
          </div>
          <span className="hidden max-w-[100px] truncate text-sm font-medium text-gray-300 sm:block">
            {firstName}
          </span>
          <ChevronDown
            size={13}
            className={cn(
              "hidden text-gray-500 transition-transform duration-200 sm:block",
              menuOpen && "rotate-180"
            )}
          />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-surface-border bg-[#1e1e1e] p-1 shadow-2xl shadow-black/40">
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-xs font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{user?.name}</p>
                <p className="truncate text-[11px] text-gray-500">{user?.email}</p>
              </div>
            </div>
            <div className="my-1 border-t border-surface-border" />
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
            >
              <LogOut size={14} />
              Sair da conta
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
