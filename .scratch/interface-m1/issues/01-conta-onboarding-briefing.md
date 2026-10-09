# 01 — Conta, onboarding e primeiro valor no Briefing

Status: ready-for-agent
Blocked by: none

## Resultado esperado

Entregar entrada/cadastro/login → fuso/dia → primeiro hábito ou pular → Briefing útil. Marcar/desfazer offline e consultar após reinício.

Tokens tipados, fontes embarcadas e primitives entram junto aos controles usados. Introduzir entrada do produto preservando harnesses. UI acompanha projeção local e geração da sessão; não copia dados/timers do protótipo.

## Aceite

- Identidade real, validação canônica/cofre antes de ativar; offline explica conexão e preserva campos.
- Onboarding local retomável; pular abre CTA útil sem pedir permissões futuras.
- Primeiro hábito binário diário; marcar/desfazer pelo SQLite e XP correto, inclusive limite sem prêmio. Transação falha não anuncia sucesso.
- Briefing com provider local, data/dia lógico/saudação/hábitos/XP reais; criação continua disponível após pular.
- Bloqueios mínimos de instalação/sessão impedem renderizar dados não autorizados desde esta primeira versão; detalhe dos avisos no recorte 03.
- Teste de componente/jornada pelos serviços públicos; Android visível prova offline → fechar/reabrir → fila retomada com API real. Evidência distingue iPhone/produção pendentes.
- Holograma segue modo do sistema; tokens contemplam seis conjuntos sem duplicar componentes. Seleção persistida de aparência não é simulada aqui.
- Alvos 44, texto 200%, teclado/safe areas e fonte offline; link de privacidade corrigido. Teste automatizado dos pares de contraste dos tokens nativos e fundos compostos permitidos.

## Referências

REQ-CTA-001/004/004b/006/008/009; REQ-HAB-001/003/004/004a; REQ-BRF-000/001/003/005; REQ-DS-000 a 006; contratos M1 correspondentes. Não declara matriz inteira aceita.

## Resultado

Concluída: sim, no escopo local deste recorte. [Relatório e evidências](../../../docs/analises/2026-10-09-interface-primeira-jornada.md): typecheck/lint, 145 testes do app, check integral da API e jornada Android visível com API real aprovados. Primeiro valor, retomada do onboarding, marcar/desfazer offline, kill/reopen e convergência em 10 XP verificados. Emulador/painel encerrados. O aceite do M1 completo, iPhone e matriz integral de acessibilidade permanecem nas tarefas próprias.

## Comments

09/10/2026: criado após incorporar o protótipo; execução/aceite nativo pendentes.

09/10/2026: implementação nativa e aceite Android do recorte 01 concluídos. Fontes/licenças embarcadas, tokens tipados, dados reais e isolamento de conta; próximo recorte recomendado: gestão de hábitos (02).
