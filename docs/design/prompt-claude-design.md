# Prompt para o Claude Design — Ritmo

**Como usar:** anexe `briefing-claude-design.md` e copie o texto abaixo para o Claude Design. O briefing contém o contexto completo, sem precisar dar acesso ao repositório. Os caminhos citados no anexo são referências para o time.

---

Quero desenvolver o protótipo navegável da interface mobile do **Ritmo**, assistente pessoal modular para iOS e Android, em português brasileiro. Use o anexo **“Ritmo — briefing funcional para o Claude Design”** como contrato de comportamento e escopo.

A tese é **entregar algo antes de pedir qualquer coisa e registrar a própria vida em poucos toques ou uma frase curta**. O Briefing é a home/única tela diária; hábitos e tarefas têm gestão e histórico. Não crie outra tela “Hoje”. O dispositivo principal é iPhone 16e; a experiência também precisa funcionar no Android.

**Entregue protótipo com estados/jornadas, proposta visual e handoff de implementação.** Identidade visual aberta, para minha aprovação, Pedro. Proponha/justifique tipografia, densidade, paleta, cards e celebrações. Identifique escolhas como propostas, não aprovadas.

Organize conjuntos distintos:

1. **M1 — principal:** conta e-mail/senha e recuperação; onboarding retomável de fuso/início do dia (04h padrão); primeiro hábito binário diário opcional; Briefing saudação/hábitos/XP básico; offline/sync/reautenticação/logout. Construa primeiro, incluindo falhas. Não mostrar como disponíveis voz, tarefas, Agenda, níveis, ofensivas, proteções ou conquistas.
2. **Fase 1 completa:** tarefas/recorrências, outros hábitos/histórico, Agenda Google, gamificação completa, assistente texto/voz, notificações locais, privacidade/exportação/exclusão.
3. **Fase 2A planejada:** notícias/futebol/mediação de agenda, separada. Dados de jogos/notícias demonstrativos.
4. **2B/3 hipóteses:** sem formulários/regras finais inventados; no máximo visão futura anotada.

Regras críticas:

- Local primeiro: **não salvo**, **salvo no aparelho**, **aguardando confirmação** e **recusado** diferem. Falha local retira check/XP otimista.
- Logout offline preserva pendências isoladas e exige login online para reentrada; expiração remota offline mantém uso local.
- Hábitos/XP: dia lógico (04h padrão). Prazo de tarefa: meia-noite civil. Agenda: fuso do dispositivo. Desenhe caso de 00:30 sem confundir datas.
- Agenda/meta de hábito alteradas offline são propostas; após aceite remoto, próximo dia lógico. Mudança de agenda envolvendo N vezes/semana: próxima segunda lógica. Antes, regra antiga vale.
- Duplo toque/retry não duplicam XP/cumprimento; desfazer/remarcar restaura prêmio original. Quantitativos somam contribuições; desfazer retira só a escolhida.
- Recusa preserva conteúdo/recuperação; resultado incerto exige reconciliação, não correção que duplica envio.
- Versão incompatível consulta local, sem criar/editar/marcar/corrigir/descartar/sync; novo build offline continua protegido até verificação online.
- Assistente confirma hábito recorrente/exclusão/evento sempre; lotes/datas distantes conforme briefing. Sucesso parcial repete só falhas.
- IA/analytics/permissões separados; recusa permite manual. Voz real/offline e notificação em background não garantidas: simule/anote.
- Gamificação sem culpa, ranking ou punição. Proteção não é cumprimento/XP.

Represente estados aplicáveis: carregando, vazio/contextual, sucesso, erro, offline, pendente, recusa, desabilitado e pressionado. Não entregue só caminho feliz. Microcopy pt-BR clara, erro junto ao campo/próxima ação.

Claro/escuro com componentes compartilhados, contraste 4,5:1, toque 44 pt, fonte 200%, nomes/ordem acessíveis, informação além de cor, teclado/áreas seguras/redução de movimento. Transições até 320 ms; celebração até 1,5 s, dispensável/não bloqueante.

Forneça:

- Protótipo navegável mobile, ações/retorno/estados simulados identificados.
- Mapa de navegação, indicando proposta de composição visual.
- Biblioteca de componentes/tokens semânticos propostos e variantes claro/escuro.
- Cobertura **D01–D29** do anexo: representada, anotada ou pendente, com localização.
- Handoff por tela: objetivo, entradas, ações, destinos, validação, vazios, erros, restrição de fase.
- Decisões visuais para minha revisão e lacunas de produto abertas.

Comece M1/estados que garantem confiança; depois expanda. Limitação da ferramenta para armazenamento/rede/voz/notificação vira estado e anotação, nunca afirmação de integração real.

Não acrescente login social, convidado, monetização, social, Agenda mensal, Notion, edição de evento existente ou funções financeiras/saúde como aprovadas. Não exponha banco, JSON, tokens ou IDs internos nas telas.

Lacuna: consulte seção 19, preserve decisão existente e identifique alternativas propostas. Explorar composição visual é permitido; regra nova de produto exige minha aprovação.

---

Anexo: [briefing funcional completo](briefing-claude-design.md).
