# PWA — sessão web e cookies, recorte09/02b

22/10/2026. Implementação e prova local da fronteira web no Java/PostgreSQL existente, conforme [tarefa09](../../.scratch/pwa-m1/issues/09-provar-sessao-web-e-cookies.md), [contrato](../../contracts/pwa-m1/README.md) e [modelo](../../specs/00-modelo-de-dados.md#representação-web-especificada-em02a--22102026). **Recorte09 concluído no escopo local; não encerra M1 nem aceita Safari físico.**

## Entrega

Implementadas as17 rotas POST do contrato: reserva, preparação, prova da reserva, cadastro/login, inspeção, posse, encerramento/recuperação, reset e adapters de sincronização m1.1. As contas dos ensaios são sintéticas. Não há jornada web de produto nem migração da prova01 para dados reais.

V6 cria instalações e contextos privados a Identity. Armazena só hashes SHA-256 dos segredos aleatórios distintos de auth/close; tickets de preparação são assinados com chave independente. Challenge grava a reserva antes de responder; prepare só atualiza registro existente. Replays não reemitem segredo. Metadados públicos não identificam a conta de um contexto vinculado.

Cookies HttpOnly/Secure/SameSite=Strict e host-only usam Path específico do contexto e Expires fixo no header, sem Max-Age. Não prometemos remoção física exatamente nesse instante: [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#expiresdate) documenta a compensação por Date/relógio no Chromium/Firefox. No Chrome, o teste mediu cerca de1,07s de diferença para o cookie tardio; estado/prazo no Java/Postgres continuam sendo a autoridade. Essa correção técnica remove uma garantia excessiva de02a sem alterar Q73 ou os prazos aprovados. Cookie close não autentica domínio. A fronteira web exige origem HTTPS configurada, header não simples e JSON, recusa Authorization/bearer e devolve no-store inclusive nos erros de compatibilidade/quota/quarentena. Não há CORS permissivo ou cookie CSRF global.

A função SQL restrita valida credencial, conta, posse e prazo sob locks de usuário/contexto na mesma conexão/transação do comando. Uma autorização HTTP anterior não substitui essa barreira. Sync nativo e web travam a conta antes do estado de sincronização, evitando inversão com o UPDATE de onboarding. A policy do dono resolve o proprietário atual pelo catálogo, sem nome de role de origem; restauração com --no-owner continua possível sob outro dono. Primeira chamada valida; após a quota de conta, a segunda renova a inatividade. Epoch antiga não substitui posse mais nova. Native bearer e envelopes/identidades do domínio permanecem.

A recuperação por senha comprova a conta original sem quinta sessão. Após91dias, limpeza remove hashes e conserva o mínimo de prova, sem interpretar404 como encerramento. Reset e preparação de restauração invalidam contextos web. Quarentena externa também bloqueia a fronteira web. Limpeza periódica tem lote máximo de500; não houve prova de capacidade operacional externa.

## Evidência e execução

A suíte `WebSessionTests` usa HTTP/PostgreSQL reais e valida os adapters independentemente do oráculo Python. Inclui reserva/replay, falta de capacidade, A/B, prazos, recuperação, comandos/rollback, grants/RLS, snapshots/pull/recibos e barreira de posse. A migration é aplicada com dono sem SUPERUSER/BYPASSRLS. Há provas de reservas concorrentes, reset/login nas duas ordens sobrepostas, expiração no relógio Java e no Postgres e convivência com onboarding nativo. O teste mantém uma transação de domínio aberta para demonstrar que um claim aguarda seu commit e que PID/transaction ID permanecem iguais durante a gravação.

A prova de navegador é um job finito opt-in (`RITMO_WEB_BROWSER=1`), documentado no [README da API](../../api/README.md#prova-de-sessão-web--recorte0902b). Usa Chrome **visível**, proxy HTTPS local e a API/Postgres descartáveis. Não usa servidor de desenvolvimento persistente ou conta real. Certificado/portas/perfil são do ensaio. Browser, proxy, API, containers e certificados próprios são encerrados/removidos em finally; processos preexistentes são preservados.

No browser, a resposta de login é retida no proxy depois de o Java confirmar. Outra conta entra, o contexto antigo é encerrado e só então o Set-Cookie antigo chega: o cookie reaparece fisicamente, mas a inspeção do contexto recebe401 e B permanece válida. Outro login tem corpo truncado após os headers; inspeção recupera a sessão sem reenviar senha. Cancelamento por AbortController depois da confirmação remota não desfaz o login; o contexto exige encerramento comprovado. Essas situações são rede real do ensaio, não respostas de auth simuladas no browser. Para431, o driver injeta e remove somente cookies volumosos sintéticos pelo controle de teste; o produto não recebe rotina automática de limpeza de cookies ou IndexedDB.

Evidências locais ignoradas pelo Git em `output/playwright/web-session/`: `result.json`, `driver.log`, `01-late-response-isolation.png` e `02-complete.png`. O JSON registra atributos de cookies **sem seus valores**. Credenciais sintéticas só existem na memória/ambiente descartável dos testes; nenhuma credencial operacional foi lida.

Versões: Node24.13.0, pnpm10.32.1, Java21.0.8, Gradle8.14.4, Boot4.1.1, Security7.1.1, PostgreSQL18.6, Playwright1.64.1; Chrome155.0.8059.85 na prova inicial. O certificado do ensaio é autoassinado e a exceção de confiança é exclusiva do contexto de teste; não indica TLS público válido.

## Verificações

- App: typecheck/lint aprovados;213 testes de domínio e51 de componentes passaram.
- Web: typecheck/lint e2 testes da prova sintética passaram; esses2 não validam o futuro IndexedDB de produto.
- Contrato:17 rotas,65 schemas de transporte,10 registros locais;50 exemplos e61 cenários do documento/oráculo passaram. Não substituir integração por essa contagem.
- Matriz web:16 casos passaram na rodada com `RITMO_WEB_BROWSER=1`; Chrome visível concluiu7 etapas, incluindo cookie volumoso431 através do proxy HTTPS. Atributos reais e diferença de Expires registrados em result.json.
- API: `gradlew test --fail-fast check --no-daemon` completo aprovado em12m53s.111 casos Java:102 passaram,9 opt-in ignorados (8 Android e browser já exercitado na rodada visível).13 testes operacionais passaram. A última alteração foi somente a fixture de retenção; fontes de produção/driver da rodada visível foram preservadas.
- Retenção: o teste agora trava usuário e estado nessa ordem, aguarda ambas as leituras e avança o relógio; as duas continuam devolvendo410 snapshot_expired. A assertiva de expiração foi mantida.

A regressão encontrou e resolveu: contrato web ausente na imagem (COPY/allowlist), policy com nome fixo do dono de origem (agora predicado do proprietário atual, compatível com restauração), fixture de recuperação que ainda transferia só três tabelas e versão esperada5 após V6. O primeiro Postgres demorou além do prazo padrão antes das regras; a nova fixture tem startup limitado a180s. Um ensaio físico WAL atingiu420s na primeira rodada e passou nas seguintes sem alterar esse limite. Nenhum requisito/SLO operacional foi flexibilizado.

Conferência documental:11 Markdown e126 links relativos válidos, UTF-8 sem caracteres de substituição e diff sem erro de whitespace. Regeneração dos3 artefatos de contrato determinística; contrato de domínio nativo preservado.

Não há container Testcontainers remanescente ao final. Browser/proxy finitos e certificados próprios foram encerrados/removidos; processos preexistentes preservados. Não houve emulador, publicação ou contratação neste recorte.

## Limites e próximo recorte

[Tarefa10](../../.scratch/pwa-m1/issues/10-provar-coordenacao-e-commits-web.md), agora ready-for-agent: coordenação local, IndexedDB principal/visual, CAS/presença/gate, journal, outbox/acks e upgrade/SW. Esses adapters não foram implementados nesta prova de servidor. A semântica de salvar intenções web, logout offline, troca de conta e retenção local ainda precisa dessa integração; a API não descarta fila de cliente.

Gate02c: domínio/origem pública e configuração efetiva do Coolify/ingress, Safari/Tela de Início no iPhone16e e demais critérios WEB-01–10. Java aceita16KB de headers; o limite do ingress real ainda não foi medido. iOS26.6.2 é informação fornecida por Pedro, sem prova física neste recorte. HTTPS local/Chrome não substituem Safari, reinstalação, eviction ou sincronização PWA+Android no uso real. Tarefas02/03 e M1 permanecem abertas nos seus gates; sem publicação, contratação ou aceite da Fase1.
