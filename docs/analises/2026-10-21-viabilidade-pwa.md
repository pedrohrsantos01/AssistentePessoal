# Viabilidade de uma versão adicional PWA do Ritmo

Data da consulta: 21/10/2026. Status: pesquisa para planejamento; não é aceite de arquitetura nem de implementação.

**Nota de precedência, posterior à pesquisa:** as recomendações Expo/SQLite web dos §§5/9 e da conclusão são históricas e foram substituídas pela escolha explícita React DOM/Vite/Dexie/Workbox no [ADR-020](../adr/0020-pwa-com-frontend-web-proprio.md). A [prova01](2026-10-21-prova-tecnica-pwa.md) já foi executada localmente. Na Q66, Pedro informou iOS26.6.2; a prova física continua pendente. Contratos em discussão na [rodada1](2026-10-21-contratos-pwa-rodada-1.md). Não usar trechos históricos como autorização para Expo Web.

## Objetivo e limites

Investigar uma entrega web adicional para uso no iPhone 16e, preservando React Native, API e contratos de domínio. O primeiro alvo definido por Pedro nesta sessão é o M1 funcional: conta, onboarding, Briefing, hábitos binários, XP e sincronização; acesso no Safari e pela Tela de Início. Tarefas, agenda e voz não entram nesse primeiro alvo. A versão do iOS instalada no aparelho ainda precisa ser registrada no ensaio.

O PRD 3.0 mantinha web fora do v1. Esta pesquisa fundamenta o aditivo da versão 3.1 e o [contrato PWA](../../specs/14-pwa-primeiro-marco.md); Q65 permite que a PWA componha o aceite funcional M1 com Android, sem aceitar o build nativo iOS. Persistência, isolamento, reconciliação e logout seguem os contratos atuais, com a fronteira web aprovada em Q63; a arquitetura permanece por comprovar.

Método: fontes oficiais de plataforma, documentação versionada Expo, MDN e OWASP; Context7 auxiliou a localizar documentação Expo. O índice Context7 encontrado expõe branches até SDK 56; seus trechos de `main` não comprovam compatibilidade com SDK 57. A documentação pública v57 e o pacote `expo-sqlite@57.0.3` instalado foram conferidos separadamente. Nenhum build web, teste em Safari, deploy ou teste de execução foi feito nesta pesquisa.

## 1. Uso no iPhone sem App Store

**Fato documentado.** A Apple orienta abrir o site no Safari e escolher Adicionar à Tela de Início. Isso cria um ícone de web app. Abrir a URL continua sendo uma alternativa; adicionar o ícone é uma ação opcional do usuário, distinta de instalar um binário pela App Store. [Guia Apple para iPhone](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios).

**Fato documentado.** Desde iOS 26, sites adicionados à Tela de Início abrem como web apps por padrão; o usuário pode desativar essa opção. Manifest e service worker não são condições universais de instalação nesse sistema. Continuam úteis para identidade, apresentação e experiência offline. Não presumir que o aparelho de Pedro esteja nessa versão. [WebKit: Safari 26, web apps](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/#every-site-can-be-a-web-app-on-ios-and-ipados).

**Fato documentado.** Web Push padrão para web apps não exige participação no Apple Developer Program. O caminho web não usa assinatura/provisionamento de um aplicativo nativo. [Apple: Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [WebKit: Web Push no iOS/iPadOS](https://webkit.org/blog/13878/).

**Implicação para o plano.** Essa rota atende à intenção de usar o Ritmo sem loja ou conta Apple Developer. Ainda exige frontend e API acessíveis ao telefone; para uso diário remoto, origem HTTPS confiável e infraestrutura operacional. Uma exportação estática isolada não substitui a API.

## 2. Manifest, HTTPS e funcionamento offline são entregas diferentes

**Fato documentado.** Service workers interceptam requisições e permitem implementar cache offline. Requerem contexto seguro; `localhost` recebe tratamento especial no desenvolvimento. Um endereço HTTP da máquina na rede local não herda automaticamente a exceção de `localhost`. [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [MDN: contextos seguros](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts).

**Fato documentado.** O guia Expo apresenta manifest e configuração de service worker como trabalho próprio da entrega web e alerta para clientes presos em cache agressivo. Exportar o app não demonstra que todo o fluxo ficou disponível offline. [Expo: Progressive web apps](https://docs.expo.dev/guides/progressive-web-apps/).

**Recomendação proposta.** Separar três provas: abrir a jornada pela URL; adicionar e abrir pela Tela de Início; reabrir e registrar offline depois de uma preparação online bem-sucedida. O cache deve incluir o conjunto compatível de HTML/JS/CSS/fontes/ícones/WASM/worker necessário à jornada. A base local e sua outbox são outro armazenamento, com outra política. Não usar cache de respostas autenticadas como banco de domínio nem como substituto de confirmação remota.

## 3. Armazenamento WebKit e limite da promessa de durabilidade

**Fato documentado.** WebKit estabelece quotas por origem e globais. Exceder quota pode causar `QuotaExceededError`; pressão de armazenamento, quota global e inatividade podem provocar remoção de dados. A política normalmente remove a origem inteira. Web apps standalone recebem a mesma categoria de quota dos navegadores. O teto não é espaço reservado ou garantia de disponibilidade. `estimate()`, `persisted()` e `persist()` permitem inspecionar/requisitar persistência; WebKit decide a concessão por heurísticas, incluindo uso pela Tela de Início. [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/).

**Fato documentado.** O modo padrão é best effort. Persistência concedida protege contra eviction automática, mas não impede exclusão explícita pelo usuário. Navegação privada tem políticas próprias e normalmente elimina dados ao encerrar a sessão privada. [MDN: quotas e critérios de remoção](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

**Fato documentado.** WebKit documenta uma exceção de ITP para o domínio de primeira parte de web apps na Tela de Início. Isso não é imunidade a todas as formas de remoção nem autorização para prometer retenção ilimitada. Evitar a afirmação genérica de que “toda PWA perde tudo em sete dias”. [WebKit: Tracking Prevention](https://webkit.org/tracking-prevention/#home-screen-web-application-domain-exempt-from-itp).

**Inferência para o Ritmo.** Nenhum adapter OPFS ou IndexedDB recupera uma intenção cuja única cópia foi removida do navegador antes do envio ao servidor. Mesmo com persistência concedida, a limpeza manual permanece possível. Se todo o armazenamento da origem for apagado, o cliente pode nem distinguir com certeza essa perda de uma primeira abertura. A política web precisa explicar essa limitação, preservar pendências enquanto disponíveis e distinguir “salvo neste navegador” de “confirmado pelo servidor”. Essa adaptação de garantia exige definição própria, sem alterar silenciosamente o contrato nativo.

## 4. Safari e Tela de Início não são o mesmo banco

**Fato documentado.** Desde iOS/iPadOS 17.2, adicionar uma web app à Tela de Início copia cookies, inclusive os que podem transportar login. Outros dados locais não são copiados. Depois da criação, os dados de site não são compartilhados entre navegador e web app. [WebKit: Safari 17.2, Login cookies](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/#web-apps), [Apple: cookies na criação da web app](https://developer.apple.com/documentation/safariservices/sfaddtohomescreeninfo/websitecookies).

**Inferências que precisam entrar no contrato.** Não prometer que hábitos ainda locais no Safari aparecerão imediatamente na Tela de Início: outro contêiner precisa obter os fatos confirmados pela API. Não presumir que uma instalação herda o mesmo identificador local, SQLite, preferências ou outbox. Um refresh cookie copiado pode, por outro lado, começar com o mesmo segredo de sessão em dois contêineres: rotação, renovação concorrente, logout e vínculo com a instalação precisam tratar esse caso explicitamente.

Uma coordenação por abas dentro de uma origem/contêiner não coordena automaticamente Safari e web app standalone. A cópia de cookie não comprova continuidade do estado local nem segurança de reaproveitar a mesma sessão sem novo contrato.

## 5. SQLite web no Expo: candidato condicionado a prova

**Fato documentado.** A documentação **SDK 57** classifica o suporte web de `expo-sqlite` como **alpha**, potencialmente instável. Exige arquivos WASM no Metro e cabeçalhos COEP/COOP para `SharedArrayBuffer`. A documentação também marca `withExclusiveTransactionAsync()` e o parâmetro de diretório como não suportados na web. Isso impede declarar paridade automática entre operações nativas e web. [Expo SDK 57: SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/#web-setup).

**Fato conferido no pacote local.** `app/node_modules/expo-sqlite/package.json` identifica a versão 57.0.3. Seu `web/worker.ts` inicializa `AccessHandlePoolVFS`; `web/wa-sqlite/AccessHandlePoolVFS.js` usa `navigator.storage.getDirectory()` e access handles. `src/SQLiteDatabase.ts` recusa `withExclusiveTransactionAsync` quando `Platform.OS === 'web'`. São evidências de implementação instalada, não evidências de execução no iPhone. Referência pública correspondente, sem fixação dessa versão: [fonte Expo em main](https://github.com/expo/expo/tree/main/packages/expo-sqlite/web).

**Fato documentado.** OPFS é privado à origem, sujeito às quotas do navegador e à remoção quando dados do site são limpos. A API síncrona de acesso a arquivos é oferecida em workers. Suporte à API não comprova a combinação específica SQLite/VFS/Drizzle do app. [MDN: Origin private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).

**Fato documentado.** Compartilhar `SharedArrayBuffer` exige contexto seguro e isolamento entre origens. A aplicação deve conferir `crossOriginIsolated`; os cabeçalhos podem afetar recursos externos e integração com outras janelas. [MDN: SharedArrayBuffer, requisitos de segurança](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements).

**Alternativa documentada.** IndexedDB oferece armazenamento transacional estruturado e assíncrono. Não é um banco SQL substituível por configuração: exige implementar e verificar outro adapter. Sua disponibilidade também não elimina quota ou remoção de dados. [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

**Recomendação proposta.** Investigar primeiro SQLite/WASM/OPFS com o lockfile atual, pelo potencial de preservar schema/consultas. O experimento deve reprovar cedo por incompatibilidade, perda de atomicidade ou bloqueio indevido. IndexedDB é alternativa caso essa prova falhe; não deve ser anunciado antecipadamente como migração simples. Não escolher novo ORM, VFS ou biblioteca por esta pesquisa.

## 6. Credenciais e sessão precisam de contrato web

**Fato documentado e conferido.** SecureStore SDK 57 documenta plataformas nativas, sem oferecer cofre web equivalente. No pacote local, `ExpoSecureStore.web.ts` exporta um objeto vazio; `isAvailableAsync()` verifica a presença do método nativo. Reutilizar apenas a interface nominal não cria armazenamento seguro de credenciais no Safari. [Expo SDK 57: SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/).

**Fato documentado.** OWASP recomenda não guardar identificadores de sessão em `localStorage`, acessível a JavaScript. Um XSS pode ler dados desses armazéns; IndexedDB não constitui cofre contra código executado na mesma origem. [OWASP: HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#storage-apis).

**Fato documentado.** `HttpOnly` impede leitura do cookie por JavaScript, mas o navegador continua enviando-o em requisições iniciadas por scripts. `Secure` restringe envio ao transporte seguro; `SameSite` controla envio em contextos entre sites. Isso reduz exposição de segredos, sem eliminar XSS ou todas as formas de uso abusivo da sessão. [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

**Fato documentado.** Autenticação com cookie exige tratamento de CSRF; OWASP apresenta tokens, validação de origem e mecanismos complementares. `SameSite` não deve ser a única proteção em todos os cenários. [OWASP: CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

**Recomendação proposta.** Investigar sessão web com segredos duráveis fora do JavaScript, por cookies protegidos e rotas/fachada próprias no backend. Comparar com sessão de acesso em memória e renovação por cookie; definir emissão, rotação, revogação, expiração, recuperação e concorrência antes de implementar. Servir web/API sob a mesma origem pública é uma opção para reduzir configuração de CORS/cookies, sem dispensar CSRF. Uma origem separada exige allowlist precisa e política de credenciais, não `*` indiscriminado.

O núcleo atual assume bearer tokens e cofre do dispositivo. Trocar SecureStore por um `webSecureVault` não resolve login/logout offline, segredo de revogação retido, refresh incerto ou cookie copiado entre contêineres. O contrato web deve definir se sessão de servidor e desbloqueio local são estados diferentes; ausência de credencial remota não pode, por conveniência, apagar pendências.

## 7. Sincronização em segundo plano e notificações

**Fato documentado.** Background Sync tem disponibilidade limitada. A base de compatibilidade MDN consultada registra `SyncManager` sem suporte no Safari, com iOS espelhando essa situação. Não usar essa API como obrigação de convergência no iPhone. [MDN: Background Synchronization](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API), [dados MDN de compatibilidade](https://github.com/mdn/browser-compat-data/blob/main/api/SyncManager.json).

**Fato documentado.** Browsers limitam execução em abas ocultas; a Page Visibility API identifica mudanças de visibilidade. Service workers executam tarefas por eventos e podem ser encerrados pelo navegador; não são processos persistentes. [MDN: Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [MDN: operação offline e em segundo plano](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation).

**Fato documentado.** Web Push no iOS/iPadOS 16.4 ou posterior é destinado a web apps na Tela de Início; solicitar permissão exige interação direta do usuário. Push requer servidor/rede e não equivale a agendamento local offline. WebKit exige notificação visível: push silencioso não é mecanismo geral para manter o sync ativo. [WebKit: Web Push no iOS](https://webkit.org/blog/13878/), [WebKit: Meet Web Push](https://webkit.org/blog/12945/meet-web-push/).

**Inferência/recomendação proposta.** Para o primeiro recorte web, garantir tentativas quando a aplicação estiver aberta/visível, na retomada e após reconexão, respeitando Retry-After/backoff. Informar pendências sem prometer horário de envio com o app fechado. Não prometer lembrete local com app fechado e aparelho offline: as fontes consultadas não fornecem um scheduler web equivalente ao nativo; `showNotification()` apresenta uma notificação e seu `timestamp` é metadado, não compromisso de disparo futuro. [MDN: showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification).

Notificações/push não precisam entrar no primeiro M1 web e não foram autorizadas por esta pesquisa. Uma extensão posterior precisa de contrato e matriz próprios; não mudar ADR-003 silenciosamente para compensar uma restrição do navegador.

## 8. Atualização do cliente, múltiplas abas e recuperação por link

**Fato documentado.** Um novo service worker pode instalar e aguardar enquanto a versão antiga ainda controla clientes. `skipWaiting()` permite antecipar ativação. Assim, atualização e recarregamento não são uma simples substituição atômica de todos os processos abertos. [MDN: ciclo de atualização de service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers#replacing_an_existing_service_worker).

**Fato documentado.** Web Locks permite coordenar acesso por scripts de abas/workers na mesma origem. A disponibilidade de locks não oferece, por si só, recuperação de transações ou isolamento de sessão. [MDN: Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).

**Política aprovada, mecanismo proposto.** Q64 confirmou um escritor por instalação. Especificar eleição/reassunção e apresentação de bloqueio nas demais abas; coordenar escrita de instalação, refresh/logout e migrations, além do push. Não executar `skipWaiting` seguido de reload forçado sobre intenção ainda não persistida. Versionar código/cache/schema, impedir downgrade incompatível e preservar fila durante atualização e rollback. O mecanismo técnico ainda precisa de contrato e prova.

**Fato documentado.** A recuperação de senha web pode usar uma URL HTTPS com token enviado por e-mail; OWASP recomenda origem confiável, expiração/uso único, política de referrer e limite de tentativas. [OWASP: Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#url-tokens).

**Inferência para o plano.** Uma rota HTTPS de recuperação no navegador pode funcionar sem Universal Link ou Associated Domains de um binário iOS. Isso não aceita o fluxo nativo existente. O e-mail pode abrir no Safari, enquanto a sessão/offline da Tela de Início está em outro contêiner; concluir a troca de senha e retomar o app precisam funcionar nessa separação. Não copiar tokens para analytics, logs, cache ou memória de projeto.

## 9. Provas necessárias antes de escolher a arquitetura definitiva

Estas são propostas de investigação/aceite, não resultados executados:

1. Fixar iOS/Safari reais do iPhone 16e e testar URL e Tela de Início separadamente. Registrar versão do cliente, origem, contêiner e concessão de persistência.
2. Carregar WASM/worker em HTTPS com `crossOriginIsolated`, reabrir offline e comprovar transação de intenção/outbox, rollback, migrations e reinício abrupto usando SQLite/Drizzle atuais.
3. Testar dois clientes web concorrentes no mesmo contêiner; impedir dois escritores e verificar tomada de controle após suspensão/fechamento sem duplicar IDs/XP.
4. Adicionar à Tela de Início com login e pendências existentes no Safari. Verificar cookie inicial copiado, banco independente, refresh concorrente e logout sem troca de dados entre contas.
5. Exercitar quota/indisponibilidade/permissão negada/limpeza de dados. Falha de persistência não pode aparecer como escrita concluída; ausência de dados não autoriza prometer recuperação de intenção nunca enviada.
6. Evoluir cache/cliente/schema com outbox pendente, aba antiga aberta e atualização interrompida. Resposta 426 precisa preservar leitura local e pendências conforme contrato web definido.
7. Executar marcação/desfazer/remarcar offline e convergência com Android/API reais, incluindo 401/429/503, snapshot interrompido e ausência de rede após escrita local.
8. Testar teclado/viewport/áreas seguras, fontes offline, contraste, zoom e VoiceOver no aparelho. WebKit de desktop automatizado é evidência complementar, sem substituir Safari real instalado.
9. Verificar URL de senha em Safari e retorno à Tela de Início; isolamento, CSP/CSRF, autorização e ausência de segredos no bundle/cache/telemetria.

## Conclusão da pesquisa

Uma PWA adicional é viável como canal de acesso ao M1 sem distribuição nativa. A evidência documental sustenta começar por uma prova pequena de Expo Web e adapters; não sustenta uma exportação direta com paridade garantida. Armazenamento offline, sessão web e atualização/concorrência são os gates de arquitetura. O nativo permanece preservado. Q65 aprovou o aceite funcional M1 por PWA no iPhone + app Android; provas nativas iOS ficam posteriores. Implantação externa, contratação e contratos técnicos ainda exigem suas definições/evidências.
