# 05 — Completar sessão e recuperação antes do uso diário

Status: ready-for-agent
Blocked by: 04-exercitar-fundacao-sem-ui.md

## Resultado esperado

Sobre o primeiro recorte executável, completar as garantias de sessão e recuperação da matriz M1, sem inventar visual enquanto Q28 permanecer aberta. O código existente e seus testes são a base; esta tarefa não é autorização para declarar os comportamentos abaixo implementados.

## Escopo e aceite

- Implementar e testar refresh rotativo, revoke e recuperação por e-mail; resolver host/deep link/SMTP antes do aceite real do e-mail.
- Integrar SecureStore e controle da instalação com geração, fence de logout, conta bloqueada e retomada segura entre bancos. Provar logout offline → B → reentrada online em A, respostas atrasadas e falhas de armazenamento.
- Completar scheduler/backoff, recuperação de rejeição e correção com novos IDs, limite de contexto, ciclos de dependência entre operações e migração de uma base anterior sem perder pendências.
- Exercitar a matriz M1-01 a M1-20 faltante: ordens concorrentes adicionais, corte H e paginação com >500 envelopes/entidades, snapshot expirado/interrompido, atualização de protocolo, concessão ausente e relógios/fusos.
- Adicionar rate limiting e validar provisionamento real de roles, segredos, retenção, backup/restore e deploy antes de exposição externa.
- Ampliar o harness nativo para sincronização HTTP no Android e, quando houver rota de instalação, no iPhone. Os dois clientes SQLite do teste automatizado de desktop não substituem o aceite iPhone/Android.

## Resultado

Concluída: não.

26/09/2026: continuação delimitada a partir das lacunas observadas no primeiro recorte, sem alterar as decisões de produto já aprovadas. O protótipo continua na tarefa 03.

## Incremento de sessão — iniciado em 26/09/2026

Fronteiras de teste do recorte autorizado: endpoints HTTP reais de Identity; repositórios SQLite por conta e coordenador de sessão/instalação usados pelo harness; SecureStore e transporte como fronteiras externas para injeção de falhas. São a concretização das garantias já aprovadas no contrato e na matriz M1-10. Testes de concorrência e armazenamento observam acesso local, pendências preservadas e respostas da API.

Ajuste aprovado por Pedro nesta etapa: resposta própria de refresh sem `revokeToken`; preservar a capacidade original da família.

### Entregue neste incremento

- Refresh rotativo e revoke por capacidade original, com teste HTTP de uso único e concorrência.
- Controle durável da instalação, SecureStore e geração de sessão; logout offline, A/B/A, falhas do cofre e respostas atrasadas.
- Integração HTTP real do coordenador e harness Android com retomada de sessão após reiniciar o processo.
- Contrato `RefreshResponse` aprovado e sincronizado com os validadores; modelo físico do controle local documentado.

Evidências e limitações: [sessão e isolamento](../../../docs/analises/2026-09-26-sessao-e-isolamento.md). `Concluída: não` continua correto para a tarefa inteira. O recorte seguinte de recuperação está registrado abaixo. Scheduler, restante da matriz M1 e operação real seguem no escopo acima.

## Incremento de recuperação de senha — iniciado em 26/09/2026

Continuação autorizada: endpoints HTTP reais de Identity, mensagem recebida em SMTP local descartável e transporte público do app. São as fronteiras de autenticação/envio previstas neste escopo; relógio e falhas de armazenamento/SMTP são fronteiras externas controladas nos testes. Nenhum e-mail externo é enviado por estes testes. Domínio/remetente/SMTP e a política dos outros links foram apresentados ao Pedro; encaminhamento registrado na continuação abaixo.

27/09/2026: após as recomendações apresentadas, Pedro autorizou continuar. Seguimos com validação SMTP local até definição operacional de domínio/provedor e invalidação dos demais links após uma troca concluída. Não foi informado domínio, provedor ou segredo externo.

### Entregue no incremento de recuperação

- Solicitação uniforme, SMTP local, token de uma hora e confirmação única/concorrente.
- Consumo dos demais links e revogação de sessões na mesma transação da senha, com rollback comprovado.
- Transporte/parser de link do app e fluxo integrado preservando a pendência após reset, reinício e nova autenticação.
- Configuração operacional e limites documentados; nenhum envio externo ou aceite nativo declarado.

[Evidências e lacunas](../../../docs/analises/2026-09-27-recuperacao-de-senha.md). A tarefa continua aberta. Próximo recorte proposto: scheduler/backoff e retomada de revogações ao reconectar, sem depender do protótipo. Rate limiting e configuração real permanecem obrigatórios antes de exposição externa.


## Incremento de sincronização automática — iniciado em 27/09/2026

Continuação autorizada por Pedro após a priorização do próximo passo. Recorte: REQ-SYN-005/008, retomada de revogações e preservação das garantias de sessão. Fronteiras de teste mantidas: sessão pública, repositório SQLite real e HTTP; relógio, ciclo de vida, conectividade e cofre são fronteiras externas controláveis. O scheduler será exercitado por essas interfaces, sem mocks dos módulos internos.

Aceite: abertura/retorno ao primeiro plano/reconexão/período de cinco minutos acionam sync; não há envios automáticos offline ou em segundo plano; espera crescente e limite de tentativas não descartam intenções; logout e troca de conta invalidam trabalho antigo; revogações pendentes retomam independentemente de haver conta ativa. A interface visual de aviso/retry continua subordinada ao protótipo; o núcleo deve expor seu estado e ação de retry.


### Entregue no incremento de sincronização automática — 28/09/2026

- Scheduler com gatilhos de abertura/login, foreground, conectividade e intervalo; pausa de novos envios e encerramento de listeners/timers.
- Backoff, Retry-After, limite de dez falhas e retry explícito; tentativas/deadlines de push sobrevivem ao reinício sem mudar IDs/conteúdo ou descartar projeções.
- Revogações retomadas mesmo sem conta ativa; troca A/B invalida resultados antigos e não bloqueia o sync da conta atual.
- Composição `openExpoRuntime` com adapters Expo, bundle Android verificado e cenário HTTP/Postgres/SQLite com ack perdido sem duplicação de XP.

[Evidências e limitações](../../../docs/analises/2026-09-28-sincronizacao-automatica.md). A tarefa inteira continua aberta. Próximo incremento: recuperação de rejeições definitivas, correção com novos IDs/cadeias e validação de dependências/contexto. Permanecem a matriz ampliada de snapshot/migrations, HTTP nativo, operação e UI aprovada. Contadores de pull sem push e revogações são por execução; os dados a recuperar continuam persistidos.


## Incremento de recuperação de rejeições — iniciado em 28/09/2026

Próximo passo autorizado por Pedro: REQ-SYN-017 e M1-19. Manter as fronteiras já acordadas: interface pública do repositório por sessão, SQLite real e API HTTP/Postgres; relógio, armazenamento protegido e falhas externas são controláveis. O recorte expõe conteúdo/motivo/cadeia recuperável, correção atômica com novos IDs e `supersedesOperationId`, descarte explícito sem cascata silenciosa, bloqueio das dependentes e tratamento sem truncamento do limite de contexto. A validação de ciclos/dependências da API acompanha o mesmo fluxo. UI permanece subordinada ao protótipo.

Implementação local proposta para o recorte: conservar envelopes/recibos e registrar a resolução local (`discarded` ou `corrected` com ID substituto) no JSON `error` já existente. Não adicionar tabela/coluna/estado de schema. Correções preservam a data original por padrão e remapeiam referências para operações substitutas; não reescrevem o envelope antigo. Conteúdo sem confirmação e resultado incerto não pode ser corrigido como se estivesse rejeitado.


### Entregue no incremento de rejeições — 28/09/2026

- Listagem recuperável com conteúdo, motivo, dependências, origem e resolução local; persiste após reinício e troca de conta.
- Correção atômica com novos IDs/sequências e `supersedesOperationId`, remapeando dependências, contexto de desfazer e hábito substituto. Novos desfazeres locais observados também são dependências; ciclos na proposta de correção desfazem a transação.
- Descarte somente dos itens escolhidos, preservando filhas; recibo repetido não reabre a resolução. Resultado incerto não é tratado como rejeição definitiva.
- Bloqueio local de dependentes e contexto excessivo; reavaliação entre lotes; nenhuma referência truncada.
- API ordena o lote, detecta ciclos inclusive sobrepostos e retorna os IDs que causam rejeição, mantendo recibos imutáveis. Fluxo HTTP/Postgres/SQLite valida correção após reinício e convergência sem duplicação de XP.

[Evidências e limitações](../../../docs/analises/2026-09-28-recuperacao-de-rejeicoes.md). A tarefa inteira continua aberta. Próximo recorte: matriz de snapshot/paginação/interrupção e recuperação de migrations sem perder pendências. UI, HTTP nativo, operação, resolução de conflitos de identidade incertos e ampliação segura de contexto continuam pendentes.


## Incremento de snapshot e abertura segura — iniciado em 28/09/2026

Continuação autorizada por Pedro. Manter as fronteiras de teste aprovadas: repositório/sessão públicos, abertura de SQLite real e HTTP/Postgres; transporte, relógio e falhas de armazenamento são controláveis. Exercitar cópia interrompida/expirada, recibos ao corte H incluindo escritas durante a cópia, paginação acima de 500 e falha de migration sem apagar pendências de contas ativas ou inativas. Reutilizar staging e campos existentes; uma cópia interrompida pode reiniciar do manifesto, conservando a base anterior até o swap. A recuperação de migration deve bloquear a abertura e permitir nova tentativa, sem reconstrução automática quando a preservação não é comprovada.


### Entregue no incremento de snapshot e abertura segura — 28/09/2026

- Staging por página com base anterior disponível; cópia expirada/inacessível reinicia de forma limitada. Interrupção/reabertura preserva fila, conteúdo e rejeições.
- Recibos exatamente correspondentes ao lote, reconhecimento vinculado a H e novas escritas locais incluídas antes do swap. Feed após H antecede novo push.
- Troca de base, cursor, projeções e confirmações atômica, com falha real de SQLite e reabertura exercitadas.
- HTTP/Postgres/SQLite reais com 501 mudanças, 502 entidades no snapshot, escrita entre páginas, resposta perdida, 54 pendências e dois clientes convergentes. Expiração e isolamento de snapshots/recibos exercitados na API; cursor de outra conta recebe 404.
- Abertura protegida contra histórico de schema desconhecido, com erro de recuperação tipado; migrations de fixture provam rollback/retry e preservação de conta inativa, conta ativa e fence de logout. Não há schema novo de produção.

[Evidências, comandos e limites](../../../docs/analises/2026-09-28-snapshots-e-migrations.md). A tarefa inteira e o M1 continuam abertos. Próximo recorte recomendado: cumprir o modo somente leitura local de REQ-SYN-014 ao exigir atualização; depois ampliar o harness para HTTP real no Android. Matriz restante de concorrência/relógios/fusos, exclusão/tombstones, operação e UI continuam pendentes.
