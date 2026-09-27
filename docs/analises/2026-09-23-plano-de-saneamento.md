# Ritmo — proposta para sanear e implementar a fundação

Data: 23/09/2026. Status: **proposta para decisão**, derivada da [auditoria](./2026-09-23-auditoria-fundacao.md).

Este documento não altera o escopo aprovado do PRD. A sequência abaixo é uma alternativa ao plano atual; decisões que mudam comportamento devem ser incorporadas aos specs antes do código correspondente.

## 1. Resultado que buscamos

Chegar à primeira fatia implementável com requisitos, dados, interface, falhas e critérios de aceite coerentes. Documentar o suficiente para reduzir invenção e retrabalho, sem desenhar antecipadamente toda a Fase 2.

O que pode começar imediatamente: revisão documental, fechamento de contratos e preparação de spikes com critérios objetivos. A implementação produtiva de schema completo, autenticação, sync e Agenda depende das decisões indicadas na auditoria. Não é necessário aguardar nome definitivo, notícias, esportes ou módulos futuros.

## 2. Decisões que realmente precisam ser tomadas

Prioridade por dependência, não pela ordem Q1–Q9 do PRD. “Responsável” indica o papel proposto; não há pessoas designadas além do Pedro.

| ID proposto | Decisão | Recomendação inicial para discussão | Responsável | Antes de |
|---|---|---|---|---|
| D01 | O que conta como primeira entrega e como medir quatro semanas? | Conta + hábito + Briefing mínimo em aparelho, persistência e sync; registrar início, esforço e causas de atraso | Pedro + implementação | Novo plano |
| D02 | Onde cada dado vive e quem pode escrevê-lo? | Separar persistência do servidor, projeção local, catálogo e transporte por allowlist; IDs conforme origem | Implementação, revisão do Pedro | Migrations e endpoints |
| D03 | Qual autoridade resolve concorrência e XP? | UI otimista local; servidor valida fatos e resolve resultado canônico; exemplos compartilhados de regra entre TS/Java | Implementação, revisão do Pedro | Sync e gamificação |
| D04 | Como preservar pendências ao sair ou recuperar? | Nunca descartar silenciosamente; fechar logout offline, sessão expirada, conta excluída e recuperação | Pedro + implementação | Conta e sync |
| D05 | Como identificar um cumprimento e um incremento? | Separar identidade de comando da identidade do cumprimento; incrementos distintos preservam contribuição | Implementação | Hábitos com sync |
| D06 | Alteração de agenda de hábito reinterpreta histórico? | Preferir histórico preservado se isso for parte da promessa; se optar por simplificar, descrever claramente a mudança e seu impacto | Pedro | Edição de agenda/histórico |
| D07 | O congelamento existe e a cota é de quem? | Não liberar implementação enquanto Q3 estiver só como proposta; escolher cota global/por hábito, dias consumidos e reversão retroativa | Pedro | Ofensivas |
| D08 | Qual caminho técnico valida a voz? | Medir no início STT nativo e remoto em pt-BR, verificando suporte real, consentimento e latência | Pedro + implementação | Compromisso com experiência de voz |
| D09 | Quais calendários e qual destino de escrita? | Primário selecionado por padrão; escolha explícita; estado por calendário; escrita habilitada em incremento próprio | Pedro + implementação | Agenda e create_event |
| D10 | Qual é o gate visual real? | Tokens neutros na fundação conforme spec/11; direção visual aprovada antes da experiência final do Briefing | Pedro | Consolidação visual |
| D11 | Como representar recorrência e data sem hora? | Data civil distinta de instante; âncora/fuso da série e semântica de último dia explícitas | Pedro + implementação | Tarefas com prazo/recorrência |
| D12 | Como são retenção, exportação e eliminação? | Matriz por categoria e procedimento que inclua backups, IA, Google e aparelhos offline | Pedro + implementação | Uso de dados reais e operação |

As recomendações são hipóteses de solução. Não autorizam alterar o comportamento aprovado sem registrar a decisão. D06 e D07, por exemplo, têm consequências visíveis para o usuário; não são meras escolhas de biblioteca.

Nome e domínio podem aguardar até serem necessários para distribuição. Times/provedor esportivo e fornecedores financeiros pertencem às respectivas fases. Q4, distinção hábito/tarefa, pode ser investigada com cenários e uso sem bloquear a infraestrutura.

## 3. Pacotes de saneamento documental

### S0 — Consistência e fontes de verdade

**Resolve:** B01 e erros editoriais da auditoria.

Revisar PRD, README, CLAUDE e plano em conjunto: login social, cinco telas, ID duplicado, oito tools, caminhos Spring, contagem das fatias, gate visual e unidade de trabalho. Registrar a precedência entre ADR aprovado, spec de comportamento, modelo e plano; se divergirem, corrigir a divergência, não escolher o arquivo mais conveniente.

Criar um ponto de entrada curto e neutro para os agentes, por exemplo `AGENTS.md`, que aponte para as instruções canônicas. Evitar cópias integrais de regras em vários arquivos. `TERMBAKER.md` é instrução de um ambiente específico e não comprova quais ferramentas estão disponíveis em outro ambiente.

**Saída verificável:** IDs únicos; links/referências corretos; nenhum caminho antigo apresentado como destino atual; nenhuma entrega exigindo uma capacidade que só nasce depois sem declarar essa dependência.

### S1 — Dados, identity e recuperação

**Resolve:** B02, B03, B06 e parte de B08/P06.

Expandir o spec/00 com a matriz de propriedade e projeção; completar o spec/01 com estados de sessão/recuperação/exclusão; definir dados exclusivamente locais e exclusivamente do servidor. Acrescentar apenas a persistência necessária aos requisitos existentes, sem implementar schema futuro por antecipação.

**Saída verificável:** cada campo tem dono e direção; cada transição de identity tem persistência e erro; logout/recuperação não exigem apagar pendências de modo implícito; isolamento pode ser testado com duas contas.

### S2 — Protocolo de sync e exemplos de domínio

**Resolve:** B04, B05 e B08.

Completar o spec/06 com envelopes, confirmações e exemplos. No spec de cada domínio, definir a sua política de conflito. Um exemplo de sync deve poder ser executado manualmente com duas filas e produzir o mesmo estado final, independentemente de retries permitidos pelo contrato.

**Saída verificável:** os cenários T01–T09 abaixo têm respostas inequívocas; local write + outbox são uma transação; o protocolo não é um endpoint genérico de escrita em tabela.

### S3 — Provas técnicas de risco

**Resolve:** B07, P05, P07 e parte de P08.

Spikes curtas, com limite de esforço definido antes de começar:

| Spike | Pergunta | Evidência de saída |
|---|---|---|
| Build mobile | A combinação escolhida de SDK/bibliotecas roda no aparelho alvo? | Build reproduzível, gravação de áudio, SQLite, resultado e versões |
| Voz | Qual STT preserva nomes, números, datas e tempo em pt-BR? | Conjunto fixo de frases; acerto por intenção/campo; duração por etapa; falhas e custo |
| Agenda | Dois calendários, recorrência e recuperação de sync funcionam com o contrato escolhido? | Mapeamento de payloads, cursor por calendário, 410 e limites da janela |
| Notificação | A ação funciona com app fechado no dispositivo real? | Resultado por plataforma/estado e fallback acordado, sem prometer execução inexistente |

Uma spike não precisa produzir arquitetura de produção. Deve responder à pergunta e atualizar a decisão; código descartável não vira fundação automaticamente.

### S4 — Plano por dependências e aceite

**Resolve:** B01, P08 e rastreabilidade.

Reescrever as primeiras fatias usando o resultado de S0–S3. Cada requisito entra numa fatia ou fica explicitamente adiado com justificativa. Dados, migração, contrato e teste evoluem juntos na entrega em que se tornam necessários.

**Saída verificável:** a primeira fatia cabe em um ciclo curto, pode ser demonstrada no aparelho e tem critérios que não dependem de funcionalidades futuras. Um teste que ainda não existe fica marcado como planejado, nunca como evidência concluída.

## 4. Sequência proposta de implementação

Esta sequência preserva a intenção de produto. Não representa autorização para reduzir o escopo final da Fase 1. Trabalho técnico preparatório tem saída própria; a funcionalidade de produto só é concluída quando atravessa todas as camadas necessárias.

| Entrega proposta | Comportamento/resultado | Dependências | Evidência de conclusão |
|---|---|---|---|
| I0 — Base reproduzível mínima | API local e implantável; app em aparelho; migrations mínimas, CI e restauração de backup | S0, matriz de versões e dados mínimos de S1 | Build limpo, health, migration, role correta e restore testado |
| I1 — Conta e sessão | Cadastrar, entrar, renovar, sair com política de pendências definida; recuperação de senha | I0, S1 e contratos | Testes de sessão/recuperação e isolamento; sem exigir onboarding completo ainda |
| I2 — Primeiro hábito ponta a ponta | Criar e marcar hábito binário diário, salvar offline, reenviar e aparecer no segundo dispositivo | I1, S2 | T01–T06; fila persistente; estado visível e isolado |
| I3 — Briefing mínimo e valor de agenda | Home acionável com hábito; leitura de Agenda; empty states; onboarding completo quando seus módulos existirem | I2, D09/D10 e spike de Agenda | Uso diário no aparelho e dois calendários corretos |
| I4 — Tarefa simples no Briefing | Criar, editar, concluir e desfazer tarefa, com sync e política de data | I2/I3, D11 | Critérios TAR do recorte e testes de concorrência/reversão |
| I5 — XP básico e primeiro comando do assistente | Uma concessão coerente por cumprimento; `create_task` por texto e por voz pelo mesmo caminho de escrita | I4, D03/D05/D08 e schemas mínimos | XP sem duplicação; comando auditável; baseline voz versus toque |
| I6 — Expansão do núcleo | Tipos/agendas de hábito; demais tools; recorrência; conquistas/ofensiva; notificações | Decisões correspondentes e I2–I5 | Subfatias separadas, cada uma com REQs e cenários de falha |
| I7 — Agenda com escrita | Criar evento, reenviar, mostrar falha e desfazer antes/depois da publicação | Agenda leitura, assistente, contrato de escrita Google | Evento único sob retry e compensação verificável |
| I8 — Prontidão para validação | Exportação/exclusão concluídas, acessibilidade, recuperação, operação e métricas completas | Incrementos da Fase 1 rastreados | Definition of Done de release e início documentado dos 30 dias |

Observações de escopo:

- I3 só anuncia cards dos módulos disponíveis; I4 adiciona Tarefas. Isso precisa ser refletido no aceite intermediário, sem fingir que a Fase 1 já está completa.
- O sync mínimo nasce em I2 e é ampliado junto com novos comportamentos. Não há uma fatia tardia para “colar sync em tudo”.
- Os contratos de gamificação são fechados antes dos fatos que ela consumirá; a UI completa e as regras adicionais chegam depois. Assim, não é preciso construir toda a engine antes do primeiro uso.
- A spike de voz começa em S3; a integração real de uma intenção aparece cedo em I5. A taxa de 40% de voz só pode ser julgada após definir quais registros são elegíveis e quando todas as capacidades da versão de validação estão disponíveis.
- I6 é um agrupamento de planejamento, não uma tarefa pronta para execução. Deve ser quebrado em fatias pequenas: quantitativo, negativo, agendas, recorrência, cada família de tools e cada capacidade de notificação.
- Exportação, retenção e exclusão são desenhadas em S1; suas implementações acompanham cada novo tipo de dado. I8 verifica a cobertura, não inicia privacidade no acabamento.
- Notícias e Esportes continuam depois do portão da Fase 1. Não adotar provedores nem criar suas tabelas nesta fundação.

## 5. Módulos com responsabilidade verificável

Desenho proposto para discutir em B08. Os nomes não exigem criar uma classe ou um pacote novo para cada linha. Uma interface inclui comportamento e erros, além dos tipos.

| Módulo | Interface conceitual | Complexidade que deve esconder |
|---|---|---|
| Identity | Entrar, renovar, revogar, recuperar, consultar estado da conta | Credenciais, ciclo de sessão, tokens de uso único e eliminação |
| Hábitos/Tarefas | Executar comando de domínio e consultar projeções | Validação, identidade do fato, transação local e registro para sync |
| Sync | Sincronizar pendências e aplicar mudanças aceitas | Lote, ACK, retries, cursor, ordem, versões e retomada |
| Gamificação | Avaliar fatos canônicos e consultar progresso | Elegibilidade, teto, reversão, marcos e reconstrução |
| Agenda | Conectar, selecionar calendários, consultar agenda, enviar comando autorizado | OAuth, sincronização externa, mapeamento de datas, retry e compensação |
| Assistente | Interpretar entrada e executar propostas validadas pelo caminho de domínio | Contexto, schemas, consentimento, confirmação, correlação e feedback de falha |
| Notificações | Reconciliar lembretes a partir do estado atual | Orçamento global, IDs estáveis, cancelamento e limites da plataforma |
| Briefing | Registrar e consultar providers dos módulos disponíveis | Ordenação, loading/erro por card e atualização de estado |

Não inventar um conjunto de interfaces para cada dependência hipotética. Criar pontos de substituição onde há variação real ou necessidade concreta de testar tempo, armazenamento ou fornecedor. Evitar um `shared` que concentre regras pertencentes aos domínios.

## 6. Cenários que funcionam como contrato de aceitação

São testes propostos para a implementação, **não testes executados nesta auditoria**. Os valores esperados devem ser definidos independentemente da função testada.

| ID | Cenário | Resultado que precisa estar fechado |
|---|---|---|
| T01 | Encerrar o app entre gravação e fila | Ou fato e mutação existem juntos, ou nenhum existe |
| T02 | Servidor confirma no banco, conexão cai antes do ACK | Retry não duplica efeito; cliente reconhece a decisão anterior |
| T03 | A e B marcam o mesmo hábito/dia offline | Um cumprimento canônico e uma concessão de XP |
| T04 | A registra 0,5 L e B 0,7 L; A repete envio | Total de 1,2 L; retry não vira 1,7 L |
| T05 | 501 mudanças, timestamps empatados e escrita durante paginação | Sem lacuna; sem perda ao avançar cursor |
| T06 | Usuário A tenta referenciar pai/filho de B numa escrita | Operação rejeitada; nenhum efeito em dados de B |
| T07 | Conta com pendências recebe 401 de token expirado | Dado local preservado; recuperação de sessão explícita |
| T08 | Aparelho volta após vencer retenção de tombstone | Ressincronização definida; dado apagado não reaparece |
| T09 | Migration falha com registro ainda não enviado | Recuperação não substitui sua única cópia sem preservação |
| T10 | Marcar, desfazer, remarcar e sincronizar em ordens distintas | XP válido e orçamento consumido obedecem à política escolhida |
| T11 | Dois aparelhos concluem a mesma recorrência | Exatamente uma próxima ocorrência aberta |
| T12 | Alterar fuso/hora inicial e cruzar horário de verão | Dia lógico histórico preservado; data civil e prazo conforme contrato |
| T13 | Perder caches após histórico maior que 400 dias | Recordes e progresso reconstruídos ou recuperados conforme política explícita |
| T14 | Google devolve 410 com evento local pendente | Cache é reconstruído; comando local é preservado |
| T15 | Google aceita criação e a resposta se perde | Retry reconhece o evento já criado; desfazer tem efeito definido |
| T16 | Proposta da IA inclui tool inválida e duas válidas | Execução/recusa parcial visível, sem sucesso inventado nem repetição das válidas |
| T17 | Desfazer uma ação após outra edição legítima | Não sobrescrever silenciosamente o trabalho posterior |
| T18 | Orçamento de hábitos/tarefas já cheio e briefing elegível | Política global escolhe o agendamento sem exceder orçamento adotado |
| T19 | Exclusão seguida de restauração de backup | Conta eliminada não volta ao uso; dados seguem a política de retenção |
| T20 | Voz em ambiente com ruído, permissão negada ou rede lenta | Métrica por etapa, erro recuperável e formulário/manual disponível |

Não substituir esses cenários por “100% de cobertura”. Usar testes de domínio para cálculos; testes com SQLite/Postgres reais para transações, constraints e RLS; testes de contrato para TS/Java; poucos E2E para os fluxos críticos; aparelho real para limitações de áudio e notificações.

## 7. Estrutura documental mínima

Priorizar atualização dos arquivos existentes. Não criar um documento novo para cada detalhe.

| Documento | Papel |
|---|---|
| README | Estado real, entrada no projeto, comandos que existem, links e próximo marco |
| PRD | Problema, escopo, métricas, decisões de produto e não-escopo |
| Instruções canônicas + ponte curta para agentes | Como trabalhar, limites, comandos e critérios de qualidade |
| specs/00 | Dicionário de dados, propriedade, projeções e constraints |
| Specs de domínio | Comportamentos, estados, exemplos, dependências e aceite |
| specs/06 + contrato de transporte | Sync, envelopes, falhas, versões e recuperação |
| Plano de execução | Dependências e entregas pequenas, com status real |
| Matriz de rastreabilidade | REQ, fase, decisão, fatia, teste/evidência e status |
| Registro de decisões | Contexto, alternativas, escolha, consequências, data e documentos afetados |
| Runbook operacional curto | Build, deploy, segredos por nome, migrations, backup/restore e incidentes |

O registro de decisões pode continuar no PRD enquanto for pequeno. Se crescer, separar ADRs sem duplicar a decisão nos dois locais. Guardar uma versão/revisão das referências de engenharia quando formalizar guidelines para evitar mudanças invisíveis em links móveis.

### Modelo de uma tarefa implementável

```text
Objetivo observável:
Requisitos e versão dos specs:
Dependências e decisões já fechadas:
Dentro do recorte / explicitamente fora:
Interface e invariantes afetadas:
Dados, migrations e direção de sincronização:
Falhas e cenários de aceitação:
Validação por comandos existentes e demonstração:
Evidência de conclusão:
```

Preencher apenas os campos relevantes. Antes de iniciar, não pode haver decisão de produto escondida dentro do trabalho; depois de concluir, o aceite precisa apontar para evidência, não para uma declaração de que “foi implementado”.

## 8. Encaminhamento recomendado

Começar por S0, S1 e S2, preparando as spikes de S3 em conjunto. Levar ao Pedro as decisões de produto agrupadas por entrega, em vez de despejar todas as perguntas de fases futuras. A partir daí, detalhar apenas I0–I2 o suficiente para execução e revisão; manter o restante como sequência orientadora.

Isso aproveita o trabalho documental existente e produz a fundação que falta: uma primeira capacidade pequena, coerente, recuperável e demonstrável no aparelho.
