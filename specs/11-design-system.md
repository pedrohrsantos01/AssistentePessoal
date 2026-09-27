# spec/11 — Design system

**Status: ABERTO — protótipo em elaboração pelo Pedro.** Em R6-Q28, Pedro pediu manter a direção visual aberta até concluir o protótipo. A proposta de liberar o Briefing mínimo com visual provisório não foi aceita. Este estado não bloqueia a documentação de domínio, dados, sincronização ou critérios de aceite.

---

## 1. Regra enquanto este spec estiver aberto

**REQ-DS-000 — Nenhum agente inventa estilo próprio.** Sem tokens fechados, cada sessão de implementação escolhe seu próprio espaçamento, tipografia, raio de borda e paleta — e em cinco fatias o app tem cinco visuais diferentes. Isso não é problema de gosto, é dívida de retrabalho.

Enquanto este arquivo estiver marcado como ABERTO:

1. A apresentação visual do **Briefing, inclusive o primeiro marco mínimo**, aguarda o protótipo e o fechamento desta direção. A numeração histórica das fatias não determina mais a ordem de execução. A permissão anterior para componentes funcionais nas telas preliminares não autoriza liberar o Briefing com tokens neutros contra R6-Q28
2. Todo componente consome **exclusivamente** os tokens de `src/theme/tokens.ts`. Nenhum valor literal de cor, espaçamento, fonte ou raio dentro de componente. Nunca `#3B82F6`, nunca `padding: 14`
3. A centralização reduz retrabalho; não garante que o protótipo alterará apenas tokens. Estrutura, componentes e estados também precisam ser confrontados com o design concluído

## 2. Base proposta de tokens (a validar com o protótipo)

Na implementação, centralizar tokens desde os primeiros componentes permitidos. Ainda não existe esse arquivo de código no projeto. A estrutura abaixo é uma base de trabalho; valores e eventuais ajustes de estrutura serão definidos com o protótipo, sem liberar antecipadamente o visual do Briefing.

```ts
export const tokens = {
  color: {
    bg: { base, raised, sunken },
    fg: { primary, secondary, muted, inverse },
    accent: { default, hover, subtle, onAccent },
    state: { success, warning, danger, info },
    border: { subtle, default, strong },
  },
  space: [0, 4, 8, 12, 16, 24, 32, 48, 64],   // escala fechada, sem valor fora dela
  radius: { sm, md, lg, full },
  font: {
    family: { display, body, mono },
    size: [12, 14, 16, 20, 24, 32, 40],
    weight: { regular, medium, bold },
    lineHeight: { tight, normal, relaxed },
  },
  shadow: { sm, md, lg },
  motion: {
    duration: { fast: 120, base: 200, slow: 320 },
    easing: { standard, enter, exit },
  },
} as const;
```

**REQ-DS-001** — Tema claro e escuro desde o início, por troca de valores dos mesmos tokens. Nunca dois conjuntos de componentes.

**REQ-DS-002** — Todo token de cor de texto precisa atender contraste WCAG AA (4,5:1) contra o `bg` em que é usado, nos dois temas. Teste automatizado de contraste sobre os pares válidos.

## 3. O que a direção visual precisa responder

Quando as referências chegarem, o spec fecha decidindo:

| Decisão | Por que importa |
|---|---|
| Tipografia | É o que mais define personalidade. Fonte de sistema é rápida e invisível; fonte própria custa peso de bundle |
| Densidade | O Briefing tem 5+ cards. Denso mostra mais e cansa; arejado mostra menos e respira |
| Cor de destaque | Uma só, usada com parcimônia, ou paleta por módulo (hábitos, tarefas, notícias, esportes)? |
| Peso do card | Sombra, borda, ou nenhum dos dois (separação por espaço) |
| Celebração | Como o subir de nível e a ofensiva aparecem sem virar confete de cassino (REQ-GAM-008 limita a 1,5 s) |
| Ilustração | Estados vazios com ilustração própria, ícone, ou só texto |

## 4. Componentes base (a construir na Fatia 3)

`Card`, `ListItem`, `Checkbox`, `Button` (primário/secundário/fantasma), `Chip`, `Input`, `Sheet`, `Skeleton`, `EmptyState`, `ErrorState`, `Toast`, `ProgressBar`, `StreakBadge`.

**REQ-DS-003** — Todo componente nasce com os quatro estados: normal, pressionado, desabilitado, carregando. Componente sem estado de carregamento gera tela branca depois.

**REQ-DS-004** — `EmptyState` e `ErrorState` são componentes de primeira classe, não improviso por tela. É a regra que impede o "tela em branco quando não tem dado".

## 5. Movimento

**REQ-DS-005** — Animação serve para explicar transição de estado, nunca para decorar. Duração máxima de 320 ms em qualquer transição de interface.

**REQ-DS-006** — `prefers-reduced-motion` respeitado: toda animação vira transição instantânea, inclusive as celebrações de gamificação.

## 6. Como fechar este spec

1. Pedro conclui o protótipo que está desenvolvendo; referências adicionais podem complementá-lo
2. Extrair do protótipo: tipografia, densidade, tratamento de card, uso de cor e estados necessários
3. Preencher os valores dos tokens da §2 e as decisões da §3
4. Registrar as decisões visuais resolvidas, trocar o status para **FECHADO** e liberar a implementação visual do Briefing. A existência de um protótipo em elaboração não equivale a essa conclusão
