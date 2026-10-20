# Cauda do cumprimento no Android

Recorte de spec/07 §1 e REQ-HAB-004. [Relatório](../../../../analises/2026-10-20-cauda-do-cumprimento-m1.md), [protocolo](protocolo.md). Comparação detalhada concluída: `baseline4`/`optimized1`, cada uma com dez partidas e vinte alterações. Meta de 100 ms permanece aberta.

Referência aceita: `baseline4`, APK `5ff5a4acef82089cab9cfeeb237c6cb531a39e5fd099d94efc612b427b33785d`. Dez processos frios/vinte alterações offline, reinício/convergência de um hábito e 10 XP, perfil do escalonador validado. `baseline1`, `baseline2` e `baseline3` ficam preservadas como tentativas rejeitadas, pelos motivos registrados no relatório. Não misturar distribuições nem remover amostras válidas altas.

Os arquivos `native-frames`, marcos JS e perfil detalhado conservam os pontos observados. `toggle-attribution` separa entrega, handler/commit, retorno/React e frame. `scheduler-attribution` acrescenta residência escalonada e estados das threads JS/UI, após validar relógios, cobertura e ausência de perdas. `profile-summary` usa percentil pelo posto mais próximo; spans inclusivos não são parcelas aditivas. O contador `Debug` é apenas diagnóstico.

Traces completos permanecem em `.scratch/runtime/cauda/traces/`, fora do Git; [inventário e checksums](trace-retention.json). O repositório conserva as exportações filtradas por PID/TID, SQL, snapshots de relógio, estatísticas e hashes dos insumos. A reprodução a partir das exportações não precisa do binário ou do trace completo e repete as verificações, comparando o resultado integral com a análise original:

```powershell
C:/Python311/python.exe -B scripts/analyze_android_scheduler.py docs/design/evidencias/2026-10-20/cauda-android/baseline4 --verify-exports
```

Para reprocessar o trace completo local, use `--processor .scratch/runtime/cauda/trace_processor_shell.exe --trace .scratch/runtime/cauda/traces/baseline4-scheduler.pftrace.gz`. O processador oficial e seu hash estão em [trace-processor.json](trace-processor.json); o script recusa outro binário. Testes do analisador: `C:/Python311/python.exe -B scripts/test_analyze_android_scheduler.py`.

Os [hashes de referência](baseline-source-checksums.json) e [otimizados](optimized-source-checksums.json) diferem apenas no módulo de dia lógico. [Fontes dos relógios](clock-source-checksums.json) conferidas na instalação RN 0.86.3. App: tipos/lint/259 testes aprovados; [registro](app-checks.json). Otimizado aprovado no ensaio e perfil: mediana 85,36 ms, p95 101,00 ms, máximo 120,76 ms, 18/20 dentro de 100 ms. API check aprovado em 12 min 56 s: 85 executados/oito opt-in ignorados, zero falhas/erros e modularidade. [Preservação](preservation.json) confirmada, sem recursos próprios ativos.

Dados sintéticos; sem APK, banco, credencial ou trace completo versionados. AVD com perfil detalhado não aceita aparelho mediano físico, iPhone ou M1. A meta de 100 ms permanece intacta.
