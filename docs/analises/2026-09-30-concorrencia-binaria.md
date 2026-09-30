# Concorrência binária — 30/09/2026

Status: incremento de validação concluído; tarefa 05 e M1 continuam abertos. Origem: [tarefa 05](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md), M1-04/M1-06 e REQ-HAB-004a, com REQ-GAM-001/003a e as garantias de reenvio de M1-07. Pedro autorizou seguir os recortes recomendados antes de decompor os eixos restantes.

O núcleo existente passou pelos cenários acrescentados. A entrega amplia os testes e registra evidências; não exigiu alteração de produção, contrato, schema ou dependência.

## Fronteiras e resultado

Fronteiras previamente aprovadas: `AccountStore` e transporte `HttpSync`, com SQLite real por cliente e API Spring/PostgreSQL descartáveis. Verificação por `view`, `operations`, recibos, pull e snapshot públicos, sem consultar tabelas ou funções internas para obter o resultado esperado. Cada cenário usa conta sintética própria, duas sessões autenticadas, dois dispositivos e dois arquivos SQLite.

Estado inicial: um hábito binário diário cumprido, uma concessão de 10 XP e 10 de orçamento consumido. `U_A` e `U_B` são desfazeres independentes; `M_B` não conhece `U_A`; `R_A` conhece somente `U_A`.

| Cenário HTTP | Chegada controlada | Resultado após convergência |
|---|---|---|
| M1-04 | `U_A → M_B` | Desmarcado, 0 XP ativo |
| M1-04 | `M_B → U_A` | Desmarcado, 0 XP ativo |
| M1-04 | Envios simultâneos de `U_A` e `M_B` | Desmarcado, 0 XP ativo; sem presumir ordem de commit |
| M1-06 | `U_A → R_A → U_B` | Desmarcado; conhecer só `U_A` não vence `U_B` |
| M1-06 | `U_A → U_B → R_A` | Desmarcado; contexto parcial não restabelece o cumprimento |
| M1-06 | `U_B → U_A → R_A` | Desmarcado; os dois desfazeres permanecem conhecidos |

As três ordens de M1-06 conservam a dependência de `R_A` em `U_A`. Em todos os casos, uma marcação posterior que incorpora todos os desfazeres restabelece o cumprimento e a concessão original: mesmo ID, valor de 10 XP e dia, sem devolver ou consumir novamente o orçamento.

O histórico público de transições também é comparado com exemplos normativos. Se `R_A` chega antes de `U_B`, há reversão, restauração provisória e outra reversão, conservadas após a restauração final. Nas outras ordens, `R_A` não provoca restauração. M1-04 conserva uma reversão e uma restauração posterior.

Reabrir os bancos antes dos envios preserva exatamente IDs, sequência, contexto e dependências. Em M1-06, o teste descarta deliberadamente a resposta da remarcação parcial após o commit; a operação permanece pendente no SQLite após outro reinício e é reconhecida no pull antes de um novo envio automático. Reenviar as intenções originais recebe `replayed=true` e o recibo original, sem alterar entidades, transições, orçamento ou revisão global. Confirmações antigas aplicadas após a restauração não fazem a projeção retroceder.

O teste local adicional recebe o desfazer desconhecido enquanto a remarcação parcial ainda está pendente. A projeção passa a desmarcado/0 XP, continua assim após reabertura e repetição da página e só volta a cumprido/10 XP com uma nova intenção que conhece ambos. Isso exercita o estado local antes da confirmação pelo servidor.

## Reprodução e evidências

Dependências instaladas pelo lockfile, Node 24, pnpm, Java 21 e Docker disponíveis. Na raiz:

```powershell
pnpm.cmd --dir app typecheck
pnpm.cmd --dir app lint
pnpm.cmd --dir app test
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr' # adaptar
$env:DOCKER_CONFIG=Join-Path $env:TEMP 'ritmo-empty-docker-config' # configuração de teste local
api\gradlew.bat -p api check --no-daemon
```

Para repetir somente o proprietário dos cenários HTTP deste arquivo:

```powershell
api\gradlew.bat -p api test --tests dev.ritmo.RuntimeTests.mobileRepositoriesSynchronizeThroughTheRealHttpApi --no-daemon
```

O Gradle prepara o servidor HTTP e PostgreSQL descartáveis e passa `RITMO_TEST_API` ao runner TypeScript. O teste integrado não deve ser iniciado sozinho contra a VPS ou uma API com dados reais.

| Verificação final | Resultado |
|---|---|
| App typecheck | Aprovado |
| App ESLint | Aprovado, sem advertências |
| Suíte local do app | 70 aprovados, incluindo o novo cenário local |
| `test/integration/sync.test.ts`, executado pelo Gradle | 8 aprovados: 2 anteriores e 6 novos |
| API `check`, incluindo fronteiras Modulith | 34 casos: 33 aprovados, 1 Android nativo ignorado por ausência de serial; zero falhas |

O `check` final executou em aproximadamente um minuto. Fontes: [cenário local](../../app/test/concurrency.test.ts), [cenários HTTP](../../app/test/integration/sync.test.ts) e [proprietário Java](../../api/src/test/java/dev/ritmo/RuntimeTests.java). Evidências geradas e ignoradas pelo Git: `api/build/mobile-integration.log`, `api/build/test-results/test/TEST-dev.ritmo.RuntimeTests.xml` e `api/build/reports/tests/test/index.html`.

Na preparação da verificação de replay, uma consulta de feed sem cursor recebeu corretamente `resync_required`. O teste passou a consultar o corte do snapshot público para comparar a revisão global. Uma referência da fixture também foi ajustada para o narrowing de TypeScript. Essas correções atingiram os testes; os checks finais acima foram executados depois delas.

## Limites e continuidade

A evidência cobre o núcleo de M1-04/05/06 e amplia M1-07/17 no recorte binário diário. Os dois clientes são SQLite de desktop; este incremento não repete o harness Android nem fornece aceite no iPhone. A perda de confirmação é controlada pelo teste após um commit HTTP real. Não foram exercitados novos casos de datas/fusos, exclusão, hábitos de outros tipos ou interfaces visuais.

Próximo recorte: M1-12, preservação de `dayKey`, virada lógica, fuso, relógios e envio tardio. Depois seguem exclusão/tombstones e demais lacunas da matriz, configuração operacional de SMTP/rate limiting/deploy/backup e aceite dos aparelhos. UI depende do protótipo de Pedro; a rota de instalação no iPhone continua pendente.

Para a decomposição posterior, usar a skill instalada `grilling`: verificar primeiro os fatos nos documentos/código, formular rodadas de decisões com recomendações e aproveitar as respostas para atualizar specs, critérios de aceite, dependências e issues de fatias verticais. Essa entrevista deve esclarecer lacunas dos eixos restantes sem reabrir decisões aprovadas por falta de consulta. Fases futuras permanecem em planejamento até autorização do seu escopo.
