# Datas, fusos e envio tardio — 30/09/2026

Status: incremento técnico M1-12 concluído e verificado; tarefa 05 e M1 continuam abertos. Origem: [tarefa 05](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md), REQ-SYN-018, REQ-HAB-006/011, REQ-GAM-004 e spec/04 §2. Fronteiras já aprovadas: função canônica pública `getDayKey`, AccountStore/HTTP, SQLite e PostgreSQL reais; relógio como fronteira externa controlável.

## Comportamento entregue

O app agora oferece `getDayKey(date, timezone, dayStartHour)` em domínio puro de gamificação. O cálculo usa o fuso do perfil e o instante da virada, mantém o calendário independente do fuso do dispositivo e não trata o dia anterior como menos 24 horas. Horas repetidas usam a primeira ocorrência; horas inexistentes usam o primeiro instante válido. Entradas inválidas de data, fuso ou hora não produzem uma chave válida. O módulo não consulta relógio, rede, React ou banco.

A API passa a usar o Clock injetável já disponível para capturar uma vez o instante de aceitação do comando de hábito. A janela retroativa continua relativa a `occurredAt` e ao contexto gravado, sem rejeitar uma intenção pela idade de transmissão. O fuso/início atuais do perfil são obtidos pela API pública de Identity no coordenador Sync e usados somente para a defesa contra dia futuro; não substituem o contexto histórico da operação. Criação, marcação e desfazer não podem registrar um dia além do limite de um dia lógico à frente do servidor no perfil atual.

Foram observadas e corrigidas duas falhas do núcleo:

- Em Chatham, uma hora configurada dentro da lacuna do horário de verão era deslocada para depois do primeiro instante válido. Um registro às 03:50, com início configurado às 03:00 e primeiro instante válido às 03:45, era recusado. A resolução agora consulta offsets válidos/transição e aceita o dia correto.
- A comparação do relógio com 24h não verificava também o limite de `dayKey` pelo perfil atual. Um contexto Kiritimati, com instante ainda dentro das 24h permitidas, conseguia registrar dois dias à frente de um perfil UTC. Agora recebe `day_invalid`, preservando a intenção para recuperação e sem criar cumprimento, concessão ou orçamento.

A primeira implementação simples do cálculo no app também falhou no caso de hora repetida de Chatham: após a primeira virada, o retorno do relógio para antes da hora configurada fazia o dia retroceder. O teste foi escrito antes da resolução por instante. Os testes HTTP reproduziram as duas falhas do servidor antes das correções; o teste de limite de 24h confirmou o uso do Clock controlado. Os comandos HTTP, schemas, migrations e dependências permanecem os existentes.

## Matriz executada

| Grupo | Evidência |
|---|---|
| Calendário e início configurado | Meia-noite, 03:59:59.999/04:00, início 0/6/12, virada de ano e ano bissexto |
| Offsets fracionários | Kolkata (+05:30), Kathmandu (+05:45), Chatham e Lord Howe |
| Horário de verão | Dias de 23/25h em New York; primeira ocorrência da hora repetida; lacunas de New York/Lord Howe/Chatham; retorno parcial da hora repetida de Chatham |
| Paridade app/API | 17 exemplos literais compartilhados exercitados pelo cálculo do cliente e por criação/marcação com HTTP, SQLite e PostgreSQL |
| Mudança offline de fuso | Intenção antiga de São Paulo preservada; perfil atualizado em outro cliente e localmente para UTC; nova ação usa o dia novo; reinício conserva os envelopes |
| Mudança offline do início | Mesmo instante gera nova ação no dia definido pelo novo início; os dois registros anteriores/futuros conservam suas chaves e convergem |
| Duas semanas sem enviar | Intenções de 20/10 aceitas no servidor em 03/11; XP/orçamento permanecem em 19/10 e 20/10, sem migração para o dia do envio |
| Retroativo criado legitimamente | Destino exatamente sete dias antes de `occurredAt`, enviado duas semanas depois, recebe 10 XP no orçamento do destino |
| Datas recusadas | Oito dias retroativos, antes do início do hábito, destino posterior ao dia da ação, relógio 24h + 1 ms, dia futuro fora do perfil e criação com início futuro inválido |
| Recuperação e replay | Rejeições preservam conteúdo após reinício; não criam efeitos; repetir a intenção recusada conserva rejeição/revisão. Repetir marcas históricas após mudança de perfil não duplica XP |

Exatamente 24h à frente é aceito quando o destino também obedece ao limite futuro; 1 ms além é recusado. Mudar contexto não autoriza ultrapassar o limite de dia. A idade de transmissão não é comparada com a janela de criação de sete dias. Esses metadados validam consistência, mas não provam criptograficamente o instante real de uma ação offline, conforme o contrato já aprovado.

## Reprodução e resultado final

Dependências instaladas pelo lockfile, Node 24, pnpm, Java 21 e Docker. Na raiz:

```powershell
pnpm.cmd --dir app typecheck
pnpm.cmd --dir app lint
pnpm.cmd --dir app test
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr' # adaptar
$env:DOCKER_CONFIG=Join-Path $env:TEMP 'ritmo-empty-docker-config'
api\gradlew.bat -p api check --no-daemon
```

Teste proprietário do recorte:

```powershell
api\gradlew.bat -p api test --tests dev.ritmo.RuntimeTests.mobileLogicalDaysRemainStableThroughTheRealHttpApi --no-daemon
```

O proprietário JUnit fixa o Clock de domínio em `2026-11-03T12:00:00Z`, inicia API/Postgres descartáveis e fornece o endereço e instante de referência ao runner TypeScript. O Clock é reinicializado pelo setup de cada teste Java. Não há endpoint de teste para mudar relógio, chamada à VPS ou serviço permanente. Autenticação/transporte são reais; o controle de tempo deste recorte diz respeito à validação do domínio de hábitos.

| Verificação | Resultado final |
|---|---|
| App typecheck/ESLint | Aprovados, sem advertências |
| Suíte local do app | 91 aprovados, incluindo 21 do cálculo de dia |
| Arquivo HTTP de datas | 28 aprovados, pelo Gradle |
| API check, incluindo ModularityTests | 35 casos: 34 aprovados e 1 Android nativo ignorado por ausência de serial; zero falhas |

O check final durou aproximadamente 75 segundos. Logs ignorados: `api/build/time-integration.log`, `api/build/test-results/test/TEST-dev.ritmo.RuntimeTests.xml`, `api/build/test-results/test/TEST-dev.ritmo.ModularityTests.xml` e `api/build/reports/tests/test/index.html`.

Fontes locais: [cálculo canônico](../../app/src/features/gamification/domain/day-key.ts), [testes do cálculo](../../app/test/day-key.test.ts), [exemplos compartilhados](../../app/test/support/logical-days.ts), [cenários HTTP](../../app/test/integration/time.test.ts), [validação de hábitos](../../api/src/main/java/dev/ritmo/habits/Habits.java), [coordenação Sync](../../api/src/main/java/dev/ritmo/sync/Sync.java) e [proprietário Java](../../api/src/test/java/dev/ritmo/RuntimeTests.java).

## Limites e continuidade

O cálculo está disponível para a futura integração com as ações/Briefing; este incremento não cria componentes visuais. Timer para reconstruir o Briefing com o app aberto (REQ-GAM-008a), confirmação da mudança de fuso detectada no dispositivo (REQ-HAB-011) e aceite visual continuam ligados ao protótipo. Não se declara esses requisitos inteiros concluídos.

São dois clientes SQLite de desktop, com Intl/IANA do runtime e API Java; o harness Android e o iPhone não foram exercitados neste incremento. O conjunto cobre transições e exemplos descritos, sem declarar validação de todos os fusos/históricos possíveis ou atualização das bases IANA em aparelhos. Datas civis de tarefas, vigência de agendas/metas e ofensivas completas continuam nos seus incrementos próprios.

Próximo recorte recomendado: exclusão/tombstones e prevenção de ressurreição, restante de M1-13. Permanecem operação real (SMTP, rate limiting, deploy e backup/restore), demais lacunas da matriz, UI e aceite dos aparelhos. O primeiro marco e a tarefa 05 continuam abertos.

## Referências primárias consultadas

- [Java 21 ZoneRules](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/zone/ZoneRules.html): offsets válidos e transição de uma hora local, usados para resolver lacunas e sobreposições.
- [Java 21 LocalDateTime.atZone](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/LocalDateTime.html#atZone(java.time.ZoneId)): comportamento de deslocar uma hora local dentro da lacuna, que explica a falha observada.
- [ECMA-402 DateTimeFormat.formatToParts](https://tc39.es/ecma402/#sec-intl.datetimeformat.prototype.formattoparts): campos civis extraídos pelo cliente no fuso explícito.
