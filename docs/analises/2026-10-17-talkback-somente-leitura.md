# TalkBack: atualização obrigatória e leitura local — 17–18/10/2026

Status: recorte delimitado aprovado localmente em 18/10/2026, na rodada 12, com correções e checks locais aprovados. O recorte 06 e o M1 permanecem abertos. [Plano](../../.scratch/interface-m1/leitor-somente-leitura.md).

## O que mudou

A jornada agora mostra o aviso de atualização existente quando o login encontra uma restrição persistida ou HTTP 426. Antes, os dois casos terminavam em erro genérico. Os testes reproduziram ambas as falhas antes da correção e verificam campos preservados, conta fechada invisível e ausência de transporte no bloqueio persistido. Autorização, compatibilidade e persistência não mudam.

O retorno de foco de uma revisão aninhada falhava quando seu acionador ficava na borda inferior do viewport. A captura da rodada 3 registra viewport [0,294][1080,2424], acionador [98,2187][984,2424] e densidade 2.625. Uma regressão com essas coordenadas reproduziu o resíduo de float em DIP: a rolagem voltava ao mesmo pixel e nenhuma seleção ocorria após três tentativas. O módulo agora arredonda a rolagem para fora na grade física e exige nova medida visível antes de selecionar. Preserva limite, guardas de conta/contexto e a recusa de sucesso sem deslocamento. A hipótese é compatível com a captura; não foi capturada telemetria dos floats nativos. As rodadas 4/7 confirmaram foco no acionador correto. [Regressão e fontes](../design/evidencias/2026-10-17/leitor-somente-leitura/focus-regression.json).

O módulo já oferece uma fronteira testável: o caso novo prende essa geometria ao comportamento de pixels do Android. Não foi necessário criar outra camada de foco. [PixelRatio](https://github.com/react/react-native-website/blob/main/docs/pixelratio.md), conferido também no código instalado 0.86.3.

## Resultado nativo final

A rodada 12, no AVD separado/API 35/4 GB, completou as 11 fases a 200%: leitura e 10 XP provisórios conservados sob 426, cinco campos desabilitados sem foco de entrada, gestão/retry/correção/descarte bloqueados e diagnóstico íntegro. Reinício e rede não contornaram a restrição. Cancelar saída devolveu o foco; logout ocultou a conta e login no build antigo explicou a atualização. O APK 0.1.1 foi instalado em lugar, sem reset; conta encerrada permaneceu inacessível offline. Login online compatível restaurou a conta original e convergiu um hábito/cumprimento e 10 XP no cliente independente, sem duplicação. Envelopes originais e diagnóstico recusado continuaram idênticos e os comandos voltaram a habilitar após compatibilidade.

Dois retornos foram registrados e conferidos por nó único/janela efetiva: revisão aninhada e cancelamento de saída. As capturas verificam conteúdo/seleção nativos, não áudio pronunciado. Configurações restauradas, fixture removida, APK do controle idêntico e emulador/painel próprios fechados. [Resumo nativo](../design/evidencias/2026-10-17/leitor-somente-leitura/rodada12/matrix-summary.json), [evidências](../design/evidencias/2026-10-17/leitor-somente-leitura/README.md).

## Roteiro delimitado

REQ-SYN-014/016/017, REQ-DS-003 e Q60=A; nenhum contrato/schema novo. Conta/API/Postgres, SQLite e SecureStore reais no pacote sintético isolado. Preparar uma recusa comprovada e criar/marcar outro hábito offline. Sob 426 controlado, conservar leitura, intenção original e 10 XP provisórios; bloquear marcação/gestão/correção/descarte/retry, mantendo diagnóstico/histórico consultáveis. Conferir reinício sem a falha, alternância de rede, cancelamento de saída, logout e novo login.

Substituir o mesmo pacote por build sintético 0.1.1/m1.1 via install-r, sem reset. Com a conta já encerrada, o login offline deve continuar fechado. Login online compatível deve restaurar a conta original e retomar as mesmas intenções. Cliente independente confere um hábito/cumprimento e 10 XP; comparar os envelopes originais e o diagnóstico recusado após a atualização.

O 426 é injetado na fronteira de fetch do consumidor. A política real de versão mínima do servidor é coberta pelos testes da API; não há alegação de ensaio nativo dessa configuração real ou de publicação de uma versão do produto. Não foi coletado trace dos cabeçalhos do dispositivo.

## Ambiente e isolamento

Texto 200%, TalkBack ativo, exploração/ativação físicas pela ponte SDK/JWT e observador com FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES. A observação aceita somente journeytest/readonlytest, por argumento validado antes de UiAutomation; uma verificação isolada confirma rejeição de alvo de produto. Coleção restrita às janelas interativas próprias retornadas, sem conteúdo de outros apps/IME. Janela/nó efetivos são conferidos nas seleções. Campos desabilitados podem ter capacidade isEditable=true: o teste exige enabled=false, nenhum foco de entrada/IME e comandos bloqueados, registrando a capacidade separadamente.

O Pixel_9 original/API 35/2 GB/GPU host foi preservado nas rodadas 1–4; seu APK journeytest permaneceu com SHA-256 d9c8fd34. Como recusou a instalação substituta por espaço, foi criado outro AVD, Ritmo_ReadOnly, no workspace, com o mesmo perfil visual/API 35 e 8 GiB de dados novos. Somente a configuração de hardware serviu de base; não foram copiados bancos/contas nem feito wipe. TalkBack veio da imagem instalada. O controle journeytest nesse AVD é uma instalação nova do APK preservado, não uma cópia dos bancos anteriores. Preflight instalou/substituiu os dois APKs e registrou cerca de 7 GB livres. [Preparação](../design/evidencias/2026-10-17/leitor-somente-leitura/device-preparation.json); [documentação oficial do emulador](https://developer.android.com/studio/run/emulator-commandline).

O lançador exige readonlytest previamente ausente, instala só a fixture que possui e a desinstala ao terminar, conferindo o APK do controle antes/depois. A desinstalação final inclui somente os dados descartáveis dessa fixture. Não limpa bancos/guard durante o exercício para contornar o bloqueio. Emulador/painel próprios só durante teste, encerrados inclusive em falha; processos preexistentes preservados. Hash do APK não é checksum forense do banco. O Pixel_9 original fica parado durante os ensaios no AVD separado.

## Builds e lacuna do cache

Os builds finais foram gerados em 5m08s/4m34s. Current 0.1.0:5e201d36ad9e9f7838f08e32a2546467b4af64c95225d0f025b1e23935f94743. Updated 0.1.1:42207cd9fab82871e93170283e89965c1a442e156d5e4e582984da18575695f0. Pacote dev.ritmo.readonlytest, versionCode 1, mesmo certificado de debug e assinaturas v2/v3 verificadas; não há alegação de verificação v4. Configuração nativa normal e APK d9c8fd34 restaurados no fim do builder.

A rodada 7 revelou que a versão Android havia mudado, mas os dois APKs ainda continham o mesmo bundle, sem literal 0.1.1. A CLI Expo instalada desativa o reset-cache recebido do Gradle sob CI. O construtor usa CI no prebuild e permite o reset no passo de bundle. Depois extrai o JavaScript dos APKs, exige hashes diferentes e presença da identidade0.1.1 somente no atualizado. O bundle current permaneceu 3bde000c; o atualizado passou a ea79a52f. Esse teste detectou o par antigo antes de repetir o nativo. [Metadados finais](../design/evidencias/2026-10-17/leitor-somente-leitura/builds.json). As flags mudam somente a identidade da fixture; o núcleo de compatibilidade não foi alterado.

Na primeira tentativa de build, CMake não conseguiu remover bibliotecas em cache; a causa daquele bloqueio não foi demonstrada. Depois os mesmos arquivos aceitaram abertura exclusiva, sem atributo ReadOnly, e a tarefa isolada passou em 34s. Foi corrigida também a recriação da pasta de saída após prebuild antes de restaurar o APK. Não houve remoção de cache por força, alteração de permissões ou encerramento de processo preexistente. Prebuild pode regenerar o diretório Android ignorado ao mudar o pacote. [Variantes no Expo](https://github.com/expo/expo/blob/main/docs/pages/eas/environment-variables/manage.mdx).

## Verificações e tentativas

| Verificação | Resultado |
|---|---|
| App typecheck/lint | Aprovados; tipos/lint repetidos após o último ajuste do driver |
| Núcleo/infra |184 testes aprovados |
| Componentes |47 testes aprovados; total do app231 |
| API check completo,17/10 |13m21s;93 casos,85 executados,8 Android opt-in ignorados;0 falhas/erros |
| Modularidade e operações |ModularityTests aprovado e 13 testes operacionais Python aprovados |
| Nativo final |Rodada 12 aprovada: 11 fases, 76 medições de controles e 11 campos/IME; restauração e isolamento confirmados |

| Tentativa | Resultado e diagnóstico |
|---|---|
|1 |Instalação recusada por espaço, 0 fases; perda de ADB anterior sem causa demonstrada. |
|2 |3 fases; driver esperava Offline apesar da prioridade contratada do aviso de recusa. Corrigida apenas a espera/checagem dos rádios e reverse. |
|3 |4 fases; retorno de foco errado no acionador alinhado à borda. Originou a regressão/correção de pixel. |
|4 |8 fases; retorno correto, reinício/logout/login aprovados; instalação substituta recusada por espaço. |
|5 |3 fases; último JSON longo aberto no histórico e Fechar fora do viewport, não alcançado pelo driver. |
|6 |3 fases; recolher o primeiro detalhe devolvia seu rótulo e a próxima ativação reabria a marcação. A asserção de criação capturou o erro do driver. |
|7 |9 fases; APK substituído e conta fechada offline, mas identidade JS continuava 0.1.0. Extração provou bundles iguais. |
|8 |0 fases; comando inicial do observador excedeu 30s, antes de preparar app/leitor/fonte. Causa não demonstrada; isolamento/remoção conferidos e recursos fechados. |
|9 |Mesmo timeout inicial,0 fases; configurações do leitor/fonte não alteradas, isolamento/remoção conferidos e recursos fechados. |
|10 |1 fase; chegou ao primeiro hábito, mas houve falha de localização. Captura de erro excedeu o buffer de1MiB e mascarou a causa original. Último XML pode estar defasado; não comprova o foreground na falha. Restauração/isolamento confirmados. |
|11 |0 fases; transporte ADB ficou offline no início. Fixture removida e APK de controle idêntico, mas restauração do serviço e reverse falhou e exige conferência posterior. Causa da queda não demonstrada. |
|12 |11 fases aprovadas com o bundle atualizado correto; 76 controles/11 campos-IME, restauração e isolamento confirmados. |

O histórico só expande um detalhe por vez. O driver final preserva essa exclusividade ao escolher o próximo botão e recolhe o último detalhe antes de fechar. Capturas/comparações próprias de marcação e criação mantêm as verificações de identidade. As tentativas parciais conservam passed=false, restauração e isolamento registrados; nenhuma foi promovida a aceite integral. Os pares antigos e seus hashes estão separados dos builds finais.

Em 18/10, a recusa de alvo foi isolada sem a API e respondeu em 2,29s com observer_error=synthetic_target_required, no mesmo APK 74c29b95. Isso refuta falha determinística da recusa, mas não prova a causa dos timeouts sob o cenário completo. A verificação fica separada do roteiro funcional, cuja repetição inicial foi removida sem mudar o observador, a lista de alvos ou as exigências de seleção nativa. O wrapper de diagnóstico abortou após a resposta correta porque pidof retornou vazio e houve Trim em null; só o primeiro alvo foi exercitado. A limpeza fechou o emulador, sem leitor/fonte/app preparados. [Prova separada](../design/evidencias/2026-10-17/leitor-somente-leitura/observer-target-validation.json).


A coleta final permite PNG de até 16 MiB (a resolução de 1080×2424 comporta cerca de 10 MiB de pixels sem compressão), preserva o erro de localização se a captura falhar e recusa promover o último XML a captura atual quando o observador não devolve hierarquia. Registra apenas presença do processo de teste e identificadores de janela em falha, sem conteúdo de outros aplicativos. Não há mudança do produto ou relaxamento das verificações de foco/conteúdo.


A restauração complementar da rodada 11 foi conferida em boot próprio: valores do leitor/fonte iguais aos salvos, reverse próprio ausente e pacotes temporários ausentes. O registro original de limpeza incompleta foi preservado, com [suplemento de recuperação](../design/evidencias/2026-10-17/leitor-somente-leitura/rodada11/post-failure-restoration.json). Com cerca de 11 GB de RAM disponíveis no host após encerrar os recursos próprios, a rodada 12 usa o perfil de 4 GB de RAM do emulador, mesmo AVD/API/densidade/GPU. Não é prova da causa das quedas anteriores nem aceite de estabilidade/performance no perfil de 2 GB. Nenhum processo preexistente foi encerrado.

## Reproduzir e continuar

Com Java 21, SDK Android, Node/dependências, Docker e controle journeytest preparados; da raiz:

```powershell
.\scripts\build-reader-observer.ps1
.\scripts\build-android-readonly.ps1
$env:ANDROID_AVD_HOME = Join-Path $PWD '.scratch/runtime/interface/readonly-avds'
.\scripts\verify-android-accessibility.ps1 -ReadOnly -Avd Ritmo_ReadOnly -GpuMode host -MemoryMegabytes 4096 -EvidenceDirectory '.scratch/runtime/interface/leitor-readonly-reexecucao'
```

O AVD é local/ignorado; noutra máquina, criar um AVD de teste com espaço suficiente e instalar primeiro o APK normal. ReadOnly implica Matrix e não combina com Recovery/Traversal/SyncStates/SkipInstall. Não reutiliza emulador ou pacote de ensaio preexistente. [Comandos e limites](../../app/README.md).

Fora do aceite: atualização offline com conta ainda ativa, retry esgotado, interrupção de cópia com staging não zero, demais estados integrais, leitura falada/edição por caractere/cursor, desempenho, novas paletas integrais e iPhone/VoiceOver Q55=B. Teclas de hardware inserem texto sintético; não comprovam edição falada. Os tempos do driver/build não medem abertura/cards/feedback. Próximo recorte recomendado: retry esgotado e retomada manual com leitor; depois, interrupção com staging não zero. 06/M1 permanecem abertos.
