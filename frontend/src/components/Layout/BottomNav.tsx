import { LayoutDashboard, ArrowLeftRight, Wallet, CreditCard, MoreHorizontal } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  onMoreClick: () => void;
}

const mainItems = [
  { to: "/", icon: LayoutDashboard, label: "Início", end: true },
  { to: "/transactions", icon: ArrowLeftRight, label: "Lançamentos" },
  { to: "/accounts", icon: Wallet, label: "Contas" },
  { to: "/credit-cards", icon: CreditCard, label: "Cartões" },
];

export function BottomNav({ onMoreClick }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch border-t border-surface-border bg-surface-card md:hidden">
      {mainItems.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
              isActive ? "text-violet-400" : "text-gray-500 hover:text-gray-300"
            )
          }
        >
          {({ isActive }) => (
            <>
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg transition-colors", isActive && "bg-violet-600/15")}>
                <Icon size={18} />
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}

      {/* Mais — abre o sidebar mobile */}
      <button
        onClick={onMoreClick}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-gray-500 hover:text-gray-300 transition-colors"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg">
          <MoreHorizontal size={18} />
        </span>
        Mais
      </button>
    </nav>
  );
}
