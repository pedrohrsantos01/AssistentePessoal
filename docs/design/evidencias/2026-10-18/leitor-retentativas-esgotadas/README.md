# TalkBack — retentativas esgotadas

[Relatório](../../../../analises/2026-10-18-talkback-retentativas-esgotadas.md) e [plano](../../../../../.scratch/interface-m1/leitor-retentativas-esgotadas.md).

Roteiro: conta/onboarding reais, criação e marcação dependente offline,10 XP provisórios; push503/Retry-After60 antes de encaminhar, nove prazos de backoff real, parada pública failed; reinício sem falha, reconexão/foreground sem reativação; ação manual por TalkBack e confirmação independente de um hábito cumprido/10 XP. Sem relógio acelerado, mudança de limite ou reset de guard/banco. Corrigida a perda de Retry-After na décima falha, usando o contrato e campo existentes.

- `rodada1`: reprovada no primeiro campo. Foco verdadeiro, IME ainda não visível no assert; captura posterior já mostra teclado e mesmo campo focado. Nenhum aceite de cadastro ou retentativas. `diagnosis.json` e `native-result.txt` conservam o sinal; cleanup/readback e isolamento aprovados.
- `rodada2`: roteiro anterior completo, preservando cadeia/XP e convergindo uma vez, mas critério incompleto esperava ação habilitada logo na décima falha. acceptance.json conserva o resultado bruto e recusa aceite final: o Retry-After dessa falha ainda precisava ser protegido. Não é prova da correção.
- `rodada3`: APK corrigido, driver com observação de foco/IME/geometria e teste ampliado do prazo final; aprovada: seis fases/40 controles/seis campos-IME/cinco retornos, nove esperas reais e prazo final preservado. Apenas esta rodada qualifica o recorte.
- `api-check.json`: snapshot do check completo antes das execuções opt-in,14 suites/93 casos (85 executados,8 ignorados), zero falhas/erros,13 testes operacionais Python. Não substituir esse snapshot pelo JUnit do ensaio selecionado.
- `app-checks.json`: tipos/lint e186+48 testes do app; regressão SQLite confere exatamente10 pushes com envelopes iguais, parada durável e retry explícito idêntico.
- `fixture-build.json`: APK corrigido/bundle/observador e comparação das duas identidades sintéticas. Current.apk mudou após a correção; updated.apk não é instalado. Os arquivos before-fix documentam o baseline das rodadas1/2. `source-checksums.json` identifica as fontes finais.
- `host-before.json`: recursos e metadados do AVD original antes do ensaio. Metadados de arquivo não são checksum forense de banco.

Hierarquias/capturas pertencem somente ao pacote de fixture. O observador não suspende o leitor nem coleta o conteúdo do teclado ou de outros apps; só a geometria do IME. Campos de senha são mascarados; nomes/e-mails/intenção são sintéticos. Capturas indicam seleção/estado, não comprovam áudio pronunciado. Alvos usam piso no arredondamento das44 unidades para pixels, conforme os roteiros anteriores.

Prazos públicos têm precisão de segundos. A contagem persistida exata é conferida no núcleo SQLite; o nativo observa a progressão de nove esperas até failed e o resultado preservado. Não aceita indisponibilidade real da API, edição falada, VoiceOver, desempenho, staging não zero ou M1 integral.

`core-tenth-floor-red.txt` prova11 envios em vez de10 antes do último prazo. `core-tenth-floor-green.txt` verifica o núcleo/jornada corrigidos; `component-tenth-floor-red/green.txt` conferem o botão no mesmo estado, usando a jornada anterior como baseline isolado. A fonte atual foi restaurada em finally antes do build. O vencimento do prazo só habilita a ação; não causa autoenvio.

A primeira compilação falhou ao remover três hardlinks .so; o retry passou sem limpeza manual ou interrupção de processo preexistente. Causa do erro de arquivo não estabelecida. Build-attempts e build-process-cleanup documentam resultado/preservação e limpeza somente de compilador descendente identificado, se ainda estivesse ativo.
