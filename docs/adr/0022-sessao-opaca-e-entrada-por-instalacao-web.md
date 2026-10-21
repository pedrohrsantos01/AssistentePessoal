---
status: accepted
date: 2026-10-21
---

# ADR-022 — Sessão opaca e entrada própria por instalação web

Pedro escolheu **A em Q70–Q74**, conforme a [entrevista](../../.scratch/pwa-m1/entrevista.md), as alternativas da [rodada2](../analises/2026-10-21-contratos-pwa-rodada-2.md) e a [consolidação da rodada3](../analises/2026-10-21-contratos-pwa-rodada-3.md). Complementa ADR-021; o cliente nativo permanece com bearer, SQLite e seu ciclo de credenciais atual.

**Q70:** instalação web nova sem controle local exige login online explícito e sessão própria, inclusive na primeira abertura pela Tela de Início após usar o Safari. Cookies copiados não restauram automaticamente a instalação anterior. Só fatos já confirmados pelo servidor podem ser recuperados nesse novo contêiner; intenções ainda locais continuam na instalação de origem. Controle ilegível segue preservação/bloqueio de Q51, sem reset disfarçado de primeira entrada.

**Q71:** a variante web usa sessão opaca controlada no Java/PostgreSQL existente. O navegador mantém credencial HttpOnly/Secure e apenas metadados públicos acessíveis ao JS. Foi preferida à tradução do ciclo access/refresh/revogação nativo para vários cookies de tokens: concentra a coordenação de autorização no backend atual. Não cria runtime de frontend, Redis ou novo backend. A escolha ainda exige protocolo contra resposta tardia, fixação, transições ambíguas e revogação; não aprova um cookie fixo ingênuo nem define schema/endpoints. Os prazos foram definidos posteriormente em Q73.

**Q72:** rascunho não salvo existe somente na aba da mesma jornada/conta. Adiar recarga durante edição e confirmar descarte em saída/atualização deliberada; não prometer recuperação depois de encerramento pelo navegador. Não adicionar persistência de rascunhos neste primeiro recorte. Logout/troca retira conteúdo da sessão anterior, e intenções já salvas mantêm as garantias de preservação existentes.

**Q73:** autorização remota web expira após **30 dias sem comunicação remota autenticada**, renovando essa janela com o uso válido, limitada a **90 dias desde o login**. O servidor aplica ambos os limites; vencimento exige login online para voltar a sincronizar. Uso local de sessão não encerrada conserva leitura, novas alterações e pendências offline. São parâmetros do Ritmo, não prazos prescritos por OWASP; não alteram access15min/refresh30dias nativos nem reset1h.

**Q74:** até **quatro contextos locais de autenticação por instalação**, contando ativo, preparações e encerramentos pendentes. Ao atingir quatro, pausar nova entrada até resolver os anteriores, com explicação e recuperação online. Sessão local ainda ativa continua utilizável e intenções não são descartadas. Esse limite não comprova um máximo físico de cookies: órfãos, cópias, respostas tardias e perda de capacidade de encerramento precisam de protocolo e teste.

Sessão local ativa continua permitindo trabalho offline. Saída local e revogação remota são estados distintos: HttpOnly não pode ser apagado fisicamente pelo JS durante logout sem rede. O bloqueio local deve ser durável antes de confirmar a saída; a revogação remota pode permanecer pendente sem apagar a fila.

Esta ADR registra decisões de fronteira/uso, não implantação ou aceite. A tarefa02 permanece aberta para o protocolo exato, a aplicação dos limites aprovados e as provas. O [desenho candidato](../../.scratch/pwa-m1/contratos-navegador.md) distingue decisões aceitas de hipóteses ainda não implementadas; iOS26.6.2 é a versão declarada para o ensaio físico futuro. Nenhum runtime foi alterado por este registro.
