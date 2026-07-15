import { LayoutDashboard, ArrowLeftRight, CreditCard, MoreHorizontal, Plus } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  onMoreClick: () => void;
}

const leftItems = [
  { to: "/", icon: LayoutDashboard, label: "Início", end: true },
  { to: "/transactions", icon: ArrowLeftRight, label: "Lançamentos" },
];

const rightItems = [
  { to: "/credit-cards", icon: CreditCard, label: "Cartões" },
];

function NavItem({ to, icon: Icon, label, end }: (typeof leftItems)[number]) {
  return (
    <NavLink to={to} end={end} className="flex flex-1 flex-col items-center justify-center gap-0.5">
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "flex h-8 w-10 items-center justify-center rounded-2xl transition-all duration-150",
              isActive ? "bg-sky-500/15" : ""
            )}
          >
            <Icon size={19} className={cn("transition-colors", isActive ? "text-sky-400" : "text-gray-500")} />
          </span>
          <span className={cn("text-[10px] font-medium transition-colors", isActive ? "text-sky-400" : "text-gray-600")}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function BottomNav({ onMoreClick }: BottomNavProps) {
  const navigate = useNavigate();

  return (
    <nav aria-label="Navegação principal" className="safe-bottom fixed bottom-0 left-0 right-0 z-40 flex h-[4.5rem] items-stretch border-t border-white/[0.08] bg-surface-card/95 backdrop-blur md:hidden">
      {leftItems.map((item) => <NavItem key={item.to} {...item} />)}

      {/* Acesso rápido — abre direto o formulário de novo lançamento, de qualquer página */}
      <button
        onClick={() => navigate("/transactions", { state: { openCreate: true } })}
        aria-label="Novo lançamento"
        className="flex flex-1 flex-col items-center justify-center"
      >
        <span className="flex h-12 w-12 -translate-y-2 items-center justify-center rounded-2xl bg-sky-500 shadow-lg shadow-sky-950/60 active:bg-sky-600">
          <Plus size={22} className="text-white" />
        </span>
      </button>

      {rightItems.map((item) => <NavItem key={item.to} {...item} />)}

      <button
        onClick={onMoreClick}
        aria-label="Mais opções"
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
