# UX-27 — Calendário em vista de semana / agenda

**Categoria:** Visualização
**Estimativa:** Média

## Problema

CalendarPage é só mensal. Vista limitada — não dá pra ver hora/detalhe dos eventos do dia, nem ver a "próxima semana" sem ir ao mês todo.

## Solução

Toggle de visualização: Mês / Semana / Agenda.

### Semana
Grid de 7 colunas (seg-dom), eventos como cards verticais. Tipo Google Calendar.

### Agenda
Lista linear ordenada por data próxima:

```
HOJE, segunda-feira, 30/06
├ 09:00  Salário recebido      R$ 5.000 (recorrência)
├ 14:30  Vencimento fatura Nu  R$ 850

AMANHÃ, terça-feira, 01/07
├ Cobrança João - R$ 250

QUARTA, 02/07
├ Conta de luz - R$ 180 (recorrência)
```

Mais útil em mobile e pra "próximos eventos".

## Implementação

Tab no topo de /calendar:
```
[ Mês | Semana | Agenda ]
```

Backend já retorna `calendar_events` — só preciso adaptar visualização frontend.

Lib opcional: `react-big-calendar` ou implementar do zero.

## Critérios

- [ ] 3 modos: mês (atual), semana, agenda
- [ ] Persistir preferência
- [ ] Mesma data range navigation
- [ ] Eventos clicáveis em qualquer modo
- [ ] Vista agenda é responsiva (mobile-friendly)
