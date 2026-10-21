# Contratos PWA — diagnóstico e rodada1

21/10/2026. **Estado: proposta para discussão, sem aprovação dos contratos novos.** Origem: [tarefa02](../../.scratch/pwa-m1/issues/02-fechar-contratos-do-navegador.md), [spec/14](../../specs/14-pwa-primeiro-marco.md) e [prova01](2026-10-21-prova-tecnica-pwa.md). Baseline de código: `b8c8e46`. Entrevista: [registro e árvore de decisões](../../.scratch/pwa-m1/entrevista.md).

**Q66 respondida:** Pedro informou iOS26.6.2 no iPhone16e. Versão declarada pelo operador, sem ensaio físico ou dedução da versão exata do Safari/WebKit. HTTPS acessível ao aparelho continua pendente; Q54 permanece com nome do domínio a escolher, sem nova solicitação de compra.

## 1. O que já está definido

Q61–Q65 e ADR-020 mantêm M1 web, Safari/Tela de Início, IndexedDB/Dexie, Workbox, uma aba escritora e o limite de durabilidade. Não reabrir essas escolhas por preferência de implementação.

ADR-016 e spec/13 preservam: logout offline, bloqueio local após saída, pendências sem expiração, A→B→A isolado e reentrada online. Uma conta local ativa pode continuar trabalhando sem comunicação remota; expiração/401/indisponibilidade não apagam fila. Q51–Q53 e Q56–Q58 preservam falhas de abertura/credenciais/identidade e preferências independentes.

O nativo já define access15min, refresh rotativo30dias, segredo limitado de revogação conservado após refresh e reset1h. Nenhuma escolha desta rodada altera esses tempos, a API bearer ou o comportamento nativo. Tempos, cookies e renovação de uma eventual sessão web precisam de contrato próprio antes de implementar.

## 2. Fatos de código que impedem uma cópia direta

| Evidência atual | Consequência para o contrato |
|---|---|
| [Security.java](../../api/src/main/java/dev/ritmo/identity/Security.java), linhas43–51: bearer stateless, CSRF desativado, JWT sem família/deviceId | Cookie automático exige fronteira web própria com CSRF. Não habilitar cookie na cadeia atual sem revisão |
| [Identity.java](../../api/src/main/java/dev/ritmo/identity/Identity.java), linhas52–109: refresh serializado/uso único; deviceId registrado, sem prova adicional no refresh/revoke | deviceId identifica instalação; não autentica nem prova que um cookie pertence ao IndexedDB encontrado |
| [session.ts](../../app/src/core/identity/session.ts), linhas153–182: credencial antiga desvinculada antes de renovar; falha ambígua exige reautenticação | Não existe operação equivalente de remover uma referência JS a um cookie HttpOnly. Um refresh novo pode chegar ao browser sem confirmação local |
| [installation-store.ts](../../app/src/core/identity/installation-store.ts), linhas17–30: geração/estado duráveis | Cercar commit local por geração continua obrigatório; isso não cancela processamento remoto nem Set-Cookie tardio |
| [session-opening.ts](../../app/src/core/identity/session-opening.ts): banco nativo por conta e controle separado | A prova usa outro desenho físico: conta+controle na mesma base Dexie. Escolher a fronteira transacional web antes de declarar stores/migrações de produto |
| [Journey](../../app/src/features/journey/journey.ts), linhas43–58/107–144: consultas e comandos síncronos | Não basta acrescentar await a cada método: leituras que determinam a intenção e gravações precisam continuar consistentes |
| [synchronize.ts](../../app/src/core/sync/synchronize.ts), linhas96–99/120–125: classificação/swap e seleção/início de push contíguos | No adapter assíncrono, métodos separados podem permitir uma nova intenção entre leitura e escrita. Exigir revalidação dentro da transação final |
| [prova Dexie](../../web/src/store.ts): cinco stores, só status pending, dia/device fixos | Omite cursor, retry, staging, recibos, onboarding e sessão. Não é um adapter de M1 pronto |

Revogação atual impede refresh imediatamente; access JWT emitido mantém a janela residual15min já contratada. Replay de refresh antigo é rejeitado, mas **o código não revoga automaticamente toda a família por replay**. Registrar esse fato corretamente evita prometer uma garantia que o servidor não implementa.

## 3. Inventário lógico e unidades transacionais

Inventário derivado de [spec/00 §12](../../specs/00-modelo-de-dados.md), [DDL da conta](../../app/drizzle/0000_account.sql) e [controle](../../app/drizzle-control/0000_installation.sql); **não é definição de novo schema Dexie**:

- Controle da instalação/conta selecionada, geração, estados active/logging_out/locked e compatibilidade persistida. Referências de SecureStore não se tornam segredos em IndexedDB.
- Entidades canônicas tipadas por conta/tipo/chave, revisão decimal em string e tombstones.
- Intenções imutáveis por conta/operação; unicidade por conta/aparelho/sequência; dependências, status, tentativas, próximo prazo, erro e resultado.
- Estado de sincronização: cursor, próxima sequência, passo de onboarding e manifesto/cursor/validade de snapshot.
- Staging do snapshot e projeções habit/xp, incluindo a decisão sem prêmio e concessão original.
- Aparência por instalação em armazenamento separado/versionado; sua falha não bloqueia hábitos/login, conforme Q58.

Unidades a preservar no contrato assíncrono:

1. **Comando:** verificar proprietário/conta/geração e estado, ler perfil/projeção/contexto, validar intenção, alocar sequência, gravar envelope/dependências e projeção. Resolver sucesso somente após commit. Onboarding, reordenação e correções compostas não viram várias confirmações independentes.
2. **Push:** selecionar/revalidar lote e persistir in_flight/tentativa antes do fetch; nunca aguardar HTTP dentro da transação IndexedDB. Retentativa usa o mesmo envelope e prazo persistido.
3. **Ack/pull:** conferir conta/geração/hash/recibo, incorporar canônico, reconhecer intenções e reconstruir projeção na transação. Ack não avança cursor; página de pull avança junto aos dados.
4. **Snapshot:** staging por página com cursor atômico; no swap reler o conjunto vigente de intenções e comprovar classificação no corte H na mesma transação. Se uma intenção nova não estiver classificada, obter a prova faltante ou repetir o preparo; não trocar uma base parcial.
5. **Leitura:** publicar um snapshot de apresentação consistente somente se conta/geração ainda forem válidas. Logout/troca invalida também a apresentação secundária, não só botões de escrita.

## 4. Fronteira de decisão desta rodada

As três perguntas abaixo são raízes independentes. Detalhes que dependem das respostas ficam para a rodada seguinte. Recomendações não são contratos aprovados.

| Pergunta | A — recomendada | B — alternativa | Efeito prático |
|---|---|---|---|
| Q67 — Origem pública | Um mesmo endereço HTTPS serve frontend estático e encaminha caminhos da API ao Java | Frontend e API em origens públicas distintas, com CORS/credenciais explicitamente configurados | A simplifica entrega e política de cookies; continua exigindo CSRF. Não escolhe domínio/fornecedor nem autoriza publicação |
| Q68 — Credenciais web | Credenciais de sessão em cookies HttpOnly/Secure, sem access/refresh/revoke legíveis pelo JS; fronteira web no Java | Access token somente em memória JS, refresh protegido em cookie; sem persistir bearer em armazenamento web | A reduz exposição direta de segredos ao JS, ao custo de mais contrato no backend. Ambas precisam tratar CSRF, XSS, instalação nova e respostas tardias. Não escolhe ainda nomes, TTLs ou tabelas |
| Q69 — Fronteira do banco | Controle e dados de domínio no mesmo banco IndexedDB por instalação, particionados/filtrados por conta; aparência em banco separado | Bancos de domínio separados por conta e controle separado, exigindo outro protocolo de coordenação | A permite verificar o proprietário dentro da mesma transação do comando. Falha estrutural dessa base pode afetar todas as contas locais; erro recuperável restrito a uma conta deve bloquear só seu escopo. B aproxima o isolamento físico nativo, mas não herda uma transação entre bases |

Q69=A não torna contas intercambiáveis: abertura de dados exige sessão local válida daquela conta; cada método requer accountId e geração; testar A/B continua obrigatório. Não equivale a criptografia/cofre contra JavaScript da mesma origem, extensão ou acesso ao perfil do navegador. Não autoriza reset da base por corrupção.

## 5. Ramos ainda dependentes

- **Sessão e origem → identidade de instalação e novo contêiner:** cookie copiado sem IndexedDB não deve liberar a família original por acidente. Comparar nova autenticação explícita com transferência autenticada própria; não inferir prova de instalação de um UUID público.
- **Credenciais → estado remoto:** fechar login/refresh com resposta perdida, confirmação/repetição permitida, logout offline e revogação de A enquanto B está ativa. Não usar cookie atual de B para presumir revogação de A.
- **Credenciais+abas → HTTP tardio:** resposta antiga pode aplicar Set-Cookie antes do JS. Ignorar o corpo por geração ou abortar fetch não resolve isso por si; contrato de cookies/identidade/recibos precisa impedir restauração ou substituição da sessão errada.
- **Banco+abas → migração/atualização:** separar posse de escrita de geração de autenticação; cercar comandos, envios, respostas, abertura, migração e preferências. Tratar conexões antigas/versionchange/blocked e schema mais novo sem apagar a fila.
- **Atualização → interface:** definir recarga/ativação quando houver formulário ainda não salvo, build antigo e operações já persistidas. Não forçar skipWaiting/reload para contornar esses estados.
- **Origem+sessão → reset:** rota HTTPS confiável, fragmento removido do histórico e token transitório, sem logs/cache/telemetria; confirmação perdida não cria sessão nem apaga fila. Preservar o comportamento já aprovado de links1h.
- **Contratos+HTTPS → prova física:** validar Safari e Tela de Início separadamente no iOS26.6.2 informado. Feature detection permanece obrigatória; ausência de IndexedDB/Web Locks bloqueia o escopo, sem fallback permissivo.

Depois das respostas, especificar nomes/campos/erros/transportes exatos, ADR se houver trade-off consolidado e fixtures executáveis. Novos dados de servidor exigem spec/00+Flyway; nenhum endpoint/cookie/tabela foi criado neste diagnóstico. Task03 continua bloqueada; task02 não está concluída.

## 6. Mapeamento inicial de aceite

Mapeamento de adaptação, **sem aceites aprovados por esta tabela**. Fonte: spec/13 §9 e spec/14 §6.

| M1 | Variante web e cenário WEB |
|---|---|
| 01 | Login/onboarding/primeiro hábito pulável via fronteira web; WEB-01/02/10 |
| 02 | Commit local, reinício e offline em Safari e Tela de Início independentes; WEB-01/03/04 |
| 03 | PWA e Android marcam o mesmo dia, uma concessão; WEB-03/07 |
| 04 | Desfazer contra marcação desconhecida preserva regra ADR-017; WEB-03 |
| 05 | Remarcar observa desfazer, restaura concessão original; WEB-03 |
| 06 | Dois desfazeres, remarcação incompleta não conclui; WEB-03 |
| 07 | Commit remoto com resposta perdida conserva mesma operação; WEB-03/06 |
| 08 | Ack antes de pull não pula cursor; WEB-03 |
| 09 | Página+cursor em transação IDB, inclusive retorno de aba suspensa; WEB-04/06 |
| 10 | Logout offline/A→B→A, cookies e conteúdo secundário isolados; WEB-05/06/07 |
| 11 | Rejeição/401 sem perda; distinguir CSRF, sessão e indisponibilidade; WEB-04/05/10 |
| 12 | Dia lógico/IANA sem usar UTC como dayKey; WEB-03/09 |
| 13 | Cursor antigo/migração falha preservam fila/tombstones; WEB-04/08 |
| 14 | Rollback servidor mantém cumprimento+XP obrigatórios; WEB-03 |
| 15 | A não referencia/revela B por domínio, sessão, fila ou snapshot; WEB-05/07/10 |
| 16 | Hash/identidade imutáveis após restart/upgrade; WEB-03/04/08 |
| 17 | Desfazer/refazer não devolve nem duplica orçamento; WEB-03 |
| 18 | Snapshot classifica conjunto vigente no corte H antes do swap; WEB-03/04/08 |
| 19 | Correção de criação rejeitada e cadeia, sem confundir identidade incerta; WEB-03/04 |
| 20 | Decisão original sem prêmio permanece após undo/remark; WEB-03 |

WEB-09 adiciona requisitos visuais/VoiceOver/teclado/desempenho que não ficam cobertos apenas pelos cenários de domínio. WEB-10 depende também dos gates operacionais existentes.

## 7. Fontes oficiais e limites

Cookies na criação do contêiner, sem copiar IndexedDB: [WebKit17.2](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/#web-apps). Web Locks steal não interrompe o código antigo: [W3C](https://www.w3.org/TR/web-locks/#api-lock-manager). Ciclo SW e remoção de precache na ativação: [web.dev](https://web.dev/articles/service-worker-lifecycle), [Workbox](https://developer.chrome.com/docs/workbox/modules/workbox-precaching/).

Persistência é concessão, não reserva de quota nem proteção contra limpeza manual: [WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/), [Storage Standard](https://storage.spec.whatwg.org/#persistence-permission). WebKit documenta IndexedDB e Web Locks desabilitados no Lockdown Mode: [Safari17.0](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/#lockdown-mode); não presumir disponibilidade só pelo número da versão.

Proteção de sessão/CSRF: [OWASP sessão](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [Spring Security7.1.1](https://github.com/spring-projects/spring-security/blob/7.1.1/docs/modules/ROOT/pages/servlet/exploits/csrf.adoc). O guia SPA exige renovar o token CSRF após autenticação/logout; credencial HttpOnly e token CSRF são objetos diferentes. Consultado via Context7; não é implementação/configuração aprovada por esta consulta.

HTTPS confiável acessível ao telefone é o requisito de contexto seguro; possuir/comprar um domínio específico não é requisito da API. HTTP no IP LAN do PC não herda a exceção de loopback do próprio iPhone. [W3C Secure Contexts](https://www.w3.org/TR/secure-contexts/#is-origin-trustworthy). Nenhum navegador/serviço foi iniciado na apuração documental.

## 8. Verificação desta preparação

Seis documentos conferidos em UTF-8 e47 links locais válidos; matriz M1-01–20 completa, sem linhas repetidas. App/API/web/contratos de execução permanecem iguais a `b8c8e46`; não houve build ou ensaio físico novo. Typecheck/lint do app e web aprovados; app213 testes de domínio+51 componentes e web2 testes aprovados. API `check --no-daemon` aprovado com Java21:13 testes operacionais executados e tarefa Java `test` UP-TO-DATE. Essa regressão não é evidência de que as propostas novas estejam implementadas/testadas.

Q67–Q69 foram apresentadas a Pedro e permanecem sem resposta nesta preparação. A conclusão verificável é o diagnóstico/documentação da rodada, não o encerramento da tarefa02 nem a liberação da tarefa03.
