# 04 — Exercitar os contratos nos runtimes reais

Status: ready-for-agent
Execução: concluída em 26/09/2026
Blocked by: 01-fechar-contratos.md, 02-validar-stack-e-build.md

## Resultado esperado

Criar o primeiro recorte executável sem identidade visual: conta de teste, hábito binário diário, marcação offline e aceitação com XP, exercitados através das interfaces reais de repositório e API. É uma etapa de integração dentro do M1; não equivale ao aceite visual nem ao marco completo.

## Escopo

- Usar a [baseline verificada documentalmente](../../../docs/analises/2026-09-25-stack-e-build-primeiro-marco.md) e resolver versões exatas/lockfiles antes de ampliar dependências.
- Criar somente módulos Identity, Hábitos, Gamificação e Sync necessários ao caminho, com contratos de [m1.1](../../../contracts/primeiro-marco/README.md).
- Converter DDL de referência em migrations Flyway/Drizzle revisadas. Configurar roles sem privilégios globais de domínio e acesso separado de Identity antes de usar dados reais.
- Provar pelo adapter SQLite e Postgres real: persistência/reinício, rollback de intenção/projeção, dupla marcação, desfazer/remarcar, ack perdido, recibos e isolamento A/B. Fixtures JSON não substituem essas provas.
- Restringir qualquer harness à verificação técnica; não desenhar o Briefing nem escolher tokens enquanto o protótipo estiver aberto.

## Aceite

- Instalação reproduzível e checks efetivamente executados registrados, com versões de runtime e comandos.
- Isolamento de leitura/escrita em Postgres, incluindo `WITH CHECK`, pré-autenticação e referência cruzada de conta; nenhum acesso de domínio com role dona/superusuária.
- Caminho criar hábito → marcar local → sincronizar → consultar XP testado em ambas as camadas; uma falha obrigatória reverte fato/XP/recibo juntos.
- Estado da validação Android e dependência iOS registrados honestamente. Não declarar teste no iPhone enquanto não existir build instalado pela rota escolhida.
- Nenhum código de Agenda, IA, notificações ou gamificação completa adicionado ao scaffold.

## Resultado

Concluída: sim, para o recorte técnico desta tarefa. O M1 completo permanece aberto.

Evidência: [primeiro recorte executável](../../../docs/analises/2026-09-26-primeiro-recorte-executavel.md). Cinco testes locais, nove testes Java (incluindo cenário TypeScript com dois clientes HTTP/Postgres), RLS/FKs/rollback aprovados; build e persistência após reinício do harness Expo no Android aprovados. iPhone e UI não foram validados. Sessão/recuperação e restante da matriz seguem na [05](05-completar-sessao-e-recuperacao.md).

## Comments

25/09/2026: dependências documentais 01/02 concluídas. Protótipo e assinatura/rota iOS não bloqueiam contratos/testes sem UI, mas continuam bloqueando partes do aceite final. Registrar a data real de início da implementação nesta tarefa para o checkpoint de quatro semanas.

25/09/2026, 18:22 (America/Sao_Paulo): início real da implementação. Revisão de quatro semanas em **23/10/2026**. Interfaces de teste já previstas no aceite: repositório local do app, HTTP da API e SQL com roles reais para isolamento. TDD em incrementos verticais; Q28 permanece aberta.
