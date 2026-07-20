# UX-05 — Tour de onboarding

**Categoria:** Onboarding
**Estimativa:** Média

## Problema

Usuário novo entra e não sabe por onde começar. Sem orientação sobre features-chave.

## Solução

Lib `react-joyride` ou `intro.js`:

```bash
npm i react-joyride
```

Tour de 6-8 passos no primeiro login:

1. "Bem-vindo ao AuraCash!" (geral, no centro)
2. "Aqui você acompanha seu saldo e projeção" (dashboard cards)
3. "Comece cadastrando suas contas" (link Contas)
4. "Adicione transações aqui" (botão Nova Transação)
5. "Configure recorrências pra automatizar" (link Recorrências)
6. "Veja a quem você precisa cobrar" (link Recebíveis)
7. "Pronto! Vamos começar?" (CTA)

## Implementação

```tsx
// components/OnboardingTour.tsx
import Joyride, { Step } from "react-joyride";

const STEPS: Step[] = [
  { target: ".tour-summary-cards", content: "Aqui você acompanha..." },
  { target: ".tour-add-transaction", content: "Adicione transações aqui" },
  // ...
];

export function OnboardingTour() {
  const { user } = useAuth();
  const [run, setRun] = useState(!user.onboarding_completed);

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showProgress
      callback={(data) => {
        if (data.status === "finished") {
          markOnboardingComplete();
          setRun(false);
        }
      }}
    />
  );
}
```

Backend:

```python
class User(...):
    onboarding_completed = Bool(default=False)
```

## Critérios

- [ ] Tour aparece no primeiro login
- [ ] Pode pular ou completar
- [ ] Não reaparece após concluir
- [ ] Botão "Refazer tour" nas configurações
- [ ] Tema combina com o app
