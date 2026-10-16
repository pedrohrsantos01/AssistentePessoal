# spec/13 — Contrato técnico do primeiro marco

**Estado:** baseline documental m1.1, 25/09/2026, com [OpenAPI, exemplos, DDL de referência e validadores](../contracts/primeiro-marco/README.md). Os comportamentos de produto referenciados foram aprovados na [entrevista](../.scratch/fundacao/entrevista.md); o desenho abaixo é sua concretização de engenharia. A fundação executável já aplica migrations e tem testes reais de integração; a cobertura atual e suas pendências estão nos relatórios de [sessão](../docs/analises/2026-09-26-sessao-e-isolamento.md) e [recuperação de senha](../docs/analises/2026-09-27-recuperacao-de-senha.md). Não representa aceite completo do M1. O protótipo foi entregue por Pedro em 09/10/2026; direção consolidada em [spec/11](11-design-system.md). Implementação visual e aceite nativo continuam pendentes.

**Recorte:** conta por e-mail/senha, onboarding retomável de fuso/início do dia e primeiro hábito binário diário, Briefing com saudação/hábitos/XP básico e sync entre iPhone 16e e emulador Android. Agenda, tarefas, voz, notificações e gamificação completa permanecem em incrementos seguintes.

Este documento define interfaces, garantias e exemplos. A representação de dados está em [spec/00 §12](00-modelo-de-dados.md#12-proposta-de-representação-do-primeiro-marco); os requisitos de produto continuam nos specs 01/02/04/06/08. Antes de gerar migrations, revisar os pontos de implementação da §10. Não criar um CRUD remoto genérico capaz de escrever em qualquer tabela.

**Precedência dos exemplos:** os trechos JSON abaixo explicam conceitos e preservam o histórico do desenho. O formato de transporte completo vigente é [openapi.json](../contracts/primeiro-marco/openapi.json), gerado por `build_contract.py`; por exemplo, o ack definitivo agrupa `receipt`, `replayed` e `projections`. Limites, erros, normalização e recuperação estão no README dos contratos. Não implementar o JSON abreviado como uma segunda API.

## 1. Interfaces dos módulos

| Módulo | Interface e responsabilidade |
|---|---|
| Identity | Autenticar, renovar/revogar sessão e identificar a conta. Senhas, credenciais e concessões de acesso não passam pelo sync de domínio |
| Hábitos | Receber comandos tipados de criação/edição e cumprimento; validar suas invariantes; devolver resultado e fatos canônicos |
| Gamificação | Aplicar a transição de cumprimento à concessão original de XP e ao orçamento diário; nunca aceitar um total de XP escolhido pelo cliente |
| Sync | Validar o envelope, deduplicar operações, ordenar dependências e chamar interfaces públicas; publicar confirmações e mudanças da conta |
| Repositório local | Persistir intenção e projeção na mesma transação; apresentar dados locais; incorporar confirmações/pull sem apagar intenções pendentes |
| Briefing | Consultar projeções por uma interface pequena, sem conhecer autenticação, filas ou protocolo de rede |

Proposta de composição: o ponto de entrada de sync chama a interface pública do módulo responsável. Mudança de cumprimento e efeito de XP participam da **mesma transação**; o evento interno correspondente é síncrono. Não usar um listener assíncrono após commit como garantia de XP já confirmado. Efeitos dispensáveis à confirmação, como telemetria opt-in, podem ser posteriores.

Essa regra permite comandos/consultas pelas interfaces públicas, preservando a proibição de acessar serviços internos de outro módulo, consolidada em `CLAUDE.md`. Não autoriza importar repositórios privados ou adicionar broker. A documentação do Spring distingue processamento no contexto transacional do publicador de listeners em transações posteriores; a escolha acima decorre do resultado atômico exigido pelo Ritmo. [Eventos no Spring Modulith](https://docs.spring.io/spring-modulith/reference/events.html).

## 2. Conta e sessão

Todos os endpoints usam `/api/v1`. Os tempos de access/refresh continuam 15 minutos e 30 dias, conforme REQ-CTA-004. Respostas com credenciais não são cacheáveis nem registradas em logs.

| Operação | Entrada | Resultado observável |
|---|---|---|
| `POST /auth/register` | e-mail, senha, nome e identificação da instalação | Conta e sessão criadas online; conflito de e-mail não cria segunda conta |
| `POST /auth/login` | e-mail, senha, identificação da instalação | Credenciais e `accountId` confirmado pelo servidor; abrir somente o armazenamento dessa conta |
| `POST /auth/refresh` | refresh token | Rotacionar uma vez, invalidar o anterior e entregar `RefreshResponse` sem `revokeToken`; preservar a capacidade original; uma renovação em voo por sessão no app |
| `POST /auth/revoke` | credencial limitada de revogação da sessão | Revogar a família de refresh; repetição/expiração já resolvida retorna sucesso sem revelar dados |
| `POST /auth/password-reset/request` | e-mail | Resposta uniforme; quando aplicável, enviar link de uso único com validade de uma hora |
| `POST /auth/password-reset/confirm` | token do link, nova senha | Consumir o token uma vez, invalidar outros links anteriores da mesma conta e revogar sessões antigas; dados locais continuam preservados até nova autenticação |

Recuperação (definição consolidada em 27/09/2026): solicitar outro link não invalida os anteriores. Uma confirmação bem-sucedida troca a senha, invalida todos os links ainda abertos da conta e revoga suas famílias de refresh na mesma transação. Solicitações processadas depois dessa confirmação podem gerar um link novo. O link usa `https://<host-da-api>/password-reset#token=<base64url>`; abrir o endereço não consome o token, somente o POST de confirmação. A resposta não cria sessão. Configuração e limites de entrega: [operação de e-mail](../api/ops/email-recovery.md).

Proposta para a revogação offline: ao autenticar, entregar também uma credencial aleatória limitada a revogar aquela sessão, cujo hash fica no servidor. Ela não autentica, não lê dados e não renova tokens. No logout, remover access/refresh do SecureStore, encerrar acesso local, parar o sync de domínio e manter somente essa credencial em uma fila protegida no SecureStore até conseguir revogar. O SQLite guarda apenas a referência opaca à chave protegida. Isso evita guardar um refresh utilizável para reentrar após logout, comportamento não aprovado.

Após logout, usar um contador local de geração de sessão: uma resposta tardia de A não pode ser aplicada em B. Se um envio de A já foi confirmado no servidor mas a resposta foi ignorada após logout, a pendência pode ser reenviada na próxima autenticação como A; a deduplicação impede efeito duplicado.

Para simplificar a recuperação, manter o banco completo da conta, incluindo o cache sincronizado, isolado e fechado após logout. Não usar e-mail como chave do armazenamento nem mesclar bases ao autenticar outro `accountId`. Não há promessa de criptografia de todo o SQLite nesta proposta; o isolamento é o de acesso pela aplicação já aprovado.

Se a resposta de uma rotação de refresh se perder depois do commit e o cliente não tiver o token novo, solicitar autenticação online, preservando o uso local e as pendências. Não manter o refresh antigo válido indefinidamente para esconder esse caso de falha. A confirmação de exclusão de conta é distinta: um `401` não a comprova e não apaga o banco.

Onboarding persiste progresso local por conta. `onboarded_at` e a configuração confirmada seguem para o servidor; fechar/reabrir durante o fluxo não reinicia os passos. Telemetria permanece desligada até consentimento. Endpoints de autenticação são uma exceção à fila de alterações de domínio: exigem rede e passam por Identity, nunca por um componente chamando HTTP diretamente.

## 3. Escrita local e envelope de comando

Uma interação cria a operação e atualiza sua projeção numa única transação local. Falha de armazenamento significa que a ação **não foi salva**: desfazer o feedback otimista e informar o erro. Não mostrar sucesso durável se a fila não foi persistida.

Envelope lógico, antes de definir os schemas de validação na implementação:

```json
{
  "operationId": "01952f6d-0000-7000-8000-000000000001",
  "deviceId": "01952f6d-0000-7000-8000-000000000002",
  "clientSequence": 12,
  "occurredAt": "2026-09-25T13:00:00Z",
  "dependsOn": [],
  "command": {
    "type": "habit.mark",
    "habitId": "01952f6d-0000-7000-8000-000000000003",
    "dayKey": "2026-09-25",
    "timeContext": { "timezone": "America/Sao_Paulo", "dayStartHour": 4 },
    "observedUndoIds": []
  }
}
```

- `operationId` identifica a intenção, não a linha de domínio. Mantém-se em retry; corrigir uma operação definitivamente recusada gera outra operação, ligada à anterior para rastreabilidade.
- A conta vem da sessão autenticada. O servidor não aceita `userId` do payload como autorização.
- `deviceId` identifica a instalação, não concede acesso. `clientSequence` e `dependsOn` preservam precedências locais; dependência desconhecida adia o processamento, não autoriza ignorar contexto.
- `dependsOn` inclui a criação ainda não confirmada e a ação local anterior que a nova ação pressupõe, além dos desfazeres referenciados. Lacunas numéricas em `clientSequence` não são dependências implícitas: coalescência pode deixar lacunas. Validação exige sequência inteira segura e crescente por conta/instalação, e dependências acíclicas; reinstalação usa outro `deviceId`.
- `occurredAt` e `timeContext` explicam o `dayKey` escolhido. O servidor valida formato, fuso, limites e contexto sem reinterpretar registros antigos pelo perfil atual. Horário do aparelho não desempata edições concorrentes.
- O conteúdo de uma operação enviada fica congelado, inclusive ao reagrupar o lote. Mesmo ID com conteúdo diferente é erro de protocolo. Coalescência só ocorre antes de envio e quando preserva intenção e dependências.

Comandos do caminho mínimo: `profile.setOnboarding`, `habit.create` (binário/diário), `habit.patchMetadata`, `habit.mark`, `habit.unmark`; o incremento de 30/09/2026 acrescenta `habit.delete` para cobrir tombstones/M1-13. Arquivamento continua para o incremento de gestão; confirmação visual de exclusão segue REQ-HAB-007 e depende do protótipo; não introduzir comandos de módulos futuros para justificar uma arquitetura genérica. Alterações de agenda/meta posteriores obedecem a REQ-HAB-007b e não se confundem com `patchMetadata`.

O patch de metadados contém somente campos alterados e validados. Título editado num aparelho não sobrescreve cor ou ícone alterado no outro. Um mesmo campo concorrente segue a ordem de aceitação do servidor. Campos interdependentes não são mesclados sem validação conjunta.

## 4. Marcar, desfazer e remarcar

Chave lógica de cumprimento: `(accountId, habitId, dayKey)`. O identificador da concessão corresponde a essa chave, não ao UUID de cada marcação local.

Proposta de algoritmo mínimo para Q11: cada desfazer tem seu próprio `operationId`; uma marcação informa os desfazeres que já havia incorporado, em `observedUndoIds`, incluindo os ainda locais. O servidor valida que cada referência é um desfazer do mesmo cumprimento/conta. Referências locais ainda não processadas são dependências explícitas.

Para uma chave, seja `U` o conjunto dos desfazeres aceitos. O cumprimento está ativo se existir uma marcação aceita cujo contexto contenha **todos** os IDs de `U`. Uma nova remoção desconhecida invalida marcações anteriores/concorrentes; uma marcação que incorpora todos os desfazeres pode restabelecer o cumprimento.

| Fatos conhecidos após convergência | Estado |
|---|---|
| A marca e B marca, sem desfazer | Cumprido uma vez |
| A marca, A desfaz; B marca sem conhecer esse desfazer | Desmarcado |
| A desfaz U; depois marca incluindo U | Cumprido novamente |
| A desfaz U1, B desfaz U2; A remarca conhecendo só U1 | Desmarcado, pois U2 ainda prevalece |
| Depois de incorporar U1 e U2, nova marca inclui ambos | Cumprido novamente |

Não substituir o conjunto por "maior timestamp" ou "maior revisão de desfazer": conhecer um desfazer de revisão maior não prova que o aparelho conhecia todos os anteriores de outros aparelhos. Não introduzir framework de CRDT ou event sourcing geral; este contexto é específico do cumprimento binário.

A representação canônica devolve o estado, os IDs de desfazer e uma revisão. O cliente mantém esse estado como base e reaplica suas operações pendentes sem acrescentar ao contexto informações que só chegaram depois da ação. Atualizar silenciosamente `observedUndoIds` durante retry transformaria uma marcação antiga numa remarcação consciente e violaria Q11.

**Verificação documental executada:** cinco cenários, suas permutações de chegada e repetição das operações, totalizando 52 avaliações do estado final, convergiram para os resultados acima. Isso valida apenas o modelo matemático; dependências do protocolo, persistência, segurança e XP precisam dos testes de integração da §9.

## 5. XP e transação de aceitação

A transação de um comando aceito inclui: fato de hábito, estado diário, eventual concessão/reversão/restauração de XP, orçamento consumido, recibo idempotente e envelope de mudanças. Se qualquer efeito obrigatório falhar, nenhum é confirmado.

No primeiro marco, a concessão nominal é 10 XP por cumprimento elegível. Aplicar o teto de REQ-GAM-002; o orçamento consumido é separado do total de XP válido. Desfazer inativa a concessão e não devolve orçamento; remarcar restaura a mesma concessão, preservando valor/dia e sem novo consumo. Duas marcações em aparelhos diferentes não criam duas concessões.

A primeira avaliação elegível registra também a decisão de **não conceder** quando o limite impedir o prêmio. A ausência de uma linha de XP não significa “ainda não avaliado”. Desfazer/refazer esse cumprimento mantém a decisão original sem prêmio, conforme REQ-GAM-003a; não aproveitar um limite aumentado posteriormente para conceder no refazer. Criar uma decisão por origem canônica, ligada à concessão quando existente.

Q31, aprovada em 30/09/2026: conceder o prêmio nominal somente quando couber integralmente no saldo do teto; caso contrário, confirmar o cumprimento com decisão `limit_reached`, sem nova concessão e sem prêmio parcial. Desfazer/refazer mantém a decisão original.

O cliente calcula uma projeção provisória para responder offline. O servidor devolve as concessões aceitas e o orçamento reconciliado; a projeção local se recompõe deles e das operações ainda pendentes. `user_progress` continua um cache. Um comando não pode enviar `totalXp`, editar um prêmio ou devolver orçamento por conta própria.

Serializar comandos canônicos por conta com uma linha de controle bloqueada dentro da transação. Depois de obter o bloqueio, reler o estado e atribuir a próxima revisão; gravar o resultado e fazer commit antes de responder. Isso estabelece a ordem de aceitação e impede usar apenas uma sequência alocada antes de commits concorrentes como cursor seguro. A documentação do PostgreSQL confirma a duração e o conflito de locks de linha; o uso de uma linha por conta é uma escolha desta proposta. [Locks de linha no PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).

## 6. Push, confirmação e erros

`POST /api/v1/sync/push`: até 50 comandos por lote. A chave de idempotência do lote identifica uma tentativa com conteúdo fixo; a deduplicação por `(accountId, operationId)` continua necessária se o lote for dividido ou reenviado de outra forma. Não depender só do UUID da entidade.

Cada comando tem transação própria. Uma resposta perdida não torna o lote indivisível: os comandos já confirmados devolvem o resultado anterior; os demais podem continuar. Respeitar dependências, inclusive entre comandos do mesmo lote.

| Resultado por operação | Persistência e ação do cliente |
|---|---|
| `accepted` | Fato e efeitos confirmados; retirar da fila pendente e incorporar a representação canônica por revisão |
| `reconciled` | Operação reconhecida, mas sem efeito adicional ou vencida pela regra automática; não apresentar como erro |
| `rejected` | Motivo definitivo e recuperável; manter conteúdo, retirar de retry automático e permitir correção/descarte |
| `deferred` | Dependência ainda não resolvida; preservar a operação e esperar a dependência antes de tentar novamente |

Dependência **definitivamente rejeitada** produz `rejected` com `dependency_rejected`, não `deferred` permanente. Preservar a cadeia e explicar o impedimento de forma agrupada. Ao escolher corrigir, criar novas operações e novas referências para as intenções recuperadas; nunca mudar o conteúdo/ID de operações já enviadas. Descartar a operação pai não descarta silenciosamente as filhas: mostrar quais intenções ficam bloqueadas e permitir recuperá-las ou descartá-las explicitamente. Antes do envio, esse bloqueio pode ser registrado localmente como `blocked_local`, sem inventar uma rejeição do servidor.

Concretização de 28/09/2026: interface local de listagem/correção/descarte preserva envelope/recibo e registra resolução no JSON de erro local (spec/00 §12.3). Correção é transacional e remapeia referências sem truncar contexto; não transforma resultado incerto em nova intenção. A API ordena dependências presentes no lote, retorna resultados na ordem da requisição e identifica ciclos entre operações ainda sem recibo. Replays mantêm o resultado anterior. `dependencyIds` aponta as dependências rejeitadas ou participantes do ciclo. Dependência ausente fora do lote continua `deferred`; o servidor não mantém um grafo durável de operações adiadas entre requisições. [Evidências](../docs/analises/2026-09-28-recuperacao-de-rejeicoes.md).

`replayed: true` informa repetição de uma operação já processada; não é nova aceitação. O resultado de negócio e a revisão originalmente atribuída permanecem iguais. A resposta pode trazer projeções **atuais**, explicitamente versionadas, sem fingir que o retry produziu essas mudanças. Nunca sobrescrever o recibo original com outro conteúdo para o mesmo ID.

Exemplo de resposta abreviada:

```json
{
  "results": [{
    "operationId": "01952f6d-0000-7000-8000-000000000001",
    "status": "accepted",
    "replayed": false,
    "acceptedRevision": "42",
    "canonical": {
      "habitId": "01952f6d-0000-7000-8000-000000000003",
      "dayKey": "2026-09-25",
      "done": true,
      "knownUndoIds": [],
      "revision": "42",
      "xp": { "amount": 10, "active": true, "dayKey": "2026-09-25" }
    }
  }]
}
```

A confirmação local aplica resultado canônico e muda o estado da fila na mesma transação. Comparar revisão **por entidade/projeção**, nunca descartar globalmente tudo abaixo da maior revisão vista: receber hábito X na revisão 42 não significa já ter recebido hábito Y na 41. Revisões de 64 bits usam strings decimais no transporte. `acceptedRevision` **não avança o cursor de pull**: pode haver mudanças intermediárias de outro aparelho ainda não recebidas.

Erros mínimos tipados: validação de campo, título indisponível, recurso inacessível, data inválida, reutilização de ID com outro conteúdo, dependência ausente, sessão inválida e versão incompatível. Não distinguir recurso de outra conta de recurso inexistente. `401` leva ao fluxo de autenticação; `426` preserva leitura local; falha de rede/servidor permanece transitória. Resposta definitiva não pode cair em retry infinito. O mapeamento HTTP completo acompanhará os schemas de endpoint, sem criar strings de UI dentro do protocolo.

## 7. Pull, reinício e ressincronização

Usar cursor opaco autenticado pelo servidor, vinculado à conta, versão do protocolo e época do conjunto de mudanças. Internamente, ele representa uma revisão de conta; não usar apenas `updated_at` ou relógio do aparelho.

`GET /api/v1/sync/pull?cursor=...`: a primeira página fixa uma revisão superior `H` já confirmada. Páginas seguintes percorrem os envelopes imutáveis até `H`, em ordem. Mudanças posteriores ficam para o próximo ciclo. Proposta: até 500 envelopes por página; cada envelope contém todos os efeitos da transação de origem e não é cortado entre páginas.

Exemplo lógico:

```json
{
  "changes": [{
    "revision": "42",
    "operationResults": [{
      "operationId": "01952f6d-0000-7000-8000-000000000001",
      "status": "accepted",
      "acceptedRevision": "42"
    }],
    "entities": [
      { "kind": "habitDay", "key": "habit-id/2026-09-25", "value": {} },
      { "kind": "xpGrant", "key": "grant-id", "value": {} }
    ]
  }],
  "nextCursor": "opaque-server-cursor",
  "hasMore": false
}
```

`value: {}` é apenas abreviação deste exemplo; na implementação cada `kind` exige seu schema completo. Tipos desconhecidos só podem ser ignorados quando declarados opcionais/compatíveis; uma mudança essencial não compreendida exige atualização. Não avançar cursor descartando efeitos obrigatórios.

Cada envelope identifica suas operações resolvidas por `operationResults`; essa confirmação pertence à mesma transação dos fatos. Aplicar entidades, reconhecer/remover da projeção as intenções já resolvidas, recompor apenas as restantes e persistir `nextCursor` na mesma transação local. Após morte do processo, repetir a página é seguro. Não substituir toda a base visível e perder alterações ainda não enviadas.

Exemplo obrigatório: A muda título, o commit ocorre e o ack se perde; B muda o título depois. Ao receber o feed, A reconhece a própria operação já processada e mantém o título de B. Não reaplicar a edição antiga de A sobre esse estado. Rejeições definitivas que não alteram fatos continuam recuperáveis pelo recibo no próximo push; não depender de um evento de domínio para comunicar rejeição.

Quando o cursor expirar ou não cobrir mais os 90 dias de tombstones, retornar `resync_required`. Fazer snapshot completo consistente numa revisão `H`, paginado a partir de uma representação estável. Construir a nova base em área separada, preservar fila/rejeições e só trocar a base após validar todas as páginas; então retomar o pull depois de `H`. Se o snapshot expirar, reiniciar sua cópia, não apagar pendências.

Antes da troca do snapshot, consultar recibos de **todas as operações locais sem confirmação**, em lotes, por `POST /api/v1/sync/receipts` (consulta autenticada, sem executar comandos). Vincular a consulta ao snapshot `H`: retornar resultado processado até `H` ou `notProcessedAtH`, sem revelar efeitos posteriores a esse corte. A ausência em `H` é provisória, não autorização para recriar uma intenção com outro ID. Incorporar recibos ao swap, preservar operações realmente pendentes e retomar o feed após `H`; mudanças posteriores e seus recibos chegam nele. Um recibo definitivo de rejeição, sem revisão de domínio, pode ser reconhecido imediatamente. A estratégia de snapshot precisa impedir confirmação concorrente no app durante o swap e reter o feed após `H` enquanto a cópia estiver válida.

Manter recibos mínimos de operações e um registro mínimo de IDs de entidades excluídas além da janela do feed, enquanto a conta existir. Isso impede que um dispositivo muito antigo recrie um hábito excluído ou repita uma concessão porque o tombstone saiu do feed. Esses registros também entram no fluxo de exclusão da conta; não são exceção de retenção permanente após exclusão.

## 8. Persistência e recuperação local

Separar base canônica recebida, fila de intenções e projeções locais. Projeções são descartáveis somente quando puderem ser reconstruídas; a fila sem confirmação não é. A troca de conta seleciona outro armazenamento e outra geração de sessão.

No adapter SQLite, delimitar a transação e serializar escritores da conta. A documentação do Expo alerta que consultas assíncronas externas podem participar de `withTransactionAsync`; `withExclusiveTransactionAsync` exige usar o objeto da transação e pode gerar conflito entre escritores. Verificar a API da versão fixada antes de implementar, sem copiar um wrapper Drizzle que use a conexão errada. [Transações SQLite no Expo](https://docs.expo.dev/versions/latest/sdk/sqlite/#withexclusivetransactionasynctask).

Migration falha: manter uma cópia recuperável da base e das intenções; não executar reset destrutivo. Não prometer reconstrução via servidor quando a única cópia de alterações ainda está no aparelho. Login inválido, disco cheio ou versão antiga não são autorização para limpar a base.

## 9. Cenários de aceite do contrato

| ID | Cenário | Resultado verificável |
|---|---|---|
| M1-01 | Cadastro/login e onboarding interrompido | Retomar conta e passo correto; pular hábito produz Briefing útil |
| M1-02 | Criar/marcar sem rede e reiniciar | Hábito, intenção, estado e XP provisório preservados |
| M1-03 | Dois aparelhos marcam o mesmo dia | Um cumprimento e uma concessão |
| M1-04 | Desfazer concorre com marcação desconhecida | Desmarcado nas duas ordens de chegada; sem XP ativo desse cumprimento |
| M1-05 | Remarcar após incorporar desfazer | Restaurar a mesma concessão, sem novo consumo do teto |
| M1-06 | Dois desfazeres concorrentes e remarcação que conhece só um | Permanecer desmarcado até uma marcação incorporar ambos |
| M1-07 | Servidor faz commit e a resposta se perde | Retry não duplica fato, XP, consumo ou revisão |
| M1-08 | Confirmação de revisão 42 chega antes de pull da 41 | O cursor não pula a mudança 41 |
| M1-09 | Processo morre entre aplicação de página e cursor | Transação inteira confirma ou página inteira pode ser repetida |
| M1-10 | Logout offline, entrar B e depois A | B não consulta/exporta/envia A; A recupera pendências após login online |
| M1-11 | Rejeição definitiva ou `401` | Rejeição recuperável sem retry infinito; `401` preserva dados |
| M1-12 | Virada lógica, fuso e envio tardio | `dayKey` gravado preservado; novo dia calculado corretamente; transporte tardio não expira fato válido |
| M1-13 | Cursor antigo ou migration falha | Recuperação preserva intenções; entidade excluída não reaparece |
| M1-14 | Falha ao conceder XP no servidor | Não confirmar só o cumprimento; rollback de efeitos obrigatórios |
| M1-15 | A tenta referenciar hábito/operação de B | Nenhum dado de B lido ou alterado, inclusive por contexto/dependência |
| M1-16 | Payload do mesmo `operationId` muda | Rejeitar conflito de protocolo sem reaplicar a operação |
| M1-17 | Teto consumido, desfazer e refazer | Não devolver orçamento nem duplicar consumo; prêmio segue a concessão original |
| M1-18 | Ack perdido, edição posterior em B e pull/snapshot em A | Reconhecer intenção de A já processada; não reaplicá-la sobre a edição de B |
| M1-19 | Criação rejeitada e marcação dependente | Bloqueio recuperável; sem espera/retry infinito, correção com nova cadeia e sem perda de conteúdo |
| M1-20 | Primeira avaliação sem prêmio por teto; desfazer/refazer | Continuar sem prêmio mesmo se o limite disponível mudar; não confundir ausência de XP com ausência de avaliação |

Executar cenários pelo ponto de entrada real do módulo/repositório. Testes de transação, isolamento e cursor precisam de bancos reais; o modelo matemático da §4 não os substitui. A validação visual final depende do protótipo; contratos e cenários podem ser exercitados antes dela.

## 10. O que falta para liberar implementação

1. Preparação concluída: [contratos executáveis](../contracts/primeiro-marco/README.md) com 11 endpoints, 51 schemas e 48 fixtures após o ajuste de refresh; a extensão de exclusão em 30/09/2026 totaliza 52 schemas e 49 fixtures. DDL incorporado ao modelo; migrations/roles e testes de integração já executados no recorte técnico, com cobertura parcial da matriz M1 registrada nos relatórios.
2. Baseline e caminhos de build documentados na [pesquisa de stack](../docs/analises/2026-09-25-stack-e-build-primeiro-marco.md). Java 21 preservado; Boot 4.1.1/Modulith 2.1.1 substituem a linha Boot 3 sem suporte aberto. Dependências, build Android técnico e testes locais/integrados já foram executados nos recortes documentados; o aceite completo nos aparelhos permanece pendente. Pedro informou não ter assinatura Apple Developer; rota EAS física no iPhone depende disso ou de alternativa local com Mac.
3. Definir configuração operacional de e-mail, segredos, deploy e restore de backup, sem gravar credenciais nos docs.
4. Completar M1-01 a M1-20 com fixtures/testes de implementação. A cobertura parcial está registrada nos relatórios; a matriz inteira ainda não passou.
5. Integrar a direção recebida em 09/10/2026 conforme spec/11 e os recortes de interface M1. O gate de disponibilidade da referência foi atendido; implementação e aceite visual nos aparelhos continuam necessários.

Contextos têm limite técnico explícito e não podem ser truncados. Recovery, retenção e snapshot foram concretizados no README dos contratos. Q31 fecha o saldo parcial para o incremento que reduz N: prêmio inteiro ou nenhum XP. Nenhum desses detalhes autoriza mudar silenciosamente decisões de produto.


## 11. Incremento de execução automática — 28/09/2026

O scheduler implementa o núcleo de REQ-SYN-005/008, preservando contratos HTTP m1.1 e schema SQLite. Tentativas transitórias de push são duráveis; o estado público `failed` corresponde a `blocked_local`/`retry_exhausted`, conforme spec/00 §12.3. Retry conserva a operação original; correção de rejeição definitiva continua exigindo operação nova. Backoff e Retry-After valem mesmo após um novo gatilho de rede/foreground.

Geração de sessão protege os ciclos em andamento na troca de conta; revogações usam fila independente, inclusive após logout sem outra conta ativa. A fábrica nativa reúne sessão, rede e ciclo de vida. Testes exercitam reinício, ack perdido, não duplicação de XP, espera persistida, limites, 401/426 e A/B. Isso amplia a evidência de M1-02/07/10/11/18 sem declarar esses cenários integralmente aceitos nos aparelhos.

UI de aviso/correção, leitura local obrigatória por atualização, contexto/ciclos, matriz ampliada de snapshots/migrations e operação real continuam pendentes. [Evidências, comandos e limites](../docs/analises/2026-09-28-sincronizacao-automatica.md).


## 12. Incremento de recuperação de rejeições — 28/09/2026

M1-19 e o núcleo de REQ-SYN-017 têm recuperação local testada por interfaces públicas, SQLite e API/Postgres reais: preservar rejeição/cadeia, corrigir com novas identidades/referências ou resolver somente o descarte escolhido. M1-11 foi ampliado para distinguir resultado incerto de rejeição recuperável e manter isolamento entre contas. A resolução local usa o JSON já existente, sem alterar schemas HTTP ou DDL.

Contexto excedente fica preservado e bloqueado, sem compactação/truncamento. Correção que criaria ciclo é recusada atomicamente. Ciclos do lote e dependências rejeitadas têm respostas definitivas; nenhuma prova de rejeição é inferida de dependência ausente. [Relatório e limites](../docs/analises/2026-09-28-recuperacao-de-rejeicoes.md). UI e aceite nos aparelhos continuam abertos; a matriz M1 completa ainda não está aceita.


## 13. Incremento de snapshots e abertura segura — 28/09/2026

M1-13/18 receberam validação adicional: 501 envelopes de feed, snapshot com 502 entidades, corte H estável apesar de escrita entre páginas, recibos em lotes e cópia interrompida com novas ações locais. A cópia usa staging por página; uma nova execução reinicia pelo manifesto sem substituir a base incompleta. Snapshot inacessível/expirado reinicia uma vez e depois cede ao backoff limitado. Cursor sem progresso ou corte divergente interrompe a página sem avançar o cursor. A troca reconhece somente recibos compatíveis com H e retoma o feed antes de novos envios.

A abertura dos bancos locais interrompe schema desconhecido ou migration falha com erro tipado, preservando arquivos e intenções. Não há reconstrução automática nem mudança de schema neste incremento. A API responde `404 resource_inaccessible` para cursor de snapshot inválido/de outra conta; cursor inválido de pull mantém `409 resync_required`.

[Validação conjunta e limites](../docs/analises/2026-09-28-snapshots-e-migrations.md); [abertura/migrations](../docs/analises/2026-09-28-abertura-segura.md). O teste de migration usa uma evolução descartável sobre a base inicial real; cada evolução de produção futura continua exigindo sua própria fixture. M1-13 não está integralmente aceito: exclusão/tombstones, reparo de corrupção física e UI ainda dependem de seus recortes. Modo somente leitura obrigatório por versão incompatível e HTTP nativo permanecem próximos passos, com UI subordinada ao protótipo.


## 14. Incremento de compatibilidade — 29/09/2026

REQ-SYN-014 tem núcleo persistente: incompatibilidade exige leitura local, preserva pendências e não avança a página com efeito essencial desconhecido. `Session` protege escrita e troca de conta; identidade, sync e scheduler compartilham o estado da instalação. Um build diferente precisa de resposta válida para liberar escritas. Campos opcionais continuam tolerados. A API mantém `min_supported_version` na configuração global com SELECT apenas para runtime; a política é aplicada antes de autenticação/escrita.

Migrations Drizzle 0001 e Flyway V3 e cabeçalho SemVer foram incorporados ao modelo/contrato. O corpo das mensagens continua m1.1. [Evidências e limites](../docs/analises/2026-09-29-compatibilidade-e-leitura-local.md). O próximo recorte é HTTP real no harness Android; UI de atualização e aceite em iPhone permanecem abertos, assim como o restante da matriz M1 e a operação real.


## 15. Evidência de HTTP nativo Android — 30/09/2026

M1-02 recebeu prova com SQLite/SecureStore nativos: criar/marcar offline, encerrar o processo com o banco aberto e recuperar exatamente envelopes/projeção e credenciais. AppState/expo-network reais preservam a pausa em segundo plano e acionam convergência ao voltar ao primeiro plano. Replays e uma marcação pelo segundo cliente conservam uma concessão de 10 XP; refresh rotacionado permanece utilizável após nova abertura.

[Relatório e reprodução](../docs/analises/2026-09-30-http-nativo-android.md). O segundo cliente é SQLite/HTTP de desktop; não há aceite entre Android e iPhone. Replay explícito amplia M1-03/07, mas não injeta perda de resposta na rede nativa. M1-04/06 e M1-12 continuam entre os próximos cenários a completar. UI/protótipo, demais lacunas da matriz e operação permanecem abertos; contratos HTTP e schemas não mudaram neste incremento.


## 16. Evidência de concorrência binária — 30/09/2026

O núcleo de M1-04/06 passou por duas sessões, SQLite por cliente e HTTP/Postgres reais. Desfazer vence marcação sem contexto nas duas ordens e em envios simultâneos. Dois desfazeres vencem remarcação que conhece só um nas três ordens que preservam sua dependência. Incorporar ambos permite restaurar a mesma concessão, com valor/dia e orçamento original preservados; as transições intermediárias permanecem no histórico.

Envelopes sobrevivem à reabertura; uma confirmação descartada é reconhecida no pull. Reenvios retornam o recibo original sem alterar a revisão global ou efeitos, e confirmações antigas não fazem a projeção retroceder após restauração. A projeção local também incorpora o desfazer remoto enquanto há remarcação parcial pendente. O incremento amplia M1-05/07/17; o núcleo existente passou sem alteração de produção ou contrato.

[Relatório e reprodução](../docs/analises/2026-09-30-concorrencia-binaria.md). Esta é evidência de clientes SQLite de desktop, sem novo aceite Android/iPhone ou UI. M1 e tarefa 05 continuam abertos. O próximo recorte é M1-12; exclusão/tombstones, operação e demais lacunas da matriz continuam pendentes.


## 17. Evidência de datas e fusos — 30/09/2026

O núcleo de M1-12 agora inclui getDayKey no app, resolução explícita de lacunas/sobreposições na API e Clock de domínio injetável. A validação usa o contexto original para a janela retroativa e o perfil atual somente para o limite futuro do servidor. Foi corrigida a recusa indevida de registro na lacuna de Chatham e a aceitação de dia acima do limite com contexto divergente.

SQLite/HTTP/Postgres reais provam mudanças offline de fuso/início, envelopes preservados após reabertura, duas semanas de transporte tardio e concessão/orçamento no dia de destino. Exatamente sete dias retroativos é válido na criação; oito dias, data antes do início ou depois do dia da ação e relógio acima de 24h recebem rejeição recuperável sem efeitos. Exemplos compartilhados verificam offsets fracionários, mês/ano, ano bissexto e dias de 23/25h.

[Relatório e reprodução](../docs/analises/2026-09-30-datas-e-fusos.md). Tarefa 05 e M1 continuam abertos: os clientes são de desktop, sem aceite Android/iPhone neste recorte. Timer/integração visual da virada e confirmação de mudança detectada de fuso aguardam o protótipo. Próximo recorte: exclusão/tombstones de M1-13; operação e demais lacunas permanecem pendentes. Schema e HTTP m1.1 foram preservados.


## 18. Contrato do incremento de exclusão — 30/09/2026

`habit.delete` contém apenas `type` e `habitId` no envelope normal; a camada de apresentação deve exigir a confirmação de REQ-HAB-007 antes de enfileirar. O núcleo persiste a intenção offline e remove o hábito/XP da projeção. Aceitação marca `deleted_at`, grava `sync_deleted_ids`, invalida cumprimentos projetados e reverte concessões ativas, com transições, sem devolver consumo. Atualiza N dos orçamentos afetados pelo início do hábito. Tudo participa da mesma transação/revisão/recibo.

Q30 altera a regra antiga de spec/04 §7: histórico de produto indisponível; manter fatos/contextos/IDs e histórico técnico de XP para reconciliação, sem recuperá-los como hábito ativo. ID excluído não pode ser recriado. Nova edição/marcação/desfazer/exclusão sobre recurso excluído recebe `resource_inaccessible`; tentativa de criar novamente recebe `id_content_conflict`. Recibo original aceito continua aceito no replay. Exclusão concorrente vence qualquer ordem de edição/marcação.

Tombstone é uma invalidação definitiva do hábito e do XP ligado aos seus cumprimentos, inclusive durante rebase de pendências ou chegada de ack antigo. Pendências não são apagadas: o servidor as classifica, conservando rejeições recuperáveis. Snapshot conserva tombstones e registro mínimo de IDs, mesmo após a janela do feed.

Não aumentar silenciosamente o limite existente de 32 entidades por envelope. Exclusão com mais efeitos devolve no ack o tombstone, preserva o envelope completo interno e obriga `resync_required` quando o pull cruzaria essa transação. O cliente recupera o snapshot estável/paginado, consultando recibos em H antes do swap. Nenhuma página do feed corta a transação; o tombstone torna o hábito/XP inválidos imediatamente enquanto a cópia segue. Replay do recibo extenso mantém essa resposta limitada.


## Rate limiting do transporte — 30/09/2026

Quotas do primeiro marco aprovadas na Q32: [spec/07 §4.1](07-nao-funcionais-e-lgpd.md#41-rate-limiting-do-primeiro-marco--q32-30092026). A recusa 429 usa rate_limited e Retry-After; pressão no armazenamento limitado de buckets usa 503/Retry-After. Não produz recibo nem alteração de domínio/credencial. A fila local mantém o mesmo envelope e respeita a espera, inclusive após reabertura. O campo opcional retryAfterSeconds conserva o intervalo m1.1 de 1 a 300 ou null; o cabeçalho transporta integralmente uma espera maior configurada pelo operador. [Evidências e limitações](../docs/analises/2026-09-30-rate-limiting.md).


## 19. Contenção e retomada operacional — 02/10/2026

REQ-NFR-004, REQ-CTA-004b e ADR-019. `RITMO_RECOVERY_QUARANTINE=true` configura `ritmo.operations.quarantined` fora do banco restaurado. Em toda rota `/api/v1/`, devolver **503 `temporarily_unavailable` m1.1** antes de quota, compatibilidade, leitura de corpo, autenticação ou SQL de requisição. Não confundir com 426/update_required, não descartar intenções nem bloquear escrita local. Sem endpoint remoto de liberação. Configuração inválida impede startup; ausência equivale a false para operação normal de uma instalação não restaurada. Operador deve ativar a quarentena antes de iniciar qualquer API sobre dados recuperados e manter o destino isolado.

Após comprovar completude, parar a API e todos os escritores; executar `api/ops/prepare-recovery.sh` como administrador/dono das migrations. Exigir no ambiente `RITMO_RECOVERY_QUARANTINE=true` e `RITMO_RECOVERY_VERIFIED=true`. A segunda variável é uma declaração do operador após verificação, não uma prova automática da cadeia. Em uma transação, invalidar famílias/refresh por `revoked_at` e links por `used_at`, sem mudar senha/dados de domínio, sem deletar recibos e sem imprimir segredos. Operação administrativa abrange todas as contas; não ampliar permissões ou consultas de domínio da API. Script recusa logins runtime, aceita dono das três tabelas de credenciais ou superusuário, e é repetível antes da reabertura.

Antes de reabrir, gerar uma chave de assinatura nova e diferente no cofre, configurar `RITMO_SIGNING_KEY` e reiniciar todos os processos com quarentena desativada somente após as verificações. Nenhum processo antigo pode seguir acessível. A chave antiga não deve ser aceita: access anteriores recebem 401; cursores antigos, após novo login, seguem `resync_required`/snapshot existente. Invalidar refresh/reset no banco é obrigatório além de rotacionar a chave. Preservar a senha correta recuperada.

Session/AccountStore mantêm acesso local e pendências após 503, expiração ou recusa de refresh; login como a mesma conta reabre o mesmo SQLite. Snapshot classifica pendências no corte antes de instalar base integral; não recolocar operações acknowledged na fila. Preservar isolamento do ADR-016 e nunca liberar cópia histórica incompleta. Sem novo schema, endpoint ou versão de mensagem neste recorte. A prova de completude pós-base/WAL pertence ao incremento 2; o procedimento do incremento 1 não pode afirmá-la sozinho.


## 20. Durabilidade remota do transporte — 02/10/2026

Engenharia de Q33/Q35, sem alteração da mensagem m1.1: com `RITMO_REQUIRE_WAL=true`, a API exige o receptor físico `ritmo_wal_receiver`, identificado por `application_name=ritmo_wal` e pelo slot físico ativo `ritmo_wal`, e `synchronous_standby_names='FIRST 1 (ritmo_wal)'`, `synchronous_commit=on`, `fsync=on` e `full_page_writes=on`. Ambos os datasources apontam para o mesmo cluster. O receptor usa `pg_receivewal --synchronous` e slot físico reservado antes da base, em disco independente. Essa configuração é obrigatória antes da exposição externa; desenvolvimento descartável sem receptor mantém a opção desativada.

A barreira emite um marcador vazio/não transacional com flush local (`pg_logical_emit_message(false, 'ritmo-durability', ''::text, true)`), cobrindo toda inserção anterior de WAL, e exige feedback `flush_lsn` do receptor síncrono pelo menos nessa posição, antes de executar a rota e novamente depois de produzir sua resposta. A resposta fica em memória até a segunda prova. Ela abrange leituras, recibos e replay, não apenas novos comandos. Ausência, configuração incompatível, erro de consulta, interrupção ou espera acima de `RITMO_WAL_WAIT_MS` (padrão 2000 ms; intervalo 1–10000) produz 503 `temporarily_unavailable`, sem expor o corpo preparado. A quarentena de recuperação precede essa barreira e não depende do banco. Escritas PostgreSQL podem aguardar mais tempo no commit; o operador limita conexão/leitura JDBC com `connectTimeout`/`socketTimeout`, mantendo o sincronismo. Não presumir que `statement_timeout` limite a espera do COMMIT; conexão perdida pode deixar backend aguardando o receptor. Resultado incerto preserva o mesmo envelope local.

Cancelar a espera síncrona não comprova rollback: um commit local pode ser visível. A segunda barreira impede publicá-lo enquanto não houver flush remoto; as barreiras nas leituras/replay também impedem confirmar posteriormente esse estado desprotegido. Reconexão e alcance do WAL permitem retomada idempotente. Não reduzir o sincronismo para liberar requisições.

Flyway V4 acrescenta apenas a função operacional `ritmo_wal_status(pg_lsn)`, sem tabelas/campos de produto. Com search_path fixo e sem SQL dinâmico, emite somente o marcador vazio na primeira consulta de cada barreira; consultas seguintes verificam a mesma posição. Devolve posição e booleano de proteção, não dados de contas nem metadados de conexão. PUBLIC não executa; somente ritmo_domain. Seu dono precisa enxergar estatísticas de replicação (superusuário de migrations na fixture ou pg_read_all_stats no provisionamento); falta de visibilidade falha fechada. Os logins de aplicação não recebem pg_read_all_stats, REPLICATION nem bypass de RLS.

A restauração física exige base com manifest verificado, WAL congelado incluindo `.partial` e históricos, timeline e alvo de recuperação comprovadamente posterior às confirmações. O alvo explícito mantém o PostgreSQL pausado até a verificação; uma cadeia que não o alcança não é promovida. O término de uma ferramenta, um alvo arbitrariamente antigo ou uma flag do operador não comprovam completude. Inventário, custódia/seleção de alvo no destino, retenção e jobs finitos foram concretizados localmente no [incremento 3](../api/ops/operations.md); a fixture seleciona o alvo após perder o primário, pela cadeia independente, incluindo a segunda timeline. Instalação/aceite externo permanecem obrigatórios no incremento 4; flags não provam quarentena, parada ou completude. Ver [procedimento de WAL](../api/ops/wal-recovery.md).

## 21. Retenção física do feed — Q49/Q50, 04/10/2026

Pedro aprovou **Q49=A**: os 90 dias abrangem todos os envelopes do feed, incluindo tombstones. A janela é de transporte, não prazo de validade das intenções locais ou autorização para apagar estado canônico, fatos/contextos necessários à reconciliação e histórico técnico de XP/orçamentos. Recibos mínimos, hashes de lotes e IDs excluídos continuam enquanto a conta existir, sujeitos à exclusão da conta já prevista.

Pedro aprovou **Q50=A**: expurgo automático diário, configurável e em lotes limitados. Conservar o feed após H de todo snapshot válido e permitir a retomada sem lacuna. Cursor que não cobre mais as revisões removidas recebe o `409 resync_required` existente, mesmo quando foi emitido recentemente. Snapshots expirados e seus itens podem ser removidos, coordenando a limpeza com página/recibos; o app conserva base/fila durante o reinício da cópia conforme §7.

Pedro confirmou o [plano consolidado](../.scratch/retencao-feed/spec.md) e as fronteiras de teste com “sim” em 04/10/2026. A implementação local usa V5/spec/00 §12.11, prefixo/limite atômicos, trava comum dos leitores e agenda por conta em lotes limitados. [Runbook](../api/ops/sync-retention.md) e [provas/estado da validação](../docs/analises/2026-10-04-retencao-fisica-do-feed.md); os ensaios usam o cleaner real. A [tarefa delimitada](../.scratch/retencao-feed/issues/01-expurgar-feed-e-snapshots.md) reúne cursor, expurgo, snapshot e execução diária. Tarefa 05/M1 e aceite externo permanecem abertos.


## 22. Recuperação de exceções — Q51/Q52/Q53, 07/10/2026

Pedro aprovou **A** em Q51, Q52 e Q53. [Entrevista](../.scratch/fundacao/entrevista.md), [diagnóstico](../docs/analises/2026-10-07-recuperacao-de-excecoes.md) e [plano confirmado](../.scratch/recuperacao-excecoes/spec.md). Estas definições complementam §§2/6/7/8; identidade, cofre e abertura foram concretizados em três entregas locais separadas, com evidências abaixo.

### Banco local e abertura

Q51 mantém arquivos e interrompe acesso à base ilegível; controle de instalação ilegível bloqueia abertura inteira. Fechar handles adquiridos, classificar falha e expor nova tentativa após corrigir causa/atualizar. Falha de abertura/PRAGMA/armazenamento não prova corrupção física. Não descobrir/abrir conta por arquivos ou credenciais soltas quando o controle for ilegível. Não remover/substituir a única cópia com pendências para instalar estado remoto. Reparo físico, exportação e reconstrução assistida pertencem a recorte próprio.

Concretização técnica do recorte 3 (08/10/2026), antes do código: a abertura pública mantém um owner com `recovery()`, `retryDatabase()` e `close()`. `session` só fica disponível após controle saudável. A sessão expõe `databaseRecovery()` e `retryDatabase()` para sua conta selecionada; `account()` permanece bloqueado durante a falha. O runtime Expo conserva o owner mesmo se a instalação não abrir e só inicia o scheduler após obter sessão.

O diagnóstico público é limitado a nome lógico da base, escopo (`installation/account`), etapa (`open/pragma/migration/initialize`), código estável e código SQLite reconhecido. Não inclui caminho absoluto, mensagem SQL, conteúdo nem credenciais. A exceção técnica conserva `cause` e eventual falha de fechamento, sem serializá-las nesse diagnóstico. `SQLITE_CORRUPT/SQLITE_NOTADB` estruturados permitem classificar base ilegível; falhas de armazenamento e causas desconhecidas permanecem distintas. Drivers que não entregam código estruturado recebem causa desconhecida, sem inferência por texto.

A abertura aplica PRAGMAs, histórico/migration e inicialização antes de publicar o handle; qualquer falha fecha o handle adquirido. Retry de conta captura a geração antes de aguardar a fila e revalida conta/estado após a abertura. Logout/fechamento invalidam uma abertura em andamento; retry não autentica, não reabre conta encerrada e não reutiliza intenções de outra conta. Retry de instalação relê exclusivamente o controle persistido e respeita `logging_out/locked`; nunca vasculha arquivos/cofre para escolher conta. Repetir a falha mantém o bloqueio. Estado de recuperação é derivado novamente após reinício; nenhum DDL ou formato HTTP muda.

### Cofre do dispositivo

Q52 permite leitura/escrita local somente com controle saudável `active` e banco da conta saudável. Indisponibilidade do SecureStore pausa acesso remoto, conserva referências e expõe retomada. `get` que lança erro não equivale a ausência/conteúdo inválido. Limpeza antiga incompleta conserva referência para retry; não reativa credencial antiga. Login novo continua exigindo persistência das credenciais antes da ativação; `logging_out/locked` conservam bloqueio. Refresh com resultado perdido conserva a regra de novo login online, sem reutilizar token antigo.

### Recibos e identidade

Correspondência do recibo à intenção deve ser comprovada antes de qualquer reconhecimento local, no ack/pull/swap de snapshot e após reinício. ID igual sozinho não prova conteúdo igual. Incorporar estado canônico não autoriza reconhecer envelope divergente como salvo. Preservar recibo original imutável, conteúdo divergente e evidência do conflito; não substituir um pelo outro.

Colisão de `operationId` com conteúdo diferente ou de `deviceId/clientSequence` não deve ser confundida com rejeição persistida de uma nova criação por ID de entidade existente/excluído. Rejeição comprovada segue o fluxo de correção/descarte já aprovado; identidade cujo resultado original continua incerto segue Q53: operação e dependentes preservados/bloqueados para intervenção técnica, independentes permitidos, sem descarte, nova identidade ou reenvio automático da intenção incerta.

Manter corte H: `notProcessedAtH` não prova rejeição nem autoriza recriar a intenção. Recibos posteriores continuam sujeitos à correspondência, assim como recibos antigos conservados além da retenção do feed. Conflito da chave de lote preserva fila/diagnóstico e não justifica mudar IDs individuais.

A prova física de correspondência, sua consulta/classificação, limites e estratégia de compatibilidade serão concretizados no contrato executável na [tarefa de identidade](../.scratch/recuperacao-excecoes/issues/01-reconciliar-identidade-e-recibos.md), antes do código. Não alterar silenciosamente m1.1; mudança incompatível segue o versionamento vigente. Campos persistidos novos exigem modelo atualizado e migration nova no mesmo commit; V1–V5 permanecem imutáveis.

### Entregas e aceite

[Identidade/recibos](../.scratch/recuperacao-excecoes/issues/01-reconciliar-identidade-e-recibos.md), [cofre](../.scratch/recuperacao-excecoes/issues/02-retomar-cofre-sem-bloquear-uso-local.md) e [abertura local](../.scratch/recuperacao-excecoes/issues/03-expor-recuperacao-da-abertura-local.md) são tarefas verticais separadas, ordenadas por risco. Cada uma exige testes pelas interfaces públicas e bancos reais, preservação/isolamento A/B, reinício/rollback/retomada e checks obrigatórios de app/API. Entendimento e fronteiras foram confirmados por Pedro com “sim” em 07/10/2026; cada recorte exige sua própria verificação. A preparação documental não conclui M1, UI/aparelhos ou operação externa.

### Concretização da correspondência — recorte 1, 07/10/2026

Extensão aditiva m1.1: `operationHash` opcional em Receipt/RejectedReceipt, SHA-256 hexadecimal minúsculo (64 caracteres) da Operation integral conforme RFC 8785, antes de normalização de negócio. A API atual sempre emite a prova para recibos persistidos, inclusive replay/pull/consulta em H; enriquece JSON histórico pelo `payload_hash` existente sem reescrever recibos/feed. É hash do envelope público, restrito à própria conta, nunca de credencial.

Colisão efêmera de operação/sequência devolve hash da tentativa e `error.identityConflict={kind:operation|sequence,originalOperationId,originalOperationHash}`. Não persiste outro recibo; original continua consultável pelo ID em H. Rejeição persistida por ID de hábito reutilizado não tem marcador; com hash correspondente segue correção/descarte.

App exige hash correspondente para reconhecer. Hash ausente/divergente ou marcador de colisão preservam/bloqueiam localmente, sem correção/descarte/reenvio automático. Campo ausente permanece JSON válido por compatibilidade, mas constitui prova insuficiente. O gerador dos validadores do app anterior remove additionalProperties das respostas, tolerando campos opcionais adicionais; o contrato de entrada da API permanece estrito. Não mudam comandos/rotas/cabeçalhos; implantar API antes do app. Backend anterior sem prova conserva o bloqueio no app novo.

JSON local de erro: `identity={reason:missing_proof|content_mismatch|operation|sequence,localOperationHash,originalOperationId?,originalOperationHash?,originalReceipt?,conflictReceipt?}`, limitado a um recibo original e um efêmero, persistidos após reinício. Dependentes usam `identity_dependency_unresolved`, também sem correção/descarte. Prova posterior exata pode resolver ausência de prova e liberar dependentes sem resultado mantendo IDs; recibo sem prova não apaga conflito conhecido. Snapshot consulta bloqueadas sem resolução; `notProcessedAtH` conserva o bloqueio.

Hash síncrono no escritor SQLite: @noble/hashes 2.4.0 e canonicalização de Operation (chaves em ordem UTF-16, arrays ordenados como enviados, números ECMAScript, sem normalização Unicode; recusar Unicode inválido/números não finitos). Nenhuma coluna/tabela nova: PostgreSQL já guarda hash e SQLite guarda error/result JSON. Sem migration; V1–V5 intactas. Plano e fronteiras confirmados por Pedro com “sim” em 07/10/2026.


No lote que contém colisão de identidade, operações novas dependentes (diretas/transitivas) ficam `deferred`, sem fato, XP, orçamento ou recibo persistido. `missingDependencyIds` referencia as intenções ainda sem correspondência comprovada no lote, mesmo que o ID tenha recibo de outro conteúdo. Independentes prosseguem; replay de um recibo já comprovado mantém seu resultado. Não concluir dependência pela existência isolada do ID original.


Ao abrir SQLite de um cliente anterior, resultados acknowledged/rejected sem prova e ainda sem resolução são preservados e classificados como `missing_proof`, junto das dependentes. Não reenviar operações antes reconhecidas: consultar prova pelo fluxo de snapshot. Resoluções já gravadas não são reabertas. Uma sincronização com impasses por prova ausente inicia uma nova consulta no corte antes de push; prova correspondente permite retomar os mesmos IDs das dependentes, sem afirmar que ausência em H é rejeição.

Entrega local do recorte 1: [evidências, validação e limites](../docs/analises/2026-10-07-correspondencia-de-recibos.md). Cofre e abertura permanecem em tarefas próprias; não encerrar M1 por esta entrega.


### Concretização do cofre — recorte 2, 07/10/2026

`Session.vaultRecovery()` expõe `{unavailable:boolean,cleanupPending:boolean}`, sem mensagens da plataforma, referências ou segredos. `Session.retryVault()` faz nova leitura da referência atual e limpeza das credenciais antigas, retornando esse estado; não promove chaves órfãs, não refaz login nem refresh. unavailable é observado por get/set/remove; cleanupPending deriva das referências de credenciais inativas já persistidas. Nenhum schema físico ou campo de transporte novo.

A restauração de controle active saudável abre a conta mesmo se o cofre falhar e mantém leitura/escrita autorizadas; falha do banco continua pertencendo a Q51. Ausência/conteúdo inválido da chave atual exige autenticação, distinto de falha de acesso, que preserva a referência. Limpeza incompleta durante restauração/login/rotação já persistidos mantém referências e uso local; logout continua bloqueado até limpar. Login só ativa após os dois segredos persistidos. Set de refresh perdido não restaura a referência antiga.

Indisponibilidade pausa novas requisições de sessão/sync/revogação, mesmo com token em memória. O scheduler observa o estado, sem consumir tentativas de intenções por falha do cofre; recuperação notificada retoma as filas respeitando seus prazos. Leituras/escritas protegidas capturam a geração antes do await; falha ou resposta tardia de A não altera diagnóstico, credencial ou base de B. O erro público vault_unavailable não carrega conteúdo da plataforma.

Recorte 2 concluído localmente: [evidências, validação e limites do cofre](../docs/analises/2026-10-07-retomada-do-cofre.md). Abertura/PRAGMA permanece no recorte 3; M1 continua aberto.

08/10/2026 — [Abertura/recuperação local: recorte 3](../docs/analises/2026-10-08-recuperacao-da-abertura-local.md) concluído/verificado: owner/sessão com diagnóstico e retry, controle ilegível bloqueia abertura inteira, arquivos/intenções preservados e tentativas tardias invalidadas por logout/fechamento. App 121 testes/typecheck/lint; API check integral reexecutado com 85 Java aprovados, 1 Android opt-in ignorado e 13 operacionais; integração HTTP/PostgreSQL aprovada. Os três recortes locais de exceções estão concluídos, sem encerrar M1/aparelhos/UI/operação externa.


### Evidência Android de exceções e isolamento — 08/10/2026

[Plano](../.scratch/aceite-android-excecoes/spec.md) e [relatório](../docs/analises/2026-10-08-excecoes-e-isolamento-android.md): cinco casos nativos aprovados em ensaio direcionado e check integral. Q52: falha controlada de leitura do cofre conserva escritas, reinício e pausa remota; retry retoma automaticamente sem duplicar XP. Q51: falhas de open/PRAGMA e migration de ensaio conservam envelopes após rollback/retry, fecham handles e bloqueiam a instalação sem fallback. Q53: colisões de operação/sequência conservam intenção/filha/recibo, persistem no reinício e permitem trabalho independente; hash Unicode Hermes/Node correspondente. M1-10: logout offline e reentrada online A/B/A preservam isolamento e pendências.

SQLite/Drizzle/SecureStore/HTTP são reais nos caminhos saudáveis; indisponibilidade do cofre/open/PRAGMA é controlada na fronteira externa. Não é prova física de corrupção/disco/keystore, UI ou convergência iPhone/Android. App 121/typecheck/lint, API 87 Java sem ignorados e 13 operacionais aprovados; nenhuma mudança de comportamento/schema/contrato. Interface, links reais, iOS Q55=B e aceite operacional externo mantêm M1 aberto.

### Interface de resultados — recorte 04, 10/10/2026

[Entrega e evidências](../docs/analises/2026-10-10-interface-resultados-de-sincronizacao.md): Journey expõe operações/recuperações/progresso real e encaminha correção/descarte para AccountStore. Recusa comprovada admite somente dependentes selecionadas; Q53 conserva intenção/cadeia e oferece diagnóstico sem descarte/novo ID. Snapshot inicial é exigido para conta integrada sem cópia local; falha/reinício mantém gate e staging, instalando a base completa atomicamente. UI respeita scheduler/Retry-After e compatibilidade. Nenhum DDL/campo de transporte/endpoint novo. 171 testes do app, API check e Android visível aprovados; 05/06 e gates existentes mantêm M1 aberto.


### Interface de recuperação — recorte05,12/10/2026

[Entrega e limites](../docs/analises/2026-10-12-interface-recuperacao-de-senha.md): solicitação uniforme e nova senha pelo transporte existente, sem ativação automática de sessão nem perda de pendências. Native intent sanitiza navegação e mantém segredo somente como referência transitória; abrir não confirma. Invalidado/usado/expirado oferece novo pedido; offline/429/falhas preservam campos e contexto para ação deliberada. Fluxos de banco/logout mantêm seus bloqueios; recuperar identidade não libera domínio/cópia parcial. Reautenticar respeita a conta ativa. 192 testes app,85 Java/13 operacionais e cinco fases Android locais aprovados. Associações públicas, iOS Q55=B, recorte06 e aceite integral continuam abertos; nenhuma mudança no contrato HTTP/DDL.


### Verificação nativa de descarte, espera e cópia — 16/10/2026

[TalkBack a 200%, rodada4](../docs/analises/2026-10-16-talkback-descarte-e-espera.md): nove fases aprovadas, confirmação por item e originais/dependentes preservados; 429/503 no push respeitam espera após reinício, com resultado sem duplicação. Snapshot inicial falha antes da primeira página e mantém gate; conclusão e troca A/B/A conservam isolamento. Mesmo contrato/schema e fontes de produto; somente fixtures/testes/lançador/documentação ampliados. Tipos/lint e 228 testes do app passaram; check completo da API aprovado em 10m43s: 85 executados/oito nativos opt-in ignorados, zero falhas/erros, 13 verificações operacionais e modularidade. Não aceita interrupção com staging não zero, atualização obrigatória no leitor, retry esgotado, iPhone ou M1 integral.
