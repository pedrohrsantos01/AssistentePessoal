# Recorte 06 — contrato de aparência e preferências

Estado: contrato confirmado por Pedro em Q58=A, 12/10/2026; implementação em andamento.

## Decisões confirmadas

- Q56=A: preferência da instalação, disponível antes do login. Persiste no reinício, logout e troca de conta; aparelhos independentes. Reinstalação começa em Holograma + seguir sistema.
- Q57=A: áudio em recorte próprio. M1 permanece sem som; não apresentar interruptor sem funcionamento.
- REQ-DS-001: aparência e modo independentes. Aparências Holograma/Cockpit/Neo-tokyo; modos seguir sistema/claro/escuro. A opção seguir sistema reage a mudanças do aparelho; modo manual permanece estável.
- Referência visual: Ritmo-App.dc.html, seleção fase=m1. Mesmas telas e componentes para os seis conjuntos; nenhuma capacidade futura antecipada.

## Contrato técnico local aprovado

Usar SQLiteStorage de expo-sqlite/kv-store no banco separado ritmo-preferences.db, com a dependência expo-sqlite já instalada; não ampliar o controle crítico da instalação, os bancos por conta, o perfil remoto ou o protocolo de sincronização. Esta é uma exceção delimitada ao uso de Drizzle: somente configuração visual em key/value; domínio e controle de sessão mantêm Drizzle e suas migrations. A tabela interna da biblioteca é storage(key TEXT PRIMARY KEY NOT NULL, value TEXT), sem DDL de domínio. Representação: uma chave appearance contendo JSON versionado com version=1, skin=holo|cockpit|neo e mode=system|light|dark. Validar a representação antes de usar. Nenhuma credencial, identificação de conta ou dado de domínio nesse armazenamento.

Ausência de preferência é primeira utilização: Holograma + seguir sistema, sem aviso. Ler antes de apresentar a jornada; falha de leitura não deve impedir a abertura da sessão. Este contrato será registrado no spec/00 junto da implementação; armazenamento local não exige DDL de servidor/Flyway.

## Q58=A — política de falha aprovada

Regra aprovada: dados de preferência ilegíveis, versão desconhecida ou armazenamento indisponível conservam o arquivo/valor. Exibir Holograma + seguir sistema e aviso acessível com nova tentativa; suspender novas escolhas enquanto não houver leitura válida, sem apagar nem sobrescrever. Falha de gravação mantém a última escolha confirmada e oferece nova tentativa explícita; aplicar mudança somente após persistir. Nenhum reset, retry em laço, chamada remota ou bloqueio dos hábitos/sessão causado por esta preferência.

Pedro confirmou o contrato e sua implementação com Q58=A. Bloqueio integral por preferência visual não foi escolhido.

## Entrega e verificação previstas

- Seletores nativos em Ajustes com a composição da referência, alvos de toque e seleção acessível; aparência aplica fonte, geometria, decoração e cores. Status bar acompanha o modo efetivo.
- Fluxos atuais preservados: entrada/conta/onboarding, Briefing, gestão, painéis de sessão/sincronização e recuperação de senha.
- Testar primeira abertura, gravação/reinício, troca de conta/logout, mudança do sistema com opção automática/manual, ausência/valor inválido/versão futura e falhas de armazenamento.
- Verificar seis conjuntos, texto 100%/200%, conteúdo longo, teclado e safe areas; composição de contraste e identidade de cor do hábito.
- Ensaio Android visível, abrindo e fechando apenas os recursos usados pelo agente. TalkBack e redução de movimento devem ter evidência nativa; rótulos XML ou Chromium não substituem leitor real. Medir desempenho real e registrar limitações, sem declarar timer como prova.
- Rodar typecheck/lint/test e API check ao concluir código. Relatório local, commit semântico e nota concisa verificada na memória.
- iPhone/VoiceOver e associações de links públicos mantêm os gates existentes; Q55=B adia iOS e M1 integral permanece aberto.

## Fatos conferidos

No início deste recorte, ThemeProvider usava Holograma e useColorScheme; tokens dos seis conjuntos e fontes locais já existem. Controle installation.db é crítico para sessão/compatibilidade (Q51); não tem preferência de aparência definida. expo-sqlite 57.0.3 oferece SQLiteStorage com nome de banco próprio e métodos assíncronos; o envelope do produto exige validação própria.

As regras Android atuais de expo-secure-store incluem somente sharedpref e excluem SecureStore, deixando bancos SQLite fora do backup automático e da transferência. Revalidar manifesto/regras empacotadas e reinstalação no novo APK. [Semântica oficial do include](https://developer.android.com/identity/data/autobackup); [API de armazenamento Expo](https://docs.expo.dev/versions/latest/sdk/sqlite/).

## Árvore de decisões

Q56 (resolvida: instalação) → representação local isolada e ciclo de vida → Q58=A (falhas + contrato confirmado).
Q57 (resolvida: áudio futuro) → nenhuma decisão de áudio neste recorte.
Todas as decisões deste contrato estão fechadas. Incorporar aos specs e executar; confirmação de contrato não é evidência de implementação ou aceite.

## Implementação verificada

Contrato implementado;202 testes do app e rodada funcional Android3 passaram. Resultado/limites e revisão final em [relatório do recorte](../../docs/analises/2026-10-12-interface-aparencia-e-preferencias.md). Desempenho, matriz integral de leitor de tela e iPhone/VoiceOver permanecem fora dessa comprovação parcial.
