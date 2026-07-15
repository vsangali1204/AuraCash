import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("auracash-sidebar-collapsed") === "true");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("auracash-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Navbar onMobileMenuToggle={() => setMobileMenuOpen((v) => !v)} />
        {/* pb-16 md:pb-0 reserva espaço para o BottomNav no mobile */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-8 lg:p-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav onMoreClick={() => setMobileMenuOpen(true)} />
    </div>
  );
}
