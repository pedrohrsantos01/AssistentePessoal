# Preparo HTTPS/iPhone — recorte11

23/10/2026. Origem: [tarefa11](../../.scratch/pwa-m1/issues/11-preparar-https-e-ensaio-fisico.md), spec/14 e Q62/Q67–Q75. **Concluído no escopo de preparação local e ensaio de hospedagem.**02c físico e M1 permanecem abertos.

## Resultado concreto

[Guia operacional, ficha pública e roteiro02c](../../web/ops/https-iphone.md), com doze casos técnicos Safari/Tela de Início inicialmente não executados. Fragmentos de [Nginx estático](../../web/deploy/nginx.conf) e [Traefik](../../web/deploy/traefik-pwa.example.yml) conservam uma origem e um único salto de proxy até o Java. Rotas de API não recebem fallback HTML; servidor estático também recusa /api se a borda estiver incorreta.

Cache seletivo: HTML sem armazenamento HTTP; SW/manifest e recursos sem hash revalidados; JS/CSS identificados por hash podem ser imutáveis; erros/ausentes não ficam imutáveis nem retornam shell com 200. HSTS, nosniff, referrer e proteção de frame preservados nos caminhos do ensaio. A referência não entrega pipeline de releases, CSP completa ou imagem de produto.

Os campos já implementados no09 `RITMO_WEB_ORIGIN` e `RITMO_WEB_PREPARATION_KEY` agora constam vazios no exemplo de runtime. Nenhum campo de domínio, migration SQL, credencial real ou dependência npm foi criado. Atualizados resumos ainda defasados sobre adapters e o guia de domínio que ainda tratava Universal Links iOS como gate M1; Q65/Q67 preservadas.

A prova10 só expõe comandos completos por automação. A [tarefa12](../../.scratch/pwa-m1/issues/12-preparar-controles-do-ensaio-iphone.md) delimita o próximo preparo: uma entrada técnica acionável por toque, separada do produto e sem console/depuração remota obrigatórios para Pedro. Não publicar o web/dist atual nem o bridge como primeira jornada.

## Evidência local

`pnpm --dir web verify:hosting`: **17 cenários aprovados** em Nginx/Traefik reais com shell/API sintéticos, por HTTP/TLS, sem navegador. Certificado confiado somente pelo cliente da fixture; teste sem confiança e com hostname errado recusado. Sem `rejectUnauthorized:false`, exceção de certificado no aparelho ou mudança no trust store do host.

A prova confirma: caminho de roteamento sem StripPrefix; redirecionamento contra headers forjados; host desconhecido recusado; fallback de deep link/reset; API sem fallback; Cookie sintético de 9 KB chega ao upstream e 431/no-store é preservado;429/Retry-After e503; HSTS/nosniff nos erros; cache de assets; SW/manifest revalidados; arquivos ausentes; bloqueio das entradas técnicas/código; recusa de /api no servidor estático; shell atualizado com asset antigo disponível; API/servidor estático sem portas no host.

A resposta421 diante de Host divergente do SNI é uma recusa válida do Traefik; não exigir404 de um host indevido. A execução detectou ainda que Nginx inicializava diretórios temporários de módulos em /var/cache mesmo servindo apenas arquivos; apontá-los para /tmp corrigiu a falha com filesystem somente leitura. O teste final passou sem logs de erro dos três containers. A fixture usa mounts somente leitura, sem docker cp em rootfs bloqueado.

| Componente da fixture | Imagem fixa |
|---|---|
| Nginx1.30.6-alpine | `nginx@sha256:47928bf67eb62a1863cb08d9ecb52d3e704304ba614eaee17884204677702951` |
| Traefik3.6.2 | `traefik@sha256:aaf0f6185419a50c74651448c1a5bf4606bd2d2ddb7b8749eed505d55bf8b8ea` |
| Node24.13.0 | `node@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f` |

Artefatos ignorados: output/playwright/web-hosting/result.json, diretório único da execução, logs e certificado descartável. O JSON registra success, os 17 casos e cleanupErrors vazio. Containers/rede próprios removidos no finally; recursos preexistentes preservados. Nenhuma VPS, DNS, domínio, Resend ou credencial real acessados; nenhum deploy, envio de e-mail, emulador ou publicação.

## Regressão e limites

- App: typecheck/lint e213 testes de domínio +51 de componentes aprovados.
- Web: typecheck/lint e20 testes aprovados.
- API: `gradlew check` completo aprovado em10m58s:112 casos Java,102 passaram/10 opt-in ignorados (8 Android e2 navegadores, já exercitados nos recortes próprios);13 testes operacionais aprovados. Sem rerun dos navegadores09/10 ou Android neste incremento de infraestrutura.
- Documentação:12 Markdown/131 links locais válidos; diff sem erros de whitespace.

Upstream deste ensaio é sintético: seus 431/429/503 provam preservação de transporte na configuração local, não nova aceitação de cookies/quotas/SQL/RLS do Java. Servidor real e adapters continuam com evidências09/10 e regressão da API. A cadeia local não é TLS público; HTTP não é cookie jar. Safari/Tela de Início/iOS 26.6.2 declarado/VoiceOver/desempenho não foram executados aqui. Não aceitar WEB-01–10 ou M1 por esse pacote.

## Próximo recorte

Preparar controles técnicos12 sem esperar a compra do domínio. A origem pública permanece na tarefa humana existente; execução02c exige ambiente aprovado/TLS confiável, cliente técnico e participação no iPhone. Tarefa02 mantém needs-info e03 bloqueada. Tarefas06/07 conservam interface, performance, publicação e aceite completos; nativo iOS continua posterior conforme Q65.
