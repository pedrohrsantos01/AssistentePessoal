# Ritmo — prova técnica web

Ensaio sintético da tarefa [PWA01](../.scratch/pwa-m1/issues/01-provar-portabilidade-e-persistencia.md), conforme [ADR-020](../docs/adr/0020-pwa-com-frontend-web-proprio.md). Não usar com contas/dados reais. Frontend de produto, sessão, API web e publicação ainda não implementados.

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
