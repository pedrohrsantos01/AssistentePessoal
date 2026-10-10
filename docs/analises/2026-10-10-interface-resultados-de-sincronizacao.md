# Resultados de sincronização pela interface — recorte 04

Data: 10/10/2026. Escopo: [interface 04](../../.scratch/interface-m1/issues/04-estados-de-sincronizacao.md), REQ-SYN-017, REQ-SYN-014, REQ-DS-004, Q32/Q53 e spec/13 §§6–8/22. Continuação dos recortes 01–03 sobre a jornada, o SQLite e a sincronização existentes.

## Entrega

A pílula abre um painel inferior sobre o Briefing ou Ajustes. O painel separa alterações locais, envio ativo, confirmação comprovada, recusa, identidade incerta e bloqueio local. Briefing e gestão mostram o estado por hábito; operações resolvidas continuam no histórico com intenção original e referência à substituta. O fundo do painel fica fora da árvore acessível. Falha da escrita local continua sendo “não salvo”, sem confirmação remota ou XP durável.

Recusa comprovada oferece correção e descarte por item. O formulário conserva título/data/fuso/início do dia/ordem aplicáveis, ícone, cor e contexto original. Correção chama o núcleo transacional, cria intenções substitutas e remapeia somente dependentes explicitamente selecionadas. Falha conserva campos e intenção. Descarte exige confirmação e deixa as dependentes preservadas para revisão; não desfaz efeitos já confirmados no servidor.

Q53 mantém a intenção incerta e suas dependentes bloqueadas. A interface oferece diagnóstico e conteúdo original, sem corrigir, descartar ou gerar identidade substituta. Intenções independentes continuam. Diagnóstico não inclui credenciais; consultas locais filtram pela conta ativa. Navegação e painéis continuam vinculados à geração/gate da sessão.

429 e indisponibilidade/503 têm avisos próprios. Prazo de espera vem do scheduler; botão manual não antecipa Retry-After. Escrita local permanece disponível quando a sessão e a base autorizam. Compatibilidade conserva leitura e desabilita formulários/gestão; o mesmo build não contorna um bloqueio de atualização ao reabrir.

Conta já integrada em um aparelho novo começa com snapshot atômico. A interface usa a contagem real de registros em staging, sem inventar porcentagem ou total. Falha/reinício conserva staging e bloqueia a primeira abertura até instalar a cópia completa. Numa conta com base anterior, a cópia em andamento preserva a base ativa. AccountStore expõe leituras de operações e progresso; Journey encaminha ações para o núcleo, sem HTTP nos componentes. Não houve migration, endpoint, campo de domínio ou dependência novos.

Os painéis seguem a referência M1 com tokens/primitives existentes. Progresso é estático/indeterminado; não há spinner ou celebração de XP disparados por retry/pull. Mudanças de estado são anunciadas pelo rótulo acessível e pela jornada; refresh sem mudança não repete o anúncio.

## Verificação

App typecheck/lint aprovados sem warnings novos; 150 testes Node/SQLite e 21 componentes passaram. Os cenários novos verificam envio ativo, recusa comprovada, correção com dependentes selecionadas, identidade incerta sem gerar IDs, trabalho independente, espera 429/503 e conservação de campos após falha transacional. Refresh sem mudança não repete o anúncio acessível. Compatibilidade existente comprova novo build offline em leitura até resposta compatível; o ensaio nativo abaixo cobre o bloqueio persistido do mesmo build.

O teste de cópia inicial usa duas páginas e interrompe após guardar um registro em staging. Nenhum hábito parcial aparece; reabrir SQLite conserva esse registro. Nova tentativa instala a cópia completa. Os testes anteriores continuam cobrindo a conservação da base ativa, histórico e intenções quando a troca atômica falha.

Android visível aprovado no APK final: cinco checkpoints em 390,98 s; um driver e um JUnit aprovados. O roteiro corrige uma recusa real por título concorrente com uma marcação dependente selecionada; cliente SQLite/HTTP independente confirma uma única concessão de 10 XP. Colisão real de identidade conserva original/filha/diagnóstico, sobrevive ao reinício e permite nova criação independente. 429 bloqueia retry manual, 503 pausa remoto e a edição feita durante a pausa chega ao servidor depois da retomada, com XP ainda em 10. Entrada na conta B interrompe a cópia inicial, mantém o gate e retoma somente a conta completa, sem dados de A. Resposta 426 bloqueia criação e o mesmo build continua bloqueado após reabrir.

Evidências: [recusa](../design/evidencias/2026-10-10/sync-android/01-recusa-comprovada.png), [correção confirmada](../design/evidencias/2026-10-10/sync-android/02-correcao-confirmada.png), [identidade incerta](../design/evidencias/2026-10-10/sync-android/03-identidade-incerta.png), [diagnóstico](../design/evidencias/2026-10-10/sync-android/04-diagnostico-preservado.png), [revisão a 200%](../design/evidencias/2026-10-10/sync-android/05-identidade-200.png), [429](../design/evidencias/2026-10-10/sync-android/06-limite-servidor.png), [503](../design/evidencias/2026-10-10/sync-android/07-servico-indisponivel.png), [cópia inicial](../design/evidencias/2026-10-10/sync-android/08-copia-inicial.png), [cópia a 200% após interrupção](../design/evidencias/2026-10-10/sync-android/09-copia-interrompida-200.png), [B completa](../design/evidencias/2026-10-10/sync-android/10-copia-completa-isolada.png), [somente leitura](../design/evidencias/2026-10-10/sync-android/11-atualizacao-somente-leitura.png) e [bloqueio após reinício](../design/evidencias/2026-10-10/sync-android/12-bloqueio-apos-reabertura.png). A captura da cópia a 200% mostra uma nova tentativa já em curso; a interrupção foi observada pelo roteiro antes da captura.

Sete [alvos medidos](../design/evidencias/2026-10-10/sync-android/native-targets.json) passaram: mínimo lógico 44, com arredondamento nativo inferior de 115 pixels a densidade 2,625. Texto 200% observado na revisão de identidade, cópia inicial e gestão bloqueada; conteúdo e ações longos são roláveis. [Auditoria do APK ensaiado](../design/evidencias/2026-10-10/sync-android/bundle-audit.json) aprovada: onze pesos selecionados, três OFL e licença Unicode; a fonte adicional é Material Symbols. Hash conferido depois do ensaio.

Rodadas preliminares localizaram um rótulo composto inacessível ao seletor antigo, uso incorreto de pull sem cursor no observador, reinício da Activity ao ampliar texto e transição entre painéis dependente de tempo fixo. O roteiro passou a reconhecer o rótulo acessível, usar cursor válido e esperar a superfície pública antes de fechar. Um comando redundante de modo claro excedeu o prazo; ele é omitido quando o Android já está claro. A variante de falhas também cortava os dígitos de sync-429/sync-503; o parâmetro foi corrigido e os avisos observados no ensaio. Response usa o construtor suportado no ambiente nativo. Após conferir as capturas, título/texto do carregamento foram alinhados à referência e o roteiro completo foi repetido com o APK final. Build mantém avisos conhecidos de dependências/Gradle/CMake e configuração de cores; checks do app não acrescentaram warnings.

API/check integral aprovado na rodada final: 85 JUnit, cinco Android opt-in ignorados e 13 testes operacionais Python. A primeira rodada falhou no coletor de PrimaryTelemetryTests com probe_process_failed; a origem dessa falha não foi comprovada, e o coletor/teste não foi alterado. A segunda falhou na espera da segunda timeline de WAL. O ensaio isolado revelou a corrida da fixture: ela recriava o marcador a cada consulta; 14 de 20 posições novas ficaram sem confirmação imediata, enquanto a posição fixa foi confirmada nas 20. A espera agora conserva um alvo como a API já fazia, sem ampliar os 15 s nem remover verificações. [Diagnóstico e correção da fixture](2026-10-10-estabilidade-da-espera-wal.md). [Resumo verificável](../design/evidencias/2026-10-10/sync-android/verification.json).

## Reprodução e limites

Na raiz, configurar Java 21, Android SDK, Docker e AVD Pixel_9:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='H:\Android\Sdk'
.\scripts\verify-android-journey.ps1 -Suite sync -FreshTestInstall -EvidenceDirectory docs/design/evidencias/2026-10-10/sync-android
```

A variante descartável dev.ritmo.journeytest usa SQLite/SecureStore e API/Postgres/SMTP reais nos caminhos saudáveis. Falhas 429/503/426 e interrupção da página de snapshot são controladas na fronteira HTTP; a colisão de identidade usa recibo real de conteúdo divergente. Não se declara defeito físico de armazenamento, incidente operacional real ou matriz integral de acessibilidade. A fábrica de falhas exige flag/pacote de ensaio e não acrescenta controles à interface do produto.

Emulador e painel próprios foram encerrados; ADB e a consulta de processos confirmaram ausência do emulador e do acompanhamento. O lançador restaura configurações/variáveis e preserva processos preexistentes, inclusive em falha. FreshTestInstall limpa somente a variante sintética antes do ensaio; a recuperação não apaga bancos. Não há dev server persistente.

M1/Fase 1, iPhone adiado por Q55=B, leitores de tela completos, recuperação por link e aparência persistida permanecem abertos. Próximo recorte recomendado após o aceite local: [05 — recuperação de senha](../../.scratch/interface-m1/issues/05-recuperacao-de-senha.md), sem depender da definição do domínio para o ensaio local.
