# Provisionamento e aceite externo — REQ-NFR-004, recorte 4

Data: 02/10/2026. Estado: **preparação local; ambiente e custos ainda não definidos**.
Origem: [tarefa 04](../../.scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md), [plano confirmado](../../.scratch/recuperacao-operacional/spec.md), [spec/07 §2.2](../../specs/07-nao-funcionais-e-lgpd.md) e [ADR-019](../../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md).

Este caderno organiza a execução do contrato já aprovado. Não escolhe fornecedor, contrata recurso ou atesta um ambiente real. Q44 confirmou a VPS existente; Q45 solicitou propostas de orçamento e Q46 informou Resend, com cofre ainda a escolher. Q47 escolheu perfil enxuto para artefatos locais, adiando fornecedores/orçamento/contratação e pedindo comparação Hostinger/R2; Q48 escolheu Bitwarden Free cloud. A [proposta concreta](../../docs/analises/2026-10-02-proposta-de-infraestrutura.md) ainda é cotação para comparação; valores de segredos nunca entram aqui.

## 1. Sequência e entregas

| Etapa | Entrega concreta | Dependência / encerramento |
|---|---|---|
| 4A — definição, em andamento | Inventário, orçamento comparável, região, responsáveis e plano de rede/custódia | Ambiente/perfil enxuto/cofre definidos; capacidade/rede e orçamento/fornecedores ainda a fechar |
| 4B — pacote reproduzível | Build Docker da API, configuração privada de PG/receptor, supervisor, agenda, probe e detector; instruções de instalação/retirada | Ambiente Linux/Coolify confirmado; validar os artefatos em ambiente descartável antes de instalar |
| 4C — instalação isolada | Primário, receptor e detector operando com TLS, segredos referenciados, base/cadeia e SMTP | Acessos pelo canal escolhido; nenhuma rota de cliente aberta antes dos gates abaixo |
| 4D — aceite externo | Evidências de agenda/alertas, perdas reais simuladas, recuperação integral, RTO e desempenho | Todos os critérios aprovados; só então planejar a exposição aos clientes |

A tarefa 04 permanece aberta até 4D. Este recorte não encerra M1, Q28/protótipo, interface, distribuição iOS ou aceite no iPhone/Android. Esses gates têm tarefas próprias.

## 2. Inventário e decisões que faltam

O [PRD, ADR-004](../../PRD.md) registra VPS/Coolify já operados por Pedro. Q44 confirmou Hostinger/Campinas-SP, 2 vCPU, 8 GB RAM, 100 GB disco, Ubuntu 24.04 e Coolify 4.3.23. Informação declarada, ainda sem inspeção do host; não presumir capacidade livre nem necessidade de um novo primário.

| Item | Situação conhecida | Informação / evidência a obter |
|---|---|---|
| Primário | Q44: Hostinger/Campinas, 2 vCPU/8 GB/100 GB, Ubuntu 24.04/Coolify 4.3.23 | Conferir arquitetura, disco/RAM/CPU livres, workloads existentes e acesso administrativo |
| Receptor | Deve sobreviver à perda total do primário | Provedor/região e domínio de falha independente; Linux, PG18 clients, fsync durável, disco/IOPS/banda e SLA/limitações do serviço |
| Detector | Fora do primário e do host receptor | Host independente, estado persistente, relógio sincronizado, obtenção restrita do probe e entrega SMTP |
| Reconstrução | Meta total <=24h | Capacidade de criar host de reposição, obter imagens/configurações/segredos e transportar a cadeia depois da perda |
| Rede | PG não exposto à internet | Rota privada entre hosts, nomes/certificados, firewall/HBA, resolução e transporte autenticado dos probes |
| Orçamento | Q45 pediu abordagens/custos; sem teto aprovado | Escolher perfil pela proposta, medir capacidade e comparar custo recorrente/ensaios/tributos |
| Cofre e e-mail | Q46: Resend existente; sem cofre | Q48 escolheu Bitwarden Free cloud; configurar/conferir acesso/recuperação, quota/domínio/remetente/destinatário/SMTP pelo canal privado |
| Deploy pelo repositório | Git local; remoto não definido | Confirmar remoto e método de acesso no Coolify; não criar/publicar repositório por inferência |
| Domínios | Não informados | Nome HTTPS da API e origem de recuperação; DNS e acesso de gestão pelo canal escolhido |

Registrar identificadores operacionais não sensíveis; credenciais, chaves, destinos pessoais e configurações privadas ficam no cofre/canal de provisionamento. Não solicitar exportação do cofre, .env ou .mcp.json. Confirmar que Pedro consegue recuperar o cofre e a conta dos provedores sem depender de nenhum dos servidores perdidos.

## 3. Topologia e conexões

| Origem → destino | Finalidade e restrição |
|---|---|
| Cliente → proxy Coolify → única API | HTTPS/TLS e HSTS; API inacessível diretamente pela internet; só o proxy observado pode fornecer identidade encaminhada |
| API/Flyway → PostgreSQL primário | Rede privada do primário; logins distintos de domínio, identidade e migrations; uma URL de cluster comum |
| Receptor → PostgreSQL primário | Rede privada entre hosts, TLS verify-full e CA confiável; login operacional dedicado, HBA restrito, WAL síncrono e captura da base/dump |
| Detector → receptor | Transporte autenticado e restrito; programa finito devolve só JSON do probe; timeout e host key/certificado conferidos |
| Detector → SMTP | STARTTLS e validação do certificado; credencial privada; mensagens apenas com códigos operacionais |
| Operador → hosts/cofre/provedores | Gestão restrita e recuperável; operador consegue parar/inibir receiver e isolar clientes antes de congelar arquivos |
| Verificador independente → detector | Watchdog nativo em B consulta C por SSH restrito e usa SMTP alternativo independente; validar canal/independência/recebimento reais conforme [contrato](probe-transport.md) |

Uma bridge Docker só resolve comunicação dentro do mesmo host. Uma porta pública de PG restrita por senha não cumpre a política de não exposição. O enlace privado entre hosts e a identidade TLS precisam ser definidos antes de preencher configurações. Conservar backups físicos/WAL privados: eles abrangem o cluster e não são protegidos por RLS como consultas de usuários.

O receptor não hospeda um segundo PostgreSQL completo aplicando WAL continuamente. Um banco temporário de ensaio/restauração é criado de forma isolada quando necessário. A perda simultânea do primário e da cópia independente está fora do cenário Q33; não colocar ambos no mesmo host/volume nem tratar diretórios separados como independência física.

## 4. Dimensionamento e proposta de custos

Medir no ambiente de ensaio: tamanho de uma base física completa, dump custom, WAL produzido por dia e por pico, espaço de staging/falha, duração de backup e transferência. A barreira gera marcadores inclusive em leituras; quantidade de usuários ou idade do último WAL não substitui medição. O tamanho lógico do banco não equivale automaticamente ao tamanho dos arquivos retidos.

Para a capacidade do receptor, somar:

```text
bases físicas publicadas retidas (âncora + posteriores)
+ dumps lógicos retidos (âncora + posteriores)
+ WAL desde o menor Start-LSN das bases retidas, caudas e históricos
+ pico de staging de uma execução e arquivos incompletos preservados
+ cópias congeladas necessárias ao ensaio/incidente
+ sistema, ferramentas, eventos e margem operacional
```

A rotina conserva bases completas diárias: orçamento de uma única cópia do banco é insuficiente. Usar o catálogo para contar os pacotes retidos; a âncora pode preceder 30 dias e execuções falhas/órfãs não são limpas automaticamente. Reservar espaço antes de congelar base e WAL, pois a cópia não é um hardlink para a fonte mutável. Dimensionar para permanecer abaixo do aviso de 80% no uso normal e registrar a hipótese de crescimento; não apagar a cadeia para caber numa quota. A política de expurgo está em [operations.md](operations.md).

No primário, medir também o WAL retido pelo slot quando o receptor fica indisponível. Definir monitoramento de disco/slot e procedimento de intervenção; remover/invalidar o slot ou baixar o sincronismo para liberar espaço não é uma recuperação que preserve Q33. O probe atual mede disco do receptor, não disco do primário.

| Parcela da proposta | O que incluir |
|---|---|
| Primário existente | Capacidade adicional necessária e efeito nos workloads; separar custo já pago de incremento |
| Receptor | Compute, armazenamento durável, tráfego, snapshots auxiliares, impostos/moeda e margem de crescimento |
| Detector | Host, persistência de estado, SMTP e mecanismo independente de heartbeat |
| Rede/custódia/domínio | Serviços privados, DNS/certificados, cofre e e-mail existentes ou adicionais |
| Ensaio e incidente | Host temporário, disco para cadeia/PGDATA, transferência, rebuild; orçamento pontual além do mensal |

Q45 solicitou uma recomendação; preços/data/fontes e condições comerciais estão na [proposta](../../docs/analises/2026-10-02-proposta-de-infraestrutura.md), com fornecedores/orçamento final adiados por Q47. Comparar latência real primário↔receptor: o destino participa da confirmação HTTP. Não escolher uma região apenas pelo menor preço, nem prometer RTO sem banda e capacidade de reposição comprovadas.

## 5. Contrato de instalação

Instalação Linux; Python 3.11+ com IANA tzdata, clientes PostgreSQL 18 e coreutils. PostgreSQL do mesmo formato/arquitetura usado pela base; segmentos WAL de 16 MiB e sem tablespaces adicionais. Registrar versões/digests verificados e commit da aplicação; não usar tag latest. A [pesquisa de referências](../../docs/analises/2026-10-02-referencias-provisionamento-externo.md) orienta o pacote 4B e não substitui ensaio.

O pacote local começa pela [imagem da API](container-deployment.md): contexto na raiz, cópias explícitas e exclusão de segredos/bancos/builds locais. Inclui contracts/primeiro-marco/openapi.json, consumido por processResources a partir de ../contracts, e migrations. A imagem é ensaiada com PG real e HTTP. Checks completos fora do build continuam obrigatórios. A configuração externa de rede/proxy/supervisão/agenda/transporte continua pendente; a imagem não os substitui.

| Componente | Condições antes de seguir |
|---|---|
| PG/roles | bootstrap-roles.sql antes de Flyway; runtime sem SUPERUSER/BYPASSRLS/ownership nem memberships combinadas; migration owner com visibilidade necessária à função operacional V4 |
| Replicação | fsync/full_page_writes on, wal_level replica, synchronous_commit on e FIRST 1 (ritmo_wal); slot físico ritmo_wal criado antes da base; >=3 WAL senders; login ritmo_wal_receiver dedicado |
| API | Uma instância; RITMO_REQUIRE_WAL=true; datasources no mesmo cluster; chave externa >=32 bytes; quarentena e bloqueio de rede durante instalação/recuperação |
| JDBC/proxy | connectTimeout/socketTimeout finitos e iguais na URL compartilhada; calibrar com RITMO_WAL_WAIT_MS e limites do proxy; timeout não prova rollback do COMMIT |
| Proxy/IP | Política explícita para os peers observados, remoção/tratamento de cabeçalhos forjados e impossibilidade de acesso direto; validar quotas por clientes distintos |
| Receptor | Usuário/diretórios privados, pg_receivewal --synchronous, identidade de processo verificada, restart supervisionado e procedimento verificável de parada/inibição |
| Jobs | tick pelo menos a cada minuto para 03:00 America/Sao_Paulo; lock e eventos persistidos, falha detectável; backup explícito para repetição incerta; expurgo revisado antes de --apply |
| Probe/monitor | JSON operacional restrito, relógios corretos, timeout, Q42 e estado persistente no detector; testar atraso/ausência de agenda e perda de hosts |
| Cofre/SMTP | libpq JSON/PGPASSFILE e SMTP JSON privados; nomes/referências em docs, valores pelo cofre; confirmar restauração do acesso e recebimento de alertas |

Os nomes reais de variáveis da API estão em [application.properties](../src/main/resources/application.properties); os jobs usam [operations.md](operations.md). Não misturar secrets de build com secrets de runtime. Os grupos/ACLs, arquivos de configuração e rotinas de custódia devem ser reconstruíveis além do dump.

A configuração atual ignora cabeçalhos encaminhados (server.forward-headers-strategy=none). Ainda não há allowlist configurada/ensaiada do proxy. Não trocar por confiança irrestrita: atrás do proxy a política atual agrega clientes, e o uso de IP arbitrário permite contornar quotas. A solução 4B depende da rede e da versão de Coolify/Tomcat confirmadas.

O receiver-state é um executável operacional que devolve exatamente running ou stopped depois de verificar unidade/processo e comando correto. Um PID ou arquivo booleano isolado não basta. Freeze exige parada efetiva e restart inibido durante a cópia, além de quarentena real de clientes. A flag não faz isolamento por conta própria.

## 6. Ordem de ativação em rede isolada

1. Registrar inventário/revisão, referências de cofre, responsáveis e orçamento. Conferir recuperação das contas de gestão e acesso às configurações após perda dos hosts.
2. Preparar rede privada, TLS/CA/nomes, firewall/HBA e destino independente; verificar que PG/API interna não são alcançáveis pela internet. Separar gestão de tráfego de clientes.
3. Provisionar PG e papéis administrativos/runtime com clientes bloqueados. Criar a identidade operacional/slot e conectar o receptor antes de transações que dependam de sincronismo. Não expor um PG com proteção provisoriamente incompleta.
4. Ativar a configuração síncrona exigida; iniciar a API isolada com proteção WAL e quarentena; conferir Flyway V1–V4 e ausência de privilégios indevidos. Migração pode esperar o receptor: não resolver espera desligando a proteção num ambiente aberto.
5. Capturar/publicar base física e dump, verificar identidade/cadeia, instalar supervisor/agenda, detector e SMTP. Confirmar inventário, eventos, relógios e alertas Q42. O sucesso de uma base não comprova a cauda posterior.
6. Executar os gates e ensaios abaixo com dados fictícios e instância de validação acessível só pela rede de ensaio. API de clientes permanece bloqueada; encerrar a instância de validação ao terminar.
7. Revisar a evidência externa e a capacidade de operação com Pedro. Preparar a configuração definitiva; liberação aos clientes é uma etapa explícita posterior ao aceite. Nunca apresentar snapshot histórico como recuperação integral.

Se o primário existente já contiver dados reais, planejar separadamente a janela/backup e a mudança reversível antes de modificar esse serviço. Não executar a perda de host do ensaio sobre o ambiente pessoal existente.

## 7. Matriz de aceite externo

Cada linha requer data, configuração/commit, executor, resultado e referência sanitizada à evidência. Deixar pendente se não foi exercitada. Não copiar credenciais, dumps, payloads, IPs de clientes ou links reais para o relatório.

| Gate | Prova exigida / condição de sucesso |
|---|---|
| Independência | Primário encerrado/inacessível; receptor e detector continuam acessíveis por gestão independente; cadeia/segredos necessários continuam recuperáveis |
| TLS/rede/proxy | Certificados verificados/renovação operacional, HTTPS/HSTS; PG sem acesso público; API sem caminho direto; cabeçalhos forjados não criam identidade livre para quotas |
| Base/identidade/ACLs | Manifest e base aprovados, cadeia/cluster corretos; Flyway/roles/RLS recompostos; runtime sem grants operacionais indevidas |
| Confirmação síncrona | Ausência/desconexão/disco cheio no receptor recusam publicação; timeout/cancelamento/consulta de recibo/replay não confirmam só estado local; retorno do receiver permite convergência sem efeito duplicado |
| Supervisor | Parada verificada e restart inibido impedem escrita no congelamento; restart normal reconecta preservando parcial/história/slot; processo errado nunca é aceito como receiver |
| Agenda | Ciclo real às 03:00 de São Paulo, horário perdido retomado uma vez, falha independente de base/dump, crash/execução ausente detectáveis; último sucesso não substituído por falha |
| Expurgo | Plano preserva âncora/base/WAL/caudas/históricos; gap/corrupção recusam deleção; staged/frozen preservados; medir uso real e tendência |
| Janela PITR | Catalogar início realmente disponível; restaurar instante histórico isolado coberto pela âncora/WAL; não alegar 30 dias antes de acumular esse histórico |
| Alertas | Mensagem recebida para abertura/agravamento/resolução, dedupe após restart, duas falhas a 60s, >26h, falha de job na próxima coleta, 80/90%; host do receptor ausente e detector/canal monitorados |
| Desempenho/timeouts | Medir p50/p95/p99 e falhas no caminho HTTPS→API→PG→WAL remoto; calibrar espera/socket/proxy; registrar carga, RTT, volume de WAL, backup simultâneo e custo; ainda não há um limite de p95 remoto aprovado |
| Reconstrução integral/RTO | Perda do primário de ensaio, novo host/PGDATA, cauda/timeline derivadas no receptor sem consultar a origem; credenciais antigas inválidas, login novo e dados/SQLite corretos; duração total <=24h |
| Mensal/major | Agenda/responsável para repetir o ensaio integral mensal e por major; prova local do job drill não renova aceite externo por si só |

O monitor atual não verifica saúde da própria máquina/canal nem espaço do PG primário. Essas integrações são entregas de 4B/4C e exigem provas próprias; não marcar esses itens como atendidos pela existência de operations.py. A duração da base, do expurgo e do fetch deve ser compatível com a cadência dos jobs e com os timeouts medidos.

Na instalação nova, medir o histórico disponível e ensaiar o intervalo já coberto. A janela de 30 dias é um gate progressivo; não inventar histórico nem fechar a linha por ter configurado retenção=30.

## 8. Ensaio integral e registro de evidência

Usar primário de ensaio descartável com a mesma configuração candidata. Antes da perda, capturar a base e só depois criar contas fictícias, alterar senha, criar/marcar/excluir hábitos, conceder/reverter XP e perder respostas após commit. Verificar essas operações pelas interfaces HTTP/Session/AccountStore; preservar um SQLite fechado/reaberto com confirmações e novas intenções pendentes, além de segundo cliente/conta para isolamento.

1. Marcar T0 em relógio fora do primário: incidente simulado e detecção. Registrar identificação da prova; não usar conteúdo de usuário como evidência.
2. Tornar o primário realmente indisponível no domínio de falha escolhido. Não usar um container no mesmo host como substituto dessa prova. Bloquear escritores/clientes e preservar a cópia independente.
3. Parar/inibir o receptor, verificar sua identidade/parada, executar freeze e conservar inventário/alvo completo derivado unicamente da base/WAL remotos. Falha de cauda/CRC/história mantém o bloqueio; não diminuir o alvo.
4. Reconstruir outro host, obter versões/configurações/cofre, transportar pacote verificado, preparar PGDATA novo e iniciar replay pausado. Cronometrar todas essas etapas, não só pg_restore.
5. Conferir alcance do alvo, timeline, completude/ACLs/migrations e API isolada. Reestabelecer slot/receptor/proteção e invalidar sessões/links com chave nova conforme [recovery.md](recovery.md); encerrar processos antigos/de validação.
6. Provar access/refresh/links antigos recusados, senha vigente correta, recibos/replay/tombstones/XP preservados, pendências locais sincronizadas sem recriar acknowledged e isolamento entre contas. Usar as fronteiras públicas, sem consulta de tabelas privadas como oráculo de negócio.
7. Registrar verificação/liberação somente do ambiente de ensaio e Tfinal. Duração= Tfinal−T0 inclui reconstrução, transferência, replay, validação e reabertura; sucesso se <=24h e todos os gates passarem.
8. Preservar relatório sanitizado, inventário/referências privados e limitações; destruir apenas recursos descartáveis explicitamente identificados. Não remover evidências/cadeia válidas para reduzir custo ou espaço.

Modelo do relatório externo, a preencher após execução:

```text
Estado: pendente | aprovado | reprovado
Ambiente de ensaio / commit / versões / referências de configuração:
Independência e cenário de perda demonstrados:
T0 incidente; detecção; reconstrução; pacote; replay; validação; Tfinal:
Duração total e resultado RTO <=24h:
Cluster/base/alvo/timeline (metadados operacionais, sem payload):
Interfaces públicas/cenários e isolamento verificados:
Credenciais antigas invalidadas / nova chave referenciada no cofre:
Agenda, janela realmente disponível, alertas recebidos e dedupe:
Desempenho/volume/capacidade medidos e timeouts escolhidos:
Gates ainda pendentes e motivo de manter o ambiente isolado:
Executor e referência sanitizada à evidência:
```

## 9. Bloqueios atuais e próximo passo

Q44 e o uso existente de Resend foram confirmados. Perfil enxuto e Bitwarden Free estão escolhidos. Próximo passo autorizado: preparar/testar os artefatos locais 4B; comparar Hostinger/R2 e fechar capacidade/rede/custódia/remoto/domínios/acessos e orçamento antes da contratação/instalação. Este caderno e a pesquisa são preparo revisável, não uma configuração instalada ou prova de RPO/RTO externo.

## Segunda VPS no Coolify existente — guia proposto

O [guia de cadastro e operação](coolify-remote-server.md), solicitado por Pedro em 03/10/2026, explica SSH/chaves, portas, destino dos recursos, persistência e gestão após perda do painel. Cadastrar um Server não cria rede privada entre hosts, failover ou réplica de dados. A [pesquisa oficial](../../docs/analises/2026-10-03-referencias-coolify-multiplos-servidores.md) sustenta o procedimento; menus/configuração instalados ainda precisam ser conferidos.

Recomendação documental: manter acesso administrativo independente e supervisão/agenda críticos no próprio host; alternativa de receiver Compose gerenciado pelo Coolify requer identidade e bloqueio de start/redeploy/reboot durante freeze. O recorte local 4B adotou e verificou supervisão e agenda nativas; transporte/detector têm prova local; [proxy/TLS](proxy-activation.md) também têm pacote/prova locais; instalação e aceite externo continuam pendentes. Este guia não aprova fornecedor/contratação/instalação externa. Nenhum cadastro, chave, firewall, serviço ou deployment remoto foi executado.

03/10/2026 — pacote local de supervisão: [receiver-supervision.md](receiver-supervision.md) implementa o serviço nativo fora do ciclo Compose/Coolify e seu protocolo de Stop/inibição/retomada/congelamento. [Ensaios locais](../../docs/analises/2026-10-03-supervisao-do-receptor-wal.md) não aceitam instalação/agenda externa, capacidade, independência física ou RTO. Registrar caminho de controle/locks/unidade e permissões no ensaio externo; impedir alteração desses artefatos enquanto houver freeze.


03/10/2026 — agenda local 4B: [linux-scheduling.md](linux-scheduling.md) fornece os pares nativos de backup (B) e detector (C), com instalação/pausa/evidência/ack, excluindo duplicata no Coolify. [Provas locais](../../docs/analises/2026-10-03-agenda-operacional-linux.md) não substituem instalação no Ubuntu remoto, transporte/SMTP/canal independente, ensaio integral mensal/major ou RTO. Registrar persistência de /var/lib/ritmo-jobs e /var/lib/systemd/timers, time sync, timer ativo e probe exigindo saúde da agenda. Continuação local: transporte privado autenticado/provas do detector, depois proxy/TLS. 4B/4C/4D permanecem abertos.

03/10/2026 — transporte/detector local 4B: [pacote/runbook](probe-transport.md), [evidência](../../docs/analises/2026-10-03-transporte-privado-do-probe.md). Acrescentar ao inventário chaves exclusivas por direção, host pins conferidos, arquivos protegidos e SMTP alternativo independente do Resend principal; provedor/quota/entrega/custódia ainda a definir e aceitar. Watchdog de B verifica C; C exige saúde do watchdog de B. Instalar/validar ambos no ensaio isolado; não duplicar no Coolify. Sintaxe Ubuntu local e fixture Linux não aceitam rede/firewall/sshd/TLS/SMTP reais nem RTO. Próximo incremento local: proxy/TLS/origem confiável; disco/slot primário e demais gates continuam abertos.

03/10/2026 — proxy/TLS local 4B: [fronteira de confiança](proxy-tls.md), [fragmentos e aplicação futura no Coolify](proxy-activation.md), [prova local](../../docs/analises/2026-10-03-proxy-tls-e-origem-confiavel.md). Acrescentar ao inventário rede exclusiva, peer TCP observado, allowlist exata, sanitização de headers e certificado/resolver/rotas reais. API/PG não publicam portas; configuração inválida falha no startup; HSTS vale nos erros. Preservar rotas/mounts/entrypoints do painel ao integrar os exemplos. Próximo incremento local: telemetria privada de disco/slot do primário e impacto da retenção WAL. Domínio/DNS/ACME, latência/WAL, independência/canais reais, janela e RTO continuam no aceite; 4B/4C/4D abertos.
