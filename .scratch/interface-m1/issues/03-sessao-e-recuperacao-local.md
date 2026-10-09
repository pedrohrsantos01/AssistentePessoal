# 03 — Sessão e exceções locais pela interface

Status: ready-for-agent
Blocked by: 01-conta-onboarding-briefing.md

## Resultado esperado

Integrar telas/avisos/ações da Session e LocalInstallation: logout, reentrada/troca de conta, cofre e abertura inacessível. Núcleo já verificado; testar sua ligação à UI sem recriar algoritmos.

## Aceite

- Logout offline preserva pendências; gesto/rota antiga não reabre conta. Saída incompleta bloqueia e oferece terminar saída.
- B não recebe view/conteúdo/resultado assíncrono de A; reentrada A online restaura somente seus dados.
- Q52: conta ativa/bases saudáveis mantém leitura/escrita; remoto pausado, referências preservadas e retry existente; credencial antiga não reativada.
- Q51: base/controle ilegíveis exibem bloqueio correto, diagnóstico sanitizado e nova tentativa, sem apagar/substituir arquivos.
- Expiração mantém local quando autorizado; autenticar online; loading/locked não liberam dados.
- Rotas/foco/subscrições respeitam geração. Testes de falhas/navegação e Android visível comprovam isolamento/preservação.

## Referências

ADR-016; REQ-CTA-004/004b/004c; REQ-SYN-008; spec/13 §22/Q51/Q52; relatório de exceções Android de 08/10/2026.

## Resultado

Concluída: não.

## Comments

09/10/2026: criado após incorporar o protótipo; execução/aceite nativo pendentes.
