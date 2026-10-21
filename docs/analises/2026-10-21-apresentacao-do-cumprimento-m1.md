# Perfil da apresentação do cumprimento — 21/10/2026

O diagnóstico localizou o maior intervalo desta coorte na renderização nativa posterior ao React. Nenhum componente do produto foi alterado. O próximo experimento delimitado é [conservar o checkmark montado](../../.scratch/interface-m1/checkmark-persistente.md); sua contribuição causal ainda precisa de comparação. [Evidências e reprodução](../design/evidencias/2026-10-21/apresentacao-cumprimento/README.md).

## Medida aceita e alcance

`diagnostico2`: dez processos frios/vinte alterações offline, mesmo ACTION_UP/PressEvent e frame nativo v4. Reabertura preservou as intenções; outro cliente HTTP/SQLite confirmou um hábito feito e 10 XP, sem duplicação. A captura foi validada integralmente e reproduzida pelos exports. Fonte 100%, TalkBack/animações desligados, AVD/API35/3 GB/GPU host; configurações e instalação original restauradas ao terminar.

| Medida | P50 | P95 / máximo | Dentro da meta |
|---|---:|---:|---:|
| Feedback | 130,9812 ms | 219,4891 / 411,7630 ms | 0/20≤100 ms |
| Abertura interativa | 1685,8937 ms | 1945,1631 / 1945,1631 ms | 10/10≤2 s |
| Cards locais, mesma origem da abertura | 1685,8937 ms | 1945,1631 / 1945,1631 ms | 0/10≤300 ms |

O APK é o mesmo leve da confirmação anterior, hash `9c6bdca5c13bf1dc6d9e7873f1b44a0c6763b4e468f46c5edc0870136ee59fff`. A opção explícita `-Presentation` acrescenta Perfetto/atrace, sem reintroduzir a porta síncrona ou perfis JS por função. O custo dessa observação integra os tempos. Não comparar causalmente esta distribuição com a coorte sem trace de 20/10, descontar overhead ou arredondar para aceite. O endpoint continua sendo o frame renderizado/emitido, sem prova de fótons ou de aparelho físico.

## Onde ocorreu o pico

Na amostra 10/1, o feedback de 411,7630 ms teve React→frame de 309,3733 ms:

| Thread | Residência em vCPU nesse intervalo | Estados observados |
|---|---:|---|
| JavaScript | 2,6748 ms | S: 306,6985 ms |
| UI | 34,2683 ms | S: 270,4873 ms; R/R+: 4,6177 ms |
| RenderThread | 268,4081 ms | S: 13,7578 ms; R/R+: 27,2074 ms |

Na UI, `postAndWait` teve 257,9369 ms de parede/0,0954 ms de residência. No RenderThread, `glGenTextures encode` teve 195,1819/193,9593 ms. As seções `traversal`, `draw`, `DrawFrames` e `prepareTree` são aninhadas: não somar suas durações. Escalonamento não mede CPU útil; o nome de uma chamada GL não comprova tempo de GPU nem causa no host. Estes dados tampouco nomeiam um componente React responsável pelo tempo anterior ao marco `toggle.react`.

O pico ocorreu ao marcar. Nas dez marcações apareceu `SurfaceMountingManager::createViewUnsafe(RCTImageView)`; nos dez desfazimentos, não. O código de `HabitRow` monta condicionalmente o bitmap do checkmark. Isso sustenta o experimento de manter essa imagem montada, conservando asset/tokens/estado semântico. Não demonstra que esse bitmap explica o pico isolado do encoder; a comparação antes/depois decidirá. Não foi feita uma otimização especulativa neste diagnóstico.

## Validade do perfil

O analisador exige coorte completa, mesmo relógio MONOTONIC nos snapshots, cobertura dos vinte intervalos, ausência de erros/perdas reportados pelo processador, concordância entre sched_switch e estados Running e seções de frame da própria aplicação. O processador é fixado por SHA-256. Os SQL/CSV e seus hashes permitem repetir o cálculo sem reexecutar o aparelho; o trace bruto permanece local, com hash registrado.

A captura contém threads transitórias de inicialização chamadas RenderThread. Elas não podem ser fundidas por nome com a thread que desenha o gesto. A seleção usa PID/TID e término X/Z observado antes da primeira interação; nomes ambíguos ainda falham. Estados que começam depois do último frame não intersectam a medição. Estado aberto/lacuna dentro de um intervalo continua sendo recusado: nenhum tempo desconhecido vira espera. A primeira execução do analisador recusou esses casos de fronteira; a falha ficou preservada e testes passaram a cobrir a seleção e o recorte corretos.

Essa interpretação distingue as tabelas de [escalonamento/estados e slices do Perfetto](https://github.com/google/perfetto/blob/main/docs/analysis/perfetto-sql-getting-started.md). As seções nativas descrevem o pipeline, sem inventar nomes de componentes a partir do tempo agregado. O fluxo de montagem em thread de UI consta na [documentação do React Native](https://github.com/react/react-native-website/blob/main/website/architecture/render-pipeline.md).

## Falhas preservadas

`diagnostico1` mediu vinte frames, mas não passou a prova integral. O trace atingiu o teto de 128 MB e cobriu apenas dezoito feedbacks; o analisador recusou `trace_end_before_frame`. O coletor antigo tentou consultar um processo já encerrado e deixou de puxar o arquivo. Ele foi recuperado em uma execução finita separada, com janela visível e fechamento ao terminar; a primeira tentativa de reabrir com GPU host falhou no boot, e a recuperação por software funcionou. Não substituiu os tempos medidos nem a configuração da coorte aceita.

A conferência do segundo cliente também falhou no dia consultado. O ensaio atravessou as 04:00 UTC, enquanto o Clock da API ficou congelado antes da virada. A regressão reproduziu a divergência 20/21 com o padrão anterior. A fixture agora recebe o instante da API e escolhe pela interface um início de dia comum ao servidor e a toda a janela de trinta minutos do teste; clocks incompatíveis são recusados antes de criar dados. Na coorte aceita, ambos consultaram 21/10, início às 03:00 UTC, e a confirmação independente passou. Não mudou o padrão do produto, a regra de dia lógico nem o Clock de produção.

Para Presentation, o teto do trace passou a 512 MB/duração máxima de trinta minutos, sem alterar os limites de desempenho. A captura encerra após os frames medidos; se o processo já encerrou, o arquivo ainda é recuperado e precisa passar pela validação de cobertura. O modo detailed conserva seu perfil/limites anteriores, sem fallback por ausência de dados.

Os dois primeiros checks do app tiveram timeouts de 5 s em testes de componentes diferentes; logs preservados. Os cinco casos selecionados a partir dessas falhas passaram isoladamente com o mesmo limite. Isso não substituiu o check completo nem prova a causa dos timeouts. A terceira execução completa passou em 47 s: tipos/lint e 264 testes (213 de domínio/51 componentes), sem ampliar o timeout ou mudar código de produto. A instabilidade anterior permanece registrada, sem atribuição causal ao host.

Check completo da API com --rerun-tasks aprovado em 16 min 42 s: 14 suítes/93 casos, 85 executados/oito nativos opt-in ignorados, zero falhas/erros, modularidade e 13 testes operacionais. Os 14 testes dos analisadores também passaram; incluindo recusa de lacuna/relógio diferente/coorte parcial/threads ambíguas e caso um nanossegundo acima da meta, sem arredondar para aprovação. A reprodução TS confirmou exatamente os frames/PressEvent, fases, modo explícito e resultado do cliente independente. O inventário confirmou 108 fontes canônicas de runtime iguais ao commit de referência `58fd15f`.

## Auditoria de recursos

Processos próprios encerrados; configurações, APK normal, APK baseline, configuração nativa normal, instalação da jornada, servidor ADB 38660 e metadados selecionados do AVD pessoal preservados. [Auditoria original](../design/evidencias/2026-10-21/apresentacao-cumprimento/preservation.json) mantém passed=false: oito dos nove containers preexistentes mantiveram ID; supabase_db_care-platform mudou de `986a7b00bd67` para `6f35f3308fb7`, criado em 21/10/2026 04:33:12 UTC e saudável. A autoria não foi estabelecida; nenhuma ação explícita de parada/recriação desse container foi emitida neste recorte, e ele não foi alterado para tentar recompor o ID anterior. [Avaliação separada](../design/evidencias/2026-10-21/apresentacao-cumprimento/preservation-assessment.json) distingue limpeza própria confirmada da preservação integral não comprovada.

## Pendências

Feedback e cards não atingiram suas metas. O experimento escolhido vem antes da partida dos cards. Demais estados/leitura/edição falada/paletas finais, aparelho físico, iPhone adiado e gates externos continuam no recorte06/M1. Este diagnóstico não aceita o marco.
