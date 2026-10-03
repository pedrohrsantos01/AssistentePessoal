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
| 4B — pacote de implantação testado | Imagem API, supervisão, agenda, transporte/detector, proxy/TLS e telemetria primária verificados localmente no escopo atual; instalação/aceite em 4C/4D |
| 4C — instalação isolada | Pendente de proposta/acessos definidos |
| 4D — aceite externo/RTO | Pendente; prova local não substitui o ambiente real |

Respostas [Q44–Q46](../../fundacao/entrevista.md): Hostinger/Campinas, 2 vCPU/8 GB/100 GB, Ubuntu 24.04/Coolify 4.3.23; Q45 solicitou recomendação sem aprovar teto; Resend já usado, cofre a escolher. [Proposta concreta](../../../docs/analises/2026-10-02-proposta-de-infraestrutura.md) registra Q47: perfil A/artefatos locais primeiro, fornecedores/orçamento depois e comparação Hostinger/R2; Q48: Bitwarden Free cloud escolhido. Nenhum fornecedor adicional ou orçamento foi tratado como aprovado. Remoto Git/domínios/acessos também continuam a confirmar na etapa de instalação.

A revisão identificou dependências de build/contracts, proxy e cobertura dos probes. Os incrementos locais de 4B trataram essas integrações; configuração, capacidade e provas remotas permanecem em 4C/4D. Detector DigitalOcean tem restrição SMTP 25/465/587: alternativa Resend 2587 documentada, mas acesso/entrega real ainda a aceitar. Registrar catálogo/histórico real para não afirmar uma janela retroativa inexistente. [Relatório do preparo e limites](../../../docs/analises/2026-10-02-preparacao-do-provisionamento.md). Contratação/aceite externo ainda dependem de informação; Concluída: não permanece.


02/10/2026 — 4B, imagem API: [Dockerfile/contrato local](../../../api/ops/container-deployment.md) e exemplo de runtime sem segredos; contexto restrito na raiz, Java 21 fixado, JAR com contrato/Flyway, UID 10001 e WAL/quarentena ativos por padrão. Build Docker/PG18/HTTP passou, assim como checks completos: app 94/94; API 59 aprovados/1 Android opt-in ignorado; operações 8/8. [Evidência e limites](../../../docs/analises/2026-10-02-imagem-de-implantacao-da-api.md). Próximo incremento local: supervisão real do receiver e parada/inibição de restart; em seguida agenda/transporte/proxy. Sem contratação, deploy ou upload R2. A etapa 4B permanece aberta, com Concluída: não.


02/10/2026: Pedro pediu analisar a HostGator. [Análise](../../../docs/analises/2026-10-02-analise-hostgator.md) e [comparação atualizada](../../../docs/analises/2026-10-02-proposta-de-infraestrutura.md): catálogo atual VPS NVMe/Oracle Cloud Brasil, root/SO Simples e preços de promoção/renovação por ciclo conferidos. NVMe 4 entra como candidato condicional a receptor; região real, independência, cadeia/capacidade/I/O, RTT/flush, banda e SMTP continuam gates de ensaio. Nenhum orçamento/fornecedor foi aprovado, nem recurso adquirido. Continuação local 4B permanece supervisão/parada do receiver.

03/10/2026: Pedro solicitou documentar uma segunda VPS como Server do Coolify existente. [Guia](../../../api/ops/coolify-remote-server.md) e [fontes oficiais](../../../docs/analises/2026-10-03-referencias-coolify-multiplos-servidores.md) cobrem SSH/chaves, rede/portas, deploy no destino, persistência e perda do controller. Proposta híbrida com supervisor/agenda críticos independentes; alternativa Compose exige bloqueio de start/redeploy além de Stop/restart policy. Escolha de empacotamento e provas seguem abertas em 4B; sem compra/configuração/deploy/atualização remotos. Concluída: não.

03/10/2026 — 4B, supervisão: Pedro autorizou implementar o próximo incremento. [Pacote nativo](../../../api/ops/receiver-supervision.md) e [evidência/limites](../../../docs/analises/2026-10-03-supervisao-do-receptor-wal.md): unidade real, supervisor/filho/UID/cgroup/trava verificados, inibição fsyncada antes de Stop e exclusão durante todo o freeze, reconexão/crash, Start/reboot, writer externo/impostor e erro de armazenamento com intervenção. Prova Linux local, sem implantação remota. Continuação: agenda Linux; depois transporte privado autenticado/proxy e provas do detector. 4B/tarefa 04 permanecem abertos; Concluída: não.


03/10/2026 — 4B, agenda Linux: incremento autorizado por Pedro. [Contrato/pacote nativo](../../../api/ops/linux-scheduling.md) e [evidência local](../../../docs/analises/2026-10-03-agenda-operacional-linux.md): pares service/timer de backup e detector, chamadas por minuto/Persistent/boot e exclusão, deadlines/cgroup, início/término privado/fsync/flock, falha retida e ack exato. CLI/probe detectam timer parado/evidência ausente; detector aplica duas coletas ou falha imediata e dedupe. Teste adicional fecha publicação terminal ausente, que não pode desaparecer num sucesso posterior. Sem instalação remota/SMTP real. Continuação: transporte privado autenticado do probe e integração do detector/canal; depois proxy/TLS e provisão/aceite externos. 4B/tarefa 04/M1 continuam abertos; Concluída: não.

03/10/2026 — 4B, transporte privado e detector: incremento autorizado por Pedro. [Contrato/pacote](../../../api/ops/probe-transport.md) e [evidência local](../../../docs/analises/2026-10-03-transporte-privado-do-probe.md): SSH com pin/conta restrita/comando fixo/sudo exato, JSON filtrado e limites de saída/deadline; detector integrado e watchdog recíproco nativo, agenda/ciclo/canal/disco C e canal SMTP alternativo separado. Provas com SSH/sudo/STARTTLS reais e parada do detector; NOOP não comprova caixa postal. Não houve instalação remota, contratação, envio externo ou escolha de provedor alternativo. Próximo incremento local: proxy/TLS e origem confiável do cliente; disco/slot primário, canais/hosts reais/PITR/RTO continuam gates. 4B/tarefa 04/M1 permanecem abertos; Concluída: não.

03/10/2026 — 4B, proxy/TLS e origem confiável: continuação autorizada por Pedro. [Contrato](../../../api/ops/proxy-tls.md), [ativação futura](../../../api/ops/proxy-activation.md) e [evidência local](../../../docs/analises/2026-10-03-proxy-tls-e-origem-confiavel.md): peer explícito/literal, XFF único/normalizado, default sem confiança e startup conservador; Traefik/TLS/JAR/PG/clientes reais, quotas independentes/spoofing/bypass privado, HSTS/redirecionamento/erros/quarentena. A prova local não aplica configurações na VPS/Coolify nem aceita DNS/ACME/latência/RPO/RTO reais. Próximo incremento recomendado: saúde/disco/slot do primário, antes de contratação e instalação isolada. Tarefa 04/4B/M1 permanecem abertos; Concluída: não.


03/10/2026 — 4B, telemetria primária: continuação autorizada por Pedro para as pendências do M1. [Contrato/runbook](../../../api/ops/primary-telemetry.md) e [evidência](../../../docs/analises/2026-10-03-telemetria-do-primario.md): coleta privada/read-only de PG18, sincronismo/slot/retainedBytes e dados/WAL; identidade/permissões/caminhos conferidos; monitor separado e ciclo mais antigo no watchdog. Provas PG/filesystem/SSH/sudo/SMTP locais, sem configurar VPS nem reparar slot/WAL. Escopo atual do pacote local concretizado; próximo gate operacional é dimensionamento/definições 4A e instalação/aceite 4C/4D. Tarefa 04 e M1 abertos; Concluída: não.
