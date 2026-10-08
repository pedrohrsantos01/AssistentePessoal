# Aceite restante do M1 — estado e próximo recorte

Data: 08/10/2026. Fonte de código para a prova técnica: `c5e7b51`. Origem: continuação autorizada, [tarefa 05](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md) e [plano de aceite](../../.scratch/aceite-m1/spec.md). Consolidação de evidências/pendências; não encerra M1 nem acrescenta funcionalidades.

## Conclusão da conferência

O núcleo local recebeu os três recortes de exceções; o pacote operacional 4B tem suas seis integrações verificadas localmente. Faltam interface aprovada, recuperação por e-mail/link real, aceite iPhone/Android e instalação/provas operacionais externas. A evidência Android de 30/09 usava APK anterior aos incrementos recentes; o APK foi reconstruído e o cenário nativo existente e os checks integrais passaram neste recorte, após investigação e repetição de um timeout WAL.

Grilling foi aplicada para separar fatos verificáveis de decisões. A inspeção de aparelhos e operação foi delegada a dois agentes, conforme a skill; nenhuma configuração remota foi alterada. Fontes atuais prevalecem sobre memória histórica.

## Decisões da rodada

- **Q54:** não há domínio disponível; Pedro escolherá o nome e pediu instruções para configurá-lo. [Guia manual entregue](../../api/ops/domain-and-email-setup.md). Provedor/plano da conta e gratuidade não inspecionados.
- **Q55=B:** rota iOS adiada. iPhone 16e continua exigido para M1; não pressupor contratação Apple, Mac disponível ou dispensa dos Universal Links.
- **Q28/Q47:** protótipo em preparação e orçamento/fornecedores adiados; manter tarefas existentes.

Nomes de domínio/remetente/subdomínios e identidades finais do app continuam pendentes. Exemplos do guia são sugestões, não decisões aceitas.

## Matriz de gates

| Frente | Evidência disponível | Falta para aceite |
|---|---|---|
| Conta, sync, hábito binário e XP | HTTP/PostgreSQL/SQLite; concorrência, snapshots, datas/fusos, tombstones, retenção e isolamento nos relatórios da tarefa 05 | Integração visual e comportamento conjunto nos aparelhos |
| Exceções Q51–Q53 | Núcleo local e [cinco casos Android](2026-10-08-excecoes-e-isolamento-android.md) aprovados: cofre, abertura/rollback, colisões de operação/sequência e isolamento A/B/A | Estados na UI, falhas físicas não simuladas e aceite conjunto dos aparelhos; reparo físico pertence a recorte próprio |
| Android técnico | APK reconstruído, cenário original e nova bateria de exceções/isolamento aprovados com checks integrais; [relatório atual](2026-10-08-excecoes-e-isolamento-android.md) | Interface/links, falhas físicas ainda sem prova e aceite iPhone/Android; segundo cliente continua desktop |
| iPhone/distribuição | Alvo iPhone 16e; Apple Developer inativo informado | Rota adiada Q55=B, build próprio/instalação e Universal Links reais |
| Recuperação por e-mail | Contratos HTTP/parser e SMTP local testados; Resend existente | Domínio/remetente/quota, DNS, SMTP real, recebimento e abertura por OS no build próprio |
| Interface/Q28 | Brief/prompt enviados para Claude Design; tarefa visual existente | Protótipo entregue, tokens/fluxos/estados/acessibilidade e integração vertical |
| Operação 4A | Q44: Hostinger/Campinas, 2 vCPU/8 GB/100 GB, Ubuntu 24.04/Coolify 4.3.23; perfil A, Bitwarden Free, Resend | Capacidade útil, B/C independentes, rede/segredos, canal SMTP alternativo, Git/registry e orçamento final |
| Operação 4B | Imagem API, supervisor WAL/freeze, agenda Linux, transporte/watchdog, proxy/TLS e telemetria primária verificados localmente | Instalação e ensaios reais não são substituídos pelo pacote |
| Operação 4C/4D | Caderno, ordem de ativação e 12 gates documentados | Instalação isolada, entrega de alertas, capacidade/latência/WAL, PITR/janela real, perda do primário de ensaio e RTO <=24h |

A matriz detalhada M1-01 a M1-20 permanece em [spec/13 §9](../../specs/13-contrato-primeiro-marco.md#9-cenários-de-aceite-do-contrato); os relatórios técnicos não autorizam marcar todos os casos como aprovados nos aparelhos.

## Ordem executável

1. Renovar o cenário Android existente com fontes atuais e checks completos, sem UI nova.
2. Pedro escolhe/configura domínio e retorna ficha pública; confirmar origem/remetente e identidade Android na próxima rodada.
3. Com definições confirmadas e protótipo disponível, implementar recuperação nativa Android pela tarefa nova. A integração visual continua na tarefa 03 original.
4. Retomar 4A/4C/4D na tarefa operacional existente quando Pedro definir os recursos; ensaio de perda usa ambiente descartável, nunca sua VPS pessoal.
5. Quando Pedro retomar iOS, fechar sua rota/identificadores e instalar no iPhone; concluir matriz e convergência com Android.

R2 permanece cópia auxiliar candidata; não substitui o WAL síncrono de Q33/Q35. A definição comercial continua adiada, sem nova rodada de orçamento agora.

## Rota iOS — limite técnico verificado

O perfil gratuito Personal Team pode permitir instalação local via Mac/Xcode, mas não oferece Associated Domains; portanto não cobre os Universal Links exigidos. EAS pode construir iOS a partir de Windows; instalação física pelo caminho EAS requer Apple Developer e preparação do dispositivo. Q55=B adia essa rota e mantém o gate aberto. [Capacidades Apple](https://developer.apple.com/help/account/reference/supported-capabilities-ios/), [conta/Personal Team](https://developer.apple.com/help/account/basics/about-your-developer-account), [builds Expo](https://docs.expo.dev/develop/development-builds/introduction/?buildenv=build-with-eas).

## Verificação deste incremento

Execução: `scripts/verify-android-http.ps1 -Serial emulator-5560`, seguida de diagnóstico WAL isolado e repetição integral de `api/gradlew.bat -p api check bootJar --no-daemon`, sem filtro e com mesmo APK/caso Android habilitado. Pixel_9/Android 15/API 35/x86_64, Java 21, SDK `H:/Android/Sdk`. Fontes de código: `c5e7b51`; somente documentos alterados neste incremento.

| Verificação | Resultado final |
|---|---|
| App typecheck/lint | Aprovados, sem advertências desses checks |
| App test | 121 aprovados, zero falhas/ignorados |
| Android prebuild/assembleRelease/instalação | Aprovados; compilação em 4m47s; pacote isolado `dev.ritmo.httpharness` |
| API check/bootJar integral com Android habilitado | Aprovado em 12m11s; 86 testes Java em 14 classes, zero falhas/erros/ignorados; suíte reexecutada, JAR UP-TO-DATE na rodada final |
| OperationsTest | 13 aprovados; reexecutados na rodada final |
| Caso Android nativo | Aprovado nas duas rodadas integrais; 17,3s no caso final, 18,2s no runner |
| Limpeza nativa | Wi-Fi/dados 1/1 restaurados; nenhum reverse restante; somente emulador iniciado nesta sessão encerrado |

APK exercitado: 28.855.360 bytes; SHA-256 `84990b21233e0afee53d2bf042dcee13428aa0a85c03726696be56b0c5f5393d`. Build usa assinatura de debug para o ensaio, sem identidade de distribuição final.

Fases comprovadas: prepared → offline → restored → background → background_online → converged → verified. Envelopes/projeção/credenciais preservados; 2 pendências/10 XP durante offline/segundo plano e 0/10 após sync/replays/refresh. Segundo cliente SQLite de desktop, não iPhone. Não há prova nativa de perda real de ack, Doze, disco cheio, corrupção física/retry ou indisponibilidade real do SecureStore. Os avisos Expo/template Gradle e NO_COLOR/FORCE_COLOR continuam no build; nenhuma dependência mudou.

A primeira rodada integral teve 86 casos, 85 aprovados e um timeout de 15s em WalRecoveryTests: espera por pausa do replay/LSN após iniciar PostgreSQL restaurado (linha 283), com TimeoutException dentro da condição. Caso nativo e operações passaram nessa rodada. O ensaio WAL isolado passou sem alteração de código/limites em 2m07s; a repetição integral depois passou completamente. A causa do timeout não foi comprovada; uma recorrência exige investigação específica, sem atribuir ao produto/fixture nem ampliar limites por inferência.

Logs locais ignorados: `.scratch/runtime/2026-10-08-acceptance-android.log`, `2026-10-08-acceptance-wal-diagnosis.log` e `2026-10-08-acceptance-api-final.log`; fases nativas em `api/build/android-http-integration.log`, contagens JUnit em `api/build/test-results/test/`. Build gerado não versionado.

## Ajustes documentais e limites

As tarefas novas usam os rótulos canônicos com conclusão separada. O rótulo inválido `completed` da tarefa anterior de abertura local foi normalizado, preservando seu resultado concluído. Instruções atuais do caderno operacional e tabela Coolify foram alinhadas à conclusão local de 4B; comentários históricos permanecem.

Não houve mudança de código, schema, dependências, UI, conta/DNS/SMTP remoto, fornecedor, contratação ou implantação. Consolidação e renovação Android são evidência técnica; M1/tarefa 05, gates externos e Fase 1 continuam abertos.


## Continuação: exceções e isolamento nativos — 08/10/2026

Pedro autorizou testar os quatro itens independentes de Q54. [Recorte Android concluído](../../.scratch/aceite-android-excecoes/spec.md): cinco casos novos aprovados, cenário original reexecutado, app 121/typecheck/lint, API 87 Java/zero ignorados e 13 operacionais aprovados. Falha inicial em dois asserts de recibo foi diagnosticada como comparação da ordem das propriedades JSON e corrigida apenas no harness; todas as propriedades/valores continuam conferidos. [Build, fases, resultados e limites](2026-10-08-excecoes-e-isolamento-android.md).

A verificação anterior deste documento permanece histórica, com seu APK/86 Java e timeout WAL próprio. A nova bateria usa outro APK e adiciona um método Java com cinco casos Node; não substitui o aceite da UI, dos links, iPhone ou operação externa. Emulador/painel visíveis nos ensaios e encerrados após seus testes. Nenhum domínio, recurso remoto ou contratação foi definido.
