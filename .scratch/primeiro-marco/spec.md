# Primeiro marco do Ritmo — especificação da entrega

Estado em 26/09/2026: comportamento aprovado, baseline m1.1 e implementação técnica em andamento. A tarefa 04 entregou a primeira fatia executável; a tarefa 05 já acrescentou [sessão e isolamento](../../docs/analises/2026-09-26-sessao-e-isolamento.md), com testes reais. Direção visual aguarda o protótipo de Pedro; recuperação por e-mail e os demais itens da [tarefa 05](issues/05-completar-sessao-e-recuperacao.md) permanecem pendentes.

Atualização de 27/09/2026: [recuperação de senha](../../docs/analises/2026-09-27-recuperacao-de-senha.md) implementada e testada com SMTP local, API e SQLite. Host/provedor, abertura nativa e protótipo continuam pendentes.

## Resultado esperado

Pedro entra no iPhone 16e, confirma fuso/início do dia, cria um hábito binário diário ou pula essa etapa e usa um Briefing mínimo com saudação, hábitos e XP básico. Registra sem rede, fecha/reabre e encontra seus dados. Ao sincronizar a mesma conta no emulador Android, os aparelhos convergem sem duplicar cumprimento ou XP. Sair offline preserva pendências isoladas para reentrada online na conta de origem.

Fonte de escopo: [PRD §4](../../PRD.md#4-objetivos-e-métricas-de-sucesso), [plano](../../PLANO-DE-EXECUCAO.md) e R2-Q9/R6-Q27 da [entrevista](../fundacao/entrevista.md). Esta especificação organiza a entrega; não substitui os contratos canônicos.

## Contratos aplicáveis

| Assunto | Fonte |
|---|---|
| Conta, sessão, onboarding e recuperação | [spec/01](../../specs/01-conta-e-onboarding.md), ADR-016 e [contrato §2](../../specs/13-contrato-primeiro-marco.md#2-conta-e-sessão) |
| Criar e cumprir hábito binário diário | [spec/02](../../specs/02-habitos.md), REQ-HAB-001/003/004/004a |
| Concessão única, teto, reversão e restauração | [spec/04](../../specs/04-gamificacao.md), REQ-GAM-001/002/003/003a/004 |
| Escrita local, sync, identidade e recuperação | [spec/06](../../specs/06-sincronizacao.md), [contrato §3–8](../../specs/13-contrato-primeiro-marco.md) e [modelo §12](../../specs/00-modelo-de-dados.md#12-proposta-de-representação-do-primeiro-marco) |
| Briefing mínimo e estados vazios/erros | [spec/08](../../specs/08-briefing.md); visual condicionado a [spec/11](../../specs/11-design-system.md) |
| Isolamento, consentimento e recuperação de dados | [spec/07](../../specs/07-nao-funcionais-e-lgpd.md) e [CLAUDE](../../CLAUDE.md) |

O primeiro marco não exige interfaces de níveis, ofensivas, proteções ou conquistas, nem Agenda, tarefas, voz ou notificações. Essas capacidades continuam na Fase 1. O protótipo aberto não autoriza inventar visual para o Briefing.

## Sequência proposta

1. Fechar schemas/limites e validar o desenho do primeiro marco; fixar versões compatíveis e caminho de build nos dois clientes. As duas preparações podem avançar independentemente do protótipo.
2. Exercitar conta, sessão e armazenamento isolado com testes pela interface real, incluindo logout/reentrada, sem montar um framework para módulos futuros.
3. Exercitar um hábito binário diário com registro offline, persistência, sync e XP na mesma entrega; provar concorrência e falhas antes de ampliar os tipos de hábito.
4. Integrar onboarding e Briefing ao protótipo concluído; verificar acessibilidade e uso real no iPhone 16e e no emulador Android. A entrega só passa quando domínio, persistência, rede e interface funcionarem juntos.

Não usar as etapas técnicas 1–3 como substituto do aceite de ponta a ponta. Sem data de início ou estimativa de capacidade inventadas; registrar o começo efetivo da implementação para a revisão de quatro semanas do ADR-014.

## Critérios de aceite

A matriz canônica é [M1-01 a M1-20](../../specs/13-contrato-primeiro-marco.md#9-cenários-de-aceite-do-contrato). A evidência final deve identificar versão/build, aparelhos, cenários executados e resultado, incluindo:

- Dados e intenção sobrevivem a reinício offline; sem sucesso falso em disco cheio ou transação falha.
- Concorrência e retry não duplicam XP; desfazer prevalece sobre marcação concorrente que não o conhecia; remarcar conscientemente restaura a concessão original.
- Confirmação perdida, pull anterior a ack e snapshot antigo não reaplicam intenção já resolvida nem pulam alterações de outra entidade.
- Rejeição de uma criação não prende eternamente sua marcação dependente; conteúdo pode ser recuperado sem reescrever IDs enviados.
- Conta B não lê, exporta nem envia pendências de A; `401` não apaga dados.
- Onboarding retoma, pular hábito gera Briefing útil e permissões não aparecem antes de sua capacidade.
- Interface segue o protótipo incorporado ao design system e requisitos de acessibilidade; dados convergem nos dois clientes reais de validação.

## Lacunas que permanecem e onde bloqueiam

| Lacuna | Efeito sobre execução | Encaminhamento |
|---|---|---|
| Execução das migrations, roles e contratos nos runtimes reais | Primeiro recorte com migrations, RLS e integração real verificados; matriz M1 ainda incompleta | Preparação [01 concluída](issues/01-fechar-contratos.md); execução na [04](issues/04-exercitar-fundacao-sem-ui.md) |
| Builds efetivos e rota iOS | Matriz documentada; Pedro não tem Apple Developer ativo. EAS físico exige essa dependência ou alternativa local com Mac | Pesquisa [02 concluída](issues/02-validar-stack-e-build.md); build Android técnico aprovado; execução nativa e rota iOS conforme relatório da tarefa 04 |
| Protótipo ainda sendo feito pelo Pedro | Impede fechar visual e aceite do Briefing; não bloqueia contratos/testes sem UI | [Tarefa 03](issues/03-integrar-prototipo.md) |
| SMTP/deep link, segredos, deploy e recuperação operacional | SMTP local, dump/restore e recuperação física pós-corte testados; pacote operacional local verificado, com definição/instalação/aceite real ainda pendentes | [Guia de e-mail](../../api/ops/email-recovery.md), [backup/restauração](../../api/ops/backup-restore.md) e [recuperação operacional aprovada](../recuperacao-operacional/spec.md); fornecer parâmetros operacionais sem inserir credenciais nos docs |
| Saldo de XP menor que prêmio nominal | Q31 resolvida e implementada: prêmio inteiro de 10 XP somente quando couber; caso contrário, cumprimento sem XP | [Exclusão e tombstones](../../docs/analises/2026-09-30-exclusao-e-tombstones.md); gamificação ampliada segue fora deste recorte |
| Exportação/exclusão de conta e funcionalidades restantes da Fase 1 | Contratos integrais ainda incompletos; não declarar Fase 1 pronta nem liberar distribuição externa por ter passado M1 | Manter no backlog de Conta/Fase 1 e fechar antes dos fluxos correspondentes |

Há comportamentos posteriores já decididos (quantidades, vigência de regras, recorrência, negativos e proteções) cujos modelos ainda não estão prontos. Isso não bloqueia o caminho binário diário, mas proíbe extrapolar seu algoritmo para esses casos.

## Evidência atual

- Documentação cruzada e proposta de protocolo/modelo registradas. Revisão independente encontrou e permitiu corrigir lacunas de correlação de recibos, dependência rejeitada e compatibilidade do pull.
- Verificação do modelo de reconciliação binária: cinco cenários, 52 avaliações de ordem/repetição, sem divergência do estado final esperado. Essa evidência não cobre transações, autorização, protocolo ou XP.
- Checagem documental de 25/09/2026: 32 documentos ativos verificados; nenhum link Markdown local quebrado, âncora ausente, bloco de código desequilibrado ou ID de requisito duplicado. Os três exemplos JSON de spec/13 foram parseados com sucesso; os 20 cenários de aceite foram conferidos. Isso valida estrutura documental, não conformidade da aplicação.
- Atualização de 26/09/2026: [primeiro recorte executável](../../docs/analises/2026-09-26-primeiro-recorte-executavel.md) implementado e verificado com SQLite, HTTP e Postgres reais, incluindo RLS e rollback. Build Android técnico e persistência nativa após reinício aprovados. A matriz M1 completa continua parcialmente pendente.

Etapa seguinte de preparação concluída em 25/09/2026: [OpenAPI e DDL de referência](../../contracts/primeiro-marco/README.md), com 47 fixtures de transporte, 11 fixtures de normalização/teto, oito verificações SQLite e 25 instruções Postgres parseadas. [Pesquisa de stack/build](../../docs/analises/2026-09-25-stack-e-build-primeiro-marco.md) concluída. Essa etapa documental não havia executado aplicação/RLS. A evidência posterior da tarefa 04 está no relatório acima; ela não conclui os 20 cenários integralmente.

Atualização de 27/09/2026: [recuperação de senha](../../docs/analises/2026-09-27-recuperacao-de-senha.md) implementada e testada com SMTP local, API e SQLite. Host/provedor, abertura nativa e protótipo continuam pendentes.

Atualização de 30/09/2026: [HTTP nativo Android](../../docs/analises/2026-09-30-http-nativo-android.md) com criação/marcação offline, force-stop/reabertura, sessão protegida, retomada automática e convergência sem XP duplicado. O segundo cliente é SQLite de desktop; o aceite iPhone/Android, o protótipo e a matriz M1 restante continuam pendentes.

Atualização de 30/09/2026: [rate limiting Q32](../../docs/analises/2026-09-30-rate-limiting.md) verificado por HTTP, concorrência e cliente SQLite. Quotas configuráveis, 429/Retry-After, memória limitada e ausência de ressurreição/perda de intenção após retry. Proxy confiável, provisionamento e backup/restauração seguem pendentes; protótipo Q28 continua aberto.

Atualização de 30/09/2026: [backup/restauração](../../docs/analises/2026-09-30-backup-e-restauracao.md) exercitado em PostgreSQL limpo com dono diferente, roles recompostas e API real. Preserva snapshot/recibos, sessões, hábitos/XP, tombstones, isolamento e intenções offline no SQLite. Agenda externa/retenção, recuperação de confirmações após o corte, provisionamento e aceite real permanecem pendentes; decisão operacional em spec/07 §2.1.

## Resultado

Concluída: não.

A preparação documental avançou; a entrega funcional só poderá ser concluída com evidência dos cenários acima. O marco não inicia automaticamente os 30 dias de validação da Fase 1 completa.


Atualização de 03/10/2026: [telemetria privada do primário](../../docs/analises/2026-10-03-telemetria-do-primario.md) completa as integrações locais previstas no escopo atual do pacote operacional 4B. Saúde/disco/slot, monitor/watchdog e runbook verificados localmente; definição/dimensionamento 4A, instalação 4C e aceite 4D continuam abertos. UI/protótipo, distribuição/aparelhos, e-mail real e demais lacunas da matriz permanecem no M1.

04/10/2026 — Q49/Q50 e entendimento confirmados: [plano](../retencao-feed/spec.md) e [tarefa vertical](../retencao-feed/issues/01-expurgar-feed-e-snapshots.md). Rotina diária, V5, limite de revisão e coordenação de snapshots implementados localmente, com prova HTTP/PostgreSQL/SQLite e de reinício/concorrência. [Evidências e validação](../../docs/analises/2026-10-04-retencao-fisica-do-feed.md). Snapshot/recibos/IDs e pendências preservados; M1, recuperação de exceções, UI/aparelhos e aceite externo continuam abertos.


07/10/2026 — Q51–Q53=A aprovadas para recuperação de exceções: preservação/bloqueio de base ilegível, uso local da sessão ativa/saudável durante indisponibilidade do SecureStore e bloqueio preservado de identidade incerta. [Diagnóstico](../../docs/analises/2026-10-07-recuperacao-de-excecoes.md) e [plano/tarefas confirmados](../recuperacao-excecoes/spec.md). [Identidade/recibos](../../docs/analises/2026-10-07-correspondencia-de-recibos.md) foi implementado/verificado localmente após confirmação do entendimento e fronteiras: app 100 testes/typecheck/lint, API check integral 85 aprovados/1 Android opt-in ignorado e 13 operacionais. Cofre/sessão é a próxima entrega; abertura, UI/aparelhos, SMTP/deep link e aceite externo mantêm M1 aberto.
