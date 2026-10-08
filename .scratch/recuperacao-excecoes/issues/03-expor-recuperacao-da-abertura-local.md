# 03 — Expor recuperação segura das falhas de abertura local

Status: ready-for-agent
Blocked by: none

## Resultado esperado

Entregar o [recorte 3](../spec.md) de Q51=A e REQ-SYN-012/013: preservar arquivos, classificar falhas e oferecer nova tentativa, sem reset/reconstrução/exportação.

## Pré-requisito

Confirmar entendimento consolidado e fronteiras de teste. Estados e diagnósticos serão públicos no núcleo; UI segue Q28.

## Escopo e critérios de aceite

- Tratar abertura SQLite, PRAGMAs e migration na interface pública; distinguir schema desconhecido/migration/abertura sem inferir corrupção de todo erro.
- Fechar handles adquiridos em falhas e conservar a causa original no diagnóstico técnico sem expor conteúdo/credenciais.
- Bloquear acesso à base afetada; controle de instalação ilegível bloqueia abertura inteira, sem descobrir conta por arquivos/credenciais soltas.
- Nova tentativa exige verificar controle/geração; respeitar logout, conta de origem e pendências de contas inativas.
- Não remover/substituir arquivos nem reconstruir automaticamente; reparo físico/exportação/reconstrução assistida pertencem a outro recorte.
- Provar corrupção/abertura/migration/retry pela fronteira pública e arquivos SQLite reais, com preservação de pendências e isolamento. Simulação de falha deve ser identificada como tal; não alegar ensaio nativo por teste desktop.
- Atualizar contratos/modelo se necessário, checks obrigatórios de app/API e relatório com limites.

## Resultado

Concluída: sim — recorte local; aceite visual/nativo e reparo físico continuam separados.

## Comments

07/10/2026 — Q51=A aprovada; entendimento e fronteiras confirmados por Pedro em 07/10/2026. Testes atuais de rollback/migration não cobrem corrupção física. Sem implementação nesta preparação.


07/10/2026 — Pedro confirmou entendimento e fronteiras de teste do plano com “sim”. Tarefa especificada; implementação continua pendente.

08/10/2026 — Resultado final: abertura/PRAGMA/migration/inicialização classificados, owner/sessão com diagnóstico e retry, arquivos/filas preservados, controle bloqueia abertura inteira e logout/fechamento invalidam tentativas tardias. App typecheck/lint e 121 testes aprovados; API check integral reexecutado com 85 testes Java aprovados, 1 Android opt-in ignorado e 13 operacionais aprovados. Integração nova HTTP/PostgreSQL aprovada. [Evidências e limites](../../../docs/analises/2026-10-08-recuperacao-da-abertura-local.md).
