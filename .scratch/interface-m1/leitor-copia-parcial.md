# Cópia parcial interrompida com TalkBack — 19/10/2026

Status: completed no escopo delimitado. Issue 06 e M1 permanecem abertos. [Relatório](../../docs/analises/2026-10-19-talkback-copia-parcial.md).

## Contrato e resultado esperado

REQ-SYN-007/013/016/017, spec/13 §7/13, REQ-DS-003 e Q60: staging separado, base anterior e intenções preservadas até instalação atômica, reinício pelo manifesto novo, consulta dos recibos em H e feed após H antes do envio. Conta inicial não expõe dados parciais.

## Verificação

- SQLite real: interromper após página não vazia, fechar/reabrir, comparar base, cursor e envelopes (criação/marcação dependente e XP provisório). Manifesto novo substitui o staging; somente cópia completa troca a base.
- Componentes: progresso não zero; gate inicial sem navegação/hábitos parciais; conta com base anterior mantém leitura/escrita e pendências.
- HTTP/Postgres: manter cobertura de paginação/corte/recibos/isolamento e reforçar staging persistido e manifesto novo.
- Android visível, TalkBack a 200%, pacote isolado: preparar snapshots reais com mais de 500 entidades (tombstones evitam centenas de cards sintéticos); primeira página real, falha controlada na segunda. Verificar progresso, bloqueio inicial, reinício offline, retomada e A/B/A. Na conta com base, comparar intenções antes/durante/após e confirmar um hábito/10 XP no cliente independente.
- Falha apenas no harness de teste, sem alterar UI/schema/protocolo ou apagar dados. Expiração de cursor é simulada na fronteira HTTP; não é prova do cleaner real. Restaurar configurações e encerrar somente recursos próprios, inclusive nas falhas.
- Checks obrigatórios app/API, relatório, evidências sanitizadas, commit semântico e nota concisa de memória.

## Limites

Não cobre VoiceOver, edição falada por caractere, desempenho, paletas integrais do APK novo ou aceite integral do M1. Não abre serviços persistentes.

## Resultado verificado

Rodada nativa 1 aprovada: seis fases, 46 controles/dez campos-IME/três retornos, staging 500 em A e B, reinício offline, três conjuntos de intenções idênticos, conclusão/edição posterior e A/B/A com 10 XP uma vez. Tipos/lint e 237 testes do app; API check completo em 19m15s (85 executados/oito opt-in ignorados, zero falhas, 13 operacionais/modularidade). Fontes de produto e schema inalterados. Configurações restauradas, instalação/recursos preexistentes preservados conforme evidências e processos próprios encerrados. Próximo recomendado: medidas instrumentadas de abertura/cards/feedback.
