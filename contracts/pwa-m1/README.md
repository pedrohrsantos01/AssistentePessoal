# PWA M1 — contrato executável 02a

22/10/2026. **Desenho02a autorizado por Q75=A. Servidor e V6 aplicados no recorte09/02b; IndexedDB/jornada web de produto continuam pendentes.** Fontes: [spec/14](../../specs/14-pwa-primeiro-marco.md), [modelo](../../specs/00-modelo-de-dados.md#representação-web-especificada-em02a--22102026) e [ADR-022](../../docs/adr/0022-sessao-opaca-e-entrada-por-instalacao-web.md). Nativo e domínio m1.1 permanecem. Este pacote é a referência de conformidade de02b. As provas reais do servidor/cookies estão no [relatório09](../../docs/analises/2026-10-22-prova-sessao-web.md); o pacote sozinho não prova execução ou iPhone.

`build_contract.py` gera `openapi.json`, `local.schema.json` e `policy.json`. `examples.json` contém mensagens positivas/negativas; `scenarios.json` explicita decisões de autorização/commit. `validate.py` confere documentos, exemplos, políticas e o oráculo desses cenários. Nenhum gerador escreve em app/api/web. Bibliotecas da validação são as já fixadas em `../primeiro-marco/requirements.txt`.

```powershell
python contracts/pwa-m1/build_contract.py
$env:PYTHONPATH=(Join-Path (Get-Location) '.scratch/contract-tools')
python contracts/pwa-m1/validate.py
```

## 1. Identidades e permissões

Instalação = contêiner local com IndexedDB válido e UUID próprio; documento/aba = UUID novo por carregamento. Contexto remoto = UUID gerado pelo Java, vinculado imutavelmente à instalação e, após senha válida, a uma conta. IDs não autorizam. Nunca selecionar sessão por qualquer cookie encontrado. Sem controle local, login online próprio (Q70); controle ilegível bloqueia/preserva (Q51).

Cookies: segredo aleatório de32bytes, base64url, hash SHA-256 no servidor, comparação constante; nenhum segredo recuperável no Postgres. `__Secure-ritmo-close` só encerra/confirma reserva; `__Secure-ritmo-auth` só autentica o contexto. Não promover close a auth. Mesma origem HTTPS; nenhum bearer nativo aceito como fallback nas rotas web. Rejeitar Authorization nessas rotas; securitySchemes cookie do OpenAPI descrevem o navegador, não autorizam gerar cliente JS que leia/preencha o segredo. Fetch usa credentials same-origin.

Ambos: `Secure; HttpOnly; SameSite=Strict`, **sem Domain**, Path exato `/api/v1/web/contexts/{contextId}/`. Usar Expires absoluto fixado no servidor, sem Max-Age. Não usar __Host-, que requer Path=/; Path reduz envio de cookies, **não é fronteira de segurança**. Rejeitar nomes duplicados/ambíguos; não escolher primeiro/último cookie. Cookie forjado ou de outro contexto não autentica. A rota `/auth/prepare` pode emitir cookie para o Path do contexto devolvido.

Os cookies de A não são enviados à rota de B por esse Path. Cookies órfãos/copiados ainda podem consumir quota/causar eviction; quatro contextos conhecidos não garantem oito cookies físicos. Perda de cookie pausa remoto e segue recuperação, preservando a sessão local ativa/fila. Não prometer durabilidade contra limpeza/eviction do browser (Q63).

## 2. Prazos e reserva

Valores de engenharia de02a, subordinados a Q73/Q74, em `policy.json`:

| Parâmetro | Valor e regra |
|---|---|
| Inatividade remota | 30dias desde última comunicação autenticada válida |
| Limite absoluto auth | 90dias desde autenticação; cookie auth expira nesse instante fixo |
| Ticket de preparação | 5min desde emissão, assinado no Java; somente memória JS |
| Reserva sem conta | 10min desde emissão do ticket; não prolongar por retry |
| Cookie de close | Expira91dias desde emissão do ticket; cobre reserva+90dias de auth |
| Tombstone do contexto | Hashes até o prazo fixo do close; depois, manter registro mínimo sem segredos/hashes para prova de encerramento. Sem expurgo automático desse mínimo no M1 |
| Contextos | Quatro não terminais por instalação; cliente contabiliza journal e servidor reserva sob lock da instalação |

Todos os intervalos são semiabertos: em `now >= deadline`, venceu. Prazo efetivo auth = mínimo de `last_seen_at+30dias` e `absolute_expires_at`. Relógio servidor, sem depender do relógio do cliente. Não renovar vencida/revogada, por leitura offline, tentativa anônima, falha de credencial/posse/CSRF,426 ou429. Comunicação que passa os guardas pode renovar mesmo se resultar em rejeição de domínio. Atualização de `last_seen_at` não gira segredo nem emite novo cookie.

`challenge` grava a reserva vazia sob lock da instalação **antes de responder**, sem cookie, conta ou segredo de close/auth. Assim, mesmo crash entre marcar envio e fazer fetch deixa um contexto consultável. Repetição do mesmo attemptId é409 context_conflict, sem novo contexto ou reemissão de ticket; retorno perdido antes de qualquer prepare não pode autenticar. Reservas órfãs remotas contam nas quatro vagas até expirarem em10min; se bloquearem nova entrada, informar espera e permitir reconsulta, sem apagar journal/fila. Não oferecer uma quinta reserva para contornar a situação. Ticket HMAC assinado contém versão, attemptId, contextId novo, installationId, expectedAccountId opcional, emissão e prazos absolutos. Chave própria no ambiente/cofre, fora do cliente/IDB; perda/rotação invalida preparações, não autentica contextos. Não persistir ticket. Antes de prepare, gravar referências/próximos passos no journal sob guarda; depois marcar `prepare_dispatched=true` duravelmente antes do fetch. Ticket expirado não insere/recria contexto, mesmo após expurgo do tombstone.

`prepare` exige reserva já existente, ticket válido e vínculo correspondente; gera close uma única vez, sem inserir outro contexto. Reserva desconhecida é404 e nunca é criada por prepare/login. Uma interrupção depois de prepare_dispatched e antes do fetch pode ser resolvida pelo status da reserva original após expirar, sem tratar ausência como prova. Repetição para o mesmo contexto retorna metadados sem reemitir segredo; ticket com vínculo divergente é409. Primeira resposta perdida pode ter aplicado cookie: confirmar a reserva por requisição ao Path correspondente. Sem cookie comprovado, **não enviar senha**. Se o ticket se perdeu antes de qualquer prepare despachado, terminar tentativa com prova local `not_dispatched`; não há autorização remota possível. Callback tardio deve falhar na guarda do journal antes de despachar.

## 3. Transições remotas e respostas perdidas

| Estado/evento | Permissão | Efeito/retorno |
|---|---|---|
| Reserva dentro do prazo / confirmar | Cookie close | Metadados de reserva, sem conta/perfil |
| Reserva / login ou register | Close comprovado, senha válida, deviceId igual à instalação; dono/época local enviados | Vincular conta e segredo auth distintos atomicamente; devolver WebSession público |
| Reserva / senha inválida | — |401; sem auth ou nova conta; reserva ainda pode receber tentativa explícita dentro do prazo/rate limit |
| Contexto já autenticado / repetir login | Não repetir senha automaticamente |409 context_conflict; inspecionar com auth, sem reemissão de segredo |
| Autenticado / inspect ou domínio | Auth exato + guarda de posse, conta esperada no domínio e prazos | Perfil público ou contrato m1.1; renovar inatividade válida |
| Reservado/autenticado / close | Close exato | Estado terminal idempotente; limpar os dois cookies no Path exato, sem criar sessão |
| Contexto terminal / pedido tardio | Nunca autorizar domínio |401/409; Set-Cookie tardio não reabre registro terminal |
| Nunca autenticado / reserva vencida ou fechada | Status público não privado | `expired_unbound` ou `closed_unbound`, suficientes para terminar a preparação local; não recebem perfil ou auth |
| Vinculado, qualquer estado / status público | Referência não é prova | `proof_required`, sem conta/perfil/estado de revogação; usar close ou recuperação autenticada |

Login/cadastro serializam com close: close primeiro impede vínculo; login primeiro permite ao close revogar o resultado. Login recebido só ativa a jornada após inspeção autenticada do contexto e nova guarda local (conta/geração/posse/build). Se corpo do login se perdeu, inspecionar com o cookie eventualmente recebido, **sem replay automático de senha**. Sem auth utilizável, fechar com close e pedir nova entrada. Se close também se perdeu, usar recuperação.

`expectedAccountId`, quando informado na preparação para reabrir A, precisa corresponder à conta comprovada pela senha **antes** de emitir auth; divergência409 account_mismatch sem ativar B. A senha e o cadastro não participam da outbox de domínio; não guardar senha, hash de senha/corpo de login, ticket ou token de reset no journal. Hábito/intenção já salvos mantêm suas identidades.

Metadados de inspeção exigem auth e posse. O endpoint público `reservation-status` só revela reserva/prazo, prova terminal de nunca autenticado ou `proof_required`; contexto ausente é404 e **não comprova** encerramento. Falha de rede/404 sem prova não libera vaga por conveniência. Expires é emitido com data fixa, mas não garante exclusão física nesse instante: Chromium/Firefox podem compensar o prazo a partir do header Date/relógio. A segurança depende dos prazos/estado no servidor, que recusa cookie revogado/vencido mesmo se ele permanecer ou reaparecer. A prova09 mede a diferença observada sem usar desaparecimento como autorização. [MDN: Expires e compensação de relógio](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#expiresdate).

## 4. Quatro contextos, logout e recuperação

Contar todo journal com phase diferente de terminal, incluindo ativo, preparando e close pendente. Reserva simultânea no servidor também limita a quatro contextos não terminais da instalação; expirar reserva nunca autenticada no servidor não apaga journal local. Sem vaga: `auth_context_limit`, nova entrada pausada com recuperação online; sessão local ativa continua.

Logout: transação principal incrementa geração, limpa seleção da conta/contexto, marca close_pending e bloqueia conteúdo/envio antes de confirmar saída. Finalizar controle locked sem depender de conexão; preservar fila/conta isoladas. Close remoto é feito com a capacidade do **contexto A**, inclusive enquanto B está ativa. Não requer posse remota de B. Após comprovado closed/expired, journal vira terminal e não conta nas quatro vagas; não confundir cookie fisicamente residual com autorização. Sessão local não encerrada pode manter a referência histórica a esse contexto terminal e continuar leitura/escrita; envio exige journal ativo e autorização atual. Isso não reabre remoto nem conta a cópia local como uma quinta credencial. Uma nova autenticação substitui a referência sob guarda.

`POST /auth/recovery-close` recebe contextId + email/senha **somente em memória**, sem criar contexto, sessão ou cookie auth. Comprovar que a conta da senha é a vinculada ao contexto, então fechar/limpar o Path alvo e devolver prova terminal. Credencial de B não fecha A. Conta inválida/senha inválida:401 genérico; alvo ausente ou de outra conta:404 context_unavailable, sem revelar seu proprietário. Sem senha disponível, a recuperação de senha existente permite obter nova prova online; reset revoga todas as sessões dessa conta. Não reabrir a base antiga automaticamente após reset.

Limpeza periódica: reservas vencidas viram expired_unbound; contextos auth vencidos ficam expirados. Após close_expires_at, remover hashes auth/close e manter tombstone mínimo (IDs, vínculo de conta quando houve autenticação, estado e prazos), sem expurgo automático no M1. Isso permite provar reserva nunca autenticada ou recuperar por senha da conta original após os91dias, sem depender de um cookie já expirado. Não interpretar404 como essa prova. Exclusão de conta, quando implementada, deve abranger os registros vinculados; não prometer reentrada em conta excluída. Nenhum cleanup emite novo segredo ou remove intenções/controles locais. Cookie órfão em outro Path pode reaparecer numa resposta atrasada até seu Expires, mas não contamina o header do contexto atual. Não enumerar/apagar contextos de outro contêiner usando apenas installationId público.

## 5. HTTP, CSRF, limites e erros

Todas as17 rotas de `openapi.json` são **POST JSON**, inclusive inspeção/pull/status. Exigir Origin igual à origem HTTPS configurada (`RITMO_WEB_ORIGIN`), `X-Ritmo-Web: 1` e Content-Type application/json; rejeitar Origin ausente/null, formulários/simple requests e cross-origin. Sem CORS permissivo; não construir origem confiável a partir de Host/X-Forwarded-* não confiável. Fetch Metadata pode reforçar rejeição, não substituir esses guardas.

Esse é o padrão de CSRF por header não simples + origem estrita; não usa cookie/token CSRF global sujeito a sobrescrita entre contextos. A cadeia web Spring é ordenada antes da bearer e precisa executar esse guarda antes de qualquer efeito. Não basta copiar `csrf.disable()` do nativo; testes02b devem comprovar que falha do guarda não alcança comandos. [OWASP: custom headers/origem](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#employing-custom-request-headers-for-ajaxapi), [Spring Security7.1.1: chains](https://github.com/spring-projects/spring-security/blob/7.1.1/docs/modules/ROOT/pages/servlet/configuration/java.adoc).

Toda resposta web tem `Cache-Control: no-store`; rotas de API fora do SW, sem cache de perfil/sync/auth/reset. Campos humanos traduzidos via i18n; erros não carregam payload, SQL, credenciais ou link. Headers de compatibilidade reutilizam `X-App-Version` e `X-Ritmo-Protocol: m1.1`; sem protocolo nativo novo. Cookie header acima de8192bytes produz431 headers_too_large; ingress e Java devem aceitar ao menos16384bytes totais para o Java poder responder. O Java já aceita16KB no recorte09; o proxy HTTPS local foi ensaiado, mas a configuração real de ingress/Coolify continua gate02c. Mesmo se o ingress responder431 sem JSON, preservar fila e mostrar erro de transporte; não reenviar/limpar dados automaticamente em431.

Quotas Q32 compartilhadas com o nativo:300/min/IP e120/min/conta. Login10/min/IP; register5/min; reset request3/15min; reset confirm10/min; demais preparações/inspect/claim usam bucket refresh60/min; close usa revoke60/min. Recovery-close consome login e revoke; chamadas de domínio usam quota autenticada de conta. Não criar bucket ilimitado por UUID ou outro bucket por alias web para contornar o limite.429 com Retry-After, sem classificar intenção como rejeitada.

| HTTP/código | Tratamento exigido |
|---|---|
|400 invalid_request | Preservar conteúdo; corrigir envelope/cabeçalho, sem recibo de domínio |
|401 invalid_credentials / session_invalid / cookie_ambiguous | Sem autorização; reconciliar contexto/pedir login conforme prova; preservar uso local ainda ativo e fila |
|403 csrf_rejected | Sem efeito; diagnosticar origem/cliente, nunca relaxar guarda para retry |
|404 context_unavailable | Não prova encerramento; recuperação com credencial da conta ou preservar bloqueio |
|409 preparation_expired / context_conflict / context_closed | Não recriar contexto ou senha automaticamente; conferir prova/encerrar tentativa |
|409 account_mismatch / owner_lost / auth_context_limit | Não ativar conta errada; pausar envio/entrada afetados e revalidar controle |
|409/410 resync_required / snapshot_expired | Contrato m1.1: preservar base, tratar somente staging |
|413 payload_too_large | Dividir lote mantendo envelopes/identidades; não truncar operação |
|426 unsupported_version | Preservar leitura/fila e restrição de escrita até compatibilidade do build |
|429/503 rate_limited / temporarily_unavailable | Retry-After/backoff existentes, sem perder intenções |
|431 headers_too_large | Pausar remoto; diagnóstico, sem limpeza de IDB ou fallback de identidade |

## 6. Posse local e remota

Nome de gate estável `ritmo:web:commit:v1`; presença `ritmo:web:document:{tabId}`. Sem steal/TTL. Documento mantém presença antes de publicar posse. Autoaquisição captura dono/época, testa presença antiga com ifAvailable e publica somente por CAS sob gate; explícita atualiza dono/época sob gate, sem roubar locks. Perda de presença invalida ações. Antigo dono vivo usa época antiga e não confirma novos commits.

Época é decimal0..9223372036854775807, sem Number/arredondamento; incrementar exatamente, bloquear se esgotar. Transações de domínio incluem controle e guardas de conta/geração, dono/época e compatibilidade. Gate antes da transação, liberação após commit/abort real. Não reentrar gate, esperar HTTP/crypto/diálogo dentro dele nem liberar por timeout. Congelamento dentro do gate aguarda com explicação; não promete takeover instantâneo. Leituras secundárias só na mesma conta/jornada e revalidam antes de revelar ao retomar.

`claim-owner` com cookie auth avança época remota apenas se maior; igual aceita somente o mesmo tabId (idempotência); menor/igual com outra aba é409 owner_lost. Não usar ordem de chegada como vencedor: claim antigo tardio não supera época maior. Domínio/inspect com headers Owner-Epoch/Owner-Tab exigem igualdade. Identificadores/época não substituem cookie. Domínio ainda confere Expected-Account; idempotência/hash usa corpo m1.1 original, sem headers/URL de posse.

Autorização/claim/reset/close e comando de domínio precisam compartilhar transação/lock servidor, sem check-then-act no filtro HTTP. Ordem de lock: usuário (quando vinculado), contexto, domínio; reserva usa instalação antes de inserir contexto. Lookup preliminar pode identificar a chave, mas revalidar cookie/estado/conta/prazo/época sob os locks. O módulo Identity deve expor uma operação transacional ao domínio, mantendo grants/RLS, sem conceder leitura de hashes ao domínio. Reset usa lock de usuário já existente, revoga famílias nativas e contextos web na mesma confirmação. Quarentena/recuperação operacional também invalida contextos web antes da liberação.02b deve testar ordens concorrentes e ausência de deadlock/vazamento.

Pedido aceito antes da barreira pode concluir; novo dono reconcilia pela identidade. Depois da barreira, época antiga não autoriza. Novo dono pode salvar comandos locais antes de obter posse remota, mas só envia após confirmar claim atual. Ack antigo não faz commit local sem guarda atual.

## 7. Commits, falhas e atualização

Representações físicas/índices no modelo; schemas públicos de controle/journal/compatibilidade/preferência em local.schema.json. Sem adaptar APIs síncronas do SQLite. Interfaces do repositório são assíncronas e retornam somente após commit. A leitura decisória pertence à transação; identidade/crypto podem ser preparados antes, rede não. [Dexie: transações](https://dexie.org/docs/Dexie/Dexie.transaction()).

| Operação | Stores/efeitos no mesmo commit principal |
|---|---|
| Comando/onboarding/correção | Controle, compatibilidade do build, estado de conta/seq, intenção/dependências e projeção |
| beginAttempt | Controle+compatibilidade, selecionar elegíveis e marcar in_flight/attempts antes do fetch |
| Ack | Guarda, recibo/classificação/erro, entidades/projeções; sem avançar cursor de pull |
| Pull | Guarda, fatos/projeção e cursor juntos |
| Snapshot | Staging permanece separado; swap confere intenções vigentes/classificadas em H e troca base/cursor/projeção atomicamente |
| Ativação/logout/posse | Controle+journal e validações; ativação também semente pública do perfil/conta. Sem segredo ou descarte da fila |

Evitar liveQuery sem filtro de conta/guarda. Falha estrutural preserva/bloqueia banco inteiro; falha isolável bloqueia conta. Quota/abort não produzem sucesso nem consomem sequência isoladamente. Aparência mantém Q58 em outro banco: gravação já iniciada pode terminar após crash; retomada relê resultado real sem afirmar rollback/sucesso desconhecido e sem bloquear hábitos. Não há transação entre bancos.

Schema inicial de produto éV1 em banco novo `ritmo-main`; **não migrar fixtures** de `ritmo-synthetic-probe`. Preferências `ritmo-appearance`,V1. Upgrade futuro exige plano/adaptação atômica e teste de abort; desconhecido preserva e bloqueia escopo. Abrir/migrar sob coordenação antes de Dexie.open; versionchange fecha handle sem adquirir gate para evitar deadlock, blocked aguarda abas antigas. Sem deleteDatabase como recuperação.

Compatibilidade pertence ao build/protocolo/schema em execução, não flag global.426 com schema local conhecido preserva leitura; versão física desconhecida/ilegível bloqueia o escopo conforme Q51, preservando dados, sem fingir leitura de formato desconhecido. Build novo não libera escrita de aba antiga. SW não escreve domínio/journal nem executa sincronização de segundo plano: API excluída, precache só recursos públicos versionados; ativação aguarda clientes antigos, sem skipWaiting/clients.claim automáticos. Rascunho adia atualização deliberada, confirmação de descarte Q72; nenhuma atualização exige apagar fila. Reter assets das versões ainda usadas. Conexões antigas, crash e rollback de migração precisam prova02b; Safari/VoiceOver/performance são gate02c.

## 8. Escopo das provas seguintes

Validar OpenAPI/JSON Schema e cenários do oráculo **não prova** o adapter Java, cookie jar ou exclusão IDB.02b implementará ensaios reais das ordens login/close/reset, cookie Path/Expires/resposta perdida, quatro contextos/recuperação, posse CAS/claim tardio, quota/ack/snapshot/upgrade.02c mede Safari/Tela de Início no iPhone e HTTPS disponível. Task02/M1 seguem abertos até seus gates; task03 não é liberada pela geração destes arquivos.
