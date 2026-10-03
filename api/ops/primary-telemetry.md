# Telemetria privada do primário — contrato local 4B

Concretiza saúde/disco/slot em [REQ-NFR-004/Q42](../../specs/07-nao-funcionais-e-lgpd.md), no [plano aprovado](../../.scratch/recuperacao-operacional/spec.md). Coleta finita e somente de leitura: não remove/avança slot, WAL ou backup, nem relaxa sincronismo.

## Fronteiras e comportamento

Fronteiras já aprovadas: CLI pública, SSH/comando fixo, PostgreSQL real e filesystem/processos/relógio/SMTP externos. C consulta A independentemente de B, com a mesma conta restrita do [transporte](probe-transport.md), chave/pin próprios. B continua vigiando C.

Papel primary: JSON version 1, kind primary, at UTC, database booleano, durable booleano|null, slot objeto|null, storage.data/storage.wal percentuais finitos 0..100. Slot: present/active/healthy/invalidated booleanos, status reserved/extended/unreserved/lost|null e retainedBytes inteiro não negativo|null. Sem consultas, caminhos, endereços, credenciais ou erros de subprocessos. Relatório inválido/antigo não resolve alertas.

Configuração privada associa diretórios reais de dados/WAL ao cluster: system identifier de pg_controldata PG18 local precisa concordar com pg_control_system SQL. Diretório ausente, symlink não resolvido, permissão aberta ou identidade divergente recusa coleta; nenhum fallback para disco raiz. Inventariar mounts do PostgreSQL/Coolify antes de instalar. Dados/WAL no mesmo filesystem podem ter percentuais iguais.

SQL usa ritmo_primary_probe, sem privilégios de aplicação/replicação/administração, TLS verify-full e configuração/passfile root-owned privados. Conceder somente CONNECT e EXECUTE em pg_control_system; demais consultas são configurações/catálogos públicos. Provar em PG18 que não há acesso a tabelas de domínio.

database exige PG18 fora de recovery; durable exige fsync/full_page_writes=on, wal_level=replica, synchronous_commit=on e synchronous_standby_names=FIRST 1 (ritmo_wal). Slot físico permanente ritmo_wal deve estar ativo, ter restart_lsn, status reserved/extended e nenhuma invalidação. retainedBytes é a distância do WAL atual ao restart_lsn: retenção potencial, não tamanho exato de arquivos nem quota. Não provocar checkpoint, recriar/avançar slot ou desligar proteção para tornar coleta verde. Feedback síncrono e supervisão de B continuam separados.

Falha SQL: database=false e durable/slot=null; alertas dependentes de informação ausente são preservados. Falha de transporte/identidade/disco: primary-host após duas coletas. database/durable/slot seguem duas coletas; dados/WAL seguem Q42 80/90%, abertura/agravamento/resolução e dedupe duráveis. Não criar limite de lag/crescimento.

C executa ambas as coletas no mesmo job monitor, estados privados independentes. Probe detector considera o ciclo mais antigo; falta de qualquer estado é ciclo ausente. Agenda/falha continuam visíveis ao watchdog B. Uma agenda, sem duplicação no Coolify. Deadlines SSH/exportador permanecem 10/8 s; comandos PG finitos e stderr descartado.

## Aceite e limites

Provar PG18/filesystem/SSH/sudo/SMTP reais em fixture Linux: retenção cresce após parar consumidor e gerar WAL; coleta nunca avança slot; perda SQL/host não resolve condições desconhecidas; ausência/inatividade/invalidação, sincronismo alterado, identidade divergente, arquivos abertos e payload inválido são sinalizados/recusados. Q42 nos limiares usa filesystem externo controlado; provar dedupe/reinício e entrega local. Asserções de domínio não consultam tabelas privadas.

Instalação A/C, mounts/identidade, TLS/HBA/firewall, alertas recebidos, capacidade/I/O e RPO/RTO externos seguem em 4C/4D. Não encerra M1 nem autoriza configurar VPS.

Fontes primárias, 03/10/2026: [slots PG18](https://www.postgresql.org/docs/18/view-pg-replication-slots.html), [posições/diferença WAL](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADMIN-BACKUP) e [estatísticas/permissões](https://www.postgresql.org/docs/18/monitoring-stats.html).


## Instalação futura no ensaio isolado

A sequência abaixo pertence a 4C; não foi executada nas VPS. Usar o [inventário](external-provisioning.md) e o [procedimento SSH](probe-transport.md) antes de ativar a agenda.

1. Em A, inventariar o container/cluster ativo, PGDATA, o destino resolvido de pg_wal, mounts, UID numérico do PostgreSQL e arquitetura/formato PG18. Instalar clientes PG18 no host para psql/pg_controldata; o probe lê o volume real. Não copiar PGDATA para um diretório de teste e configurá-lo como armazenamento ativo. O system identifier rejeita outro cluster, mas uma cópia histórica do mesmo cluster conserva esse identificador; a conferência do mount ativo é parte obrigatória da instalação.
2. Copiar os Python necessários do pacote para /opt/ritmo, root:root 0644, com ancestrais protegidos. Preparar /etc/ritmo root:root 0700. Usar [primary.example.json](primary.example.json), [primary-env.example.json](primary-env.example.json) e [probe-export.primary.example.json](probe-export.primary.example.json) como modelos para primary.json, primary-env.json e probe-export.json em A, root:root 0600. UID 999 e nomes de exemplo não são dados descobertos do ambiente.
3. Executar [primary-probe-role.sql](primary-probe-role.sql) uma vez como administrador no banco correto, por conexão privada/TLS. Se a role já existir, o script falha; inspecionar sua origem/privilégios antes de reutilizar, sem ignorar esse erro. Provisionar senha pelo canal privado, sem SQL com segredo literal no histórico. HBA limita ritmo_primary_probe ao banco e origem necessários, hostssl com autenticação SCRAM; não conceder grupos de aplicação, REPLICATION, pg_monitor, pg_read_all_stats ou BYPASSRLS.
4. Configurar libpq em A: destino privado e certificado com nome correspondente, PGSSLMODE=verify-full, PGCONNECT_TIMEOUT de 1 ou 2 s, CA protegida e PGPASSFILE root:root 0600. A consulta tem limites de statement 1500 ms/lock 500 ms e processo de 3 s. Não reutilizar a identidade do receiver ou da API. Testar recusa de consulta de domínio com esse login.
5. Criar chave exclusiva C→A e instalar somente sua chave pública na conta ritmo-probe de A, restrita à origem privada de C, sem PTY/forwarding/shell livre. Aplicar o mesmo comando fixo/sudo exato do transporte, validando visudo/sshd antes de reload e conservando gestão administrativa. A chave de gestão do Coolify não substitui essa identidade. Conferir o host pin de A por canal administrativo independente.
6. Em C, instalar [primary-client.example.json](primary-client.example.json) como /etc/ritmo/primary-client.json e sua chave/pin privados, root:root 0600; instalar [fetch-primary](fetch-primary) em /opt/ritmo root:root 0755. Confirmar que /srv/ritmo-monitor é root:root 0700 e persistente. Testar o wrapper: só JSON estrito primary, nunca saída de comandos privados em logs públicos.
7. Parar timer/serviço monitor antes da atualização; preservar state.json e primary-state.json existentes. Instalar a unidade monitor atual, conferir systemd-analyze verify e daemon-reload, executar uma vez e só depois reativar o timer. A unidade executa receptor e primário sequencialmente; cada coleta tem estado próprio. Falha no primeiro comando pode impedir o segundo e mantém falha nativa visível. Não fabricar checked para tornar o ciclo verde.
8. Atualizar os Python do exportador detector em C e provar, via B, que ausência ou idade de qualquer um dos dois estados torna o ciclo ausente/antigo. Manter backup/watchdog em B e monitor em C, sem segunda agenda no Coolify. Inspecionar saúde nativa e reconhecer falha retida somente conforme [linux-scheduling.md](linux-scheduling.md), depois de investigar e corrigir.

Confirmar no ensaio externo os códigos primary-host, primary-database, primary-durability, primary-slot, primary-data-storage e primary-wal-storage. Correlacionar abertura/resolução com mensagens recebidas; NOOP/auth do SMTP não comprova entrega. Falha SQL mantém disco disponível e os demais estados desconhecidos; falha de identidade/caminho recusa a coleta inteira.

## Intervenção e verificação externa

Com disco >=80%, medir produção/retenção de WAL, dependências e capacidade disponível. Com >=90% ou slot não saudável, investigar no canal administrativo e preservar confirmações, cadeia e estado de alertas. Não avançar/apagar/recriar slot, remover WAL manualmente ou baixar sincronismo como rotina de liberação de espaço. A coleta não executa reparos. Indisponibilidade pode manter a API sem confirmar; quarentena/isolar clientes e seguir o [runbook de recuperação](recovery.md) quando a integridade não estiver comprovada.

Provar espaço nos filesystems realmente usados por PGDATA/WAL, crescimento sob consumidor indisponível, montagem após reboot/redeploy e ausência de uma cópia antiga ou segundo primário. Medir a duração das duas coletas e envio SMTP dentro dos 45 s da unidade e da cadência de 60 s; calibrar infraestrutura sem alterar Q42 silenciosamente. Registrar versão/configuração e evidência sanitizada.

[Prova local e limites](../../docs/analises/2026-10-03-telemetria-do-primario.md). Fixtures temporárias não dimensionam disco/I/O da VPS nem aceitam RPO/RTO externos.
