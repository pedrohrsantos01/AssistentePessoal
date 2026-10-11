# Revisão do protótipo Claude Design — 09/10/2026

**Referência corrigida em11/10/2026:** este documento é histórico da seleção incorreta de Ritmo-M1. A fonte atual aprovada por Pedro é Ritmo-App; os pareceres visuais anteriores não a aceitam. Ver [correção e evidências](../design/fidelidade-ritmo-app/progresso.md) e spec/11.

O pacote entrega uma referência utilizável para iniciar a interface do M1: identidade consistente, três aparências, claro/escuro, componentes reconhecíveis e várias situações de erro/offline. A disponibilidade do protótipo deixou de bloquear o projeto. **Ele ainda precisa de correções de acessibilidade e de ligação aos contratos reais; não representa interface implementada nem Fase 1 aceita.**

[Spec visual consolidado](../../specs/11-design-system.md), [tokens/catálogo](../design/tokens-prototipo-m1.json), [matriz de implementação](../design/implementacao-interface-m1.md), [plano com seis recortes](../../.scratch/interface-m1/spec.md).

## Artefatos e prioridade

| Arquivo recebido | Papel |
|---|---|
| Ritmo-M1.dc.html | Principal referência executável do marco: conta/onboarding/Briefing/hábitos/sessão/sync |
| Ritmo-Fase1.dc.html | Referência da fase completa: tarefas, Agenda, hábitos ampliados, assistente e gamificação |
| Ritmo-M1-Handoff.dc.html | Inventário de componentes, tokens, telas e D01–D29; contém divergências/etiquetas antigas |
| Ritmo-App.dc.html / Ritmo-Fluxo.dc.html | Composição navegável entre etapas e mapa de telas; não muda o faseamento |
| Ritmo-Fase2A.dc.html | Exploração posterior; não habilita Notícias/Esportes agora |
| Ritmo-Briefing.dc.html | Explorações visuais anteriores; não prevalece sobre M1/Fase 1 |
| Ritmo-M1-Prototipo.dc.html | Arquivo de 206 bytes com contêiner vazio; não é a versão executável |
| support.js / uploads/briefing-claude-design.md | Runtime da demonstração e brief histórico; não integrar ao app nativo |

Originais preservados e identificados em [manifesto](../design/fontes-prototipo-2026-10-09.json). SHA-256/bytes descrevem arquivos recebidos; LF hash/bytes também permitem comparar conteúdo com finais de linha normalizados. O Git preserva bytes dos exports recebidos; espaços finais originais são tolerados somente nessa pasta de referência, sem mudar a higiene das fontes do app/API. A data interna do handoff é 30/09; a entrega/revisão no projeto ocorreu em 09/10.

A leitura do handoff exige cuidado: a introdução diz “nenhuma paleta, fonte ou navegação está aprovada”; os dados seguintes dizem “aprovado” e tornam três temas selecionáveis. O pedido atual de Pedro fornece o pacote para orientar implementação. Consolidamos essa referência visual, sem tratar declarações funcionais internas do artefato como novas decisões de produto.

## Sistema visual extraído

Holograma é padrão, com colchetes, scanline sutil e destaque verde-água. Cockpit usa ciano, cantos e geometria intermediária; Neo-tokyo usa rosa, raios maiores e brilho discreto. A escolha é de aparência dentro do produto, não três alternativas mutuamente exclusivas a selecionar novamente.

Chakra Petch dá a identidade a Cockpit/Holograma; Space Grotesk a Neo; JetBrains Mono distingue números/horários/XP/status. Public Sans é do painel externo. A densidade média mantém o registro do hábito acessível sem navegar; três abas no M1 conservam o Briefing como home. Os seis conjuntos usam os mesmos papéis de cor/componentes.

Paletas M1 e Fase 1 coincidem nos campos base; contraste, raio, fonte, dimensões e cores de hábito foram extraídos para o catálogo JSON. Campos como accentText/onAccent/link/toastLink precisam continuar separados: trocar tudo por “cor primária” quebra a hierarquia e os pares claros.

A escala declarada no handoff (espaço 0/4/8/12/16/24/32/48/64; fonte 12/14/16/20/24/32/40) não descreve integralmente o HTML: há espaços 6/10/14/18/20 e fontes 11/13/15/17/18/22/28/36, entre outras. Spec/11 centraliza métricas por componente e a escala observada; não distribuir os números como literais nem arredondar o layout para a proposta antiga.

Cards, checks, botões, inputs, pílula/linha de sync, banner, sheets, toast, vazios, erro e progresso têm bons pontos de referência. A implementação acrescenta estados reais quando faltam; StreakBadge/heatmap/assistente/nível só entram em suas fatias. Raios e decoração não justificam três conjuntos independentes de telas.

## Revisão visual e medições

Chromium foi aberto com janela visível pelo Playwright CLI e encerrado ao fim. Os HTMLs autorizados e support.js foram servidos por interceptação local da página, sem iniciar servidor de desenvolvimento. O navegador carregou as fontes da demonstração. Nenhum emulador foi iniciado nesta revisão.

Foram inspecionadas as seis combinações aparência/modo do M1, a home da Fase 1, as entradas dos 12 cenários D01–D12 e das 14 entradas D13–D26. **Selecionar uma entrada de cenário não equivale a executar sua jornada inteira**, nem o rótulo “representada” comprova comportamento. Também foram medidas telas de cadastro, onboarding e Briefing em 100%/200%, além do estado somente leitura e da home Fase 1.

| Verificação | Resultado e alcance |
|---|---|
| 78 pares de texto base | Todos ≥4,5:1; mínimo 5,2527:1 |
| 138 combinações de texto sobre fundos derivados | 136 passam; secundário sobre accentSoft em base clara fica em 4,4338 Cockpit/4,4571 Holograma. São combinações candidatas do catálogo, não prova de que esses textos estão renderizados nesses pontos |
| 12 pares da borda forte original | 2,1274–2,6118:1; inadequados como única indicação de check/campo vazio |
| Correção border.interactive | Alpha 0,48: 12 pares em base/elevado passam, mínimo 3,1102:1; revalidar fundo de input/estados na UI |
| Briefing M1 a 200% | Container rolável 390 de largura, scrollWidth 390; altura útil 714, conteúdo 1.029 no caminho D04 / 1.386 em somente leitura; três abas visíveis; controles medidos ≥44 |
| Cadastro | Privacidade dentro do texto: alvo de altura 16 a 100%/37 a 200%, abaixo da regra 44 do projeto |
| Onboarding | Ações medidas ≥44; conteúdo cresce/rola a 200% (altura 1.230 sobre área 763) |
| Home Fase 1 a 200% | Conteúdo cresce a 3.021; screenshot mostra cinco abas se estendendo além do quadro e “Ajustes” cortado. Semântica DOM/dimensões dos botões não detectam sozinhas essa perda visual |
| Redução de movimento no painel M1 | Ao marcar um hábito: transition 0s e nenhuma animação ativa; feedback estático. Não prova preferência nativa do sistema |

[Auditoria de contraste e bordas](../design/auditoria-visual-2026-10-09.json). Fórmula: luminância relativa sRGB e (Lmaior + 0,05)/(Lmenor + 0,05); transparência composta antes da luminância, sem arredondar para aprovar.

Critérios de referência: [WCAG 1.4.3, contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [1.4.11, informação necessária a controles/estados 3:1](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [1.4.4, texto ampliado sem perder conteúdo/função](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html). O projeto usa 4,5:1 para todo texto e alvo 44; uma borda puramente decorativa não está sujeita à mesma exigência de um check vazio.

Capturas preservadas: [M1 Holograma escuro](../design/evidencias/2026-10-09/m1-holograma-escuro.png), [cadastro 200%](../design/evidencias/2026-10-09/cadastro-texto-200.png), [Fase 1 200%](../design/evidencias/2026-10-09/fase1-texto-200.png). São quadros web de 390 × 844, não screenshots do iPhone físico. Não medimos VoiceOver/TalkBack, teclado nativo, desempenho de produto ou todos os controles neste ensaio.

## Divergências de comportamento e lacunas M1

| Prioridade | Achado | Encaminhamento |
|---|---|---|
| Alta | Handoff em “XP parcial ao atingir o teto” propõe +4 se faltam 4 | Q31/REQ-GAM-002a já aprovou prêmio inteiro ou nenhum; preservar núcleo e corrigir UI/copy. Nenhuma nova decisão necessária |
| Alta | Identidade incerta Q53 não tem apresentação específica | Preservar/bloquear operação e dependentes; sem descarte/reenvio/troca de identidade. Não reutilizar a sheet de rejeição comprovada |
| Alta | Cofre Q52 e base/controle Q51 não aparecem como estados próprios | Integrar diagnósticos/retries já existentes; local continua somente quando autorizado; base/controle ilegíveis bloqueiam corretamente, sem apagar arquivos |
| Alta | Protótipo omite excluir no M1 | Habit.delete/M1-13 e Q30 já existem; confirmação informa histórico/XP/orçamento. Arquivar continua posterior |
| Média | “Cada hábito feito vale 10 XP” é promessa absoluta | Texto/valor derivam da decisão real de concessão, incluindo limite e restauração original |
| Média | input do nome aceita 120, regra valida 80 | Contrato de identidade/handoff 1–80 prevalece; preservar formulário e erro por campo |
| Média | Loading aumenta porcentagens por timer | Progresso real/indeterminado; nenhuma conta vazia ou parcial apresentada como pronta |
| Média | Duplo toque ignorado por 450 ms e sync confirmado por timer | Não portar esses algoritmos; usar comandos/idempotência/recibos/scheduler reais |
| Média | UI inteira é memória da classe e persistência visual localStorage | Não prova reinício/offline/sessão; ligar a projeções e geração do núcleo real |
| Média | Ajustes de fuso, áudio e preferência visual têm representação incompleta | Separar referência visual de persistência/custódia; especificar antes de adicionar campo/tabela/dependência |

O protótipo contempla local/confirmado/enviando/recusa/não salvo, sessão expirada, saída incompleta, carga e atualização. Isso é boa cobertura de apresentação inicial, mas não inclui todo o contrato atualizado em 07–08/10. UI precisa também respeitar 429/Retry-After, 503/quarentena, dependências bloqueadas e geração de sessão; não oferecer um retry genérico que burle backoff ou um descarte em resultado desconhecido.

O app atual é um harness técnico cujo componente raiz não desenha a interface do produto. Não há telas, tokens/fontes/i18n visuais incorporados pelo recebimento desses HTMLs. O React/CDN/DCLogic do pacote difere do runtime React Native/Expo real; copiar o protótipo como código do app não resolve essa fronteira.

## Fase 1 completa e expansões

D13–D26 fornecem referência útil para viradas independentes, contribuições quantitativas, regra ativa/proposta, quota semanal, retroativo, negativos/proteções, recorrência/subtarefas, Calendar, IA/voz, consentimentos e privacidade. A existência das telas não preenche os modelos/contratos pendentes desses módulos.

Itens rotulados “DECIDIDO” no handoff exigem confronto em suas futuras fatias: catálogo de conquistas, interpretação local offline, seleção de calendários, substituição de mudança de perfil agendada, critérios de mediação, janela de notícias e times/competições. Não importar esses rótulos como respostas de Pedro registradas no projeto.

Há divergências específicas: o handoff reparte notificações como 40 lembretes/24 reservas, enquanto o plano atual separa 40 hábitos/24 tarefas; janela de notícia e calendário precisam seguir seus specs; Q7/times permanece aberto no PRD. Esses assuntos são candidatos ao Grill-me apoiado nos documentos quando o incremento correspondente começar. Não bloqueiam a UI binária diária, nem permitem antecipar Notícias/Esportes.

## Resultado e próximo recorte

Spec/11 e PRD Q5 atualizados; disponibilidade de Q28 atendida, valores/catálogos e correções rastreados; matriz real de estados e seis tarefas locais criadas. Tarefa visual 03 virou ready-for-agent e continua não concluída até integrar/validar as telas. Recorte 06 tem needs-info para custódia de preferências/áudio; as jornadas iniciais não dependem dessas decisões.

**Próximo recomendado:** conta → onboarding retomável → primeiro hábito/pular → Briefing mínimo com marcação offline e reabertura. Fontes/tokens/componentes entram nessa fatia, junto do valor para o usuário; não criar primeiro uma biblioteca inteira de UI. Depois gestão/exclusão, sessão/exceções, sync/compatibilidade, recuperação e acabamento.

M1 continua aberto: interface/aparelhos, iPhone adiado Q55=B, domínio/e-mail/links Q54 e aceite operacional externo. Não iniciar a avaliação de 30 dias da Fase 1 completa por concluir esta revisão.

## Verificação do incremento

- App: typecheck/lint aprovados; 121 testes aprovados, zero falhas/ignorados.
- API: check integral aprovado em 16m24s; 87 casos Java em 14 classes, 85 aprovados e dois Android opt-in ignorados (sem ativar emulador neste recorte documental). ModularityTests aprovado.
- Operação: 13 testes aprovados. Integrações existentes exercitadas pelo Gradle com HTTP/PostgreSQL/SQLite reais.
- Revisão do navegador concluída com a janela própria encerrada; nenhuma tela nativa foi implementada ou aceita neste incremento.
- Documentação: 19 documentos/213 links locais conferidos, sem falhas; 11 arquivos recebidos com SHA-256 do índice Git idêntico ao original. Diff revisado e check aprovado, preservando whitespace original somente nos exports de design.

Esses checks protegem a fundação existente. Não são evidência de que a interface do produto já executa os cenários do protótipo.
