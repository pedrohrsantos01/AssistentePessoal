# Evidências — travessia de diálogos com TalkBack

- **Rodada aceita: rodada3.**31 fases, sete percursos,145 gestos lineares/297 observações de foco. Mesmo APK7430a6f8, texto200% após preparação inicial a100%. Produto inalterado.
- `rodada1`: falha do driver na preparação; `passed=false`, nenhuma travessia aceita. `attempt.json` explica a hierarquia transitória.
- `rodada2`: privacidade passou; falso negativo do driver ao procurar o título informativo da exclusão com a altura mínima dos controles. `passed=false`; `attempt.json` e XML preservam o diagnóstico.
- `rodada3/*-linear.json`: nó/janelas após cada gesto e antes dele. `forward`/`backward` são a travessia; `leading-edge`/`trailing-edge` testam as bordas. XML/PNG correspondem aos checkpoints de entrada, última ação e retorno, além da jornada funcional existente.
- `matrix-summary.json` de cada rodada conserva o resultado próprio; nenhuma tentativa reprovada foi promovida a aceite.
- `increment-summary.json`: escopo, contagens, validações e checks do incremento. `host-cleanup.json`: conferência de recursos fechados. `source-hashes.json`: fontes/observador. `artifact-hashes.json`: integridade dos arquivos versionados deste diretório, exceto o próprio manifesto.

O observador não suspende o leitor; consulta todas as janelas interativas próprias retornadas, sem conteúdo de outras aplicações/IME. O Android pode omitir o fundo bloqueado por um modal; não se alega inspecionar janelas ocultas. Nenhum resultado aqui aceita edição falada por caractere, desempenho, VoiceOver, toda a matriz de sincronização ou novas paletas.

[Relatório, reprodução e limitações](../../../../analises/2026-10-16-talkback-navegacao-dos-dialogos.md).06/M1 permanecem abertos.
