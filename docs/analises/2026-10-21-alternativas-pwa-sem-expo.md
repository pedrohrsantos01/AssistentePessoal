# Alternativas para a PWA do Ritmo sem Expo Web

Pesquisa de 21/10/2026. Escopo: propostas, sem implementação, instalação, contratação ou publicação. Pedido atual de Pedro exclui Expo Web da variante PWA e preserva o app React Native existente. Referências locais: [PRD v3.1](../../PRD.md), [contrato M1 web](../../specs/14-pwa-primeiro-marco.md) e [plano anterior](2026-10-21-plano-pwa-m1.md). Este relatório substitui a recomendação técnica do plano anterior para avaliação; não aprova uma nova stack sozinho.

**Decisão posterior à pesquisa, 21/10/2026:** Pedro escolheu a opção1. O [ADR-020](../adr/0020-pwa-com-frontend-web-proprio.md) registra a stack aceita; o comparativo abaixo preserva as alternativas/motivos. A tarefa01 está ready-for-agent; implementação e provas continuam pendentes.

## 1. Recomendação

**Primeira proposta: frontend separado em React DOM + TypeScript + Vite, React Router, IndexedDB com Dexie e service worker com Workbox.** Preservar o backend Java, o app nativo e os contratos de domínio/sincronização. Compartilhar código de domínio e recursos quando suas dependências permitirem; construir a apresentação web com HTML semântico e CSS a partir da referência Ritmo-App.

Essa posição é uma **inferência para o Ritmo**: o M1 é uma aplicação pessoal autenticada, local-first, com API Java já existente. A proposta não exige um segundo servidor de aplicação para produzir a interface, conserva React/TypeScript e evita tornar SSR uma condição de uso diário. Não foi medido desempenho ou tamanho de bundle de nenhuma alternativa.

Correção da justificativa anterior: a documentação classifica como alpha o **suporte web de expo-sqlite**, não todo o Expo Web. A exclusão solicitada por Pedro permanece válida; esta pesquisa não tenta recolocar Expo Web como candidato. [Expo SDK57: SQLite/Web setup](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/#web-setup).

| Ordem proposta | Composição | Ajuste ao Ritmo | Custo principal |
|---|---|---|---|
| 1 | React DOM + TypeScript + Vite + React Router + IndexedDB/Dexie + Workbox | Mantém a linguagem/ecossistema da UI e permite frontend estático junto da API Java | Nova UI DOM e repositório local assíncrono; coordenação de abas e atualização próprias |
| 2 | Next.js + TypeScript + IndexedDB/Dexie + service worker | Mantém React e oferece uma estrutura integrada de rotas/manifest | Exportação estática limita funções de servidor; runtime Next acrescenta operação sem resolver offline |
| 3 | SvelteKit + TypeScript + IndexedDB/Dexie + service worker | Ferramentas oficiais para saída estática/Node e integração de SW | Outra linguagem de componentes/reatividade; regras TS podem ser compartilhadas, componentes React precisam de reescrita |

O ranking não afirma que uma opção seja universalmente mais estável. A escolha deve considerar versões publicadas, compatibilidade entre os pacotes e prova no Safari do aparelho real.

## 2. Proposta 1 — React DOM e Vite

**Fatos das ferramentas.** Vite documenta templates React/TypeScript e build de assets estáticos. React Router oferece modos declarativo, de dados e framework; a proposta pode usar o modo de dados no navegador, sem servidor próprio de rotas. O carregamento de dados de domínio continuaria passando pelo repositório local; um loader não vira autorização para ignorar a camada local. [Vite](https://vite.dev/guide/), [modos do React Router](https://reactrouter.com/start/modes).

Workbox é a biblioteca de service workers da equipe do Chrome, com módulos de precache e estratégias de cache. `vite-plugin-pwa` é um projeto separado da organização `vite-pwa`: automatiza manifest, integração do SW e registro. Não é um recurso nativo do React nem um plugin oficial da equipe Vite. Pode ser uma conveniência de build; Workbox também pode ser integrado diretamente se o plugin não passar pela verificação de compatibilidade/manutenção. [Workbox](https://developer.chrome.com/docs/workbox/), [projeto vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa), [guia do plugin](https://vite-pwa-org.netlify.app/guide/).

**Proposta para o Ritmo.** Um diretório web independente serve a jornada React DOM e consome a mesma API de domínio. O proxy pode entregar assets e API na mesma origem HTTPS; sessão web continua responsabilidade de um contrato específico no backend existente. Node é ferramenta de build, sem ser necessariamente um serviço em produção. O primeiro recorte deve provar operação local atômica, reabertura e base para o controle de escrita, sem dados reais.

**Limite.** Vite gera o frontend; não entrega por si só banco, fila offline, autenticação, bloqueio entre abas ou uma política segura de atualização.

## 3. Proposta 2 — Next.js

**Fatos das ferramentas.** Next tem suporte a manifest no App Router e um guia oficial de PWA, que inclui implementação/registro de service worker. Ter manifest não comprova a jornada offline. [Guia oficial PWA](https://nextjs.org/docs/app/guides/progressive-web-apps).

Há dois desenhos distintos:

- **Exportação estática:** `output: 'export'` produz arquivos para hospedagem estática. Funcionalidades que dependem do servidor Next em tempo de requisição não estão disponíveis nesse modo. O backend Java permanece responsável pela sessão/API; IndexedDB é acessado no cliente, respeitando o limite entre build/servidor e navegador.
- **Com runtime Next:** permite usar recursos de servidor e uma eventual fachada web. Exige operar esse runtime além da API Java, e o frontend ainda precisa de armazenamento local, SW e sincronização para funcionar sem rede. Duplicar as regras de autenticação/XP entre Java e Next não integra a proposta.

As capacidades e restrições de exportação estão no [guia de exportação estática](https://nextjs.org/docs/app/guides/static-exports).

**Inferência para o Ritmo.** É uma segunda proposta válida, sobretudo se Pedro preferir suas convenções de projeto ou houver uma necessidade concreta de renderização/fachada no servidor. O M1 atual não estabelece essa necessidade. Se Next for escolhido, comparar primeiro a saída estática; SSR não transforma dados locais do dispositivo em dados disponíveis ao servidor e não garante a abertura offline.

## 4. Proposta 3 — SvelteKit

**Fatos das ferramentas.** `adapter-static` gera saída estática; `adapter-node` gera um servidor Node. SvelteKit também compila/registra um arquivo de service worker e expõe informações dos assets para o código de cache. São capacidades documentadas pelo próprio projeto. [Saída estática](https://svelte.dev/docs/kit/adapter-static), [servidor Node](https://svelte.dev/docs/kit/adapter-node), [service workers](https://svelte.dev/docs/kit/service-workers).

**Inferência para o Ritmo.** A opção é viável como frontend novo com a mesma API Java e um repositório IndexedDB. Mantém funções TypeScript puras quando desacopladas, mas exige traduzir componentes/hooks e o estado de apresentação de React para Svelte. A saída estática evita um novo runtime permanente, assim como a primeira proposta. Sem uma preferência explícita por Svelte ou benefício demonstrado, esse custo de mudança reduz sua prioridade. Não há benchmark que sustente prometer uma UI mais rápida neste projeto.

## 5. Maturidade: evidência e limite da pesquisa

Os repositórios consultados publicam releases sem sufixo de pré-lançamento para Vite, React Router, Dexie, vite-plugin-pwa, Next.js e SvelteKit. Isso permite investigar um conjunto de versões publicadas sem escolher APIs alpha. **Não equivale a compatibilidade testada entre todos eles nem a uma garantia sobre cada API opcional.** Fixar versões e revisar os requisitos de Node/React/navegadores será parte da prova, depois da escolha.

Fontes de release consultadas: [Vite](https://github.com/vitejs/vite/releases/latest), [React Router](https://github.com/remix-run/react-router/releases/latest), [Dexie](https://github.com/dexie/Dexie.js/releases/latest), [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa/releases/latest), [Next.js](https://github.com/vercel/next.js/releases/latest), [SvelteKit](https://github.com/sveltejs/kit/releases). No monorepo SvelteKit, `releases/latest` pode apontar outro pacote; consultar a release de `@sveltejs/kit` explicitamente na seleção. Nenhuma versão foi instalada ou adotada neste relatório.

## 6. Armazenamento: comum às três propostas

IndexedDB é um banco do navegador com API assíncrona e transações. Dexie oferece uma camada sobre ele, integração reativa com React e transações que podem incluir múltiplas tabelas; a Promise de `transaction()` só resolve ao confirmar. Sua documentação alerta para o commit automático quando se espera outra operação assíncrona dentro da transação. Portanto, a proposta deve preparar cálculos necessários e persistir intenção, sequência e projeção numa única transação local, sem esperar HTTP durante ela. A implementação precisa provar rollback e ausência de sucesso visual em falha. [API IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction), [Dexie/React](https://dexie.org/docs/Tutorial/React), [Dexie.transaction](https://dexie.org/docs/Dexie/Dexie.transaction()).

Isso é um **repositório web assíncrono novo**, não uma substituição do import de expo-sqlite/Drizzle síncrono. O schema físico web e suas migrações precisam ser especificados; este relatório não cria tabelas ou modifica o modelo de domínio.

Dexie local não exige Dexie Cloud. O serviço Cloud é opcional e acrescenta sync/autenticação próprios; adotá-lo mudaria a arquitetura aprovada e não faz parte desta proposta. A sincronização continuará sendo a do Ritmo com Java/PostgreSQL. [Dexie Cloud](https://dexie.org/docs/cloud).

O fornecedor do Dexie documenta suporte ao Safari e problemas específicos de retomada/versões; isso exige teste no iOS/Safari efetivamente instalado. Uma abstração IndexedDB não elimina bugs da plataforma. [Dexie: Safari](https://dexie.org/docs/IndexedDB-on-Safari).

WebKit documenta quota, eviction e o pedido de persistência baseado em heurísticas. Nenhum dos três frameworks ou o Dexie remove essa limitação; as políticas Q63 e WEB-04 continuam exigidas. Atomicidade não é backup nem garantia absoluta de gravação física sob crash do sistema. Preservar intenções enquanto existirem localmente; o servidor só recompõe as que recebeu. [WebKit: armazenamento](https://webkit.org/blog/14403/updates-to-storage-policy/), [semântica de transações](https://www.w3.org/TR/IndexedDB/#transaction-concept).

## 7. Lacunas que escolher o framework não encerra

Estas são obrigações do [spec/14](../../specs/14-pwa-primeiro-marco.md), preservadas nas três propostas:

| Tema | Contrato/prova pendente |
|---|---|
| Sessão web | Cookie HttpOnly/Secure, CSRF/Origin, famílias por instalação, expiração/rotação, respostas perdidas, logout offline e recuperação de senha; não substituir SecureStore por localStorage |
| Uma aba escritora | Propriedade/fencing comprovável no commit, tomada segura de controle, crash/suspensão, migrations e retorno de código antigo; transações ou live queries isoladas não implementam Q64 |
| Cache e update | Cache mínimo de código/fontes/ícones, rotas offline, retenção dos assets necessários e compatibilidade release/banco/protocolo. Não cachear indiscriminadamente respostas autenticadas |
| Dados locais | Schema/migrações, atomicidade, erros de abertura/quota, recuperação não destrutiva e conta A/B |
| Safari/Tela de Início | Instalações/identidades distintas, cookies copiados, teclado/viewport, VoiceOver e reabertura offline no iPhone 16e |
| Operação | HTTPS/origem, domínio/remetente/reset e gates operacionais já existentes; nenhum framework provisiona isso automaticamente |

A documentação do vite-plugin-pwa alerta que atualização automática pode recarregar abas e perder formulários. **Inferência para o Ritmo:** preferir aviso e ativação coordenada, condicionados à compatibilidade e às operações locais, em vez de habilitar `autoUpdate` indiscriminadamente. Um aviso simples também não resolve sozinho aba escritora ou migration. [Atualização automática](https://vite-pwa-org.netlify.app/guide/auto-update), [aviso de atualização](https://vite-pwa-org.netlify.app/guide/prompt-for-update).

O envio em foreground/retomada e as pendências visíveis de Q63 permanecem. Background sync, push e notificações não são garantias deste M1. O aceite segue PWA no Safari/Tela de Início do iPhone + app Android conforme Q65; o nativo iOS fica posterior.

## 8. Recorte sugerido após a escolha

Pedro escolheu a opção1 após a comparação. ADR-020, spec, plano e tarefas registram a decisão; fechar os contratos pendentes antes da jornada funcional. A primeira prova sugerida para a proposta 1 é finita e sintética: build web, renderização de uma parte do Ritmo-App, transação de intenção/projeção, reabertura offline e cenário de duas abas/suspensão que demonstre as garantias do mecanismo candidato. Primeiro banco e coordenação, depois autenticação real e jornada vertical com sync.

Sem estimativa de prazo, porcentagem de reaproveitamento, custo de fornecedor ou aceite de Safari nesta pesquisa. Nenhuma fonte/configuração/dependência de runtime foi alterada por este relatório; não foram iniciados serviços ou executados testes de aplicação.

## 9. Reaproveitamento conferido no código atual

A apresentação React Native não é reutilizada diretamente como DOM em nenhuma destas três propostas. React/Vite e Next preservam o modelo React e parte da experiência de desenvolvimento; Svelte acrescenta a tradução do modelo de componentes/reatividade. Isso não autoriza prometer menos código, menor bundle ou prazo sem um ensaio.

| Fronteira atual | Consequência para o frontend próprio |
|---|---|
| `features/habits/domain/`, `features/gamification/domain/day-key.ts`, `core/sync/protocol.ts` e `operation-hash.ts` | Candidatos a compartilhar regras, tipos e identidade; conferir dependências/browser e as mesmas fixtures de domínio |
| `theme/tokens.ts`, `i18n/pt-BR.ts`, fontes/assets e Ritmo-App | Compartilhar referência/valores e copy; traduzir apresentação para HTML/CSS e verificar fontes/licenças offline |
| `AccountStore` usa `BaseSQLiteDatabase<'sync'>`, SQL e transações síncronas | IndexedDB exige repositório assíncrono e migrações próprias; extrair regras que devam ser comuns sem simular SQLite |
| `Journey`/`SyncScheduler` dependem de `Session`/`AccountStore`; `HttpSync` injeta bearer | Preservar os comportamentos, mas desenhar uma fronteira browser de repositório/transporte/sessão; não são classes prontas para reutilizar sem alteração |
| API Java e contratos de fatos/XP | Continuam a autoridade remota; sessão web é adaptação de contrato, não duplicação de domínio em outro servidor |

## 10. Verificação da comparação, anterior à escolha

Comparação e atualização documental apenas. Links locais, encoding e diff conferidos; tarefa01 agora em needs-info até a escolha do frontend. As regras Q61–Q65 permanecem aprovadas e nenhum substituto de Expo Web foi adotado automaticamente.

Fontes de app/API/contratos/scripts conferidas iguais ao baseline `8b39141`, que já teve typecheck/lint/264 testes do app e check API aprovados na etapa anterior. Não houve nova execução dessas suítes nesta pesquisa, nem build/ensaio de PWA: seus resultados não são provas de compatibilidade das alternativas. Nenhuma dependência ou fonte de runtime foi modificada.
