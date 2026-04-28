import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wallet,
  Tag,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  RefreshCw,
  Users,
  Calendar,
  BarChart2,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/accounts", icon: Wallet, label: "Contas" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Lançamentos" },
  { to: "/categories", icon: Tag, label: "Categorias" },
  { to: "/credit-cards", icon: CreditCard, label: "Cartões de Crédito" },
  { to: "/invoices", icon: FileText, label: "Faturas" },
  { to: "/recurrences", icon: RefreshCw, label: "Recorrências" },
  { to: "/receivables", icon: Users, label: "A Receber" },
  { to: "/calendar", icon: Calendar, label: "Calendário" },
  { to: "/reports", icon: BarChart2, label: "Relatórios" },
];

function SidebarContent({
  collapsed,
  onToggle,
  onItemClick,
  showToggle = true,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
  showToggle?: boolean;
}) {
  return (
    <>
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-surface-border px-4 shrink-0",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        <img src="/logo.png" alt="AuraCash" className="h-8 w-8 shrink-0 object-contain" />
        {!collapsed && (
          <span className="text-base font-semibold text-white">AuraCash</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 pt-4">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            onClick={onItemClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sky-600/15 text-sky-400"
                  : "text-gray-400 hover:bg-surface-hover hover:text-white"
              )
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Toggle (desktop only) */}
      {showToggle && (
        <div className="border-t border-surface-border p-2 shrink-0">
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-surface-hover hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      )}
    </>
  );
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar — always visible on md+ */}
      <aside
        className={cn(
          "hidden md:flex h-full flex-col border-r border-surface-border bg-surface-card transition-all duration-300",
          collapsed ? "w-16" : "w-56"
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={onToggle} />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <aside className="relative flex h-full w-64 flex-col border-r border-surface-border bg-surface-card">
            {/* Close button */}
            <button
              onClick={onMobileClose}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-surface-hover hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <SidebarContent
              collapsed={false}
              onToggle={onToggle}
              onItemClick={onMobileClose}
              showToggle={false}
            />
          </aside>
        </div>
      )}
    </>
  );
}
