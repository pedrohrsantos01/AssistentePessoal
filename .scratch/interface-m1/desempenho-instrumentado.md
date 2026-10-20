# Desempenho instrumentado do M1 — 20/10/2026

Status: done para instrumentação/coleta; metas de cards/feedback pendentes. Issue06/M1/aceite físico continuam abertos.

## Escopo e método

Spec/07 §1: cold start até Briefing interativo ≤ 2000 ms e resposta visual ao marcar ≤ 100 ms. Spec/08 §6: cards locais ≤ 300 ms após o mesmo cold start. Não deslocar a origem dos 300 ms para depois de carregar JS/SQLite. Medir antes de otimizar.

Ensaio release isolado no AVD API35/3 GB, visível. Instrumentação nativa somente na variante explícita de teste; sem rede de telemetria, conteúdo de usuário, IDs de domínio ou segredos. Tags estáticas de teste identificam conteúdo local já renderizado pelo produto. onDraw observa a hierarquia montada e o estado checked real; correlação exata do Choreographer.FrameCallback antes da travessia com VSYNC_TIMESTAMP/TOTAL_DURATION do mesmo frame registra término da renderização/envio ao subsistema de exibição, não apenas layout, commit JS ou requestAnimationFrame. Isso não mede a luz física do display.

Método v2: um Instrumentation separado, restrito ao pacote de ensaio, registra System.nanoTime imediatamente antes de Context.startActivity. A comunicação/inicialização do driver e do launcher ficam antes dessa origem; o envio nativo do Intent integra o intervalo. Processo ausente após force-stop e novo PID comprovam o processo frio. Native PID, PID do launcher, amostra e relógio recebido devem corresponder exatamente ao resultado do launcher. reportFullyDrawn é auxiliar. Input usa MotionEvent; fim exige checked alterado após commit SQLite e frame nativo correspondente concluído. Nenhum timer declara sucesso.

O método v1 por ApplicationStartInfo foi rejeitado sem amostra aceita: dois registros retornados não correspondiam ao PID atual. Não atribuir registros antigos a este processo nem usar callback JS/tempo de ADB como substituto. A origem v2 é anterior ao dispatch do Intent, conservando as metas de2000/300ms desde o mesmo começo.

Uma conta/hábito sintéticos via jornada/API reais. Preparação não entra na amostra. Offline nos intervalos, sem limpar banco/cofre/dados entre aberturas. A fila cresce naturalmente de zero a 18 alterações pendentes nas dez aberturas, com duas alterações por ciclo, todas preservadas; registrar essa carga por amostra. Dez processos frios (force-stop + PID ausente; sem limpar cache de página/JIT global) e vinte marcações/desmarcações físicas. Texto100%, leitor desligado e redução de movimento configurada/restaurada explicitamente; sem aceite de leitor neste recorte. Estado/IDs/XP após reabrir e convergência independente preservados.

Guardar todas as amostras, duração p50/p95/máxima e fração dentro das metas; não selecionar apenas rápidas nem reinterpretar limiar. Falta de relógio, frame ou estado impede aceitar a medida. AVD não representa automaticamente aparelho mediano físico; nenhuma aprovação de iPhone. Restaurar configurações e fechar somente recursos próprios.

## Verificação e entrega

Testes de componentes das tags/gates e analisador (relógio/frame/estado/amostra inválidos), tipos/lint/suíte app e check completo API. Evidências, fonte/metodologia, APK/hash, relatório, commit e nota de memória. Falha das metas será reportada com os valores reais; otimização fica delimitada após diagnóstico do gargalo.

## Fontes primárias

- https://developer.android.com/reference/android/view/FrameMetrics
- https://developer.android.com/reference/android/app/ApplicationStartInfo
- https://developer.android.com/topic/performance/issues/launch-time
- https://reactnative.dev/docs/global-performance
- React Native0.86.3 instalado: Performance/ReactNativeStartupTiming e BaseViewManager.

Ajustes de método antes de aceitar amostras:3 GB em lugar dos4 GB iniciais; escrita com caneta desativada/restaurada para evitar o tutorial do teclado; observação indisponível não equivale a teclado oculto; captura exige hierarquia atual; callback público substitui drawingTime stale em OnDraw, com igualdade em ns. Tentativas rejeitadas permanecem no relatório.

Resultado verificado: rodada8/schema2,10 aberturas/20 alterações,249 testes app echeck completo API aprovados. Abertura10/10≤2s; cards0/10≤300ms; feedback0/20≤100ms, máximo3014,37ms preservado. [Relatório](../../docs/analises/2026-10-20-desempenho-instrumentado-m1.md), [próximo recorte](latencia-do-cumprimento.md).
