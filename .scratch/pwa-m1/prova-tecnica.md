# Prova01 — desenho do ensaio isolado

21/10/2026. Autorização: tarefa01 e ADR-020. Implementação em `web/`, exclusivamente com fixtures sintéticas; não é a jornada M1 de produção.

Reutilizar `project.ts`, tipos do protocolo e tokens do aplicativo por imports puros. A apresentação React DOM não importa React Native/Expo. Fontes Chakra Petch/JetBrains Mono e ícones já licenciados são empacotados localmente.

## Banco experimental

IndexedDB/Dexie usa os nomes/campos dos DDLs `app/drizzle/0000_account.sql` e `app/drizzle-control/0000_installation.sql`: installation_control, sync_state, canonical_entities, sync_mutations e projected_views. O ensaio reduz os registros ao necessário e guarda valores tipados, sem serialização SQLite. Não é schema/migração de produto aprovado.

V1 contém controle, estado, entidades e intenções; V2 acrescenta projeções e recompõe a partir de entidades+intenções na mesma migração. Nenhuma transação aguarda HTTP, crypto ou outro trabalho externo ao IndexedDB. Falhas são propagadas; projeção, intenção e next_sequence precisam confirmar juntas.

Fixtures A/B possuem um hábito binário diário cada, um dia fixo e identidade sintética. Não há login, credenciais, sincronização, resposta de servidor ou promessa de XP definitivo. Injeção de QuotaExceededError verifica rollback; não simula pressão real de disco/Safari.

## Candidato à exclusão de escrita

Web Locks exclusive por origem/instalação da prova; ifAvailable na abertura e steal somente ao pressionar assumir. Cada aquisição incrementa session_generation em transação. Toda escrita inclui installation_control e valida a geração e conta selecionada antes de gravar. Roubar Web Lock sozinho não para o código antigo; a geração cerca esse código. Leitura secundária permanece disponível; indisponibilidade do recurso bloqueia escritas. Esse é um candidato experimental, sem aprovação implícita do protocolo definitivo da tarefa02.

## Cache e ensaio

Workbox precacheia somente build, ícones e fontes locais. Sem cache de API, sem escritor no service worker, sem ativação forçada de atualização. React Router exercita rotas de fixtures. Servidor estático loopback e navegador visível pertencem a um job finito, encerrados em finally; nenhum servidor de desenvolvimento persistente é iniciado.

Verificar atomicidade e falhas/migração em testes determinísticos; no Chromium visível, reabertura offline com o mesmo perfil, IDs/seq/projeção, duas abas e congelamento/retomada. Safari físico/HTTPS/iOS continuam gate explícito: emulação de viewport não equivale ao iPhone16e.
