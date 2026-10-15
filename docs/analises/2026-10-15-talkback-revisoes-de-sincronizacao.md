# TalkBack nas revisões de sincronização — 15/10/2026

Recorte delimitado de06/M1: REQ-DS-003, REQ-SYN-017, Q53=A e Q60=A. Continuação de [foco dos diálogos](2026-10-15-talkback-foco-dos-dialogos.md). Incremento local concluído: matriz Android, checks do app e check completo da API aprovados. Recorte06 e M1 continuam em andamento.

## Resultado nativo

Rodada3-final passou integralmente, sem observação de foco, no APK7430a6f8db0daf5cfb2e12e4fd1257f7b6557953bdddcf32d4618004fdbaa102:24 fases, nove registros de foco,75 controles e13 campos/IME medidos. Pixel_9/API35/Android15, GPU host,2GB de RAM, TalkBack continuamente ativo a200% (preparação inicial a100%). Hash instalado igual ao artefato local.

A correção com a marcação dependente foi confirmada por cliente SQLite/HTTP independente: hábito cumprido e10 XP. O diagnóstico da intenção incerta permaneceu idêntico após reinício sem a falha injetada; a criação independente foi aceita e o total permaneceu10 XP. As revisões retornaram ao acionador sem rolagem do driver; o acionador removido pela correção deu lugar ao foco no título do painel. O estado incerto não ofereceu correção/descarte.

`reader-cleanup.restored=true`: rede, leitor, fonte e permissões restaurados, fixture parada e reverse removido. Observador temporário removido pelo lançador; emulador e painel próprios fechados. A consulta ADB posterior não lista emuladores. Instalação e dados sintéticos da jornada preservados; processos preexistentes não foram interrompidos.

Checks do app: typecheck/lint e225 testes (182 domínio/controladores/infraestrutura de teste +43 componentes) passaram. Build Android release x86_64 assinado com a chave convencional de teste aprovado. API `check` aprovado em10m04s:93 casos/85 executados/oito nativos opt-in ignorados, zero falhas/erros;13 verificações operacionais e modularidade aprovadas. A matriz Android foi executada separadamente e passou. [Resumo/hashes](../design/evidencias/2026-10-15/leitor-sync/increment-summary.json), [matriz final](../design/evidencias/2026-10-15/leitor-sync/rodada3-final/matrix-summary.json), [índice das tentativas](../design/evidencias/2026-10-15/leitor-sync/attempts-index.json).

## Falha e correção

A matriz ampliada reprovou o retorno da revisão de uma criação recusada: o TalkBack selecionou o aviso de atenção, em vez do acionador no painel anterior. A entrada no título estava correta. O teste mínimo sem API reproduziu a falha nas duas repetições; uma segunda coleta mediu a posição antes de qualquer busca/rolagem do driver. Em ambas, o botão tinha `visible-to-user=false`, topo2918 e limite inferior da janela2424 pixels. O painel havia sido recriado no topo, com o acionador fora da área visível.

A camada de foco agora associa cada destino ao viewport do diálogo. Antes de selecionar o nó, mede destino e viewport na mesma janela; se necessário, rola sem animação e exige nova medida que prove a exposição. A operação conserva as guardas de identidade/conta, janela, host e habilitação. Três tentativas limitadas de medida/rolagem podem abortar; um frame, por si só, nunca confirma visibilidade. O evento Android continua `viewHoverEnter`, validado no incremento anterior; não há novo anúncio paralelo, alteração de domínio/schema, dependências ou tokens visuais.

O probe corrigido passou duas repetições no APK7430a6f8: antes da busca do driver, o acionador estava visível e realmente focado. O mesmo mecanismo revela o título quando o acionador deixa de existir após correção. Cinco regressões verificam revelação medida, título acima da área visível, invalidação por contexto/janela e ausência de sucesso sem mudança nativa de posição. Os testes de ciclo de foco existentes continuam ativos.

## Falha do driver identificada na rodada2

A rodada2 aprovou o retorno corrigido, a remoção do acionador após correção e a confirmação independente de hábito cumprido/10 XP. Parou ao extrair o diagnóstico incerto. O XML preservado continha o conteúdo completo; Android XmlSerializer escolheu aspas simples para o atributo que contém JSON, e o parser antigo aceitava apenas aspas duplas. A consulta foi corrigida e verificada contra a própria captura reprovada, com duas regressões de delimitação/entidades. Nenhuma alteração adicional no produto/APK nesse ajuste.

O roteiro captura o diagnóstico expandido e o recolhe antes de fechar a revisão, evitando misturar a prova de retorno com a travessia integral de um JSON técnico longo. O retorno aninhado agora é procurado sem rolagem do driver: cabe ao app revelar o acionador. A rodada3 aprovou o roteiro integral com essas verificações; rodada2 permanece reprovada, apesar dos cenários funcionais nela concluídos.

## Evidências e reprodução

[Plano deste incremento](../../.scratch/interface-m1/leitor-revisoes.md). Evidências em [leitor-sync](../design/evidencias/2026-10-15/leitor-sync/). `rodada1` é reprovada no APKb4996e90; `probe-baseline` e `probe-visibility` são casos mínimos reprovados. `probe-fixed` aprova apenas o retorno aninhado preservado, sem API. Não usar esse probe como aceite da matriz inteira.

Da raiz, com Node24, Java21, SDK Android e Docker funcionando:

```powershell
$env:RITMO_READER_OBSERVE_FOCUS=$null
.\scripts\verify-android-accessibility.ps1 -Matrix -SkipInstall -GpuMode host -MemoryMegabytes 2048 -EvidenceDirectory docs/design/evidencias/2026-10-15/leitor-sync/repeticao
```

`SkipInstall` exige os mesmos bytes do APK local já instalado. Se recompilar, assinar a variante descartável e executar sem esse parâmetro para atualizar preservando dados. A fixture exclusiva injeta o conflito no HTTP; a rejeição por nome usa dois clientes contra API/PostgreSQL reais descartáveis. Não usa contas reais ou Resend.

## Limites e continuação

O recorte cobre um fluxo de correção com dependente e a identidade incerta de criação. Não cobre toda classificação de rejeição, descarte, preempção por recuperação de senha ou troca de conta durante uma medida nativa pendente. Esses estados continuam no recorte06. A consulta da janela superior não prova travessia entre todas as janelas; teclas sintéticas não comprovam edição falada por caractere. Desempenho instrumentado, novas paletas para o APK corrigido e iPhone/VoiceOver (Q55=B) continuam abertos. Recorte06 e M1 permanecem em andamento.

## Referências técnicas

Documentação oficial consultada via Context7 e confrontada com os tipos instalados do React Native0.86.3: [measureInWindow](https://reactnative.dev/docs/the-new-architecture/layout-measurements#measureinwindowcallback), [ScrollView](https://reactnative.dev/docs/scrollview), [sendAccessibilityEvent](https://reactnative.dev/docs/accessibilityinfo#sendaccessibilityevent). Não usar o exemplo genérico de foco como prova do comportamento efetivo do TalkBack; o ensaio nativo e o código instalado determinam o adaptador Android empregado.
