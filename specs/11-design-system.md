# spec/11 — Design system

**Status: FECHADO para direção visual e implementação do M1 — 09/10/2026.** Pedro entregou o pacote do Claude Design para orientar a implementação. R6-Q28 foi atendida quanto à disponibilidade da referência. Este fechamento não comprova telas implementadas, acessibilidade nativa ou aceite do marco.

Referências: [M1](<../Protótipos de assistente pessoal/Ritmo-M1.dc.html>), [Fase 1](<../Protótipos de assistente pessoal/Ritmo-Fase1.dc.html>), [revisão do pacote](../docs/analises/2026-10-09-revisao-do-prototipo.md), [valores e catálogo](../docs/design/tokens-prototipo-m1.json), [auditoria](../docs/design/auditoria-visual-2026-10-09.json), [identificação das fontes](../docs/design/fontes-prototipo-2026-10-09.json).

## 1. Autoridade e escopo

**REQ-DS-000 — Nenhum agente inventa estilo próprio.** Usar a referência entregue e as correções de acessibilidade deste spec. Centralizar cor, espaço, fonte, dimensões, raio e movimento em `app/src/theme/tokens.ts`, criado junto da primeira fatia de interface. O JSON extraído é referência, não runtime: traduzir CSS/nomes em tokens tipados nativos. Componentes não leem HTML, cores literais ou índices de paleta.

PRD/specs/ADRs/decisões de Pedro determinam comportamento. Este spec consolida o visual; M1 é a referência do recorte atual, Fase 1 das expansões. Etiquetas “aprovado/decidido” do handoff não aprovam regras novas de produto. `Ritmo-Briefing.dc.html` contém explorações anteriores; `Ritmo-M1-Prototipo.dc.html` tem apenas um contêiner vazio.

Não portar `support.js`, DCLogic, `sc-if`, `sc-for`, React de CDN, localStorage, contas, relógios e temporizadores simulados. O app usa sessão, SQLite, sync e domínio reais. Toda escrita de domínio passa pela camada local.

## 2. Direção visual

| Decisão | Referência consolidada |
|---|---|
| Aparências | Holograma padrão, Cockpit e Neo-tokyo selecionáveis; cada uma com claro/escuro; primeira abertura segue o modo do sistema |
| Tipografia | Chakra Petch para corpo/títulos de Holograma/Cockpit; Space Grotesk para Neo; JetBrains Mono para números, horários, XP e estados |
| Densidade | Média; linha de hábito mínimo 60 unidades lógicas; check 28 dentro de alvo mínimo 44 × 44; crescer com texto ampliado |
| Destaque | Um por aparência; âmbar para avisos e vermelho para erro/não salvo; ícone/forma/texto acompanham cor |
| Cards | Fundo elevado e borda 1; marcas de canto Cockpit, quatro colchetes/scanline Holograma, brilho discreto Neo |
| Vazios | Emoji decorativo, texto factual e ação útil; sem ilustração própria |
| M1 | Briefing, Hábitos, Ajustes; saudação, hábitos diários, XP básico; sem controles de capacidades posteriores |
| Expansão | Referência Fase 1 para Tarefas, Agenda, assistente e gamificação ampliada; ativar em seus incrementos |

Fontes ficam no bundle para uso offline; verificar arquivos/licenças/pesos no build nativo. Public Sans pertence ao painel/documentação. Download de fonte não pode ser pré-requisito para consultar dados locais.

## 3. Cor

Valores completos das seis combinações estão em [tokens-prototipo-m1.json](../docs/design/tokens-prototipo-m1.json). Mapeamento semântico:

| Campo da referência | Token nativo |
|---|---|
| bg / surf | bg.base / bg.elevated |
| bord | border.decorative |
| text / dim | text.primary / text.secondary |
| accent / accentText / onAccent | accent.fill / accent.text / text.onAccent |
| warn / err / link | status.warning / status.error / text.link |

Holograma escuro: base `#04090F`, elevado `#08141D`, texto `#D7ECF5`, destaque `#63F5D8`. Claro: base `#EDF4F4`, elevado `#FFFFFF`, texto `#0B1B20`, destaque `#0B7A68`. Cockpit usa ciano e Neo-tokyo rosa; consultar o catálogo completo para texto de destaque/link, que diferem do preenchimento nos modos claros.

**REQ-DS-001** — Aparência/modo trocam valores e decoração dos mesmos componentes; sem árvores duplicadas de telas. Escolha de aparência e de modo são independentes; “seguir sistema” é o estado inicial do modo.

**REQ-DS-002** — Texto mínimo 4,5:1 sobre o fundo efetivo nos seis conjuntos. Testar pares semânticos permitidos, campos, toasts, avisos e composição alpha. Os 78 pares base passaram, mínimo 5,25:1; isso não prova toda combinação possível.

Derivados do JSON: destaque suave alpha 0,13 e linha 0,45; aviso suave 0,12 escuro/0,10 claro; erro suave 0,12 escuro/0,07 claro. Campos: branco alpha 0,03 no escuro, `#F7F9FA` no claro. Track: branco 0,08/preto 0,07. Toast inverte superfície e possui texto/link próprios, inclusive Neo. Scanline/brilho são decoração sutil sem capturar toque ou leitor de tela.

Correções à referência:

- Borda forte original (texto alpha 0,32 escuro/0,34 claro) resulta em 2,13–2,61:1. Não pode ser a única pista de check vazio, campo ou foco. `border.interactive` usa texto alpha **0,48**, composto sobre a base no modo claro e sobre a superfície elevada no escuro. Essa composição equilibra os dois lados adjacentes de campos e controles transparentes; a revisão de fidelidade inclui base, superfície e os dois fundos de input nos seis conjuntos. Revalidar sobre estados e composição efetiva. Bordas só decorativas conservam o original. Indicadores necessários à operação/estado atendem 3:1 contra a cor adjacente ([WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- Texto secundário sobre destaque suave em base clara fica em 4,43:1 Cockpit e 4,46:1 Holograma. Esse par é proibido; usar texto primário ou texto de destaque. Não alterar toda a paleta por uma combinação inválida.

## 4. Geometria e tipografia

Espaço principal: `0/4/8/12/16/24/32/48/64`. O HTML também usa `2/6/10/14/18/20`; centralizar esses valores em métricas nomeadas de componentes. A escala antiga era proposta; não arredondar silenciosamente o design nem espalhar literais.

Tamanhos encontrados no corpo do M1 (base 16): **11/12/13/14/15/16/17/18/20/22/24/28/32/36/40**. Definir papéis nomeados por componente. Corpo/títulos: pesos 400/500/600/700; mono: 400/500/700. Entrelinhas observadas: 1,00/1,05/1,15/1,20/1,30/1,35/1,40/1,45/1,50. Respeitar escala do sistema, inclusive 200%.

| Raio | Cockpit | Neo | Holograma |
|---|---|---|---|
| Card | 10 | 20 | 4 |
| Botão | 8 | 999 | 4 |
| Interno | 6 | 12 | 4 |
| Check | 5 | 9 | 4 |
| Tile | 6 | 11 | 4 |

Comuns: alvo 44 × 44; input mínimo 48; botão primário mínimo 52; check visual 28; tile 36; gutter formulário 24/Briefing 18; borda card 1/controle 1,5. Alturas são mínimas; podem crescer com texto ampliado.

390 × 844, raio 50, status bar 47, relógio 08:12 e barra inferior são moldura demonstrativa. Usar safe areas/dimensões reais, sem segundo status bar. As três abas M1 ficaram legíveis no ensaio web. As cinco abas Fase 1 cortam “Ajustes” a 200%; adaptar e validar em seu incremento.

## 5. Catálogo de hábitos

Referência: Meditação 🧘, Leitura 📖, Água 💧, Corrida 🏃, Caminhada 🚶, Alongamento 🤸, Música 🎸, Escrita ✍️, Planta 🌱, Alvo 🎯. O JSON fornece chaves semânticas de implementação para o campo existente `iconKey`; não são novas entidades. Não usar índice como identidade. Emoji é decoração; rótulo acessível é textual. Conferir diferenças de glyph/alinhamento entre iOS/Android.

Cores: `accent`, `blue`, `amber`, `violet`, `green`. Destaque/âmbar vêm do tema; azul escuro/claro `#79B8FF/#1F5FA8`, violeta `#B69CFF/#5B3FC4`, verde `#7CE38B/#2B6E37`. `colorToken` guarda a chave, não o hexadecimal. Conferir defaults/chaves existentes antes de migrar; renderização não reescreve metadado desconhecido.

## 6. Componentes

Construir conforme a fatia precisar: Card, HabitRow, Checkbox, Button, Input, SyncPill, Banner, Sheet, Skeleton, EmptyState, ErrorState, Toast, ProgressBar. StreakBadge, heatmap, assistant sheet e celebração de nível pertencem aos incrementos posteriores.

**REQ-DS-003** — Controles têm normal, pressionado, desabilitado e carregando; superfícies informativas têm estados aplicáveis. Erro não apaga conteúdo; Sheet administra foco/fechamento conforme o contrato. Estado não depende só de cor.

**REQ-DS-004** — Vazio/carregamento/erro são explícitos. “Não salvo” é distinto de salvo local sem confirmação. Rejeição comprovada, identidade incerta, cofre indisponível e banco inacessível não compartilham ação genérica de descarte/retry. [Matriz de telas/estados](../docs/design/implementacao-interface-m1.md).

Link de privacidade dentro do cadastro mede altura 16 a 100%/37 a 200% no HTML. Converter em ação com alvo mínimo 44; não copiar essa falha.

## 7. Movimento

**REQ-DS-005** — Transições até 320 ms: pressionar 120, estado/cor 200, lenta até 320. Não portar a animação CSS inteira de 1,4 s. Selo de XP pode permanecer 1.400 ms; permanência não estende cada transição. Celebração de nível posterior segue REQ-GAM-008: até 1,5 s, dispensável, não bloqueia.

**REQ-DS-006** — Redução de movimento do sistema torna transições instantâneas e feedback estático, incluindo skeleton/spinner/celebrações. Botão do simulador não substitui configuração nativa.

Feedback deriva da concessão/decisão real, inclusive limite sem XP e restauração original. Retry/pull/refresh não celebram novo prêmio. Referência tem som opcional desligado; asset, custódia da preferência e áudio precisam de recorte definido antes de instalar dependência. M1 não contém celebração de nível, háptico ou confete.

## 8. Implementação e aceite

[Plano M1](../.scratch/interface-m1/spec.md) decompõe a tarefa visual existente. O [recorte 01](../docs/analises/2026-10-09-interface-primeira-jornada.md) implementa tokens tipados, onze pesos locais com OFL, controles e a primeira jornada nativa. Holograma segue o sistema; seleção/persistência e decoração dos demais estilos ficam no recorte 06. O [recorte 02](../docs/analises/2026-10-09-interface-gestao-de-habitos.md) acrescenta lista de gestão, prévia/edição, ordem acessível e confirmação de exclusão; mesma fonte de dados do Briefing. Os relatórios distinguem checks, ensaios Android e o aceite integral pendente.

Aceite exige Android visível nos ensaios e iPhone 16e: temas/modos, texto 100%/200%, teclado/conteúdo longo, rótulos/foco e redução de movimento. Chromium diagnostica o protótipo, não prova VoiceOver/TalkBack, persistência, API ou desempenho. Q55=B mantém iOS adiado e M1 aberto.

Refinamento das telas atuais em 10/10/2026: [fidelidade visual M1](../docs/analises/2026-10-10-fidelidade-visual-m1.md), com critérios prévios, três críticos e comparação nativa.72 pares de bordas sobre fundos adjacentes têm mínimo3,102339:1;192 pares textuais permitidos têm mínimo5,252708:1. Texto 200%%, painéis e28 alvos medidos passaram no recorte observado. Esse resultado não encerra recortes03–06 nem o aceite integral/iOS.

[Recorte03 — sessão/cofre/abertura](../docs/analises/2026-10-10-interface-sessao-e-recuperacao-local.md) entregue em 10/10/2026 sobre os mesmos tokens/primitives: bloqueios e ações próprios, diagnóstico limitado e nova tentativa, preempção de logout e reautenticação online da mesma conta. 164 testes do app e Android visível aprovados; controles do cofre/instalação observados com texto 200%. Recortes 04–06 e aceite integral/iOS permanecem abertos.
