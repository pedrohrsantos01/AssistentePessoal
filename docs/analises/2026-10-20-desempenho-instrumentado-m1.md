# Desempenho instrumentado do M1 — 20/10/2026

Medição concluída na rodada8; duas metas não atendidas no AVD. Abertura ficou abaixo de2s em10/10 casos; cards e feedback ficaram acima das metas em todas as amostras. Issue06 e M1 permanecem abertos. [Plano](../../.scratch/interface-m1/desempenho-instrumentado.md), [evidências](../design/evidencias/2026-10-20/desempenho-android/README.md), [próximo recorte](../../.scratch/interface-m1/latencia-do-cumprimento.md).

## Resultado

| Intervalo | Amostras | p50 | p95 | Máximo | Meta | Dentro da meta |
|---|---:|---:|---:|---:|---:|---:|
| Abertura até Briefing interativo | 10 | 883.51 ms | 1091.88 ms | 1091.88 ms | 2000 ms | 10/10 |
| Cards locais | 10 | 883.51 ms | 1091.88 ms | 1091.88 ms | 300 ms | 0/10 |
| Resposta visual persistida | 20 | 117.78 ms | 135.03 ms | 3014.37 ms | 100 ms | 0/20 |

As metas são as de spec/07 §1 e spec/08 §6. Cards e Briefing interativo aparecem no mesmo frame desta conta com um hábito. Os300ms mantêm a mesma origem da abertura; não foram contados depois de carregar JS, fontes ou SQLite. Percentis usam posto mais próximo; com10 aberturas, p95 corresponde ao máximo. Todas as amostras válidas, inclusive o primeiro feedback de3014,37ms, foram conservadas. Medição válida não significa metas aprovadas.

## O que mudou e como foi medido

A instrumentação compila apenas na variante explícita dev.ritmo.readonlytest. O build normal fica sem o helper; configuração e APK normais são restaurados. Nenhuma dependência, tabela ou coleta externa foi adicionada. Tags fixas identificam Briefing, card e checkbox; o estado continua sendo o da projeção publicada após commit SQLite. A regressão de componente injeta falha no commit e exige que não apareçam checked/marco de persistência falsos. Marcadores JS contêm apenas fase e tempo, sem conteúdo/identidade de domínio.

Método v2/schema2: um Instrumentation separado registra System.nanoTime imediatamente antes de Context.startActivity. A inicialização/comunicação do driver e do launcher fica antes dessa origem; o dispatch nativo do Intent integra o intervalo. Antes de cada abertura, force-stop e pidof confirmam ausência; depois, exige-se PID novo e único. Native PID, PID de origem, amostra e timestamp recebido pelo app precisam corresponder exatamente ao retorno do launcher. A prova do processo frio é registrada separadamente em coldProof; os eventos nativos brutos não são apresentados como se contivessem essa prova externa. O launcher rejeita o pacote normal, verificado no ensaio.

Choreographer.FrameCallback fornece o timestamp antes da travessia. OnDraw inspeciona conteúdo visível e checked habilitado reais; FrameMetrics do mesmo frame deve coincidir exatamente com VSYNC atual/intencionado. O fim é INTENDED_VSYNC_TIMESTAMP + TOTAL_DURATION: renderização e envio ao subsistema de exibição, sem prova de emissão física de luz. Ao marcar/desmarcar, a origem é MotionEvent.ACTION_UP no aparelho; o fim exige checked alterado após persistência. Amostras sem relógio/estado/correlação ou com reports perdidos falham. Scan do probe permaneceu incluído; p95 1.956ms, máximo 1.958ms, sem subtração. reportFullyDrawn e marcos JS são auxiliares, não endpoints de exibição. Nenhum timer declara sucesso.

AVD separado Ritmo_ReadOnly/API35/x86_64/3GB/GPU host, emulador e acompanhamento visíveis. Conta e hábito sintéticos preparados pela jornada/API reais; dez reinícios frios de processo e vinte alterações offline, sem limpar banco, cofre, cache de página ou histórico de compilação. Carga esperada no início dos ciclos:0,2,…,18 pendências, registrada por amostra. Texto100%, TalkBack desligado, escalas de animação0 e escrita com caneta desligada durante a preparação; valores restaurados com leitura de volta. Observador apenas entre os intervalos. Entrada física usa SDK sendTouch autenticado; tokens sem autenticação/audiência/emissor corretos foram rejeitados16/7/7. Capturas observadas em Holograma/claro; isso não aceita as outras paletas.

Depois das medidas, uma abertura sem amostragem comprovou hábito desmarcado/0XP. Uma marcação final sem cronometragem, reconexão e cliente HTTP independente confirmaram um hábito feito e10XP, sem duplicação.

## Leitura dos gargalos

No primeiro feedback de3014,37ms, o trecho JS do handler ao commit durou 38.24ms. O marco de commit precede refresh/render. Isso não atribui o restante ao SQLite, ao dispatch de entrada, ao React ou ao renderizador. Os relógios JS não foram alinhados ao nativo para inventar uma decomposição. Módulo→runtime levou 119.55ms nesse primeiro processo, mas não cobre o bootstrap anterior nem a apresentação posterior.

Próximo recomendado: instrumentar dispatch→handler→commit→refresh→frame e identificar o atraso dominante do cumprimento antes de otimizar. Preservar confirmação somente após commit e a regra de100ms. A partida dos cards fica para o recorte seguinte, com a meta de300ms desde a mesma solicitação de abertura. Não mudar origem/meta nem conceder feedback de sucesso antes da persistência.

## Verificações e preservação

Tipos/lint e249 testes do app aprovados:198 núcleo/infra e51 componentes. Analisador rejeita relógio divergente em1ns e prova inconsistente de origem/PID/amostra; red/green registrado. API check completo passou em17m56s:14 suítes/93 casos,85 executados/oito nativos opt-in ignorados, zero falhas/erros,13 verificações operacionais e modularidade. O ensaio opt-in final passou, com10 frames frios/20 mudanças e convergência independente. Não foi preciso mudar contrato, schema, regra de hábito/XP/sync ou UI visual.

APK ensaiado: `4da461f7a023e9ffa2bc13a859709fa278a77a378471e1d3480bba501945ad65`. Build final em5m25s; helper sem warnings próprios, avisos existentes das dependências preservados. Observer/launcher foram compilados com SDK35. Configurações, rádios e reverse restaurados; pacote temporário/observador removidos, controle journeytest idêntico (`d9c8fd34…`). Emulador e painel próprios encerrados; ADB e nove containers preexistentes preservados. Metadados dos três arquivos observados do Pixel_9 original permaneceram idênticos; não é alegação forense sobre todo o conteúdo do AVD. [Auditoria](../design/evidencias/2026-10-20/desempenho-android/host-after.json).

Após a coleta, a revisão do driver reforçou a distinção entre pidof sem PID (status1 e I/O vazio) e falha do ADB. Regressão red/green e consulta real com o emulador fechado verificaram a rejeição de transporte indisponível. O APK não mudou; as estatísticas continuam sendo as da rodada8, sem nova coorte para essa guarda de falha.

## Tentativas rejeitadas

| Rodada | Resultado antes de qualquer amostra aceita |
|---|---|
|1|Tutorial de escrita com caneta cobriu o formulário; falhou a preparação do teclado.|
|2|AVD4GB ficou offline/travou no boot; causa não estabelecida. Desligamento do próprio cliente adb ficou preso e foi interrompido por identidade verificada; lançador ganhou limite de15s.|
|3|Consulta sem hierarquia durante captura; leitura seguinte/captura mostraram Briefing offline correto.|
|4|Consultas indisponíveis intercaladas zeravam indevidamente a observação de campo/IME; passaram a pausar a observação, preservando a exigência de duas leituras válidas iguais.|
|5|Nenhum frame correlacionado: drawingTime pode estar stale em OnDraw; substituído por callback público anterior à travessia.|
|6|Frame correlacionou; consulta restrita ao último registro de início não validou PID/relógio.|
|7|Dois registros retornados por ApplicationStartInfo não correspondiam ao PID atual. Método v1 rejeitado, causa interna do sistema não estabelecida; não se atribuiu registro antigo ao processo.|

A redução de4 para3GB ocorreu antes da primeira amostra aceita e não prova a causa do boot travado. A primeira compilação também falhou na remoção de três.so do cache C++; nova tentativa passou sem limpeza manual, causa não estabelecida. Rodadas1–7/schema1 ficam separadas do método v2/schema2 aceito; nenhuma amostra rápida foi selecionada dessas tentativas. Evidências e diagnósticos permanecem preservados.

## Limites e fontes

AVD não comprova aparelho Android mediano físico, iPhone ou M1 integral. Perfil3GB, amostra pequena, um hábito, fila delimitada, fonte100% e leitor desligado não aceitam bases grandes, texto200%, leitura/edição falada, todas as paletas ou perfil2GB. Host não é laboratório dedicado; metadados de memória foram registrados, inclusive pressão nas tentativas iniciais. Duas metas continuam abertas, além dos gates de aparelho/iPhone e operacionais existentes.

Fontes primárias: [FrameMetrics](https://developer.android.com/reference/android/view/FrameMetrics), [callback de frame](https://developer.android.com/reference/android/view/Choreographer.FrameCallback), [TTID/TTFD](https://developer.android.com/topic/performance/issues/launch-time), [histórico de início e seus limites](https://developer.android.com/reference/android/app/ActivityManager), [ordem OnDraw/drawingTime no Android](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/android14-dev/core/java/android/view/ViewRootImpl.java), [Performance do React Native](https://reactnative.dev/docs/global-performance). Código React Native0.86.3 e SDK instalados conferidos; sem atualização de dependências.

## Qualificação posterior da identidade do toque — 20/10/2026

A [comparação de latência](2026-10-20-latencia-do-cumprimento-m1.md) identificou uma limitação do probe antigo: um UP que não efetivou o cumprimento podia permanecer armado até o frame do toque seguinte. A rodada8 não registrou o timestamp do PressEvent, portanto não é possível confirmar retroativamente a identidade do evento do pico de3014,37ms, nem atribuí-lo à aplicação/SQLite. Os números e dados originais ficam preservados como histórico do método v2. Novas comparações usam v4, com elegibilidade DOWN/UP e correspondência obrigatória ao PressEvent; não misturar suas distribuições.
