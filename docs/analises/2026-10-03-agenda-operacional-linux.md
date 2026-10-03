# Agenda operacional Linux — 03/10/2026

Recorte local 4B autorizado por Pedro, derivado de REQ-NFR-004, Q38/Q42, ADR-019 e [tarefa 04](../../.scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md). [Contrato/runbook](../../api/ops/linux-scheduling.md) documentado antes da implementação. Tarefa 04, 4B e M1 continuam abertos.

## Resultado e provas

Dois pares service/timer nativos: backup no receptor e monitor no detector independente, com chamadas por minuto, ativação no boot/Persistent e prazos de execução/parada. Os jobs continuam finitos: tick aplica 03h de São Paulo e uma execução por dia civil corrente. Serviço oneshot/cgroup e lock operacional impedem sobreposição; não se reencena uma execução incerta. Nenhum expurgo nem ensaio local foi ativado automaticamente.

Evidências privadas com publicação atômica/fsync e flock guardam início/término, invocação, boot/relógio monotônico e última falha não reconhecida. Sucesso/no-op não apaga falha nem tentativa cujo término não foi publicado. Reconhecimento administrativo exige parar timer/serviço e fornecer o ID exato. Probe combina evidência com estado/unidade/PID/cgroup nativos; não considera registro antigo prova de execução nova. Monitor valida o campo exigido e preserva incidentes quando ausente/inválido; ausência exige duas coletas e falha de job aparece na próxima, com dedupe/resolução existentes.

Fronteiras aprovadas no plano: CLI pública, processos, clock, armazenamento e transporte. Loop TDD mostrou ausência inicial de unidades/CLI/contrato de Monitor e a lacuna de publicação terminal; implementação acompanhada de provas na mesma intenção. Sem testes de métodos privados ou mocks internos.

| Prova | Evidência local |
|---|---|
| Ativação e exclusão | Timer real, processo finito controlado, segundo Start conserva uma instância |
| Horário perdido | Persistent dispara com timestamp anterior à ativação de calendário; relógio do host permanece intacto |
| Falha anterior ao processo | Executável ausente (203/EXEC), hook final publica resultado sanitizado |
| Sucesso posterior/ack | Falha persiste; ID incorreto recusado; reconhecimento explícito e nova chamada permitem resolver |
| Timeout/filhos | Processo e filho em sessão separada encerrados pelo cgroup; registro de timeout |
| Ausência de publicação | Recibo anterior recusado para tentativa nova; sucesso posterior mantém tentativa sem término como falha |
| Probe/detector | CLI real obtém saúde nativa; serviço monitor finito; regra de duas coletas/imediato/dedupe/campo inválido testada na fronteira clock/email |
| Reinício | Reinício do PID 1 com filesystem preservado ativa timer habilitado; novo sucesso conserva falha anterior |

## Verificações

- App: `pnpm --dir app typecheck`, `lint` e `test`, exit 0; 94/94 testes, sem falhas.
- API: Java21/JBR e `gradlew.bat check --no-daemon`, exit 0; rodada final completa em 7m54s. 64 testes Java: 63 aprovados, 1 Android opt-in ignorado, zero falhas/erros. Inclui ModularityTests, imagem API, supervisão, restauração e WAL reais.
- Operações: 9/9 regras, incluindo agenda/alertas exigidos e dados inválidos.
- Agenda Linux: 5 provas Python pelo teste JUnit da CLI/systemd real, mais reinício do PID 1/boot/falha preservada, todos aprovados. Timeouts controlados de 2s na fixture reservam prazo para registrar término; não alteram deadlines de produção. A coleta aguarda a transição terminal real, evitando confundir publicação em curso com término.
- 21 arquivos UTF-8 sem BOM, AST Python e 107 links locais válidos; `git diff --check` sem erros. Fixtures próprias encerradas e tags descartáveis removidas.

Sintaxe dos quatro arquivos e calendário passou em cópias temporárias 0644 no Ubuntu 24.04 WSL, systemd 255.4-1ubuntu8.16. Exemplo independente: em 03/10/2026 às 05:59 UTC, 03h America/Sao_Paulo corresponde a 06:00 UTC. Não habilitou serviços no WSL. Runtime da fixture usa Linux/amd64, Docker Desktop, systemd 257, Python 3.13, imagem fixada de [fixture](../../api/src/test/fixtures/receiver/Dockerfile). Timers/deadlines/processos controlados mantêm a prova finita; comandos de backup/PG/TLS reais foram verificados nos incrementos anteriores e no check completo.

## Limites e continuação

Não houve contratação, mudança de Coolify, SSH/firewall/segredo real, implantação externa, upload R2 ou envio externo de e-mail. A unidade do detector exige fetch-probe autenticado e SMTP, ainda não provisionados. Não se comprova saúde do próprio detector/canal pela sua própria execução; vigilância independente será integrada no próximo recorte. Sintaxe no Ubuntu não substitui runtime na VPS. Reinício de container não representa corte de energia nem outro kernel/armazenamento. Sincronização do relógio, montagens/UIDs/permissões reais, históricos/capacidade/PITR, RTT/flush e reconstrução integral <=24h permanecem gates externos. Alterações root durante jobs ficam fora do protocolo.

Próximo recorte recomendado: transporte privado autenticado do probe e integração do detector/canal; em seguida proxy/TLS e provisionamento/aceite externo. Fornecedores/orçamento continuam conforme Q47; protótipo Q28 não bloqueia este trabalho.

Fontes primárias: [timers systemd v255](https://raw.githubusercontent.com/systemd/systemd/v255/man/systemd.timer.xml) e [serviços systemd v255](https://raw.githubusercontent.com/systemd/systemd/v255/man/systemd.service.xml), conferidos para Persistent, exclusão, oneshot e hooks de falha. Context7 /systemd/systemd foi consultado; a compatibilidade foi verificada na versão 255 instalada.
