# Próximo recorte dentro de06 — leitor real e medidas

Preferências já implementadas; recorte 06 permanece em andamento. [Resultado atual](../../docs/analises/2026-10-12-interface-aparencia-e-preferencias.md). Não confundir fixture com comportamento do produto nem marcação comum com ativação do leitor.

## Leitor — ponte e primeiro roteiro aprovados

A ponte sendTouch/JWT e o observador FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES funcionam no Pixel_9 Google Play existente, sem root, alteração de SELinux ou troca/descarte de imagem. [Resultado e reprodução](../../docs/analises/2026-10-12-talkback-e-continuidade-do-briefing.md). O falso positivo adb input e as tentativas anteriores continuam rejeitados/preservados.

Rodada7 aprovou preflight físico, exploração sem ativar, cumprimento/desfazer real com foco retido após atualização, Ajustes, seleção de aparência inicialmente diferente e foco linear. Os providers locais agora renderizam a projeção confirmada sem trocar controles por carregamento. Texto100% no leitor;12 paletas100%/200% e36 alvos medidos no APK assinado11cee24a. Rodada8 confere o hash instalado após reinício, mas reprova a navegação; rodada10 aprova o roteiro corrigido completo no mesmo APK, com restauração documentada. O roteiro básico não aceita toda a leitura falada ou a matriz inteira.

Ampliação funcional coletada em13/10:18 fases a200%, formulários/IME, hábito longo, cancelamentos, histórico e falhas locais, com conferência independente no servidor. [Resultado](../../docs/analises/2026-10-13-talkback-formularios-dialogos-e-erros.md). A rodada14 usa observação de foco e mantém aprovação integral falsa.

Q60=A foi confirmada em14/10; a validação de15/10 encontrou e corrigiu a seleção inicial do TalkBack. A matriz final passou18 fases/cinco diálogos, com título e retorno reais, sem modo de observação, no APKb4996e90. [Relatório](../../docs/analises/2026-10-15-talkback-foco-dos-dialogos.md). Ainda falta cobertura integral de recuperação/rejeições/identidade incerta e navegação/leitura entre janelas; a consulta somente da janela superior não a substitui. Depois, medir abertura/cards/feedback no produto. Registrar nó/estado/foco reais sem suspender o serviço nem reenviar ativação ambígua; preservar pendências/contas e restaurar configurações/recursos próprios. AVD apenas visível durante os testes; paletas e hash devem corresponder ao APK instalado.

VoiceOver/iPhone continua Q55=B. Não voltar a pedir root na imagem atual nem usar serviço Bound/foco de janela como prova suficiente.

## Medidas — sem ambiguidade de intervalo

Specs07 §1 e08 §6: abertura≤ 2 s, resposta visual ao marcar≤ 100 ms e cards locais≤ 300 ms após cold start. As medidas por ADB/UIAutomator atuais incluem inspeção/esperas e não aceitam nem reprovam essas metas.

Instrumentar marcos reais de abertura, projeção/cards e feedback persistido em build verificável, sem temporizador que simule sucesso. Definir amostra/repetições e aparelho/AVD, registrar distribuição e separar tempos de comunicação do driver. Otimizar somente após medir o gargalo; conferir redução de movimento real. Esse trabalho não deve alterar os estados contratados de erro/sync.

Critério de fechamento de06: roteiro de leitor e matriz de estados aprovados no escopo Android e medidas verificáveis; aceite integral do M1 continua sujeito a iPhone e gates externos existentes. Não abrir fase futura a partir dessas verificações locais.

13/10/2026: [matriz ampliada TalkBack](../../docs/analises/2026-10-13-talkback-formularios-dialogos-e-erros.md) completou18 fases funcionais a200%, com35 medições de controles/9 de campo-IME e conferência independente na API; modo de observação mantém aprovação integral falsa. Q60 aguarda definição do destino de foco dos diálogos; não aceitar a proposta por silêncio. Desempenho, cobertura integral de estados/leitura e iPhone continuam abertos.
