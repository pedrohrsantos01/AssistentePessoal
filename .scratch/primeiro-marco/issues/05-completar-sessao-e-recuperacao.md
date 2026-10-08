# 05 — Completar sessão e recuperação antes do uso diário

Status: needs-info
Dependência técnica: 04-exercitar-fundacao-sem-ui.md concluída em 26/09/2026; aceite operacional/visual/aparelhos ainda aberto

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


## Incremento de compatibilidade — iniciado em 29/09/2026

Próximo passo autorizado por Pedro: núcleo de REQ-SYN-014. Fronteiras de teste mantidas: sessão/repositório públicos, SQLite real e HTTP/Postgres; transporte, relógio e falhas de armazenamento como fronteiras externas controladas. Ao receber 426 ou efeito essencial desconhecido, persistir a exigência de atualização por instalação, preservar leitura e pendências, bloquear novas escritas de domínio e sincronização daquele build. Logout local continua disponível. Um build diferente verifica compatibilidade online antes de liberar escritas; retry/reinício do mesmo build não removem a restrição. Testar respostas atrasadas e isolamento. Completar a configuração persistida de versão mínima da API já prevista no spec; UI permanece subordinada ao protótipo.


### Entregue no incremento de compatibilidade — 29/09/2026

- Restrição durável por instalação após 426/resposta essencial desconhecida; leitura, pendências e histórico preservados. Escritas, aplicação de sync e retries do mesmo build ficam bloqueados, inclusive após reinício/logout.
- Novo build mantém leitura offline até resposta compatível da geração atual; identidade, recuperação de senha, scheduler e sessão compartilham a proteção. Respostas tardias não alteram o bloqueio atual.
- Política de mínima na tabela global da API, com Flyway V3, SELECT apenas para runtime e comparação numérica; indisponibilidade da configuração retorna 503.
- Drizzle 0001 verificada contra a versão anterior; cenário HTTP/Postgres/SQLite prova reenvio das intenções após upgrade sem duplicar XP.

[Relatório, comandos e limites](../../../docs/analises/2026-09-29-compatibilidade-e-leitura-local.md). Tarefa 05 e M1 continuam abertos. Próximo recorte recomendado: HTTP real no harness Android. O aviso visual depende do protótipo; iPhone, matriz M1 restante e operação real seguem pendentes.


## Incremento de HTTP nativo Android — iniciado em 29/09/2026

Próximo passo autorizado por Pedro. Manter as fronteiras públicas de Session/AccountStore/HTTP, agora com SQLite, SecureStore, fetch, AppState e expo-network reais no emulador. A API/Postgres descartáveis serão controlados por teste finito. Cenário: cadastro, hábito/marcação offline, encerramento do processo, reabertura ainda offline e sincronização automática ao recuperar rede/foreground, com convergência observada por outro cliente sem duplicar XP. Harness sem UI de produto, pacote Android separado e HTTP em loopback por adb reverse; sem reset dos dados do harness anterior ou acesso à VPS. Registrar comandos e limitações; não declarar aceite iPhone nem M1 completo.


### Entregue no incremento HTTP nativo — 30/09/2026

- Variante Android isolada com runtime, SQLite, SecureStore, fetch e eventos nativos reais; API/Postgres descartáveis em teste finito.
- Criação/marcação offline, force-stop com SQLite aberto e reabertura preservam exatamente envelopes/projeção e recuperam a sessão protegida.
- Rede restabelecida em segundo plano não envia pendências; retorno ao primeiro plano converge automaticamente com outro cliente SQLite/HTTP.
- Replays, marcação independente do mesmo hábito/dia e nova abertura mantêm 10 XP; refresh rotacionado sobrevive ao reinício.
- Script reproduzível valida o pacote antes de instalar e restaura rádios/encaminhamento; variante padrão não recebe a exceção de HTTP.

[Relatório, comandos e limites](../../../docs/analises/2026-09-30-http-nativo-android.md). Tarefa 05 e M1 continuam abertos. Próximo recorte recomendado: matriz de concorrência M1-04/06 e datas/relógios/fusos M1-12. Permanecem UI vinculada ao protótipo, iPhone, exclusão/tombstones, demais lacunas da matriz e operação real.


## Incremento de concorrência binária — iniciado em 30/09/2026

Pedro autorizou seguir os recortes recomendados antes de decompor os demais eixos. Recorte atual: M1-04/M1-06 e REQ-HAB-004a, com reversão/restauração original de XP. Fronteiras já aprovadas: AccountStore/Session e HTTP, SQLite real por cliente e API/Postgres descartáveis; sem mocks de módulos internos. Controlar a ordem de chegada de envios, preservar envelopes após reinício e observar o estado pelas interfaces públicas.

Aceite: desfazer vence marcação que não o conhecia em ambas as ordens; dois desfazeres vencem remarcação que conhece só um; remarcação posterior incorporando ambos restaura o cumprimento e a mesma concessão, sem novo consumo. Replays e respostas atrasadas não alteram o contexto da intenção nem duplicam efeitos. Incluir chegada simultânea pela API, sem presumir uma ordem de commits. Domínio/persistência/rede podem avançar sem o protótipo; o M1 e o aceite visual permanecem abertos.


### Entregue no incremento de concorrência binária — 30/09/2026

- M1-04: desfazer contra marcação sem contexto em ambas as ordens e com envios HTTP simultâneos; dois clientes convergem para desmarcado/0 XP.
- M1-06: duas correções independentes e remarcação parcial nas três ordens que preservam sua dependência. Contexto parcial fica desmarcado; nova marcação incorporando ambos restaura o cumprimento.
- SQLite local também incorpora o desfazer remoto enquanto a remarcação parcial está pendente, conservando o resultado após reabertura e repetição da página.
- Concessão original de 10 XP, orçamento consumido de 10 e histórico de reversões/restaurações preservados. Reenvios devolvem o recibo original sem avançar a revisão; confirmações antigas não desfazem a restauração posterior.
- Envelopes preservados após reinício; resposta da remarcação parcial descartada após commit e reconhecida no pull. O núcleo existente passou; o incremento acrescenta testes, sem mudança de produção/schema/contrato.

[Relatório, comandos e limites](../../../docs/analises/2026-09-30-concorrencia-binaria.md). Checks: 70 testes locais do app; typecheck/lint aprovados; API check com 33 casos aprovados e 1 nativo ignorado, incluindo 8 cenários no arquivo HTTP de sync. Tarefa 05 e M1 continuam abertos. Próximo recorte: datas/relógios/fusos M1-12. Exclusão/tombstones, operação, UI/protótipo e aceite dos aparelhos permanecem pendentes. A decomposição posterior dos demais eixos usará `grilling` para esclarecer decisões antes de atualizar specs e issues verticais.


## Incremento de datas e fusos — iniciado em 30/09/2026

Próximo recorte autorizado por Pedro: M1-12, REQ-SYN-018, REQ-HAB-006/011 e spec/04 §2. Fronteiras mantidas: função canônica pública getDayKey já especificada, AccountStore/Session e HTTP com SQLite/Postgres reais; relógio é fronteira externa controlável. Registrar e preservar o contexto da intenção, calcular novos dias pelo perfil vigente e validar datas/instantes sem usar idade de transmissão como expiração. Seguir a política já documentada de primeira ocorrência em hora repetida e primeiro instante válido em hora inexistente.

Exercitar meia-noite, início configurado, mês/ano, dias de 23/25h, offsets de 30/45 minutos, mudanças offline de fuso/início, reinício e duas semanas sem sincronizar. Janela retroativa deve considerar occurredAt e início do hábito; relógio acima de 24h e dia acima do limite futuro devem gerar rejeição recuperável. Sem UI de detecção/viagem ou timer visual do Briefing enquanto o protótipo estiver aberto.


### Entregue no incremento de datas e fusos — 30/09/2026

- Função canônica getDayKey no domínio do app; primeira ocorrência de hora repetida e primeiro instante válido em hora inexistente, sem subtrair 24h para obter a data anterior.
- API resolve corretamente a lacuna de Chatham, usa Clock injetável e aplica o limite futuro do perfil atual, conservando o contexto histórico para a janela retroativa.
- Dois clientes SQLite/HTTP provam mudança offline de fuso/início, reinício, duas semanas sem enviar, destino retroativo de sete dias, orçamento no destino e replay sem novo XP.
- Datas inválidas geram rejeição recuperável e sem efeitos, conservada após reinício. Exatamente 24h é aceito dentro do limite de dia; 24h + 1 ms e dia além do limite são recusados.

[Relatório, testes e limites](../../../docs/analises/2026-09-30-datas-e-fusos.md). Checks finais: typecheck/lint, 91 testes locais do app, 28 cenários HTTP de datas; API check com 34 casos aprovados e 1 nativo ignorado, incluindo ModularityTests. Sem mudança de contrato/schema/dependência. M1 e tarefa 05 continuam abertos; timer/aviso visual e detecção de fuso dependem do protótipo. Próximo recorte: exclusão/tombstones e prevenção de ressurreição (M1-13). Operação, demais lacunas e aceite dos aparelhos permanecem pendentes.


## Incremento de exclusão e tombstones — iniciado em 30/09/2026

Pedro autorizou o próximo recorte recomendado: REQ-HAB-007, REQ-SYN-009/010 e restante de M1-13. Fronteiras de teste já aprovadas: AccountStore/HTTP com SQLite e Postgres reais; transporte/relógio/falhas de armazenamento externos. Primeiro tracer: tombstone recebido impede que pendência/ack antigo restaure o hábito, sem apagar o envelope recuperável. Seguir com exclusão offline, reconciliação, XP, replays, snapshot e isolamento. UI de confirmação depende do protótipo.

Definições novas aprovadas nesta sessão: Q30 reverte XP do hábito excluído, preservando orçamento consumido e registros técnicos; Q31 concede prêmio inteiro apenas quando couber no teto, sem XP parcial. Registrar essas definições nos specs antes do comando servidor.


### Entregue no incremento de exclusão e tombstones — 30/09/2026

- Intenção de exclusão offline durável e tombstone terminal: pending/ack antigo não restaura hábito nem XP; rejeição mantém conteúdo recuperável.
- Aceitação atômica com ID excluído, invalidação dos cumprimentos, reversões de concessões ativas, N recalculado e consumo original preservado. Q30 substitui o caso antigo de XP mantido após exclusão; Q31 aprova prêmio inteiro ou nenhum XP. Specs/entrevista/contrato atualizados.
- Dez cenários SQLite/HTTP/Postgres: reabertura, ack perdido/replay, ID novo com título liberado, histórico extenso por snapshot, saldo 5 de XP sem prêmio parcial, seis ordens de exclusão concorrente e isolamento entre contas.
- Cursor exatamente em 90 dias e um segundo depois; feed removido como fixture com snapshot/recibos/ID excluído preservados. Falha de gravação de XP retorna 503 e desfaz exclusão/revisão/recibo; retry da mesma intenção é aceito.
- Sem novo schema/dependência. Contratos: 52 schemas/49 fixtures; app typecheck/lint e 94 testes aprovados; API check com 37 casos aprovados e um nativo ignorado, incluindo ModularityTests.

[Relatório, comandos e limites](../../../docs/analises/2026-09-30-exclusao-e-tombstones.md). M1/tarefa 05 continuam abertos; confirmação visual e aceite dos aparelhos dependem do protótipo/rota de instalação. Retenção mínima está preservada, mas não há job físico de expurgo/compactação de produção. Próximo recorte recomendado: operação (rate limiting, retenção/expurgo seguro, provisionamento reproduzível e backup/restore), validada localmente antes de exposição externa. Depois das lacunas do M1, decompor os demais eixos com `grilling`.


## Incremento de rate limiting — iniciado em 30/09/2026

Próximo recorte autorizado por Pedro. Q32 fecha as quotas de spec/07 §4.1. Fronteiras de teste já aprovadas: HTTP real, identidade/sessão/AccountStore públicos e SQLite/Postgres reais; relógio/transportes externos controláveis. Primeiro tracer: esgotar a quota de login do mesmo IP, receber 429/Retry-After sem executar autenticação e recuperar após reposição. Ampliar para conta, endpoints anônimos, concorrência, cabeçalhos forjados, limite de memória e retry de intenção local. Não criar UI antes do protótipo.


### Entregue no incremento de rate limiting — 30/09/2026

- Quotas Q32 por conta/IP/endpoints, configuráveis, com Bucket4j, 429/Retry-After e erro m1.1. JWT validado identifica conta; cabeçalhos forjados e caminhos codificados não contornam a quota.
- Memória limitada sem evicção de dívida; cardinalidade nova recebe 503/Retry-After até reposição segura. Default local de uma instância, sem persistência entre starts.
- Onze testes HTTP: concorrência, quotas cumulativas/independentes, recuperação uniforme, credenciais recusadas intactas, lote de 50 e SQLite preservando envelope/deadline após 429 real e reabertura.
- Checks: app typecheck/lint e 94 testes aprovados; API check com 48 aprovados e um nativo ignorado; ModularityTests e bootJar aprovados. Sem migration ou mudança no contrato gerado.

[Relatório e limites](../../../docs/analises/2026-09-30-rate-limiting.md); [configuração operacional](../../../api/ops/rate-limits.md). M1/tarefa 05 continuam abertos. Próximo recorte recomendado: REQ-NFR-004, backup/restauração em ambiente limpo. Proxy confiável/provisionamento, expurgo seguro, aceite de e-mail/aparelhos e interface Q28 continuam pendentes. Decompor os demais eixos com grilling após as lacunas do marco.


## Incremento de backup/restauração — iniciado em 30/09/2026

Próximo recorte autorizado por Pedro: REQ-NFR-004, dump completo em formato custom e restauração em Postgres limpo, seguida da API real. Manter as fronteiras HTTP/Session/AccountStore e PostgreSQL real já aprovadas; dump/cópia/restauração são fixtures da fronteira externa de armazenamento. Testar recomposição dos grupos NOLOGIN e logins separados, dados de conta/hábitos/XP/recibos/tombstones e isolamento após restauração. Não consultar tabelas privadas para afirmar resultado de domínio. Sem conexão à VPS, sem escolher credenciais/destino externo/cadência de produção e sem modificar schema.


### Entregue no incremento de backup/restauração — 30/09/2026

- Scripts de dump custom com checksum/publicação sem sobrescrita e restore em transação única, preservando ACLs/RLS e histórico Flyway. Banco destino precisa estar vazio; roles e segredos são recompostos fora do dump.
- Dois cenários reais encerram a origem, restauram em outro cluster/dono e iniciam a API com logins separados. Verificam conta/sessão, snapshot/recibos/replay, hábito/XP, isolamento e recusas por corrupção/banco ocupado; ausência de roles desfaz a restauração inteira.
- Session/AccountStore com SQLite reaberto preserva envelopes offline, sincroniza contra destino, conserva tombstones e converge com segundo cliente sem novo XP por replay. Nenhuma consulta privada usada como asserção de domínio.
- Guia operacional e decisão pendente registrados em spec/07 §2.1: restauração de confirmações/cursors/credenciais posteriores ao corte e RPO/RTO precisam de definição antes da exposição externa. Nenhuma política de produto/schema inventada.

[Relatório e limites](../../../docs/analises/2026-09-30-backup-e-restauracao.md); [procedimento](../../../api/ops/backup-restore.md). Checks completos: typecheck/lint e 94 testes do app aprovados; API check com 50 aprovados e um nativo ignorado, incluindo os dois testes de restauração e ModularityTests. M1/tarefa 05 continuam abertos; agenda Coolify/destino fora da VPS/30 dias, provisionamento/proxy/TLS, expurgo seguro, e-mail/aparelhos e protótipo seguem pendentes. Próximo recorte recomendado: esclarecer recuperação pós-corte e parâmetros operacionais com grilling antes de provisionar o ambiente externo.


## Contenção e retomada operacional — 02/10/2026

Plano Q33–Q43 confirmado por Pedro; [ADR-019](../../../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md) e [tarefas de recuperação](../../recuperacao-operacional/spec.md) consolidados. Recorte 1 concluído: quarentena externa ao banco, preparação transacional das credenciais e retomada com novo login/chave sem apagar SQLite. Cópia histórica permaneceu bloqueada enquanto confirmações pós-corte/exclusões/XP e novas pendências foram preservados; cópia completa retomou com replay, segundo cliente e isolamento de conta.

[Relatório e limites](../../../docs/analises/2026-10-02-contencao-e-retomada-operacional.md). App: typecheck/lint + 94 testes; API check: 53 aprovados/1 Android nativo ignorado, incluindo cinco cenários de restauração e ModularityTests. Próximo recorte: prova de WAL síncrono/recuperação pós-base, cauda/timelines e cancelamento/resultado incerto. Tarefa 05/M1 permanecem abertos; operação externa/RPO/RTO, agenda/retencão/alertas, proxy/TLS/e-mail real, protótipo e aparelhos continuam pendentes conforme os planos.


### WAL e recuperação física pós-base — 02/10/2026

Recorte 2 concluído localmente: confirmações protegidas antes da publicação, WAL síncrono/slot dedicado, base física verificada e recuperação de cauda/timelines. HTTP real prova senha alterada, contas, tombstones, XP/consumo e replays após duas perdas; cancelamento/timeout de commit e falta de espaço não publicam confirmação/credenciais. Base/cauda corrompida ou ausente não alcança alvo nem é promovida. Schema de domínio/m1.1 preservados; Flyway V4 é somente função operacional.

[Relatório e limites](../../../docs/analises/2026-10-02-wal-e-recuperacao-fisica.md), [procedimento](../../../api/ops/wal-recovery.md). App typecheck/lint + 94 testes; API check 58 aprovados/1 Android nativo ignorado. Próximo: [recorte 3](../../recuperacao-operacional/issues/03-operar-backups-e-alertas.md), agenda/cadeia de backup, inventário/alvo conservador fora do primário, retenção e detector. Aceite externo de RPO/RTO, provisionamento, interface Q28 e aparelhos continuam pendentes; tarefa 05/M1 permanecem abertos.


### Ciclo operacional — 02/10/2026

[Recorte 3](../../recuperacao-operacional/issues/03-operar-backups-e-alertas.md) concluído localmente: agenda com fuso, catálogo imutável, âncora/WAL por dependência, monitor/deduplicação/retry e ensaio mensal/major. Seleção independente do alvo após perder o primário foi comprovada por restauração/API nas duas timelines; corrupção/gaps/histórias ausentes recusam avanço. [Relatório/limites](../../../docs/analises/2026-10-02-ciclo-operacional-de-backups.md). Checks completos: app 94 testes/typecheck/lint; API check 58 aprovados/1 Android opt-in ignorado + 8 operacionais. Próximo gate: [04 — provisionamento/aceite externo](../../recuperacao-operacional/issues/04-validar-operacao-externa.md). Janela/RPO/RTO reais, e-mail/cofre/supervisor/TLS e UI/aparelhos continuam pendentes. Tarefa 05 e M1 não são encerrados por esta prova local.


### Preparação de provisionamento — 02/10/2026

[Recorte 4](../../recuperacao-operacional/issues/04-validar-operacao-externa.md) iniciado com caderno de execução, capacidade/custos e gates de aceite. [Relatório](../../../docs/analises/2026-10-02-preparacao-do-provisionamento.md). Q44 confirmou VPS Hostinger/Campinas e Q46 informou Resend; Q47 autorizou perfil A/artefatos locais e adiou orçamento; Q48 escolheu Bitwarden Free; implantação/proxy/supervisor/agenda e provas externas não estão concluídos. App typecheck/lint + 94 testes; API check aprovado, operationsTest 8/8 e suíte Java UP-TO-DATE. M1 e tarefa 05 seguem abertos; nenhuma UI ou implantação externa acrescentada.


02/10/2026: pacote local 4B iniciado pela [imagem da API](../../../api/ops/container-deployment.md), com build/PG18/HTTP e defaults WAL/quarentena verificados. [Checks e limites](../../../docs/analises/2026-10-02-imagem-de-implantacao-da-api.md): app 94/94, API 59 aprovados/1 Android opt-in ignorado, operações 8/8. Supervisão/agenda/transporte/proxy e aceite externo continuam na tarefa de recuperação; isso não aceita M1/UI/distribuição/aparelhos nem inicia a avaliação da Fase 1.

03/10/2026 — proxy/TLS no pacote local 4B: [contrato/ativação](../../../api/ops/proxy-activation.md) e [evidência](../../../docs/analises/2026-10-03-proxy-tls-e-origem-confiavel.md). TLS real, origem confiável e quotas/erros/quarentena foram ensaiados localmente. Continuação operacional: telemetria de disco/slot primário, depois instalação/aceite externo; interface/protótipo/distribuição/aparelhos e e-mail real continuam gates. Tarefa 05/M1 abertos.


03/10/2026 — telemetria primária local 4B: [pacote/instalação futura](../../../api/ops/primary-telemetry.md) e [evidência](../../../docs/analises/2026-10-03-telemetria-do-primario.md). Saúde/disco/slot do primário integrados ao detector, com estados/ciclo verificáveis. O escopo atual dos artefatos operacionais locais está concretizado; falta dimensionar/definir/instalar/aceitar o ambiente real. Tarefa 05/M1 continuam abertos: retenção física do feed/tombstones e recuperação de exceções exigem contrato fechado, protótipo/UI, e-mail/deep link real, rota iOS e aceite iPhone/Android seguem pendentes. Esta entrega não inicia a avaliação da Fase 1 completa.

04/10/2026 — Pedro aprovou Q49=A (90 dias para todo o feed) e Q50=A (limpeza automática diária configurável/limitada). [Plano para confirmação](../../retencao-feed/spec.md) e [tarefa delimitada](../../retencao-feed/issues/01-expurgar-feed-e-snapshots.md) distinguem expurgo do transporte e compactação de domínio. A lacuna do cursor renovado requer limite de revisão removida; a limpeza deverá coordenar snapshots/leitores e preservar recibos/IDs/fatos/XP. Sem implementação ou nova migration neste registro. Tarefa 05/M1 continuam abertos.

## Implementação local de retenção — 04/10/2026

Pedro confirmou Q49/Q50, o entendimento e as fronteiras de teste. Implementados limite atômico do prefixo, cleaner real do feed/snapshots, coordenação de páginas/recibos e agenda diária limitada; V5/modelo e runbook acompanham o recorte. [Provas e validação final](../../../docs/analises/2026-10-04-retencao-fisica-do-feed.md), [tarefa vertical](../../retencao-feed/issues/01-expurgar-feed-e-snapshots.md).

Tarefa 05/M1 continuam abertos: contrato e implementação de recuperação de exceções, protótipo/UI, SMTP/deep link real, distribuição iOS e aceite iPhone/Android. Instalação/aceite da infraestrutura é gate externo. Compactação de hábitos/fatos/contextos/XP não foi incluída na retenção do transporte.


## Contrato de recuperação de exceções — 07/10/2026

Pedro aprovou Q51–Q53=A: preservar/bloquear banco ilegível sem reconstrução neste recorte; manter uso local da sessão já ativa/saudável durante indisponibilidade do SecureStore; preservar/bloquear identidade ainda incerta e dependentes para intervenção técnica, permitindo independentes.

[Diagnóstico por leitura](../../../docs/analises/2026-10-07-recuperacao-de-excecoes.md), [plano confirmado](../../recuperacao-excecoes/spec.md) e [tarefas separadas](../../recuperacao-excecoes/issues/01-reconciliar-identidade-e-recibos.md). Prioridade: impedir reconhecimento indevido de recibos por ID coincidente; depois cofre e abertura. Entendimento/fronteiras confirmados por Pedro com “sim” em 07/10/2026. O recorte 1 concretizou a prova de correspondência e foi implementado/verificado localmente; cofre e abertura seguem pendentes. Tarefa 05/M1 continuam abertos.

07/10/2026 — [Recorte 1: correspondência de recibos](../../../docs/analises/2026-10-07-correspondencia-de-recibos.md) concluído localmente: snapshot/pull/ack não reconhecem conteúdo divergente, diagnóstico sobrevive ao reinício, dependentes aguardam e independentes seguem. App 100 testes/typecheck/lint; API check integral 85 aprovados/1 Android opt-in ignorado e 13 operacionais; contrato 56 fixtures. Próximo: [cofre/sessão](../../recuperacao-excecoes/issues/02-retomar-cofre-sem-bloquear-uso-local.md), depois [abertura local](../../recuperacao-excecoes/issues/03-expor-recuperacao-da-abertura-local.md). UI/Q28, SMTP/deep link real, distribuição/aparelhos e aceite operacional externo mantêm tarefa 05/M1 abertos.

07/10/2026 — [Recorte 2: retomada do cofre](../../../docs/analises/2026-10-07-retomada-do-cofre.md) concluído localmente: referência atual/limpeza preservadas, Session pública com diagnóstico/retry, uso local e pausa remota; retomada sem refresh antigo, mistura A/B ou antecipação de backoff. App typecheck/lint e 109 testes aprovados; API check integral com 85 testes Java aprovados, 1 Android opt-in ignorado e 13 verificações operacionais aprovadas, incluindo ModularityTests. Próxima entrega: [recorte 3 — abertura local](../../recuperacao-excecoes/issues/03-expor-recuperacao-da-abertura-local.md). UI/Q28, SMTP/deep link real, distribuição/aparelhos e aceite operacional externo mantêm tarefa 05/M1 abertos.

08/10/2026 — [Recorte 3: abertura/recuperação local](../../../docs/analises/2026-10-08-recuperacao-da-abertura-local.md) concluído/verificado. Plano local de exceções (Q51–Q53) concluído: diagnóstico/retry sem perda de arquivos/intenções, bloqueio da instalação ilegível e proteção de geração/logout. App typecheck/lint e 121 testes aprovados; API check integral reexecutado com 85 Java aprovados, 1 Android opt-in ignorado e 13 operacionais; integração HTTP/PostgreSQL aprovada. M1/tarefa 05 continuam abertos: UI/Q28, aparelhos, SMTP/deep link real, distribuição iOS e instalação/aceite externo. Reparo/exportação/reconstrução assistida têm recortes próprios.

## Consolidação do aceite restante — 08/10/2026

Três recortes de exceções concluídos localmente; pacote 4B verificado no escopo atual. [Plano/tarefas de aceite](../../aceite-m1/spec.md) organiza renovação Android, configuração manual de domínio, recuperação nativa e matriz final, sem duplicar a tarefa visual 03 ou a operacional 04. Q54: domínio ainda a escolher, guia solicitado. Q55=B: rota iOS adiada; iPhone permanece obrigatório. Triagem needs-info indica definições/aceites faltantes, não invalida os incrementos concluídos. [Relatório](../../../docs/analises/2026-10-08-plano-de-aceite-m1.md). Concluída: não.

08/10/2026 — Renovação Android concluída com fontes atuais e checks integrais aprovados, incluindo caso nativo habilitado; [evidências/timeout inicial/limites](../../../docs/analises/2026-10-08-plano-de-aceite-m1.md). Segundo cliente ainda é desktop. Q54/Q55 e restantes gates continuam conforme plano; Concluída: não.


08/10/2026 — [Exceções e isolamento Android](../../aceite-android-excecoes/spec.md) concluídos no escopo técnico: cinco casos nativos novos aprovados, inclusive falhas de cofre/open/PRAGMA, rollback pelo migrator Expo/Drizzle, colisões de operação/sequência e logout offline → B → reentrada online A. App 121/typecheck/lint, API 87 Java sem ignorados e 13 operacionais; cenário Android original também passou. Emulador/painel próprios encerrados. [Relatório e limites](../../../docs/analises/2026-10-08-excecoes-e-isolamento-android.md). Concluída: não — UI/Q28, domínio/links/Q54, iOS Q55=B e operação externa continuam nos gates existentes.
