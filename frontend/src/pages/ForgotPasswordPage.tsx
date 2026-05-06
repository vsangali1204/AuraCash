import { useMutation } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { REQUEST_PASSWORD_RESET_MUTATION } from "@/graphql/queries/auth";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const [requestReset, { loading }] = useMutation(REQUEST_PASSWORD_RESET_MUTATION, {
    onCompleted: () => setSent(true),
    onError: (error) => toast.error(error.message || "Erro ao enviar e-mail"),
  });

  const onSubmit = (data: FormData) => {
    requestReset({ variables: { email: data.email } });
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

        <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold text-white">E-mail enviado!</h2>
              <p className="text-sm text-gray-400">
                Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha.
                Verifique também sua caixa de spam.
              </p>
              <Link to="/login">
                <Button variant="secondary" className="w-full mt-2" size="lg">
                  Voltar ao login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">Redefinir senha</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Informe seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
              </div>

              <Input
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                error={errors.email?.message}
                {...register("email")}
              />

              <Button type="submit" className="w-full" loading={loading} size="lg">
                Enviar link
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-sky-400 hover:text-sky-300 transition-colors"
                >
                  Voltar ao login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
