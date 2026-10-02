# Contenção e retomada após recuperação integral

Recorte 1 de [ADR-019](../../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md), REQ-NFR-004, spec/13 §19. O procedimento não comprova sozinho completude pós-base/WAL. API em quarentena protege clientes de uma cópia ainda não validada; a origem/cluster original não pode continuar acessível ao publicar o recuperado.

## Conter antes de iniciar

1. Isolar rede/destino dos clientes, desligar os escritores e processos antigos. Configurar **RITMO_RECOVERY_QUARANTINE=true** antes de iniciar qualquer API sobre dados recuperados. Essa configuração pertence ao ambiente/Coolify, fora do banco restaurado; não existe endpoint de liberação. O valor inválido impede startup; o padrão false serve à operação normal de uma instalação não restaurada, não a uma recuperação.
2. Ao iniciar a API em quarentena, todas as rotas `/api/v1/` devolvem 503 `temporarily_unavailable` m1.1 antes de autenticação, quotas, compatibilidade, leitura do corpo ou SQL de requisição. Não usar 426 para sinalizar recuperação. Não abrir exceções para login, refresh, snapshot, recibos ou push. A conta local ativa conserva leitura/novas intenções; app não limpa SQLite nem transforma acknowledged em pendência.
3. Verificar completude/integridade pelo procedimento da cadeia, migrations/roles/ACLs, contas/credenciais, domínio/XP/recibos/tombstones e isolamento. Verificação HTTP exige instância de validação em ambiente separado e inacessível aos clientes (por exemplo, somente loopback), com processos de publicação ainda fechados. Uma API em quarentena não oferece endpoints públicos de verificação/liberação. Encerrar a instância de validação antes da preparação.

Se a cópia estiver antiga, incompleta ou sua completude não for demonstrada, continuar em quarentena. Dump íntegro não prova recuperação das transações confirmadas depois dele. Nunca liberar estado histórico como integral nem recuperar acknowledged por replay automático.

## Preparar credenciais, com escritores parados

Após comprovar completude, parar também a API em quarentena e instâncias de validação. Carregar conexão administrativa libpq (`PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSFILE` protegido/segredo injetado; nunca senha na linha de comando). Usar dono das três tabelas de credenciais ou superusuário, separados dos logins runtime. Cliente PostgreSQL 18 e shell POSIX; não ler/exportar valores do cofre para documentação/logs.

Da pasta `api/`, com conexão carregada:

```sh
RITMO_RECOVERY_QUARANTINE=true RITMO_RECOVERY_VERIFIED=true sh ops/prepare-recovery.sh
```

`RITMO_RECOVERY_VERIFIED=true` é declaração do operador após verificações, não mecanismo automático de prova nem substituto dos ensaios. O script confere as duas condições e o proprietário/privilégio administrativo, bloqueia as tabelas de credenciais e executa uma transação. Revoga famílias/refresh e consome links antigos sem tocar senha, dados de domínio ou recibos. Falha desfaz todas as alterações; não liberar após falha. É repetível **antes de reabrir**, sem novos escritores entre execuções. Não repetir num servidor já publicado, pois revogaria também suas novas sessões.

## Reabrir com autenticação nova

- Gerar e guardar no cofre externo uma chave **nova e diferente**, com pelo menos 32 bytes, configurada em `RITMO_SIGNING_KEY`; nunca publicar seu valor. Rotação sozinha não invalida hashes de refresh/reset; o script acima também é obrigatório. Preservar a senha correta recuperada.
- Reestabelecer receptor, slot e sincronismo com `RITMO_REQUIRE_WAL=true`, conforme [WAL](wal-recovery.md), antes de liberar clientes. Base/cadeia precisam estar comprovadas; o feedback de flush sozinho não verifica arquivos de base nem retenção.
- Ainda com rede isolada, validar uma instância controlada com chave nova e quarentena false: access/refresh e links antigos recusados; login com senha correta e operações permitidas; nenhum processo com a chave anterior permanece acessível. Confirmar isolamento, domínio/XP/recibos e retomada com cliente local. Parar a validação, ajustar o modo dos processos definitivos e só então liberar acesso dos clientes.
- Access antigo recebe 401; eventual refresh recusado exige login online para o remoto, conservando a conta local ativa. Se o refresh teve resultado incerto/transitório, a política existente pode exigir login sem reutilizar o token; SQLite/pendências permanecem.
- Nova autenticação na mesma conta reabre seu SQLite. Cursor assinado antes da rotação recebe `resync_required`; snapshot integral classifica pendências no corte antes da instalação. Confirmados não voltam à fila. Outra conta não pode ler/enviar o banco preservado.

## Verificação e limites

Testes em `RestoreTests` exercitam HTTP real, script administrativo, SMTP descartável e SQLite reaberto. Executar pelo Gradle com Java 21 e Docker, além dos checks de CLAUDE.md. [Plano e tarefas](../../.scratch/recuperacao-operacional/spec.md).

Este procedimento trata contenção e retomada. [WAL e reconstrução física](wal-recovery.md) acrescentam a prova local pós-base, cauda e timelines. Backup diário, inventário/seleção de alvo, cadeia de 30 dias, detector/e-mail externo, ensaio mensal e RTO real continuam nos incrementos 3/4. Não chamar operação externa de pronta pela existência dessas flags/scripts.
