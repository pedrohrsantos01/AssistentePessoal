# Preparo HTTPS e roteiro do iPhone —02c

Data: 23/10/2026; parâmetros públicos atualizados em24/10/2026. Origem: [spec/14](../../specs/14-pwa-primeiro-marco.md), Q62/Q67–Q75 e [tarefa11](../../.scratch/pwa-m1/issues/11-preparar-https-e-ensaio-fisico.md). Este pacote foi conferido **localmente**. Não há ambiente publicado, certificado público, sessão de Safari ou aceite físico comprovados.

## 1. O que já está preparado

A referência usa a borda Traefik/Coolify existente. Ela encaminha `/api` e `/api/…` diretamente ao Java; o restante vai ao servidor estático privado. Os dois compartilham uma única origem HTTPS. O Nginx serve somente arquivos; não é um runtime de frontend nem um segundo proxy da API. React Native/bearer permanecem.

```text
iPhone — HTTPS — Traefik/Coolify — /api e /api/… — Java — PostgreSQL
                              └ demais caminhos — arquivos estáticos
```

Referências executáveis: [rotas da borda](../deploy/traefik-pwa.example.yml) e [servidor estático](../deploy/nginx.conf). Hostnames `ritmo.example.test` e nomes de serviços são reservados para a fixture; não são parâmetros escolhidos para a VPS.

**Não publicar o `web/dist` atual.** Ele contém a prova01 e a entrada `coordination.html`, com bridge sintético, sem jornada de produto. Bloquear os caminhos de ensaio na referência ajuda a evitar exposição acidental, mas não transforma o index/manifest atuais em um produto. Para a prova física, usar a entrada técnica separada do [recorte12](../../.scratch/pwa-m1/issues/12-preparar-controles-do-ensaio-iphone.md), construída por `pnpm --dir web build:iphone` em web/dist-iphone/; para uso diário, concluir03–07 e os gates operacionais.

## 2. Ficha pública para preparar o ambiente

Preencher sem segredos e sem dados do titular:

| Parâmetro | Estado nesta preparação |
|---|---|
| Domínio registrado / gestor DNS autoritativo | phsdev.cloud ativo, escolhido por Pedro; Hostinger, NS cosmos.dns-parking.com / nova.dns-parking.com confirmados publicamente. [Registro](../../docs/analises/2026-10-24-dominio-pwa-phsdev-cloud.md) |
| Origem HTTPS exata do ensaio, sem barra final | https://ritmo.phsdev.cloud, confirmada por Pedro; frontend e API no mesmo host/esquema/porta. Endereço definido, ainda não publicado |
| Destino de DNS / rede / nomes reais de serviços | Pendente; guardar inventário operacional privado |
| Coolify / Traefik efetivamente instalados | Painel informado: https://coolify.continuumcare.app.br; tela de login observada. Projetos/servidor/versões/proxy ainda não inspecionados |
| Imagem/build da API e do artefato técnico | A registrar por digest/hash no ensaio externo |
| Caminho de entrada / id, scope e start_url do manifest técnico | `/ensaio/`; SW `/ensaio/sw.js`, PNG192/512 e fontes locais no build isolado. Não são manifest/identidade do produto |
| iPhone / iOS | iPhone 16e /26.6.2 declarados na Q66; confirmar na execução, sem inferir WebKit |
| Domínio de envio Resend / status / remetente | Pendente na mesma tarefa humana; não bloqueia a inspeção local dos fragmentos |
| Responsável / janela de execução / encerramento do ensaio | A preencher antes de ativar o ambiente |

Segredos ficam no Bitwarden/canal privado de runtime. Não pedir valores pelo chat, nem copiá-los para bundle, build-args, logs ou ficha pública.

## 3. Integração futura no Coolify

1. Preparar ambiente de ensaio isolado e base descartável com **contas sintéticas**, sem dados de uso diário. Registrar identidade da instância, build e procedimento de desligamento. Reutilizar os [gates externos](../../api/ops/external-provisioning.md) e a [ativação do proxy](../../api/ops/proxy-activation.md); o pacote local não autoriza alterar a VPS.
2. Conferir DNS, ACME, cadeia e SAN para o host escolhido. Não usar `-k`, exceção a certificado, perfil de CA no iPhone ou certificado temporário deste teste. A fixture confia na sua CA somente dentro do próprio cliente Node, sem alterar o trust store do Windows.
3. Integrar as regras ao provider/routers efetivos do Coolify, preservando resolvers, middlewares e demais aplicações. Evitar router amplo antigo concorrente. As prioridades200/100 da referência encaminham `/api` e `/api/` ao Java **sem StripPrefix**. `/apiary` permanece na interface. Ajustar nomes de entrypoints ao painel; não substituir toda a configuração global.
4. Manter apenas a borda com portas públicas80/443. Servidor estático na rede do proxy, API/PG privados. API recebe conexão **direta da borda**, mantendo `RITMO_TRUSTED_PROXY_PEERS` como literais exatos verificados e `SERVER_FORWARD_HEADERS_STRATEGY=none`. CDN/proxy Cloudflare adicionaria um salto: o pacote inicial não o aprova; R2 não exige ativá-lo.
5. Para o servidor estático, usar o arquivo Nginx completo com UID/GID sem privilégios, porta interna 8080, filesystem somente leitura e `/tmp` gravável/limitado. Diretórios temporários dos módulos apontam a `/tmp`; não conceder escrita ao bundle. A imagem usada na prova é Nginx1.30.6-alpine por digest, registrado no relatório; uma imagem de implantação futura precisa de build reproduzível próprio.
6. No Java configurar privadamente `RITMO_WEB_ORIGIN` com a mesma origem pública exata e `RITMO_WEB_PREPARATION_KEY` independente, Base64 de pelo menos 32 bytes. `RITMO_PUBLIC_ORIGIN` da recuperação também usa a origem confirmada. O [exemplo de runtime](../../api/deploy/.env.example) lista os campos vazios. Chave JWT nativa, preparação web e SMTP não são intercambiáveis. Sem CORS permissivo ou bearer de fallback nas rotas web.
7. Conservar HSTS/TLS/quotas/quarentena/WAL existentes. Nenhum retry automático de POST ou cache de API na borda/CDN. Testar headers de pelo menos 16 KB e o erro431 do Java para Cookie acima de 8192 bytes, preservando status/corpo/no-store. A prova desta tarefa usa um upstream **sintético**; só a execução externa com o Java confirma o limite do ingress efetivo.
8. Validar primeiro sem dados reais; retirar quarentena ou usar exceções descartáveis somente nas condições dos planos existentes. Não converter o bypass de WAL de uma fixture em configuração de operação. As garantias externas de recuperação continuam obrigatórias para uso diário.

## 4. Cache, publicação e retorno de versão

| Recurso | Contrato da referência |
|---|---|
| HTML e fallback SPA | `Cache-Control: no-store`; nenhum dado pessoal no HTML estático |
| `sw.js`, manifest e arquivos sem hash | `no-cache`, com revalidação; não servir HTML se faltarem |
| `/assets/<nome>-<hash>.js/css` existente | `public, max-age=31536000, immutable`; nome com hash do conteúdo, nunca sobrescrito por outro conteúdo |
| Arquivo ausente / erro estático |404 e `no-store`, nunca index com 200 |
| `/api` e `/api/…` | Java; respostas protegidas/no-store próprias, sem fallback do servidor estático |
| `password-reset` | Shell sem armazenamento; fragmento do link não é enviado na requisição HTTP e não deve entrar nas evidências |
| Bridge, `/probe`, fontes de código e dotfiles | Caminhos de ensaio/código recusados pela referência |

O hash no nome é uma condição do pipeline de publicação; a regra HTTP não calcula nem comprova o conteúdo do arquivo. Fontes/imagens atuais têm nomes sem hash, por isso ficam com revalidação. O service worker pode guardar recursos estáticos autorizados; `no-store` HTTP não implementa proibição de Cache API por si. O contrato de SW continua sem respostas de API, cookies, background sync ou escrita de domínio.

Na publicação futura, disponibilizar os novos assets antes do HTML/manifest/SW, preservar assets necessários aos builds abertos e testar a convivência. Não apagar o diretório inteiro como estratégia de release. O teste local muda um shell sintético e confirma que o asset antigo permanece; **não entrega um pipeline de releases**. Definir o inventário/retirada de builds na tarefa07; não presumir um prazo novo de expurgo. Rollback de HTML não desfaz schema: restaurar somente build compatível, preservando banco, fila, journals e bloqueios. Sem skipWaiting/reload automático para contornar uma pendência.

A política CSP de scripts ainda precisa ser fechada com o bundle da jornada, pois os validadores atuais compilam schemas em runtime. Não inventar `unsafe-eval` nem chamar este fragmento de CSP completa. A referência confere nosniff, proteção de frame, referrer e HSTS existentes; recuperação real continua na tarefa04/07.

## 5. Reprodução local finita

Na raiz, Docker Desktop ativo, Node24.13/pnpm10.32.1 e Java21:

```powershell
$env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
$env:DOCKER_CONFIG=(Join-Path (Get-Location) 'api/build/test-docker-config')
pnpm --dir web verify:hosting
```

O job [verify-hosting](../scripts/verify-hosting.mjs) monta shell/API sintéticos, Nginx e Traefik reais com imagens por digest. Expõe somente a borda em portas aleatórias de loopback, confia na CA descartável explicitamente e verifica rejeição sem confiança/hostname correto. Não inicia dev server/watchers, não acessa VPS e não abre navegador. Fecha containers/rede próprios em `finally`, inclusive em falha; preserva os preexistentes. Containers temporários não são serviços persistentes do projeto.

Resultado em `output/playwright/web-hosting/result.json` e diretório único por execução, ignorados pelo Git. Evidência registra cenários/imagens, sem exportar cookies, credenciais ou links reais. Certificado/chave descartáveis permanecem apenas na pasta ignorada da fixture, sem confiança instalada no host. Este ensaio HTTP não prova cookie jar de Safari, IndexedDB, VoiceOver, instalação ou certificado público.

## 6. Execução física — ficha e passos

Antes de executar: origem pública aprovada/disponível com TLS válido e ambiente sintético isolado. O cliente por toque está no build separado do recorte12; não existe publicação real por essa preparação. Se qualquer pré-condição faltar, registrar **não executado**, sem marcar falha de produto nem aprovar02c. Não usar o bridge de automação no console como instrução para Pedro no Windows.

Preencher uma linha por caso, separando Safari e Tela de Início. Dados mínimos: horário/fuso, modelo/iOS confirmados, modo de abertura, origem/build, ação, resultado esperado/observado, referência de evidência sanitizada e estado `aprovado | reprovado | não executado`. Não coletar número de série, e-mail pessoal, Cookie, senha, ticket, token de reset ou dump do IndexedDB. A contagem/identidade sanitizada das intenções e os metadados públicos bastam para diagnóstico.

| Caso02c | Passos e evidência esperada | Estado inicial |
|---|---|---|
|01 — Abertura HTTPS | Abrir endereço no Safari normal, sem exceção de certificado; conferir origem/build e estado compreensível antes de carregar a base. Privacidade/modo privado não são tratados como base regular | Não executado |
|02 — Primeira entrada | Autenticar conta sintética explicitamente; preparação/reserva/inspeção confirmadas. Fechar/reabrir o documento sem redefinir o storage; metadados da mesma instalação e contexto válidos | Não executado |
|03 — Commit offline | Preparar shell/cache online, desligar rede, salvar comando sintético e só então confirmar; anotar contagem/seq/identidade sanitizada. Encerrar/reabrir o contêiner pelo operador, ainda offline; mesmas intenções. Não limpar dados para repetir | Não executado |
|04 — Retorno remoto | Reconectar/retomar, sincronizar com Java e conferir recibo/canonical/XP; reenviar a mesma identidade não duplica. Comparação Android é do aceite conjunto posterior, não presumida aqui | Não executado |
|05 — Falha de gravação | Acionar falha injetada e delimitada da fixture; sem sucesso, seq/estado anteriores preservados. Distinguir quota injetada de falta real de espaço; não encher o iPhone | Não executado |
|06 — Abas | Abrir segunda aba da mesma origem/instalação: uma escritora. Transferir controle explicitamente; aba antiga não grava/envia ao retomar. Gate ocupado aguarda liberação, sem steal/TTL | Não executado |
|07 — Ciclo de vida | Alternar app, bloquear/desbloquear tela e voltar; titularidade conferida antes de commit. Fechar documento do proprietário e retomar no outro. Registrar o que foi encerrado; fechar aba não é evidência de crash do renderer/OS | Não executado |
|08 — Conta e logout | A com intenção pendente → logout offline; leitura antiga/rascunho inacessíveis. Online entrar B, depois A; sem cruzar dados/credenciais e sem perder fila. Resposta antiga não altera conta atual | Não executado |
|09 — Tela de Início | A partir do Safari autenticado, adicionar a entrada técnica à Tela de Início. Primeiro abrir sem presumir IDB compartilhado: sem controle válido, pedir login próprio. Confirmar identificadores/contextos próprios; não exigir que cookies tenham ou não sido copiados | Não executado |
|10 — Dois contêineres | Repetir commit offline/reabertura no ícone e convergir com Safari. São instalações independentes: Q64 não cria lock entre elas. Registrar retenção observada, sem prometer imunidade a eviction | Não executado |
|11 — Atualização | Com intenção e rascunho na aba, disponibilizar build técnico seguinte: SW espera/rascunho adia reload, asset antigo continua 200. Atualização deliberada preserva intenção e compatibilidade; não usar apagar base como recuperação | Não executado |
|12 — Acesso ao ensaio | Conferir leitura/acionamento por toque, VoiceOver, foco, teclado e viewport nos dois modos para os controles técnicos. Falta de API da plataforma bloqueia a capacidade com dados preservados; não liberar fallback de segundo escritor | Não executado |

Respostas perdidas e prazos30/90 dias/quatro contextos já têm prova local09/10; repetir na matriz física quando o harness permitir barreiras controladas, sem mexer no relógio de contas reais. O objetivo físico é validar a plataforma/conservação dos contratos; não repetir decisões Q61–Q75 nem exigir UI de produto antes da tarefa03. A matriz visual completa Ritmo-App, desempenho e VoiceOver da **jornada** permanece na tarefa06. Abertura do reset acima é só roteamento; e-mail real, consumo/reuso do link e reentrada com fila são tarefas04/07 com autorização própria de envio.

## 7. Critério de passagem

Esta preparação não fecha02c. A tarefa12 fornece os controles e o manifest isolados; falta executar os casos técnicos em HTTPS no aparelho, registrar divergências e fechar impedimentos dos contratos com evidência. Só então reavaliar a tarefa02 e liberar03. Qualquer item não executado relevante ao contrato conserva o gate; contrato/spec não muda só porque a plataforma se comportou diferente.

Tarefas05/06/07 continuam responsáveis pela jornada completa, atualização de produto, visual e operação. WEB-01–10/M1-01–20 não ficam integralmente aceitos por esta ficha. M1 segue aberto; Android é mantido e nativo iOS continua adiado conforme Q65.

Fontes primárias consultadas em 23/10/2026: [Nginx location/try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files), [add_header/always e herança](https://nginx.org/en/docs/http/ngx_http_headers_module.html#add_header), [imagem oficial Nginx](https://hub.docker.com/_/nginx), [regras/prioridades Traefik](https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/rules-and-priority/). Configurações do Ritmo acima são propostas locais testadas, não documentação da VPS efetiva.


## 8. Comandos efetivos do cliente12

Em24/10/2026 Pedro escolheu phsdev.cloud e confirmou https://ritmo.phsdev.cloud como origem de PWA/API. [Escolha e DNS observado](../../docs/analises/2026-10-24-dominio-pwa-phsdev-cloud.md). Destino/roteamento/TLS ainda não foram configurados; o domínio raiz e seu MX serão preservados.

Preparar o artefato com `pnpm --dir web build:iphone`. No servidor estático futuro, o conteúdo de **web/dist-iphone/** deve ficar no subdiretório **ensaio/** do document root, conservando URLs `/ensaio/…`; a API continua diretamente na borda em `/api/…`. Não montar esse conteúdo como raiz sem mapear o prefixo, nem misturá-lo com web/dist. Conferir tipo de manifest, headers e rotas no ingress real. Em uma origem exclusivamente técnica, a rota `/` pode redirecionar a `/ensaio/`; isso requer configuração/revisão do ambiente antes do ensaio, não está publicado pelo build. Os casos físicos abrem a URL completa `/ensaio/`.

| Caso | Ação no cliente |
|---|---|
|01/02 | Conferir capacidades/build/modo; cadastrar ou entrar com conta sintética do ambiente. Se o corpo de login se perdeu, usar **Inspecionar entrada interrompida**, sem reenviar senha automaticamente |
|03/04 | **Preparar perfil: São Paulo, início às4h**, digitar título, **Criar hábito local** e **Marcar**. Mudar rede/encerrar/reabrir pelo operador; conferir mesmas identidades/seq. **Sincronizar agora** executa uma rodada do protocolo (lote de até50; pull/snapshot existentes); repetir conforme pendências, sem interpretar uma rodada como convergência geral de um conjunto arbitrário |
|05 | Com título preenchido, **Simular quota na criação**. Não confirmar sucesso; conferir seq e IDs preservados. O hook da falha é removido em finally |
|06/07 | Abrir outra aba; confirmar somente leitura. **Segurar gate do ensaio** na proprietária, **Assumir escrita nesta aba** na outra e **Liberar gate** na primeira. A liberação permanece acionável mesmo com comando aguardando. Suspensão/bloqueio de tela/fechamento são ações reais do operador |
|08 | **Sair localmente** primeiro, inclusive offline; depois entrar B/A explicitamente. **Resolver contextos pendentes** fecha apenas preparações/encerramentos com prova. Sem capacidade, selecionar o contexto e usar e-mail/senha da **conta original** em **Encerrar contexto com a conta original**. B não autoriza A; nenhuma quinta entrada é criada pela recuperação |
|09/10 | Instalar pelo próprio Safari/Compartilhar, abrir o ícone e conferir comportamento observado. O driver local copia cookies HttpOnly/Secure reais entre perfis sem copiar IDB; isso só comprova o candidato no Chrome. Safari/Tela de Início permanecem não executados |
|11 | **Consultar atualização** informa waiting. Não força ativação nem recarrega rascunho. **Reabrir este ensaio**, sair/assumir escrita ou simular migração com texto não salvo exigem confirmação de descarte. **Simular migração abortada** modifica a próxima sequência apenas dentro de uma transação experimentalV2 e aborta: reabrir V1, conservar IDs/seq. Não é migration de produto |
|12 | Conferir rótulos, estado de erro/vazio, foco, toque e diagnóstico de capacidades. A falta de Web Locks bloqueia escrita sem alternativa insegura. A UI técnica usa tokens Holograma escuro; aparências/VoiceOver/desempenho completos da jornada continuam na tarefa06 |

A UI retira conteúdo/rascunho ao ocultar ou invalidar a jornada; não promete recuperar texto após encerramento. Não persistir senha, ticket, e-mail de formulário ou título não salvo. Uma leitura inválida retira a apresentação anterior e bloqueia alterações, sem reparar/apagar a base. Uma flag upgrade_required não é removida ao reabrir. Nenhum controle descarta intenção confirmada ou expõe API de alteração direta do banco via window.

A execução do driver e seu [relatório12](../../docs/analises/2026-10-23-controles-do-ensaio-iphone.md) são evidência local delimitada. Não transformar amostras Chrome430px em aceite de iPhone16e/iOS26.6.2, VoiceOver ou instalação real.
