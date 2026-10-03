# Provisionamento e aceite externo

Status: in-progress (artefatos locais; contratação/aceite externo ainda dependem de informação)
Dependência técnica: 03-operar-backups-e-alertas.md concluída localmente; faltam definições/acessos de provisionamento.

Origem: [plano confirmado](../spec.md), REQ-NFR-004 e [ADR-019](../../../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md).

## Critérios de aceite

Definir fornecedor/custo/capacidade e acessos com Pedro após prova local; configurar TLS/proxy/Coolify/destino/cofre/e-mail/detector. Comprovar agenda, alertas, restauração integral e RTO no ambiente real antes de exposição.

## Fronteiras e validação

HTTP/Session/AccountStore públicos, SQLite/PostgreSQL reais e fronteiras operacionais externas, aprovadas com o plano. Testes de negócio não consultam tabelas privadas. Checks de CLAUDE.md e relatório com limites obrigatórios. Sem UI provisória, compra ou publicação externa por inferência.

## Resultado

Concluída: não.

## Comments

02/10/2026: plano confirmado; executar respeitando dependências. Somente o recorte 1 foi iniciado.

02/10/2026: recorte 3 concluído; esta é a próxima tarefa recomendada. [Evidência](../../../docs/analises/2026-10-02-ciclo-operacional-de-backups.md) e [runbook/configurações](../../../api/ops/operations.md). Definir com Pedro, sem solicitar valores de segredos: destino e host do detector independentes, capacidade/custos/região, acesso/estado da VPS/Coolify, cofre e recuperação do acesso, destinatário/SMTP e transporte autenticado dos probes. Depois configurar supervisor (verificação de identidade do receiver/parada/inibição de restart), agenda, cronômetro externo, TLS/proxy/timeouts e capacidade/retencão. Provar alerta/ausência de execução/perda dos hosts, janela recuperável e reconstrução integral <=24h; medir desempenho da barreira antes de expor. Ferramentas são Linux/PG18/16MiB; recusa conservadora de cauda ambígua deve ser validada no ensaio real. A memória e os logs não recebem credenciais/dumps/dados pessoais. Não comprar/publicar por inferência.


## Preparação do recorte 4 — 02/10/2026

Continuação autorizada por Pedro. [Caderno de provisionamento/aceite](../../../api/ops/external-provisioning.md): inventário e dependências, orçamento/capacidade, topologia privada, instalação ordenada, matriz de gates e registro cronometrado do ensaio externo. [Referências técnicas oficiais](../../../docs/analises/2026-10-02-referencias-provisionamento-externo.md).

| Etapa | Estado |
|---|---|
| 4A — ambiente/custos/rede/custódia | Ambiente declarado, perfil A enxuto/Bitwarden Free/Resend definidos; fornecedores/orçamento final adiados |
| 4B — pacote de implantação testado | Imagem API e supervisão nativa verificadas localmente; agenda/transporte/proxy ainda pendentes |
| 4C — instalação isolada | Pendente de proposta/acessos definidos |
| 4D — aceite externo/RTO | Pendente; prova local não substitui o ambiente real |

Respostas [Q44–Q46](../../fundacao/entrevista.md): Hostinger/Campinas, 2 vCPU/8 GB/100 GB, Ubuntu 24.04/Coolify 4.3.23; Q45 solicitou recomendação sem aprovar teto; Resend já usado, cofre a escolher. [Proposta concreta](../../../docs/analises/2026-10-02-proposta-de-infraestrutura.md) registra Q47: perfil A/artefatos locais primeiro, fornecedores/orçamento depois e comparação Hostinger/R2; Q48: Bitwarden Free cloud escolhido. Nenhum fornecedor adicional ou orçamento foi tratado como aprovado. Remoto Git/domínios/acessos também continuam a confirmar na etapa de instalação.

A revisão identificou dependências concretas: build precisa incluir contracts pela raiz do repositório; confiança do proxy ainda está desligada; probe atual mede disco do receptor e não saúde do próprio detector/SMTP ou disco/slot do primário. Essas integrações precisam de implementação e provas na operação externa. Detector DigitalOcean tem restrição SMTP 25/465/587: alternativa Resend 2587 documentada, mas acesso/entrega real ainda a aceitar. Registrar catálogo/histórico real para não afirmar uma janela retroativa inexistente. [Relatório do preparo e limites](../../../docs/analises/2026-10-02-preparacao-do-provisionamento.md). Contratação/aceite externo ainda dependem de informação; Concluída: não permanece.


02/10/2026 — 4B, imagem API: [Dockerfile/contrato local](../../../api/ops/container-deployment.md) e exemplo de runtime sem segredos; contexto restrito na raiz, Java 21 fixado, JAR com contrato/Flyway, UID 10001 e WAL/quarentena ativos por padrão. Build Docker/PG18/HTTP passou, assim como checks completos: app 94/94; API 59 aprovados/1 Android opt-in ignorado; operações 8/8. [Evidência e limites](../../../docs/analises/2026-10-02-imagem-de-implantacao-da-api.md). Próximo incremento local: supervisão real do receiver e parada/inibição de restart; em seguida agenda/transporte/proxy. Sem contratação, deploy ou upload R2. A etapa 4B permanece aberta, com Concluída: não.


02/10/2026: Pedro pediu analisar a HostGator. [Análise](../../../docs/analises/2026-10-02-analise-hostgator.md) e [comparação atualizada](../../../docs/analises/2026-10-02-proposta-de-infraestrutura.md): catálogo atual VPS NVMe/Oracle Cloud Brasil, root/SO Simples e preços de promoção/renovação por ciclo conferidos. NVMe 4 entra como candidato condicional a receptor; região real, independência, cadeia/capacidade/I/O, RTT/flush, banda e SMTP continuam gates de ensaio. Nenhum orçamento/fornecedor foi aprovado, nem recurso adquirido. Continuação local 4B permanece supervisão/parada do receiver.

03/10/2026: Pedro solicitou documentar uma segunda VPS como Server do Coolify existente. [Guia](../../../api/ops/coolify-remote-server.md) e [fontes oficiais](../../../docs/analises/2026-10-03-referencias-coolify-multiplos-servidores.md) cobrem SSH/chaves, rede/portas, deploy no destino, persistência e perda do controller. Proposta híbrida com supervisor/agenda críticos independentes; alternativa Compose exige bloqueio de start/redeploy além de Stop/restart policy. Escolha de empacotamento e provas seguem abertas em 4B; sem compra/configuração/deploy/atualização remotos. Concluída: não.

03/10/2026 — 4B, supervisão: Pedro autorizou implementar o próximo incremento. [Pacote nativo](../../../api/ops/receiver-supervision.md) e [evidência/limites](../../../docs/analises/2026-10-03-supervisao-do-receptor-wal.md): unidade real, supervisor/filho/UID/cgroup/trava verificados, inibição fsyncada antes de Stop e exclusão durante todo o freeze, reconexão/crash, Start/reboot, writer externo/impostor e erro de armazenamento com intervenção. Prova Linux local, sem implantação remota. Continuação: agenda Linux; depois transporte privado autenticado/proxy e provas do detector. 4B/tarefa 04 permanecem abertos; Concluída: não.
