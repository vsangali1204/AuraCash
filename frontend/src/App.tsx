import { ApolloProvider } from "@apollo/client";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import { apolloClient } from "@/graphql/client";
import { useAuthStore } from "@/store/authStore";
import { MainLayout } from "@/components/Layout/MainLayout";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { TransactionsPage } from "@/pages/TransactionsPage";
import { CreditCardsPage } from "@/pages/CreditCardsPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { RecurrencesPage } from "@/pages/RecurrencesPage";
import { ReceivablesPage } from "@/pages/ReceivablesPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const HEALTH_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/health/`
  : "/health/";

const KEEP_ALIVE_MS = 10 * 60 * 1000; // 10 minutos

function useKeepAlive(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const ping = () => fetch(HEALTH_URL, { method: "GET" }).catch(() => null);
    ping(); // ping imediato ao autenticar
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
        <Routes>
          <Route
            path="/login"
            element={<PublicRoute><LoginPage /></PublicRoute>}
          />
          <Route
            path="/register"
            element={<PublicRoute><RegisterPage /></PublicRoute>}
          />
          <Route
            element={<ProtectedRoute><MainLayout /></ProtectedRoute>}
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/credit-cards" element={<CreditCardsPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/recurrences" element={<RecurrencesPage />} />
            <Route path="/receivables" element={<ReceivablesPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ApolloProvider>
  );
}
