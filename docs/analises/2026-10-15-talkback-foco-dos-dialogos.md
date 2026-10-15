# TalkBack — foco real dos diálogos Q60

Data:15/10/2026. REQ-DS-003, recorte06 do M1. A matriz Android passou com foco obrigatório no título e retorno ao acionador nos cinco diálogos observados. O recorte06 e o marco continuam abertos para os cenários restantes e demais gates.

## Resultado na versão final

A [rodada3 final](../design/evidencias/2026-10-15/leitor-matriz/rodada3-final/matrix-summary.json) passou18 fases no Pixel_9, Android15/API35, GPU host e2GB de RAM para o emulador, com TalkBack continuamente ativo e fonte200%. Foram35 medições de controles e9 de campo/IME. Cadastro/onboarding usaram HTTP real; validações de e-mail/nome/fuso preservaram os campos; hábito longo foi criado, marcado e desfeito mantendo foco. O cliente independente confirmou hábito preservado, cumprimento desfeito e XP total0 no servidor.

| Superfície | Foco ao abrir | Retorno observado |
|---|---|---|
| Privacidade do cadastro | Título de privacidade | Aviso que abriu a política |
| Exclusão de hábito | Excluir este hábito? | Excluir hábito |
| Privacidade em Ajustes | Título de privacidade | Política de privacidade |
| Saída cancelada | Sair da conta? | Sair desta conta |
| Sincronização e histórico | Sincronização | Ver sincronização |

`passed=true`, `functionalPassed=true`, `focusObservationOnly=false`. Capturas de entrada/retorno e o resumo consultam o nó realmente focado; não usam apenas presença do título ou serviço habilitado como prova. A falha de cofre conservou o controle local; o banco da conta apresentou diagnóstico e a falha da instalação bloqueou a jornada. [Restauração](../design/evidencias/2026-10-15/leitor-matriz/rodada3-final/reader-cleanup.json): nenhum passo faltante. Observador temporário removido, emulador5560 e painel próprios fechados; instalação e contas preservadas. Nenhum processo preexistente encerrado.

APK final: `b4996e90b71b3cdaf233ca678ebf319c0b8fa726ca02a1ac676c5bf0026c04e7`, exclusivo dev.ritmo.journeytest, x86_64. Instalação incremental preservou dados, e os bytes instalados foram conferidos contra o build. [Proveniência e hashes dos fontes/checks](../design/evidencias/2026-10-15/q60-final-build.json). O bundle final não contém o marcador de diagnóstico temporário. Paletas do APK11cee24a de12/10 não pertencem a este build; não foram reaproveitadas para aceitá-lo.

## Correção e evidência causal

Os testes de componente de14/10 passaram, mas o Android ainda selecionava o corpo de Privacidade. A matriz estrita reprovou isso em15/10. O caso mínimo sem API reproduziu a mesma falha em42s. Logs temporários comprovaram onShow, título existente, contexto válido, medida371,43×80 e envio do evento; um frame adicional também reprovou. Não era ausência da solicitação nem medida zero naquele cenário.

A versão instalada do React Native converte `focus` em TYPE_VIEW_FOCUSED e envia o evento ao View; o [Android distingue foco de entrada e foco de acessibilidade](https://developer.android.com/reference/android/view/accessibility/AccessibilityEvent). O adaptador agora usa o evento Android `viewHoverEnter`, suportado pela [API pública do React Native](https://reactnative.dev/docs/accessibilityinfo#sendaccessibilityevent), para selecionar o nó pelo TalkBack. iOS conserva `focus`. Nenhum evento de clique ou anúncio paralelo foi acrescentado; guardas de contexto/host/habilitação e confirmação de medida permanecem. Tokens, geometria e regras de domínio não mudaram.

A alteração isolada do evento fez o caso mínimo passar em33s, incluindo o retorno; depois, todos os logs temporários foram removidos e a matriz completa passou na versão limpa. O controlador e os testes de proteção de contexto de14/10 permanecem; a nova evidência cobre o comportamento externo que os mocks de componente não provavam. O código do React Native foi consultado em FabricUIManager.java/SurfaceMountingManager.kt da dependência instalada, sem alterá-la.

## Tentativas preservadas

- Matriz rodada1: timeout de30s no observador durante navegação inicial, antes de Q60; restauração confirmada. Não há causa única comprovada para esse timeout.
- Probe de navegação: duas preparações pararam antes de obter tela pronta; a terceira confirmou um único toque em Ajustes sem API. O roteiro completo passou a exigir o estado PERFIL após esse toque, antes de procurar Sair, sem ampliar timeout nem repetir ativação ambígua. O marcador desse preflight informa fonte100%, separadamente das etapas200%.
- Matriz rodada2 e probe mínimo: reprovação real de título inicial, com foco no corpo. O marcador de preflight da rodada2 usava o valor nominal200% do roteiro antes da mudança de fonte; esse registro bruto foi preservado, e a emissão atual informa100% nesse ponto.
- Probes de diagnóstico: envio original e envio no frame seguinte reprovaram; evento Android de exploração passou. Seus APKs com logs são diagnósticos, sem aceite da versão final. Um lançador temporário anterior parou na normalização de caminho antes do Node; recursos próprios foram encerrados.
- Matriz rodada3 final:18 fases e cinco diálogos passaram, sem modo de observação, no APK final sem logs.

O Docker foi reiniciado por Pedro, que avisou quando estava pronto. O agente não encerrou seus processos preexistentes. A preparação anterior permanece [histórico datado](2026-10-15-preparacao-do-ensaio-q60.md).

## Checks e limites

App: typecheck/lint e218 testes passaram (175 domínio/controlador,43 componentes). Build final passou em1m29s. A fixture nativa terminou com exit0 em6m25s; esses tempos incluem preparo/automação e não são medidas de performance do produto.

API check passou em9m30s, exit0: 93 casos, 85 executados/8 nativos opt-in ignorados, 0 falhas/0 erros. ModularityTests e13 checks operacionais passaram. A matriz Android foi executada separadamente pelo opt-in; seu resultado não é inferido dos casos ignorados do check normal. [Resumo final e hashes](../design/evidencias/2026-10-15/checks-summary.json); [índice de tentativas](../design/evidencias/2026-10-15/q60-attempts-index.json).

A matriz observou a janela superior da aplicação; a ausência de controles do fundo nessa árvore não aceita sozinha toda a navegação entre janelas. Inserção por teclas de hardware não prova edição falada por caractere/cursor. Não há aceite novo de VoiceOver/iPhone, desempenho, seis combinações de aparência no novo APK ou todos os estados de recuperação/rejeição/identidade incerta.

Próximo recorte recomendado: estender o leitor aos fluxos restantes de recuperação/rejeições/identidade incerta e aos retornos aninhados/preempção de Q60; os casos de invalidação já possuem testes locais, mas não foram todos executados nativamente aqui. Depois, medir abertura/cards/feedback com marcos reais. Q55=B mantém iPhone adiado e necessário ao aceite integral. Não encerrar06/M1 por essa aprovação delimitada.
