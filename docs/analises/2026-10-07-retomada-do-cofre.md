# Retomada do cofre preservando uso local — 07/10/2026

Recorte 2 da [recuperação de exceções](../../.scratch/recuperacao-excecoes/spec.md), autorizado por Pedro após Q52=A e confirmação das fronteiras. Recorte 2 concluído localmente; não encerra M1/Fase 1. Origem: REQ-CTA-004, REQ-CTA-004b, ADR-016 e [spec/13 §22](../../specs/13-contrato-primeiro-marco.md#22-recuperação-de-exceções--q51q52q53-07102026).

## Problema e comportamento entregue

Antes, uma falha de SecureStore ao restaurar a sessão impedia abrir a conta local. A limpeza de uma credencial antiga podia impedir o uso de uma sessão nova já persistida, sem uma ação pública para retomar o cofre.

Com controle da instalação `active` e banco da conta saudáveis, a restauração abre a mesma conta mesmo quando a leitura do cofre falha. Leitura e novas intenções continuam passando por AccountStore/SQLite; acesso remoto fica pausado. A referência atual permanece intacta. Segredo ausente/inválido continua exigindo autenticação e não é confundido com erro de leitura.

Falha ao remover credenciais obsoletas conserva suas referências. A sessão atual, já persistida, permanece localmente disponível; a nova tentativa elimina somente credenciais inativas. Login novo não ativa sessão antes das duas gravações protegidas. Logout mantém a fence antes de qualquer await e permanece bloqueado até finalizar a limpeza. Nenhuma chave órfã ou refresh com resultado incerto é promovido.

## Interface e preservação

[Session](../../app/src/core/identity/session.ts) expõe `vaultRecovery(): {unavailable, cleanupPending}` e `retryVault()`. A ação tenta reler a referência atual, limpar referências obsoletas e devolver o estado; não realiza login nem refresh. Em logout incompleto, tenta concluir o bloqueio e continua recusando abertura da conta antiga.

`unavailable` é diagnóstico transitório observado nesta execução, reavaliado na retomada/restauração. `cleanupPending` deriva das referências protegidas já persistidas no controle da instalação. Erros de get/set/remove são reduzidos a `vault_unavailable`; mensagens da plataforma, chaves e segredos não entram no diagnóstico público ou no SQLite. Não há DDL, migration ou mudança de mensagem m1.1.

Cada acesso assíncrono ao cofre verifica a geração capturada antes de usar o resultado ou registrar falha. Uma nova tentativa enfileirada antes de reautenticação não pode restaurar credenciais na geração seguinte. A limpeza concluída durante refresh conserva apenas a referência nova; retry/reinício não repetem o refresh antigo.

[SyncScheduler](../../app/src/core/sync/scheduler.ts) pausa sync e revogações, inclusive quando criado depois da falha. A pausa não aumenta tentativas das intenções. A retomada pública libera o agendador, conserva prazos/estados anteriores e não permite resposta tardia substituir a pausa. Compatibilidade obrigatória e isolamento de conta mantêm prioridade.

## Provas nas fronteiras confirmadas

[Session/SQLite](../../app/test/session.test.ts), cofre e transporte externos controláveis, sem mock de módulos internos:

- Erro de get no reinício conserva conta, referências e duas intenções; retry que continua falhando não apaga nada.
- Erro de remove após login conserva a sessão nova e as pendências; reinício/retry removem só a credencial antiga.
- Erro de set impede ativação e expõe somente diagnóstico limitado; login remoto aguarda recuperação.
- Revogação de A com get falhando pausa o acesso remoto de B; escrita local de B e isolamento de A permanecem, retry revoga somente A.
- Agendador pausado por dez minutos não envia nem consome a intenção; retry retoma os mesmos IDs.
- Logout incompleto termina pela ação pública, conserva a fence e permite login seguinte sem reabrir a conta antiga.
- Retomada enfileirada na geração anterior é recusada após nova autenticação.
- Erro de limpeza após refresh persistido não entrega acesso remoto; retomada/reinício usam a credencial nova e há somente um refresh.
- Recuperação do cofre conserva o backoff existente e só envia depois do prazo.

Os nove cenários adicionais tiveram falhas observadas antes das correções. As regressões de refresh perdido, falha de persistência do refresh, escrita protegida em trânsito, ausência/conteúdo inválido, logout e resposta tardia A/B permanecem.

[Integração HTTP](../../app/test/integration/scheduler.test.ts), executada pelo RuntimeTests existente, usa Spring/PostgreSQL e SQLite reais. Após falha de leitura e reinício, cria hábito/marcação local enquanto o agendador está pausado. Outro cliente confirma zero hábitos/XP no servidor. A retomada pública converge automaticamente para hábito cumprido/10 XP; reinício e nova sincronização mantêm 10 XP.

## Validação

- App: typecheck e lint aprovados; 109 testes aprovados, zero falhas.
- API: check integral aprovado, sem filtro de testes; 85 testes Java aprovados, 1 Android opt-in ignorado e 13 operacionais aprovados, incluindo ModularityTests e a nova integração Spring/PostgreSQL/SQLite.
- Os dois testes do arquivo de integração do scheduler passaram: reconexão/ack perdido/revogação e retomada do cofre sem duplicar XP.
- Sem mudança de DDL/migration/contrato gerado. Links locais, UTF-8, fences e git diff --check verificados.
- As execuções integrais anteriores encontraram falhas nos ensaios de monitor, pressão de filesystem, preparação de 429, APIs restauradas, reinício do receptor e timeouts em retenção/proxy. A execução final integral passou após [ajustes somente das fixtures](2026-10-07-ajustes-dos-ensaios-operacionais.md), registrados separadamente. O startup do PostgreSQL e os timeouts de retenção/proxy não receberam alterações de prazo ou asserções; a causa da variação desses casos não foi comprovada.

## Reprodução

```powershell
# raiz
pnpm --dir app typecheck
pnpm --dir app lint
pnpm --dir app test

# api/, com Java 21 e Docker
.\gradlew.bat test --tests 'dev.ritmo.RuntimeTests.automaticSyncConvergesAfterLostAckAndFlushesOfflineRevocation' --no-daemon --offline
.\gradlew.bat check --no-daemon --offline
```

## Limites e próximo recorte

O cofre é o SecureStore do dispositivo; Bitwarden é custódia operacional dos servidores. Falhas do cofre foram controladas na fronteira externa em desktop; este incremento não comprova comportamento físico de iPhone/Android.

Próxima entrega: [recorte 3 — abertura local](../../.scratch/recuperacao-excecoes/issues/03-expor-recuperacao-da-abertura-local.md), incluindo abertura/PRAGMA/migration, diagnóstico, handles e retry preservando os arquivos. Reparo, exportação e reconstrução assistida permanecem fora de Q51=A.

UI/protótipo Q28, aceite iPhone 16e/Android, SMTP/deep link, distribuição iOS e implantação/aceite externos mantêm M1 e tarefa 05 abertos.
