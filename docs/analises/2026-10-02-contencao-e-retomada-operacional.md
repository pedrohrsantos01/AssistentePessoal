# Contenção e retomada operacional — 02/10/2026

Recorte 1 autorizado por Pedro após confirmar Q33–Q43. REQ-NFR-004, REQ-CTA-004b, [ADR-019](../adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md) e [tarefa local](../../.scratch/recuperacao-operacional/issues/01-conter-e-retomar-api.md). M1 e tarefa 05 continuam abertos.

## Resultado

API em quarentena configurada por `RITMO_RECOVERY_QUARANTINE=true`, fora do banco restaurado. Filtro existente recusa rotas `/api/v1/` com 503 `temporarily_unavailable` antes de quotas/compatibilidade/corpo/autenticação/SQL de requisição. Sem endpoint remoto de liberação; mudar modo exige reiniciar. Instalação normal não restaurada mantém padrão false; operador deve ativar a contenção antes de iniciar sobre dados recuperados.

Preparação administrativa com `prepare-recovery.sh`/`.sql`: exige quarentena e declaração de recuperação verificada, recusa login runtime, aceita dono das três tabelas de credenciais ou superusuário. Uma transação revoga famílias/refresh e consome links anteriores, preservando senha/dados/recibos. Locks protegem a execução; API e demais escritores devem estar parados. Rotacionar também a chave de assinatura antes da publicação. Procedimento em [ops/recovery.md](../../api/ops/recovery.md).

O núcleo existente de Session/AccountStore conserva uso local e novas intenções quando remoto está indisponível ou exige autenticação. Login na mesma conta reabre o SQLite; cursor assinado antes da rotação exige snapshot/classificação de pendências. Novos ensaios HTTP/SQLite provaram esse comportamento no contexto de recuperação. Não houve mudança de schema, migrations, dependências ou formato m1.1.

## Evidências nos testes

`RestoreTests` contém os dois ensaios anteriores e três novos:

- Quarentena: snapshot existente, pull, recibos, push, cadastro/login, refresh/revoke e recuperação de senha recusados. Headers/token inválidos, corpo malformado e rota codificada não contornam; recusa permanece após desligar o PostgreSQL.
- Preparação: SMTP local gera link real de teste. Flags ausentes e login runtime são recusados. Falha na última escrita SQL desfaz revogações anteriores; refresh continua funcionando pela API. Dono sem superprivilégio executa preparação; repetição antes da reabertura é segura. Access/refresh das duas contas e link anterior são recusados, senha preservada permite novo login e refresh novo funciona.
- Cliente: obter duas cópias, uma anterior e outra posterior a confirmações observadas. Encerrar a origem; publicar apenas a cópia histórica em quarentena. App reaberto preserva hábito confirmado depois do corte, exclusão, XP, cursor e envelopes; cria mais intenções locais mesmo após refresh 503. Cópia histórica nunca é liberada.
- Retomada: restaurar a cópia completa em outro cluster, invalidar credenciais e trocar a chave fictícia. Reautenticar e ressincronizar classifica e envia pendências mantendo três hábitos ativos e 30 XP; replay de criação confirmada conserva revisão 9. Segundo SQLite converge. Logout/login em outra conta não expõe ou envia os dados preservados; reentrada em A conserva nova intenção privada.

Asserções de domínio por HTTP/Session/AccountStore públicos, sem consultas privadas para afirmar resultado. DDL temporário no container injeta falha externa no script; é recomposto antes da API. SMTP, bancos e processos são locais/descartáveis, com fechamento em finally. Não houve conexão à VPS, e-mail externo ou uso de segredos reais.

TDD: o primeiro teste exigia 503 e observou 201 antes do filtro; depois passou. A preparação também foi exercitada antes de existir o mecanismo. Fixtures respeitam UUID v7 para lotes e o contrato de primeiro pull por snapshot; o teste de retomada valida a política existente de não reutilizar refresh de resultado incerto.

## Verificações finais

- App: `pnpm --dir app typecheck`, `pnpm --dir app lint`, `pnpm --dir app test` — **94 aprovados**, sem falhas.
- API: `api/gradlew.bat -p api check --no-daemon` — **54 casos, 53 aprovados e 1 ignorado**, sem falhas/erros. Modularity 1, RateLimit 11, Restore 5, Runtime 37 (um Android nativo ignorado sem configuração de aparelho).
- Integração móvel nova passou dentro do Gradle; saída em `api/build/operational-recovery-integration.log`. JUnit em `api/build/test-results/test/`, relatório em `api/build/reports/tests/test/index.html`.
- Documentação: **18 arquivos Markdown, 121 links locais, zero erros**, e `git diff --check` aprovado. Os relatórios de build são arquivos ignorados; os resultados acima foram conferidos nos XMLs, sem inferir êxito só por logs de startup.

Nesta máquina, o Java 21 instalado fica em `C:/Program Files/Android/Android Studio/jbr`; usar `JAVA_HOME` correspondente. Testes usaram `DOCKER_CONFIG` em `api/build/test-docker-config`, vazio, sem autenticação de produção. Não criar servidor persistente fora do Runner.

## Limites e próximo recorte

A flag verificada é declaração do operador, não validação automática da cadeia. Isolamento de rede, parada de todos os escritores, comprovação de completude e rotação de chave são precondições do procedimento. Default false não detecta automaticamente uma restauração. Uma chave nova sozinha não revoga refresh/reset; preparação administrativa sozinha não invalida JWT stateless. Repetir preparação após publicar revogaria também sessões novas.

O ensaio compara dump histórico isolado e dump completo capturado de propósito após as confirmações. Não implementa receptor/WAL síncrono nem prova RPO zero sob perda imprevista da VPS, janela PITR ou RTO real. Próximo: [recorte 2, durabilidade e recuperação pós-base](../../.scratch/recuperacao-operacional/issues/02-provar-wal-pos-corte.md), incluindo cauda parcial/timelines, cancelamento e resultados incertos.

Agenda diária, retenção por dependência, alertas e ensaios mensais, cofre/fornecedores/configuração externos permanecem nos recortes 3/4. Protótipo Q28, UI e aceite iPhone/Android continuam no M1. Este resultado conclui somente o recorte 1 local.
