# Próximo recorte — experimento do checkmark persistente

Status: ready. Não iniciado. Origem: issue06, spec/07 §1 e [perfil da apresentação](../../docs/analises/2026-10-21-apresentacao-do-cumprimento-m1.md).

A coorte diagnostico2 mantém o APK leve 9c6bdca5, acrescentando trace nativo: vinte interações, p50/p95/máximo 130,9812/219,4891/411,7630 ms, nenhuma ≤100 ms. No pico 10/1, React→frame tomou 309,3733 ms: residência JS/UI/render de 2,6748/34,2683/268,4081 ms. A seção glGenTextures encode ocupou 195,1819 ms de parede no RenderThread; a UI passou 257,9369 ms em postAndWait. Isso não identifica GPU, CPU útil ou interferência do host.

Cada uma das dez marcações criou um RCTImageView; os dez desfazimentos não o criaram. HabitRow monta condicionalmente o PNG checkIcon. Essa correlação permite escolher um experimento, sem provar que a imagem explica o pico do encoder.

Uma única intervenção candidata: conservar a instância Image do checkmark, com o mesmo bitmap/tamanho/alinhamento, alternando o tint entre onAccent e o token transparente. O estado aberto deve continuar visualmente vazio. Não substituir o asset por texto, redesenhar o símbolo, antecipar o checked ou alterar persistência/XP. Testar antes a identidade da imagem nos ciclos aberto→feito→aberto e manter a regressão de falha do SQLite.

Preservar o APK baseline e seu hash antes de reconstruir. Comparar com observação equivalente (-Performance -Presentation -PerformanceMode lightweight), mesma configuração de conta/aparelho e critérios: dez processos frios, vinte alterações offline, gesto/frame v4, trace integral sem perdas, clocks e threads validados, todas as amostras válidas. Medir também abertura/cards: não esconder trabalho deslocando a origem nem dispensar as metas 2 s/300 ms. A referência atual de abertura é 10/10≤2 s; cards 0/10≤300 ms. Não comparar causalmente com a confirmação sem trace de 20/10.

Conferir pelos marcadores se as novas montagens de RCTImageView saem do caminho do gesto. Se a alteração não trouxer benefício sustentado ou degradar as demais garantias, revertê-la e preservar o resultado negativo. Não repetir uma coorte válida para escolher números melhores. Limitar este recorte a esse experimento; outras hipóteses exigem novo recorte.

Checks completos app/API, comparação visual dos dois estados com o mesmo asset e ensaio visível com fechamento dos recursos próprios. Reinício e cliente HTTP/SQLite independente devem confirmar um hábito/10 XP sem duplicação. Metas de desempenho, aparelhos físicos/iPhone e aceite integral do M1 permanecem abertos até suas provas.
