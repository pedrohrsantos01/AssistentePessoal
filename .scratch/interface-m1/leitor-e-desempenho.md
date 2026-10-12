# Próximo recorte dentro de06 — leitor real e medidas

Preferências já implementadas; recorte 06 permanece em andamento. [Resultado atual](../../docs/analises/2026-10-12-interface-aparencia-e-preferencias.md). Não confundir fixture com comportamento do produto nem marcação comum com ativação do leitor.

## Leitor — ponte e primeiro roteiro aprovados

A ponte sendTouch/JWT e o observador FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES funcionam no Pixel_9 Google Play existente, sem root, alteração de SELinux ou troca/descarte de imagem. [Resultado e reprodução](../../docs/analises/2026-10-12-talkback-e-continuidade-do-briefing.md). O falso positivo adb input e as tentativas anteriores continuam rejeitados/preservados.

Rodada7 aprovou preflight físico, exploração sem ativar, cumprimento/desfazer real com foco retido após atualização, Ajustes, seleção de aparência inicialmente diferente e foco linear. Os providers locais agora renderizam a projeção confirmada sem trocar controles por carregamento. Texto100% no leitor;12 paletas100%/200% e36 alvos medidos no APK assinado11cee24a. Rodada8 confere o hash instalado após reinício, mas reprova a navegação; rodada10 aprova o roteiro corrigido completo no mesmo APK, com restauração documentada. O roteiro básico não aceita toda a leitura falada ou a matriz inteira.

Próximo recorte: ampliar o leitor para texto200%/conteúdo longo, formulários e teclado, entrada/saída de sheets, validação/erros e estados de sessão/sync já aprovados. Registrar nó/estado/foco/ordem reais sem suspender o serviço e sem reenviar ativação ambígua. Preservar pendências/contas e restaurar configurações/recursos próprios. AVD só visível durante testes; origem das paletas e hash devem corresponder ao APK realmente instalado.

VoiceOver/iPhone continua Q55=B. Não voltar a pedir root na imagem atual nem usar serviço Bound/foco de janela como prova suficiente.

## Medidas — sem ambiguidade de intervalo

Specs07 §1 e08 §6: abertura≤ 2 s, resposta visual ao marcar≤ 100 ms e cards locais≤ 300 ms após cold start. As medidas por ADB/UIAutomator atuais incluem inspeção/esperas e não aceitam nem reprovam essas metas.

Instrumentar marcos reais de abertura, projeção/cards e feedback persistido em build verificável, sem temporizador que simule sucesso. Definir amostra/repetições e aparelho/AVD, registrar distribuição e separar tempos de comunicação do driver. Otimizar somente após medir o gargalo; conferir redução de movimento real. Esse trabalho não deve alterar os estados contratados de erro/sync.

Critério de fechamento de06: roteiro de leitor e matriz de estados aprovados no escopo Android e medidas verificáveis; aceite integral do M1 continua sujeito a iPhone e gates externos existentes. Não abrir fase futura a partir dessas verificações locais.
