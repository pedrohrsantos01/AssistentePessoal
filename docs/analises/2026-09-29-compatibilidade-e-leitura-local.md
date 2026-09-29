# Compatibilidade e leitura local — 29/09/2026

Continuação autorizada da [tarefa 05](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md), após snapshots e abertura segura. Recorte: núcleo de REQ-SYN-014, da política no servidor até a preservação de trabalho offline. O M1 e a tarefa inteira continuam abertos; o aviso visual depende do protótipo de Pedro.

## Comportamento entregue

- HTTP 426 ou resposta essencial desconhecida persiste uma restrição por instalação. O app mantém projeções, pendências e histórico de recuperação legíveis; impede criar, corrigir, descartar, repetir manualmente ou aplicar mudanças de domínio. A página incompatível não avança o cursor. Campos opcionais adicionais continuam aceitos.
- Mesmo build permanece bloqueado após reinício, logout, foreground e reconexão; o scheduler restaura `update_required` mesmo offline. Logout local e manutenção de credenciais/tentativas interrompidas continuam disponíveis, sem reescrever os envelopes.
- Um build diferente mantém leitura local até uma resposta validada de sync, login ou refresh da geração atual. Falha de rede, 401, 503 ou resposta de uma sessão encerrada não liberam escritas. A atualização preserva IDs, sequências e conteúdo para reconciliação/reenvio.
- `openExpoRuntime` compartilha o controle entre sessão, HTTP de identidade (incluindo recuperação de senha) e sync. `Session.access()` e `subscribe` permitem à futura UI observar o bloqueio. `client-version.ts` centraliza os cabeçalhos; sua versão deve acompanhar `app.json` e `package.json` no build.
- A API consulta `app_compatibility.min_supported_version` antes de autenticar/processar a requisição. O padrão é `0.1.0`; comparação numérica, pré-release abaixo da estável de mesmo núcleo, metadados sem efeito na ordem. Sem a linha de configuração ou acesso à tabela, responde 503. Runtime tem apenas SELECT; alteração operacional exige a role administrativa.

A política usa [SemVer 2.0.0](https://semver.org/) com limites do contrato (64 caracteres, componentes principais de até seis dígitos). OpenAPI foi ajustado para permitir pré-release e metadados juntos e recusar zeros numéricos à esquerda; mensagens e protocolo continuam m1.1.

## Persistência e migrações

[Spec/00 §12.8](../../specs/00-modelo-de-dados.md) acompanha as duas evoluções:

- Drizzle `0001_client_compatibility.sql`: adiciona `installation_control.blocked_client TEXT NULL` no SQLite separado da instalação. Teste abre a versão 0000, registra estado/fence/referências protegidas e pendência de conta, aplica 0001 e verifica preservação. A migration de falha usada em testes passou a calcular o próximo índice/timestamp depois das migrations reais.
- Flyway `V3__app_compatibility.sql`: cria a linha global com CHECK de versão estável e grants de leitura. A tabela não contém dados pessoais/de domínio, não participa do feed e é consultada antes da identidade estar disponível; por isso não usa filtro/RLS por usuário. As consultas de domínio mantêm seus filtros e RLS.

As migrations aplicadas anteriormente não foram alteradas. Não há reset, descarte automático ou duplicação de credenciais no SQLite.

## Evidência

| Verificação | Resultado |
|---|---|
| `pnpm typecheck` / `pnpm lint` | Aprovados |
| `pnpm test` | 69 testes; zero falhas, nove novos neste recorte |
| `api/gradlew.bat -p api check bootJar --no-daemon` | Aprovado; 33 testes Java, incluindo modularidade |
| Clientes TypeScript integrados pelo Gradle | Sete cenários aprovados, incluindo compatibilidade |
| Contratos (`build_contract.py` / `validate.py`) | 51 schemas, 11 endpoints, 48 fixtures; 27 comandos PostgreSQL parseados, oito checks SQLite e 11 de domínio |
| Bundle Android de `openExpoRuntime` | Gerado, 757 módulos; não equivale a execução em aparelho |

Os [testes de compatibilidade](../../app/test/compatibility.test.ts) usam sessão/repositório públicos e SQLite real, com HTTP e relógio controlados. Cobrem 426 no pull, push e refresh; restrição compartilhada na recuperação de senha; reinício/logout/retry; upgrade offline e online; resposta tardia; tolerância a campo opcional; efeito obrigatório desconhecido; preservação de histórico e bloqueio de correção/descarte. Os [testes de migration](../../app/test/migrations.test.ts) verificam a evolução física anterior e continuam provando rollback/retry em falhas.

O [cenário integrado](../../app/test/integration/compatibility.test.ts) registra uma conta descartável, cria hábito/marcação no SQLite, reabre com versão `0.0.9` e recebe 426 da API real. Após reinício, mantém leitura e as duas intenções. Reabrir com `0.1.0` continua somente leitura até a resposta válida; então converge para um hábito e 10 XP, também observados por outro cliente. Nova sincronização não duplica XP.

Os [testes HTTP/Postgres](../../api/src/test/java/dev/ritmo/RuntimeTests.java) alteram a mínima para `0.10.0` e verificam versões menores, iguais, maiores, pré-release, metadados, protocolo e formatos inválidos. Uma escrita recusada antes de autenticação/processamento é reenviada após a restauração da política: recebe a primeira revisão, sem replay, demonstrando que o 426 não a processou. As duas roles de runtime não podem alterar a política; ausência da linha e falha de permissão de leitura produzem 503. Cada teste restaura a configuração em `finally`.

No ciclo de implementação, testes demonstraram as lacunas antes das correções: persistência/bloqueio ausentes, scheduler retomando como idle e resposta atrasada liberando uma instalação após logout. O teste da API confirmou a inexistência da tabela prevista no requisito. A suíte final inclui regressões de isolamento A/B, sessão, retry, snapshots e XP.

Evidências locais ignoradas pelo Git: `.scratch/runtime/compatibility-api-red.log`, `compatibility-api-green.log`, `compatibility-api-final.log`, `compatibility-bundle.log`, `api/build/compatibility-integration.log` e XML/HTML do Gradle. Java 21, Postgres e SMTP descartáveis; nenhum acesso à VPS ou envio externo. O bundle apresentou apenas o aviso de ambiente já conhecido sobre `NO_COLOR`/`FORCE_COLOR`.

## Limites e próximo recorte

- Aviso visual e desabilitação de controles ainda não foram construídos; o núcleo expõe o estado. O protótipo continua aberto com Pedro.
- Nenhum novo APK nem execução HTTP nativa foi realizado. Próximo passo: integrar `openExpoRuntime` ao harness Android para validar rede, sessão e retomada no emulador. iPhone 16e continua sem aceite; não há Apple Developer ativo nem alternativa com Mac confirmada.
- Reduzir a mínima na API não desbloqueia um build que já recebeu a restrição. É preciso distribuir um par versão/protocolo diferente e validá-lo online. Emissão/distribuição e número do próximo build continuam decisões do processo de entrega.
- Não é um modo SQLite fisicamente imutável: migrations, recomposição de projeções ao abrir, limpeza de credenciais e recuperação de tentativas mantêm a integridade. Novas intenções e aplicação de dados de domínio ficam bloqueadas. Uma falha de gravação do marcador interrompe a operação e mantém esta execução em leitura; não se promete durabilidade quando o armazenamento não consegue gravar.
- Matriz completa M1, exclusão/tombstones, concorrência/relógios/fusos restantes, reparo/exportação de corrupção, rate limiting, e-mail/segredos reais, backup/restore e deploy continuam em seus próximos recortes.
