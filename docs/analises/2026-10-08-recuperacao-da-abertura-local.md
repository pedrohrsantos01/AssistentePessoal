# Recuperação da abertura local — recorte 3

Data: 08/10/2026. Estado: recorte 3 concluído e verificado localmente. Não constitui aceite de M1/aparelhos/UI/operação externa.

Origem: [tarefa 03](../../.scratch/recuperacao-excecoes/issues/03-expor-recuperacao-da-abertura-local.md), Q51=A, REQ-SYN-012/013 e [contrato §22](../../specs/13-contrato-primeiro-marco.md). [Plano confirmado](../../.scratch/recuperacao-excecoes/spec.md) e [ADR-016](../adr/0016-preservar-pendencias-no-logout.md).

## Comportamento entregue

A abertura de instalação e conta compartilha a mesma política de PRAGMAs, histórico Drizzle, migration e inicialização. O adapter Expo usa SQLite/Drizzle nativos; os testes usam o mesmo núcleo e repositories com better-sqlite3/Drizzle reais. Não existe implementação alternativa de recuperação nos testes.

`openExpoSession` devolve um owner que conserva o bloqueio da instalação com `recovery()` e `retryDatabase()`. `session` lança `installation_locked` enquanto o controle não abre. O runtime Expo também conserva esse owner; inicializa identidade/scheduler somente após obter controle saudável. Uma falha de conta mantém a sessão disponível para diagnóstico/logout, mas `account()` fica bloqueado e o scheduler de domínio expõe `paused`.

A sessão oferece `databaseRecovery()` e `retryDatabase()` para a conta selecionada. Retry é explícito, não autentica nem reconstrói; captura geração antes de entrar na fila e revalida conta, estado e época de abertura. Logout e fechamento impedem publicação de handles atrasados. Uma falha repetida permanece diagnosticada. Após retry bem-sucedido, as intenções originais voltam ao fluxo de sync.

O diagnóstico contém nome lógico, escopo, etapa, código estável, código SQLite normalizado/reconhecido e classificação: schema desconhecido, migration, base ilegível, armazenamento ou desconhecido. Não copia texto de SQL, caminho absoluto, conteúdo ou credenciais. A exceção técnica conserva a causa e eventual falha de fechamento; elas não entram no diagnóstico público. Código SQLite não reconhecido não é copiado. `CORRUPT/NOTADB` estruturados permitem classificar ilegibilidade; erro genérico não comprova corrupção.

A abertura fecha handles adquiridos em falha e conserva eventual erro do fechamento; o owner é idempotente no encerramento. Controle ilegível impede abertura inteira, sem consultar credenciais/arquivos para descobrir conta. As pendências de contas inativas continuam preservadas e inacessíveis à conta atual. Nenhuma migration, coluna, contrato HTTP ou versão do protocolo mudou.

## Provas e método

[12 testes novos pela abertura pública](../../app/test/opening.test.ts), além da suíte existente:

- Arquivo inacessível: diretório ocupa o caminho SQLite, mantendo a cópia original fora do caminho apenas na fixture descartável; erro real do SQLite, retry repetido e intenções preservadas após remover a causa.
- Cabeçalho danificado em arquivos reais de conta e instalação: `SQLITE_NOTADB`, bytes danificados preservados, conta B intacta, bloqueio e fechamento. A fixture restaura seus bytes originais para ensaiar retry; o app não executa reparo/restauração de arquivo.
- PRAGMA com falha controlada no driver externo: classificação desconhecida e diagnóstico sem mensagem/segredo sintético; handles fechados e retry.
- Histórico futuro incompatível: recusa, falha repetida e intenção original após retirar a alteração da fixture.
- Migration descartável muda um envelope e falha; rollback comprovado pela interface da conta, retry com migration corrigida, A/B preservados, sequência e dependência originais.
- Migration da instalação tenta reativar sessão e falha; retry conserva o fence de logout e exige login antes de reabrir a conta.
- Migration com espera controlada na fronteira SQLite: logout durante retry de A impede publicação na geração seguinte de B; fechamento durante abertura de instalação fecha todos os handles e impede sessão tardia.
- Falha controlada de fechamento conserva causa original/causa de cleanup, sem inseri-las no diagnóstico público.
- Arquivo de outra conta no caminho de A é recusado durante inicialização; B conserva suas intenções e o bloqueio não expõe seu conteúdo.
- Código estruturado não reconhecido: regressão observada em vermelho, correção de normalização e verde.

[Integração HTTP/PostgreSQL](../../app/test/integration/scheduler.test.ts): criar/marcar offline, reiniciar com arquivo inacessível, verificar pausa/servidor vazio, retry, convergir com 10 XP, reiniciar e sincronizar sem prêmio duplicado. Executada pela suíte RuntimeTests, com serviço e bancos descartáveis.

O primeiro teste foi observado em vermelho antes da interface existir e passou após sua implementação. A normalização de código também teve vermelho/verde observado. Falhas de PRAGMA, cleanup e espera são simuladas exclusivamente na fronteira externa; arquivos, migrations, repositories e HTTP/PostgreSQL são reais.

## Verificação

App: `pnpm --dir app typecheck`, `lint` e `test` aprovados; 121 testes, zero falhas.

API: `gradlew.bat -p api check --no-daemon --offline` integral aprovado; suíte Java reexecutada com 85 aprovados, um Android opt-in ignorado, zero falhas/erros. ModularityTests aprovado; 13 testes operacionais aprovados. O processo integrado do scheduler executou três cenários Node aprovados, incluindo a abertura/retomada nova com HTTP/PostgreSQL. Logs locais ignorados em `.scratch/runtime/2026-10-08-opening-api-check.log`.

`git diff --check`, UTF-8/blocos Markdown e alvos locais dos links verificados sem falhas. As migrations de produção e os contratos gerados permanecem iguais.

## Limites e pendências

O ensaio de cabeçalho danificado não prova recuperação de corrupção arbitrária, disco fisicamente cheio, falha de flash nem comportamento nativo de expo-sqlite. Se o driver não expuser código SQLite estruturado, a classificação fica desconhecida e a abertura continua bloqueada. Falhas durante uso de uma base já aberta não foram transformadas neste recorte em um fluxo de reparo. Não há promessa de recuperar bytes já danificados.

Reparo físico, exportação, reconstrução assistida e intervenção destrutiva continuam em recortes próprios. Q28/UI, iPhone 16e/Android, domínio/SMTP/deep link real com Resend, rota de distribuição iOS e instalação/aceite externo permanecem gates de [M1/tarefa 05](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md). O pacote local não contrata nem publica recursos. Esta entrega não inicia o trial da Fase 1 completa.
