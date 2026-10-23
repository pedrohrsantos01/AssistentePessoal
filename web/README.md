# Ritmo — prova técnica web

Ensaio sintético da tarefa [PWA01](../.scratch/pwa-m1/issues/01-provar-portabilidade-e-persistencia.md), conforme [ADR-020](../docs/adr/0020-pwa-com-frontend-web-proprio.md). Não usar com contas/dados reais. A API de sessão web existe desde o recorte09. O recorte10 acrescenta adapters locais e outra entrada técnica; a jornada React de produto e a publicação continuam pendentes.

## Reprodução finita no Windows

Node24.13.x, pnpm10.32.1, Google Chrome instalado. Instalar também as dependências fixadas de `app/`: o build copia os mesmos arquivos de fontes licenciadas do aplicativo nativo, sem carregar Expo no navegador.

```powershell
pnpm --dir app install --frozen-lockfile
pnpm --dir web install --frozen-lockfile
pnpm --dir web typecheck
pnpm --dir web lint
pnpm --dir web test
pnpm --dir web build
pnpm --dir web verify:browser
```

O último comando abre **Chrome visível**, com perfil sintético próprio, e serve somente o build em loopback durante o job. Fecha navegador/servidor em `finally`. Não inicia Vite dev/preview, watchers nem serviços persistentes. Evidências/perfis ficam em `output/playwright/pwa-probe/`, ignorado pelo Git. Cada execução cria perfil novo e reinicia esse mesmo perfil para verificar IndexedDB e cache offline. Não toca no Chrome pessoal.

Não há `dev`/servidor persistente nesta entrega. Qualquer futuro serviço desse tipo precisa seguir `TERMBAKER.md`.

## O que a prova verifica

- React DOM/React Router renderizando um trecho Holograma de Ritmo-App, tokens e fontes locais; projeção de domínio importada do nativo.
- IndexedDB/Dexie: intenção+sequência+projeção, falha após enfileirar, rollback, undo/remark e separação das fixtures A/B.
- Migração experimental V1→V2, falha sem destruir V1 e recomposição com intenção preservada, em fake-indexeddb. Não é migração de produto.
- Workbox precache de shell/assets/fontes; reabertura do navegador offline, preservando identidade e sequência.
- Candidato Web Locks+geração: segunda aba somente leitura, transferência com aba congelada e retorno sem escrita. Rejeição transacional de lease obsoleto também tem teste determinístico.

O teste visível usa a biblioteca Playwright estável1.64.1 em um job Node finito. A CLI disponível no registro dependia de builds alpha do Playwright; não foi adicionada. Não utiliza `@playwright/test`.

Quota é falha **injetada**, sem encher o disco. O status de persistência/quota é diagnóstico, não garantia. Sem backend, refresh, cookies, sincronização, background sync, instalação ou atualização de produto. O manifest é mínimo e não prova instalação. Safari/Tela de Início/iOS físico seguem pendentes na tarefa02.

Desenho: [prova técnica](../.scratch/pwa-m1/prova-tecnica.md). Resultado medido: [relatório](../docs/analises/2026-10-21-prova-tecnica-pwa.md).


## Coordenação e commits — recorte10

`src/local/` implementa o schemaV1 especificado em [contracts/pwa-m1](../contracts/pwa-m1/README.md): nove stores em `ritmo-main` e preferências em `ritmo-appearance`. Não importa dados de `ritmo-synthetic-probe`. `coordination.html` é uma entrada de ensaio separada, com contas sintéticas; não é a jornada de produto.

`LocalRepository` retorna depois do commit assíncrono. Cada mutação inclui controle, compatibilidade, seleção/geração, posse e dados da conta na mesma transação. `Coordinator` usa presença por documento, CAS e o gate estável, sem steal/TTL. Nenhuma espera de rede ocorre dentro do gate. `Remote` confirma a barreira no Java antes de enviar e recusa callbacks que perderam a guarda local. Projeção, hash de operação, dia lógico e backoff reutilizam as funções puras do nativo. O teste de paridade compara os adapters SQLite e IndexedDB.

Abertura física desconhecida preserva e bloqueia. O handler `versionchange` fecha sem adquirir gate. Aparência é independente: uma leitura ilegível pausa seletores, usa o padrão e preserva os dados; falha visual não bloqueia os hábitos. Não há transação entre os dois bancos.

Reprodução finita visível, a partir da raiz do repositório, com Docker Desktop ativo, dependências instaladas e JDK21:

```powershell
$env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
$env:DOCKER_CONFIG=(Join-Path (Get-Location) 'api/build/test-docker-config')
$env:RITMO_WEB_COORDINATION='1'
./api/gradlew.bat -p api test --tests dev.ritmo.WebSessionTests.visibleBrowserProvesIndexedDbOwnershipAndCommits --console=plain --no-daemon
Remove-Item Env:RITMO_WEB_COORDINATION
```

O Java inicia PostgreSQL/API descartáveis e um certificado temporário, lança o driver Node e encerra seus recursos. O driver constrói duas versões, abre Chrome visível com perfil próprio e proxy HTTPS em loopback e fecha ambos em `finally`. A exceção ao certificado autoassinado pertence apenas a esse Chrome sintético; não comprova a cadeia TLS pública. Sem flag, esse teste é ignorado, sem alternativa headless.

Evidências ficam em `output/playwright/web-coordination/`, ignorado pelo Git. Não exportar cookies, senhas ou tickets. O driver verifica a fila após reabertura offline, a barreira remota, abas suspensas/crash e atualização/migração. Resultado e limites: [relatório do recorte10](../docs/analises/2026-10-23-prova-coordenacao-web.md). O resultado da execução, e não a existência do script, define a aprovação.
