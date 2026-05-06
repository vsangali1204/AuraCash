import { create } from "zustand";
import { persist, StateStorage } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string, user: User, rememberMe?: boolean) => void;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
}

// Persiste em localStorage quando "manter conectado" está ativo, sessionStorage caso contrário
const dynamicStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name) ?? sessionStorage.getItem(name),
  setItem: (name, value) => {
    const remember = localStorage.getItem("auracash-remember") === "true";
    if (remember) {
      localStorage.setItem(name, value);
      sessionStorage.removeItem(name);
    } else {
      sessionStorage.setItem(name, value);
      localStorage.removeItem(name);
    }
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      login: (accessToken, refreshToken, user, rememberMe = false) => {
        if (rememberMe) {
          localStorage.setItem("auracash-remember", "true");
        } else {
          localStorage.removeItem("auracash-remember");
        }
        set({ accessToken, refreshToken, user, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem("auracash-remember");
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
      },

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
    }),
    {
      name: "auracash-auth",
      storage: dynamicStorage,
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
