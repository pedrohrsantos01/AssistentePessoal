# Leitor: descarte, espera remota e cópia inicial — recorte de06/M1

Status: concluído localmente; nativo e checks finais aprovados. Recorte06/M1 permanecem abertos. Requisitos existentes: REQ-SYN-005/016/017, REQ-DS-003, spec/13 e Q60=A. Nenhum comportamento de produto novo.

## Critérios

- Recusa real de criação por título ocupado, com marcação dependente. Abrir a confirmação de descarte e fechar preserva original/diagnóstico; reinício exige confirmação nova. Confirmar resolve apenas o pai, mantém dependente e retorna ao título quando o acionador desaparece.
- Dependente conserva identidade/diagnóstico após reinício e exige descarte próprio. Histórico mantém as duas intenções originais. Cliente independente confirma que o hábito canônico de outro aparelho não foi desfeito e XP continua0.
- Requisições429/503 de fixture na fronteira HTTP, com Retry-After60s: dados gravados offline permanecem, retry indisponível não encurta prazo, espera exibida equivale após reabertura (precisão de segundos) sem falha e envio retoma uma vez após o prazo. Isso não aceita as quotas de produção nem todo retry esgotado.
- ContaB integrada recebe cópia inicial interrompida: título/ajuda/erro são selecionáveis com TalkBack; abas/dados parciais não aparecem. Reinício mantém gate; nova abertura sem falha completa a cópia atomicamente. Voltar à contaA conserva seu trabalho e isolamento.

## Ensaio

Novo `-SyncStates` implica `-Matrix`, incompatível com Recovery/Traversal/modo de observação. Fixture API/PostgreSQL real, APK atual preservado, emulador e painel visíveis. Leitor continuamente ativo, seleção/ativação físicas por SDK e observador sem supressão. Texto200%, campos acima do IME e controles44 unidades. Consultas de todas as janelas interativas próprias retornadas; Android pode omitir o fundo de um modal.

Capturar XML/PNG, originais/diagnósticos sintéticos, foco de entrada/retorno e espera exibida. Valores de senha não são coletados. Restaurar configurações, rede, credenciais temporárias da ponte e recursos próprios ao terminar, inclusive em falha; preservar instalação e processos preexistentes.

## Limites

Atualização obrigatória será ensaio isolado: o bloqueio persistente por versão/instalação não deve ser limpo manualmente para facilitar o roteiro. Testes de núcleo/componente existentes continuam verificando somente leitura; não há aceite TalkBack novo desse estado neste recorte. Também restam retry esgotado/demais estados, edição falada por caractere/cursor, desempenho, paletas e iPhone/VoiceOver (Q55=B).06/M1 continuam abertos.

## Preparação interrompida

Rodada1 parou antes de ativar TalkBack: ADB offline. Nenhuma fase funcional aceita. A restauração inicial falhou por indisponibilidade do transporte; preparação foi reparada em ensaio visível separado, preservando instalação/dados. A verificação posterior confirmou fonte1.0 e leitor desativado; rede foi reabilitada. O observador já estava ausente; a checagem foi corrigida no helper temporário para aceitar essa ausência. `preparation-recovery.json` registra a recuperação, sem promover a tentativa a aceite. Causa da desconexão não demonstrada.

Rodada2 passou cinco fases de leitor/cadastro/descarte, mas a fixture genérica429 recusava o pull inicial, anterior a beginAttempt. Spec/06 §3.1 mantém contadores de pull sem push em memória por execução; a expectativa de espera durável não era aplicável àquela falha. Fixture de testes foi ampliada com sync-push-429/503, que deixam pull real passar e recusam apenas o push. Novo APK de testes necessário; produto/contrato/schema inalterados. A comparação do prazo exibido considera precisão de segundos (até1s); testes do núcleo verificam o prazo persistido exato. Rodada2 continua não aceita como roteiro completo; configurações restauradas.

Novo APK de testes preparado/assinado: d9c8fd344fccdefbc95935d568253d65fe46e3b68c2e2eef5705addd30412353. Build em2m39s, variante journeytest/x86_64. Somente fixture externa/harness ampliada; app/src, contratos e schema não mudaram. Tipos/lint e228 testes do app passaram (183 núcleo/infra e45 componentes). Rodada3 foi interrompida conforme diagnóstico abaixo; a alteração final passou no check completo da API. Evidências de APK anterior permanecem separadas.

Rodada3 passou sete fases (incluindo429/503 no push com espera após reabertura), mas a exploração do aviso de cópia inicial selecionou o texto de contagem. O driver reutilizava o ponto medido antes das três tentativas, apesar do retry alterar estado/layout. Recalcular o nó/ponto antes de cada exploração passou no probe-copy isolado: quatro fases de cadastro/cópia/isolamento, com restauração. Esse diagnóstico mantém passed=false/fullAcceptance=false e não aceita descarte/esperas. O filtro temporário foi removido antes da repetição completa; aplicativo e timers de retry não foram alterados.


## Resultado da repetição completa

Rodada4 aprovada: nove fases, 79 medições de controles e 12 campos/IME no APK d9c8fd34, TalkBack ativo e texto 200%. Ambos os prazos exibidos ficaram idênticos após reabrir; a tolerância do driver continua sendo a precisão de apresentação, não alteração da regra. Histórico e cliente independente conservaram intenções, hábito canônico e XP zero; cópia inicial falhou com zero recebidos, permaneceu bloqueada e depois liberou somente a conta completa. Volta à conta original preservou isolamento. Configurações restauradas e nenhum emulador/painel/ADB remanescente. Teste Node: 12m05s; Gradle direcionado: 12m25s, sem interpretação de desempenho. [Relatório](../../docs/analises/2026-10-16-talkback-descarte-e-espera.md).

Tipos/lint e 228 testes app aprovados (183 núcleo/infra e 45 componentes); AST PowerShell sem erros. Check completo da API aprovado em 10m43s: 93 casos/85 executados/oito nativos opt-in ignorados, zero falhas/erros, 13 verificações operacionais e modularidade. 06/M1 permanecem abertos pelos limites do relatório.
