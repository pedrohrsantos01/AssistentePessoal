# spec/14 — PWA adicional do primeiro marco

Data: 22/10/2026. Estado: **escopo/stack e Q67–Q75 aprovados;02a especificado, servidor/V6 e prova de cookies09 locais implementados; IndexedDB/coordenação, produto e Safari pendentes**. Origem: pedido de Pedro para planejar uso no iPhone sem distribuição nativa. Complementa PRD v3.1 e spec/13; não substitui os contratos nativos. [Plano](../docs/analises/2026-10-21-plano-pwa-m1.md); [tarefas](../.scratch/pwa-m1/spec.md).

**Revisão técnica posterior, 21/10/2026:** Pedro descartou Expo Web para a PWA e solicitou alternativas. O frontend web será planejado sem essa dependência; o Expo do aplicativo nativo permanece. Após a comparação, Pedro escolheu React DOM/TypeScript/Vite/React Router + IndexedDB/Dexie + Workbox. [ADR-020](../docs/adr/0020-pwa-com-frontend-web-proprio.md). A classificação alpha da pesquisa original se referia a expo-sqlite web, não ao Expo Web inteiro. [Comparação atual](../docs/analises/2026-10-21-alternativas-pwa-sem-expo.md).

## 1. Definições aprovadas

| Decisão | Resultado |
|---|---|
| Pedido inicial | Versão web adicional; preservar React Native. Nesta etapa, planejar |
| Q61 | M1 funcional: conta, onboarding, Briefing, hábitos, XP básico e sincronização; visual Ritmo-App. Tarefas, Agenda e voz depois |
| Q62 | Safari e Tela de Início no iPhone 16e |
| Q63 | Confirmar alterações após persistência local; informar pendências e sincronizar ao abrir/retomar. Aceitar que o navegador pode remover dados e que intenções nunca sincronizadas podem ficar irrecuperáveis. Pedir persistência não é garantia absoluta |
| Q64 | Uma aba com controle de escrita por instalação web; demais abas informam o estado e oferecem retomada segura |
| Q65 | Aceitar o M1 funcional com PWA no iPhone + app Android. Instalação/links nativos iOS ficam para entrega posterior, preservando React Native |
| Q67 | Frontend estático e API Java na mesma origem pública HTTPS; nome/domínio ainda pendente |
| Q68 | Credenciais web em cookies HttpOnly/Secure, sem access/refresh/revogação legíveis pelo JS; nativo bearer preservado |
| Q69 | Um IndexedDB por instalação com controle+domínio particionados por conta; aparência em banco separado. Falha estrutural pode bloquear todas as contas locais, preservando dados |
| Q70 | Instalação nova requer login online explícito e sessão própria; não restaurar a família copiada pelo Safari. Controle ilegível continua bloqueado/preservado |
| Q71 | Sessão web opaca controlada no Java/PostgreSQL; cookie protegido e somente metadados públicos no JS. Nativo preservado |
| Q72 | Rascunho só na aba da mesma jornada/conta; adiar recarga durante edição e confirmar descarte deliberado. Sem garantia após encerramento pelo navegador |
| Q73 | Sessão remota web: 30 dias de inatividade autenticada, renovados pelo uso válido, até90dias desde o login. Vencimento pede login para sincronizar; sessão local não encerrada preserva leitura/escrita e pendências |
| Q74 | Quatro contextos locais de autenticação por instalação, incluindo ativo/preparações/encerramentos pendentes. Nova entrada aguarda recuperação, sem descartar intenções ou bloquear uso local ainda ativo |

Abrir a URL no Safari dispensa instalar um binário. Adicionar à Tela de Início é opcional para o uso no Safari e necessário para testar a segunda forma de abertura de Q62. Não presumir compartilhamento de armazenamento, sessão ou pendências entre esses acessos. [Fatos de plataforma e fontes](../docs/analises/2026-10-21-viabilidade-pwa.md).

## 2. Fronteira funcional

Alvo: cadastro/login, onboarding retomável de fuso/início do dia, primeiro hábito pulável, Briefing/XP básico, criar/editar/ordenar/excluir hábito binário diário, marcar/desfazer/remarcar, estados de sync e recuperação existentes. Inclui recuperação de senha por página HTTPS, sessão/logout e preferências Q56–Q58, com adaptações do navegador documentadas antes de implementar.

Usar a mesma conta, fatos e API de domínio. Não criar base remota paralela ou calcular XP definitivo no browser. Login, reautenticação e preparação inicial exigem rede; uso offline depende de carregamento/cache e armazenamento local anteriores bem-sucedidos. Não prometer primeira abertura sem rede.

Níveis/ofensivas/proteções/conquistas completos, notificações, push, som, Agenda, tarefas, assistente e outros módulos não integram o primeiro marco web. Desktop é ambiente auxiliar de verificação; um produto desktop não foi incluído. Não solicitar permissões futuras.

## 3. Garantias compartilhadas

- Comando, identidade imutável, sequência e projeção confirmam atomicamente no armazenamento local antes do sucesso visual. Falha de gravação não produz cumprimento/XP salvo.
- Preservar ADR-017, orçamento de XP, dia lógico/IANA, exclusão Q30/Q31, recibos, cursor, staging de snapshot e isolamento por conta. Reinício/retry não gera outra identidade para esconder resultado desconhecido.
- Domínio continua fora do Zustand; componentes não chamam HTTP. Preferências têm armazenamento lógico separado e falha conforme Q58.
- Logout fecha acesso local, interrompe envio e preserva pendências isoladas. Reentrada na conta de origem exige autenticação online; respostas antigas não atravessam geração ou conta.
- Atualização incompatível preserva a leitura local prevista; não remove banco, fila ou bloqueio de identidade para forçar atualização.

Garantias locais valem enquanto os dados existirem. Q63 explicita a durabilidade web; não autoriza o aplicativo a limpar intenções. O servidor só recompõe fatos recebidos. Ao faltar a base, não atribuir automaticamente a causa a eviction nem afirmar ausência de pendências anteriores sem evidência.

## 4. Concorrência da instalação web

Q64 limita a uma aba proprietária a escrita, envio de operações e mudanças de sessão. Um takeover encerra ou invalida o proprietário anterior antes de novos commits; testar suspensão, crash e retorno de aba antiga. Avisar o usuário sem expor dados de outra conta indevidamente.

O mecanismo de exclusão, leitura secundária e transferência está especificado no [contrato02a](../contracts/pwa-m1/README.md); ainda exige prova dos adapters. Se a exclusão não for comprovada, não habilitar segundo escritor. Contador em memória ou prazo expirado, isoladamente, não provam que a aba antiga perdeu acesso ao banco.

Instalações separadas (Safari, Tela de Início, Android) têm identidades próprias, podem editar offline e convergem pelo servidor. Q64 não cria lock distribuído entre aparelhos/contêineres.

## 5. Contratos pendentes antes da implementação funcional

| Tema | Definição/prova necessária |
|---|---|
| Armazenamento | Banco de navegador, biblioteca, transações, migrações e falhas nas versões a fixar e Safari real. IndexedDB/Dexie e a fronteira Q69 estão aprovados; representação/índices no spec/00 e schemas de02a; faltam adapter/migrations e provas, sem adapter síncrono de Drizzle. O experimento expo-sqlite web anterior não está liberado |
| Sessão web | Q68 aprovou cookies protegidos; Q71 sessão opaca; Q73 validade30dias de inatividade/90dias absolutos; Q74 quatro contextos. Contrato02a define aplicação de prazos, cookies/instalação/conta, CSRF, reset e recuperação; faltam adapter Java/migrations e provas reais |
| Cookie copiado ao instalar | Tela de Início pode receber cookies sem a base local. Reconhecer instalação nova e impedir reutilização acidental da mesma família de refresh/identidade |
| Perda de resposta | Login/renovação/revogação aceitos remotamente com resposta perdida; preservar proteção contra replay ambíguo |
| Abas | Propriedade/fencing, sessão, retomada, leitura secundária, migrações e código antigo |
| Cache/atualização | App shell/fontes offline, retenção de assets, compatibilidade código/banco/protocolo; nenhuma ativação descarta pendências |
| Origem | HTTPS estável na mesma origem (Q67), roteamento/cache/headers e recuperação por link. Host/remetente ainda não escolhidos |
| Aceite | Matriz/medição no iPhone 16e, versão exata iOS/Safari, VoiceOver e desempenho web; trace Android não prova Safari |

Stack aprovada na opção1: React DOM + TypeScript + Vite + React Router, IndexedDB/Dexie e Workbox, sem Expo Web. Versões fixadas na prova01 não comprovam funcionamento no Safari. Q67/Q68 aprovam mesma origem e cookies HttpOnly/Secure na fronteira Java; [ADR-021](../docs/adr/0021-fronteira-de-sessao-e-armazenamento-web.md). Q70–Q74 estão no [ADR-022](../docs/adr/0022-sessao-opaca-e-entrada-por-instalacao-web.md): sessão opaca, entrada por instalação, rascunho, validade e quatro contextos definidos. Q75 confirmou o entendimento e02a concretizou o [contrato executável](../contracts/pwa-m1/README.md); servidor/V6 e cookies têm prova local no recorte09; faltam IndexedDB/coordenação e os gates físicos antes de liberar produto. Não criar endpoints, cookies, TTLs auxiliares, campos ou migrations por inferência. Não substituir SecureStore por localStorage.

## 6. Aceite da variante web

| ID local | Evidência exigida |
|---|---|
| WEB-01 | Safari e Tela de Início abrem a jornada, com identificadores próprios; abertura inicial sem rede tem estado compreensível |
| WEB-02 | Login/onboarding interrompido e primeiro hábito pulável retomam corretamente |
| WEB-03 | Criar/marcar offline, encerrar/reabrir e desfazer/remarcar preservam intenção/XP provisório; reconectar converge com cliente independente/Android sem duplicação |
| WEB-04 | Falha/quota não confirma sucesso; abertura/migração falha preserva dados e bloqueia escopo necessário |
| WEB-05 | Logout offline e A→B→A isolam dados/cookies/envio; reautenticação/reset preservam fila |
| WEB-06 | Segunda aba, takeover, crash/suspensão e respostas tardias não geram escritores ou refresh concorrentes nem aplicação na conta errada |
| WEB-07 | Instalação a partir de Safari autenticado não clona família utilizável indevidamente; contêineres convergem com identidades distintas |
| WEB-08 | Atualização com fila, código antigo e migração interrompida preserva recuperação e compatibilidade |
| WEB-09 | Ritmo-App, três aparências, claro/escuro/sistema, teclado/viewport e VoiceOver nos dois acessos. Desempenho tem origem, cenário e amostras completas |
| WEB-10 | HTTPS, domínio/remetente/reset, sessão/CSRF e isolamento A/B validados; gates operacionais existentes cumpridos antes de dados reais |

WEB-01–10 são cenários locais, não novos ReqIDs. Mapear M1-01–20 de spec/13 à PWA, explicitando adaptações aprovadas. Build/Lighthouse/WebKit desktop não aceitam iPhone isoladamente. A prova web terá registro próprio e alimentará o aceite conjunto M1 com Android (Q65). O build nativo iOS continua sem aceite e terá entrega posterior. M1 permanece aberto até todas as provas/gates; Fase1 completa não é encerrada por este recorte.

## 7. Evidência delimitada — 21/10/2026

A [prova01](../docs/analises/2026-10-21-prova-tecnica-pwa.md) confirmou build React/Vite, transação Dexie, reabertura offline e candidato Web Locks+geração no Chrome visível. Migração V1→V2 foi exercitada em fake-indexeddb. O ensaio isolado não define schema/sessão web de produto, não valida Safari físico e não aceita WEB-01–10 integralmente. Próximo recorte: contratos02 e roteiro iPhone do relatório.

## 8. Contratos em entrevista — 21/10/2026

Pedro informou na Q66 que seu iPhone16e usa **iOS26.6.2**. É dado declarado para a matriz de testes, não ensaio de Safari/Tela de Início ou versão do WebKit inferida. A [proposta da rodada1](../docs/analises/2026-10-21-contratos-pwa-rodada-1.md) e a [entrevista](../.scratch/pwa-m1/entrevista.md) distinguem garantias já aprovadas, fatos de código e Q67–Q69 aprovadas em A. O [ADR-021](../docs/adr/0021-fronteira-de-sessao-e-armazenamento-web.md) registra essas fronteiras; a [rodada2](../docs/analises/2026-10-21-contratos-pwa-rodada-2.md) recebeu A em Q70–Q72, registradas no [ADR-022](../docs/adr/0022-sessao-opaca-e-entrada-por-instalacao-web.md). Layout físico detalhado e protocolo de sessão não estão aprovados por inferência. Task02 permanece needs-info e task03 bloqueada.

Rascunhos Q72 não são intenções confirmadas: não salvar automaticamente durante migração ou após trocar de conta. Logout deve invalidar acesso/conteúdo em todas as abas; a revogação remota dos cookies pode permanecer pendente sem rede. Essa distinção não reabre acesso local nem autoriza descartar dados.

Q73/Q74 também receberam A: prazos30/90dias e limite de quatro contextos. A [rodada3](../docs/analises/2026-10-21-contratos-pwa-rodada-3.md) consolida decisões e o desenho proposto de reserva antes da senha, posse por época e commits assíncronos. Cookies órfãos/limpeza, recuperação sem quinta sessão, schema e provas continuam explícitos como trabalho técnico pendente. Os recortes internos02a–02c não aceitam WEB-01–10 nem liberam task03 automaticamente.

## 9. Especificação02a — 22/10/2026

Q75=A confirmou o entendimento e autorizou iniciar02a. [Contrato](../contracts/pwa-m1/README.md), representação do spec/00 e [relatório](../docs/analises/2026-10-22-contrato-executavel-pwa.md) concluídos no escopo de especificação.17 rotas propostas,65 schemas de transporte,10 registros locais;50 exemplos e61 cenários do oráculo validados. Isso não executa HTTP/cookie jar, SQL/RLS ou IndexedDB.

[08/02a](../.scratch/pwa-m1/issues/08-especificar-contrato-executavel.md) concluído; [09](../.scratch/pwa-m1/issues/09-provar-sessao-web-e-cookies.md) implementa servidor/V6 e prova local de sessão/cookies/autorização transacional, concluída no escopo local, com regressão completa aprovada. [10](../.scratch/pwa-m1/issues/10-provar-coordenacao-e-commits-web.md) está ready-for-agent para coordenação/commits/upgrade integrados após a conclusão09.02c conserva HTTPS e Safari/Tela de Início físicos. Task02 permanece needs-info e task03 bloqueada até contratos/provas/gates, sem nova pergunta de aprovação para iniciar a próxima prova autorizada.

22/10/2026 — [Relatório09](../docs/analises/2026-10-22-prova-sessao-web.md):17 rotas/V6 e prova HTTPS local com Chrome concluídas;16 casos web passaram na rodada visível. Check completo aprovado:111 casos Java (102 passaram/9 opt-in),13 operacionais; app264 e web2/typecheck/lint. Cookies não autorizam fora do estado/prazo do servidor, inclusive com Expires ajustado pelo browser. Native bearer preservado; ordem de locks unificada evita inversão com onboarding. Recorte10 liberado; isso não entrega IndexedDB/jornada ou aceita Safari/Tela de Início/M1.
