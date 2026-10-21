# Prova técnica PWA — React/Vite e persistência

21/10/2026. **Prova01 concluída localmente**, com fixtures sintéticas. Não aceita Safari físico, jornada M1 web, instalação, sessão ou publicação. Fontes canônicas: [spec/14](../../specs/14-pwa-primeiro-marco.md), [ADR-020](../adr/0020-pwa-com-frontend-web-proprio.md) e [tarefa01](../../.scratch/pwa-m1/issues/01-provar-portabilidade-e-persistencia.md).

## Entrega e reprodução

Implementação isolada em [web/](../../web/README.md). [Desenho do ensaio](../../.scratch/pwa-m1/prova-tecnica.md), [repositório experimental](../../web/src/store.ts), [testes](../../web/test/store.test.ts) e [job visível](../../web/scripts/verify-browser.mjs). Não alterou fontes/dependências do app nativo, API ou contratos remotos.

Versões diretas exatas no package.json/lock: React/DOM19.3.1, React Router8.5.0, Vite8.3.5, plugin-react6.1.2, Dexie4.4.6, Workbox-build7.4.1, TS6.0.3. Runtime Node24.13.0/pnpm10.32.1; Chrome155.0.8059.85 no Windows; Playwright estável1.64.1. Não usa Expo Web, expo-sqlite web, Dexie Cloud nem servidor de frontend de produção.

Workbox-build integra o precache diretamente após Vite; vite-plugin-pwa não foi necessário neste recorte. A CLI Playwright consultada dependia de versões alpha do motor; a verificação usa a biblioteca estável em um job Node, sem `@playwright/test`. Dependências de produto do ensaio têm releases estáveis e versões fixadas. O lock mantém as transitivas publicadas pelos fornecedores; isso não equivale a certificar todas as dependências para produção.

`pnpm --dir web verify:browser` abre Chrome visível com perfil próprio; um servidor estático loopback serve somente o build durante a execução. Ambos fecham em `finally`. Não foi iniciado servidor Vite/dev/preview persistente. Resultados, perfis e capturas brutos ficam em `output/playwright/pwa-probe/` (ignorado); cópia selecionada em [evidências](../evidencias/pwa/2026-10-21/resultado.json). Serviços persistentes futuros continuam sujeitos ao TERMBAKER.

## Resultados observados

| Prova | Evidência e limite |
|---|---|
| Build estático | 99 módulos; JS371.63kB bruto/119.80kB gzip, CSS4.62kB/1.26kB gzip. Precache12 arquivos/650014bytes. Tamanho não é medição de desempenho no iPhone |
| Trecho Ritmo-App | Holograma escuro, Briefing/hábito/XP provisório; fontes Chakra Petch/JetBrains Mono, tokens e ícones locais. [Captura estreita](../evidencias/pwa/2026-10-21/04-narrow-layout.png). Não é a implementação pixel perfect de todas as telas |
| Commit/rollback | Transação Dexie inclui intenção, sequência, projeções e controle. QuotaExceededError injetado após inserir intenção rejeitou a operação; hábito, XP, sequência e IDs ficaram iguais. Verificado em fake-indexeddb e UI/IndexedDB real no Chrome |
| Undo/remark | Teste determinístico reutiliza a projeção existente, observa IDs de undo e produz XP provisório10→0→10. Sequência abortada foi reutilizada corretamente; identidade de operação confirmada não muda |
| Reabertura offline | Navegador inteiro fechado/reaberto com o mesmo perfil, rede desativada antes de navegar. ID/seq/projeção persistiram; zero requisições chegaram ao servidor. [Captura](../evidencias/pwa/2026-10-21/02-reopened-offline.png) |
| Abas/suspensão | Segunda aba iniciou somente leitura; primeira congelada por CDP. A segunda tomou o Web Lock, incrementou geração e gravou; após descongelar, primeira atualizou a leitura e permaneceu sem escrita. [Captura](../evidencias/pwa/2026-10-21/03-takeover-after-freeze.png). Lease obsoleto também é rejeitado transacionalmente no teste determinístico |
| Fixtures A/B | Consultas e transações usam chaves por conta; B não recebeu a fila/projeção de A. Isso não verifica autenticação/logout, inexistentes nesta prova |
| Migração V1→V2 | fake-indexeddb: falha preservou V1, entidades, intenção e next_sequence; tentativa posterior recompôs projeções com mesma intenção e XP. Não exercita atualização de código concorrente nem migração no Safari real |
| Recursos | Chrome informou IndexedDB/Web Locks/SW/fontes disponíveis, `persisted=false`; estimativa de uso717147bytes/quota10738135387bytes na amostra. É estimativa local, não reserva/garantia; nenhuma quota física foi esgotada |
| Erros/recursos | Sem exceções JS no ensaio final; sem overflow horizontal em390×844. Navegador/perfil próprio e servidor do job encerrados; Chrome pessoal preservado |

## Reaproveitamento e custo observado

Três módulos puros existentes são importados diretamente: tokens, protocolo/entityKey e projeção de hábitos. Nenhum precisou de alteração para compilar no navegador. Fontes já licenciadas são copiadas no build a partir das dependências fixadas do app; build não carrega runtime Expo. Licenças acompanham os assets offline.

A apresentação foi escrita em DOM/CSS, com copy técnica separada e dimensões visuais derivadas dos tokens. Telas nativas não viraram HTML automaticamente. O repositório Dexie é assíncrono e específico do ensaio: AccountStore/Drizzle síncrono, Journey/Session e HttpSync bearer não foram tratados como adapters web prontos. Não há estimativa de prazo ou porcentagem de reaproveitamento a partir deste trecho.

## Próximo recorte: contratos02

1. Especificar schema e migrações web de produto, isolamento/abertura/falhas e fronteira assíncrona com Journey/Session; não promover as tabelas reduzidas do ensaio silenciosamente.
2. Fechar sessão web/API: cookies HttpOnly/Secure/CSRF, instalação nova, rotação/resposta perdida, revogação/logout offline e cookies copiados Safari→Tela de Início; preservar transporte bearer nativo.
3. Consolidar o candidato Web Locks+geração e incluir sessão/envio, código antigo, crash, migração e atualização. `steal` sozinho não impede execução antiga; a validação da geração dentro de cada transação é necessária. O service worker não é escritor da fila.
4. Definir origem HTTPS de teste, compatibilidade e atualização/retensão de assets com fila. Manifest mínimo/cache local não comprovam instalação ou upgrade seguro.
5. Executar o roteiro físico abaixo. Task02 permanece needs-info até as definições e evidências necessárias; nenhuma WEB-01–10 foi declarada aceita integralmente.

## Roteiro físico — iPhone16e

Preparação posterior: servir os mesmos artefatos em origem HTTPS estável de teste, sem dados reais; publicação ainda não realizada/autorizada por este ensaio. O loopback deste computador não serve de origem segura no iPhone. Registrar: versão exata iOS/Safari, data, origem, revisão/build, modo Safari ou Tela de Início, condições de rede e armazenamento. Não preencher versão por inferência do modelo do aparelho.

1. No Safari, abrir online `/probe/a`, aguardar cache e fontes, recarregar. Registrar IndexedDB, Web Locks, SW, quota estimada e persistência. Se exclusão não estiver disponível, preservar leitura e bloquear escrita; não habilitar fallback permissivo.
2. Marcar hábito, copiar somente os IDs sintéticos/seq do diagnóstico e confirmar mudança. Simular quota: nada deve mudar. Desfazer/remarcar e verificar os envelopes preservados.
3. Fechar Safari, desligar rede e reabrir. Comparar mesmo ID/seq/XP. Repetir após encerrar o processo do navegador e após retomar de suspensão. Não confundir eviction com logout nem prometer recuperar intenções nunca enviadas.
4. Abrir duas abas da mesma instalação, confirmar uma só escritora; suspender a antiga, tomar controle e retomar. Validar nova leitura e nenhuma gravação antiga. Repetir com fechamento/crash; coletar falhas/limites do Safari.
5. Adicionar à Tela de Início e repetir o percurso nesse contêiner, anotando seus próprios IDs/dados. Não pressupor compartilhamento com Safari. Instalação/ícones finais e isolamento de cookies reais só poderão ser aceitos no recorte próprio.
6. A tarefa02 precisa preparar versões antigas/novas controladas para migrar com fila e simular falha no IndexedDB real; o teste fake-indexeddb atual não substitui isso. VoiceOver, teclado, três aparências e métricas de desempenho ficam nas tarefas de jornada/aceite.

## Verificação do checkout

- Web: typecheck/lint aprovados; dois testes com cenários transacionais/migração; build e ensaio Chrome visível aprovados.
- Nativo: typecheck/lint aprovados; 213 testes de domínio +51 de componentes aprovados.
- API: `gradlew check --no-daemon` aprovado com Java21 do Android Studio; 13 testes operacionais executados, tarefa Java `test` considerada UP-TO-DATE pelo Gradle. Primeira tentativa usou Java25 do ambiente e não encontrou toolchain21; repetição com JAVA_HOME correto passou. Não alegar nova execução completa das integrações Java.
- Nenhum teste no iPhone ou WebKit desktop, API real web, compra, e-mail ou deploy neste incremento. Native iOS e demais gates M1 continuam pendentes.

## Fontes técnicas consultadas

Atomicidade/await restrito no Dexie: [transactions](https://dexie.org/docs/Dexie/Dexie.transaction()) e [best practices](https://dexie.org/docs/Tutorial/Best-Practices). Build estático: [Vite](https://vite.dev/guide/build). Cache: [Workbox-build](https://developer.chrome.com/docs/workbox/modules/workbox-build). Limites de takeover: [Web Locks request/steal](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request). Versões fixadas conferidas no registro npm; compatibilidade observada limitada ao ambiente descrito.
