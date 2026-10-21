---
status: accepted
date: 2026-10-21
---

# ADR-020 — PWA com frontend web próprio em React e Vite

Pedro escolheu a opção 1 do [comparativo](../analises/2026-10-21-alternativas-pwa-sem-expo.md): **React DOM + TypeScript + Vite + React Router**, persistência de navegador em **IndexedDB com Dexie** e service worker com **Workbox**. O frontend web será independente da entrada Expo/React Native. A decisão conserva React/TypeScript e aproveita a API Java existente, com apresentação HTML/CSS orientada pelo Ritmo-App e hospedagem estática. Não depende de Expo Web, SQLite web do Expo, Dexie Cloud ou de um segundo servidor de aplicação para renderizar a interface.

Complementa ADR-002 e ADR-004 para a variante web: SQLite/Drizzle e Expo continuam no aplicativo nativo; a autoridade remota de domínio/sincronização permanece Java/PostgreSQL. Compartilhar regras TypeScript, contratos, tokens, textos e assets compatíveis, sem presumir que componentes React Native ou repositórios SQL síncronos funcionem no navegador. IndexedDB exige fronteira assíncrona e transações locais que preservem intenção, sequência e projeção.

## Alternativas consideradas

- Expo Web: descartado por preferência expressa de Pedro. O alpha documentado era expo-sqlite web; corrigir essa classificação não reabre a escolha.
- Next.js: viável inclusive com saída estática, mas suas convenções/recursos de servidor não trouxeram necessidade concreta adicional para o M1 local-first com API Java.
- SvelteKit: viável, com o custo adicional de traduzir o modelo React de apresentação/reatividade.

## Consequências e limites

Manter duas apresentações, nativa e DOM, com a mesma referência visual e regras de produto. A decisão não promete percentual de reaproveitamento, desempenho ou compatibilidade já comprovada. Não criar monorepo/pacotes compartilhados amplos antes de uma necessidade demonstrada.

Fixar versões estáveis compatíveis e provar renderização/persistência/reabertura na [tarefa01](../../.scratch/pwa-m1/issues/01-provar-portabilidade-e-persistencia.md). `vite-plugin-pwa` é conveniência de build a avaliar, não dependência aprovada por esta decisão. Schema/migrações web, sessão/cookies, revogação offline, controle entre abas e atualização continuam na tarefa02 e em spec/14; a escolha da biblioteca não encerra esses contratos. Falha da prova deve ser registrada antes de propor outra stack ou reduzir garantias.

Q61–Q65 permanecem: M1 funcional no Safari/Tela de Início do iPhone + app Android, com limitação de durabilidade web explícita; build/links nativos iOS ficam posteriores. Nenhuma implementação, instalação, publicação ou contratação foi executada por este ADR.
