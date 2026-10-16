# Evidências — descarte e esperas com TalkBack

**Rodada completa aceita: rodada4.** Nove fases, 79 medições de controles e 12 campos/IME, texto 200%, APK d9c8fd34. Checks finais aprovados: tipos/lint e 228 testes do app; API check em 10m43s, 85 executados/oito nativos opt-in ignorados, 13 verificações operacionais e modularidade, sem falhas/erros. Oito testes ignorados no check não substituem a execução nativa separada.

- `rodada1`: ADB offline na preparação, sem fase funcional aceita e sem restauração remota naquele momento. `preparation-recovery.json` registra recuperação posterior visível; causa de transporte não demonstrada.
- `rodada2`: cinco fases passaram, mas a fixture genérica recusou o pull anterior ao push. Não aceita espera durável nem o roteiro completo. APK anterior 7430a6f8.
- `rodada3`: sete fases passaram no APK novo; falso negativo ao explorar erro durante mudança de layout, por coordenadas reutilizadas pelo driver.
- `probe-copy`: diagnóstico isolado com quatro fases; `scenarioPassed=true`, mas `passed=false`/`fullAcceptance=false`. Não aceita descarte/esperas. O filtro temporário foi retirado antes da repetição completa.
- `rodada4`: roteiro final sem filtro. Capturas 01–08 conservam originais, cancelamento, pai/dependente e histórico; 09–10 mostram as duas esperas antes/depois de reiniciar; 11–15 mostram cópia inicial bloqueada/interrompida, liberação completa e retorno à conta original. `matrix-summary.json` conserva alvos, campos/IME, prazos e fases; `reader-cleanup.json` confirma restauração.
- `host-cleanup.json`: conferência de emulador/painel/ADB fechados, instalação e processos preexistentes preservados. `source-hashes.json`: fontes e binários da fixture. `increment-summary.json`: verificações e limites; `artifact-hashes.json`: SHA-256 dos arquivos deste diretório, exceto o próprio manifesto.

Dados e contas são sintéticos. Nenhum nó de senha consta dos XML persistidos; nenhuma credencial de ponte/API faz parte das evidências. A varredura não encontrou os segredos sintéticos procurados. Consulta de todas as janelas interativas próprias retornadas, sem suspender TalkBack ou ler outros aplicativos/IME. Android pode omitir fundo bloqueado por modal. Não é aceite de edição falada por caractere/cursor, desempenho, VoiceOver/iPhone, atualização obrigatória, retry esgotado, interrupção com staging não zero ou novas paletas.

[Relatório, reprodução e limites](../../../../analises/2026-10-16-talkback-descarte-e-espera.md). Recorte06/M1 permanecem abertos.
