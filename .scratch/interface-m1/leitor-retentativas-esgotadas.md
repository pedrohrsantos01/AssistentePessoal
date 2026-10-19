# TalkBack — retentativas esgotadas e retomada manual

Recorte autorizado em 18/10/2026. REQ-SYN-005/008/016/017; REQ-DS-003; Q60. Contrato existente: specs/06 §3.1, specs/00 §12.3 e specs/13 §11. Sem requisito/schema novo.

- Conta e onboarding reais; criar e marcar um hábito offline, preservando os dois envelopes e a dependência; XP provisório de 10.
- Usar a fixture HTTP existente `sync-push-503`: pull real, push recusado antes de encaminhar, Retry-After de 60 s. Observar nove prazos distintos e o estado failed na décima tentativa. Backoff e relógio reais, sem acelerar timers ou alterar limites. Espera mínima teórica de 808 s entre primeira e décima tentativa.
- TalkBack ativo a 200%, gestos físicos gRPC autenticados e hierarquia nativa real. Conferir aviso/foco Q60 e preservar também o Retry-After da décima falha: botão bloqueado e prazo idêntico após reinício; o vencimento só habilita a ação, sem reenvio automático. Confirmar que o servidor ainda não recebeu o hábito.
- Reinício sem a falha, reconexão e retorno ao primeiro plano não reativam a intenção; observar por pelo menos 65 s, preservando IDs, conteúdo, dependência e XP. Teste do núcleo cobre período de 15 minutos com relógio controlado.
- Retomar pelo botão com TalkBack; cliente independente confirma um hábito cumprido e 10 XP. Histórico mantém exatamente os envelopes originais.
- Usar o APK atual isolado `dev.ritmo.readonlytest`, sem instalar atualização neste roteiro. Preservar APK/control journeytest, restaurar configurações e fechar emulador/painel/fixtures próprios.

Limites: falha injetada na fronteira HTTP, não indisponibilidade real da API; nove prazos são evidência pública da progressão, contagem persistida exata é conferida também no teste SQLite do núcleo. Não é aceite integral do M1, desempenho, edição falada, iPhone ou staging interrompido não zero.

Estado: concluído no roteiro delimitado da rodada3, com correção do mínimo final. Seis fases/40 controles/seis campos-IME/cinco retornos; dois envelopes e10 XP preservados, floor após reinício e retomada manual confirmados. App234/tipos/lint e API check17m39s aprovados. [Relatório](../../docs/analises/2026-10-18-talkback-retentativas-esgotadas.md). 06/M1 permanecem abertos; próximo staging não zero interrompido.
