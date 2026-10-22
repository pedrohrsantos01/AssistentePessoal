# Contratos do navegador — consolidação em andamento

21/10/2026. **Estado histórico de preparação; Q75=A confirmou o entendimento e02a foi especificado em22/10/2026.** Usar o [contrato executável](../../contracts/pwa-m1/README.md) e o spec/00 para nomes, prazos auxiliares, retenção e transições atuais; o candidato abaixo preserva a investigação anterior. Complementa spec/14; não é schema executável, autorização de publicação ou aceite Safari. Fontes: [entrevista](entrevista.md), [ADR-021](../../docs/adr/0021-fronteira-de-sessao-e-armazenamento-web.md), [ADR-022](../../docs/adr/0022-sessao-opaca-e-entrada-por-instalacao-web.md). Q66 informa iOS26.6.2 declarado, não ensaio físico.

## Fronteiras acordadas

PWA React DOM/Vite/Router, Dexie/IndexedDB e Workbox; frontend estático+Java na mesma origem HTTPS. Credenciais em cookies HttpOnly/Secure; sessão web opaca no Java/PostgreSQL. Instalação nova requer autenticação online própria; cookies copiados não restauram automaticamente outra instalação. Controle+domínio no mesmo banco transacional por instalação, com filtros obrigatórios de conta; aparência em banco separado. Rascunho somente na aba, ligado à conta/jornada, sem promessa após encerramento.

Conta local ativa e autorização remota são estados diferentes. Expiração ou incerteza remota não apagam intenções nem encerram por conveniência o uso local já ativo. Logout deliberado grava bloqueio durável, invalida conteúdo/acesso em todas as abas e conserva fila; reentrada é online. Não prometer remover fisicamente cookie HttpOnly enquanto estiver offline.

## Q73 — Validade aprovada da sessão web

**Pedro respondeu A:** até **30 dias sem comunicação remota autenticada**, com renovação dessa janela pelo uso válido, e **90 dias de duração máxima desde o login**. Ao atingir qualquer limite, exigir autenticação online para voltar a comunicar com o servidor. Revogação/reset encerram a autorização remota quando confirmados pelo servidor. Sessão local não encerrada conserva leitura, novas alterações e pendências, mesmo offline.

Alternativa B, prazo fixo de30dias mesmo com uso diário, não escolhida.

São valores propostos especificamente para o Ritmo, configuráveis por ambiente e conferidos no servidor. As fontes não prescrevem30/90dias. O limite absoluto de A evita uma credencial web mantida indefinidamente apenas por uso; B simplifica o prazo ao custo de login mensal mesmo com uso diário. O nativo mantém access15min/refresh30dias e não muda por esta escolha. Q73 não redefine a retenção das intenções nem o reset1h.

Consolidar como expiração física do cookie e prazo servidor permanecem coerentes. Validade efetiva é o menor entre última comunicação autenticada+30dias e login+90dias. Não renovar sessão vencida/revogada; leitura/comando offline e tentativa anônima não renovam. Não implementar prazo só em JS nem confiar na presença do cookie como autorização. Esses parâmetros não escolhem TTLs auxiliares de reserva, limpeza ou encerramento.

## Q74 — Limite aprovado para contextos de autenticação

**Pedro respondeu A:** limitar a **quatro contextos locais de autenticação por instalação**, incluindo sessão ativa, preparação e encerramentos pendentes. Ao atingir o limite, pausar uma nova entrada até concluir a recuperação/encerramento dos anteriores, sem apagar intenções. Uso local da sessão ainda ativa continua. A interface precisa explicar o bloqueio e oferecer recuperação online; se uma capacidade de encerramento se perdeu, a recuperação tem de comprovar a conta original, sem usar B como autorização sobre A.

Alternativa B, acumular mais contextos com outra política dependente da capacidade do navegador, não escolhida.

O candidato usa até dois cookies protegidos por contexto conhecido (autenticação e encerramento). Quatro contextos/oito cookies não é garantia de armazenamento nem limite físico global comprovado. Reservas órfãs, cookies copiados, headers/eviction e recuperação sem capacidade ainda exigem desenho/ensaio; não contar só os registros visíveis no IDB para alegar limite físico cumprido. Nunca apagar journal incerto ou fila de domínio para liberar vagas.

## Protocolo e provas a concretizar

A sessão opaca precisa resistir a login/cookie tardio, revogação offline A→B, resposta perdida, takeover e contêiner novo. A escolha do modelo não resolveu o protocolo. Não adotar qualquer cookie válido como sessão selecionada, não usar referência pública como autorização e não declarar que abort/fence local desfaz Set-Cookie.

O desenho em avaliação reserva contexto de autenticação antes de enviar a senha, mantém capacidade de encerramento protegida em cookie e serializa autorização/encerramento no servidor. Credencial de um contexto não deve sobrescrever a de outro. Ainda requer limites/limpeza de cookies, recuperação e prova. Esse parágrafo é candidato de engenharia, não schema ou comportamento implementado/aprovado.

Também precisam ser formalizados: transações de comando, seleção/início de push, ack/pull, staging/swap com conjunto vigente em H; três autoridades distintas de sessão, posse e compatibilidade; journal público sem credenciais; atualização/versionchange/conexões antigas e política Q72 para formulários. A prova01 reduzida não substitui esses contratos.

No final, conferir mapa M1-01–20/WEB-01–10, contratos executáveis e provas de IndexedDB/cookies. Safari/Tela de Início no iPhone16e/iOS26.6.2 declarado e HTTPS acessível continuam pendentes. Tarefa02 permanece needs-info e tarefa03 bloqueada.

Fonte para distinguir expiração por inatividade, limite absoluto e verificação no servidor: [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#automatic-session-expiration). Os números acima são escolhas do Ritmo, sem alegar prescrição por essa fonte.

## Desenho candidato — não implementado

Os papéis abaixo não são nomes aprovados de tabelas, campos, cookies ou rotas. São inferências de engenharia a especificar e provar. A prova01 contém fixtures e outro mecanismo experimental; não comprova este desenho. Ignorar corpo, abortar fetch ou conferir geração não desfaz Set-Cookie: [Fetch](https://fetch.spec.whatwg.org/#http-network-fetch), [RFC6265 §4.1.1](https://httpwg.org/specs/rfc6265.html#rfc.section.4.1.1).

### 1. Contexto reservado antes da senha

| Transição candidata | Pré-condição/prova | Resultado exigido |
|---|---|---|
| Reservar | Posse local válida; vaga entre quatro; tentativa pública registrada antes da rede | Java gera contexto e segredo limitado a encerrá-lo, em cookie protegido próprio. Ainda sem autorização de domínio |
| Conferir reserva | Referência pública + cookie limitado correspondente | Comprovar recebimento da capacidade de encerrar antes de enviar senha. UUID público sozinho não prova nada nem reemite segredo |
| Autenticar | Reserva válida/não encerrada; senha válida; transação serializada com fechamento/reset | Vincular uma conta imutável e emitir segredo opaco distinto, em cookie de autenticação próprio do contexto |
| Ativar localmente | Inspeção autenticada comprova instalação/contexto/conta esperados; geração e posse ainda atuais | Ativar somente a conta esperada. Não adotar outro cookie válido como fallback |
| Comunicar/renovar | Cookie de autenticação correspondente ao contexto selecionado; prazo/revogação/compatibilidade válidos | Derivar usuário do registro autenticado; renovar janela Q73 no servidor, sem ultrapassar90dias |
| Sair localmente | Transação durável de bloqueio, sem aguardar HTTP | Invalidar conteúdo/formulário/envio; preservar fila e referência ao encerramento pendente |
| Encerrar remotamente | Cookie limitado do contexto alvo, mesmo enquanto B está ativa | Encerramento idempotente de A, sem leitura de A nem cookie de B como autorização sobre A |
| Recuperar sem capacidade | Prova online da conta originalmente vinculada; fluxo sem criar quinta sessão plena | Fechar apenas contextos comprovadamente dessa conta. Sem prova, preservar bloqueio/diagnóstico |

Capacidade de encerramento não vira credencial autenticada. Java guarda hashes; metadados públicos não autorizam leitura/reemissão/encerramento. Login e close disputam o mesmo contexto na transação: fechar primeiro impede login tardio; autenticar primeiro permite ao close revogar o resultado. Reset deve participar da coordenação para não deixar login concorrente sobreviver com senha antiga. IDs gerados pelo servidor não são reutilizados.

Reserva sem cookie comprovado não avança à senha. Corpo perdido com cookie recebido pode ser reconciliado por consulta protegida; referência pública sozinha não basta. Login aceito com resposta perdida é inspecionado usando a credencial recebida, sem replay automático da senha. Sem credencial utilizável, encerrar com a capacidade previamente comprovada e exigir nova entrada. Senha não é journal/outbox. Reautenticação esperada de A que resulte em B não ativa B automaticamente; invalidar candidato, explicar divergência e preservar fila de A.

Replay em contexto consumido não cria outra sessão nem troca conta ou reemite segredo. Resposta antiga só escreve cookies do seu contexto; mesmo que reapareçam, servidor rejeita contexto terminal. Candidato mantém segredo opaco imutável por contexto, renovando apenas estado servidor; futura rotação exige outro protocolo/contexto. Expires/Max-Age precisam ser coerentes desde a reserva: resposta antiga não deve encurtar uma capacidade posterior. Cookie presente nunca ultrapassa os limites Q73 no servidor.

Antes de implementar, definir nomes/atributos/tamanhos, prazos auxiliares, coleta/órfãos/tombstones, frescor de preparação e header máximo real. Preparação antiga não pode recriar contexto após expurgo. Cópias Safari/Home Screen sem base não autorizam reusar ou revogar a instalação anterior. Quatro registros IDB não comprovam limite de cookies enviados; testar órfãos/cópias e limpeza com resposta antiga. [RFC6265 §6.1](https://httpwg.org/specs/rfc6265.html#rfc.section.6.1), [HTTP field limits](https://httpwg.org/specs/rfc9110#field.limits).

Recuperação sem capacidade precisa comprovar a conta original diretamente, sem consumir quinta vaga. Especificar CSRF, rate limit e não enumeração desse caminho. Sem prova, não liberar contexto por timeout local nem limpar journal/fila; sessão local ainda ativa segue utilizável. Não anunciar que o problema de headers/órfãos está resolvido apenas pela escolha de dois cookies por contexto.

### 2. Fronteira Java, CSRF e cache

Criar cadeia web própria; não copiar csrf desabilitado da cadeia bearer nativa. Candidato: mesma origem estrita, JSON, verificação de Origin e mecanismo CSRF adequado ao Spring Security7.1.1 resolvido no projeto; token CSRF não é autenticação e não entra no journal. Explicitar HttpOnly/Secure/SameSite e escopo; caminho não é fronteira de segurança. Prefixo __Host- exige Secure/Path/Domain corretos e HttpOnly explícito. [Spring CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html), [prefixo __Host-, rascunho6265bis](https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html#name-the-__host-prefix).

Respostas de conta/sync/recuperação fora do cache HTTP e SW; Set-Cookie sozinho não impede cache. Abranger rate limits Q32, Retry-After, compatibilidade e quarentena operacional sem quebrar o nativo. Reset continua1h, por fragmento e sem consumo ao abrir; confirmação revoga atomicamente sessões web junto a famílias nativas/links. Nenhum cookie, senha ou link real em logs/evidências. [HTTP no-store](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2).

### 3. Três autoridades e transferência entre abas

Separar sessão/conta+geração, posse de escrita+época e compatibilidade build/schema/protocolo. Takeover não autentica nem torna código antigo compatível. Leitura secundária pode consultar a mesma sessão ativa; logout/troca invalida apresentação e rascunhos. Ao retomar documento suspenso, validar antes de revelar conteúdo ou habilitar ação.

Candidato sem roubar locks:

1. Documento gera identidade nova e mantém Web Lock próprio, não roubável, para presença; obtém esse lock antes de publicar posse. Presença não é autoridade de escrita.
2. Gate global curto, não roubável, com nome estável entre contas/builds, coordena commits. Autoridade é dono+época persistidos no banco principal.
3. Autoaquisição captura dono/época e tenta presença antiga com ifAvailable. Ocupada: leitura. Disponível: sob gate, publica dono/época apenas se controle ainda corresponder à captura. Perdedor de CAS não adota silenciosamente a época vencedora.
4. Retomada explícita atualiza dono/época sob gate/transação principal, sem roubar presença/gate. Antigo dono pode retomar execução, mas época antiga impede novos commits/envio. Perda da própria presença invalida o documento para ações.
5. Cada mutação inclui controle no escopo IDB e revalida sessão, dono/época e compatibilidade. Obter gate antes de abrir transação e aguardar commit/abort real. Helpers não readquirem gate; rede, diálogo, crypto e reload ficam fora.
6. Dono suspenso dentro do gate: aguardar com explicação/orientação para fechar aba anterior. Não promover por relógio/timeout/steal nem liberar via Promise.race antes do commit. Sem exclusão comprovada, bloquear escrita com diagnóstico.

Bootstrap e migração devem seguir protocolo antes de qualquer Dexie.open que possa atualizar schema. versionchange fecha handle sem pedir gate; assim não espera o migrador que já segura gate e aguarda a conexão antiga. Upgrade trata blocked sem apagar dados. Não prometer takeover imediato durante commit congelado. [Web Locks](https://www.w3.org/TR/web-locks/#api-lock-manager-request), [IndexedDB versionchange](https://www.w3.org/TR/IndexedDB/#versionchange-transaction-concept).

**Limite de crash da aparência:** gate serializa agentes em execução, mas documento destruído pode liberar locks enquanto gravação no outro banco ainda confirma/aborta. Não há atomicidade entre bancos. Delimitação candidata: aceitar conclusão/abort da preferência já iniciada; retomada relê o valor realmente salvo, sem anunciar sucesso/rollback não observado. Nova gravação na mesma store é ordenada pelo IDB. JS antigo não inicia nova alteração após perder posse; hábitos/sessão continuam com fence na transação principal. Preservar Q58 sem bloquear hábitos para impor ordem física com a aparência. [Web Locks, término](https://www.w3.org/TR/web-locks/#termination-of-locks), [IndexedDB, commit](https://www.w3.org/TR/IndexedDB/#committing).

**Barreira remota:** fence local não cancela pedido já aceito pelo Java. Contrato deve prever posse remota no contexto autenticado, com reivindicação e autorização de domínio serializadas na transação servidor. Novo dono envia só após comprovar posse remota; comandos locais podem continuar antes. Pedido aceito antes da barreira pode concluir e ser reconciliado por identidade; depois dela, época antiga é recusada. Ack antigo não confirma localmente sem guarda da jornada/posse atual. É desenho pendente de representação/teste, não garantia já implementada.

### 4. Repositório assíncrono e atualização

Preservar papéis existentes: entidades/revisões, intenções/envelopes imutáveis, dependências/tentativas/prazos/resultados, cursor/seq, staging e projeções. Particionar tudo por conta e derivar acesso do controle. Não copiar singleton por conta de SQLite como singleton global web nem mapear chaves SecureStore para IDB.

Journal de autenticação é distinto da outbox: só referências públicas e estados de tentativa/contexto/instalação/conta/geração/posse, sem consumir client_seq de hábito. Não persistir senha, cookies, access/refresh/revogação, CSRF, token de reset ou hash de senha/corpo de login. Aparência mantém banco versionado e Q58.

| Unidade de commit candidata | Efeitos que precisam confirmar juntos |
|---|---|
| Comando local | Ler controle/dependências e decidir; sequência, intenção e projeção com guarda da sessão/posse/build na mesma transação |
| Início de push | Seleção de elegíveis e marcação de tentativa/em voo atômicas antes do fetch |
| Ack | Recibo, fatos, classificação da intenção e projeção; não avançar cursor de pull por conveniência |
| Pull | Fatos e cursor da página no mesmo commit válido |
| Swap | Revalidar no commit final o conjunto vigente de intenções no corte H; completar classificação antes de trocar staging/cursor/projeções; sem snapshot parcial |
| Logout/ativação | Controle e journal público consistentes, sem segredo remoto ou descarte da conta anterior |

Identidade/relógio/crypto podem ser preparados fora; estado decisório é lido dentro da transação. Nenhum HTTP no bloco IDB; sucesso visual só após commit. Quota/ilegibilidade/migração falha preservam dados Q51/Q63, distinguindo escopo de conta isolável de falha estrutural.

Compatibilidade por build/schema/protocolo: build novo não limpa flag global que libere aba antiga em execução. Cache somente assets estáticos autorizados, preservando os necessários às versões abertas. Não ativar skipWaiting/reload automaticamente durante edição/fila. Atualização deliberada observa Q72. Coordenar SW, conexões e schema; recarregar uma aba não garante encerrar versões antigas. [Ativação SW](https://www.w3.org/TR/service-workers/#try-activate-algorithm), [Workbox](https://developer.chrome.com/docs/workbox/modules/workbox-precaching/).

### 5. Recortes internos propostos da tarefa02

| Recorte | Entrega verificável | Gate |
|---|---|---|
| 02a — Especificação executável | Transições/erros/invariantes, representações físicas, cookies/CSRF/limpeza/recuperação e limites auxiliares; fixtures negativas. Schema implementado só com spec/00+Flyway no mesmo commit | Confirmação do entendimento deste desenho; pontos técnicos abertos resolvidos sem inventar comportamento |
| 02b — Provas locais | Sessão/isolamento no Java e persistência/coordenação em navegador visível; relatório com cenários abaixo, separado do produto | Contrato exato e fixtures de02a. Desktop não aceita Safari |
| 02c — HTTPS/iPhone | Endereço/roteamento e ensaio Safari/Tela de Início no iPhone16e, incluindo cookies, offline, atualização e acessibilidade | Domínio/endereço Q54 e ambiente disponíveis/aprovados; participação no aparelho. Sem contratar/publicar por inferência |

Task02 permanece needs-info, task03 bloqueada. Confirmar o plano não aceita a PWA nem libera jornada03 sem contrato/provas. Novas escolhas de produto serão expostas com recomendação; não reperguntar Q61–Q74.

### 6. Matriz mínima da prova futura

| Grupo | Casos negativos/limites | Vínculo |
|---|---|---|
| Sessão | Login A tardio após B; corpo perdido com/sem cookie; close antes/depois do login; replay terminal/expurgado; cookie de outro contexto sem fallback | WEB-05/06/10 |
| Prazos | Fronteiras30/90dias, renovação concorrente, relógio cliente alterado, vencida não revive; offline não renova nem perde intenção | WEB-03/05 |
| Capacidade | Quatro contextos/quinto bloqueado; perda da capacidade; recuperar sem quinta sessão; órfãos/cópias/header máximo; limpeza com resposta antiga | WEB-05/07/10 |
| Isolamento | A→B→A offline, logout em outra aba, conta inesperada, reset web+nativo e RLS/repositório sem vazamento | WEB-05/10 |
| Posse | Duas abas novas/CAS perdedor; congelada fora/dentro do gate; crash no commit; antigo dono retoma; pedido remoto em voo | WEB-04/06 |
| Dados | Quota/abort sem sucesso; beginAttempt atômico; ack/pull tardios; intenções novas durante staging; H incompleto impede swap | WEB-03/04/08 |
| Upgrade | Schema novo/aba velha, versionchange/blocked, SW esperando, assets antigos, rascunho adia reload, compatibilidade por build | WEB-08 |
| Preferências | Q58 isolada; falha mantém última escolha; crash desconhecido relê commit real sem afetar hábitos | WEB-04/09 |
| Aparelho | Safari/Home Screen com instalações distintas; reabertura offline; VoiceOver/teclado/desempenho | WEB-01–10 |

Mapa detalhado M1-01–20/WEB-01–10 na [rodada1](../../docs/analises/2026-10-21-contratos-pwa-rodada-1.md). A matriz acima planeja evidência, não relata testes executados. Fontes de plataforma não provam conformidade do aparelho; documentos W3C/6265bis citados têm status de rascunho. Conferir APIs da versão resolvida antes de implementar.
