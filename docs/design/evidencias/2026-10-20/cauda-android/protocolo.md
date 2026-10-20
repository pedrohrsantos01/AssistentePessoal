# Cauda do cumprimento — protocolo

Recorte: `.scratch/interface-m1/cauda-do-cumprimento.md`, spec/07 §1, REQ-HAB-004. Origem Git: `12c8ed69aac82ab6edbaf74feaf1b9b2b4dff011`. Não há alteração de schema, semântica, meta ou sucesso antes do commit.

## Sinal e hipóteses

Replay já executado com `node --import tsx --input-type=module -e ...` no app: ler `native-frames.json` e `javascript-milestones.json` de `latencia-android/optimized4`, executar `attributeToggleLatency`, filtrar `totalMs > 100` e exigir zero. Resultado: 20 amostras, oito acima, máximo 234,6592 ms; `assert.equal(high.length,0)` falhou. Replay rápido de registro real, sem atribuir retrospectivamente CPU a dados que não a mediram.

Hipóteses ordenadas, antes das novas medições:

1. Se cálculo repetido de dia/fuso domina, os spans `toggle.day`, `refresh.day` e `refresh.nextDay` concentrarão CPU; reduzir cálculo redundante deverá reduzir esse custo sob a mesma instrumentação.
2. Se apresentação repetida domina, `refresh.presentation` concentrará o custo após commit; simplificar cálculos de data isoladamente não resolverá esse span.
3. Se transação domina, `store.transaction` será grande em relação aos cálculos de dia/apresentação; comparar seus filhos distingue projeção/dependências/escritas. O restante da transação não identifica sozinho espera de disco.
4. Se esperas amplificam a cauda, haverá tempo decorrido adicional sem CPU proporcional da thread JS e/ou atraso entre entrada/handler/React/frame. Isso não identifica sozinho o componente do host, GC, disco ou agendador responsável.

## Observação inicial de CPU — rejeitada

APK isolado `dev.ritmo.readonlytest`, flag de desempenho já existente. `RitmoPerformance.readClock` é síncrono e registra `System.nanoTime`, `Debug.threadCpuTimeNanos`, TID e nome da thread; as leituras são delimitadas também por `performance.now` do JS. O primeiro analisador exigiu ordem dos relógios, thread JS única e CPU monotônica, com sanidade de até 0,5 ms de CPU acima do tempo decorrido em spans curtos. Essa regra rejeitou baseline1: `refresh.status` reportou 1,925283 ms de CPU em 1,315150 ms decorridos. O limite não foi aumentado para aceitar a tentativa. Os contadores de `Debug` passaram a ser apenas dados diagnósticos, sem atribuição de CPU/espera; nem amostras aparentemente consistentes sustentam tal atribuição. A meta visual de 100 ms permanece intacta.

Fontes: `ReactMethod.kt` instalado no RN 0.86.3 documenta a chamada síncrona na thread JS; ver também [documentação oficial de módulos Android](https://github.com/react/react-native-website/blob/main/docs/legacy/native-modules-android.md) e [documentação Android de `Debug.threadCpuTimeNanos`](https://developer.android.com/reference/android/os/Debug#threadCpuTimeNanos()). Conferir também as cópias instaladas e seus hashes. O registro usa `BaseReactPackage` e a interoperabilidade do módulo nativo.

Spans inclusivos, alguns aninhados: não somar seus percentis ou durações como se fossem disjuntos. Diferença wall−CPU desse contador não é usada, pois ele falhou na verificação. As chamadas ao observador têm custo: conservar os brackets JS/nativo para estimar seu custo de ida e volta, sem afirmar que o bracket interno mede todo o overhead. Logs detalhados são adiados em 500 ms e emitidos em partes pequenas para respeitar o limite do logcat; o driver espera a emissão fora do intervalo medido. Partes ausentes ou duplicadas invalidam o perfil e a coorte.

## Observação substituta — escalonador, método v4+sched1

Perfetto no AVD, iniciado após preparar a conta/hábito e antes das partidas. Preflight de um segundo verifica o parser do dispositivo. Coleta finita, duração máxima 15 minutos, arquivo máximo 128 MB, ftrace `sched_switch`, `sched_waking`, criação/renomeação de tarefas e metadados de processos. Não coleta texto de campos, logs Android ou tráfego. O processo próprio é identificado pelo PID e pelo caminho único antes de receber TERM; o arquivo é copiado antes de fechar o emulador. Mesmo observador/configuração nas duas coortes comparadas.

`builtin_data_sources.primary_trace_clock = BUILTIN_CLOCK_MONOTONIC` (campo disponível desde Android R): [fonte oficial](https://github.com/google/perfetto/blob/main/protos/perfetto/config/trace_config.proto). Processador v58.2, binário oficial verificado pelo SHA-256 do manifesto; metadados em `trace-processor.json`. [Referência de análise](https://perfetto.dev/docs/getting-started/command-line-analysis).

`scripts/analyze_android_scheduler.py` exporta SQL/CSV e exige pelo menos dois snapshots MONOTONIC exatamente alinhados ao relógio primário, ausência de perdas/erros do trace, cobertura da coorte, identidade PID/TID do perfil, histórico contínuo sem sobreposição e concordância entre `sched_slice` e `thread_state`. Testes próprios rejeitam lacunas, execução sobreposta e relógio deslocado. Atribuição só depois dessas verificações.

A interseção de cada span com os intervalos de execução mede **residência escalonada em vCPU do convidado**, incluindo eventuais interrupções. Não é tempo de CPU útil nem utilização do host. Estados `R`/`R+` mostram espera na fila do convidado; estados de sono não identificam por si só disco, SQLite ou GC. Não atribuir resíduos ao host sem perfil do host. Spans aninhados continuam inclusivos e não aditivos. O contador `Debug` não participa da análise autoritativa.

## Ensaio e comparação

Manter probe v4, DOWN/UP elegível, timestamp PressEvent do mesmo toque, PID ausente/novo e origem do Intent no Android. Dez partidas e vinte alterações offline, duas por processo, sem descartar amostras altas válidas. Mesmo AVD/API35/x86_64/3072 MB/GPU host, fonte 100%, TalkBack desligado, animações zeradas temporariamente. Instrumentação de CPU igual nas coortes comparadas. Os números anteriores sem esses spans não são a referência direta para atribuir melhora do novo recorte.

Launcher: `scripts/verify-android-accessibility.ps1 -Performance -Avd Ritmo_ReadOnly -GpuMode host -MemoryMegabytes 3072 -EvidenceDirectory <pasta nova e vazia>`. APK: `scripts/build-android-readonly.ps1 -Performance`, com Java 21/SDK Android configurados. Cada tentativa preserva seus dados e logs; somente coortes completas e verificadas entram na comparação.

Conferir persistência após reinício e convergência independente de um hábito/10 XP; configurações restauradas, pacote normal preservado e recursos próprios fechados. Não compilar nem rodar suítes pesadas durante a medição. Não inferir causa de variação passada dessa condição de isolamento. AVD não aceita aparelho físico, iPhone adiado ou M1.
