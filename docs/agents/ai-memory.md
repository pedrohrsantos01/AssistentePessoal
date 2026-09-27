# Memória do Ritmo no ai-memory

Configurado em 27/09/2026, por solicitação de Pedro. O ai-memory mantém continuidade entre sessões; PRD, specs, CLAUDE.md e ADRs do checkout continuam sendo as fontes canônicas.

## Vínculo e arquivos

Escopo confirmado pelo CLI e pelo MCP: workspace `default`, projeto `ProjetoAssistentePessoal`. A capitalização corresponde ao escopo existente; não criar outro projeto com nome parecido.

- [`.ai-memory.toml`](../../.ai-memory.toml): vínculo explícito, briefing inicial limitado a 4.000 caracteres e exclusões de captura.
- [`AGENTS.md`](../../AGENTS.md): instruções de continuidade e bloco gerenciado do ai-memory.
- [`CLAUDE.md`](../../CLAUDE.md): aponta para a integração sem substituir as regras do projeto.
- [`.codex/config.toml`](../../.codex/config.toml): `[features] hooks = true` apenas neste projeto.
- `.agents/skills/ai-memory-*/SKILL.md`: seis skills gerenciadas de consulta, páginas, handoff, mensagens, manutenção e instalação.

O cliente MCP HTTP usa `http://127.0.0.1:49374/mcp`; não declara ponte de identidade de sessão. As chamadas deste projeto passam sempre `workspace` e `project` explicitamente, como orienta o [roteamento do ai-memory](https://github.com/akitaonrails/ai-memory/blob/main/docs/marker-file.md). Nenhuma configuração global foi alterada.

Os hooks nativos de SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PreCompact, Stop e SessionEnd já estavam registrados no `hooks.json` do usuário. Foram reutilizados, sem instalar cópias duplicadas. O CLI 0.156.0 já reportava a feature atual como ativa, apesar da antiga chave global `codex_hooks = false`; por isso aquela chave isolada não provava a causa da captura ausente. A chave canônica foi tornada explícita no projeto. Fonte: [hooks do Codex](https://learn.chatgpt.com/docs/hooks).

## Memórias iniciais verificadas

Duas páginas foram gravadas e consultadas no escopo correto:

| Caminho no ai-memory | Conteúdo |
|---|---|
| `project/ritmo.md` | Índice fixado do projeto, documentos canônicos, stack, marco e restrições de validação |
| `milestones/2026-09-27-fundacao-m1.md` | Evidência datada dos incrementos, testes aprovados, pendências e próximo recorte proposto |

A busca por recuperação/backoff retornou o marco correto. Não houve importação integral dos históricos, envio de segredos nem cópia completa de PRD/specs/ADRs. A autorização para manter notas concisas de incrementos está em AGENTS.md; observações rotineiras ficam a cargo dos hooks.

## Verificação da configuração

- ai-memory 2.3.1 respondeu via MCP e CLI.
- `ai-memory doctor --json` resolveu o mesmo escopo a partir da raiz e de `app/`.
- `codex features list` reportou `hooks stable true`.
- TOML/JSON e as seis skills foram conferidos.
- O teste local `hook --check-capture`, com dados fictícios e sem transmissão, recusou leitura de `.env` por exclusão de caminho. Essa política é uma barreira lexical, não uma garantia de detectar segredos em prompts ou comandos arbitrários.
- O provedor já configurado no container respondeu `pong` ao smoke test de uma mensagem `ping` (7 tokens de entrada, 5 de saída). O registro anterior de erro 429 não impediu esse teste. Não houve troca de provedor, login novo ou alteração de credenciais.
- A memória durável foi comprovada por gravação, leitura integral e busca. Isso é distinto de provar captura automática do cliente.

## Carregamento e aceite da captura automática

O Codex já reconheceu as novas skills neste chat. Ainda não foi observado um evento automático do Codex no ai-memory neste escopo após a instalação; os dados anteriores continham uma sessão de Claude Code e duas observações. Não apresentar isso como captura automática validada.

No próximo carregamento do projeto/chat, conferir a revisão de hooks apresentada pelo Codex. Definições não gerenciadas precisam ser revisadas e confiadas pela definição exata; hooks pendentes são ignorados. No CLI, essa revisão fica em `/hooks`. Não editar hashes de confiança nem usar flags para contornar a revisão. Essa exigência pertence ao [Codex](https://learn.chatgpt.com/docs/hooks#review-and-trust-hooks).

Depois de uma interação normal, conferir `memory_status` ou `ai-memory doctor --json` no escopo explícito. Observações pequenas podem aguardar o limite de lote ou a fronteira de ciclo; o Stop é uma fronteira de turno, não necessariamente fim da sessão. O fechamento nativo de sessão permite consolidação posterior. Não encerrar artificialmente este chat só para forçar o teste.

Se o cliente não carregar a configuração nova imediatamente, reabrir o projeto/chat ou reiniciar o app, preservando este chat. Não é necessário criar outra tarefa. Até a captura automática ser comprovada, consulta e gravação deliberada de memória pelo MCP já estão disponíveis.
