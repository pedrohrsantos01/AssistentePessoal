# Recuperação operacional do Ritmo — plano para confirmação

Data: 01/10/2026.
Estado: **plano confirmado por Pedro em 02/10/2026; incrementos 1/2/3 concluídos localmente; incremento 4 em preparação local**.
Origem: [entrevista, Q33–Q43](../fundacao/entrevista.md).
Vínculo: [REQ-NFR-004 e confiabilidade](../../specs/07-nao-funcionais-e-lgpd.md), [sincronização](../../specs/06-sincronizacao.md), [contrato do primeiro marco](../../specs/13-contrato-primeiro-marco.md) e [tarefa 05 do M1](../primeiro-marco/issues/05-completar-sessao-e-recuperacao.md).

Pedro confirmou o plano e autorizou iniciar o incremento 1 em 02/10/2026. As respostas estão registradas na entrevista e consolidadas no ADR-019/spec/07; implementação e evidências serão registradas nas tarefas individuais. Este plano referencia os contratos canônicos, sem substituí-los.

## Objetivo e limite da garantia

Preservar todas as transações confirmadas pela API quando a VPS primária for totalmente perdida (**RPO zero nesse cenário**). Exigir WAL durável no destino independente antes da confirmação, com uma base física válida e cadeia suficiente para recuperar as transações. A meta de **RTO de até 24 horas** inclui reconstrução, restauração, validação e reabertura da API; será medida em ensaio no ambiente escolhido.

A indisponibilidade do receptor pode impedir a confirmação remota. O app conserva intenções e pode continuar o uso local da conta ativa. Não reduzir silenciosamente o sincronismo nem confirmar apenas por ter gravado no disco primário.

O ensaio atual de dump, [verificado em 30/09/2026](../../docs/analises/2026-09-30-backup-e-restauracao.md), continua sendo evidência do ponto capturado e de pendências locais não enviadas. Ele não demonstra recuperação das confirmações posteriores ao corte. A garantia externa depende das provas e do provisionamento abaixo.

## Decisões fechadas

| Origem | Definição aprovada |
|---|---|
| Q33 | Nenhuma perda de transação confirmada pela API na perda total da VPS primária; destino independente durável antes da confirmação. |
| Q34 | Meta de recuperação completa em até 24 horas, a medir. |
| Q35 | Receptor contínuo de WAL fora da VPS primária, com base física recuperável; sem segundo PostgreSQL completo continuamente aplicando WAL neste recorte. |
| Q36 | API em quarentena enquanto a completude não estiver comprovada. Preservar leitura, novos registros locais, SQLite, envelopes e fila da conta ativa. |
| Q37 | Após recuperação integral, invalidar access/refresh, sessões e links de recuperação anteriores; exigir novo login online. Preservar a senha recuperada correta e os dados locais. |
| Q38 | Base física completa e dump lógico diariamente às 03:00, America/Sao_Paulo; WAL contínuo. |
| Q39 | Janela PITR recuperável de 30 dias, conservando a base âncora anterior à janela e todo WAL necessário. |
| Q40 | Alertas por e-mail com detecção fora da VPS primária. |
| Q41 | Ensaio integral isolado mensal e a cada release major, com integridade, API e tempo total medidos. |
| Q42 | Probes a cada 60 s, alerta após duas falhas consecutivas; backup válido com mais de 26 h; falha de execução imediatamente; armazenamento 80% aviso/90% crítico. E-mail na abertura, agravamento e resolução, sem repetição do mesmo estado. |
| Q43 | Segredos e eventuais chaves em cofre externo aos servidores, acessível por Pedro após perder a VPS. Apenas referências nos documentos. |

## Comportamento durante recuperação

1. Isolar o destino restaurado antes de qualquer acesso de cliente. A quarentena cobre autenticação, recuperação de senha, refresh/revoke, pull, snapshot, recibos e push; verificações operacionais precisam de acesso separado e restrito.
2. Preservar a base local da conta ativa e suas novas intenções. Invalidação remota não equivale a logout, limpeza de SQLite ou permissão para acessar outra conta.
3. Recuperar e verificar a cadeia física/WAL, dados de domínio, recibos, contas, credenciais e isolamento. Uma cópia antiga íntegra não basta para declarar recuperação integral.
4. Com completude comprovada, invalidar credenciais de sessão e links antigos antes de reabrir. A rotação da chave de assinatura, sozinha, não revoga as famílias de refresh ou os links guardados no banco; o procedimento deve cobrir os três mecanismos.
5. Exigir novo login online, mantendo SQLite e pendências. Retomar o sync pelo contrato de ressincronização validado para a recuperação integral.

Quarentena deve produzir indisponibilidade transitória compatível com a preservação das intenções no app. Nunca instalar automaticamente um snapshot antigo nem reenviar operações já acknowledged para tentar reconstruir o servidor. Se a cadeia estiver incompleta, conservar o ambiente isolado e os dados locais; liberação de um histórico incompleto exigiria outra decisão explícita.

## Entrega em incrementos

As tarefas de execução têm arquivos individuais em `issues/`, com dependências e critérios de aceite. A tabela define a sequência e o resultado observável de cada incremento, com conclusões locais e gates externos separados.

| Ordem | Recorte | Resultado verificável |
|---|---|---|
| **1 — concluído localmente** | Contenção e retomada após recuperação integral, API + cliente local | API real em quarentena não entrega nem aceita estado potencialmente antigo; SQLite reaberto mantém leitura/envelopes/novas intenções. Após validação e invalidação das credenciais anteriores, novo login permite retomar sem perda ou duplicação. |
| **2 — concluído localmente** | Durabilidade síncrona e recuperação física pós-corte | Primário e receptor descartáveis; base anterior às operações; perda do primário; recuperação da cauda de WAL preserva confirmações, recibos, contas, senha vigente, tombstones e XP. Falha/cancelamento não gera falsa confirmação. |
| **3 — concluído localmente** | Ciclo de backup, retenção, detector e procedimento | Publicação de bases válidas, expurgo por dependência, alertas Q42 sem conteúdo pessoal, falhas e ausência de agenda detectáveis. Procedimento reproduzível de reconstrução e ensaio cronometrado. |
| 4 | Provisionamento e aceite externo | Escolher e configurar destino, acessos, cofre, canal de e-mail, Coolify, TLS/proxy, agenda e monitor externo; medir recuperação integral no ambiente real antes da exposição. |

Cada incremento combina implementação, testes pertinentes e documentação, com commits semânticos e atômicos. O [incremento 1](issues/01-conter-e-retomar-api.md) tem evidência em [relatório](../../docs/analises/2026-10-02-contencao-e-retomada-operacional.md); o [incremento 2](issues/02-provar-wal-pos-corte.md) tem [prova local de WAL/recuperação](../../docs/analises/2026-10-02-wal-e-recuperacao-fisica.md); o [incremento 3](issues/03-operar-backups-e-alertas.md) tem [evidência local de agenda/cadeia/monitor](../../docs/analises/2026-10-02-ciclo-operacional-de-backups.md), com alvo selecionado fora do primário perdido. O próximo trabalho é definir/provisionar e aceitar o ambiente real no incremento 4. O protótipo não é pré-requisito para esses testes técnicos; M1, UI e aceite no iPhone/Android continuam abertos.

## Provas necessárias

- **Quarentena:** nenhuma rota de cliente pode contorná-la, inclusive usando token anterior ou retomando uma paginação; nenhuma leitura de snapshot/recibo antigo pode fazer o app perder projeções confirmadas. A conta local ativa pode registrar novas intenções e reabrir SQLite sem perder envelopes.
- **Retomada integral:** access/refresh e links anteriores deixam de funcionar; senha recuperada correta permite novo login; pendências são classificadas e enviadas corretamente; hábitos, tombstones, recibos e XP convergem entre clientes. Isolamento entre contas permanece.
- **Confirmações pós-base:** restaurar a base anterior junto do WAL após encerrar a origem; verificar pela API os dados confirmados posteriores ao corte, incluindo mudança de senha, exclusão e replays sem novo efeito.
- **Falhas do destino:** ausência do receptor, reinício, disco indisponível e resultado incerto/cancelamento não autorizam confirmação baseada apenas no primário, nem sucesso posterior ao consultar/repetir um recibo ainda não protegido. Não presumir que cancelar uma espera de replicação equivale a rollback.
- **Cadeia física:** validar manifest/base e recuperação real; preservar cauda parcial e históricos de timeline. Corrupção, arquivo ausente e cadeia insuficiente recusam liberação. Não aceitar como prova apenas o término bem-sucedido de uma ferramenta.
- **Retenção:** preservar a âncora anterior aos 30 dias e seus WAL; backup novo falho não autoriza eliminar a última cadeia válida. Em instalação nova, a janela cresce com o histórico disponível, sem alegar 30 dias retroativos inexistentes.
- **Alertas:** usar relógio e transporte externos controláveis para os limites de Q42, deduplicação e resolução. Ausência de novas escritas não significa falha do receptor; verificar sua disponibilidade/feedback. O detector precisa identificar também a perda do host que roda o receptor.
- **Ensaio externo:** registrar início do incidente, reconstrução, restauração, verificações e reabertura. Verificar envio de alerta e execução agendada com as configurações reais. O tempo de containers locais não estabelece o RTO de produção.

Fronteiras: HTTP/Session/AccountStore públicos, SQLite e PostgreSQL reais, processos/armazenamento/relógio/transporte como dependências externas. Dados de domínio são afirmados pelas interfaces públicas; metadados operacionais de WAL/base são verificações próprias da infraestrutura. Serviços persistentes locais seguem TERMBAKER.md; fixtures descartáveis de teste são encerradas.

Antes de concluir cada incremento executável: app `typecheck`, `lint`, `test`; API `check`, incluindo ModularityTests; validar contratos/migrations afetados e links locais. Guardar resultados e limitações em relatório, commit e nota concisa de ai-memory. Não registrar segredos, dados pessoais ou conteúdo de dumps.

## Engenharia a validar, sem nova decisão de produto

A candidata para Q35 é `pg_receivewal --synchronous`, com receptor nomeado exigido por `synchronous_standby_names` e `synchronous_commit=on` no primário para todas as escritas protegidas. O parâmetro do receptor sozinho não basta. Provar também o comportamento de cancelamento, timeout, cauda parcial, reconexão e promoção/timeline; o desenho final deve ser respaldado pelos ensaios.

Usar credencial operacional de replicação separada dos logins de domínio/identidade. A base física cobre o cluster; RLS não limita o conteúdo de WAL físico. Configuração externa e segredos necessários à reconstrução precisam de referências e custódia Q43. Ferramentas e dumps auxiliares devem conservar as ACLs exigidas pelo projeto.

Detalhar a seleção/validação da cadeia e o expurgo por dependência. Não usar remoção de WAL apenas por idade, quota ou um diretório compartilhado sem identificar todas as bases dependentes. Os formatos operacionais e a ativação de recuperação serão documentados durante o respectivo incremento, antes de sua implementação. Qualquer mudança no modelo/contrato exige atualização canônica e migration nova quando aplicável; não inventar comportamento ausente.

Fontes técnicas primárias verificadas durante a entrevista: [replicação síncrona](https://www.postgresql.org/docs/18/warm-standby.html#SYNCHRONOUS-REPLICATION), [pg_receivewal](https://www.postgresql.org/docs/18/app-pgreceivewal.html), [pg_basebackup](https://www.postgresql.org/docs/18/app-pgbasebackup.html), [recuperação contínua](https://www.postgresql.org/docs/18/continuous-archiving.html), [cancelamento durante espera síncrona](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/replication/syncrep.c#L296) e [tarefas agendadas no Coolify](https://coolify.io/docs/core/automation/scheduled-tasks/overview).

## Dependências antes da operação externa

Fornecedor/região/capacidade/custo do destino e do detector, acesso ao Coolify/VPS, cofre escolhido, destinatário e transporte de e-mail, acessos TLS/replicação e armazenamento serão definidos no provisionamento após a prova local. Essas dependências estão explícitas; nenhum valor de credencial é solicitado ou salvo aqui. A confirmação deste plano autoriza o recorte local descrito, não compra ou publicação externa.

Outros gates do M1 continuam conforme a tarefa 05: protótipo Q28, UI, validação dos aparelhos, distribuição iOS, e-mail real de recuperação, proxy/TLS e demais critérios de aceite. Este plano não declara a aplicação pronta para produção nem encerra a Fase 1.


## Preparação de provisionamento — 02/10/2026

Recorte 4 iniciado pela definição, sem implantação externa. O [caderno de execução/aceite](../../api/ops/external-provisioning.md) organiza 4A (ambiente/custos), 4B (pacote testado), 4C (instalação isolada) e 4D (provas externas). Q44 confirmou Hostinger/Campinas (2 vCPU/8 GB/100 GB, Ubuntu 24.04/Coolify 4.3.23); Q45 pediu recomendação de custos, sem aprovar teto, e Q46 informou Resend e pediu sugestão de cofre. Compra/publicação não são presumidas. [Referências oficiais](../../docs/analises/2026-10-02-referencias-provisionamento-externo.md) orientam engenharia, sem comprovar instalação. A [tarefa 04](issues/04-validar-operacao-externa.md) está em preparação local, com dependências externas abertas; M1 permanece aberto. [Evidência do preparo](../../docs/analises/2026-10-02-preparacao-do-provisionamento.md).
