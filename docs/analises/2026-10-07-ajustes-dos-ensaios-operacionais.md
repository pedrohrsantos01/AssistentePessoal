# Ajustes dos ensaios de validação local — 07/10/2026

Durante a validação integral do [recorte 2 da recuperação de exceções](../../.scratch/recuperacao-excecoes/issues/02-retomar-cofre-sem-bloquear-uso-local.md), a suíte já existente encontrou duas falhas em fixtures Linux, um timeout de preparação do cliente HTTP, uma configuração WAL divergente nas APIs restauradas e uma espera fixa que consultava prematuramente o estado do receptor. Este ajuste modifica somente testes: unidades/CLIs de produção, limites de saúde, TLS/SSH, SMTP e garantias verificadas permanecem.

## Limite de partidas do systemd

O [teste recíproco](../../api/src/test/fixtures/transport/test_transport_linux.py) inicia seis ciclos em menos de dez segundos para verificar alerta, deduplicação, falha/retry SMTP e resolução. A unidade de produção é executada a cada minuto.

Um ensaio isolado reproduziu a falha: `Result=start-limit-hit`, `StartLimitIntervalUSec=10s`, `StartLimitBurst=5`. O journal mostrou cinco ciclos concluídos e a partida seguinte recusada, sem falha da aplicação do monitor.

O drop-in da fixture descartável passa a definir `StartLimitIntervalSec=0`, junto do comando finito de coleta já substituído na fixture. Não modifica a unidade de produção ou remove testes de saúde da agenda. O mesmo ensaio isolado passou após a correção, incluindo retry da entrega e resolução por STARTTLS/SMTP real.

## Janela do ensaio de pressão do filesystem

O [teste de pressão](../../api/src/test/fixtures/transport/test_primary_linux.py) usava intervalo de um segundo na CLI e um probe SSH nativo cujo limite é dez segundos. A CLI captura o instante antes da coleta; o probe gera seu instante depois. Assim, mesmo uma coleta concluída dentro do prazo pode exceder a janela artificial de um segundo em um host ocupado.

A primeira execução integral não emitiu os dois alertas críticos esperados após 95% de ocupação. Essa falha não se repetiu em uma fixture isolada, sem alteração de produção; a instrumentação temporária observou metadados entre 0,29 e 0,48 segundo depois do instante da CLI e a sequência completa de alertas. Não foi comprovada a causa exata dessa ocorrência inicial.

O ensaio agora usa intervalo de dez segundos, alinhado ao limite real da coleta, e espera esse intervalo entre os ciclos. Mantém ocupação real do filesystem a 85%/95%, alerta/resolução via TLS, deduplicação e seis Message-IDs distintos. Limites de freshness e testes de metadados inválidos/stale da produção permanecem.

## Preparação do cliente de rate limiting

Na segunda execução integral, [RateLimitTests](../../api/src/test/java/dev/ritmo/RateLimitTests.java) esgotou a espera de 30 segundos pelo sinal de preparação do cliente. Essa janela inclui startup de Node/tsx, login e 119 chamadas HTTP reais para preencher a quota. O arquivo de log estava vazio; não foi comprovada a etapa exata do atraso. Na investigação do host foram observados cerca de 366 MiB de memória física livre em 32 GiB.

A espera de preparação passa a 120 segundos, como outros ensaios de integração. Continua limitada; após sinalizar readiness, o processo ainda tem 60 segundos para terminar. Nenhuma quota, Retry-After, clock controlado, timeout de requisição da aplicação ou asserção de convergência é alterado.

O [cliente de teste](../../app/test/integration/rate-limits.test.ts) imprime cinco marcos sem dados de usuário, tokens ou corpos: início de identidade, sessão disponível, quota preenchida, readiness e convergência após 429. Assim, uma nova falha pode ser localizada sem depender de um log vazio. Esses marcos não existem no runtime do produto.

## Prazo WAL das APIs restauradas

A segunda execução integral também recebeu 503 onde o teste esperava 201 ao criar um snapshot depois da primeira restauração. A [fixture WAL](../../api/src/test/java/dev/ritmo/WalRecoveryTests.java) já explicitava 2000 ms na API de origem para o ensaio de recuperação, como o [default de produção](../../api/src/main/resources/application.properties), mas suas duas APIs restauradas herdavam 250 ms do helper destinado às falhas controladas.

As duas APIs restauradas agora recebem os mesmos 2000 ms da origem. A exigência de receptor síncrono, durabilidade antes de publicar confirmações, invalidação de credenciais, snapshots, XP e replay permanecem. Nenhuma configuração de produção foi modificada. Os testes de cancelamento, perda/timeout do commit, receptor ausente e falta de espaço continuam com 250 ms e esperando recusa.

## Reinício observado do receptor WAL

A quarta execução integral passou nos cenários de retenção/proxy, mas [ReceiverSupervisionTests](../../api/src/test/java/dev/ritmo/ReceiverSupervisionTests.java) encontrou activating onde esperava active após crash com o primário indisponível. A fixture dormia oito segundos e consultava o estado uma única vez. O journal registrou cerca de sete segundos entre o SIGKILL e a conclusão da parada; o restart de dois segundos começa depois dela. A espera fixa não prova que a transição terminou.

O caso isolado foi tornado reproduzível adicionando ExecStartPre=/usr/bin/sleep 10 somente no drop-in descartável da última partida. Com a asserção antiga, o teste isolado falhou em 55 segundos com o mesmo estado activating. Não foi substituído o supervisor, o receptor PG18 nem sua conexão TLS.

O teste agora aguarda até vinte segundos, o limite de reinício já usado nas outras etapas do cenário, por um MainPID diferente do interrompido e de zero, junto de ActiveState active. Isso impede tanto consultar durante a transição quanto aceitar o processo antigo. Permanecem os testes de desconexão, crash, cauda .partial, primário ausente, reconexão e flush remoto. Unidade, RestartSec, TimeoutStopSec, limites de partidas e códigos fatais de produção permanecem.

Com o mesmo atraso de dez segundos, a repetição isolada após a correção passou em 1 min 8 s, incluindo retorno do primário e reconexão. A hipótese confirmada é a consulta antes de terminar a transição, não uma falha de continuidade do supervisor.

## Timeouts nos testes de retenção e proxy

A terceira execução integral encontrou timeout HTTP de 15 segundos durante a preparação de 501 hábitos na suíte de retenção e timeout de dez segundos num login do teste de proxy. O teste de proxy passou isoladamente. O timeout de preparação da retenção repetiu-se em duas execuções isoladas, sem alteração do runtime.

Uma terceira repetição de retenção, com instrumentação temporária nas fronteiras de HTTP/JVM/PostgreSQL, passou: os dez lotes de 50 hábitos levaram entre 0,83 e 1,27 segundo e o lote final, 25 ms. O heap observado ficou entre 62 e 101 MB; a amostragem não mostrou full GC nem pausa relevante de coleta. O PostgreSQL mostrou uma espera de lock de transação durante um lote, compatível com a concorrência do executor de retenção, mas essa espera não reproduziu o timeout.

A causa da variação de latência continua sem comprovação. Nenhum prazo, lote, asserção ou configuração de produção foi alterado nesses dois testes. A instrumentação foi removida antes da verificação integral final.

## Validação

API check integral aprovado: 85 testes Java aprovados, 1 Android opt-in ignorado e 13 verificações operacionais aprovadas. As fixtures Linux de monitor, filesystem e receptor, a integração HTTP de 429 e a recuperação WAL em duas timelines passaram com suas asserções completas; os cinco marcos do cliente foram observados na execução final. Nenhum container de outro projeto foi parado/removido; os diagnósticos criaram e removeram somente suas próprias fixtures e imagens.

Houve também um timeout inicial no startup do PostgreSQL de empacotamento; nenhuma mudança de timeout, imagem ou asserção foi feita para esse caso. A repetição integral passou, inclusive esse teste de empacotamento; a causa do timeout inicial não foi comprovada.
