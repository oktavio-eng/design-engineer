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
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));

  // --- o carrossel --------------------------------------------------------
  // 127.0.0.1 conta como localhost, então rascunhos aparecem — hoje são zero,
  // e os sete projetos viram sete cards (a lista de rows tinha um "show more"
  // a partir do quarto; o carrossel não corta nenhum).
  assert.equal(await page.locator("#projects .pcard").count(), 7, "um card por projeto");
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

  // A galeria: quatro fotos semeadas, no ritmo do frame — duas meias, uma
  // inteira, e a última (que ficaria órfã na linha) também inteira.
  assert.equal(await page.locator(".pgal__item").count(), 4, "quatro fotos");
  const wide = await page.locator(".pgal__item").evaluateAll((items) =>
    items.map((item) => item.classList.contains("pgal__item--wide")),
  );
  assert.deepEqual(wide, [false, false, true, true], "meia, meia, inteira, inteira (a última é órfã)");

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
  await page.locator('[data-proto-open="sphera-academy"]').click();
  await page.waitForFunction(() => document.querySelector("[data-proto-sheet]").getAttribute("aria-hidden") === "false");
  assert.equal(await page.locator("[data-proto-grip]").isVisible(), false, "sem alça no modal");
  assert.equal(await page.locator("[data-proto-close]").isVisible(), true, "com botão de fechar");
  // Sphera não tem `gallery` nem `subprojects`: o bloco não aparece, em vez
  // de deixar uma moldura vazia (regra 4 do AGENTS.md).
  assert.equal(await page.locator(".pgal").count(), 0, "sem fotos, sem grade");
  await page.locator("[data-proto-close]").click();
  await page.waitForFunction(() => document.querySelector("[data-proto-sheet]").getAttribute("aria-hidden") === "true");

  assert.deepEqual(pageErrors, [], "nenhum erro de JS na página");
});
