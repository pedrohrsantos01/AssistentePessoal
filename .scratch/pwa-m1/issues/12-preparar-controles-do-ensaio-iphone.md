# 12 — Preparar controles do ensaio no iPhone (02c, cliente técnico)

Status: ready-for-agent
Blocked by: none — adapters09/10 e contrato02a disponíveis; publicação/execução física continuam com dependências externas da tarefa02

Origem: spec/14 §5 e [roteiro02c](../../../web/ops/https-iphone.md). A entrada coordination.html atual depende do bridge de automação, sem controles suficientes para Pedro operar Safari/Tela de Início a partir do Windows. Não promovê-la a produto.

## Entrega delimitada

Uma entrada técnica e build isolados, acionáveis por toque, sobre os adapters reais, sem importar/expor bridge destrutivo no bundle de produto. Textos em i18n e tokens Ritmo-App existentes; indicar escopo sintético de forma inequívoca. Não iniciar a jornada03 por este arquivo.

Concretizar id/scope/start_url e recursos do manifest técnico para os dois modos de abertura; não reutilizar por inferência o manifest /probe/ da prova01 como produto. Uma instalação nova exige login online explícito próprio Q70; estado legível e bloqueado quando capacidades essenciais faltarem, sem fallback inseguro.

Oferecer os comandos e diagnósticos mínimos do roteiro: preparação/login com contas sintéticas do ambiente, alterações locais/reabertura/sync, posse e retomada, logout/isolamento, falhas delimitadas e atualização em espera. Dados privados/senhas nunca no diagnóstico/relatório; nenhum botão apaga banco/fila ou gera nova identidade para ocultar resultado desconhecido. Não prometer crash do OS, background sync ou garantia de persistência.

Separar claramente o que a fixture permite acionar do que depende do operador/plataforma: suspensão, fechamento de documento e mudança de rede reais; APIs indisponíveis devem gerar resultado não executado/bloqueado apropriado. Não afirmar prova física a partir de Chrome/WebKit desktop.

## Aceite

Build técnico verificável com Java/IndexedDB reais em navegador visível e controles por interação, sem depender de evaluate/console para executar o caminho manual. Preservar os testes09/10 e encerrar somente recursos próprios. Roteiro e ficha de execução em web/ops/https-iphone.md devem ser atualizados com os controles efetivos e limites observados.

## Resultado

Concluída: não — recomendada após pacote local11. Este recorte pode avançar sem nome de domínio; o ensaio externo02c exige origem aprovada/TLS e participação no iPhone. Publicação não autorizada por inferência.
