# Leitor nas revisões de sincronização — recorte delimitado de06

Requisitos existentes: REQ-DS-003, REQ-SYN-017, Q53=A e Q60=A. Continuação do ensaio de foco aprovado em15/10/2026. Este roteiro não fecha o recorte06 nem o M1.

## Cenários e critérios

- Criar e marcar um hábito offline; outro cliente ocupa o mesmo nome. Ao reconectar, a API real recusa a criação. O leitor entra no título da revisão; cancelar retorna ao mesmo botão de revisão no painel anterior.
- Corrigir o nome e selecionar explicitamente a marcação dependente. A correção remove o acionador antigo; o painel retomado recebe foco no título. Cliente independente confirma hábito cumprido e exatamente10 XP.
- A fixture HTTP exclusiva de teste insere intenção divergente com a mesma identidade. O app real preserva a intenção local e sua dependente bloqueadas. O leitor alcança diagnóstico e fecha a revisão retornando ao acionador correto. A janela não oferece correção/descarte para incerteza.
- Uma criação independente continua sendo aceita. Reiniciar sem a falha injetada preserva a mesma intenção e diagnóstico incertos; cliente independente confirma ausência do cumprimento incerto e ausência de XP extra.

Executar a matriz completa com TalkBack continuamente ativo, fonte200%, toque físico autenticado e observador sem supressão. Confirmar nó realmente focado e alvos completos de44 unidades; preservar XML/screenshots das revisões e hash instalado. Restaurar rede, fonte, serviço e permissões, removendo apenas recursos próprios.

## Limites

Entrada de texto usa teclas sintéticas; não prova edição falada por caractere. O observador consulta a janela superior: ausência do fundo nessa consulta não prova navegação completa entre todas as janelas. Preempção por recuperação, recuperação de senha completa, rejeição com descarte e outros estados restantes de sincronização, medidas de desempenho, paletas de novo APK e iPhone permanecem no plano de06/aceite.

## Execução

Matriz estrita rodada3-final aprovada em15/10/2026:24 fases/nove registros de foco,75 controles/13 campos-IME. Falha real de retorno corrigida após reprodução mínima; parser do observador corrigido após prova no XML reprovado. App:225 testes, lint e tipos aprovados. Check da API aprovado:85 executados/oito nativos opt-in ignorados,13 verificações operacionais e modularidade, sem falhas. [Relatório](../../docs/analises/2026-10-15-talkback-revisoes-de-sincronizacao.md). O restante de06/M1 permanece aberto.
