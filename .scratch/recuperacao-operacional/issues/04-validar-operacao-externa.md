# Provisionamento e aceite externo

Status: needs-info
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
