# 10 — Provar coordenação e commits web (02b, segunda parte)

Status: needs-info
Blocked by: .scratch/pwa-m1/issues/09-provar-sessao-web-e-cookies.md

Origem: spec/14 WEB-03/04/06/08/09 e [contrato02a](../../../contracts/pwa-m1/README.md). Depende da prova de sessão/barreira remota para conferir envio/ack integrado; domínio/XP existentes permanecem.

## Entrega e aceite

Implementar/reproduzir o repositório assíncrono no banco principal/visual especificados, sem migrar fixtures como usuário real. Testar CAS/presença/gate entre duas abas novas, suspensão fora/dentro do gate, crash, retomada antiga e claim remoto em voo. Não usar steal/TTL para declarar exclusão. Transação inclui controle, conta/jornada, compatibilidade e stores afetadas.

Provar comando/seq/projeção atômicos, quota/abort, beginAttempt, ack/pull tardios, correção de dependências e snapshot com nova intenção durante staging. Swap só após classificação completa em H. Provar isolamento A→B→A e invalidação de apresentação/rascunho após logout/retomada. Reabertura offline preserva intenções; nenhuma falha cria outra identidade silenciosamente.

Provar versões simultâneas, versionchange/blocked sem deadlock, rollback de upgrade, SW aguardando e assets antigos disponíveis. Build novo não libera aba velha. Aparência Q58 permanece independente; crash durante gravação relê resultado efetivo, sem afirmar transação entre bancos ou bloquear hábitos por falha visual.

Executar parte visual com navegador visível, fechar recursos próprios e registrar evidência. Sem aceite Safari/WEB completo; gate02c permanece com tarefa02 e testes06/07, evitando duplicar provisionamento/domínio.

## Resultado

Concluída: não — contrato definido; adapters e provas reais dependem da tarefa09. O experimento01 não comprova o candidato novo.
