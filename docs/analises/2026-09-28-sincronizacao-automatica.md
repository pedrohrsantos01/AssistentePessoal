# Sincronização automática — evidências de 28/09/2026

## Resultado e escopo

Incremento autorizado da [tarefa 05](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md): núcleo de REQ-SYN-005/008 e retomada das revogações de logout. O app passa a ter scheduler com espera progressiva, persistência das tentativas de push e composição com ciclo de vida/conectividade Expo. A tarefa 05 e o M1 completo permanecem abertos.

Não houve mudança de protocolo, DDL, regra de hábito/XP ou backend de produção. O schema SQLite existente já contém estados, tentativas, prazo e erro necessários. Código, testes, lockfile e documentação pertencem à mesma intenção de entrega.

## Comportamento entregue

- Abertura/login, retorno ao primeiro plano, recuperação de conectividade e intervalo de cinco minutos acionam sync. Gatilhos simultâneos não iniciam dois ciclos do scheduler. Offline ou fora do primeiro plano, novos envios/timers pausam; uma resposta já enviada pode concluir.
- Falhas transitórias de rede, timeout e HTTP 408/429/5xx usam 1s, 2s, 4s até cinco minutos. Retry-After em segundos/data HTTP é espera mínima, mesmo acima desse teto e em respostas sem JSON. Novos gatilhos não encurtam o prazo.
- Dez falhas expõem `failed`, sem apagar intenção nem projeção. A ação explícita `retry()` retoma as falhas transitórias esgotadas com o mesmo ID/conteúdo; não corrige rejeições definitivas nem contorna autenticação/atualização.
- Antes do push, o SQLite persiste tentativa e prazo. Reinício no meio do envio, espera pendente e limite atingido mantêm a identidade e o estado recuperável. `blocked_local` com `retry_exhausted` representa o `failed` público; detalhes em [spec/00 §12.3](../../specs/00-modelo-de-dados.md).
- Operação dependente não ultrapassa a espera de uma operação local anterior da qual depende. Respostas `deferred` também têm espera/limite, sem perder conteúdo.
- Troca de conta invalida resultados de gerações antigas. Revogações têm estado/espera independente do sync de domínio e retomam mesmo sem conta ativa, preservando a capacidade da sessão atual.
- HTTP 401/426 e erros não transitórios suspendem tentativas automáticas, mantendo dados. O núcleo expõe `authentication_required`, `update_required` ou `blocked`; a UI correspondente ainda não existe.
- `openExpoRuntime(origin)` compõe sessão, HTTP, armazenamento protegido e scheduler. A composição usa AppState e expo-network 57.0.2; o encerramento remove listeners/timers. Consultas antigas de conectividade não sobrescrevem eventos/consultas mais recentes.

## Validação executada

| Verificação | Resultado |
|---|---|
| `pnpm typecheck` e `pnpm lint`, em `app/` | Aprovados |
| `pnpm test`, em `app/` | 34 testes, zero falhas; 19 novos casos de scheduler/lifecycle |
| `api/gradlew.bat -p api check bootJar --no-daemon` | Aprovado; 24 testes Java, incluindo modularidade e cenários HTTP/Postgres |
| Integrações TypeScript iniciadas pelo Gradle | Quatro cenários aprovados: sync, sessão, recuperação de senha e scheduler |
| Bundle Android da composição `open-expo-runtime.ts` | Aprovado, 754 módulos; sem execução de APK neste incremento |

Os testes novos usam sessão pública e SQLite real. Relógio, conectividade, ciclo de vida, transporte e cofre são fronteiras externas controladas. O teste integrado usa API/Identity HTTP e PostgreSQL reais: cria e marca offline, reinicia, perde a resposta após commit do servidor, avança o relógio do retry e verifica convergência em um segundo SQLite com um cumprimento e 10 XP. Depois verifica revogação ao reconectar após logout offline.

Arquivos de evidência executável: [scheduler](../../app/test/scheduler.test.ts), [lifecycle](../../app/test/sync-lifecycle.test.ts), [integração](../../app/test/integration/scheduler.test.ts) e [entrada Gradle](../../api/src/test/java/dev/ritmo/RuntimeTests.java). Testes de regressão revelaram e verificaram duas correções: restaurar o prazo antes de qualquer requisição após reinício e descartar consultas antigas de rede.

Logs e bundle locais ficam em `.scratch/runtime/`, ignorados pelo Git: `scheduler-api-final-check.log`, `scheduler-native-bundle.log` e `scheduler-runtime.android.bundle`. Relatórios Java ficam em `api/build/test-results/test/`; a integração nova escreve `api/build/mobile-scheduler.log`. Nenhum desses artefatos substitui os testes versionados.

## Reprodução no Windows

Executar os três checks do README do app. Para o Gradle, Java 21 e Docker devem estar disponíveis. Nesta máquina, `JAVA_HOME` aponta para `C:/Program Files/Android/Android Studio/jbr`; a execução usou `DOCKER_CONFIG` em um diretório temporário vazio para os containers descartáveis de teste. Não usar credenciais de ambientes reais.

Empacotar a composição nativa, a partir de `app/`, usando a CLI local:

```powershell
node node_modules/expo/bin/cli export:embed --entry-file src/core/identity/open-expo-runtime.ts --platform android --dev false --max-workers 2 --bundle-output ../.scratch/runtime/scheduler-runtime.android.bundle
```

A pasta de destino deve existir. A CLI global antiga presente na máquina não aceita esse comando; a validação usou explicitamente a versão do projeto. A dependência nova está fixada no manifest/lockfile e corresponde ao mapeamento nativo instalado do Expo 57.0.25. O bundle emitiu apenas o aviso de ambiente sobre NO_COLOR/FORCE_COLOR; sem erro de compilação.

## Limites e próximo incremento

1. O harness Android padrão mantém suas credenciais/transporte fictícios e ainda não chama `openExpoRuntime`. O bundle valida resolução/compilação dos adapters, não HTTP nativo, persistência do sistema operacional ou execução em aparelho. Não houve novo APK nem teste iPhone/Android neste incremento.
2. Esperas/contadores de push são duráveis. Para falhas de pull sem push e de revogações, os contadores são por execução e reiniciam ao reabrir o runtime; intenções e capacidades permanecem duráveis. Não há serviço de sincronização em segundo plano.
3. O estado e a ação de retry são interfaces do núcleo. Avisos, correção/descarte de rejeições e modo visual de atualização obrigatória dependem da UI. Um estado `update_required` interrompe sync, mas ainda não implementa o bloqueio completo de escrita local exigido por REQ-SYN-014.
4. Próximo incremento: recuperar rejeições definitivas e corrigir com novos IDs/cadeias, cobrindo dependências rejeitadas/cíclicas e limite de contexto. Retry de falha transitória não substitui essa correção. Permanecem testes ampliados de snapshot, paginação, migrations e demais casos da matriz M1.
5. Rate limiting, domínio/SMTP, segredos de operação, backup/restore e deploy continuam necessários antes da exposição externa. Protótipo de Pedro e rota de instalação iOS continuam pendentes.

## Referências técnicas consultadas

- [Expo Network](https://docs.expo.dev/versions/latest/sdk/network/): consulta e assinatura de conectividade. Compatibilidade SDK 57 conferida também em `expo/bundledNativeModules.json` e tipos instalados.
- [React Native AppState](https://reactnative.dev/docs/appstate): estado atual, mudanças de ciclo de vida e remoção da assinatura.
- [Contrato M1](../../specs/13-contrato-primeiro-marco.md), [sincronização](../../specs/06-sincronizacao.md) e [contratos executáveis](../../contracts/primeiro-marco/README.md): fontes locais do comportamento aprovado.
