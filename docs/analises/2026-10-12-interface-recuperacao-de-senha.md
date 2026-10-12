# Recuperação de senha na interface — recorte 05

Data: 12/10/2026. REQ-CTA-003/004c e REQ-DS-000/003/004. Concluído localmente: app/API e ensaio Android visível aprovados. O M1 integral continua aberto.

A jornada usa a referência Ritmo-App, fase=m1, e o transporte de identidade existente. Solicitar retorna a mesma mensagem condicional para conta conhecida/desconhecida; não autentica nem altera o SQLite. O formulário preserva campos em falha, indica conexão/indisponibilidade e respeita Retry-After por endpoint, inclusive ao fechar/reabrir. Nenhuma nova tentativa automática de e-mail.

A entrada +native-intent intercepta o URL antes do estado do Router, devolve somente / e entrega uma intenção transitória ao controlador. Origem HTTPS, caminho e fragmento são validados pelo parser existente. Token nunca aparece no estado público, rota, interface, SQLite ou SecureStore; a referência transitória do controlador é removida ao fechar, substituir o link, confirmar, receber resultado definitivo ou encerrar o owner. Abrir o link não chama confirmação.

Nova senha usa 8–128 pontos de código, sem trim/normalização e recusando surrogate isolado. Salvar online faz o POST real; o servidor troca a senha, consome o link e revoga as famílias conforme contrato. Não cria login automático. Dados/pendências ficam preservados; conta ativa retorna à reautenticação da mesma conta. Falhas transitórias conservam a intenção para retry deliberado; inválido/usado/expirado compartilham mensagem que permite pedir outro link. Banco/controle/logout mantêm prioridade; a identidade pode recuperar conexão sem ativar uma cópia parcial. Painéis anteriores não cobrem o formulário; retorno explícito ao login fecha esses painéis.

## Referência e composição

Formulários usam gutter 24/gap 16, título 28/600, corpo 16, campo 48, ação 52 e mostrar 84 dos tokens. A instrução antes do pedido solicita um link, em vez de declarar envio anterior ao POST; cabe na composição original. Aceitação mantém caixa com envelope, mensagem condicional, retorno e outro e-mail. O HTML não contém tela de nova senha: ela reutiliza os mesmos primitives de conta, sem inventar paleta/layout paralelo.

[Capturas originais 100%/200%](../design/evidencias/2026-10-12/recuperacao-referencia/) em Chromium visível com fontes carregadas. Só área da moldura/viewport foi normalizada. Comportamento do protótipo é simulado e não certifica API/SMTP. [Native intent do Expo](https://docs.expo.dev/router/advanced/native-intent/) e implementação instalada do Router foram conferidos por Context7. Não foi adicionada dependência ou migration. [Comparação nativo/referência100%](../design/evidencias/2026-10-12/recuperacao-comparacoes/01-solicitacao-100.png) mantém área útil e registra a diferença de copy; contorno funcional preserva a correção de contraste.

## Verificações

- App: typecheck/lint e 192 testes (157 domínio/controladores + 35 componentes), sem snapshots. Segredo ausente do estado, unicidade do mailbox, senha exata, offline/transiente/401/429, late response, preservação de fila/XP/metadados e prioridade de abertura/foco cobertos.
- API check: 85 testes Java aprovados e 13 operacionais; seis casos Android são opt-in separados. Nenhuma alteração de comportamento na API; somente fixture de ensaio SMTP em loopback.
- Bundle: 11 pesos locais esperados, três OFL e licença Unicode; Material Symbols adicional preexistente. [Auditoria e checks](../design/evidencias/2026-10-12/recuperacao-android/).
- Android: cinco fases, seis medições de alvos e treze capturas na [rodada final](../design/evidencias/2026-10-12/recuperacao-android/rodada-3/verification-summary.json). Solicitação/SMTP, entrada quente/fria, teclado200%, confirmação, revogação de refresh, reabertura/reentrada/sync e inválido/usado/expirado/desconhecido aprovados. Emulador e acompanhamento encerrados.

## Fronteiras e falhas do ensaio

O método JUnit prepara Spring/PostgreSQL/GreenMail reais e um pequeno bridge de mailbox/relógio em 127.0.0.1, ausente do artefato de produção. O driver usa destinatários example.test e envia o URL recebido pelo SMTP à MainActivity com intent explícito. Isso verifica entrada quente/fria e fragmento no app; não certifica associação pública App Links/Universal Links.

A primeira tentativa parou na inicialização do observador: pull sem cursor exige snapshot. Fixture corrigida para synchronize(), sem contornar o contrato. Na segunda, troca de senha/teclado/entrada passaram, mas a expectativa de reautenticação antecipou a janela stateless de 15 min; o relógio de resets não altera a validação do JWT. O ensaio final força somente accessExpiresAt no adapter de leitura do cofre, fazendo o app chamar refresh real já revogado; não simula 401/sucesso. Indisponibilidade da rota de sync é controlada enquanto a confirmação usa HTTP real, para preservar pendências até a reentrada. Expiração do link é controlada pelo relógio de teste do servidor. Uma tentativa adicional parou antes do teste por falha de streaming do ADB sem diagnóstico; o lançador agora tenta o mesmo APK validado pelo modo não streaming após a falha. O ensaio final instalou normalmente e passou. Esses eventos não são contabilizados como aceite; capturas anteriores ficam históricas.

## Limites e sequência

Nenhum envio externo, configuração Resend/domínio, deploy ou compra. Domínio/Q54 e associações públicas continuam no aceite existente; Q55=B mantém iOS adiado. TalkBack/VoiceOver integrais e toda a matriz dos aparelhos continuam pendentes. Os pareceres A3/B2/C4 de 11/10 avaliam as telas anteriores; este recorte usa checks e comparação próprios, sem herdar aprovação visual dessas telas.

Próximo recorte: 06, aparência/preferências. Continua needs-info para definir custódia, representação e ciclo de vida antes de criar schema/persistência; som exige recorte definido.
