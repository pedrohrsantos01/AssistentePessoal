# Gestão nativa de hábitos — recorte 02

Data: 09/10/2026. Escopo: [interface 02](../../.scratch/interface-m1/issues/02-gestao-de-habitos.md), dentro do M1. Referências: [spec/02](../../specs/02-habitos.md), [spec/11](../../specs/11-design-system.md), [spec/13](../../specs/13-contrato-primeiro-marco.md), Q30/Q31 e ADR-017. Não conclui arquivamento, novos tipos/agendas, M1 completo ou Fase 1.

## Entrega

A gestão inclui todos os hábitos ativos, inclusive os cujo início ainda é futuro. O Briefing continua filtrado pelo dia lógico: se há hábitos mas nenhum devido, apresenta esse estado sem sugerir uma conta vazia nem permitir cumprimento antecipado. Criação/edição validam duplicatas contra a lista completa. Não foram introduzidos controles de agendas futuras.

A aba Hábitos usa FlatList com título/ícone, agenda diária e posição, criação e controles acessíveis para mover para cima/baixo. Editar abre formulário com prévia de título, ícone e cor e retorna à gestão. Campos vazios desabilitam salvar; falha conserva o rascunho. O Briefing acompanha a mesma projeção e ordem, sem cópia paralela de domínio.

O formulário conserva sua base de edição e envia somente campos alterados. Uma cor recebida do outro aparelho não é reescrita ao salvar só o título. Chaves desconhecidas ou nulas continuam intactas; fallback visual não migra dados. Nova seleção usa chaves do catálogo, sem índices ou valores hexadecimais. O modo do sistema troca tokens e conserva a escolha sincronizada.

Ordenação usa os inteiros sortOrder existentes e desempate por ID do núcleo. Ao mover, recompõe posições contíguas e enfileira apenas as posições diferentes, dentro de uma transação local externa. Isso resolve empates sem novo campo/schema; falha em uma escrita posterior reverte toda a intenção local e não publica parte do movimento. No servidor, cada comando mantém a transação/recibo previstos no contrato; a UI acompanha a convergência, sem prometer atomicidade remota de vários comandos.

A confirmação de exclusão informa perda de hábito/histórico, reversão do XP e orçamento não devolvido. Cancelar não grava. Falha mantém a confirmação e os dados; sucesso local grava habit.delete e volta à gestão. Offline continua indicado até a confirmação remota. O tombstone e a recuperação existentes impedem ressurreição por edições/recibos antigos. Rejeição comprovada continua preservada pelo núcleo; detalhe das ações pertence ao recorte 04.

A confirmação substitui o conteúdo editável enquanto está aberta, mantendo o estado do formulário no componente. Voltar/Cancelar restaura o rascunho; troca de conta desmonta a confirmação pela chave de sessão. Somente leitura desabilita criação, edição, ordem e exclusão.

## Normalização canônica

A conferência encontrou a validação local antiga por lowercase, que divergia do contrato em nomes como Straße/STRASSE e formas de largura inteira. O app agora usa NFKC + full casefold Unicode + redução de espaços para a chave de unicidade, preservando o título de exibição em NFC. Os fixtures compartilhados e casos de sigma, I com/sem ponto e espaços Unicode verificam essa diferença.

A tabela C+F foi gerada dos [dados Unicode 17](https://unicode.org/Public/17.0.0/ucd/CaseFolding.txt), correspondentes à versão usada pelo [ICU 78.1](https://github.com/unicode-org/icu/releases/tag/release-78.1) já fixado na API. Fonte, SHA-256 e gerador estão versionados; [Unicode License V3](https://www.unicode.org/license.txt) acompanha os assets. Não houve nova dependência, migração ou mudança do contrato/normalization_version.

## Verificação

- App: typecheck/lint e 156 testes aprovados (144 Node/SQLite e 12 componentes).
- Serviço público: edição de campos independentes/metadados desconhecidos, no-op sem nova operação, Unicode, rollback de ordenação, reinício offline, exclusão/XP, hábito com início futuro e recusa de IDs de outra conta.
- Componentes: falha conserva rascunho, cancelar não grava, exclusão falha não finge sucesso, vazio útil, ordem no Briefing, bloqueio por compatibilidade e troca de conta com confirmação aberta e distinção entre lista vazia e nenhum hábito devido.
- API/HTTP: check integral repetido e aprovado após a correção de início futuro (85 JUnit aprovados, 3 opt-in ignorados e 13 testes operacionais Python aprovados). O cliente HTTP passou seus 9 cenários, incluindo o novo que usa Journey/Session/SQLite reais, cliente independente, campos combinados, ordenação, exclusão, tombstone, rejeição recuperável de edição atrasada e orçamento consumido preservado, gestão/edição de início futuro e validação da duplicata antes do início.
- Android: APK atualizado compilado e verificado; [auditoria do bundle](../design/evidencias/2026-10-09/gestao-android/bundle-audit.json) confirma os onze pesos selecionados, três OFL e licença Unicode. Ensaio visível aprovado em 426.08 s, com edição de título/ícone/cor, ordem, cancelar/confirmar exclusão, reinícios offline, cliente independente, convergência de XP e início futuro. Capturas em [gestão offline](../design/evidencias/2026-10-09/gestao-android/11-gestao-offline.png), [confirmação](../design/evidencias/2026-10-09/gestao-android/14-confirmacao-exclusao.png), [texto 200%](../design/evidencias/2026-10-09/gestao-android/16-gestao-texto-200.png), [início futuro](../design/evidencias/2026-10-09/gestao-android/18-gestao-inicio-futuro.png) e [nenhum devido](../design/evidencias/2026-10-09/gestao-android/19-briefing-sem-devidos.png). [Alvos nativos](../design/evidencias/2026-10-09/gestao-android/native-targets.json) aprovados; [resumo da verificação](../design/evidencias/2026-10-09/gestao-android/verification.json). Emulador e painel iniciados pelo ensaio foram encerrados.

## Reproduzir e limites

Na raiz, configurar Java 21, Android SDK, Docker e AVD Pixel_9:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='H:\Android\Sdk'
.\scripts\verify-android-journey.ps1 -Avd Pixel_9 -Serial emulator-5560
python scripts/audit-android-journey-bundle.py --output docs/design/evidencias/2026-10-09/gestao-android/bundle-audit.json
```

O executor mantém a primeira jornada e acrescenta gestão. EvidenceDirectory permite escolher destino dentro do workspace sem sobrescrever as capturas do recorte 01. API/SMTP/Postgres são descartáveis. Rede, fontes, modo e animações são restaurados; emulador/painel próprios são encerrados mesmo em falha. Não há servidor de desenvolvimento persistente. O build pode emitir avisos das dependências nativas já registrados no recorte 01; eles não são ocultados.

Próximo recomendado: [sessão e exceções locais — 03](../../.scratch/interface-m1/issues/03-sessao-e-recuperacao-local.md). Recuperação detalhada, links de senha e preferências persistidas continuam nos recortes seguintes. iPhone 16e segue adiado por Q55=B; TalkBack/VoiceOver e matriz integral nos aparelhos permanecem com seus aceites. Virtualização foi implementada; não se declara um benchmark de desempenho para listas extensas neste incremento.

A edição de metadados preserva byte a byte o título canônico quando o campo não foi alterado, inclusive NBSP/FEFF que Java strip conserva. Serviço público e cliente HTTP verificam que mudar só a cor não gera patch de título. No roteiro nativo, o relógio fixo do fixture exigiu usar serverTime para a intenção no limite de 24 horas; o aceite é conferido antes de esperar a UI. A rodada anterior passou a gestão/exclusão e falhou ao esperar uma criação recusada por esse limite, com diagnóstico preservado na pasta de trabalho.

O teste adicional de componente encontrou uma leitura do editor ainda restrita aos hábitos do Briefing; ela foi corrigida e os checks repetidos antes do ensaio final. O cliente independente do roteiro usa retry limitado somente para falhas de transporte classificadas pelo contrato; reaproveita as mesmas intenções e nunca transforma rejeição de negócio em sucesso.

Se a reinstalação da variante descartável encontrar falta de espaço, usar -FreshTestInstall: remove somente dev.ritmo.journeytest depois de validar o APK e confirmar o emulador. Esse opt-in reinicia os dados sintéticos anteriores; a persistência durante a jornada continua sendo testada. O ensaio final usou essa opção após INSTALL_FAILED_INSUFFICIENT_STORAGE; o executor também fechou a rodada que não chegou a instalar.
