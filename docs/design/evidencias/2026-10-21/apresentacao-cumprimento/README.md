# Apresentação do cumprimento — Android, 21/10/2026

`diagnostico2` passou as vinte alterações offline, dez processos frios, reinício e confirmação HTTP/SQLite independente de um hábito/10 XP. APK leve 9c6bdca5, probe4/marcos JS2, Perfetto com escalonamento e categorias gfx/view/input/dalvik. Sem relógio síncrono por função. Metas preservadas: feedback 0/20≤100 ms; abertura10/10≤2 s; cards0/10≤300 ms. [Relatório e limites](../../../../analises/2026-10-21-apresentacao-do-cumprimento-m1.md).

Preparar Java21, SDK Android e AVD separado conforme app/README.md. Não alterar o AVD pessoal nem limpar instalações existentes. O modo exige o mesmo APK lightweight confirmado no bundle-metadata.json:

```powershell
./scripts/verify-android-accessibility.ps1 -Performance -Presentation -PerformanceMode lightweight -Avd Ritmo_ReadOnly -GpuMode host -MemoryMegabytes 3072 -EvidenceDirectory <pasta-nova>
python -B scripts/analyze_android_presentation.py <pasta-nova> --processor .scratch/runtime/cauda/trace_processor_shell.exe
python -B scripts/analyze_android_presentation.py docs/design/evidencias/2026-10-21/apresentacao-cumprimento/diagnostico2 --verify-exports
```

O último comando reproduz a atribuição/estatísticas a partir dos exports e confere queries e hashes; não requer emulador ou processador. A análise original valida também o binário/processador e o trace bruto. Os traces grandes não entram no Git. O bruto aceito tem SHA256 48a64f289baca27832f33569460dc48b55ecee7d87d4cf2d69b6e9606ced7dad e120152632 bytes; a origem local é diagnostico2/scheduler.pftrace ou seu arquivo preservado em .scratch/runtime/apresentacao/traces/. Para usar um arquivo preservado, passe --trace <caminho-absoluto> ao analisador.

`diagnostico1` permanece reprovado: trace de134204870 bytes/SHA256 a5844ef82d34ed77a9f463db1b8d66d3357fb4cfbf5f2d702fed9dbcd8becc6d, limitado a18/20 feedbacks; confirmação consultou outro dia lógico. Analyzer-at-failure.py.txt e trace-validation.txt conservam a recusa original. O trace recuperado fica localmente em .scratch/runtime/apresentacao/traces/diagnostico1.pftrace. Não juntar suas amostras à coorte aceita nem usar nova tentativa para selecionar melhores tempos.

Scheduler-stopped, fixture-day-context, reader-cleanup e installation-isolation registram encerramento da captura, consistência do dia, restauração e preservação da jornada. Seções podem se sobrepor; não somar tempos de seções aninhadas. Running é residência em vCPU do Android, não CPU útil/GPU/host. As threads são identificadas por PID/TID e vida observada; estados desconhecidos não viram tempo ocioso. Os SQL/CSV ficam integrais para conferência.

Logs textuais normalizados para LF e sem espaços de fim de linha; originais anteriores à normalização ficam em .scratch/runtime/apresentacao/original-logs/. Valores, falhas e tentativas não foram removidos.
