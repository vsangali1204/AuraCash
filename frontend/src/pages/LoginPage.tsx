import { useMutation } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LOGIN_MUTATION } from "@/graphql/queries/auth";
import { useAuthStore } from "@/store/authStore";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
  rememberMe: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { rememberMe: false } });

  const rememberMe = watch("rememberMe");

  const [loginMutation, { loading }] = useMutation(LOGIN_MUTATION, {
    onCompleted: (data) => {
      const { accessToken, refreshToken, user } = data.login;
      login(accessToken, refreshToken, user, rememberMe);
      navigate("/");
    },
    onError: (error) => {
      const message = error.message || "Erro ao fazer login";
      setFormError(message);
      toast.error(message);
    },
  });

  const onSubmit = (data: FormData) => {
    setFormError(null);
    loginMutation({ variables: { input: { email: data.email, password: data.password } } });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(14,165,233,0.13),transparent_32%)]" />
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 shadow-xl shadow-sky-950/50">
            <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">AuraCash</h1>
          <p className="mt-1 text-sm text-gray-400">Clareza para decidir melhor sobre seu dinheiro</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="relative space-y-5 rounded-3xl border border-white/[0.09] bg-surface-card p-6 shadow-2xl shadow-black/40 sm:p-7"
        >
          <h2 className="text-base font-semibold text-white">Entrar na conta</h2>

          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            autoFocus
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />

          {formError && <p className="text-sm text-red-400">{formError}</p>}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-5 w-5 rounded-md border-surface-border bg-surface accent-sky-500"
                {...register("rememberMe")}
              />
              <span className="text-sm text-gray-400">Manter conectado</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-sm text-sky-400 hover:text-sky-300 transition-colors"
            >
              Esqueceu a senha?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={loading} size="lg">
            Entrar
          </Button>

          <div className="border-t border-surface-border pt-4">
            <p className="text-center text-sm text-gray-500 mb-3">Não tem conta ainda?</p>
            <Link to="/register">
              <Button type="button" variant="secondary" className="w-full" size="lg">
                Criar conta grátis
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
