# Próximo recorte dentro de06 — leitor real e medidas

Preferências já implementadas; recorte 06 permanece em andamento. [Resultado atual](../../docs/analises/2026-10-12-interface-aparencia-e-preferencias.md). Não confundir fixture com comportamento do produto nem marcação comum com ativação do leitor.

## Leitor — pré-condição ainda não satisfeita

O Pixel_9 usa Android 35/Google APIs Play Store e não oferece a entrada de depuração exigida por `sendevent`. `adb input` foi rejeitado como prova: alterou o hábito antes da ativação do TalkBack. Não desativar SELinux, trocar a imagem do AVD existente ou apagar seus dados para contornar isso.

Recomendação: preparar uma ponte pela API de toque oficialmente exposta pelo SDK (`emulator/lib/emulator_controller.proto`, sendTouch/TouchEvent), limitada ao emulador próprio em loopback e com autenticação local sem registrar tokens. O primeiro teste da ponte deve marcar/desfazer sem leitor; com TalkBack, explorar não pode mudar o checkbox, e ativar deve mudar uma vez. Só aceitar após inspeção do foco nas capturas e estado real. Investigar suporte/runtime e validar a ponte antes de instalar dependências de automação. Isso não muda o app nem seus contratos.

Alternativas concretas: aceite manual assistido no Pixel_9 visível, ou AVD depurável separado com fixtures próprias. Preservar o AVD atual e abrir somente durante testes. O driver preparado exige imagem/processo próprios e opt-in `-EnableDebugInput`; não está aprovado em outro AVD ainda.

Depois do primeiro controle: rádio de aparência com escolha inicialmente diferente; navegação linear, saída/entrada de sheet, erros e campos com teclado;100%/200% e conteúdo longo. Registrar rótulos/estado lidos, foco, ordem e resultado persistido, sem aceitar apenas serviço instalado/Bound ou XML. Permissões e configurações anteriores devem voltar ao final. VoiceOver/iPhone segue Q55=B.

## Medidas — sem ambiguidade de intervalo

Specs07 §6 e08 §6: abertura≤ 2 s, resposta visual ao marcar≤ 100 ms e cards locais≤ 300 ms após cold start. As medidas por ADB/UIAutomator atuais incluem inspeção/esperas e não aceitam nem reprovam essas metas.

Instrumentar marcos reais de abertura, projeção/cards e feedback persistido em build verificável, sem temporizador que simule sucesso. Definir amostra/repetições e aparelho/AVD, registrar distribuição e separar tempos de comunicação do driver. Otimizar somente após medir o gargalo; conferir redução de movimento real. Esse trabalho não deve alterar os estados contratados de erro/sync.

Critério de fechamento de06: roteiro de leitor e matriz de estados aprovados no escopo Android e medidas verificáveis; aceite integral do M1 continua sujeito a iPhone e gates externos existentes. Não abrir fase futura a partir dessas verificações locais.
