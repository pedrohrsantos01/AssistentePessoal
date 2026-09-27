# spec/09 — Notícias e informação

**Prioridade:** Fase 2A. **Não implementar antes do fim da Fase 1.**

Módulo de consumo puro: zero registro manual, valor imediato, alimenta o card principal do Briefing.

---

## 1. Modelo mental

Duas seleções independentes, que se cruzam só na hora de exibir:

- **Temas e subtemas** — *o que* o usuário quer saber. Escolhidos no onboarding, editáveis depois.
- **Fontes confiáveis** — *de onde* pode vir. Catálogo curado do app + URLs adicionadas pelo usuário.

**REQ-NOT-001 — Fonte não pertence a tema.** Toda fonte ativa é coletada por inteiro; cada item é **classificado** em tema depois. O usuário não precisa declarar "este site é de tecnologia" — o sistema descobre item a item. Isso evita perder uma notícia de economia publicada num site de tecnologia, e evita obrigar o usuário a manter uma matriz de N fontes × M temas.

## 2. Temas e subtemas

**REQ-NOT-002** — Taxonomia de dois níveis, versionada em `src/features/news/taxonomy.ts`, com `code` estável.

Taxonomia inicial sugerida:

| Tema | Subtemas |
|---|---|
| Tecnologia | IA, desenvolvimento de software, segurança, hardware, startups |
| Negócios | economia brasileira, mercado, carreira |
| Esportes | futebol brasileiro, futebol internacional (integra com spec/10) |
| Ciência e saúde | pesquisa, saúde pública |
| Regional | Amapá, Norte, Brasil |
| Cultura | cinema, música, livros |

**REQ-NOT-003 — Seleção no onboarding.** Tela de caixas de seleção com temas expansíveis em subtemas. Marcar o tema marca todos os subtemas; o usuário pode desmarcar individualmente. Mínimo de 1 tema. Pular é permitido — nesse caso o módulo fica inativo até ser configurado, sem card no Briefing.

**REQ-NOT-004 — Peso por tema.** Cada tema selecionado é `normal` ou `prioritário`. Tema prioritário ganha bônus de score (§6) e garante pelo menos 1 vaga no card do Briefing.

**REQ-NOT-005** — Editável em Configurações → Notícias → Temas. Mudança vale a partir da próxima coleta; itens já classificados não são reprocessados.

## 3. Fontes

### 3.1 Catálogo curado

**REQ-NOT-006** — O app traz um catálogo de fontes pré-verificadas, com feed já descoberto e testado. Cada entrada: `domain`, `feed_url`, `language`, `areas[]`. É **dado versionado no repositório**, revisado por humano — nunca gerado por IA em tempo de execução.

### 3.2 Fontes adicionadas pelo usuário

**REQ-NOT-007** — O usuário cola a URL de um site ou blog. O app tenta, nesta ordem:
1. Descobrir feed por `<link rel="alternate" type="application/rss+xml">`
2. Caminhos convencionais (`/feed`, `/rss`, `/atom.xml`, `/index.xml`)
3. `sitemap.xml` com filtro por data
4. Se nada funcionar: **rejeitar com mensagem clara**

**Não fazemos scraping de HTML arbitrário.** É frágil (quebra a cada mudança de layout), é hostil ao veículo, e é justamente o vetor por onde entra conteúdo malicioso não estruturado.

**REQ-NOT-008 — Prévia antes de aceitar.** Mostrar nome do site, os 3 últimos títulos encontrados e o idioma detectado. O usuário confirma que é o que ele queria. Sem prévia, o usuário só descobre que errou dois dias depois.

**REQ-NOT-009** — Limite de 50 fontes por usuário.

### 3.3 Gestão no perfil

**REQ-NOT-010** — Configurações → Notícias → Fontes lista tudo com: origem (catálogo ou minha), última coleta bem-sucedida, itens nos últimos 7 dias, e ações de **pausar, remover e reverificar**.

**REQ-NOT-011** — Fonte sem item novo há 14 dias é sinalizada como possivelmente inativa, com sugestão de remoção. Nunca removida automaticamente.

## 4. Segurança na adição de URL

> A coleta acontece **no servidor**, com a nossa rede e a nossa identidade. Uma URL maliciosa não ataca o celular do usuário — ataca a nossa infraestrutura. Por isso o risco aqui é maior e diferente de "site com vírus", e esta seção é requisito, não recomendação.

### 4.1 Cadeia de validação — toda URL passa por todos os passos

**REQ-NOT-012 — Passo 1: formato.** Apenas `https://`. Sem `http`, `file://`, `ftp://` ou `data:`. Sem credencial embutida (`https://user:senha@host`). Porta 443.

**REQ-NOT-013 — Passo 2: bloqueio de SSRF.** Resolver o DNS e **rejeitar** se o IP cair em loopback (`127.0.0.0/8`, `::1`), rede privada (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`), link-local (`169.254/16` — onde ficam os metadados de nuvem, o alvo clássico), multicast ou reservado.

A checagem é feita **no IP resolvido, não no texto da URL**, e **repetida a cada redirecionamento**. Um domínio público pode resolver para `127.0.0.1`; um redirect pode levar para lá depois da validação inicial. Este é o ataque mais provável contra este módulo e o mais fácil de esquecer.

**REQ-NOT-014 — Passo 3: reputação.** Consulta à **Google Safe Browsing API** (gratuita) para malware, phishing e software indesejado. Sinalizada, rejeita com motivo explícito ao usuário.

**REQ-NOT-015 — Passo 4: TLS.** Certificado válido e não expirado. Inválido rejeita.

**REQ-NOT-016 — Passo 5: busca controlada.** Máximo de 3 redirecionamentos, timeout de 10 s, corpo limitado a 5 MB, `Content-Type` restrito a XML, RSS, Atom ou HTML. Isso cobre bomba de descompressão e resposta infinita.

**REQ-NOT-017 — Passo 6: typosquatting.** Comparar o domínio com o catálogo curado por distância de edição. `g1-noticias.com` ou `globo1.com` geram **aviso destacado**, não bloqueio — o usuário pode legitimamente querer um site pequeno, mas precisa ver o alerta antes de confirmar.

**REQ-NOT-018 — Passo 7: isolamento.** A função de coleta roda sem credencial no ambiente além do estritamente necessário. Nada de chave de banco ou de API acessível ao processo que busca URL de terceiro.

### 4.2 Reverificação contínua

**REQ-NOT-019** — Domínio bom hoje pode ser comprometido amanhã. Toda fonte é reverificada contra o Safe Browsing **a cada 7 dias**. Reprovada, é pausada automaticamente e o usuário é avisado com o motivo.

### 4.3 Injeção de prompt via conteúdo coletado

**REQ-NOT-020 — O conteúdo vai para um LLM. Trate como hostil.**

Uma página pode conter texto dirigido ao modelo ("ignore as instruções anteriores e..."). Mitigações obrigatórias:

- O resumidor é um **componente separado** do `ai-orchestrator`, **sem nenhuma tool registrada**, sem acesso ao banco do usuário e sem acesso ao contrato de tools do assistente (spec/05). Ele só transforma texto em texto — mesmo sequestrado, não tem o que executar
- A validação anti-SSRF roda na JVM, com resolução explícita de DNS e checagem do `InetAddress` a cada salto — nunca confiando no texto da URL
- O conteúdo entra em bloco delimitado, marcado explicitamente como dado não confiável no system prompt
- A saída é validada por schema (REQ-NOT-033). Campo fora do formato descarta o item
- Limite de tamanho na saída: resposta anormalmente longa é sinal de sequestro
- Teste de regressão com páginas de injeção conhecida em `news.security.test.ts`

### 4.4 Exibição segura

**REQ-NOT-021** — O app **nunca** renderiza HTML remoto. O card mostra só texto que nós geramos e a imagem do feed, carregada por proxy com validação de tipo.

**REQ-NOT-022** — Abrir a notícia usa `expo-web-browser` (Safari View Controller / Chrome Custom Tabs), isolado do app. **Não** usar WebView com bridge JavaScript.

## 5. Coleta e cadência

**REQ-NOT-023** — `@Scheduled` no backend Spring coleta **a cada 2 horas**. Respeitar `ETag` e `Last-Modified`, `User-Agent` identificando o app, limite de 50 itens por fonte por ciclo.

**REQ-NOT-024 — Coletar de 2 em 2 horas não é entregar de 2 em 2 horas.** Doze ciclos × 5 notícias seriam até 60 itens por dia: isso é ruído, não informação. O card do Briefing mostra sempre **de 3 a 5 itens** — os de maior score ainda não vistos. Item já aberto não volta.

**REQ-NOT-025 — Estabilidade.** O card não pode reordenar a cada abertura do app. Recalcula no máximo a cada 2 horas ou no pull-to-refresh.

**REQ-NOT-026 — Deduplicação.** A mesma notícia em 3 veículos aparece **uma vez**, com os demais como "também em". Chave por similaridade de título normalizado (sem acento, sem stopword) em janela de 24h. As duplicatas **não** são descartadas — viram sinal de relevância (§6).

**REQ-NOT-027** — Retenção de 30 dias. Isto não é um arquivo de notícias.

## 6. Relevância

O ponto mais difícil do módulo, e onde é preciso ser honesto sobre o que é obtível.

**REQ-NOT-028 — Contagem de comentários não é um sinal geralmente disponível.** Portal brasileiro não expõe número de comentários em RSS, e raspar isso exigiria um parser por site, que quebra a cada mudança de layout. Onde há API pública, usamos: **Hacker News** (pontos e comentários) e **Reddit**. Para todo o resto, valem os sinais abaixo.

### Fórmula de score

```
score = 0.35 × corroboração
      + 0.25 × aderência ao tema
      + 0.20 × recência
      + 0.10 × engajamento externo
      + 0.10 × confiança da fonte
      × penalidades
```

| Sinal | Como é medido |
|---|---|
| **Corroboração** | quantos veículos distintos publicaram a mesma história em 24h. **É o melhor proxy de impacto disponível** e depende só de nós: se 6 fontes cobriram, é grande |
| **Aderência ao tema** | confiança da classificação num subtema selecionado, com bônus se o tema é prioritário |
| **Recência** | decaimento exponencial, meia-vida de 8 horas |
| **Engajamento externo** | pontos e comentários de HN e Reddit quando o link aparece lá. Ausente na maioria dos itens — peso baixo por isso |
| **Confiança da fonte** | catálogo curado > fonte do usuário já estável > fonte recém-adicionada |

**Penalidades:** item de tema não selecionado é **descartado**, não penalizado; título com padrão de isca de clique perde 30%; fonte que já ocupou 2 vagas no card atual perde 50%.

**REQ-NOT-029 — Diversidade obrigatória.** Nenhuma fonte ocupa mais de 2 das 5 vagas. Nenhum subtema ocupa mais de 3.

**REQ-NOT-030 — Aprendizado leve e transparente.** Abrir um item reforça levemente o subtema e a fonte; marcar "não me interessa" reduz. Ajuste limitado a ±20% do score, para não criar bolha. Sem modelo treinado e sem caixa-preta: os ajustes são uma tabela visível em Configurações, com botão de zerar.

## 7. Resumo

**REQ-NOT-031** — Cada item recebe **3 bullets** de no máximo 20 palavras, em pt-BR, gerados **uma única vez no servidor** e compartilhados entre todas as leituras. Nunca regerado na abertura de tela — é isso que mantém o custo baixo.

**REQ-NOT-032 — Antialucinação.** Os bullets usam **apenas** o que está no conteúdo do item. Se o feed traz só o título, mostra-se título e link, **sem bullets inventados**. Melhor um card curto que um card errado.

**REQ-NOT-033 — Classificação e resumo na mesma chamada**, com saída em JSON validado por schema: `{ subtema, confianca, bullets[], clickbait }`. Uma chamada de modelo pequeno por item.

**REQ-NOT-034 — Direito autoral (ADR-007, permanente).** Exibimos título, veículo, data, imagem do feed, 3 bullets próprios e link. **Nunca** texto integral, nunca resumo tão completo que dispense a visita à fonte. Atribuição visível e não removível.

## 8. Modelo de dados (Fase 2A)

| Tabela | Colunas principais |
|---|---|
| `news_sources` | `domain`, `feed_url`, `origin` (`catalog`\|`user`), `status` (`active`\|`paused`\|`rejected`), `trust_score`, `last_fetched_at`, `last_verified_at`, `rejection_reason` |
| `news_user_themes` | `user_id`, `theme_code`, `subtheme_code`, `weight` |
| `news_items` | `source_id`, `url`, `title`, `published_at`, `image_url`, `subtheme_code`, `confidence`, `bullets` jsonb, `is_clickbait`, `dedupe_key`, `corroboration_count` |
| `news_item_sources` | `item_id`, `source_id` — os "também em" |
| `news_user_feed` | `user_id`, `item_id`, `score`, `shown_at`, `opened_at`, `dismissed_at` |
| `news_source_checks` | `source_id`, `checked_at`, `safe_browsing_result`, `resolved_ips`, `passed` |

## 9. Custo

30 fontes × ~30 itens/dia ≈ 900 classificações diárias com modelo pequeno: centavos de dólar. Registrar em `ai_usage_quota` com `purpose='news'`, **separado** da quota do assistente, para os dois não competirem pelo mesmo limite.

## 10. Edge cases mapeados

1. URL apontando para `169.254.169.254` → bloqueada no passo 2
2. Domínio público que resolve para IP privado → bloqueado, porque a validação é no IP, não no texto
3. Redirect para host interno depois da validação inicial → bloqueado, porque se revalida a cada salto
4. Site legítimo comprometido depois de adicionado → pego na reverificação de 7 dias
5. Página com instrução dirigida ao modelo → isolada pelo REQ-NOT-020; sem tools, não há o que executar
6. XML malformado → parser tolerante; item inválido é pulado, o feed não cai
7. Feed devolvendo 500 itens numa migração → teto de 50 por ciclo
8. Item sem data → data da coleta, marcado como estimado
9. Conteúdo em inglês → bullets em pt-BR, com o idioma original indicado
10. Paywall no link → o card não tem como saber; o veículo aparece em destaque para o usuário decidir
11. Usuário com 12 temas e 50 fontes → o card continua com 5 vagas; a diversidade evita monocultura
12. Usuário sem abrir o app por 3 dias → mostra o melhor das últimas 24h, não uma fila acumulada
13. Mesma notícia em 6 veículos → um item, corroboração 6, provavelmente a primeira vaga
14. Nenhum item atinge o score mínimo → card diz "nada relevante nas últimas horas" e sugere revisar temas. **Não preenche com ruído**
15. Fonte cujo RSS exige assinatura → rejeitada na prévia, com mensagem clara
16. Usuário adiciona o mesmo domínio duas vezes → deduplicado por domínio, com aviso

## 11. Fora de escopo

Push de última hora, comentários dentro do app, compartilhamento social, feed algorítmico opaco, scraping de site sem feed, tradução de artigo completo, armazenamento do texto integral.
