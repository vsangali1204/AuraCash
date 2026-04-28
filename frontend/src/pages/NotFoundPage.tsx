import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <p className="text-6xl font-bold text-sky-500">404</p>
      <h1 className="text-xl font-semibold text-white">Página não encontrada</h1>
      <p className="text-sm text-gray-500">A página que você está procurando não existe.</p>
      <Link
        to="/"
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-surface-border bg-surface-card px-4 text-sm font-medium text-gray-300 hover:bg-surface-hover hover:text-white transition-all"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
