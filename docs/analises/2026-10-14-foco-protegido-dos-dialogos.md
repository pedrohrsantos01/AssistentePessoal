# Foco protegido dos diálogos — Q60=A

Data:14/10/2026. Incremento do recorte06 do M1, conforme REQ-DS-003. Pedro aprovou título ao abrir e retorno protegido ao acionador. Implementação e testes locais concluídos; aceite nativo ainda pendente.

## Comportamento implementado

Sheet possui um único título acessível e solicita foco após o evento nativo de apresentação e a confirmação de layout. Foram removidos os anúncios paralelos de título. Privacidade, saída, exclusão e sincronização compartilham esse comportamento, mantendo os tokens, o conteúdo e a ordem visual do Ritmo-App.

Ao fechar/cancelar, o controlador resolve novamente o acionador disponível na mesma jornada. Revalida host, habilitação, janela atual e contexto no callback assíncrono. Saída confirmada, troca de conta, bloqueio da jornada e recuperação invalidam callbacks antigos, inclusive antes de React concluir uma nova renderização. Nenhuma transferência executa uma ação ou altera o rascunho.

A revisão de uma operação usa uma identidade estável para devolver foco ao controle remontado no painel anterior. Quando a operação não oferece mais aquele acionador, a retomada foca o título do painel; não reutiliza o nó antigo. Ao fechar o painel, preserva seu acionador original na página. Não há alteração de schema, API, contratos de dados ou regras de XP/sincronização.

## Estrutura e verificação

O controlador puro concentra o ciclo de janelas e controles; o adaptador React Native registra refs e usa `AccessibilityInfo.sendAccessibilityEvent(host, 'focus')`. O escopo consulta o estado atual da jornada/recuperação e não depende apenas da limpeza posterior de efeitos. A confirmação de medida antecede o evento e revalida a elegibilidade. O agendamento após commit não é evidência de que o leitor aceitou o foco.

A versão instalada do React Native0.86 fornece `onShow`; seu `onDismiss` só é emitido no iOS. O retorno Android combina o commit e a confirmação nativa de medida, sem aguardar um evento ausente. Referência primária: [AccessibilityInfo](https://reactnative.dev/docs/accessibilityinfo#sendaccessibilityevent) e implementação local `app/node_modules/react-native/Libraries/Modal/Modal.js`.

Typecheck, lint e218 testes passaram:175 casos do conjunto de domínio/controlador e43 de componentes. Onze testes novos exercitam atraso de apresentação/layout, cancelamento, callbacks após preempção, acionador removido/desabilitado/substituído, nova janela e revisão aninhada. Quatro testes de componente exercitam Sheet/controles reais, título único, rascunho preservado e rejeição de callbacks após mudança do escopo. O teste de privacidade da jornada também verifica ausência de anúncio duplicado.

API check passou em12m18s, exit0: 93 casos, 85 executados/8 nativos opt-in ignorados, 0 falhas/0 erros; ModularityTests verde. Os13 checks operacionais também passaram. [Resumo de verificações e hashes](../design/evidencias/2026-10-14/checks-summary.json).

A primeira execução completa teve timeout no teste existente de login offline; ele passou isoladamente em636ms, sem ampliar o limite. A execução final completa passou. Duas falhas de preparação dos testes novos — importação duplicada e fixture sem children — foram corrigidas antes dos checks finais. Nenhum timeout foi ampliado e nenhum teste foi ignorado para obter aprovação.

## Aceite e próxima execução

Nenhum emulador foi aberto, nenhum processo preexistente foi encerrado e nenhum novo APK foi produzido neste incremento. Pedro informou que liberará memória e avisará quando estiver pronto. A repetição visível fica aguardando esse aviso. Testes de componente e de controlador não provam TalkBack/VoiceOver, confinamento entre janelas, redução de movimento ou fidelidade nativa.

A rodada14 de13/10 permanece histórica, em observação e com `passed=false`; seu hash e paletas não pertencem a uma nova versão. Preparar o APK journeytest, conferir assinatura/hash e instalação preservada, repetir a matriz com `RITMO_READER_OBSERVE_FOCUS` ausente e registrar configurações restauradas/recursos próprios fechados. O [README](../../app/README.md#matriz-do-leitor-com-texto-ampliado) contém o comando; a [matriz](../../.scratch/interface-m1/matriz-leitor.md) distingue cobertura prevista e observada.

Restam a repetição nativa de Q60, cobertura integral com leitor de recuperação/rejeições/identidade incerta e edição falada, medidas de abertura/cards/feedback e aceite iPhone/VoiceOver adiado por Q55=B. Recorte06 e M1 continuam abertos.
