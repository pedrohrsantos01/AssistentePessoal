# Foco dos diálogos — contrato Q60=A

Status: aprovado por Pedro em14/10/2026 (Q60=A). Origem: matriz nativa a200%, rodada12 de13/10/2026; REQ-DS-003 exige administração de foco, mas não define destino inicial e retorno.

## Política aprovada

Ao apresentar privacidade, confirmação de exclusão, confirmação de saída ou painel de sincronização, levar o foco do leitor ao título acessível após a janela estar apresentada. O conteúdo e as ações continuam elementos separados e o fundo não participa da navegação. Não anunciar o título duas vezes por mecanismo paralelo.

Ao fechar/cancelar, devolver o foco ao controle que abriu o diálogo, depois de o fundo estar acessível. Esse retorno só ocorre se o controle ainda pertence à mesma jornada/conta e permanece disponível. Saída confirmada, mudança de conta, preempção por recuperação e navegação que eliminem o acionador não tentam reativar nem focar um elemento antigo. Diálogo aninhado devolve foco ao acionador dentro do painel anterior.

A transferência não ativa controles, não modifica formulário/dados e respeita texto ampliado/redução de movimento. O foco deve acompanhar o ciclo real da janela; temporizadores não comprovam o resultado. O Android deve confirmar nó/estado reais; iOS continua pendente conforme Q55=B.

## Alternativa não escolhida

Manter a seleção inicial nativa do leitor, desde que o foco pertença ao diálogo e o título seja navegável, com o mesmo retorno ao acionador e proteção de conta. Na rodada12, o foco entrou no texto de privacidade e o fundo ficou fora da janela interativa; isso, sozinho, não é reprovação de um requisito existente.

A decisão não altera schema, autenticação, sincronização ou direção visual. A coleta de13/10 permanece em observação; a implementação e a repetição da matriz com título inicial/retorno protegidos têm evidências próprias. Pedro informou em14/10 que liberará memória e avisará quando estiver pronto: aguardar esse aviso antes de abrir o novo ensaio no emulador, preservando processos preexistentes.
