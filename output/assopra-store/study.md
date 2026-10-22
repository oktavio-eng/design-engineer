# Assopra Store — estudo para portfólio

22/10/2026. Etapa: textos aprovados pelo Otavio (“manda bala”); 23 recortes e assets preparados para revisão local. Ver README.md para a entrega e qa/ para a validação.

## Fontes e limites

- Figma: `7tev7yK6sT3P0rnR1e2Ez6`, página Design `0:1`.
- [Desktop](https://www.figma.com/design/7tev7yK6sT3P0rnR1e2Ez6/Assopra-Kids-Store?node-id=1-1555): seção `1:1555`.
- [Mobile](https://www.figma.com/design/7tev7yK6sT3P0rnR1e2Ez6/Assopra-Kids-Store?node-id=1-3135): seção `1:3135`.
- Metadados das duas seções preservados em `sources/`. São registros de estrutura, não arquivos-fonte `.fig` nem exportações finais em resolução integral.
- Consulta visual das duas seções e inspeção adicional de produto desktop, menu desktop, seleção rápida mobile e política mobile. Leitura programática de textos, famílias tipográficas e instâncias, sem mutação de nós.
- Referências consultadas: `AGENTS.md`, `portfolio-content.js`, `docs/nova-home-projetos.md`, `output/meta-suplementos/copy.md`, `final/index.html`, `final/media.json`, inventário de `final/images/`, contact sheet e instruções de continuidade da Meta.
- Fluxos abaixo descrevem estados desenhados e sua sequência provável. Não comprovam protótipo navegável, comportamento implementado ou testes com usuários.

## Contexto confirmado pelo Otavio

Resposta: “mesmo escopo da meta suplementos”. Referência aprovada da Meta: redesign de UX/UI de todas as telas, informado por pesquisa de mercado e persona, e direção de imagens com IA. As duas seções da Assopra contêm desktop e mobile.

Resposta sobre fotografias e banners: “sim por mim com IA”. A autoria das imagens e o uso de IA estão confirmados.

Não foi afirmado: autoria da identidade original, composição de equipe, plataforma de implementação, publicação, desempenho, resultados, métricas, pesquisa específica ou métodos além dos confirmados. Os depoimentos e textos institucionais desenhados não constituem evidência de resultados do projeto.

## Inventário desktop

| Nó | Nome no Figma | Conteúdo observado |
|---|---|---|
| `1:1556` | Home | 1440 × 6598; abertura, categorias, produtos, campanhas, coleções, história, depoimentos, grupo VIP e rodapé |
| `1:1756` | Home - Menu Hover | Navegação expandida com colunas e produtos |
| `1:1972` | Home - Search | Busca aberta com produtos sugeridos |
| `1:2193` | Home - Searching | Consulta preenchida; categorias de resultados Produtos, Coleções e Combinados |
| `1:2414` | Catálogo | 1440 × 2555; campanha de abertura e grade com campanhas intercaladas |
| `1:2460` | Catálogo - Filtro Dropdown | Filtro aberto por tipo de roupa, preço e faixa etária |
| `1:2547` | Produto | 1440 × 5114; galeria, compra, frete, informações, combinados, recomendações e campanhas |
| `1:2786` | Produto Adicionar ao Carrinho | Carrinho aberto sobre o produto; itens, quantidades, frete grátis, combinados e subtotal |
| `1:3019` | Política de seguranca | Texto institucional em coluna com ilustração de fundo e rodapé |

## Inventário mobile

Todos os frames têm largura de 402. São composições reais fornecidas, não adaptações a produzir a partir do desktop.

| Nó | Nome no Figma | Conteúdo observado |
|---|---|---|
| `1:3136` | Home | 402 × 6305; campanha vertical, produtos e coleções em trilhas, história, grupo VIP e rodapé empilhado |
| `1:3299` | Home Menu Open | Menu principal aberto |
| `1:3461` | Home Menu Open Selected | Categoria expandida e subcategorias |
| `1:3623` | Home Search | Busca aberta |
| `1:3786` | Home Searching | Busca preenchida |
| `1:3949` | Catálogo | 402 × 4517; campanha vertical e grade de dois produtos |
| `1:4037` | Catálogo Filtrar | Filtros abertos sobre o catálogo |
| `1:4166` | Produto | 402 × 4987; galeria e informações em sequência vertical |
| `1:4334` | Produto Adicionar ao Carrinho | Carrinho aberto sobre o produto |
| `1:4536` | Produto Adicionar ao Carrinho | Nome divergente: o conteúdo visível é a política de segurança mobile |
| `1:4681` | Catálogo Adicionar ao Carrinho | Adição rápida no catálogo: produto e tamanhos, incluindo 4A esgotado |

## Fluxos e estados

1. Descoberta: abertura → categoria/coleção → catálogo → produto. Menus desktop e mobile têm organizações próprias.
2. Busca: painel aberto → consulta preenchida → agrupamento de resultados. Há ações de fechar e limpar. Não foi encontrado estado sem resultados nestas seções.
3. Refinamento: catálogo → filtro de roupa, preço e idade → ação de aplicar. Não há evidência suficiente para narrar a persistência dos filtros.
4. Compra: galeria → cor/tamanho → quantidade → cálculo de frete → adicionar ao carrinho → painel de carrinho. Seleção rápida mobile inclui tamanho indisponível.
5. Composição de looks: peças combinadas no produto e sugestões no carrinho; campanhas destacam irmãos e família.
6. Relacionamento: história da marca, áreas de depoimentos, cadastro VIP/WhatsApp, newsletter e políticas. Não foi identificado checkout completo, pagamento, confirmação de pedido, login ou fluxo de favoritos nos recortes enviados; ícones não comprovam fluxos completos.

## Componentes e linguagem visual

Instâncias recorrentes: Nav Bar, Main Banner, Product Card, Mini Product Card, Size Button, Quantity Selector, Accordion, Input, Primary Button, Collections Card e Search Menu. Nomes genéricos como Card Filter também são usados para o carrinho; o inventário deve seguir o conteúdo visível.

Famílias confirmadas no arquivo: Sugar Handy nos títulos manuscritos; Nunito e Nunito Sans no texto e nos controles. Não é uma composição de títulos serifados como a Meta. A paleta visual combina branco quente, neutros claros, oliva suave e rosado; fotografias preservam tons naturais, roupas em xadrez e cores suaves. Cantos arredondados e ícones finos acompanham a linguagem acolhedora.

Desktop usa grades de quatro produtos e composições largas; mobile reorganiza campanhas verticalmente, usa trilhas de produtos/coleções e grade de dois produtos no catálogo. Os títulos e as fotos fornecem personalidade; preços, tamanhos e ações usam hierarquia mais funcional.

## Cuidados editoriais para a próxima etapa

- Há nomes e valores repetidos em cards, categorias genéricas, contatos de exemplo e divergências de valor mínimo de frete. Não converter esse conteúdo de exemplo em alegação comercial no case.
- Existem cards de depoimento em vídeo sem imagem, visíveis como áreas brancas com play. Não são candidatos a destaque isolado; não inventar imagens para completá-los.
- O carrinho mostra uma ação rotulada “Adicionar ao Carrinho” mesmo já aberto. Descrever apenas o painel e seu conteúdo; não afirmar fluxo de checkout concluído.
- Não inferir movimento de abertura, acessibilidade, filtros funcionando, pesquisa validada ou conversão a partir de telas estáticas.

## Direção preliminar da narrativa visual — após aprovação do texto

Abertura e descoberta → navegação e busca → catálogo e filtros → produto e seleção de tamanhos → combinados e carrinho → imagem de marca. Incluir trechos intermediários da home e do produto, evitando repetição dos mesmos heróis e páginas inteiras ilegíveis.

Dispositivos: usar `assets/projects/devices/macbook.svg` e `iphone.svg` com proporções preservadas. Exportações finais dos aparelhos em PNG transparente, sem textos ou fundos de revisão. Componentes individuais em masonry com gap 16px, raio 16px, borda CSS de 1px preto a 8%, sem sombra ou fundo externo. Preservar cores internas; não gravar a borda nos arquivos. Banners, se fornecidos, em grade ou carrossel com autoria e processo confirmados.

Fontes integrais, coordenadas dos recortes, índice de mídia, apresentação HTTP local e ZIP foram preparados após a aprovação de `copy.md`. Nenhuma alteração em produção, Studio, Figma, commit, PR ou deploy faz parte desta etapa.
