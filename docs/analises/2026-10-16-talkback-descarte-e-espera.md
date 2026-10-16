# TalkBack: descarte por item, espera remota e cópia inicial — 16/10/2026

Incremento delimitado de 06/M1: REQ-SYN-005/016/017, REQ-DS-003, spec/13 e Q60=A. Concluído localmente: nativo aprovado na rodada4 e checks finais aprovados. 06/M1 continuam abertos.

## Resultado nativo

A [rodada4](../design/evidencias/2026-10-16/leitor-descarte-espera/rodada4/matrix-summary.json) passou nove fases com TalkBack ativo, texto 200%, 79 medições de controles e 12 de campo/IME. São observações repetidas durante a jornada, não 79 controles únicos. O teste Node levou 12m05s; a execução Gradle, 12m25s. Esses tempos incluem o driver e as esperas contratadas, sem medir desempenho do produto.

| Situação | Resultado observado |
|---|---|
| Propor descarte e cancelar | Intenção e diagnóstico iguais após reinício; reabrir exige confirmação nova. |
| Descartar o pai | Somente o pai é resolvido; dependente permanece com a mesma identidade/referência após reinício. Acionador removido retorna ao título do painel, conforme Q60. |
| Descartar a dependente | Outra confirmação explícita; histórico conserva as duas intenções originais, verificadas por ID e conteúdo. |
| Estado remoto | Cliente independente confirma um hábito canônico criado por outro aparelho, sem cumprimento ou XP; nenhum desfazer implícito. |
| Push recusado com 429/503 | Intenção criada offline preservada; botão de retry indisponível não encurta o prazo. Reabertura sem a falha conserva a espera; após o prazo, um hábito confirmado e XP zero no cliente independente. |
| Cópia inicial interrompida | Ajuda, progresso e erro selecionáveis pelo leitor; reinício mantém o bloqueio da jornada, sem abas ou dados da primeira conta. Falha antes da primeira página, com zero itens recebidos. |
| Cópia completa e troca de conta | Segunda conta liberada somente com a cópia completa; volta à primeira conserva seus hábitos, sem dados cruzados. |

A dependente deste roteiro já possuía recusa comprovada `dependency_rejected`, com uma referência ao pai. Isso não aceita todos os estados de bloqueio exclusivamente local de uma cadeia.

Nos dois casos de espera, os textos de prazo antes/depois da reabertura foram idênticos. O driver admite até 1s pela precisão da apresentação; testes do núcleo verificam o prazo persistido exato. Cliente independente confirmou que não havia o hábito correspondente antes do prazo e que o resultado posterior apareceu uma vez. Isso não prova ausência de toda requisição HTTP repetida: a garantia observada é o resultado sem duplicação.

Fonte, leitor, permissões e rede foram restaurados; fixture e reverse encerrados. Observador temporário removido e emulador/painel próprios fechados. A [conferência posterior](../design/evidencias/2026-10-16/leitor-descarte-espera/host-cleanup.json) encontrou zero dispositivos ADB, QEMU ou painel do ensaio. Instalação, dados e processos preexistentes preservados, sem wipe.

## Build e alterações

APK `dev.ritmo.journeytest`/x86_64, SHA-256 `d9c8fd344fccdefbc95935d568253d65fe46e3b68c2e2eef5705addd30412353`, gerado/assinado em 2m39s e instalado com atualização incremental. Somente harness, testes, lançador e documentação mudaram; `app/src`, API de produção, contratos HTTP e schema permanecem iguais. Nenhuma evidência do APK anterior `7430a6f8` é promovida ao novo hash.

As fixtures `sync-push-429`/`sync-push-503` interceptam somente o push na fronteira de fetch; pull e API/PostgreSQL saudáveis continuam reais. A sincronização faz pull antes de `beginAttempt`. A fixture genérica que recusava todas as rotas, portanto, não exercitava espera durável de push. Spec/06 §3.1 mantém contadores de pull sem push por execução; esse contrato não foi alterado para satisfazer a asserção. Quotas elevadas da fixture não aceitam limites de produção, e uma recusa controlada não comprova indisponibilidade física do serviço.

O driver recalcula o nó e suas coordenadas antes de cada tentativa de exploração, pois retry pode mudar estado/layout. Continua exigindo um único nó efetivamente selecionado e a mesma janela focada. As ações exigem pelo menos 44 unidades lógicas, com arredondamento de pixels documentado; textos informativos exigem visibilidade. O observador consulta todas as janelas interativas próprias retornadas, com `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES`, sem conteúdo de outros aplicativos/IME. Android pode omitir o fundo bloqueado por um modal; não se alega inspeção de janelas ocultas.

## Tentativas e diagnóstico

- Rodada1 parou na preparação por ADB offline, antes de ativar TalkBack. Nenhuma fase funcional aceita. A restauração falhou por falta de transporte; uma recuperação visível separada conservou a instalação/dados e restabeleceu a baseline. A primeira checagem do helper tratava pacote ausente como erro; corrigida para aceitar ausência. Fonte 1.0/leitor desativado foram conferidos, rede reabilitada e baseline confirmada na rodada seguinte. Causa da desconexão não demonstrada.
- Rodada2 completou cinco fases de cadastro/leitor/descarte e restaurou configurações, mas a recusa genérica 429 atingiu o pull antes do push. A expectativa de espera durável não se aplicava àquela falha. Criadas fixtures de push e novo APK de teste, sem mudança do produto.
- Rodada3 passou sete fases no APK novo, incluindo as duas esperas após reinício. Parou ao explorar o erro de cópia inicial: o driver reutilizava coordenadas enquanto retry/layout mudavam. Recalcular o alvo a cada tentativa passou no diagnóstico isolado `probe-copy` e depois no roteiro completo.
- `probe-copy` passou quatro fases de cadastro/cópia/isolamento e restauração, com `scenarioPassed=true`, mas conserva `passed=false`/`fullAcceptance=false`. O filtro temporário foi removido antes da rodada4; não existe modo parcial no teste final.
- Rodada4 passou as nove fases e restaurou o ambiente. Os resultados reprovados/parciais permanecem separados, sem substituir seus metadados por aprovação de outra execução.

[Evidências, diagnósticos e manifesto](../design/evidencias/2026-10-16/leitor-descarte-espera/README.md).

## Verificações e limites

Tipos/lint e 228 testes do app passaram: 183 de núcleo/infraestrutura e 45 componentes. O caso novo confirma que fechar a proposta de descarte preserva a operação original e exige confirmação nova ao reabrir. AST do lançador PowerShell sem erros; combinação de modos incompatíveis recusada antes de iniciar recursos. Check completo da API aprovado em 10m43s: 93 casos/85 executados/oito nativos opt-in ignorados, zero falhas/erros, 13 verificações operacionais e modularidade aprovadas. A matriz nativa de nove fases passou separadamente; os testes optativos ignorados não constituem sua evidência.

Pixel_9/Android 15/API35, GPU host/2GB, texto 200% após preparação inicial a 100%, TalkBack continuamente ativo, toque físico por SDK/gRPC com JWT obrigatório. Serviço Bound ou espera de timer não são prova de seleção: o roteiro exige o nó/janela nativos. Texto sintético entra por teclas de hardware, sem aceitar edição falada por caractere/cursor.

Não há aceite TalkBack novo de atualização obrigatória, retry esgotado, interrupção com staging não zero, demais estados, desempenho, novas paletas ou iPhone/VoiceOver (Q55=B). A cópia exercitada tem uma página; não aceita todas as interrupções de snapshot paginado. O bloqueio de versão é persistente e não será limpo manualmente para facilitar o ensaio. Próximo recorte recomendado: fixture isolada para somente leitura/atualização obrigatória com TalkBack, seguida das coberturas restantes. Domínio/Resend/links públicos e gates operacionais continuam nas tarefas próprias.

## Reprodução

Da raiz, com Java21, SDK Android, Node24/dependências e Docker preparados:

```powershell
.\scripts\verify-android-accessibility.ps1 -SyncStates -GpuMode host -MemoryMegabytes 2048 -EvidenceDirectory '.scratch/runtime/interface/leitor-sync-estados-reexecucao'
```

Exige APK com as fixtures de push específicas e observador compilado (`scripts/build-reader-observer.ps1`). `-SyncStates` implica `-Matrix`, incompatível com Recovery/Traversal/modo de observação. O lançador prepara API/Postgres antes do emulador/painel visíveis, verifica o hash instalado e fecha somente recursos próprios. `-SkipInstall` exige igualdade do hash local/instalado. [Plano e diagnósticos](../../.scratch/interface-m1/leitor-descarte-e-espera.md).
