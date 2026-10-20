# Latência do cumprimento — atualização única após commit

20/10/2026. Recorte de [issue06](../../.scratch/interface-m1/issues/06-aparencia-e-acessibilidade.md), [spec/07 §1](../../specs/07-nao-funcionais-e-lgpd.md) e REQ-HAB-004. Comparação nativa concluída; meta de 100 ms e M1 continuam abertos. Checks completos aprovados; a meta de desempenho segue pendente.

A jornada recalculava e publicava duas vezes a mesma apresentação depois de uma marcação offline. O armazenamento já notificava a jornada após o commit; `Journey.local` solicitava outro refresh completo. A correção aproveita a apresentação já publicada. Se o comando não provocar notificação, a atualização explícita continua limpando erros e atualizando o relógio. Nenhum sucesso foi antecipado para antes do commit; fila, projeção, XP, identidades e schema permanecem com os contratos existentes.

## Resultado observado

Duas coortes completas e independentes no mesmo perfil de AVD: 10 partidas de processo e 20 alterações offline cada. Percentis pelo posto mais próximo, conservando todas as amostras válidas. [Dados e protocolo](../design/evidencias/2026-10-20/latencia-android/README.md).

| Feedback desde o UP real até o frame | Referência (baseline2) | Corrigido (optimized4) |
|---|---:|---:|
| p50 | 130,74 ms | 97,31 ms |
| p95 | 175,56 ms | 160,58 ms |
| Máximo | 189,90 ms | 234,66 ms |
| Dentro de 100 ms | 1/20 | 12/20 |
| Refresh completo por alteração | 2 em 20/20 | 1 em 20/20 |

A mediana caiu 25,57%. A cauda não está resolvida: o máximo da versão corrigida foi maior. Não há aceite da meta de 100 ms, nem alegação de melhora uniforme. Abertura geral na versão corrigida: p50 de 1038,65 ms e máximo de 1574,13 ms, 10/10 ≤ 2 s. Cards: 0/10 ≤ 300 ms, com a mesma origem de abertura e o mesmo frame de conteúdo interativo. A mudança não foi destinada à partida do app.

## Atribuição

| Etapa (p50, posto mais próximo) | Referência | Corrigido |
|---|---:|---:|
| UP → Activity | 0,85 ms | 0,89 ms |
| Activity → handler | 8,19 ms | 9,13 ms |
| Handler → commit SQLite | 19,09 ms | 19,02 ms |
| Commit → retorno local | 57,63 ms | 26,99 ms |
| Retorno → commit React | 18,55 ms | 18,44 ms |
| Commit React → frame | 22,19 ms | 24,54 ms |

Os percentis das etapas não são parcelas aditivas de um percentil total. A soma dos intervalos foi conferida por amostra; `comparison.json` conserva as parcelas. O custo após commit caiu de 57,63 ms para 26,99 ms de p50; a mudança removeu uma recomposição completa, sem modificar a transação de persistência.

O maior intervalo corrigido foi sample 6/sequence 1:234,66 ms. Suas parcelas foram 13,05 ms antes da Activity,35,86 ms até o handler,77,86 ms do handler ao commit,52,25 ms do commit ao retorno,28,93 ms até o commit React e 26,71 ms até o frame. O trecho handler→commit inclui leitura do perfil, cálculo do dia, identidade, comando e transação; não representa um cronômetro exclusivo do SQLite. O refresh restante também pode variar. Os dados não provam qual dessas operações ou condição do host causou a cauda. O [próximo recorte](../../.scratch/interface-m1/cauda-do-cumprimento.md) separa esses custos antes de escolher outra otimização.

## Relógios e identidade do gesto

O probe nativo v4 exige um único ponteiro desde DOWN até UP, no mesmo checkbox habilitado, e cancela o candidato ao receber outro ponteiro, CANCEL ou movimento além do touch slop do Android. A origem continua sendo `MotionEvent.eventTimeNanos` no UP; o DOWN comprova a elegibilidade do gesto, sem antecipar o início da métrica. Antes da primeira marcação, um gesto real com dois dedos termina sobre a linha e precisa deixar o estado inalterado, sem armar uma medição. Esse guard passou nas duas coortes aceitas.

Cada PressEvent deve concordar com o UP nativo em menos de 1 ms. No RN0.86.3 instalado, TouchEvent copia `motionEvent.eventTime` em milissegundos e TouchesHelper publica esse timestamp. `performance.now()` e `nativePerformanceNow()` chegam a `HighResTimeStamp`/`steady_clock`; cada marco JS v2 inclui uma leitura anterior/posterior do relógio nativo, e a leitura de performance deve ficar dentro desse intervalo. O analisador rejeita fallback, correspondência ausente, ordem inválida e fases incompletas. Nenhum offset do Windows/ADB foi estimado para alinhar relógios.

A documentação do [RN0.86](https://reactnative.dev/docs/0.86/global-performance) descreve o tempo desde o boot; o [relógio Android](https://developer.android.com/reference/android/os/SystemClock) e o [steady_clock do LLVM](https://raw.githubusercontent.com/llvm/llvm-project/llvmorg-18.1.8/libcxx/src/chrono.cpp) sustentam a base monotônica, conferida também no fonte instalado e por seus hashes. As verificações de evento e ordem são obrigatórias em execução; fonte/documentação não substituem essa conferência.

O frame final mantém a correlação exata com VSYNC/INTENDED_VSYNC e o endpoint INTENDED_VSYNC_TIMESTAMP+TOTAL_DURATION. É renderização e emissão ao subsistema de display, sem medir fótons. Inicialização mantém origem no launcher Android antes de `startActivity`, PID ausente/novo e relógio de origem validado, conforme o protocolo anterior.

## Tentativas rejeitadas e comparação

1. `diagnostico1`, probe v3: um UP anterior foi associado ao frame produzido pelo toque seguinte. O UP armado estava em 153132,056 ms; o PressEvent efetivo, em 158803 ms. A diferença de 5670,944 ms invalidou a correspondência. O intervalo de 5783,63 ms permanece no dado bruto, mas não é a latência de um mesmo toque. A rodada inteira foi rejeitada e não completou a confirmação final.
2. `baseline2`, probe v4: referência completa, incluindo correspondência JS/nativa e confirmação independente. APK 3f41b8bf.
3. `optimized3`, mesmo APK corrigido usado depois: o Android informou uma entrega de FrameMetrics perdida na quarta partida (`dropped=1`). Rodada interrompida, registros parciais e restauração preservados; não integra a distribuição comparativa.
4. `optimized4`, probe v4: repetição completa, sem trocar APK, parâmetros ou metas. APK c7da0cca (identidade completa nos JSONs de seleção/instalação).

A [rodada8 anterior](2026-10-20-desempenho-instrumentado-m1.md) usava probe v2, sem o vínculo entre PressEvent e UP. Seus números, incluindo3014,37 ms, ficam preservados como histórico do método antigo. Não é possível provar retroativamente que aquele pico teve a mesma causa; ele não serve para atribuir custo ao banco ou à aplicação. A comparação desta entrega usa exclusivamente as duas coortes completas do método v4, sem remover amostras altas válidas.

O build finito `scripts/build-android-readonly.ps1 -Performance -CompareRefresh` gera baseline.apk (segunda atualização incondicional) e current.apk (fonte corrigida), mantendo o mesmo probe/flags/pacote e reutilizando a configuração nativa. O script verifica a origem, preserva edição concorrente desconhecida, registra hashes de fonte/bundle e restaura a fonte corrigida/configuração normal/APK original em finally. Para executar a referência pelo wrapper, a seleção controlada preserva o APK corrigido e coloca baseline.apk no caminho current.apk; o arquivo de seleção registra o SHA esperado. A segunda seleção repõe o corrigido. Os hashes instalados conferem com cada seleção.

## Validação e limites

A regressão com SQLite real falhou antes da correção por publicar duas apresentações idênticas; os23 testes da jornada passaram depois. Tipos/lint e 253 testes do app passaram. O teste de componente mantém a injeção de falha no INSERT da projeção: rollback não publica checkbox feito, XP ou sucesso. O analisador tem regressão para um UP antigo associado a um PressEvent posterior e recusa relógios/fases incompletos.

Check API: a primeira execução completa falhou em um cadastro de preparação do ensaio de WAL (503 em vez de 201), com 84 casos aprovados/um falho/oito opt-in ignorados em 17 min 36 s. Não houve mudança de código da API. A repetição completa sem compilação ou ensaio Android concorrente passou em 12 min 17 s: 14 suítes, 85 casos executados e oito opt-in ignorados, zero falhas/erros e modularidade aprovada. A causa da primeira falha ainda não foi estabelecida; o sucesso isolado não a prova. Os registros da primeira execução foram conservados.

Ambas as coortes aceitas preservaram o conjunto local após reinício e confirmaram por cliente independente um único hábito cumprido e 10 XP. O estado nativo e o screenshot final foram conferidos. Configurações retornaram aos valores anteriores e as instalações temporárias foram removidas, mantendo o pacote de controle d9c8fd34. Emuladores e acompanhamentos próprios foram fechados após cada tentativa, inclusive falhas; a auditoria final confirmou nenhum emulador/acompanhamento/Java restante, o ADB preexistente com a mesma identidade, os nove containers preexistentes, os três metadados selecionados do AVD original e o hash do APK normal preservados. Essa é uma conferência de custódia delimitada, sem alegar inspeção forense de toda a máquina.

Perfil: AVD Ritmo_ReadOnly/API35/x86_64/3 GB/GPU host, fonte 100%, TalkBack desligado e animações temporariamente0. Instrumentação e UIAutomation entre intervalos podem influenciar o ambiente; antes/depois usam a mesma instrumentação. Não há aceite de Android mediano físico, iPhone, TalkBack, bateria, todas as paletas ou M1. A rota iOS segue adiada por Q55. O próximo recorte aborda a cauda do cumprimento; partida dos cards vem depois, sem relaxar100 ms/300 ms ou alterar sucesso após commit.
