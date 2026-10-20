# Cauda do cumprimento — resolução do dia lógico

20/10/2026. [Recorte](../../.scratch/interface-m1/cauda-do-cumprimento.md), issue06, spec/07 §1 e REQ-HAB-004. Comparação da otimização concluída; checks finais aprovados. Meta de 100 ms e M1 continuam abertos.

O perfil apontou custo recorrente na resolução IANA do dia lógico. A mudança mantém um formatador para o último fuso e no máximo dois limites civis resolvidos. A chave do limite é o instante civil desejado, incluindo o horário configurado; mudar de fuso troca o contexto. A data civil do instante recebido continua sendo calculada em toda consulta. Não há cache de “hoje”, de conta, projeção, fila ou XP. O algoritmo de offsets, primeira ocorrência de hora repetida e busca do primeiro instante válido em uma lacuna permanece igual.

Somente `day-key.ts` muda entre as fontes de runtime dos APKs comparados, conforme os dois inventários de hashes. As observações de perfil são comuns às versões. A intenção e a projeção continuam na mesma transação SQLite; nenhuma resposta de sucesso foi antecipada para antes do commit. Schema e contratos de sincronização permanecem iguais.

## Referência aceita para comparação

`baseline4`: dez partidas de processo e vinte alterações offline no AVD/API35/x86_64/3 GB/GPU host, com reinício e convergência independente de um hábito/10 XP. APK `5ff5a4acef82089cab9cfeeb237c6cb531a39e5fd099d94efc612b427b33785d`. [Protocolo e evidências](../design/evidencias/2026-10-20/cauda-android/protocolo.md).

| Grandeza | Mediana da referência |
|---|---:|
| Feedback UP→frame | 137,98 ms |
| Soma dos três spans de dia lógico, por alteração | 33,91 ms decorridos / 28,19 ms escalonados |
| Transação | 14,94 ms decorridos / 7,90 ms escalonados |
| Apresentação após commit | 8,85 ms decorridos / 8,11 ms escalonados |
| Soma das idas e voltas ao observador | 5,26 ms |

Feedback da referência: p95 236,96 ms, máximo 270,67 ms e 0/20 dentro de 100 ms. A soma dos spans de dia é feita por amostra antes do percentil; não soma percentis independentes. Transação inclui seus filhos, que não devem ser somados novamente. “Escalonado” significa residência da thread na vCPU do Android, incluindo eventuais interrupções; não é CPU útil nem utilização do host.

## Método e tentativas

Probe v4 mantém gesto DOWN/UP elegível, identidade com PressEvent, relógio monotônico e endpoint do frame renderizado/emitido ao subsistema de tela. O perfil detalhado acrescenta observações síncronas e trace; não comparar diretamente seus números com a coorte anterior sem essas observações. A instrumentação tem custo e permanece restrita ao APK isolado.

O contador `Debug.threadCpuTimeNanos` foi rejeitado: em baseline1, um span de 1,315150 ms teve 1,925283 ms reportados de CPU. A regra não foi aumentada para aceitar esse resultado. O contador é conservado apenas como diagnóstico e não participa da atribuição autoritativa.

O método v4+sched1 usa Perfetto, com relógio primário MONOTONIC, snapshots exatamente alinhados, ausência de perdas/erros, PID/TID conferidos, cobertura contínua e sem execução sobreposta da mesma thread. `sched_slice` deve concordar com `thread_state` em cada span e em cada etapa entre entrada, handler, commit, retorno, React e frame. As threads JS e principal da interface são verificadas separadamente; seus tempos podem se sobrepor. Estados terminais X/Z abertos só são admitidos depois do último frame daquele PID, nunca dentro de uma medição. Os seis testes do analisador cobrem lacunas, sobreposição, relógio deslocado, percentil pelo posto e estados terminais.

| Tentativa | Resultado |
|---|---|
| baseline1 | Vinte mudanças; contador CPU incoerente. Rejeitada, sem conferência final de reinício/convergência. |
| baseline2 | Preparação parou por ausência de foco/teclado estáveis. Nenhuma distribuição de desempenho. |
| baseline3 | Jornada/reinício/convergência passaram; trace rejeitado por configuração DISCARD com escrita contínua e ausência de flush periódico. Fora da comparação. |
| baseline4 | Jornada e perfil do escalonador aprovados. Buffer circular e flush periódico; preflight também consulta as estatísticas do processador. |

Não houve descarte de uma amostra alta válida. As tentativas rejeitadas ficam separadas e não substituem uma coorte completa. A validade funcional da terceira tentativa não torna seu perfil de escalonamento aceito.

## Resultado da otimização

`optimized1`, APK `33e3eb8c8cf4d264d3bcd16f0289212b2152eec945ded79361914ab252bae9ab`, completou o mesmo protocolo, com reinício/convergência, perfil validado e reprodução pelas exportações. [Comparação integral](../design/evidencias/2026-10-20/cauda-android/comparison.json).

| Métrica | Referência | Otimizado |
|---|---:|---:|
| Feedback p50 | 137,98 ms | 85,36 ms |
| Feedback p95 | 236,96 ms | 101,00 ms |
| Feedback máximo | 270,67 ms | 120,76 ms |
| Dentro de 100 ms | 0/20 | 18/20 |
| Resolução do dia, soma por alteração/p50 | 33,91 ms | 0,95 ms |
| Mesmos spans, residência escalonada/p50 | 28,19 ms | 0,88 ms |

A queda observada do feedback mediano foi de 38,13%; o custo mediano dos spans de dia caiu 97,19%. Os demais custos também variaram entre as coortes: não atribuir toda a diferença visual a uma única parcela ou somar percentis independentes. A comparação usa a mesma observação detalhada e inclui seu custo.

As duas amostras acima da meta foram preservadas: 2/2 com 100,9995 ms e 7/1 com 120,7602 ms. A última teve 28,40 ms handler→commit, 23,45 ms commit→retorno, 26,67 ms retorno→React e 33,92 ms React→frame, além de 8,32 ms antes do handler. No retorno→React, a thread JS ficou escalonada por 25,15 ms; no React→frame, a UI ficou escalonada por 14,42 ms e em fila R/R+ por 5,65 ms. Isso localiza trabalho/esperas restantes, sem identificar funções React, GC, GPU, E/S ou componente do host. O estado D observado antes do commit também não identifica sozinho a causa de uma espera.

Abertura na versão otimizada: 10/10 dentro de 2 s, p50 1027,06 ms e máximo 1384,26 ms. Cards: 0/10 dentro de 300 ms, com a origem de abertura preservada. AVD e endpoint de frame emitido não aceitam aparelho mediano físico, fótons da tela, iPhone ou M1.

## Verificações e pendências

Tipos/lint e 259 testes do app passaram, incluindo os casos de fuso/hora, relógio para trás, virada exata, limites repetidos/ausentes e salto de data em Apia; testes de falha SQLite, uma publicação por commit, fila e isolamento continuam verdes. Seis testes do analisador e reprodução integral das duas exportações também passaram. Check completo da API aprovado em 12 min 56 s: 14 suítes, 93 casos/85 executados/oito nativos opt-in ignorados, zero falhas/erros e modularidade aprovada. Instalação normal/arquivo APK, identidades do ADB/nove containers preexistentes e metadados selecionados do AVD original preservados. Configuração nativa normal recomposta; sem emulador, painel ou Java remanescente do ensaio, incluindo tentativas rejeitadas. [Auditoria de preservação](../design/evidencias/2026-10-20/cauda-android/preservation.json).

Traces completos permanecem localmente em `.scratch/runtime/cauda/traces/`, com checksums no inventário. O Git conserva exportações filtradas, SQL e hashes dos insumos; `--verify-exports` repete as verificações sem o binário ou o trace completo e exige resultado igual ao processamento original. Não versionar o fluxo completo de processos do emulador.

Próximo recorte: [confirmar feedback com observação reduzida](../../.scratch/interface-m1/feedback-com-probe-leve.md), conservando probe v4 e todas as amostras, antes da partida dos cards. A observação detalhada teve soma mediana das idas e voltas de 3,76 ms no otimizado, além de outros custos do profiler; não subtrair esse valor para declarar a meta. Se persistirem picos, delimitar a apresentação restante a partir de um novo perfil apropriado. Metas, aceite físico/iPhone, demais estados/leitura/paletas e gates externos continuam pendentes em 06/M1.
