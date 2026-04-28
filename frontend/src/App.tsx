import { ApolloProvider } from "@apollo/client";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { apolloClient } from "@/graphql/client";
import { useAuthStore } from "@/store/authStore";
import { MainLayout } from "@/components/Layout/MainLayout";

// Páginas carregadas sob demanda — cada rota vira um chunk separado
const LoginPage       = lazy(() => import("@/pages/LoginPage").then(m => ({ default: m.LoginPage })));
const RegisterPage    = lazy(() => import("@/pages/RegisterPage").then(m => ({ default: m.RegisterPage })));
const DashboardPage   = lazy(() => import("@/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const AccountsPage    = lazy(() => import("@/pages/AccountsPage").then(m => ({ default: m.AccountsPage })));
const CategoriesPage  = lazy(() => import("@/pages/CategoriesPage").then(m => ({ default: m.CategoriesPage })));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage").then(m => ({ default: m.TransactionsPage })));
const CreditCardsPage = lazy(() => import("@/pages/CreditCardsPage").then(m => ({ default: m.CreditCardsPage })));
const InvoicesPage    = lazy(() => import("@/pages/InvoicesPage").then(m => ({ default: m.InvoicesPage })));
const RecurrencesPage = lazy(() => import("@/pages/RecurrencesPage").then(m => ({ default: m.RecurrencesPage })));
const ReceivablesPage = lazy(() => import("@/pages/ReceivablesPage").then(m => ({ default: m.ReceivablesPage })));
const CalendarPage    = lazy(() => import("@/pages/CalendarPage").then(m => ({ default: m.CalendarPage })));
const ReportsPage     = lazy(() => import("@/pages/ReportsPage").then(m => ({ default: m.ReportsPage })));
const NotFoundPage    = lazy(() => import("@/pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })));

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-surface-border border-t-violet-500" />
    </div>
  );
}

const HEALTH_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/health/`
  : "/health/";

const KEEP_ALIVE_MS = 10 * 60 * 1000;

function useKeepAlive(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const ping = () => fetch(HEALTH_URL, { method: "GET" }).catch(() => null);
    ping();
    const id = setInterval(ping, KEEP_ALIVE_MS);
    return () => clearInterval(id);
  }, [enabled]);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  useKeepAlive(isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1a1a24",
              color: "#fff",
              border: "1px solid #2a2a3a",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route path="/"             element={<DashboardPage />} />
              <Route path="/accounts"     element={<AccountsPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/categories"   element={<CategoriesPage />} />
              <Route path="/credit-cards" element={<CreditCardsPage />} />
              <Route path="/invoices"     element={<InvoicesPage />} />
              <Route path="/recurrences"  element={<RecurrencesPage />} />
              <Route path="/receivables"  element={<ReceivablesPage />} />
              <Route path="/calendar"     element={<CalendarPage />} />
              <Route path="/reports"      element={<ReportsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ApolloProvider>
  );
}
