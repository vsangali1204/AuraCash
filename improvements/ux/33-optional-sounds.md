# UX-33 — Sons opcionais em confirmações

**Categoria:** Microinteração
**Estimativa:** Trivial

## Problema

Apps financeiros (Nubank, banks) usam som "ka-ching" quando dinheiro entra. Reforça emoção positiva.

## Solução

Lib `use-sound`:

```bash
npm i use-sound
```

```tsx
import useSound from "use-sound";

function ReceivableItem({ tx }) {
  const [playReceived] = useSound("/sounds/kaching.mp3", { volume: 0.4 });

  const onReceive = async () => {
    await markReceived(tx.id);
    playReceived();
  };
}
```

### Sons sugeridos

- `kaching.mp3` — receber dinheiro
- `swoosh.mp3` — transação criada
- `notification.mp3` — push notification
- `error.mp3` — falha (suave, não estridente)

### Configuração

Default: **desligado**. Toggle nas configurações:
- "Sons nas ações" (master switch)
- Volume slider
- Som por ação (granular)

## Critérios

- [ ] Lib instalada
- [ ] Sons curados (≤ 500ms cada, max 50KB)
- [ ] Toggle nas configurações
- [ ] Default off (respeitar quietude)
- [ ] Volume configurável
- [ ] Carregamento lazy (não baixar se desligado)

## Considerações

- LICENSE dos sons: Freesound CC0 ou comprado.
- Acessibilidade: alguns usuários surdos podem querer feedback visual exagerado em vez.
