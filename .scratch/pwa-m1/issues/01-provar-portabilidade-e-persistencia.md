# 01 — Provar frontend web e persistência sem Expo Web

Status: needs-info
Blocked by: escolha da proposta de frontend web por Pedro

Origem: spec/14 §5 e comparação de 21/10/2026 em docs/analises/2026-10-21-alternativas-pwa-sem-expo.md. O ensaio anterior Expo Web/expo-sqlite foi retirado após a preferência expressa de Pedro. Não iniciado.

## Entrega após a escolha

Preparar prova finita e isolada na stack web selecionada, com versões fixadas compatíveis e releases estáveis. Renderizar uma parte representativa de Ritmo-App em frontend próprio e registrar o custo de portar apresentação/tokens/fontes. Preservar o aplicativo React Native.

Usar dados sintéticos e os campos/envelopes já definidos pelo domínio para investigar armazenamento assíncrono de navegador: transação intenção+projeção+sequência, commit/rollback, reabertura offline, quota/falha, migrations e duas abas/suspensão. IndexedDB/Dexie é candidato, não escolha aprovada. A prova não define silenciosamente o schema web de produto nem substitui tipos Drizzle síncronos por promises.

Não adicionar login real, novos endpoints, serviços Cloud ou fallback em memória para declarar sucesso. Biblioteca de cache não se torna fila de domínio e o service worker não vira segundo escritor. Contratos definitivos continuam na tarefa02.

## Aceite delimitado

- Build/reprodução finitos e relatório com versões, browser, recursos suportados, falhas e limites. Serviços persistentes seguem as regras do projeto.
- Conteúdo/outbox verificados após reabertura; falha de transação não publica sucesso. Identificar requisitos ainda abertos da exclusão entre abas.
- Separar Chromium/WebKit desktop de Safari físico. Preparar roteiro iPhone/HTTPS e registrar a versão iOS; indisponibilidade permanece gate da tarefa02.
- Conclusão é relatório local, inclusive para impedimento reproduzível, sem aprovação automática da stack no iPhone ou aceite M1.

## Resultado

Concluída: não — seleção de frontend pendente; nenhuma implementação nesta pesquisa.

## Comments

21/10/2026 — Pedido posterior às Q61–Q65: Expo Web excluído; comparar React DOM/Vite, Next.js e SvelteKit. A recomendação React DOM/Vite não foi adotada por inferência. Q61–Q65 e os gates funcionais permanecem.
