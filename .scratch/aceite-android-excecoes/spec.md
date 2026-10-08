# Aceite técnico Android — exceções e isolamento

Data: 08/10/2026. Pedro autorizou executar os quatro itens recomendados antes de definir domínio. Origem: [tarefa 05](../primeiro-marco/issues/05-completar-sessao-e-recuperacao.md), [plano de aceite M1](../aceite-m1/spec.md) e [Q51–Q53](../recuperacao-excecoes/spec.md).

## Fronteiras e resultado esperado

Ampliar o harness HTTP Android isolado, sem alterar comportamento de produto. Expo/Hermes, SQLite/Drizzle, SecureStore, fetch, AppState e rede reais; Spring/PostgreSQL descartáveis e cliente SQLite independente. Cada cenário usa nomes próprios de banco derivados do UUID da execução, sem apagar dados anteriores.

Cofre: injetar erro de leitura na fronteira externa SecureVault; gravação, limpeza e leituras saudáveis delegam ao SecureStore real. Com sessão ativa e SQLite saudável, preservar leitura/escrita, pausa remota, novas intenções, reinício, retry e XP.

Abertura: injetar falha de open/PRAGMA e executar uma migration adicional exclusiva de ensaio pelo migrator Expo/Drizzle real, que altera um envelope e falha antes do commit. Bloquear conta/instalação conforme Q51; fechar handles adquiridos, não buscar credenciais órfãs, preservar envelopes após rollback/retry e convergir uma única vez.

Identidade: enviar pela API uma intenção com mesma operação ou sequência e conteúdo distinto; comprovar recibo original, bloqueio/dependentes, continuidade independente e persistência no reinício. Comparar hash de envelope Unicode calculado em Hermes com Node.

Contas: logout com rádios e adb reverse desligados, recusa de login offline, login B e reentrada online A. Provar isolamento local/remoto, referências obsoletas bloqueadas, pendências e XP sem duplicação.

## Tarefas

| Tarefa | Triagem | Resultado local |
|---|---|---|
| [01 — Cofre](issues/01-provar-retomada-do-cofre.md) | ready-for-agent | Concluída |
| [02 — Abertura](issues/02-provar-abertura-e-rollback.md) | ready-for-agent | Concluída |
| [03 — Identidade](issues/03-provar-identidade-e-recibos.md) | ready-for-agent | Concluída |
| [04 — Contas](issues/04-provar-isolamento-de-contas.md) | ready-for-agent | Concluída |

## Verificação e limites

APK reconstruído e validado como dev.ritmo.httpharness antes de install -r. Checks app typecheck/lint/test e API check integral com casos Android habilitados; driver conserva/restaura rádios e seu reverse. Emulador/painel visíveis apenas nos testes; encerrar os processos iniciados ao terminar, inclusive em falha.

Falhas controladas não comprovam indisponibilidade física do keystore, disco cheio ou corrupção arbitrária. Migration de ensaio não é evolução de schema de produção. Estes testes não incluem UI, iPhone, Resend/links HTTPS ou aceite operacional externo e não encerram M1.

## Resultado

Concluída: sim — os quatro itens aprovados no Android visível; cinco casos nativos e checks integrais aprovados. [Evidências, falha inicial do comparador e limites](../../docs/analises/2026-10-08-excecoes-e-isolamento-android.md). M1 e seus gates restantes continuam abertos.
