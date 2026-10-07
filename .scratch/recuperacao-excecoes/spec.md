# Recuperação de exceções — plano confirmado

Data: 07/10/2026.
Estado: Q51–Q53 aprovadas na opção A; Pedro confirmou entendimento e fronteiras de teste com “sim” em 07/10/2026. Recorte 1 concluído localmente; cofre e abertura pendentes.
Origem: [tarefa 05 do M1](../primeiro-marco/issues/05-completar-sessao-e-recuperacao.md), após [retenção concluída](../../docs/analises/2026-10-04-retencao-fisica-do-feed.md).
[Diagnóstico](../../docs/analises/2026-10-07-recuperacao-de-excecoes.md), [entrevista](../fundacao/entrevista.md).

## Resultado esperado

Tratar falhas de identidade, cofre e abertura do banco sem apagar pendências, confirmar a intenção errada ou permitir acesso entre contas. Specs canônicos: [conta](../../specs/01-conta-e-onboarding.md), [sync](../../specs/06-sincronizacao.md), [contrato §22](../../specs/13-contrato-primeiro-marco.md) e [modelo](../../specs/00-modelo-de-dados.md).

## Árvore de decisões fechada

- Q51=A: preservar arquivos e bloquear base ilegível. Se o controle de instalação estiver ilegível, bloquear abertura inteira. Oferecer nova tentativa após corrigir a causa/atualizar. Reparo/exportação/reconstrução assistida não entram neste recorte.
- Q52=A: sessão já ativa com controle e banco saudáveis mantém leitura/escrita local durante falha do SecureStore; acesso remoto pausado e referências preservadas. Logout incompleto/encerrado, login novo e refresh incerto conservam as regras anteriores.
- Q53=A: identidade cuja origem continua sem prova mantém operação e dependentes bloqueados para intervenção técnica, sem nova identidade, descarte ou reenvio automático. Intenções independentes podem seguir.

Confirmação correspondente, imutabilidade de recibos, isolamento e preservação já eram garantias aprovadas. A prova técnica de correspondência, schema de diagnóstico e compatibilidade são engenharia a concretizar antes do código; não decisões de produto adicionais. Não há outra pergunta de produto na fronteira deste escopo.

## Recorte 1 — identidade e recibos

[Tarefa 01](issues/01-reconciliar-identidade-e-recibos.md). Prioridade: o reconhecimento atual apenas pelo ID pode confirmar um envelope divergente por pull/snapshot, mesmo antes de push.

Comprovar correspondência à intenção exata em ack/pull/snapshot e reconhecimento posterior ao reinício. Conservar recibo original e distinguir colisão de operação/sequência de criação comprovadamente rejeitada por ID de hábito reutilizado. Incorporar fatos canônicos sem declarar intenção divergente salva. Manter dependentes impedidas, sem bloquear intenções independentes.

Concretizar formatos/limites e estratégia compatível no contrato executável antes de implementar; não alterar m1.1 silenciosamente. Se a estratégia exigir schema persistido, atualizar modelo e acrescentar migration nova no mesmo commit. Não editar V1–V5. Sem decisão de intervenção destrutiva oculta.

## Recorte 2 — cofre e sessão local

[Tarefa 02](issues/02-retomar-cofre-sem-bloquear-uso-local.md). Expor indisponibilidade/limpeza pendente e nova tentativa pela sessão pública. Com controle/banco saudáveis e estado `active`, leitura/escrita local continuam; requisições remotas aguardam recuperação do cofre.

Falha de `get` não equivale a segredo ausente/inválido e não apaga referência. Falha de limpeza de credenciais antigas conserva suas referências para retry. Retomada não reativa chave antiga ou refresh com resultado perdido. Respostas atrasadas e referências de A não atuam em B. `logging_out/locked` permanecem bloqueados; login novo só ativa após persistência adequada. Bitwarden operacional é outro subsistema.

## Recorte 3 — abertura e recuperação local

[Tarefa 03](issues/03-expor-recuperacao-da-abertura-local.md). Tratar erro de abertura, PRAGMA e migration na mesma interface pública de recuperação, conservando distinções de causa. Erro genérico não comprova corrupção. Fechar handles adquiridos e permitir nova tentativa segura sem apagar, substituir ou reconstruir o arquivo existente.

Falha de conta bloqueia seu acesso; falha no controle de instalação impede abrir sessão. Não tentar descobrir/abrir conta por arquivos ou credenciais soltas quando o controle é ilegível. Outra conta só pode ser ativada pelo fluxo autorizado, com isolamento e estado da instalação válidos. Não prometer recuperabilidade física ou exportar conteúdo/segredos no diagnóstico.

## Fronteiras confirmadas para os testes

- Interfaces públicas de sessão, abertura, AccountStore e cliente HTTP; SQLite e PostgreSQL reais.
- Cofre, sistema de arquivos/armazenamento, relógio e ciclo de vida são fronteiras externas para falhas controladas. Nenhum mock de módulos internos para substituir garantias.
- Identidade: pull/snapshot antes de push, recibo original depois do conflito, colisões de sequência/entidade/lote, rejeição comprovada, reinício, isolamento A/B e preservação de XP/tombstones.
- Cofre: leitura/limpeza falhando com sessão ativa, escrita local e pausa remota, recuperação/reinício, logout em falha, login novo/refresh incerto e geração de sessão.
- Abertura: conta/instalação ilegível, schema desconhecido, migration falha/retry, preservação de arquivos/pendências de contas inativas e falha na nova tentativa.
- Cada entrega: app typecheck/lint/test, API check incluindo ModularityTests, contratos/migrations afetados e links. Testes desktop não substituem aceite nativo.

## Aceite e limites

As três tarefas são verticais separadas; ordem por risco, sem dependência técnica inventada entre elas. Concluir cada uma exige prova de comportamento e relatório. Não encerrar M1 nem aceitar aparelhos/UI/operação externa por esta preparação.

Reparo físico, exportação, reconstrução assistida, intervenção destrutiva em identidade incerta, exclusão de conta e compactação de domínio têm contratos próprios. Protótipo Q28 e gates existentes permanecem.

## Resultado

Concluída: não.

Entendimento e fronteiras confirmados em 07/10/2026. Cada tarefa exige sua própria implementação e verificação.

07/10/2026 — [Recorte 1 e provas](../../docs/analises/2026-10-07-correspondencia-de-recibos.md) concluídos: correspondência antes do reconhecimento, compatibilidade de respostas, diagnóstico preservado e dependentes bloqueadas quando a identidade continua incerta. [Recorte 2](issues/02-retomar-cofre-sem-bloquear-uso-local.md) é a próxima entrega recomendada; [recorte 3](issues/03-expor-recuperacao-da-abertura-local.md) permanece pendente. O plano inteiro e M1 continuam abertos.
