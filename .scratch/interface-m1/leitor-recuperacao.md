# TalkBack na recuperação de senha — recorte delimitado de06

Requisitos existentes: REQ-CTA-003/004, ADR-016, REQ-DS-003 e Q60=A. Não fecha06/M1 nem associações públicas de links.

## Roteiro

- Pedido: e-mail inválido, offline com campo preservado, envio pela UI/SMTP real e resposta uniforme.
- Conta ativa: criar/cumprir offline; link recebido interrompe privacidade. A recuperação é navegável pelo leitor; janela antiga não cobre o formulário nem recebe retorno de foco durante a recuperação.
- Abrir quente/frio não consome link. Nova senha inválida/offline mantém o conteúdo; confirmar online não autentica automaticamente. Retorno explícito ao login fecha painéis e exige a mesma conta.
- Reiniciar/reautenticar envia uma única vez o hábito/XP preservados; cliente independente verifica convergência e isolamento de outra conta.
- Segundo link interrompe confirmação de saída. Link de origem inválida, usado e expirado permitem outro pedido; endereço desconhecido recebe resposta uniforme sem e-mail.

TalkBack ativo a200%, toque SDK autenticado, observador sem supressão, alvos44, campos acima do IME. Não impor destino de foco inicial a páginas: Q60 define título para diálogos e invalidação do retorno durante recuperação. Registrar a seleção observada e provar exploração/ativação dos novos controles.

Links/segredos ficam em memória; não gravar URLs/tokens ou valores de senha nas evidências. Capture apenas senha ocultada; XML persistido redige valores de fixtures, mesmo durante Mostrar/Ocultar. API/PostgreSQL/SMTP descartáveis, sem Resend ou contas reais. Emulador/painel visíveis e recursos próprios encerrados; preservar instalação e dados.

## Limites

Entrada por intent explícito não aceita App Links/Universal Links públicos. Texto sintético não prova edição falada por caractere; observador da janela superior não prova travessia entre todas as janelas. Corrida de callbacks retidos tem testes locais específicos; ensaio funcional nativo não equivale a controle exaustivo da ordem interna do sistema. Demais estados/medidas/paletas/iPhone continuam no plano.

## Resultado

Matriz rodada1 aprovada:12 fases, duas interrupções,44 medições de controle/14 campos-IME a200%, no APK7430a6f8. Fonte/rede/leitor/permissões restaurados; recursos próprios fechados e dados preservados. App:226 testes/tipos/lint aprovados; API check aprovado:85 executados/oito nativos opt-in ignorados,13 verificações operacionais e modularidade, sem falhas. [Relatório](../../docs/analises/2026-10-15-talkback-recuperacao-de-senha.md). Restante de06/M1 aberto.
