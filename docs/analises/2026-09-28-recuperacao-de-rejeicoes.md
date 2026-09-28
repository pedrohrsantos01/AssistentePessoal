# Recuperação de rejeições — evidências de 28/09/2026

## Resultado

Incremento da [tarefa 05](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md), autorizado por Pedro: núcleo de REQ-SYN-017 e cenário M1-19. O repositório agora expõe rejeições e cadeias recuperáveis, correção transacional com novas identidades e descarte explícito por item. A API identifica ciclos no lote e informa dependências rejeitadas. M1 completo e tarefa 05 permanecem abertos.

Não houve mudança de schema, migration, dependência de biblioteca ou protocolo HTTP. `supersedesOperationId`, códigos de erro e estados físicos já pertenciam ao contrato. O JSON `error` local recebeu uma representação documentada de resolução; esse metadado não é transmitido à API.

## Comportamento entregue

1. **Preservar e explicar:** `Session.account().recovery()` retorna operação original, erro, dependências, origem (`server` ou `local`) e resolução. Uma rejeição bloqueia filhas transitivamente, retira seus efeitos da projeção aplicada e mantém todo o conteúdo após reinício. O envio reavalia a fila entre lotes, impedindo que uma seleção antiga envie filhas recém-bloqueadas.
2. **Corrigir:** `correct()` recebe os IDs selecionados e novos IDs UUID v7. Comando e instante são preservados por padrão; alterações explícitas conservam o tipo de comando e passam pela validação normal do servidor. Envelopes antigos não mudam. Novas sequências, envelopes, vínculos e projeções confirmam na mesma transação SQLite ou nada confirma.
3. **Reconstruir referências:** dependências e desfazeres observados apontam para operações substitutas; filhas acompanham o novo hábito quando a criação é corrigida com outro `habitId`. Funciona também quando a filha é corrigida depois de reiniciar. Um novo desfazer local explicitamente observado torna-se dependência. Proposta de correção que cria ciclo é recusada sem alterar os originais.
4. **Descartar explicitamente:** `discard()` resolve somente os itens escolhidos. Descartar o pai não descarta filhas. Originais e motivos ficam no histórico local, inclusive para seleção explícita de recuperação posterior; a interface distingue itens ainda abertos daqueles resolvidos. Repetição de recibo não reabre uma resolução.
5. **Limitar sem perder contexto:** mais de 4096 referências em dependências/contexto mantém o envelope completo como `blocked_local/context_limit_reached`, fora do envio e da projeção. Corrigir não autoriza remover referências de desfazer para contornar o limite. Capacidade excedente exige tratamento técnico explícito ou descarte escolhido.
6. **Resolver dependências na API:** operações ainda sem recibo são ordenadas pelas dependências disponíveis no lote, com respostas na ordem de entrada. Ciclos, incluindo sobrepostos, recebem `dependency_cycle`; filhas de rejeição recebem `dependency_rejected` com IDs. Dependência ausente fora do lote continua `deferred`. Recibos existentes não são redefinidos por um replay com envelope alterado.
7. **Preservar isolamento e incerteza:** referências antigas de conta falham após logout; B não lista/corrige/descarta os dados de A. Operações pending, em retry ou com resultado incerto não entram como rejeições corrigíveis. `id_content_conflict` exige esclarecer o resultado original; essa interface não presume que o ID anterior nunca foi aceito.

Contrato físico e detalhes de uso: [spec/00 §12.3](../../specs/00-modelo-de-dados.md), [spec/13 §6/12](../../specs/13-contrato-primeiro-marco.md) e [README do app](../../app/README.md).

## Validação executada

| Verificação | Resultado |
|---|---|
| `pnpm typecheck`, em `app/` | Aprovado |
| `pnpm lint`, em `app/` | Aprovado |
| `pnpm test`, em `app/` | 44 testes, zero falhas; dez casos novos de recuperação |
| `api/gradlew.bat -p api check bootJar --no-daemon` | Aprovado; 28 testes Java, incluindo modularidade |
| Cenários TypeScript iniciados pelo Gradle | Cinco aprovados: sync, sessão, senha, scheduler e rejeições |

O novo [teste integrado](../../app/test/integration/rejections.test.ts) usa sessão/HTTP/Postgres/SQLite reais: cria um hábito, recebe rejeição ao criar outro de mesmo título e marcar seu dia, reinicia, corrige a cadeia, reinicia novamente e sincroniza. Um segundo repositório converge com um cumprimento e 10 XP. Reenviar a operação antiga mantém a rejeição original e não reabre a recuperação já resolvida.

Os [dez testes locais](../../app/test/rejections.test.ts) observam o repositório público e a sessão com SQLite real. Relógio, cofre e transporte são fronteiras externas controladas. Os testes HTTP de [RuntimeTests](../../api/src/test/java/dev/ritmo/RuntimeTests.java) exercitam ciclo simples, ciclos sobrepostos, dependência válida fora de ordem e replay alterado sem redefinir o grafo. Testes que falharam antes da correção comprovaram as lacunas de bloqueio entre lotes, remapeamento e preservação de contexto.

Evidência local, ignorada pelo Git: `.scratch/runtime/rejections-api-final.log`, `api/build/mobile-rejections.log` e XML/HTML em `api/build/test-results/test/` e `api/build/reports/tests/test/`. A execução usou Java 21, Docker com PostgreSQL descartável e dados fictícios; sem conexão à VPS nem envio externo de e-mail.

## Limitações e próximo recorte

- A UI de aviso, seleção, correção e descarte depende do protótipo. A entrega atual é o núcleo executável; não conclui acessibilidade ou aceite visual de REQ-SYN-017.
- Não houve novo APK nem validação HTTP em Android/iPhone. Os testes integrados de desktop não substituem o aceite nos aparelhos.
- A API não persiste um grafo de operações adiadas entre requisições. Detecta ciclos presentes no lote; referência desconhecida continua adiada, sujeita ao retry limitado do cliente. A correção local recusa ciclos antes do commit.
- O limite de contexto não foi ampliado nem compactado. Conflitos de identidade com resultado incerto continuam exigindo reconciliação técnica antes de liberar nova intenção. O histórico de resoluções não implementa política de retenção/exclusão de conta.
- Próximo recorte: completar a matriz de snapshots, paginação/interrupção e recuperação de migrations preservando pendências. Permanecem rate limiting, configuração operacional, backup/restore, deploy, HTTP nativo e a UI aprovada.
