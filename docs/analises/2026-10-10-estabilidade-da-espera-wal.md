# Espera estável da durabilidade na fixture WAL

Data: 10/10/2026. Escopo: WalRecoveryTests; [ADR-019](../adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md), [contrato M1 §20](../../specs/13-contrato-primeiro-marco.md). Ajuste do ensaio identificado durante o check integral do recorte de interface 04; código operacional, filtro da API, migrations e contratos não foram alterados.

O check integral terminou com timeout de 15 s na espera posterior ao restore point da segunda timeline. O mesmo cenário isolado passou sem alterações. A condição consultava ritmo_wal_status(null) em cada tentativa, emitindo uma nova mensagem WAL e usando a nova posição como alvo. A função pg_logical_emit_message produz uma posição para a mensagem emitida; seu flush local não substitui a confirmação do receptor. [Documentação do PostgreSQL](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-REPLICATION).

Um diagnóstico temporário no mesmo cenário, com PostgreSQL e pg_receivewal reais, comparou vinte posições novas com uma posição fixa. Quatorze consultas novas retornaram durable=false; todas as vinte consultas à posição fixa retornaram durable=true. Foram vinte alvos distintos no primeiro caminho e um no segundo. O cenário completo também passou nessa rodada. Isso evidencia uma corrida na condição da fixture: o receptor pode ter confirmado o alvo anterior enquanto a consulta seguinte já cobra outro. Não é prova de falha do receptor em produção.

A fixture captura a posição uma vez e consulta a confirmação dessa posição até o mesmo limite de 15 s, conforme o comportamento já existente em WalDurabilityFilter. O helper atende o primário e os bancos restaurados nas duas timelines. O diagnóstico de timeout também conserva o alvo e inclui estado/posição de flush do receptor; não emite outro marcador ao explicar a falha. As verificações de ausência de receptor, armazenamento cheio, commit incerto, recibos, XP, recuperação física e isolamento permanecem no ensaio.

Reprodução na pasta api, com Java 21 e Docker disponíveis:

```powershell
.\gradlew.bat test --tests 'dev.ritmo.WalRecoveryTests.independentPhysicalBaseAndPartialWalRestorePostBaseConfirmationsAfterPrimaryLoss' --no-daemon
.\gradlew.bat check --no-daemon
```

Validação integral após a correção: ./gradlew.bat check --no-daemon aprovado no checkout com o recorte de interface 04 em andamento. As cinco verificações WalRecoveryTests passaram, incluindo duas perdas/timelines e recusa sem durabilidade. O check também aprovou os demais JUnit e os testes operacionais Python. Nenhum prazo ou critério foi relaxado.

A instrumentação DEBUG-wal-marker foi removida das fontes; o diagnóstico e os logs temporários ficam no diretório ignorado .scratch/runtime/interface-sync. A falha preliminar do coletor PrimaryTelemetryTests teve origem não comprovada e não motivou mudança no coletor/teste. O ajuste foi identificado durante o aceite local da [interface de resultados de sincronização](../../.scratch/interface-m1/issues/04-estados-de-sincronizacao.md). A prova local continua limitada: RPO/RTO, independência dos hosts e operação externa permanecem nos gates existentes.
