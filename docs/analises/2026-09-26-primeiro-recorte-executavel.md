# Primeiro recorte executável — evidências

Início da implementação: **25/09/2026, 18:22, America/Sao_Paulo**. Revisão de quatro semanas: **23/10/2026**. A implementação deste recorte atravessou 25–26/09; entrevista e preparação documental não foram contadas como implementação.

## Resultado verificado

A API e dois repositórios SQLite executaram conta → criar hábito → marcar offline → sincronizar → consultar 10 XP. Há código em [app](../../app/README.md) e [api](../../api/README.md), migrations e lockfiles. O protótipo visual permanece aberto. Este resultado não é o aceite completo do M1.

| Prova | Interface e resultado |
|---|---|
| Persistência offline | Repositório público, arquivo SQLite/Drizzle fechado e reaberto: hábito, pendências e XP provisório preservados |
| Confirmação perdida | Recibo reconhecido antes de reaplicar pendências; edição posterior do outro cliente preservada |
| Revisões | Ack antigo não substitui entidade mais nova; ack não avança cursor |
| Rollback local | Falha durante aplicação da página conserva cursor, fila e projeção anterior; falha de escrita da projeção reverte intenção e sequência alocada |
| Duas bases locais + rede real | Dois arquivos SQLite, HTTP real e Postgres: convergência, dupla marcação, desfazer/remarcar e confirmação perdida |
| Falha obrigatória de XP | Trigger somente no banco descartável provoca erro; snapshot continua na revisão anterior, sem fato/XP/recibo parcial; retry aceita uma vez |
| Isolamento | Role de domínio sem superusuário/BYPASSRLS; sem contexto não lê perfis; contexto A não lê B; WITH CHECK recusa dono B; Identity não lê hábitos; domínio não lê hash de senha |
| Referência entre contas | API rejeita hábito de B para A; FK composta recusa associação cruzada |
| Retry e dependências | Envelope alterado não substitui recibo; criação rejeitada propaga rejeição à operação dependente |
| Fronteiras | `ApplicationModules.verify()` aprovado |

Os testes seguem as interfaces reais acordadas na tarefa 04. A injeção de falha e as consultas SQL diretas são restritas aos testes de transação/permissões previstos nesse aceite. Não há mock dos serviços de negócio.

## Execuções e versões

- `pnpm typecheck`, `pnpm lint`, `pnpm test`: aprovados; cinco testes locais.
- `api/gradlew.bat check --warning-mode all --no-daemon`: aprovado; nove testes Java, incluindo o teste que inicia um cenário integrado TypeScript com dois clientes. Última execução registrada antes do teste nativo: 26/09/2026, 00:30.
- Node 24.13.0, pnpm 10.32.1; versões diretas e transitivas fixadas em `app/pnpm-lock.yaml` e `api/gradle.lockfile`.
- Java JBR 21.0.8, wrapper API 8.14.4, Boot 4.1.1, Modulith 2.1.1. `bootJar --write-locks` aprovado; JAR executável e lock da configuração de runtime gerados.
- Postgres **18.6**, imagem fixada por `sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722`. Flyway aplicou V1/V2 em banco novo.
- Build Android: **aprovado**, Expo 57.0.25 / RN 0.86.3, Java 21, Gradle nativo 9.3.1, SDK/build tools 36, NDK 27.1.12297006, ABI x86_64. APK técnico de 28.435.500 bytes.
- O primeiro build nativo falhou por caminhos longos do CMake/Ninja no Windows. `node-linker=hoisted` e regeneração de `android/` resolveram; versões de dependências preservadas. Persistem avisos de depreciação nas dependências/plugins nativos; o build da API foi corrigido e passou sem avisos próprios.
- Execução nativa **aprovada** no AVD Pixel 9, Android 15/API 35: primeira execução criou hábito e marcação offline; depois de `am force-stop` e nova abertura, `restarting=true`, hábito feito, duas pendências e 10 XP provisórios. Isso valida persistência do adapter Expo; rede Android ↔ API ainda está na tarefa 05.
- iPhone 16e: nenhum build instalado/testado; assinatura Apple Developer ou alternativa com Mac continua pendente.

Comando reproduzível no Windows, com Docker disponível:

```powershell
.\scripts\verify-foundation.ps1 -JavaHome 'C:\Program Files\Android\Android Studio\jbr'
```

O diretório não tem histórico Git inicializado; nenhum commit, push ou publicação foi feito. Nenhum serviço da VPS foi usado. Os containers de integração são descartáveis, com credenciais fictícias próprias.

## Alcance e continuação

São sete das onze rotas do OpenAPI: cadastro/login e cinco rotas de Sync. Renovação, revogação e reset de senha ainda não foram implementados. O núcleo local recebe uma conta já autenticada; ainda não comprova SecureStore, troca segura de sessão ou logout offline. O transporte executa sync explicitamente; ainda falta o scheduler/backoff e a recuperação completa de rejeições.

M1-01 a M1-20 **não estão integralmente concluídos**. Paginação extensa, corte H sob alterações concorrentes, expiração/migração interrompida, ordens concorrentes adicionais, política operacional de retenção, sessão e demais limites continuam na [tarefa 05](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md). Os testes no desktop não substituem a convergência final iPhone/Android.

Nenhuma interface de Briefing, identidade visual, Agenda, IA ou notificações foi criada. A próxima implementação deve completar sessão/recuperação; o visual depende da tarefa 03 e do protótipo do Pedro.

## Evidência nativa preservada

APK: `app/android/app/build/outputs/apk/release/app-release.apk`, SHA-256 `5b77a05cf5694524dbeb2cbba64694cad3382f90e4a8e362be6d24ab62c54b05`. Artefato gerado localmente e ignorado no controle de versão.

Resultados do log de 26/09/2026:

```json
{"passed":true,"restarting":false,"view":{"habits":[{"habitId":"01996300-0000-7000-8000-000000999003","title":"Teste SQLite","done":true}],"totalXp":10,"pendingCount":2,"rejectedCount":0}}
{"passed":true,"restarting":true,"view":{"habits":[{"habitId":"01996300-0000-7000-8000-000000999003","title":"Teste SQLite","done":true}],"totalXp":10,"pendingCount":2,"rejectedCount":0}}
```

O emulador iniciado para o teste foi encerrado após a coleta. Houve uma falha temporária da revisão automática de permissões por limite de uso; a verificação foi retomada com aprovação normal após o horário de renovação. Não ficou bloqueio de permissão pendente.

Verificação final documental: 42 arquivos Markdown, nenhum link local ausente e nenhuma ocorrência de codificação corrompida detectada.
