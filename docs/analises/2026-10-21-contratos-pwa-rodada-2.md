# Contratos PWA — rodada2

21/10/2026. **Estado: Q67–Q69 aprovadas; Q70–Q72 propostas, sem resposta.** Escopo: [tarefa02](../../.scratch/pwa-m1/issues/02-fechar-contratos-do-navegador.md). Fonte de decisões: [entrevista](../../.scratch/pwa-m1/entrevista.md); fronteiras consolidadas no [ADR-021](../adr/0021-fronteira-de-sessao-e-armazenamento-web.md). Não é implementação nem schema executável aprovado.

## 1. Respostas incorporadas

Q67=A: uma origem pública HTTPS para frontend estático+API Java. Q68=A: credenciais protegidas por HttpOnly/Secure, fora do JavaScript. Q69=A: controle+domínio no mesmo IndexedDB, filtrado por conta, com aparência em outro banco. Mantêm ADR-020, Q61–Q65 e nativo. O iPhone16e tem iOS26.6.2 informado por Pedro, sem teste físico até aqui.

## 2. O que já decorre dos contratos

**Sessão não é posse de escrita.** Geração de autenticação/logout/conta invalida consultas, formulários e respostas antigas. Transferir a posse da aba invalida commits/envio do proprietário anterior, preservando a sessão local ativa da mesma conta. Cada transação mutante deve conferir ambas as autoridades e compatibilidade. Ainda faltam nomes/campos físicos; não introduzir silenciosamente um contador que misture os dois papéis.

**Leitura secundária não ignora logout.** Consultas conferem controle+conta+geração e domínio na mesma transação; publicação tardia e retomada precisam revalidar. Troca A→B retira conteúdo/formulários de A. Uma aba suspensa não executa código para apagar pixels enquanto está congelada; ao retomar, validar antes de revelar a jornada. Não oferecer salvar rascunho de A em B. Isso preserva ADR-016 e não exige nova decisão de produto.

**Logout offline continua permitido.** Gravar barreira local durável, bloquear acesso/envio e preservar pendências. HttpOnly não pode ser apagado por JS sem resposta do servidor: exibir saída local concluída e revogação remota pendente, sem alegar que cookies foram fisicamente removidos. Reentrada exige autenticação online. A revogação de uma família antiga de A não pode atuar sobre B. O mecanismo de revogação ainda precisa ser especificado; não guardar sua capacidade secreta em IndexedDB.

**Resposta incerta não autoriza replay de autoridade.** Manter a política conservadora de preservar dados/uso local de sessão que continuava ativa e exigir autenticação online quando a credencial renovada não puder ser comprovada. Não repetir refresh antigo ou aproveitar qualquer200 de bootstrap como prova da tentativa correta. Login novo ou logout já registrado não herdam acesso local por essa regra.

**Migração não confirma formulário.** Não apagar/recriar base, não forçar reload nem instalar schema desconhecido em código antigo. `versionchange` pede fechamento de conexões; upgrade pode esperar em `blocked` enquanto uma aba suspensa conserva conexão. O fechamento conclui transações existentes e não prova cancelamento de HTTP. A preferência visual permanece independente.

## 3. Fatos adicionais conferidos

| Fato | Consequência |
|---|---|
| Fetch processa Set-Cookie na rede, antes do callback JS; a RFC documenta corridas entre respostas concorrentes | Ignorar corpo/geração ou abortar fetch não desfaz cookie já processado. Abort também não prova que toda resposta gravou cookie: depende da etapa atingida |
| HttpOnly não é acessível ao JS, mas acompanha fetch conforme política de credenciais | Não simular SecureStore limpando uma referência local; o contrato precisa separar bloqueio local e revogação remota |
| Safari→Tela de Início copia cookies e não IndexedDB | Um contêiner pode nascer com cookie remoto e sem controle local; isso não comprova a mesma instalação autorizada |
| Prefixo __Host- exige Secure, Path=/ e sem Domain; não implica HttpOnly ou SameSite | Os atributos completos precisam ser definidos juntos. Path não isola scripts/aplicações da mesma origem |
| Um SW instalado pode aguardar outros clientes; recarregar uma aba não garante ativação | Atualização precisa coordenar abas, código, schema e recursos antigos; não usar skipWaiting como atalho para forçar sucesso |

Referências públicas de conta/instalação/sessão podem selecionar e conferir a credencial esperada, **mas não são prova criptográfica de posse nem autorização**. Não introduzir segredo de binding/chave equivalente em IndexedDB contrariando Q68. WebCrypto não exportável também não é cofre contra código da mesma origem; não foi escolhido neste recorte.

## 4. Perguntas desbloqueadas

As três escolhas abaixo são independentes após Q67–Q69. As alternativas são viáveis sob contratos próprios; a recomendação não declara nenhuma implementada.

### Q70 — Primeira entrada em um contêiner novo

**A — Recomendada:** exigir autenticação online explícita quando não existe controle local válido, inclusive ao abrir pela primeira vez na Tela de Início após usar o Safari. Criar identidade/sessão próprias; não reaproveitar a família copiada automaticamente. A mesma conta recupera somente os fatos já confirmados no servidor; intenções ainda locais do outro contêiner continuam lá. Abrir novamente uma instalação local já ativa conserva o uso offline aprovado.

**B:** desenvolver transferência autenticada específica para entrar sem digitar a senha novamente. Precisa protocolo de consentimento/identidade e recuperação próprios; não basta confiar no cookie copiado. Amplia o primeiro recorte.

Base ausente não prova eviction nem ausência de pendências anteriores. Controle ilegível deve seguir Q51, preservado/bloqueado; não se transforma em instalação nova para contornar corrupção. A verificação remota também precisa impedir que seleção automática de cookie restaure a família errada.

### Q71 — Família de sessão web no Java

**A — Recomendada:** sessão web opaca, com autorização e transições controladas no Java/PostgreSQL existente. O navegador guarda só a credencial protegida em cookie e metadados públicos; a API web confirma a sessão esperada antes de usar domínio. O nativo continua com seu ciclo bearer. Isso exige estado/migrations/contrato web explícitos, mas concentra a coordenação remota no servidor já existente.

**B:** conservar também na web o ciclo nativo de access/refresh/revogação, em cookies protegidos separados por sessão/tentativa e selecionados explicitamente. Reaproveita mais semântica nativa, mas amplia a coordenação de rotação/journal, limites e limpeza de cookies no cliente/servidor.

Nenhuma alternativa resolve sozinha Set-Cookie tardio. Ambas precisam impedir que resposta antiga de A substitua/reative B; conferir conta/contexto esperado, provar transições, tratar concorrência e revogar a família correta. Cookie fixo sobrescrito sem esse protocolo permanece insuficiente. Sessão opaca não implica token estável antes/depois do login: fixação e autenticação precisam proteção própria. Referência pública não é credencial. Não adicionar Redis, BFF em outro runtime ou segundo backend.

A pergunta escolhe a família do desenho, **não aprova ainda TTLs web, cookie names, tabelas ou endpoints**. Os15min/30dias do nativo e reset1h permanecem; a adaptação exata da sessão web será consolidada após essa escolha. Falhas em verificações de servidor pausam acesso remoto; não autorizam destruir fila ou exigir rede para cada comando local.

### Q72 — Texto de formulário ainda não salvo

**A — Recomendada:** rascunho permanece somente na aba durante a mesma jornada/conta. Adiar atualização/recarga deliberada enquanto houver edição; se a pessoa escolher sair/atualizar descartando o texto, pedir confirmação. Não prometer recuperação após o navegador matar a aba. Intenções já confirmadas localmente permanecem protegidas pela política de pendências.

**B:** acrescentar recuperação durável de rascunhos por conta, inclusive após encerrar a aba. Exige modelo, armazenamento, escopo por sessão/conta, retenção e recuperação próprios; não tratar rascunho como comando de domínio confirmado.

Logout/troca retira o formulário anterior conforme ADR-016, independentemente da escolha; não pode abrir uma exceção para consultar A em B. Sem reload forçado já é garantia da tarefa05. Q72 decide a durabilidade do que ainda não foi salvo, não repete essa garantia.

## 5. Próximos ramos

Depois de Q70–Q72: concretizar sessão/expiração/transições/seleção de cookies, instalação nova, resposta perdida, revogação e CSRF; fechar schema/adapter assíncrono, posse e geração separadas; definir upgrade com código antigo e formulários segundo a resposta. Manter o mapeamento M1-01–20/WEB-01–10 da rodada1.

Ao esgotar decisões, consolidar o entendimento e contratos executáveis antes de implementar. A tarefa02 continua needs-info; prova física iOS26.6.2/HTTPS permanece gate, e tarefa03 não está liberada.

## 6. Fontes

[RFC6265, corrida de Set-Cookie](https://httpwg.org/specs/rfc6265.html#rfc.section.4.1.1), [Fetch, HTTP-network fetch](https://fetch.spec.whatwg.org/#http-network-fetch), [Fetch, abort](https://fetch.spec.whatwg.org/#abort-fetch), [MDN HttpOnly](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#httponly), [WebKit17.2, cookies na instalação](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/#web-apps).

[6265bis, prefixos](https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html#name-the-__host-prefix) e [Path](https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html#name-the-path-attribute) são trabalho em andamento, consultado como draft; não apresentar como RFC final. [W3C SW Try Activate](https://www.w3.org/TR/service-workers/#try-activate-algorithm), [IndexedDB versionchange](https://www.w3.org/TR/IndexedDB/#versionchange-transaction-concept), [fechamento](https://www.w3.org/TR/IndexedDB/#database-close), [WebCrypto armazenamento de chaves](https://w3c.github.io/webcrypto/#keystorage), [OWASP sessão](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

As alternativas e recomendações são desenho específico do Ritmo inferido dessas restrições e do código atual; não são recomendações mandatórias das fontes. Nenhum navegador, migração, serviço ou infraestrutura foi iniciado para essa apuração.

## 7. Verificação desta consolidação

Nove documentos conferidos em UTF-8 e80 links locais válidos. Entrevista contém três respostas A confirmadas (Q67–Q69) e três perguntas pendentes (Q70–Q72). Specs/ADR/instruções refletem as fronteiras aprovadas; schema detalhado e modelo da sessão continuam em aberto. Fontes de app/API/web/contratos/scripts permanecem iguais a `102e786` e à prova `b8c8e46`.

App: typecheck/lint e213 testes de domínio+51 componentes aprovados. API: `check --no-daemon` aprovado com Java21,13 testes operacionais executados e tarefa Java `test` UP-TO-DATE. Não houve nova suíte/build/browser web porque seu runtime não mudou; último resultado da prova permanece evidência histórica delimitada. Nenhum desses checks aceita a sessão web ainda não implementada. Task02 permanece needs-info e task03 bloqueada.
