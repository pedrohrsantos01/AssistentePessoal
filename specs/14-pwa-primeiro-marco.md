# spec/14 — PWA adicional do primeiro marco

Data: 21/10/2026. Estado: **escopo e políticas Q61–Q65 aprovados; desenho técnico e implementação pendentes**. Origem: pedido de Pedro para planejar uso no iPhone sem distribuição nativa. Complementa PRD v3.1 e spec/13; não substitui os contratos nativos. [Plano](../docs/analises/2026-10-21-plano-pwa-m1.md); [tarefas](../.scratch/pwa-m1/spec.md).

**Revisão técnica posterior, 21/10/2026:** Pedro descartou Expo Web para a PWA e solicitou alternativas. O frontend web será planejado sem essa dependência; o Expo do aplicativo nativo permanece. React/Vite, Next.js e SvelteKit são propostas em comparação, sem seleção aprovada. A classificação alpha da pesquisa original se referia a expo-sqlite web, não ao Expo Web inteiro. [Comparação atual](../docs/analises/2026-10-21-alternativas-pwa-sem-expo.md).

## 1. Definições aprovadas

| Decisão | Resultado |
|---|---|
| Pedido inicial | Versão web adicional; preservar React Native. Nesta etapa, planejar |
| Q61 | M1 funcional: conta, onboarding, Briefing, hábitos, XP básico e sincronização; visual Ritmo-App. Tarefas, Agenda e voz depois |
| Q62 | Safari e Tela de Início no iPhone 16e |
| Q63 | Confirmar alterações após persistência local; informar pendências e sincronizar ao abrir/retomar. Aceitar que o navegador pode remover dados e que intenções nunca sincronizadas podem ficar irrecuperáveis. Pedir persistência não é garantia absoluta |
| Q64 | Uma aba com controle de escrita por instalação web; demais abas informam o estado e oferecem retomada segura |
| Q65 | Aceitar o M1 funcional com PWA no iPhone + app Android. Instalação/links nativos iOS ficam para entrega posterior, preservando React Native |

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

O mecanismo de exclusão, leitura das demais abas e transferência ainda precisa de contrato técnico. Se a exclusão não for comprovada, não habilitar segundo escritor. Contador em memória ou prazo expirado, isoladamente, não provam que a aba antiga perdeu acesso ao banco.

Instalações separadas (Safari, Tela de Início, Android) têm identidades próprias, podem editar offline e convergem pelo servidor. Q64 não cria lock distribuído entre aparelhos/contêineres.

## 5. Contratos pendentes antes da implementação funcional

| Tema | Definição/prova necessária |
|---|---|
| Armazenamento | Banco de navegador, biblioteca, transações, migrações e falhas nas versões a fixar e Safari real. IndexedDB/Dexie é a proposta principal em avaliação; não é adapter síncrono de Drizzle. O experimento expo-sqlite web anterior não está liberado |
| Sessão web | Credencial de navegador, instalação/conta, expiração, rotação, CSRF, reset e revogação offline. Session/HttpSync atuais exigem tokens em JS |
| Cookie copiado ao instalar | Tela de Início pode receber cookies sem a base local. Reconhecer instalação nova e impedir reutilização acidental da mesma família de refresh/identidade |
| Perda de resposta | Login/renovação/revogação aceitos remotamente com resposta perdida; preservar proteção contra replay ambíguo |
| Abas | Propriedade/fencing, sessão, retomada, leitura secundária, migrações e código antigo |
| Cache/atualização | App shell/fontes offline, retenção de assets, compatibilidade código/banco/protocolo; nenhuma ativação descarta pendências |
| Origem | HTTPS estável, same-origin/CORS, headers de isolamento se necessários e recuperação por link. Host/remetente ainda não escolhidos |
| Aceite | Matriz/medição no iPhone 16e, versão exata iOS/Safari, VoiceOver e desempenho web; trace Android não prova Safari |

Frontend em seleção: React DOM/Vite, Next.js e SvelteKit, sem Expo Web. A recomendação principal do comparativo é React DOM/Vite com IndexedDB/Dexie; ainda não foi escolhida por Pedro. Sessão por cookies HttpOnly/Secure e fronteira na API, preferindo mesma origem, continuam como proposta técnica independente do frontend. Implica trabalho de backend. Não criar endpoints, cookies, TTLs, campos ou migrations sem consolidar o contrato. Não substituir SecureStore por localStorage.

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
