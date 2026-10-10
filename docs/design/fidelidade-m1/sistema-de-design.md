# Sistema de design para a revisão do M1

O sistema canônico é [spec/11](../../../specs/11-design-system.md). Este resumo delimita a revisão das telas já implementadas, sem habilitar os recortes futuros.

- Holograma segue o modo nativo. Paletas, fontes locais, pesos, raios, dimensões e movimento vêm do catálogo e dos tokens tipados.
- Componentes usam tokens; toda copy vem de i18n. Corpo Chakra Petch, números/estados JetBrains Mono. Public Sans é do painel externo.
- Correções de acessibilidade prevalecem: texto 4,5:1, controles 3:1, toque mínimo 44, texto até 200%, foco/modal e redução de movimento nativos. Borda interativa usa alpha 0,48.
- Formas/ícones/texto acompanham estados. Sem falha local apresentada como salva. Sem sucesso ou XP fabricado por timer.
- Holograma: raio 4, colchetes e scanline somente nos cards decorados. Fuso, início do dia e perfil são superfícies simples. Navegação usa os três ícones de traço da referência.
- Leituras e comandos continuam no núcleo real. Preservar sessão, SQLite, isolamento, fila e XP. Q30/Q31/Q51–Q53 prevalecem sobre o handoff.
- Aparência persistida, recuperação por link e ações detalhadas de exceção permanecem em seus recortes. Ajustes mostra capacidades implementadas, sem controles inertes.
