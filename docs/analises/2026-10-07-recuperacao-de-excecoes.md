# Recuperação de exceções do M1 — diagnóstico e decisões

Data: 07/10/2026. Base examinada: `112bdfc9e3107b8fadbf62907ad88b4140d27632`.
Estado: Q51–Q53 aprovadas na opção A; entendimento do plano consolidado ainda aguarda confirmação. Investigação por leitura; nenhum novo comportamento foi implementado ou reproduzido dinamicamente neste diagnóstico.
Vínculo: [tarefa 05 do M1](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md), [plano consolidado](../../.scratch/recuperacao-excecoes/spec.md).

## Garantias já aprovadas

REQ-SYN-013 manda preservar pendências e dados necessários à recuperação, interromper reconstrução quando a preservação segura não for possível e exigir escolha explícita para descarte. REQ-CTA-004b/c e ADR-016 mantêm uso offline da sessão local ativa, reentrada online após logout e isolamento entre contas. REQ-SYN-017 e M1-16/18 impedem confirmação falsa, reaplicação de intenção e alteração do recibo original.

Refresh com resultado perdido não reativa o token antigo. Logout incompleto conserva o fence e o bloqueio até concluir a limpeza. Essas garantias não foram reabertas.

Fontes: [conta](../../specs/01-conta-e-onboarding.md), [sync](../../specs/06-sincronizacao.md), [contrato §2/6/7/8](../../specs/13-contrato-primeiro-marco.md), [ADR-016](../adr/0016-preservar-pendencias-no-logout.md) e [contrato executável](../../contracts/primeiro-marco/README.md).

## Achados no código atual

| Caso | Comportamento observado por inspeção | Lacuna |
|---|---|---|
| Histórico Drizzle desconhecido ou migration falha | `LocalRecoveryRequired` interrompe abertura; handle é fechado, sem reset | Falhas anteriores ao migrator não têm a mesma classificação; recuperação pública completa permanece pendente |
| Falha na abertura SQLite ou PRAGMAs | Propaga falha; não há reconstrução | Classificar abertura/armazenamento/migration sem presumir corrupção; expor nova tentativa segura |
| SecureStore lança erro de leitura durante restauração | Referência atual permanece; conta não chega a ser aberta | Q52 exige manter uso local permitido da sessão já ativa e saudável |
| Remoção de credencial antiga falha com sessão ativa | Referência antiga permanece; limpeza aborta antes de abrir a conta | Separar limpeza pendente de impedimento de uso local |
| Logout falha ao limpar o cofre | Fence e fechamento precedem limpeza; `logging_out` persiste | Comportamento já aprovado/testado; preservar durante a ampliação |
| Recibo e envelope local têm o mesmo ID, mas conteúdos diferentes | Reconhecimento compara apenas `operationId` | Pode confirmar indevidamente a intenção divergente por pull/snapshot, antes mesmo de seu push |

Fontes verificadas: [guard](../../app/src/core/db/local-migrations.ts), [abertura da conta](../../app/src/core/db/open-expo-store.ts), [abertura da instalação](../../app/src/core/identity/open-expo-session.ts), [sessão](../../app/src/core/identity/session.ts) e [AccountStore](../../app/src/core/db/account-store.ts).

O SecureStore é o cofre do dispositivo, com [adapter próprio](../../app/src/core/identity/secure-vault.ts). O Bitwarden de Q48 é o cofre operacional externo para os servidores; não participa da restauração da sessão do app.

## Identidade: três causas hoje compartilham um código

`id_content_conflict` cobre situações com evidências diferentes:

1. Mesmo `operationId` já processado com outro hash de envelope. A API rejeita a tentativa divergente sem substituir ou persistir outro recibo.
2. Outro `operationId` reutiliza `deviceId/clientSequence`. Também há resposta efêmera; o cliente não recebe a identidade original encontrada.
3. Nova criação reutiliza `habitId` existente ou excluído. Aqui a rejeição da nova operação é persistida, comprovando que essa criação foi recusada.

Fontes: [Sync.process, linhas 77–90](../../api/src/main/java/dev/ritmo/sync/Sync.java) e [Habits.execute, linhas 28–31](../../api/src/main/java/dev/ritmo/habits/Habits.java). A API conserva hash do envelope integral, dispositivo, sequência e resultado; não conserva o envelope integral no recibo. [DDL V1](../../api/src/main/resources/db/migration/V1__m1_foundation.sql), [canonicalização](../../api/src/main/java/dev/ritmo/shared/Json.java).

O [reconhecimento local, linhas 235–241](../../app/src/core/db/account-store.ts) sobrescreve estado/erro/resultado pelo ID. Se o recibo original aceito chegar antes ou depois da rejeição da tentativa divergente, o conteúdo local diferente pode ficar `acknowledged` e desaparecer da recuperação pública. O envelope permanece no SQLite, mas isso não satisfaz a recuperabilidade. Como o sync faz pull/snapshot antes do push, proteger somente o ack do push não resolve.

A consulta de recibos usa IDs de operações ainda enviáveis, sem prova da correspondência do conteúdo, e não inclui conflitos já rejeitados. Fontes: [cliente/cópia de snapshot](../../app/src/core/sync/synchronize.ts), [tipos](../../app/src/core/sync/protocol.ts), [schemas](../../contracts/primeiro-marco/build_contract.py) e [consulta do servidor](../../api/src/main/java/dev/ritmo/sync/Sync.java).

Correção técnica exigida pelos requisitos existentes: comprovar correspondência antes de reconhecer; preservar recibo original, envelope divergente e dependentes; incorporar fatos canônicos sem confirmar conteúdo diferente. Rejeição comprovada por ID de entidade reutilizado deve seguir correção/descarte já aprovados, sem ressuscitar o ID excluído. A prova física e a evolução compatível do protocolo serão concretizadas na tarefa de identidade; este relatório não declara novo endpoint/campo aprovado ou implementado.

`idempotency_key_conflict` é diferente: chave de lote com corpo alterado recebe 409 antes da execução. O cliente normalmente gera uma chave por chamada e conserva-a no retry interno de 401. Preservar fila e diagnóstico; não trocar IDs de operações para esconder o conflito.

## Q51–Q53 — respostas aprovadas em 07/10/2026

| Decisão | Resposta de Pedro | Consequência |
|---|---|---|
| Q51 — Banco ilegível | A — preservar e bloquear; reparo em recorte próprio | Bloquear a base afetada; controle de instalação ilegível bloqueia abertura inteira. Nova tentativa após corrigir a causa/atualizar; sem reset/reconstrução/exportação neste recorte |
| Q52 — Cofre indisponível | A — continuar leitura e escrita locais | Apenas com controle e banco saudáveis e sessão já ativa; preservar referências e pausar acesso remoto até recuperar o cofre |
| Q53 — Identidade sem prova | A — preservar e aguardar intervenção técnica | Bloquear operação e dependentes, manter diagnóstico e permitir independentes; sem descarte, nova identidade ou reenvio automático da intenção incerta |

Q51 não promete recuperar bytes danificados. Q52 não ativa login novo sem salvar credenciais, não reabre logout e não reutiliza refresh incerto. Q53 não altera rejeição definitiva comprovada nem confirmação correspondente. As alternativas de reconstrução e descarte incerto não foram aprovadas.

## Evidência disponível e verificação necessária

Os testes existentes cobrem migrations recusadas/rollback/retry, credencial de outra conta, fence de logout, refresh perdido e falha ao salvar rotação. [migrations.test.ts](../../app/test/migrations.test.ts), [session.test.ts](../../app/test/session.test.ts), [abertura segura](2026-09-28-abertura-segura.md) e [rejeições](2026-09-28-recuperacao-de-rejeicoes.md).

A API já prova rejeição de replay alterado e preservação do grafo original; existe rejeição de criação de ID excluído. Isso não prova correspondência no reconhecimento local. [RuntimeTests](../../api/src/test/java/dev/ritmo/RuntimeTests.java), [rejections.test.ts](../../app/test/rejections.test.ts) e [deletion.test.ts](../../app/test/integration/deletion.test.ts).

Não foram encontrados testes de envelope divergente confirmado por pull/snapshot, conflito seguido de recibo original, resolução de colisão de sequência, falha de leitura do cofre na restauração, limpeza antiga falhando com conta ativa ou corrupção física. Não foi executada reprodução dinâmica neste diagnóstico. O teste atual de armazenamento usa trigger para comprovar rollback; não equivale a disco fisicamente cheio ou corrupção.

Validação da preparação documental em 07/10/2026:

- App: `pnpm typecheck`, `pnpm lint` e `pnpm test` aprovados; 94 testes, zero falhas.
- API: `gradlew.bat check --no-daemon --offline` aprovado em 15 s. Os 13 testes operacionais foram executados/aprovados; `test` Java ficou `UP-TO-DATE`, reutilizando a evidência anterior de 83 aprovados e um Android opt-in ignorado. A suíte Java não foi reexecutada neste incremento documental.
- UTF-8/blocos de código e 213 alvos locais de links verificados nos 12 arquivos afetados, sem falhas; `git diff --check` aprovado.

Esses checks preservam a baseline; não provam as novas correções de exceções. Não houve schema/migration/contrato gerado alterado nem novo teste de comportamento.

## Próximas entregas

Após confirmar entendimento: [identidade/recibos](../../.scratch/recuperacao-excecoes/issues/01-reconciliar-identidade-e-recibos.md), [cofre](../../.scratch/recuperacao-excecoes/issues/02-retomar-cofre-sem-bloquear-uso-local.md) e [abertura local](../../.scratch/recuperacao-excecoes/issues/03-expor-recuperacao-da-abertura-local.md), nessa ordem por risco. Cada tarefa é uma entrega vertical com testes, contratos/modelo/migration quando necessários e checks de app/API.

M1/tarefa 05 continuam abertos. UI/protótipo, SMTP/deep link reais, distribuição iOS, aceite iPhone 16e/Android e implantação externa permanecem nos gates existentes. Não há nova tabela, migration ou versão de protocolo neste diagnóstico.


07/10/2026 — Pedro confirmou o entendimento e as fronteiras deste plano. O diagnóstico acima descreve a preparação anterior à implementação; resultado posterior de identidade/recibos: [relatório do recorte 1](2026-10-07-correspondencia-de-recibos.md). Cofre e abertura continuam separados.
