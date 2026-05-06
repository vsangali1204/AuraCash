import { useMutation } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RESET_PASSWORD_MUTATION } from "@/graphql/queries/auth";

const schema = z
  .object({
    newPassword: z.string().min(8, "Mínimo de 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";

  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const [resetPassword, { loading }] = useMutation(RESET_PASSWORD_MUTATION, {
    onCompleted: () => setDone(true),
    onError: (error) => toast.error(error.message || "Link inválido ou expirado"),
  });

  const onSubmit = (data: FormData) => {
    resetPassword({ variables: { uid, token, newPassword: data.newPassword } });
  };

  const isInvalidLink = !uid || !token;

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
          {isInvalidLink ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <AlertCircle className="h-12 w-12 text-red-400" />
              </div>
              <h2 className="text-base font-semibold text-white">Link inválido</h2>
              <p className="text-sm text-gray-400">
                Este link de redefinição é inválido. Solicite um novo link.
              </p>
              <Link to="/forgot-password">
                <Button className="w-full mt-2" size="lg">
                  Solicitar novo link
                </Button>
              </Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold text-white">Senha redefinida!</h2>
              <p className="text-sm text-gray-400">
                Sua senha foi alterada com sucesso. Faça login com a nova senha.
              </p>
              <Link to="/login">
                <Button className="w-full mt-2" size="lg">
                  Fazer login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">Nova senha</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Escolha uma senha segura com pelo menos 8 caracteres.
                </p>
              </div>

              <Input
                label="Nova senha"
                type="password"
                placeholder="••••••••"
                error={errors.newPassword?.message}
                {...register("newPassword")}
              />
              <Input
                label="Confirmar senha"
                type="password"
                placeholder="••••••••"
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
              />

              <Button type="submit" className="w-full" loading={loading} size="lg">
                Redefinir senha
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
