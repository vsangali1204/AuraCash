# UX-14 — Wizard para cadastrar primeiro cartão / conta

**Categoria:** Onboarding
**Estimativa:** Baixa

## Problema

Form de cadastro de cartão exige saber: nome, bandeira, limite, dia de fechamento, dia de vencimento. Iniciantes não sabem onde achar (estão na fatura ou no app do banco).

## Solução

Wizard de 3-4 passos com explicações visuais:

### Passo 1 — Identidade
"Como você chama esse cartão?"
- Nome (Itaú Principal, Nubank, etc.)
- Bandeira (com logos clicáveis)

### Passo 2 — Limite
"Qual o limite total?"
- Campo numérico com formatação
- Texto: "Você acha no app do banco ou no extrato"

### Passo 3 — Datas
"Quando fecha e vence sua fatura?"
- Dois inputs com sliders/scroll-wheel
- Exemplo visual: "Compra dia 5, fecha dia 10, vence dia 20"
- Mini ilustração mostrando o ciclo

### Passo 4 — Conta para pagamento (opcional)
"Qual conta você usa para pagar?"

### Final
Confirmação visual com card preview.

## Implementação

Para o componente, usar lib `react-hook-form` com `mode: "onChange"` para validar enquanto preenche. Estado de passo em local state.

Aplicar mesmo padrão para:
- Primeiro cartão (mais útil)
- Primeira conta
- Primeira recorrência

## Critérios

- [ ] Wizard ativado apenas no primeiro cadastro de cada tipo
- [ ] Ilustrações nos passos explicativos
- [ ] Botão "Modo avançado" → form único pra power users
- [ ] Indicador de progresso (1/4, 2/4)
- [ ] Animação entre passos
