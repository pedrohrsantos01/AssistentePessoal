# Correspondência dos recibos — recorte 1 de recuperação de exceções

Data: 07/10/2026. REQ-SYN-017; M1-16/18; Q53=A.
Pedro confirmou entendimento e fronteiras de teste com “sim”, autorizando este recorte do [plano](../../.scratch/recuperacao-excecoes/spec.md).

## Problema reproduzido e resultado

Antes: um snapshot recebido antes de push reconhecia pelo ID um envelope local diferente daquele aceito pela API. No teste HTTP/PostgreSQL/SQLite real, a recuperação ficou vazia (0 itens quando eram esperados 2), e a dependente pôde avançar. O teste falhou antes da implementação e passou depois.

Agora: ack, pull e snapshot exigem hash do envelope integral. A intenção divergente permanece disponível no diagnóstico, junto do recibo original e eventual resposta de conflito. Dependentes aguardam; intenções independentes continuam. Não há nova identidade, descarte nem reenvio automático para resolver resultado incerto.

A API também impede efeitos de novas dependentes diretas/transitivas no lote com identidade conflitante, devolvendo deferred. Rejeição persistida por ID de hábito existente/excluído, com hash correspondente, permanece corrigível; a correção remapeia a cadeia para um ID de hábito novo sem ressuscitar tombstones.

## Contrato e persistência

[Spec/13 §22](../../specs/13-contrato-primeiro-marco.md#concretização-da-correspondência--recorte-1-07102026) concretiza a extensão aditiva m1.1: operationHash opcional no schema, sempre emitido pela API atual; identityConflict distingue colisão de operação/sequência de rejeição persistida de entidade. Comandos, rotas, limites e cabeçalhos permanecem compatíveis. Ausência de hash é JSON válido, mas não permite reconhecimento no cliente atual.

Implantar API antes do app. Abertura do SQLite confere recibos anteriores ainda sem resolução; prova ausente/divergente bloqueia e conserva o resultado histórico. O sync reconsulta em H quando falta prova. Prova exata posterior pode liberar dependentes com os mesmos IDs, conservando prazo/esgotamento de retry. Resoluções explícitas anteriores não são reabertas.

Não há DDL novo: payload_hash já existia no PostgreSQL; diagnóstico cabe nos JSON error/result do SQLite. Recibos/feed históricos são enriquecidos apenas nas respostas; V1–V5 e migrations locais não foram editadas. [Modelo](../../specs/00-modelo-de-dados.md), [contrato executável](../../contracts/primeiro-marco/README.md).

O hash corresponde ao JSON integral antes de normalização do texto. SHA-256 usa @noble/hashes 2.4.0; canonicalização conserva valores/ordem de arrays, ordena chaves UTF-16 e recusa valores incompatíveis. Fontes: [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785), [implementação/documentação oficial do noble-hashes](https://github.com/paulmillr/noble-hashes). Interoperabilidade é exercitada contra o JCS/SHA-256 da API Java, inclusive texto Unicode que normaliza para o mesmo título mas tem envelopes diferentes.

## Provas pelas fronteiras aprovadas

[Integração HTTP](../../app/test/integration/identity-receipts.test.ts) usa API Spring, PostgreSQL e SQLite reais:

- Snapshot antes de push conserva divergência e dependente, sem XP, após reinício.
- Colisão de sequência conserva recibo original, permite independentes e conserva diagnóstico/replay após reinício.
- Colisão de operação em lote fora de ordem impede filha/neto sem fatos, XP ou recibos desses comandos; a independente prossegue.
- Rejeição comprovada por ID existente e por ID excluído aceita correção da cadeia, com 10 XP e sem ressurreição; replay não reabre resolução.
- Pull antes de push distingue envelopes com títulos normalizados iguais; envelope exato Unicode é reconhecido pelo hash bruto.

[AccountStore/SQLite](../../app/test/identity-receipts.test.ts) prova ausência de hash, bloqueio de nova ação relacionada, liberação por prova exata, proteção de recibo já comprovado contra resposta tardia, consulta do original após colisão, abertura de histórico anterior, preservação do prazo de retry e conflito seguido do recibo original.

[RuntimeTests](../../api/src/test/java/dev/ritmo/RuntimeTests.java) verifica histórico sem operationHash, prova nas três leituras (replay/pull/consulta), ausência de reescrita física e conta B sem acesso à prova de A. SQL privado é usado apenas para preparar/verificar a fixture de formato histórico, não para afirmar resultado de domínio.

Regressões existentes verificam H/notProcessedAtH, cobertura/paginação, rollback de reconhecimento/base/cursor, isolamento local/remoto, XP/tombstones, conflito de lote, retenção e restauração. As expectativas de recibos e dependências foram atualizadas para o contrato de prova. Duas fixtures de retenção usavam dia fixo de 04/10 com occurredAt atual: agora derivam ambos do mesmo instante UTC, atendendo à regra já existente de criação. Nenhuma opção de produção ignora a prova para facilitar testes.

## Validação

- App: pnpm typecheck e pnpm lint aprovados; pnpm test com 100 aprovados, zero falhas.
- API: check completo aprovado; 85 testes Java aprovados, 1 Android opt-in ignorado e 13 verificações operacionais aprovadas, incluindo ModularityTests e cenários HTTP/PostgreSQL/SQLite. A execução final foi integral, sem filtro de testes.
- Compatibilidade: validador do commit anterior f3513a8 aceitou cinco envelopes atuais (push aceito, pull, consulta e push de colisão de operação/sequência). O gerador do app anterior já remove additionalProperties na validação de respostas; não é necessário novo cabeçalho.
- Contrato: 54 schemas, 11 endpoints, 56 fixtures (42 positivas/14 negativas), 27 instruções PostgreSQL parseadas, 8 verificações SQLite e 11 de domínio; validador gerado novamente.
- Hash no runtime: bundle esbuild neutral/ESM de 11,6 KB, sem módulo Node; bundle isolado IIFE compilado pelo Hermes em bytecode de 11.948 bytes com -Werror e TextEncoder declarado como global externo. O runtime Expo/Hermes fornece esse global desde SDK 51/RN 0.74 ([fonte oficial](https://expo.dev/changelog/2024-04-24-sdk-51-beta)). Compilação não comprova execução em aparelho; este incremento não realizou aceite nativo.
- Links/UTF-8: 14 documentos verificados, sem alvo local ausente ou bloco de código desequilibrado; git diff --check aprovado.

## Reprodução

```powershell
# app/
pnpm typecheck
pnpm lint
pnpm test

# api/, com Java 21 e Docker:
.\gradlew.bat test --tests 'dev.ritmo.RuntimeTests.mobilePreservesConflictingIdentityThroughTheRealHttpApi' --tests 'dev.ritmo.RuntimeTests.historicalReceiptProofIsEnrichedWithoutRewritingHistoryOrLeakingAccounts' --no-daemon --offline
.\gradlew.bat check --no-daemon --offline

# raiz:
python contracts/primeiro-marco/validate.py
```

## Limites e próximo recorte

Recorte 1 concluído localmente, com checks completos aprovados. Identidade que continua divergente preserva diagnóstico e requer intervenção técnica; não foi criado fluxo destrutivo de intervenção.

[Cofre/sessão](../../.scratch/recuperacao-excecoes/issues/02-retomar-cofre-sem-bloquear-uso-local.md) e [abertura local](../../.scratch/recuperacao-excecoes/issues/03-expor-recuperacao-da-abertura-local.md) permanecem sem implementação deste contrato. UI/protótipo Q28, validação desta mudança em iPhone 16e/Android, SMTP/deep link e implantação/aceite externos continuam nos gates existentes. Este recorte não encerra M1 nem Fase 1.
