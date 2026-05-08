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

const navGroups = [
  {
    label: "Principal",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
      { to: "/accounts", icon: Wallet, label: "Contas" },
      { to: "/transactions", icon: ArrowLeftRight, label: "Lançamentos" },
    ],
  },
  {
    label: "Crédito",
    items: [
      { to: "/credit-cards", icon: CreditCard, label: "Cartões" },
      { to: "/invoices", icon: FileText, label: "Faturas" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/categories", icon: Tag, label: "Categorias" },
      { to: "/recurrences", icon: RefreshCw, label: "Recorrências" },
      { to: "/receivables", icon: Users, label: "A Receber" },
      { to: "/calendar", icon: Calendar, label: "Calendário" },
      { to: "/reports", icon: BarChart2, label: "Relatórios" },
    ],
  },
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
          "flex h-14 shrink-0 items-center border-b border-surface-border px-4",
          collapsed ? "justify-center" : "gap-2.5"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-900/30">
          <img src="/logo.png" alt="AuraCash" className="h-5 w-5 object-contain" />
        </div>
        {!collapsed && (
          <span className="text-[15px] font-semibold tracking-tight text-white">
            AuraCash
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {!collapsed && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  title={collapsed ? label : undefined}
                  onClick={onItemClick}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                      collapsed ? "justify-center" : "gap-3",
                      isActive
                        ? "bg-white/[0.07] text-white"
                        : "text-gray-500 hover:bg-white/[0.04] hover:text-gray-300"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={17}
                        className={cn(
                          "shrink-0 transition-colors",
                          isActive ? "text-sky-400" : ""
                        )}
                      />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Toggle (desktop only) */}
      {showToggle && (
        <div className="shrink-0 border-t border-surface-border p-2">
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-white/[0.04] hover:text-gray-400 transition-colors"
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      )}
    </>
  );
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
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
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-surface-border bg-surface-card">
            <button
              onClick={onMobileClose}
              className="absolute right-3 top-3.5 rounded-lg p-1.5 text-gray-500 hover:bg-white/[0.05] hover:text-gray-300 transition-colors"
            >
              <X size={17} />
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
