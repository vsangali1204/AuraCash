import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/graphql": {
        target: "http://localhost:8021",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8021",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — raramente muda, fica cacheado no browser
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Apollo + GraphQL — cache separado do resto
          "vendor-apollo": ["@apollo/client", "graphql"],
          // Recharts só é carregado em Dashboard e Reports
          "vendor-charts": ["recharts"],
          // Formulários
          "vendor-forms": ["react-hook-form", "zod", "@hookform/resolvers"],
          // Utilitários pequenos
          "vendor-utils": ["date-fns", "clsx", "tailwind-merge", "lucide-react"],
        },
      },
    },
  },
});
