# Nova home — Projects em cards e o detalhe do projeto

## Assopra Store — 22/10/2026

Revisão após a publicação: o Otavio aprovou uma versão ampliada em inglês, com dois parágrafos de Overview e explicações mais concretas sobre descoberta, busca, filtros, seleção de tamanho, frete, combinados e adaptação mobile. O texto mantém o escopo confirmado e não acrescenta resultados ou métodos de pesquisa. Os três banners passaram para um ticker após o catálogo e antes do produto/carrinho, como na Meta. Contrato de movimento e interação em [patterns.md](patterns.md), “Campanhas em ticker”.

Case de redesign aprovado pelo Otavio, com o mesmo escopo confirmado da Meta: UX/UI das telas, pesquisa de mercado e persona e criação de imagens com IA. Textos em inglês aprovados em Role, Summary, Overview, The challenge, Design decisions e Image direction, sem resultados ou implementação presumidos.

`assets/projects/assopra-store/` preserva as 23 imagens da apresentação local aprovada: nove MacBooks e quatro iPhones já compostos em PNG transparente, sete componentes individuais e três campanhas recortadas da home fornecida no Figma. Os nove recortes desktop têm proporção 1,6:1, exatamente a área útil do MacBook, preenchendo a tela sem deformação. Os iPhones usam telas mobile reais, com espaço para a ilha dinâmica não encobrir os títulos. Os dispositivos usam `framed: true`, os componentes usam `layout: "masonry"` e as campanhas usam `layout: "banners"`, com o texto aprovado sobre autoria e IA. Reutilizam gap 16, raio 16, borda preta a 8%, sem sombras ou fundo cinza externo. O favicon é o coelho da marca, recortado da navegação original; a fonte e as coordenadas ficam no estudo local.

O Otavio pediu Meta Suplementos e Assopra Store, nessa ordem, imediatamente antes de CloudFaster. A seed `portfolio-content.js` e a atualização do Studio preservam os demais projetos e coleções. `project-media.mjs` contém o mesmo inventário como suplemento estático. Os estudos, fontes, recortes, textos aprovados, apresentação e ZIP continuam em `output/assopra-store/`, fora do deploy. Publicação autorizada em 22/10/2026; a atualização do Studio usa backup e trava da revisão corrente, após os assets estarem públicos.

Publicado no projeto Vercel existente e no Studio/D1 em 22/10/2026: revisão 23 → 24, com o novo case, a ordem pedida e duas entradas de atividade. Auditoria confirmou todos os conteúdos anteriores e a lixeira preservados. Os 24 assets (23 imagens e o coelho da marca) foram conferidos por SHA-256 no domínio público. A galeria publicada carregou as 23 imagens em 1440, 768 e 390px, com sete componentes em masonry e treze mockups, sem overflow ou erros de página; lightbox por teclado e retorno de foco passaram. Validação local: 31 testes Storybook/axe, 26 testes de página, quatro documentos HTML balanceados e sintaxe dos 17 scripts públicos. Os 28 casos da matriz visual passaram em dois lotes via `VISUAL_CASES`, para respeitar o timeout de 60 segundos da execução completa, sem alterar baselines ou tolerâncias.

## Meta Suplementos — 22/10/2026

Revisão da seleção após a publicação: a pedido do Otavio, `home-macbook.png` permanece como capa e sai da galeria para não repetir a abertura. O mockup `ironhair-feature-macbook.png` também sai da galeria. Seed, suplemento estático e Studio passam a ter 23 imagens na galeria; os arquivos e os estudos originais são preservados.

Os cinco banners passam a `layout: "ticker"` depois dos recortes de catálogo e antes da página de produto, ocupando toda a largura do drawer, conforme [padrão compartilhado](patterns.md). `previewFramed` no suplemento estático preserva a apresentação transparente da capa, mesmo depois de ela sair da galeria.

Esta revisão passou em 31 testes Storybook/axe, 27 testes da página e nos 28 casos visuais (somente as três baselines de campanhas mudaram intencionalmente). As capturas reais dos dois cases em 1440, 768 e 390px confirmam o ticker entre catálogo e compra, sem overflow. A atualização do Studio preserva a ordem Meta → Assopra → CloudFaster e usa backup e trava da revisão corrente.

Case de redesign aprovado pelo Otavio: UX/UI de todas as telas da loja, informado por pesquisa de mercado e persona, e direção de imagens profissionais com modelos e produtos usando IA. Textos em inglês aprovados em Role, Summary, Overview, The challenge, Design decisions e Image direction; sem métricas de resultado ou URL da loja inferidas. O favicon PNG 600×600 foi enviado pelo Otavio e preservado byte a byte.

`assets/projects/meta-suplementos/` contém doze PNGs com aparelhos já compostos e fundo transparente, oito recortes individuais e cinco banners JPG fornecidos no ZIP. `framed: true` mantém as imagens dos aparelhos sem borda externa ou segunda moldura e preserva sua proporção; os dois iPhones continuam agrupados. Componentes usam `layout: "masonry"`, com três colunas, duas abaixo de 760px úteis e uma abaixo de 480px, gap 16, raio 16 e a borda existente de preto a 8%. Os sete MacBooks adicionais mostram as seis áreas indicadas pelo Otavio e o carrinho aberto, com legenda identificando o pré-checkout. Os banners aparecem em grade de duas colunas, uma abaixo de 480px úteis, com um texto sobre produção profissional de imagens realistas com IA. Os JPGs do ZIP foram preservados byte a byte. Não há drop shadow nem fundo cinza externo. As cores internas das interfaces permanecem. Lightbox e falha de imagem reutilizam o comportamento da galeria.

A seed e o suplemento estático espelham o novo registro `projects/meta-suplementos`; o Studio/D1 recebe a entrada após a publicação dos assets, com backup e trava de revisão, preservando as demais coleções. Os estudos e o pacote para continuar a Assopra permanecem em `output/meta-suplementos/`, fora do deploy estático.

Publicado no projeto Vercel existente e no Studio/D1 em 22/10/2026: revisão 22 → 23, somente a nova entrada e seu registro de atividade. Os 28 arquivos de imagem da pasta (incluindo o favicon e dois recortes de campanha reservados) foram conferidos por hash no domínio público. Na página publicada, as 25 imagens carregaram em 1440, 768 e 390px, sem overflow ou erros de página; o lightbox preservou a navegação por teclado e o retorno de foco. Validação local: 31 testes Storybook/axe, 26 testes de página, matriz visual completa, quatro documentos HTML balanceados e sintaxe dos 17 scripts públicos.

Desde 21/10/2026, o carrossel e o detalhe com galeria estão aprovados para a home **`/`**, com **sangra + drawer + anel** fixos e sem painel de ajustes público. O protótipo continua em **`/testes/prototipo-nova-home`** (rota `noindex`) para comparar variantes. As preferências salvas no protótipo não alteram a home. Ele existe pra decidir olhando, não descrevendo — três escolhas que o Figma não fecha estão num painel de troca na própria página.

Fonte: arquivo `Oktavio` (`H0X3JmAFN32LWINqemEhXs`), frames **card `124:562`**, **seção `124:1280`** e **detalhe `133:248`** ("Project details Modal estilo Vault do Emil"). Contrato geral entre Figma e repositório: [figma-workflow.md](figma-workflow.md).

## Os arquivos

| Arquivo | O que é |
|---|---|
| `testes/prototipo-nova-home.html` | a página; carrega `main.css` + `flat-type.css` + o CSS do protótipo, nessa ordem |
| `styles/projects.css` | estilos compartilhados do carrossel, detalhe e galeria |
| `testes/prototipo.css` | importa os estilos compartilhados e acrescenta apenas o painel de ajustes |
| `projects.mjs` | carrossel, detalhe e galeria compartilhados; variantes persistidas apenas quando o painel existe |
| `testes/prototipo.mjs` | reexporta a implementação compartilhada |
| `tests/ui/proto-nova-home.test.mjs` | roda no `npm run test:product-ui` |

`portfolio.mjs` continua dono de tudo que não mudou (Writing, Personal, Life, contribuições, lightbox). A seção Projects do protótipo não tem `data-list="projects"`, então o renderer de produção não monta rows ali e o módulo novo assume a seção inteira.

## O que bate com o frame

Nada disso precisou de token novo: `--ls-tight` é exatamente o `-0.16px` a 16px do frame, `--lh-base` e `--lh-snug` são o 1.6 e o 1.5, e os raios 12/16/24 já existem.

**Card** — 266×332, padding 20, raio 16, fundo `--white`. Ícone de expandir de 16 no topo à direita, marca de 64×64 (raio 12, borda `--line`) no meio, título em `text/16-medium` `--ink` e descrição em `text/16-regular` `--muted` com gap 6. `justify-content: space-between`, então o ar em volta da marca é sobra dividida (~66 de cada lado), não um gap fixo.

**Seção** — cabeçalho com o título à esquerda e a pílula de setas à direita, 24 até a lista, cards com gap 16. A pílula tem fundo `--bg`, borda `--line` e raio total; o botão ativo é `--white` com a seta `--ink`, o desabilitado é transparente com a seta `--faint`.

O cabeçalho inteiro recebe a margem superior de seção (72 no desktop, 64 até 560px), igual a Contributions → Writing. Zerar as margens do `h2` dentro do flex sem transferir a superior ao cabeçalho havia colado Projects à última linha de Writing; corrigido em 21/10/2026.

**Detalhe** — folha de 1000 com padding 20 e raio 24, alça de 48×4 em `--line`. Imagem principal com raio 24 (atualizado em 21/10 a pedido), depois 40 de respiro e 40 entre blocos. Galeria com gap 16 alternando duas meias e uma inteira. Desde 21/10/2026, a pedido, capa e fotos mantêm suas proporções naturais: os recortes fixos do frame truncavam capturas de produto. "In practice" e "Links" em `--faint`, primeiro destaque em `--ink` e os demais em `--muted`.

## Decisões que a IA tomou (o frame não diz)

- **A seta pixelada** (`Arrow Pixelate`, `110:325`) não existia em código. Virou SVG de cinco `<rect>` de 2px em `currentColor`, pra herdar a cor do estado do botão.
- **A marca de 64** está vazia no frame. Usa o favicon do primeiro link — o mesmo que a row de Projects já mostra hoje. Falhou, o `<img>` sai e sobra o quadrado.
- **O fill da marca** no frame é branco a 5%, que em Dark é o `--ink-a5` do site e em Light some. Em código é `--ink-a5` nos dois modos.
- **O ícone de expandir** exporta igual nos dois estados do frame (os dois SVGs são byte a byte idênticos), então a cor virou decisão: `--faint`.
- **O passo do carrossel** sai do layout real (card + gap), não de um número repetido no JS.
- **O estado das setas** nasce do `scrollLeft` da trilha, não de um índice próprio: arrastar, rolar no trackpad e dar Tab pro próximo card mexem no scroll sem passar pelas setas.
- **Foco atrás:** a página sai da ordem de foco (`inert` em `main`) enquanto a folha está aberta. O `.cmd-modal` do site não faz isso, mas ele é pequeno e esta folha cobre quase tudo.
- **O topbar sai por opacidade, nunca por `transform`** — o estado escondido dele já é um `translate(-50%, …) scale()`, e sobrescrever a propriedade inteira joga a barra pra fora do centro. Foi o primeiro bug da implementação.
- **O wash** é o `--wash-bg` + blur do `.cmd-wash`, igual às outras camadas do site. Sozinho ele quase não vela uma página quase branca; quem separa é o blur. Com a escala da página atrás, dá o par "scale-and-blur" que o próprio prompt de drawer deste repositório descreve (`prompts.mjs`).
- **Scroll do detalhe (21/10/2026):** a folha leva `data-lenis-prevent`, para wheel/trackpad rolarem seu conteúdo nativamente nos dois modos. Sem o atributo, o Lenis interceptava o gesto e rolava a janela atrás. O teste usa wheel real, verifica subida/descida e a posição da página atrás; scroll programático não reproduzia o problema.

## Os três eixos em aberto

Trocáveis no painel da página, persistidos em `localStorage`:

1. **Carrossel — sangra × coluna.** No frame os quatro cards somam 1112 dentro de uma coluna de 640 e o corte só acontece na borda dos 1440. Desde 21/10/2026, a pedido, `sangra` leva a trilha às duas bordas da janela (`margin-inline: calc(50% - 50vw)`), com padding inicial e scroll-padding para manter o primeiro card e o snap alinhados ao título. Os cards anteriores continuam visíveis à esquerda da coluna ao avançar; antes, a trilha só sangrava à direita e os recortava na borda esquerda da coluna. `coluna` respeita os 640. O resto da página inteira é coluna centrada, então sangrar é uma quebra deliberada de ritmo.
2. **Detalhe — drawer × modal.** Vaul é a biblioteca de drawer do Emil, e a alça do frame é a dela: o `drawer` sobe de baixo, arrasta pra fechar (distância **ou** velocidade) e escala a página atrás. O `modal` usa a geometria do `.cmd-modal` (`--ease-pop`, scale 0.96 → 1) pra que os dois modais do site continuem lendo como uma superfície só, e troca a alça por um botão de fechar — uma alça que não arrasta é uma promessa falsa.
3. **Hover do card — anel × fill.** O Figma desenhou anel (`--line`, sem preenchimento). O site decidiu em 29/08/2026 que row é **só fill** em `--row-hover`, sem anel e sem transição, conferido no HTML do Emil e do Jakub ([figma-workflow.md](figma-workflow.md)). As duas superfícies convivem na mesma página, então dá pra comparar de perto.

## De onde vem o conteúdo

Tudo sai de `window.PORTFOLIO_CONTENT` — em produção, servido pelo Worker a partir do D1 do Studio. Dois campos entraram:

- **`summary`** — a linha curta do card. Registro diferente do `role`: o card diz o que o projeto é ("Founding design for a medical-education company"), o `role` diz a disciplina ("Interactive Product + Campaigns · Medical Education"). Writing já usava o campo com o mesmo sentido. No Studio: **"Resumo na home"**.
- **`gallery`** — `[{src, alt, caption}]`. No Studio: **"Galeria do projeto"**. Semeado só no Caderno de Erros, com quatro telas reais do produto baixadas da própria home dele e abertas uma a uma antes de entrar (regra 7 do `AGENTS.md`, aplicada a imagem).

Quedas graciosas, pra rota funcionar hoje com os dados que já estão no ar: sem `summary` o card mostra o `role`; sem `gallery` a galeria é montada das capas dos `subprojects` (a Escola da Bel já tem cinco); sem nenhum dos dois o bloco não aparece.

**Consequência prática:** o `portfolio-content.js` do repositório é semente e vale no `dev:admin`; o site publicado só mostra `summary` e `gallery` depois que forem preenchidos no Studio.

## O que ficou de fora, de propósito

- **Upload de imagem.** O Studio salva URL, não arquivo, e o Worker não tem bucket. A galeria vem do dashboard como campo de URL. Upload de verdade é R2 + rota no Worker + UI — trabalho separado, e é o que falta pra experiência ser "subir foto pelo dashboard".
- **A renomeação de Writing pra "Experiences"**, que o frame mostra. O protótipo testa uma mudança de cada vez.
- **Contributions no frame** e as seções abaixo de Projects continuam pendentes do lado do Figma (ver o fim de [figma-workflow.md](figma-workflow.md)).

## Divergências de conteúdo no frame

- O card do Caderno de Erros trazia "plataform"; em código entrou "platform".
- O frame mostra quatro projetos; o conteúdo tem sete, e o carrossel mostra todos (a lista de rows cortava no quarto com "show more").
- O perfil do frame diz "Visual Designer · GOW Studio"; produção diz "Product & Visual Designer · GOW Design". O protótipo seguiu produção.

## Promoção para a home (21/10/2026)

A home importa `projects.mjs` e `styles/projects.css`; o protótipo reusa esses mesmos arquivos. `portfolio.mjs` continua montando Writing, Personal e Life; Projects não tem mais o host de rows nem show more. ⌘K mantém seu renderer de detalhe para resultados de busca. O build de assets do Studio inclui o módulo e `assets/` para continuar servindo a home no Worker/local.

`assets/projects/` guarda fallbacks locais para três capas ausentes/quebradas no D1: CloudFaster (social cover atual de `https://cloudfaster.academy/img/og/home.png`), FinQ (social cover do site original `dev-finqedu.webflow.io`, imagem `https://cdn.prod.website-files.com/67fa3b5335fadc68fbc167da/680968a2ae29a174f542cbf8_img-finq-link.jpg`) e DascIA (wordmark original `https://dascia.com.br/assets/logo-navbar.webp`, centralizado sobre fundo escuro em SVG). Arquivos abertos e conferidos antes de entrar. Novas capas válidas do Studio prevalecem; a URL legada conhecida do CloudFaster cai no fallback. Nenhum registro remoto foi sobrescrito. Imagem de galeria que falha remove também seu botão.

O detalhe mantém Tab dentro da folha, Enter/Space na alça fecha para quem usa teclado, e abrir o composer ou ⌘K fecha a folha. A suíte da home cobre capas, proporções e gap da galeria em desktop/mobile, teclado e lightbox; a do protótipo cobre wheel real nos dois modos, sangria e espaçamento de seção.

### Pixel Office — imagens fornecidas pelo Otavio

As 12 capturas de 21/10/2026 estão em `assets/projects/pixel-office/`, na ordem enviada, sem recorte nem conversão. `project-media.mjs` reconhece o registro pessoal pelo link `gow-pixel-office.vercel.app` e preenche apenas `gallery`/`preview` ausentes. A capa é `cover.png`, a captura da tela de boas-vindas enviada depois; as 12 imagens anteriores continuam na galeria. Isso permite publicar os assets pelo mesmo deploy estático sem sobrescrever o D1; conteúdo definido no Studio tem prioridade. O identificador remoto permanece `personal/prompts` (já renomeado para Pixel Office no Studio); a seed local foi alinhada a esse registro.

`portfolio.mjs` encaminha linhas de Personal com galeria para o detalhe de `projects.mjs`, passando a coleção no gatilho. As outras linhas continuam no detalhe do ⌘K. `project-media.mjs` também entra na allowlist do build do Worker. A suíte da home verifica as 12 imagens, capa, lightbox da última captura, Escape por camada e retorno do foco à linha.

### Links das landing pages

A promoção havia usado apenas `subprojects[].preview` na galeria, descartando os URLs e descrições que o detalhe anterior mostrava. Corrigido em 21/10/2026: todo registro com `subprojects` ganha uma seção **Landing pages** com o nome e a descrição dentro do link, abrindo a LP em nova aba (`target="_blank"`, `rel="noopener"`). A galeria continua ampliando imagens; a seção de links existe independentemente de uma capa carregar ou falhar. Na Escola da Bel, os cinco destinos são preservados integralmente. O teste compara nomes, descrições e URLs com os dados de conteúdo e cobre falha das imagens.

O subtítulo de perfil da home e do protótipo agora é **UI/UX & Visual Designer**, a pedido do Otavio.

### Portfolio.zip — Bullster, CloudFaster, FinQ e Sphera

As 138 imagens fornecidas em 21/10/2026 ficam em pastas próprias de `assets/projects/`, convertidas para WebP nas dimensões originais (PNG sem perda; JPEG com qualidade 90). O conjunto passou de 65,9 MiB para 19,8 MiB. `project-media.mjs` complementa galerias ausentes: CloudFaster 15, FinQ 12, Sphera 14 e Bullster 7. Não substitui galerias preenchidas no Studio. A capa `01-cover` do Sphera substitui somente a URL legada conhecida ou uma capa ausente; CloudFaster e FinQ mantêm suas capas existentes.

O ícone do Google e um recorte isolado de campo do FinQ, o canvas de visão geral e o comparativo de botão do Bullster ficam nos assets, fora da galeria; a capa do Sphera não se repete nela. Bullster usa `web-cover.jpg`, fornecida depois do ZIP, como capa. A galeria foi reduzida a seis telas representativas (home, dashboard, campanhas, automações, integrações e resumo de configurações), seguidas pela landing page completa em largura inteira, a pedido para reduzir repetição e comprimento. Seu texto foi fornecido pelo Otavio nesta sessão, sem datas, métricas de resultado ou URL inventados. A seed inclui o case; a publicação exige também criar o registro `projects/bullster` no D1, preservando a revisão atual conforme [content-alignment.md](content-alignment.md).

Capas, miniaturas de projeto e imagens ampliadas usam `--radius-24`. O lightbox recebe o modificador `.lightbox--project` ao abrir pela galeria de um projeto; imagens ampliadas mantêm a proporção e o raio na própria imagem, inclusive capturas verticais. A moldura externa usa raio 28 com padding 4. O lightbox do avatar mantém seu estilo existente.

### Telas mobile e contexto dos cases — 21/10/2026

Revisão das dimensões de todos os assets: CloudFaster tem 33 capturas verticais e FinQ tem 42; Sphera e Pixel Office são telas de desktop, e a LP longa do Bullster continua em largura inteira. `gallery[].layout = "mobile"` identifica as capturas compactas, com `width`/`height` nas dimensões originais para reservar a proporção antes do carregamento. `layout = "wide"` preserva a LP. A classificação vem dos arquivos conhecidos e do contexto do projeto, não só da orientação — uma LP vertical não é uma tela mobile. URLs locais conhecidas também recebem esses metadados no renderer quando a galeria do Studio ainda só tem `src`/`alt`.

Após a conferência visual, a seleção foi reduzida a 15 imagens no CloudFaster e 12 no FinQ, priorizando fluxos e decisões diferentes e retirando estados repetidos de splash, login e teclado. Os arquivos completos continuam nos assets. Os grupos de telas mobile usam três colunas, gap 24 e altura máxima de imagem 480. Quando a largura útil da galeria cai a 620, passam a duas colunas, gap 16 e altura máxima 420. As imagens mantêm a proporção, sem recorte, com raio 24 e ampliação pelo mesmo lightbox. A ordem original é preservada, inclusive quando um grupo mobile aparece entre telas de desktop. Legendas passam a ser visíveis abaixo de capturas selecionadas, com gap 12; os metadados de largura e altura não limitam a versão ampliada.

O arquivo `joam-interview-project-cheat-sheet.md` enviado pelo Otavio fundamenta seções curtas de desafio e decisões em Bullster, Sphera, CloudFaster, Caderno de Erros, DascIA, Escola da Bel e Pixel Office. FinQ usa apenas os fatos já aprovados na seed, pois não consta nessa referência. As seções usam `sections` do schema existente e aparecem antes da galeria; as legendas ligam a leitura às telas. O escopo de CloudFaster foi corrigido para incluir UI web/mobile, conforme a nova fonte. Melhor scanability e conforto no Bullster são intenções de design, sem alegar resultados medidos. Não foram publicados links privados do Pixel Office nem acrescentados projetos que só aparecem na preparação da entrevista. As alterações de texto estão espelhadas na seed e preparadas em `.local/case-content-updates.json`; sua publicação ainda exige aplicar os campos ao D1 com trava de revisão.

`Fav.jpg` do Bullster foi convertido para `assets/projects/bullster/favicon.webp`. O registro usa esse caminho em `faviconFrom`; `favicons.js` aceita imagens locais de `assets/projects/` sem inventar um domínio para o projeto. Falha no arquivo remove o `<img>`, mantendo a cascata externa dos demais ícones.

### Refinamento do drawer e recorte das miniaturas — 21/10/2026

Após revisão no navegador do Otavio, o card do Bullster foi confirmado vazio, apesar de carregar em um browser novo de teste. O card agora renderiza a marca local diretamente, ocupando a moldura de 64 para manter a arte legível, independente do helper global de favicon, e `project-media.mjs` complementa `faviconFrom` ausente pelo identificador `bullster`. O teste de regressão cobre helper sem suporte local e registro sem campo de ícone. Não se atribuiu a causa a cache sem comprovação.

A pedido do Otavio, a regra anterior de não recortar cede **somente nas miniaturas mobile**: todas usam moldura `9 / 19.5`, largura máxima 220, `object-fit: cover` e alinhamento no topo. Isso uniformiza largura e altura em cada linha; fontes completas continuam nos assets e na ampliação. Em galerias de até 620 de largura, a moldura tem limite de altura equivalente a 420. Capas, desktop e a LP do Bullster mantêm a proporção original.

O drawer passa a padding 32 no desktop e 20 no celular. Capa → conteúdo tem 48 de respiro (32 no celular); blocos têm gap 56 (40 no celular). O texto usa uma coluna de até 640. Galerias desktop têm gaps 48 vertical / 32 horizontal; grupos mobile, 56 / 32, caindo para 40 / 20 quando a largura útil é até 620. Legendas ficam 24 abaixo da imagem (16 no celular). Título/subtítulo usam gap 8, bio tem 24 antes, seções têm 16 entre rótulo e texto. Todos os valores vêm dos tokens existentes; o raio das imagens continua 24.

### Alturas alinhadas e raio 16 — 21/10/2026

A revisão seguinte mostrou que o desnível também acontecia nas imagens de desktop, como automações e integrações do Bullster. A pedido do Otavio, todas as miniaturas desktop agora usam moldura 16:10, com `object-fit: cover` e recorte pelo canto superior esquerdo para preservar o início da interface. Assim, imagens lado a lado têm a mesma altura e as legendas começam alinhadas. Miniaturas mobile mantêm a moldura 9:19.5 já uniforme. A LP final também recebe o recorte na prévia; a captura completa, incluindo o conteúdo abaixo da dobra, continua na ampliação.

O raio de capas, miniaturas e imagens ampliadas passa de 24 para **16**, substituindo a decisão anterior. A moldura do lightbox de projeto passa para 20 com padding 4. O raio externo do drawer e as marcas dos cards seguem seus componentes. Mockups de MacBook/iPhone foram mencionados como possibilidade futura, explicitamente fora desta etapa.

**Exceção aprovada na sequência:** a LP final do Bullster usa `layout: "full"` e mantém sua altura natural no próprio drawer. As demais miniaturas continuam com recorte uniforme e todas as imagens de projeto mantêm raio 16.

**Espaço real entre miniaturas mobile:** o grupo tem largura máxima de três imagens de 220 + dois gaps de 32, centrado na galeria. Isso remove o espaço extra que sobrava dentro das colunas flexíveis. Na largura útil até 620, são duas colunas com gap 24; a largura máxima acompanha o limite de altura 420. O teste mede a distância entre as bordas das imagens, além do gap declarado no grid.

**Legendas das telas mobile:** ficam fora dos botões e ocupam a linha inteira do grupo, alinhadas ao início. Um `ResizeObserver` reorganiza as legendas após cada linha visual de três ou duas imagens, sem duplicar o texto nem recriar os botões. O vínculo `aria-describedby` é preservado, e os observers são desligados ao fechar/trocar o case. Falhas de imagem removem a legenda vinculada antes de reorganizar o grupo.


**Introdução centralizada após a capa (21/10/2026):** somente `.pdrawer__head` (título, função e bio) tem margens laterais automáticas, mantendo a coluna de até 640 e o texto alinhado ao início. As seções seguintes e a galeria preservam seu alinhamento.


**Coluna única para os blocos de texto (21/10/2026):** após revisão seguinte, a centralização também se aplica a todas as seções de texto diretamente no corpo (“The challenge”, “Design decisions”, “In practice”, links e afins). Compartilham a mesma largura máxima 640 e margens laterais automáticas da introdução, preservando alinhamento do texto ao início. Galeria e legendas continuam com suas próprias larguras. Esta decisão substitui a manutenção das seções à esquerda registrada acima.


**Marcas centralizadas nos cards (21/10/2026):** imagens da marca zeram a margem herdada de `.fav` (7px à direita, prevista para ícone ao lado de texto) e não encolhem no flex. A moldura mantém 64×64; o ícone externo mantém 32×32 e a arte local ocupa seu interior.


**Transição da última imagem para o rodapé do case (21/10/2026):** a legenda da última imagem que ocupa a largura inteira usa a coluna centralizada de até 640. Assim, a última legenda e os blocos “In practice”/“Links” compartilham a mesma borda de leitura. Legendas de pares desktop e grupos mobile continuam ligadas às respectivas linhas de imagens.


**Legendas completas por par e revisão de escrita (21/10/2026):** a revisão seguinte esclareceu que pares desktop devem manter duas legendas, uma por imagem, com extensão e tom próximos. As 14 telas do Sphera agora têm descrições específicas, após inspeção das capturas (calendário, bolsas, mapas, filtros, universidades, mensagens e perfil). As descrições curtas do Caderno e do Pixel Office ganharam contexto a partir dos campos e funcionalidades já documentados; no Bullster, os trechos de automação, integrações e tema escuro foram refinados. Não foram adicionados resultados medidos ou novas responsabilidades.

As legendas usam `text-wrap: pretty`, como as descrições do site já faziam, para reduzir palavras isoladas sem travar as quebras. A revisão por Range mediu 37 legendas em 320, 390, 768 e 1440px (148 renderizações), sem última linha de uma única palavra após os ajustes. Isso é uma verificação nessas larguras, não uma promessa para toda combinação de fonte e viewport. O layout em pares e a regra de legendas compartilhadas por linha mobile foram preservados.


**Legenda de imagem grande entre outras imagens (21/10/2026):** quando a imagem ocupa a linha inteira e ainda há imagens depois dela, a legenda usa toda a largura da galeria e `text-wrap: balance`. Isso permite uma linha mais ampla ou linhas equilibradas, conforme o espaço. A última legenda mantém a coluna de até 640 para a transição aos blocos finais; pares desktop e linhas mobile preservam suas regras. A condição é estrutural (`.pgal__item--wide:not(:last-child)`), sem índices fixos de conteúdo.

### Borda das imagens e telas mobile mais próximas — 22/10/2026

A pedido do Otavio, capa e capturas da galeria no drawer recebem borda sólida de 1px em preto puro a 8% (`--project-image-border`), inclusive no tema escuro. O gap horizontal entre telas mobile passa de 32 para 16 no grupo de três e de 24 para 16 no grupo de duas. A largura máxima dos grupos acompanha os novos gaps para manter a distância real entre imagens em 16, sem espaço extra nas colunas. O espaçamento vertical permanece em 32/24.

### Links no cabeçalho do drawer — 22/10/2026

Os links do projeto (incluindo “Live site”) passam para o cabeçalho, logo após a função e antes da descrição, sem o rótulo “Links”. O bloco final foi removido; nomes, destinos e abertura em nova aba são preservados. Assim o acesso ao produto fica disponível antes da leitura do case e da galeria.

**Capas de landing pages (22/10/2026):** a galeria derivada de `subprojects`, como a Escola da Bel, usa recorte centralizado (`object-position: center`) na moldura 16:10. O alinhamento superior esquerdo das capturas de produto não serve para essas composições de campanha. O renderer marca as capas derivadas com `layout: "cover"`; a ampliação continua exibindo o arquivo completo.

### Capa da DascIA — 22/10/2026

A imagem JPEG 1920×1080 enviada pelo Otavio substitui a capa preta anterior: `assets/projects/dascia/cover.jpg`, preservada sem conversão ou recorte. O fallback em `projects.mjs` e a seed usam o novo caminho; o registro no Studio/D1 recebe a mesma capa após a publicação do asset.

**Galeria da DascIA (22/10/2026):** o ZIP fornecido pelo Otavio acrescenta dez JPGs nas dimensões originais: home institucional clara, página da plataforma escura e oito pranchas de identidade. As páginas abrem a galeria em largura inteira com prévia do topo; as pranchas seguem o recorte centralizado. A ampliação mostra cada arquivo completo. `project-media.mjs` complementa galerias ausentes e a seed espelha as mesmas imagens e legendas; após o deploy dos assets, capa e galeria são sincronizadas no Studio/D1.

### Ordem da galeria FinQ — 22/10/2026

As três peças da App Store (`01`, `02`, `06`), indicadas pelo Otavio, abrem a galeria nessa ordem: boas-vindas, conceitos de IB e exercício. As nove capturas restantes seguem na ordem anterior. D1 atualizado com backup e trava de revisão; o fallback de `project-media.mjs` espelha a sequência.

O grupo de abertura recebe uma legenda que identifica as peças para a App Store, sua apresentação das principais funcionalidades e o crédito do mascote ilustrado à mão por Mateus Gabriel. A legenda acompanha a primeira imagem e usa o bloco compartilhado da linha mobile.

### Palavras finais e favicons dos cards — 22/10/2026

`pretty` permanece nos parágrafos e legendas. Como ainda deixou dez últimas linhas com uma palavra em oito larguras, o renderer agrupa as duas últimas palavras do nó de texto final de cada bloco em `.pdrawer__final-words`. O span é `inline-block`, limitado à largura da coluna e com quebra interna de emergência para não transbordar em termos longos. A marcação inline existente é preservada; um nó final com menos de duas palavras não recebe o grupo. Títulos usam `balance`. A revisão no Chromium com Geist carregada mediu 1.008 blocos dos oito projetos em 320, 375, 390, 430, 560, 768, 1024 e 1440px, sem última linha de uma palavra após o ajuste. Isso não garante todas as combinações de conteúdo, fonte e largura.

Todos os favicons dos cards passam a ocupar 100% da moldura, com `object-fit: cover` e o raio herdado, substituindo o limite de 32px dos ícones externos. O PNG 600×600 enviado pelo Otavio entra sem transformação em `assets/projects/dascia/favicon.png`, declarado na seed e como fallback estático. A seed coloca DascIA imediatamente antes de CloudFaster. Na publicação, a ordem e o campo `faviconFrom` precisam ser espelhados no Studio/D1 depois de o asset estar disponível; o conteúdo remoto continua sendo a fonte da ordem pública.

O Caderno de Erros também recebe a arte enviada pelo Otavio: JPEG 1024×1024, preservado em `assets/projects/caderno-de-erros/favicon.jpg`, declarado na seed e no fallback estático. Segue a mesma moldura preenchida dos demais cards; o campo pode ser espelhado no Studio após publicar o asset.

**Publicado em 22/10/2026:** deploy no projeto Vercel existente `design-engineer`, com as duas imagens conferidas por hash no domínio público antes da sincronização do D1. Backup local preservado; atualização condicionada à revisão 21, avançando para 22, altera somente os dois `faviconFrom` e a ordem dos projetos. Os demais campos e coleções são preservados. Registros de mídia que fornecem apenas favicon também são aceitos: a montagem do índice de fotos usa galeria vazia quando o campo não existe. Validação: 27 testes Storybook, 23 testes da página real, matriz visual e HTML/sintaxe dos arquivos públicos.

### Mockups frontais e novas peças do Caderno — 22/10/2026

Experimento autorizado pelo Otavio, reversível por metadados de mídia: `device: "macbook"` nas quatro telas web do Caderno de Erros e nas páginas institucional e da plataforma/Academy da DascIA; `device: "iphone"` nas nove capturas de interface do FinQ. As três peças de App Store do FinQ e as pranchas de identidade da DascIA preservam sua apresentação original. Em 22/10, o mesmo critério foi autorizado para a CloudFaster: seis capturas de interface recebem `device: "iphone"`; seis artes de App Store e três componentes isolados preservam a apresentação original. As capturas mais longas usam o recorte pelo topo da abertura existente; a ampliação mantém a imagem completa.

As molduras são ilustrações vetoriais locais em `assets/projects/devices/`, frontais e sem perspectiva. A captura é um `<img>` separado dentro da abertura; o aparelho é decorativo via CSS, sem alterar nome acessível, foco ou alvo do lightbox. A abertura do MacBook é 16:10, com recorte pelo topo, e o item ocupa a largura inteira para preservar a escala útil da interface. O iPhone usa uma abertura 9:19.5, com proporção praticamente idêntica às capturas 900×1949; mantém o agrupamento mobile, os gaps e as legendas existentes. Os percentuais internos do CSS são coordenadas das ilustrações, não novos tokens de espaçamento. O clique abre sempre o arquivo original completo, sem aparelho e sem recorte; falha da captura remove o botão e a moldura juntos.

O ZIP `CDE.zip` acrescenta seis peças mobile em `assets/projects/caderno-de-erros/mobile-*.jpg`, na ordem 1–6 fornecida: caderno digital, domínio/flashcards, comunidade, caderno inteligente, busca e evolução. Os JPEGs 1320×2868 foram preservados byte a byte. Já contêm aparelho e composição de marca; não recebem uma segunda moldura. Entram depois das quatro telas web. A seed inclui as seis peças; `appendGallery` no suplemento estático também as acrescenta às galerias existentes do Studio, sem duplicar URLs nem substituir as legendas remotas. Isso permite revisar/publicar a apresentação sem escrita no D1. `device` é enriquecido por URL conhecida no renderer, assim como os metadados de layout anteriores.

Validação específica: story `Patterns/Portfolio/Device project images` usa `galleryMarkup` e o lightbox reais; teste `tests/ui/project-device-gallery.test.mjs` cobre as quatro galerias, exclusão das composições existentes, complemento idempotente do conteúdo remoto, quatro larguras, teclado, fonte original na ampliação e remoção de uma captura quebrada. As expectativas do protótipo acompanham as dez imagens do Caderno. Revisão visual local em desktop e 390px com as capturas reais; nenhuma publicação ou alteração no D1 nesta etapa.

Validação concluída nesta etapa: 29 testes Storybook/axe, 25 testes da página real e matriz visual completa, com três novos baselines (claro, escuro e 390px) inspecionados. Os 17 scripts públicos passam em `node --check`; seis JPEGs conferidos contra o ZIP e os dois SVGs validados como XML.
