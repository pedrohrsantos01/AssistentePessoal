# Estabilidade do teste de retenção WAL — 12/10/2026

O check final do recorte de aparência revelou uma igualdade inválida em `test_primary_linux.py`: sem consumidor ativo, duas coletas reais de `retainedBytes` podem diferir por WAL adicional do PostgreSQL. A rodada isolada falhou por56bytes; retenção e recuperação física passaram nessa mesma rodada.

A reprodução acrescentou uma mensagem WAL de1024bytes entre as coletas. O teste antigo falhou de forma determinística:8.414.464bytes contra8.413.376bytes. A correção exige que a segunda coleta inclua pelo menos os1024bytes novos e não ultrapasse o valor consultado diretamente no PostgreSQL logo depois. Mantém as verificações de crescimento, slot perdido/inválido e slot ausente. Nenhum coletor, contrato ou código de produção mudou.

Verificação específica: `gradlew test --tests dev.ritmo.PrimaryTelemetryTests --no-daemon --max-workers=2` passou em1m16s; o wrapper executou os seis testes Linux reais. Reprodução e resultado local: `.scratch/runtime/recorte06-primary-red.log` e `recorte06-primary-green.log`. O check completo será registrado no relatório do recorte após sua execução final.

Uma execução anterior do check, em paralelo com carga de emulador/build, também ficou presa no encerramento de container. A pilha apontou `KillContainerCmd` do Testcontainers; o worker e apenas os containers identificados pela sessão dessa execução foram encerrados. O check isolado terminou normalmente e revelou a igualdade acima. Isso não prova a causa de todas as falhas da rodada sob carga e não motivou alteração no ambiente Docker compartilhado.

Refs: `.scratch/interface-m1/issues/06-aparencia-e-acessibilidade.md`, `api/ops/primary-telemetry.md`.
