import { useMutation } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LOGIN_MUTATION } from "@/graphql/queries/auth";
import { useAuthStore } from "@/store/authStore";
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
      toast.error(error.message || "Erro ao fazer login");
    },
  });

  const onSubmit = (data: FormData) => {
    loginMutation({ variables: { input: { email: data.email, password: data.password } } });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600">
            <span className="text-xl font-bold text-white">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white">AuraCash</h1>
          <p className="mt-1 text-sm text-gray-500">Controle financeiro pessoal</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-2xl border border-surface-border bg-surface-card p-6 space-y-4"
        >
          <h2 className="text-base font-semibold text-white">Entrar na conta</h2>

          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-surface-border bg-surface accent-sky-500"
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
