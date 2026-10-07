# 02 — Retomar o cofre preservando uso local da sessão ativa

Status: ready-for-agent
Blocked by: none

## Resultado esperado

Entregar o [recorte 2](../spec.md) de Q52=A: sessão já ativa com controle/banco saudáveis mantém leitura/escrita local durante indisponibilidade do SecureStore; acesso remoto pausa até recuperação.

## Pré-requisito

Entendimento consolidado e fronteiras de teste confirmados por Pedro em 07/10/2026; identidade e abertura são entregas separadas, sem dependência técnica presumida.

## Escopo e critérios de aceite

- Expor estado/ação de retomada pela sessão pública; distinguir falha de leitura de ausência/conteúdo inválido.
- Preservar referência atual quando `get` lança erro; conservar referências de limpeza incompleta para retry.
- Permitir leitura e novas intenções apenas com controle saudável `active` e banco da conta saudável; pausar acesso remoto durante indisponibilidade.
- Recuperar após nova tentativa/reinício sem reativar credenciais antigas, refrescar token incerto ou escrever em geração/conta diferente.
- Manter fence e bloqueio de logout incompleto/encerrado; não ativar login novo antes de persistir credenciais; conservar regra do refresh perdido.
- Provar falhas de get/remove/set nas fronteiras públicas com SQLite real, cofre controlável, transporte, reinício e alternância A/B.
- Não colocar segredos no SQLite/diagnóstico nem tratar Bitwarden operacional como cofre do app.
- Contratos/modelo/migration quando aplicáveis, checks obrigatórios de app/API e relatório aprovado.

## Resultado

Concluída: não.

## Comments

07/10/2026 — Q52=A aprovada; falta confirmar entendimento e fronteiras. Sem implementação ou teste novo nesta preparação.


07/10/2026 — Pedro confirmou entendimento e fronteiras de teste do plano com “sim”. Tarefa especificada; implementação continua pendente.
