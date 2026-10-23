# 10 — Provar coordenação e commits web (02b, segunda parte)

Status: ready-for-agent
Blocked by: none — recorte09 concluído com prova local de sessão/barreira remota

Origem: spec/14 WEB-03/04/06/08/09 e [contrato02a](../../../contracts/pwa-m1/README.md). Depende da prova de sessão/barreira remota para conferir envio/ack integrado; domínio/XP existentes permanecem.

## Entrega e aceite

Implementar/reproduzir o repositório assíncrono no banco principal/visual especificados, sem migrar fixtures como usuário real. Testar CAS/presença/gate entre duas abas novas, suspensão fora/dentro do gate, crash, retomada antiga e claim remoto em voo. Não usar steal/TTL para declarar exclusão. Transação inclui controle, conta/jornada, compatibilidade e stores afetadas.

Provar comando/seq/projeção atômicos, quota/abort, beginAttempt, ack/pull tardios, correção de dependências e snapshot com nova intenção durante staging. Swap só após classificação completa em H. Provar isolamento A→B→A e invalidação de apresentação/rascunho após logout/retomada. Reabertura offline preserva intenções; nenhuma falha cria outra identidade silenciosamente.

Provar versões simultâneas, versionchange/blocked sem deadlock, rollback de upgrade, SW aguardando e assets antigos disponíveis. Build novo não libera aba velha. Aparência Q58 permanece independente; crash durante gravação relê resultado efetivo, sem afirmar transação entre bancos ou bloquear hábitos por falha visual.

Executar parte visual com navegador visível, fechar recursos próprios e registrar evidência. Sem aceite Safari/WEB completo; gate02c permanece com tarefa02 e testes06/07, evitando duplicar provisionamento/domínio.

## Resultado

Concluída: sim — adapters assíncronos V1 e prova local02b entregues, conforme [relatório10](../../../docs/analises/2026-10-23-prova-coordenacao-web.md).20 testes web/typecheck/lint e264 testes do app/typecheck/lint aprovados. Check completo:112 casos Java,102 passaram/10 opt-in ignorados (8 Android e2 navegadores exercitados separadamente),13 operacionais. Ensaio final Chrome155 visível com Java/IDB reais aprovado após a última alteração do adapter.

Capturas imutáveis de conta/geração/posse, CAS/presença/gate sem steal, falhas atômicas, beginAttempt/ack/pull, correção de dependências, snapshot com nova intenção em staging e A→B→A verificados. Retomada após crash, reabertura inteira offline, limpeza da apresentação secundária no logout, SW aguardando e rollback após mutar dados de upgrade passaram. Aparência relê o resultado efetivo sem transação entre bancos. Registros ilegíveis são preservados; campo opcional remoto é ignorado, efeito obrigatório desconhecido pausa o build.

Navegador/proxy/API/containers próprios encerrados. Sem deploy, aceite Safari/Tela de Início, jornada03 ou M1. Próximo gate02c permanece na tarefa02 e nos ensaios06/07; domínio no fluxo humano já existente.
