# Versionamento inicial do Ritmo

**Data:** 27/09/2026. **Pedido:** criar o Git local e organizar o trabalho existente em commits semânticos e atômicos.

O repositório foi inicializado na branch `main`, usando a identidade Git já configurada. Não foi criado remoto nem executado push. Os commits organizam o estado existente em incrementos verificáveis; suas datas são as desta organização, sem simular a cronologia anterior de desenvolvimento.

## Histórico organizado

| Commit | Intenção |
|---|---|
| `d1fb663` | `chore(repo)`: exclusões, finais de linha e convenções de commits |
| `9cb4440` | `docs(fundacao)`: PRD, specs, entrevista, ADRs, auditoria e diretrizes |
| `60bc16c` | `feat(contracts)`: OpenAPI m1.1, DDL, fixtures e validação |
| `4f71a4f` | `feat(fundacao)`: fluxo local de hábitos, XP, sync, sessão e isolamento, com testes |
| `e0fcee1` | `feat(identity)`: recuperação por e-mail, dependências, testes e operação |
| `30de52c` | `docs(planejamento)`: plano, tarefas, resultados e pendências do M1 |
| `a105f0c` | `chore(ai-memory)`: escopo, instruções, skills e configuração do projeto |

Este relatório fecha a organização em um oitavo commit documental. As convenções permanentes estão no [guia de Git](../agents/git.md).

## Coerência dos incrementos

O núcleo de hábitos, XP, sincronização e sessão foi mantido junto porque suas garantias são exercitadas no mesmo fluxo entre SQLite e API autenticada. Separar app, backend ou testes em commits por camada quebraria essa unidade. Lockfiles e arquivos gerados necessários ao runtime pertencem ao mesmo incremento.

Para isolar a recuperação de senha, os trechos compartilhados foram preparados no índice do Git, sem substituir o código de trabalho. As duas árvores executáveis foram exportadas para diretórios temporários ignorados e testadas. O lockfile da API anterior à recuperação foi resolvido para suas próprias dependências. O incremento seguinte acrescenta envio de e-mail, endpoints, parser, transações, testes e documentação juntos.

## Validação realizada

| Estado | Resultado |
|---|---|
| Contratos | 51 schemas, 11 endpoints, 48 fixtures, 8 verificações SQLite, 11 de domínio e 25 comandos PostgreSQL analisados |
| Núcleo anterior à recuperação | TypeScript, lint e 13 testes locais aprovados; 13 testes Java, incluindo dois cenários TypeScript via HTTP/Postgres; `bootJar` gerado |
| Estado completo | TypeScript, lint e 15 testes locais aprovados; árvore exportada com 23 testes Java, incluindo três cenários TypeScript via HTTP/Postgres/SMTP local; `bootJar` gerado |
| Documentação existente e guia de Git | 56 arquivos Markdown com UTF-8 válido e sem destinos de links relativos ausentes; âncoras e links externos não foram auditados |

Os cenários TypeScript integrados são iniciados por testes Java, portanto não representam testes Java adicionais. O primeiro `check` no diretório de trabalho reutilizou resultados válidos do Gradle; os testes das duas exportações executaram de fato, sem reutilizar esses resultados. As exportações reutilizaram as dependências instaladas do app e o cache de dependências Gradle; isto não constitui instalação a partir de cache vazio.

Comandos usados: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `gradlew.bat check bootJar --no-daemon` e `python contracts/primeiro-marco/validate.py`. Runtime: Java 21 do Android Studio, Node 24 e Docker para o Postgres descartável. O SMTP dos testes foi local, sem envio externo.

## Arquivos preservados e excluídos

Foram versionados fontes, testes, lockfiles, wrapper Gradle (incluindo JAR e permissão executável de `gradlew`), migrations, validadores gerados, documentação, planejamento em `.scratch` e integração ai-memory.

Ficaram fora caches, dependências instaladas, builds, bancos, logs, projetos nativos gerados pelo Expo, arquivos de segredos e configurações pessoais de MCP/Claude/Termbaker. Esses arquivos locais foram preservados. A revisão de padrões de chave privada, token de provedor e credencial em URL não encontrou credenciais reais nos candidatos; a ocorrência em spec/09 é um exemplo de URL proibida.

O versionamento não amplia o aceite do produto: protótipo, rota iOS, scheduler, operação e cenários restantes continuam nas tarefas do [primeiro marco](../../.scratch/primeiro-marco/spec.md).
