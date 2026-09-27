# Git e commits do Ritmo

A branch inicial é `main`. O repositório local reúne app, API, contratos e documentação; um remoto só será configurado quando definido pelo Pedro.

## Commits semânticos e atômicos

Formato: `tipo(escopo): descrição no imperativo (REQ-MOD-000)`.

- `feat`: comportamento novo; `fix`: correção; `docs`: documentação; `test`: verificação sem mudança de comportamento; `refactor`: reorganização sem mudança de comportamento; `chore`/`build`: manutenção e ferramentas.
- Uma intenção verificável por commit. Código, testes, migrations, contrato e documentação necessários à mesma mudança ficam juntos, mesmo quando atravessam app e API.
- Cite os requisitos reais envolvidos. Para infraestrutura ou documentação sem requisito de produto, cite a tarefa ou documento de origem no corpo com `Refs:`; não invente um ID nem declare um requisito inteiro concluído por uma entrega parcial.
- Revise `git diff --cached` e `git diff --cached --check` antes de gravar. Selecione caminhos ou trechos explicitamente quando houver trabalhos diferentes em andamento.
- Siga os checks de `CLAUDE.md` e do recorte. Um teste de integração que depende da API deve rodar pelo Gradle, que prepara Postgres e o servidor HTTP.
- Não reescreva histórico publicado sem solicitação explícita. O conjunto inicial organiza arquivos já existentes; as datas dos commits são as da organização, não datas reconstruídas de implementação.

Exemplo de comportamento com teste no mesmo commit: `feat(identity): recupera senha por e-mail (REQ-CTA-003)`.

## O que entra no repositório

Versionar fontes, testes, lockfiles, wrapper Gradle (inclusive JAR), migrations, validadores gerados necessários ao runtime, specs, ADRs, relatórios, instruções e skills do projeto. `.scratch/fundacao/` e `.scratch/primeiro-marco/` são registros de planejamento e tarefas, não lixo temporário.

Não versionar dependências instaladas, builds, projetos nativos gerados pelo Expo, bancos locais, logs, credenciais, caches e configurações pessoais de MCP/Claude/Termbaker. Os padrões ficam em `.gitignore`. Exemplos de ambiente podem ser versionados apenas com valores fictícios. `.gitattributes` normaliza texto em LF e preserva CRLF nos scripts `.bat`.

As credenciais constantes das suítes pertencem aos serviços descartáveis de teste; não servem para ambientes reais. Um novo segredo deve entrar pelo ambiente, nunca por commit.
