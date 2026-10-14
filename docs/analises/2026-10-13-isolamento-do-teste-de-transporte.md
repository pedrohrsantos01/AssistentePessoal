# Isolamento do ensaio de coleta ausente

Data:13/10/2026. Correção necessária após o check obrigatório da matriz TalkBack; escopo somente fixture/teste de transporte, sem alterar operações/timers de produção.

O check completo reprovou `ProbeTransportTests.privateAuthenticatedTransportAndReciprocalDetection`: o caso Python `test_missing_primary_collection_prevents_a_healthy_detector_cycle` gravou checked180s atrás, mas leu checked0,202771s atrás. A fixture mantém ritmo-monitor.timer ativo e seu monitor_job.py regrava state.json e primary-state.json com o horário atual. O produtor podia disparar durante a consulta SSH e substituir a condição artificial sob teste.

Hipóteses: produtor concorrente (principal), consulta a outro arquivo ou erro de horário. probe_export.py consulta os dois arquivos e usa o instante mínimo; a fixture escreve ambos. O teste grava ISO UTC com timedelta180s, mantendo a expectativa170s; não aumentar margens nem enfraquecer a asserção. Parar somente o timer/serviço da fixture antes de gravar a condição elimina esse produtor; addCleanup restaura o timer mesmo se a asserção falhar. O restante continua com SSH/sudo/TLS/SMTP/systemd reais no container descartável.

Validação isolada: dez cenários passaram em20,119s na mesma imagem/ops/fixtures, com systemd/SSH/sudo/TLS/SMTP reais, namespace cgroup privado e tmpfs da fixture. O caso de coleta ausente passou sem mudar a expectativa170s. Container e tag de imagem exclusivos foram removidos pelo finally. A rodada inicial completa terminou reprovada em15m52s:93 casos/8 ignorados e uma falha. A nova rodada completa passou com exit0 em11m36s:93 casos,85 executados/8 nativos opt-in ignorados, zero falhas/erros, mais13 checks operacionais. A falha inicial permanece em .scratch/runtime/interface/reader-matrix-api-check.log; não aceitar o recorte enquanto o check obrigatório falhar.

Origem: fixture de transporte do pacote operacional, ProbeTransportTests e CLAUDE.md §6. Não há requisito de produto novo.


Reprodução pelo runner canônico, com Java21/Docker configurados na raiz:

```powershell
.\api\gradlew.bat -p api test --tests dev.ritmo.ProbeTransportTests --no-daemon --max-workers=2
```

A nova rodada completa confirmou `ProbeTransportTests` verde e `check` com exit0. O produtor concorrente era a condição não isolada do ensaio; manter os timers reais ativos é adequado aos testes de agendamento, mas não à simulação controlada de evidência antiga/ausente. A correção se limita a esse caso.
