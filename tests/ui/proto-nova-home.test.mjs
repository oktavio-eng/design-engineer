import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./helpers/browser.mjs";
import { serveDirectory } from "./helpers/static-server.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const axeScriptPath = path.resolve(repositoryRoot, "node_modules/axe-core/axe.min.js");

/* /testes/prototipo-nova-home — o ambiente de teste da nova home: Projects
   como carrossel de cards (frame 124:1280 do Figma) e o detalhe do projeto
   numa superfície nova (133:248), em dois modos.

   É rota de protótipo, não produção, mas entra na suíte pelo mesmo motivo
   que o resto: o que não é testado volta quebrado sem ninguém ver. O foco
   aqui é o comportamento que o frame NÃO descreve e que é fácil de regredir —
   o estado das setas, a superfície abrindo e fechando, a galeria sobre o
   detalhe, e a página de trás saindo da ordem de foco. */
test("/testes/prototipo-nova-home: carrossel, detalhe e galeria", { timeout: 60_000 }, async (context) => {
  const server = await serveDirectory(repositoryRoot);
  const browser = await launchChromium();
  context.after(async () => {
    await browser.close();
    await server.close();
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // Mesmo stub das outras suítes: nada de rede externa (fontes, favicons,
  // as imagens hotlinkadas do Framer) — o teste é de comportamento.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const type = route.request().resourceType();
    if (type === "stylesheet") return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    if (type === "image") {
      return route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
      });
    }
    return route.fulfill({ status: 204, body: "" });
  });

  await page.goto(`${server.origin}/testes/prototipo-nova-home.html`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll("#projects .pcard").length > 0);
  // Pointer/hover transitions may be interrupted as the drawer opens.
    await page.evaluate(() => Promise.allSettled(document.getAnimations().map((a) => a.finished)));

  // --- o carrossel --------------------------------------------------------
  // 127.0.0.1 conta como localhost, então rascunhos aparecem — hoje são zero,
  // e os oito projetos viram oito cards (a lista de rows tinha um "show more"
  // a partir do quarto; o carrossel não corta nenhum).
  assert.equal(await page.locator("#projects .pcard").count(), 8, "um card por projeto");
  assert.equal(
    await page.locator("#projects .pcard__desc").first().textContent(),
    "Founding design for website and multi-device platform",
    "o card mostra o `summary`, não o `role`",
  );

  const prev = page.locator("[data-proto-prev]");
  const next = page.locator("[data-proto-next]");
  assert.equal(await prev.isDisabled(), true, "no início não há para onde voltar");
  assert.equal(await next.isDisabled(), false, "e há para onde avançar");

  // A seta empurra o scroll da trilha; o estado dos botões vem desse scroll,
  // não de um índice paralelo — é o que mantém arrasto e Tab em sincronia.
  await next.click();
  await page.waitForFunction(() => document.querySelector(".pjt__track").scrollLeft > 0);
  assert.equal(await prev.isDisabled(), false, "avançar habilita o voltar");
  await page.waitForFunction(() => {
    const card = document.querySelector(".pcard").getBoundingClientRect();
    return card.x < document.querySelector("main").getBoundingClientRect().x - 50;
  });
  assert.equal(await page.evaluate(() => {
    const card = document.querySelector(".pcard");
    const box = card.getBoundingClientRect();
    return document.elementFromPoint(Math.max(1, box.x) + 10, box.y + 20)?.closest(".pcard") === card;
  }), true, "o card continua visível e clicável à esquerda da coluna");

  // O fim da trilha desabilita o avançar. Chega lá pelo scroll direto, que é
  // o mesmo caminho de um arrasto de dedo.
  await page.evaluate(() => {
    const track = document.querySelector(".pjt__track");
    track.scrollTo({ left: track.scrollWidth, behavior: "instant" });
  });
  await page.waitForFunction(() => document.querySelector("[data-proto-next]").disabled);

  // --- o detalhe ----------------------------------------------------------
  await page.locator('[data-proto-open="caderno-de-erros"]').click();
  const sheet = page.locator("[data-proto-sheet]");
  await page.waitForFunction(() => document.querySelector("[data-proto-sheet]").getAttribute("aria-hidden") === "false");
  assert.equal(await sheet.getAttribute("aria-label"), "Caderno de Erros");
  assert.equal(
    await page.locator(".pdrawer__title").textContent(),
    "Caderno de Erros",
    "o detalhe é o do card clicado",
  );
  // A página atrás sai da ordem de foco enquanto a folha está de pé.
  assert.equal(await page.locator("main").evaluate((el) => el.inert), true, "main fica inert");

  // Wheel real: scrollTop programático (inclusive o auto-scroll do click)
  // não detecta quando o Lenis captura o gesto de um scroller aninhado.
  async function checkDetailScroll() {
    // Pointer/hover transitions may be interrupted as the drawer opens.
    await page.evaluate(() => Promise.allSettled(document.getAnimations().map((a) => a.finished)));
    // Focus restoration can still be scrolling the window smoothly; wait
    // for that native animation (not returned by getAnimations) to settle.
    await page.evaluate(() => new Promise(resolve => {
      let previous = window.scrollY;
      let stable = 0;
      function frame() {
        stable = window.scrollY === previous ? stable + 1 : 0;
        previous = window.scrollY;
        if (stable >= 8) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }));
    const backgroundY = await page.evaluate(() => window.scrollY);
    const box = await sheet.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 150);
    await page.mouse.wheel(0, 500);
    await page.waitForFunction(() => document.querySelector("[data-proto-sheet]").scrollTop > 100, null, { timeout: 3000 });
    assert.equal(await page.evaluate(() => window.scrollY), backgroundY, "wheel rola o detalhe, sem mover a página");
    await page.mouse.wheel(0, -500);
    await page.waitForFunction(() => document.querySelector("[data-proto-sheet]").scrollTop === 0, null, { timeout: 3000 });
  }
  await checkDetailScroll();

  // Four web captures use full-width MacBooks; the six supplied mobile
  // compositions keep their existing artwork in the compact group.
  assert.equal(await page.locator(".pgal__item").count(), 10, "quatro telas web e seis peças mobile");
  const wide = await page.locator(".pgal__item").evaluateAll((items) =>
    items.map((item) => item.classList.contains("pgal__item--wide")),
  );
  assert.deepEqual(wide, [true, true, true, true, false, false, false, false, false, false]);

  await page.addScriptTag({ path: axeScriptPath });
  const violations = await page.evaluate(async () => {
    // Mesma ressalva das outras suítes: o axe 4.13 lê errado a serialização
    // OKLCH do Chrome em color-contrast; as regras semânticas ficam todas.
    const result = await window.axe.run(document, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    return result.violations.flatMap((rule) => rule.nodes.map((node) => `${rule.id}:${node.target.join(" ")}`));
  });
  assert.deepEqual(violations, [], "o detalhe aberto passa no axe");

  // --- a foto abre POR CIMA do detalhe ------------------------------------
  // O lightbox de produção é reaproveitado e vive num z-index acima; o
  // Escape dele roda em captura, então fecha a foto e deixa o detalhe de pé.
  await page.locator(".pgal__item").first().click();
  await page.waitForFunction(() => document.querySelector("[data-lightbox]").getAttribute("aria-hidden") === "false");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("[data-lightbox]").getAttribute("aria-hidden") === "true");
  assert.equal(await sheet.getAttribute("aria-hidden"), "false", "fechar a foto não fecha o detalhe");

  // Um segundo Escape fecha o detalhe e devolve o foco ao card que o abriu.
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("[data-proto-sheet]").getAttribute("aria-hidden") === "true");
  assert.equal(await page.locator("main").evaluate((el) => el.inert), false, "main volta à ordem de foco");
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset?.protoOpen || ""),
    "caderno-de-erros",
    "o foco volta para o card",
  );

  // --- o modo modal -------------------------------------------------------
  // A alça só existe onde arrasta; no modo centralizado quem fecha é o botão.
  await page.locator('[data-axis="surface"][data-value="modal"]').click();
  await page.locator('[data-proto-open="caderno-de-erros"]').click();
  await checkDetailScroll();
  await page.keyboard.press("Escape");
  await page.locator('[data-proto-open="sphera-academy"]').click();
  await page.waitForFunction(() => document.querySelector("[data-proto-sheet]").getAttribute("aria-hidden") === "false");
  assert.equal(await page.locator("[data-proto-grip]").isVisible(), false, "sem alça no modal");
  assert.equal(await page.locator("[data-proto-close]").isVisible(), true, "com botão de fechar");
  // Supplied Sphera screenshots are shared by the homepage and prototype.
  assert.equal(await page.locator(".pgal__item").count(), 14, "Sphera gallery is available in modal mode");
  await page.locator("[data-proto-close]").click();
  await page.waitForFunction(() => document.querySelector("[data-proto-sheet]").getAttribute("aria-hidden") === "true");

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('[data-axis="carousel"][data-value="bleed"]').click();
    await page.locator(".pjt__track").evaluate((el) => el.scrollTo({ left: 0, behavior: "instant" }));
    const geometry = await page.evaluate(() => {
      const track = document.querySelector(".pjt__track").getBoundingClientRect();
      return {
        left: track.left, right: track.right,
        card: document.querySelector(".pcard").getBoundingClientRect().left,
        column: document.querySelector("main").getBoundingClientRect().left,
        pageWidth: document.documentElement.scrollWidth,
        projectsGap: document.querySelector(".pjt__head").getBoundingClientRect().top - document.querySelector("#writing").getBoundingClientRect().bottom,
        writingGap: document.querySelector("#writing h2").getBoundingClientRect().top - document.querySelector("#contributions").getBoundingClientRect().bottom,
      };
    });
    assert.ok(Math.abs(geometry.left) < 1 && Math.abs(geometry.right - width) < 1, "trilha ocupa a viewport inteira");
    assert.ok(Math.abs(geometry.card - geometry.column) < 1, "primeiro card alinhado à coluna");
    assert.equal(geometry.pageWidth, width, "sem overflow horizontal na página");
    assert.ok(Math.abs(geometry.projectsGap - geometry.writingGap) < 1, "Writing → Projects repete o espaço de Contributions → Writing");
    await page.locator('[data-axis="carousel"][data-value="column"]').click();
    assert.ok(Math.abs((await page.locator(".pjt__track").boundingBox()).x - geometry.column) < 1, "modo coluna preservado");
  }

  assert.deepEqual(pageErrors, [], "nenhum erro de JS na página");
});
