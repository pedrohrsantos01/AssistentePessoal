# TalkBack na recuperação de senha — 15/10/2026

Recorte delimitado de06/M1, conforme REQ-CTA-003/004, ADR-016, REQ-DS-003 e Q60=A. Incremento local concluído: matriz Android, checks do app e check completo da API aprovados. Recorte06/M1 continuam abertos.

## Resultado nativo

Rodada1 aprovada sem observação:12 fases, duas interrupções (privacidade e confirmação de saída),44 medições de controle e14 de campo/IME. Pixel_9/API35/Android15, GPU host,2GB, texto200% após preparação inicial a100%. Mesmo APK7430a6f8db0daf5cfb2e12e4fd1257f7b6557953bdddcf32d4618004fdbaa102 do incremento anterior; nenhum código do produto, de app/harness ou asset mudou.

A recuperação entrou com seleção nativa em Voltar nos dois casos, com o diálogo anterior ausente da janela consultada; os novos campos/ações foram explorados e ativados pelo TalkBack. Nova senha inválida e confirmação offline foram exercitadas. Aberturas quente/fria não consumiram o link: a senha anterior ainda autenticava antes da confirmação online e foi recusada depois. O reset não autenticou automaticamente. Reinício/reautenticação enviou o hábito preservado uma única vez, com10 XP; outro cliente confirmou esse resultado e uma segunda conta continuou sem hábitos/XP. Links de origem inválida, usado e expirado permitiram novo pedido; endereço desconhecido teve resposta uniforme e zero mensagens SMTP.

Fonte, leitor, permissões e rede restaurados; fixture/reverse encerrados. Observador temporário removido pelo lançador, emulador e painel próprios fechados; ADB posterior sem emuladores. Dados/instalação preservados. Nenhuma tentativa reprovada neste roteiro. [Resumo/hashes](../design/evidencias/2026-10-15/leitor-recuperacao/increment-summary.json), [matriz](../design/evidencias/2026-10-15/leitor-recuperacao/rodada1/matrix-summary.json).

Checks do app: tipos/lint e226 testes, sendo182 do núcleo/infraestrutura e44 de componentes. O teste novo verifica entrada quente durante saída, retorno explícito à mesma conta e conservação da fila/10 XP. API `check` aprovado em9m48s:93 casos/85 executados/oito nativos opt-in ignorados,zero falhas/erros,13 verificações operacionais e modularidade aprovadas. A matriz TalkBack foi executada separadamente e passou.

## Escopo e implementação

A suíte de leitor reutiliza a fixture existente de API/PostgreSQL/SMTP, com mailbox e relógio exclusivos em loopback. O método de fixture foi compartilhado entre o teste funcional antigo e a execução TalkBack. `-Recovery` no lançador prepara esses serviços antes de abrir o emulador/painel visíveis e exige serial de emulador válido. O pacote/API de produção não ganha endpoints de teste. A fixture já usa quotas elevadas para isolar o roteiro; este incremento não aceita quotas de produção nem substitui RateLimitTests.

A jornada cobre pedido inválido/offline, envio uniforme pelo SMTP, criação/cumprimento offline, entrada por link com privacidade aberta, confirmação offline e abertura fria, mostrar/ocultar senha, confirmação online sem login automático, reautenticação, sincronização e isolamento. Outro link interrompe confirmação de saída; origem inválida, link usado/expirado e endereço desconhecido completam o roteiro. Segredos/URLs permanecem em memória; XML persistido redige valores de fixtures e screenshots não são capturados com senha exposta.

Q60 define foco inicial no título para diálogos, além da invalidação do retorno por recuperação. Não foi inventado destino obrigatório para páginas: o roteiro registra a seleção nativa e comprova exploração/ativação dos novos controles, sem diálogo antigo cobrindo o formulário. O teste de componente também confirma o retorno explícito ao login após entrada quente com saída aberta, preservando conta/fila/XP e fechando o diálogo.

## Reprodução

Da raiz, com Node24, Java21, SDK Android e Docker funcionando:

```powershell
.\scripts\verify-android-accessibility.ps1 -Recovery -SkipInstall -GpuMode host -MemoryMegabytes 2048 -EvidenceDirectory docs/design/evidencias/2026-10-15/leitor-recuperacao/repeticao
```

`SkipInstall` só aceita APK local igual ao instalado. O roteiro usa fonte200% e preserva dados da instalação; a preparação inicial da sessão ocorre a100%. Configurações e recursos próprios devem ser restaurados/encerrados inclusive em falha. [Plano e critérios](../../.scratch/interface-m1/leitor-recuperacao.md).

## Limites

Intent explícito não prova App Links/Universal Links públicos nem Resend/domínio. O observador consulta a janela superior; ausência de um painel nessa consulta não prova travessia completa entre janelas. Teclas sintéticas não comprovam edição falada por caractere. A execução funcional nativa não controla exaustivamente a ordem dos callbacks internos: guardas de foco pendente possuem testes locais próprios. Desempenho, paletas do APK, demais estados/leitura e iPhone/VoiceOver Q55=B continuam no plano de06/aceite. Não fechar06 ou M1 por este incremento. Próximo recorte recomendado: navegação linear e isolamento do foco entre diálogo e fundo com TalkBack; depois, demais estados/edição falada e medidas de desempenho conforme o plano existente.
