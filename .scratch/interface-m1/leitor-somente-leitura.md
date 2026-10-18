# Leitor: atualização obrigatória e leitura local — recorte de 06/M1

Status: recorte delimitado concluído localmente em 18/10/2026; 06/M1 permanecem abertos. REQ-SYN-014/016/017, REQ-DS-003 e Q60=A. Contrato existente, sem nova política de recuperação.

## Critérios

Pacote temporário dev.ritmo.readonlytest, separado de dev.ritmo.journeytest e do produto. Recusar pacote de ensaio preexistente; instalar somente a fixture criada nesta execução e remover somente esse pacote ao finalizar. Conferir hash da instalação original antes/depois. Sem limpar banco/guard durante o exercício, root ou wipe. A desinstalação final remove dados e restrição somente da fixture descartável, depois de encerrar o teste e registrar evidências; a instalação original é preservada.

Com TalkBack ativo e texto 200%, cadastrar conta real/onboard, manter uma recusa comprovada e criar/marcar hábito offline. Receber 426 controlado: preservar leitura, intenção e XP provisório; aviso selecionável, criação/marcação/edição/correção/descarte/retry bloqueados. Diagnóstico e histórico continuam consultáveis. Reiniciar sem a falha e alternar rede não liberam o mesmo build. Cancelar saída preserva conta/foco; logout explícito esconde os dados e não contorna bloqueio por novo login.

Atualizar o mesmo pacote via install -r para build sintético 0.1.1, sem apagar dados. Offline não libera conta. Login online compatível na conta original libera a instalação e retoma intenções, com cliente independente verificando hábito/cumprimento/XP sem duplicação. Diagnóstico recusado e originais permanecem. O teste não publica versão nova do produto. Antes do nativo, extrair/comparar os bundles: versão Android diferente sozinha não comprova a identidade de cliente do JavaScript.

## Isolamento e limites

Configuração dinâmica seleciona somente esse pacote com flags de teste e builds 0.1.0/0.1.1. O harness muda exclusivamente a identidade de versão do cliente sintético atualizado; protocolo m1.1 e fontes do núcleo permanecem. Observador aceita explicitamente apenas journeytest ou readonlytest, selecionados por argumento validado, sem conteúdo de outros apps/IME. Todos os recursos próprios e configurações devem ser restaurados inclusive em falha.

Não aceita desempenho, edição falada por caractere/cursor, todas as paletas, outras falhas/versões de schema, atualização offline com conta ainda ativa, iPhone/VoiceOver Q55=B ou M1 completo. A conta é encerrada antes de atualizar neste roteiro. Retry esgotado e cópia interrompida com staging não zero permanecem em recortes próprios.

Tipos/lint/testes app e API check completos obrigatórios. Capturas/XML/JSON sintéticos, versões/hashes, limpeza e manifestos ficam no relatório de 17/10/2026. Não promover tentativas parciais a aprovação.


## Resultado verificado

Rodada 12 aprovada: 11 fases a 200%, 76 medições de controles/11 campos-IME e cinco campos somente leitura. Login explica atualização; retorno ao acionador na borda física corrigido. Build atualizado com bundle distinto instalado em lugar, login offline fechado e login online compatível retomando os mesmos originais, diagnóstico e 10 XP sem duplicação. Controles/pendências e isolamento preservados, configurações restauradas e recursos próprios fechados. App: 231 testes/tipos/lint; API check: 85 executados, oito opt-in ignorados, 13 operacionais e modularidade, sem falhas. Recusa de alvo do observador passou em verificação separada. Relatório: docs/analises/2026-10-17-talkback-somente-leitura.md. Próximo: retry esgotado/retomada manual; limites deste plano continuam válidos.
