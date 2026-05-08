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
          className="flex flex-1 flex-col items-center justify-center gap-0.5"
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "flex h-8 w-10 items-center justify-center rounded-2xl transition-all duration-150",
                  isActive ? "bg-sky-500/15" : ""
                )}
              >
                <Icon
                  size={19}
                  className={cn(
                    "transition-colors",
                    isActive ? "text-sky-400" : "text-gray-500"
                  )}
                />
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-sky-400" : "text-gray-600"
                )}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}

      <button
        onClick={onMoreClick}
        className="flex flex-1 flex-col items-center justify-center gap-0.5"
      >
        <span className="flex h-8 w-10 items-center justify-center rounded-2xl">
          <MoreHorizontal size={19} className="text-gray-500" />
        </span>
        <span className="text-[10px] font-medium text-gray-600">Mais</span>
      </button>
    </nav>
  );
}
