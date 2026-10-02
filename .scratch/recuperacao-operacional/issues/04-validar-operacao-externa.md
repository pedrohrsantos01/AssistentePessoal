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
| 4B — pacote de implantação testado | Autorizada a preparação local em Q47; build da API primeiro, seguido de supervisão/agenda/transporte/proxy |
| 4C — instalação isolada | Pendente de proposta/acessos definidos |
| 4D — aceite externo/RTO | Pendente; prova local não substitui o ambiente real |

Respostas [Q44–Q46](../../fundacao/entrevista.md): Hostinger/Campinas, 2 vCPU/8 GB/100 GB, Ubuntu 24.04/Coolify 4.3.23; Q45 solicitou recomendação sem aprovar teto; Resend já usado, cofre a escolher. [Proposta concreta](../../../docs/analises/2026-10-02-proposta-de-infraestrutura.md) registra Q47: perfil A/artefatos locais primeiro, fornecedores/orçamento depois e comparação Hostinger/R2; Q48: Bitwarden Free cloud escolhido. Nenhum fornecedor adicional ou orçamento foi tratado como aprovado. Remoto Git/domínios/acessos também continuam a confirmar na etapa de instalação.

A revisão identificou dependências concretas: build precisa incluir contracts pela raiz do repositório; confiança do proxy ainda está desligada; probe atual mede disco do receptor e não saúde do próprio detector/SMTP ou disco/slot do primário. Essas integrações precisam de implementação e provas na operação externa. Detector DigitalOcean tem restrição SMTP 25/465/587: alternativa Resend 2587 documentada, mas acesso/entrega real ainda a aceitar. Registrar catálogo/histórico real para não afirmar uma janela retroativa inexistente. [Relatório do preparo e limites](../../../docs/analises/2026-10-02-preparacao-do-provisionamento.md). Contratação/aceite externo ainda dependem de informação; Concluída: não permanece.
