# TalkBack — retentativas esgotadas e retomada manual — 18/10/2026

Status: recorte delimitado aprovado localmente na rodada 3. 06/M1 permanecem abertos. [Plano](../../.scratch/interface-m1/leitor-retentativas-esgotadas.md), [evidências](../design/evidencias/2026-10-18/leitor-retentativas-esgotadas/README.md).

## Correção entregue

A décima falha de push apagava Retry-After e permitia envio manual antes do prazo. A regressão reproduziu 11 pushes em vez de 10; o componente também reprovou com a jornada anterior porque o botão ficava habilitado. Os dois sinais ficaram verdes com a correção. REQ-SYN-005/008/016/017, REQ-DS-003 e Q60 continuam usando o contrato existente.

O SQLite conserva o mínimo do servidor em next_attempt_at mesmo no estado blocked_local/retry_exhausted. O scheduler protege a ação; o reset só alcança intenções elegíveis. A jornada usa seu relógio existente para habilitar a ação quando o prazo vence, mantendo failed e exigindo ação explícita. Sem Retry-After não acrescenta outro backoff ao trabalho esgotado. Sem coluna/migration/protocolo/dependência novos; spec/00 §12.3 explicita a garantia já exigida por spec/06 §3.1.

## Resultado nativo

Rodada 3, APK b3731eff, AVD separado/API 35/4 GB/GPU host, TalkBack e texto 200%: seis fases aprovadas, 40 medições de controles, seis de campos/IME, cinco retornos ao acionador. Alvos usam 44 unidades com piso no arredondamento para pixels, conforme os roteiros anteriores.

Conta/onboarding reais, criação e marcação dependente offline preservaram dois envelopes e 10 XP provisórios. Nove prazos foram observados com relógio/backoff reais: as diferenças entre prazos foram 60, 60, 61, 60, 60, 65, 128 e 256 segundos. O primeiro piso do servidor é 60s; a espera mínima teórica entre primeira e décima tentativa é 808s. Jitter/precisão de exibição explicam os segundos adicionais; não é medição de desempenho.

A décima falha mostrou failed com prazo mínimo ainda ativo e botão desabilitado. Reinício sem a falha injetada conservou o mesmo prazo exibido; a tentativa antecipada não chegou ao estado canônico. Reconexão/foreground e mais de 66 segundos de observação não reenviaram o trabalho: cliente independente confirmou hábito ausente/XP 0. Vencer o prazo habilitou a ação sem autoenvio. A ativação manual pelo leitor convergiu um hábito cumprido e 10 XP. Os três conjuntos de envelopes — offline, após reinício e após confirmação — ficaram idênticos, incluindo IDs, sequência, conteúdo e dependência.

Fonte, leitor, rádios, timeout de tela, flags de permissão e reverse foram restaurados, com readback. Fixture removida, APK do controle journeytest d9c8fd34 idêntico antes/depois e emulador/painel próprios encerrados. [Resumo](../design/evidencias/2026-10-18/leitor-retentativas-esgotadas/rodada3/matrix-summary.json), [mínimo final](../design/evidencias/2026-10-18/leitor-retentativas-esgotadas/rodada3/exhausted-minimum.json), [resultado remoto](../design/evidencias/2026-10-18/leitor-retentativas-esgotadas/rodada3/remote-result.json).

## Verificações

Tipos/lint e 234 testes do app passaram: 186 de núcleo/infra e 48 de componentes. Regressores do mínimo final e do botão tiveram red/green registrado; o núcleo confere contagem exata, SQLite reaberto, espera e ausência de autoenvio. O teste de jornada confere habilitação pelo relógio.

Check completo da API aprovado em 17m39s: 14 suítes/93 casos, 85 executados e oito Android opt-in ignorados, zero falhas/erros, 13 testes operacionais Python e modularidade. O ensaio selecionado rodou depois, com sua própria API/Postgres; não substitui o snapshot do check completo. [Resultados](../design/evidencias/2026-10-18/leitor-retentativas-esgotadas/api-check.json).

## Tentativas separadas e ambiente

Rodada 1 reprovou keyboard_not_visible no primeiro campo, com foco verdadeiro; a captura posterior já mostrava o teclado. O driver passou a aguardar até 12s por foco/IME/geometria reais em duas leituras estáveis, sem repetir toque. A rodada 2 registrou ausência, geometria intermediária e geometria final; completou o roteiro anterior, mas seu critério esperava botão habilitado logo na décima falha. acceptance.json conserva o resultado bruto e recusa aceite final. A regressão nova encontrou a violação antes de aceitar esse recorte. Apenas a rodada 3 qualifica a correção.

A primeira compilação falhou ao remover três hardlinks .so do cache C++; causa não estabelecida. O retry passou sem limpeza manual ou encerramento de processo preexistente, preservando o APK normal. O builder libera o reset de cache do bundle e compara identidades sintéticas 0.1.0/0.1.1. O roteiro instala somente current.apk/dev.ritmo.readonlytest; não testa uma atualização entre versões neste recorte.

Ponte SDK/JWT, gestos físicos e observador com FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES; coleta somente de janelas próprias e geometria do IME. Falha 503/Retry-After de 60s injetada na fronteira de fetch, antes de encaminhar push; pull, identidade, SQLite, SecureStore, API/Postgres e confirmação independente reais. Não foi capturado trace dos cabeçalhos/contagem HTTP do dispositivo: o nativo observa nove prazos e failed, e o núcleo confere as dez chamadas exatas. Capturas demonstram estado/seleção, não áudio pronunciado. Sem wipe, reset de guard/banco ou descarte de pendências para simular recuperação.

## Pendências

Próximo recomendado: interrupção de cópia inicial com staging não zero, preservando base anterior/intenções e retomada segura. Restante da matriz de leitura/estados, edição falada por caractere/cursor, desempenho instrumentado, paletas no APK atual e iPhone/VoiceOver (Q55=B) continuam separados, além dos gates externos. Este roteiro não fecha 06/M1 nem aceita indisponibilidade real da API.
