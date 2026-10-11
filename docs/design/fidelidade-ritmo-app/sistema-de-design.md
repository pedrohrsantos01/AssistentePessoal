# Sistema de design — referência corrigida

Fonte única: [Ritmo-App.dc.html](../../../Protótipos%20de%20assistente%20pessoal/Ritmo-App.dc.html), estado `fase=m1`. Pedro corrigiu a referência em 11/10/2026. [Tokens extraídos](../tokens-prototipo-app.json) registram as seis paletas; [critérios](criterios-de-qualidade.md) organizam as comparações. Valores nativos tipados em app/src/theme/tokens.ts. Cores, medidas, fontes e raios não são literais nos componentes; textos em pt-BR.ts.

## Tipografia, formas e cor

Chakra Petch 400/500/600/700 no Holograma/Cockpit; Space Grotesk nos estilos Neo; JetBrains Mono 400/500/700 para números/data/legendas. Holograma atual usa marca 40/700, título 28/600, corpo 16, contexto 15, rótulo 14/600, status 13, legenda mono 12 e aba 11. Entrada tem descrição 17/1,5; onboarding corpo 16/1,5; linha de hábito 16/1,3.

Holograma claro: fundo #EDF4F4, superfície #FFFFFF, texto #0B1B20, secundário #4B6972, destaque #0B7A68. Escuro: fundo #04090F, superfície #08141D, texto #D7ECF5, secundário #88AEBF, destaque #63F5D8. A extração JSON/HTML prevalece para todos os valores; o spec/11 registra os ajustes semânticos de contraste. Não usar cor de um círculo decorativo como texto funcional.

Cards/botões internos Holograma têm raio 4; colchetes 10 a 5 do canto e scanline 1 a cada 4 apenas nas superfícies que os usam no HTML. Lista de gestão e grupos de ajustes mantêm fundo, contorno e divisores do HTML; não usam scanline ou colchetes decorativos. Entrada usa marca 68, borda 1,5, brilho 28 e scanline, sem colchetes ou card externo. Campo 48, ação 52, controle≥44. Controles distinguem normal/selecionado/desabilitado/carregando sem depender apenas de cor. A opacidade 0,55 do estado desabilitado preserva a referência; texto/contorno funcionais cumprem os mínimos, enquanto controles realmente inativos são dispensados dessa medida pelos [critérios 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) e [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) do W3C. Isso não dispensa indicar semântica de desabilitado. Em somente leitura, nome, descrição, emoji e estado informativo do hábito continuam com a opacidade e o contraste normais; esmaecer apenas seus controles indisponíveis (check, chevron, ordem e criação), preservando o bloqueio de interação da linha.

## Composição verificável

- Entrada: gutter 24/topo 40/rodapé 44, bloco central flexível com intervalos 16; duas ações inferiores 52/gap 12.
- Conta: gutter 24/gap 16, back 44 com glyph 22, rótulo 14/gap 6, campo 48, Mostrar 84. Links 15/600 centrais em alvo 44, sem contorno.
- Onboarding: gutter 24/topo 20/gap 18; PASSO N DE 2 mono 12 acima de duas barras 4/gap 6. Horas 48 em quatro colunas. Primeiro hábito mostra cinco sugestões em chips 44, campo Nome 48 e espaço flexível até a ação 52/Pular/Voltar 44. Sem catálogo ou preview nessa etapa.
- Briefing: gutter 18/topo 10/gap 12; data 12 mono, saudação 28/600, chip XP 12 mono com inset 5× 10 abaixo/margem 10. Sem card separado de saldo 36. Hábitos em card único/padding 16/16/6, título 16/600, contador 13; linhas 60, check 28 em alvo 44, emoji 17 sem tile. Apenas informações necessárias de pendência/limite/erro podem ampliar o estado. Vazio contém mensagem 15 e ação 48.
- Gestão: gutter 18/topo 10; título 28/+Novo 44/14, lista padding 2× 10, linha 64/padding 8× 4, emoji 20 sem tile e chevron. Criação: gutter 20/gap 18, campo 48, informação de tipo binário; ícones 52 em cinco colunas/gap 6/font 22; cores 64 em cinco colunas/gap 6/círculo 22/rótulo 11. Preview pertence à edição. Ajustes usa grupos compactos/linhas separadas.
- Barra inferior: três abas M1, glyphs ☀/◎/⚙ de 18, rótulo 11/gap 2, alvos 44. Sheets: overlay, superfície com borda superior 1/raio 22, máximo 88%, padding 10/20/40 (rodapé mínimo 40 ou safe area maior), gap 14; handle 40× 5/raio 3 no conteúdo rolável. Ações de confirmação/cancelamento usam o mesmo sistema.

## Adaptação e exceções autorizadas

Preservar contraste textual≥4,5 e controle≥3 (spec/11), alvos 44, estado semântico, texto 200%, safe areas reais e redução de movimento. Teclado aberto deve permitir rolar e expor integralmente as ações; encontrar um retângulo XML atrás do IME não comprova alcance. Não é necessário mostrar todas as ações simultaneamente acima da dobra. Android escala fontes não linearmente; CSS 200% do simulador não define alturas nativas exatas. Moldura/status/homebar do iPhone simulado não são componentes do app.

Diferenças autorizadas: nome/privacidade no cadastro; senha 8–128; hora 0–23/fusoIANA; título 120; mensagens de pendência/limite/erro reais; ordem/exclusão e preview de edição; controles atuais de sessão/sync e perfil. Recuperação por link e preferências continuam recortes 05/06; não exibir controles fictícios. Ícones/cor legados existentes continuam renderizáveis e editáveis.

A referência não dá origem a localStorage, clocks/contas/XP simulados ou HTTP em componentes. Telas usam somente Journey/SQLite e seus fluxos reais.

Status descritivos de sincronização: o controle compacto usa “Cofre indisponível”, “Autenticação necessária”, “Atualização necessária”, “Requer atenção” ou “Serviço indisponível”. O aviso ou painel conserva a explicação completa; o controle mantém o rótulo acessível completo e a ação de sincronização. Usa raio interno 4 e largura limitada à área disponível. Texto ampliado deve quebrar sem a borda cruzar as linhas. Estados curtos normais mantêm sua pílula original. Essas mensagens descrevem condições reais; não permitem escritas quando a base está em somente leitura.
