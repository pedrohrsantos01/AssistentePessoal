# Recorte10 — coordenação e commits web

Estado: concluído no escopo local02b. Check completo e ensaio final visível aprovados. Origem: [tarefa10](../../.scratch/pwa-m1/issues/10-provar-coordenacao-e-commits-web.md), [spec/14](../../specs/14-pwa-primeiro-marco.md), [modelo](../../specs/00-modelo-de-dados.md) e [contrato02a](../../contracts/pwa-m1/README.md). Complementa a [prova09](2026-10-22-prova-sessao-web.md). Q61–Q75 permanecem aprovadas; não há decisão de produto nova neste incremento.

## Implementação delimitada

Adapters assíncronos em `web/src/local`: schemaV1 principal com nove stores, schema visualV1 separado, validação dos dez tipos e integridade entre chave/payload. Nenhuma fixture da prova01 é migrada. A entrada `coordination.html` e seu bridge são técnicos e separados da entrada React; não habilitam contas reais ou a jornada03.

Presença por documento, CAS do dono/época e gate `ritmo:web:commit:v1` substituem o candidato antigo com steal. A época usa decimal/BigInt até o máximo int64. Gate é adquirido antes do IndexedDB e liberado após commit/abort real. Uma aba congelada dentro dele deve ser aguardada, sem timeout de posse. Leituras e escritas filtram conta; callback antigo não confirma ack, pull ou seleção de sessão.

Conta/geração/posse e entradas são capturadas por valor antes de aguardar: reusar um objeto mutável no chamador não pode redirecionar uma resposta antiga para outra jornada. Comando, sequência, envelope/dependências e projeção confirmam juntos. `beginAttempt` é durável antes do fetch. Crash não inventa outra operação. Hash e recibo precisam corresponder antes de reconhecer resultado; identidade incerta mantém bloqueio. Correção explícita preserva envelopes antigos e remapeia as dependências. Projeção/XP provisório, hash/JCS, dia lógico/IANA e backoff são importados das funções puras existentes; o teste compara comportamento com SQLite.

Snapshot mantém staging separado. O swap revalida, dentro da transação, o conjunto atual de identidades classificadas em H; uma intenção nova durante o trabalho de rede exige outra consulta de recibos antes do swap. Ack não avança cursor; pull grava fatos e cursor juntos. Claims/envios e resultados remotos precisam da guarda atual, além da barreira transacional do Java comprovada em09.

Cada build possui seu registro de compatibilidade. Um build novo não libera o antigo. `versionchange` fecha o handle sem esperar gate; `blocked` aguarda a conexão antiga. Abertura desconhecida/ilegível preserva os arquivos. O teste mostrou que confiar só no erro de downgrade do Dexie era insuficiente: o adapter confere a versão física real em todo `ready`, inclusive reabertura.

Aparência não participa do commit principal. Após interrupção, relê a escolha efetivamente salva; leitura ilegível usa Holograma+sistema e pausa seletores. Falha visual não bloqueia hábitos. Rascunhos ficam apenas no documento e são invalidados com mudança de jornada/conta/posse ou perda de apresentação, conforme Q72.

Campos opcionais de resposta são tolerados e retirados antes de persistir os registrosV1; efeito obrigatório desconhecido preserva cursor/fila/leitura e exige atualização do build. Projeção local malformada bloqueia a escrita, preservando o registro em vez de substituí-lo silenciosamente.

O schema local corrigiu `Mutation.result` e evidências de identidade para aceitar recibos de rejeição já previstos no protocolo nativo. Não há campo novo, rota nova, mudança de política de XP ou nova migration PostgreSQL. O servidor continua emV6.

## Verificação

- App nativo: typecheck/lint,213 testes de domínio e51 de componentes aprovados.
- Web:20 testes aprovados, incluindo quota/abort injetados, CAS, isolamento A→B→A, paridade SQLite, snapshots e recuperação. Typecheck/lint aprovados. Ensaio final visível aprovado após a última alteração do adapter.
- Contrato:17 rotas,65 schemas de transporte,10 registros locais,50 exemplos e61 cenários do oráculo validados. O oráculo não substitui testes dos adapters.
- API: check completo aprovado em10m55s:112 casos Java,102 aprovados e10 opt-in ignorados (8 Android e2 navegadores exercitados separadamente);13 testes operacionais aprovados. As três fixtures de hábito que fixavam22/10 foram ajustadas ao relógio UTC/início do dia4 do próprio ensaio, sem mudar asserções ou produção.
- Navegador: a rodada local passou no Chrome155.0.8059.85 visível, incluindo crash de renderer, reabertura completa offline sem novas requisições ao servidor e atualização em espera. A rodada incluiu o observador da aba secundária e a mutação de dados antes de abortar a migração; ambas passaram. A repetição final após as capturas imutáveis também passou, em35s, com recursos encerrados.

Tentativas anteriores expuseram a necessidade de aguardar o ciclo de ativação real do worker e uma chamada de fetch com receptor incorreto. O teste de regressão da porta de rede passou; a prova original passou integralmente após o ajuste. A aprovação offline usa reabertura efetiva sem rede e comparação da fila, sem inferir o resultado só de metadados do worker. Nenhuma tentativa incompleta é contada como aceite.

## Reprodução e evidência

[Comando finito](../../web/README.md#coordenação-e-commits--recorte10). Driver `web/scripts/verify-coordination.mjs`, fixture `WebSessionTests.visibleBrowserProvesIndexedDbOwnershipAndCommits`; logs/capturas sintéticos em `output/playwright/web-coordination/`. Proxy, navegador, API, containers e certificados próprios são encerrados pelos respectivos `finally`; processos preexistentes são preservados. Auditoria final não encontrou Chrome/proxy/API/containers próprios em execução. Não há serviço persistente, emulador, deploy ou contratação. O resumo do check completo fica em `output/playwright/web-coordination/api-check-summary.json`; o log é `api/build/web-coordination-verified-check.log`, separado dos ensaios visíveis.

Capturas da rodada final:

- [Resposta antiga e proprietário suspenso](../../output/playwright/web-coordination/01-frozen-owner-late-ack.png).
- [Gate ocupado aguardando liberação](../../output/playwright/web-coordination/02-gate-waits-no-steal.png).
- [Intenção salva offline](../../output/playwright/web-coordination/03-local-offline-intention.png).
- [Navegador reaberto offline](../../output/playwright/web-coordination/04-browser-reopened-offline.png).
- [Atualização em espera](../../output/playwright/web-coordination/05-update-waiting-old-build.png).
- [Migração abortada preservando fila e sequência](../../output/playwright/web-coordination/06-upgrade-abort-preserved-queue.png).

## Limites e próximo gate

Safari/Tela de Início no iPhone16e e HTTPS público continuam sem aceite. Eviction, VoiceOver, teclado/viewport e desempenho físico permanecem em02c/tarefas02,06 e07. O build técnico não é a jornada funcional03 e não conclui WEB-01–10, M1 ou Fase1. O próximo gate é preparar/executar o ambiente HTTPS de ensaio e o roteiro físico, conforme domínio/infra já documentados.

Referências de implementação: [Dexie: transações](https://dexie.org/docs/Dexie/Dexie.transaction()), [Dexie: blocked/versionchange](https://dexie.org/docs/Dexie/Dexie.on.blocked), [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) e [Workbox: precache e ativação](https://developer.chrome.com/docs/workbox/modules/workbox-precaching). Essas fontes orientam os adapters; a evidência de execução permanece delimitada acima.
