import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { launchChromium } from '../../tests/ui/helpers/browser.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const finalRoot = path.join(root, 'final');
fs.rmSync(path.join(finalRoot, 'images'), { recursive: true, force: true });
fs.mkdirSync(path.join(finalRoot, 'images'), { recursive: true });
const uri = (file, mime = 'image/png') => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
const source = name => path.join(root, 'sources', name + '.png');
const cuts = [
  ['home-opening', 'home', 0, 0, 1920, 1120],
  ['home-categories', 'home', 260, 1140, 1400, 660],
  ['home-science', 'home', 20, 1838, 1880, 650],
  ['campaign-ironhair', 'home', 274, 3217, 1372, 670],
  ['campaign-ironfit', 'home', 274, 3911, 1372, 670],
  ['catalogue-opening', 'catalogue', 0, 0, 1898, 1186],
  ['catalogue-products', 'catalogue', 265, 920, 1370, 1040],
  ['product-opening', 'product', 0, 0, 1940, 1290],
  ['product-information', 'product', 284, 1383, 1372, 1229],
  ['product-benefits', 'product', 250, 3654, 1440, 579],
  ['filter-panel', '3236', 24, 12, 337, 1203],
  ['cart-panel', '3328', 24, 12, 440, 1156],
  ['home-categories-science', 'home', 0, 1150, 1920, 1400],
  ['home-favourites-ironhair', 'home', 0, 2525, 1920, 1375],
  ['home-ironhair-feature', 'home', 200, 6680, 1520, 650],
  ['home-reviews-footer', 'home', 0, 7300, 1920, 1692],
  ['catalogue-grid', 'catalogue', 0, 910, 1898, 1050],
  ['catalogue-ironfit', 'catalogue', 245, 1480, 1410, 1058],
  ['pre-checkout', 'pre-checkout', 0, 0, 1922, 1171],
];
const manifest = cuts.map(([name, from, x, y, width, height]) => {
  const original = PNG.sync.read(fs.readFileSync(source(from)));
  if (x + width > original.width || y + height > original.height) throw new Error(`Crop outside source: ${name}`);
  const crop = new PNG({ width, height });
  PNG.bitblt(original, crop, x, y, width, height, 0, 0);
  if (name.endsWith('-panel')) {
    const radius = 20;
    for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
      const dx = Math.max(radius - px - .5, px + .5 - (width - radius), 0);
      const dy = Math.max(radius - py - .5, py + .5 - (height - radius), 0);
      const coverage = Math.max(0, Math.min(1, radius + .5 - Math.hypot(dx, dy)));
      crop.data[(py * width + px) * 4 + 3] = Math.round(255 * coverage);
    }
  }
  fs.writeFileSync(path.join(root, 'crops', name + '.png'), PNG.sync.write(crop));
  return { name, source: from + '.png', x, y, width, height };
});
fs.writeFileSync(path.join(root, 'crop-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const image = (name, style = '', crop = true) => `<img style="${style}" src="${uri(crop ? path.join(root, 'crops', name + '.png') : source(name))}" alt="${name}">`;
const laptop = (name, fit = 'cover') => `<div class="laptop"><div class="screen">${image(name, `object-fit:${fit}`)}</div><img class="frame" src="${uri(path.join(root, '../../assets/projects/devices/macbook.svg'), 'image/svg+xml')}" alt=""></div>`;
const phone = name => `<div class="phone"><div class="screen">${image(name, 'object-fit:contain', false)}</div><img class="frame" src="${uri(path.join(root, '../../assets/projects/devices/iphone.svg'), 'image/svg+xml')}" alt=""></div>`;
const boards = [
  ['01-home', 'The storefront', 'A new visual direction for an existing supplement store.', laptop('home-opening', 'contain')],
  ['02-discovery', 'Two ways to explore', 'Navigation by product and wellness goal.', `<div class="stack menus">${image('5764', '', false)}${image('6061', '', false)}</div>`],
  ['03-catalogue', 'From campaign to catalogue', 'Expressive imagery leads into a consistent product grid.', laptop('catalogue-opening')],
  ['04-product', 'The product in focus', 'Product imagery and purchase options share the opening view.', laptop('product-opening', 'contain')],
  ['05-information', 'Beyond the purchase', 'Product information, usage guidance and benefits.', `<div class="detail">${image('product-information')}${image('product-benefits')}</div>`],
  ['06-mobile', 'Navigation on mobile', 'Product browsing and visual discovery at a smaller scale.', `<div class="phones">${phone('5840')}${phone('5945')}</div>`],
  ['07-components', 'Shopping details', 'Filters and cart, presented as individual interface components.', `<div class="panels">${image('filter-panel')}${image('cart-panel')}</div>`],
  ['08-imagery', 'A shared image direction', 'AI-generated models and products, coordinated through colour and composition.', `<div class="campaigns">${image('campaign-ironhair')}${image('campaign-ironfit')}</div>`],
  ['09-categories-science', 'Discovery and transparency', 'Product categories and formulation principles.', laptop('home-categories-science', 'contain')],
  ['10-favourites-ironhair', 'Products and campaigns', 'Featured products and the IronHair campaign.', laptop('home-favourites-ironhair', 'contain')],
  ['11-ironhair-feature', 'A closer look at IronHair', 'Product imagery, ingredients and purchase options.', laptop('home-ironhair-feature', 'contain')],
  ['12-reviews-footer', 'The rest of the storefront', 'Product cards, customer reviews and footer navigation.', laptop('home-reviews-footer', 'contain')],
  ['13-catalogue-grid', 'The full collection', 'Product cards, sorting and filters.', laptop('catalogue-grid', 'contain')],
  ['14-catalogue-ironfit', 'Campaigns in the catalogue', 'Supplement products and the IronFit campaign.', laptop('catalogue-ironfit', 'contain')],
  ['15-pre-checkout', 'Before checkout', 'The cart opens over the product page for an order review.', laptop('pre-checkout', 'contain')],
];
const css = `*{box-sizing:border-box}body{margin:0;background:#faf9f5;color:#123d3b;font:18px -apple-system,BlinkMacSystemFont,sans-serif}header{padding:28px 36px;max-width:1600px;margin:auto}header p{max-width:800px;line-height:1.5}a{color:inherit}.board{width:1600px;height:1100px;position:relative;overflow:hidden;background:#faf9f5;margin:24px auto;padding:54px 64px}.number{font-size:15px;letter-spacing:1px;color:#557370}.heading{display:flex;align-items:baseline;justify-content:space-between;gap:40px;margin-top:12px}h2{margin:0;font:46px Georgia,serif;font-weight:400}.heading p{font-size:19px;max-width:620px;line-height:1.4;margin:0;text-align:right;color:#557370}.body{height:870px;margin-top:32px;display:flex;justify-content:center;align-items:center}img{display:block;max-width:100%}.laptop{width:1330px;aspect-ratio:1200/760;position:relative}.frame{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.screen{position:absolute;overflow:hidden;background:#f8f5f1}.screen img{width:100%;height:100%;object-position:top center}.laptop .screen{left:5.833333%;top:3.947368%;width:88.333333%;height:87.171053%;border-radius:8px}.stack{display:flex;flex-direction:column;gap:32px;width:1120px}.menus img{width:100%;height:auto;border:1px solid rgb(0 0 0 / 8%);border-radius:16px}.phones{display:flex;gap:124px;align-items:center}.phone{width:352px;aspect-ratio:260/535.333;position:relative}.phone .screen{left:4.615385%;top:2.24159%;width:90.769231%;height:95.5168%;border-radius:14.40678%/6.649283%;background:white;display:flex;align-items:center}.phone .screen img{object-position:center}.detail{display:grid;grid-template-columns:1.08fr 1fr;align-items:center;gap:32px;width:1450px}.detail img{width:100%;border-radius:16px;border:1px solid rgb(0 0 0 / 8%)}.panels{display:flex;gap:24px;align-items:flex-start}.panels img{height:820px;width:auto;max-width:none;object-fit:contain;border:1px solid rgb(0 0 0 / 8%);border-radius:16px}.campaigns{display:flex;flex-direction:column;gap:24px;width:1120px}.campaigns img{width:100%;max-height:402px;object-fit:contain;border-radius:16px;border:1px solid rgb(0 0 0 / 8%)}footer{font-size:14px;position:absolute;bottom:26px;left:64px;color:#557370}@media print{header{display:none}.board{margin:0;break-after:page}}`;
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Meta Suplementos — image study</title><style>${css}</style><header><h1>Meta Suplementos — image study</h1><p><a href="components.html">View components in masonry layout</a></p><p>Local review of eight compositions using the existing portfolio device frames. Original Figma exports are preserved in sources/. Crops are recorded in crop-manifest.json. Desktop sections are excerpts, not additional screens. Mobile menus are fitted in full, without stretching.</p><p>${boards.map(([id], i) => `<a href="#${id}">${i + 1}</a>`).join(' · ')}</p></header>${boards.map(([id, title, caption, content], i) => `<section class="board" id="${id}"><div class="number">META SUPLEMENTOS / ${String(i + 1).padStart(2, '0')}</div><div class="heading"><h2>${title}</h2><p>${caption}</p></div><div class="body">${content}</div><footer>UX/UI redesign · AI art direction</footer></section>`).join('')}</html>`;
fs.writeFileSync(path.join(root, 'review.html'), html);
const tiles = [
  ['5764', false], ['filter-panel', true], ['cart-panel', true],
  ['product-information', true], ['6061', false], ['product-benefits', true],
  ['catalogue-products', true], ['3450', false],
];
const masonryHtml = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meta — components</title><style>
*{box-sizing:border-box}body{margin:0;background:#faf9f5;color:#171717;font:16px -apple-system,BlinkMacSystemFont,sans-serif}main{max-width:1280px;margin:auto;padding:32px}nav{display:flex;justify-content:space-between;gap:24px;margin-bottom:32px}a{color:inherit}h1{font:24px Georgia,serif;font-weight:400;margin:0}.masonry{columns:3;column-gap:16px}.tile{break-inside:avoid;margin:0 0 16px;border:1px solid rgb(0 0 0 / 8%);border-radius:16px;overflow:hidden;line-height:0}.tile a{display:block}.tile img{width:100%;height:auto;display:block}@media(max-width:1000px){.masonry{columns:2}}@media(max-width:600px){main{padding:16px}.masonry{columns:1}.banners{grid-template-columns:1fr}}
</style><main><nav><h1>Meta Suplementos</h1><a href="review.html">Back to mockups</a></nav><div class="masonry">${tiles.map(([name, crop]) => `<figure class="tile"><a href="${crop ? 'crops' : 'sources'}/${name}.png" target="_blank">${image(name, '', crop)}</a></figure>`).join('')}</div></main></html>`;
fs.writeFileSync(path.join(root, 'components.html'), masonryHtml);
const browser = await launchChromium({ executablePath: process.env.META_CHROMIUM || '/Users/oktavio/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
try {
  const page = await browser.newPage({ viewport: { width: 1680, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(root, 'review.html'));
  await page.locator('img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
  for (const [id] of boards) {
    await page.locator(`[id="${id}"]`).screenshot({ path: path.join(root, 'compositions', id + '.png') });
  }
  await page.addStyleTag({ content: 'html,body,.board{background:transparent!important}' });
  const deviceExports = [
    ['home-macbook', '[id="01-home"] .laptop', 'Storefront redesign shown in the existing MacBook frame'],
    ['categories-science-macbook', '[id="09-categories-science"] .laptop', 'Product categories and formulation principles on the Meta storefront'],
    ['favourites-ironhair-macbook', '[id="10-favourites-ironhair"] .laptop', 'Featured supplement products and the IronHair campaign banner'],
    ['ironhair-feature-macbook', '[id="11-ironhair-feature"] .laptop', 'IronHair product feature with ingredients, benefits and purchase options'],
    ['reviews-footer-macbook', '[id="12-reviews-footer"] .laptop', 'Supplement products, customer reviews and footer navigation'],
    ['catalogue-macbook', '[id="03-catalogue"] .laptop', 'Supplement catalogue opening shown in the existing MacBook frame'],
    ['catalogue-grid-macbook', '[id="13-catalogue-grid"] .laptop', 'Complete supplement collection with product cards, sorting and filters'],
    ['catalogue-ironfit-macbook', '[id="14-catalogue-ironfit"] .laptop', 'Supplement product cards followed by the IronFit campaign banner'],
    ['product-macbook', '[id="04-product"] .laptop', 'Creatine product page and purchase options shown in the existing MacBook frame'],
    ['pre-checkout-macbook', '[id="15-pre-checkout"] .laptop', 'Pre-checkout cart panel open over the creatine product page'],
    ['mobile-products-iphone', '[id="06-mobile"] .phone:nth-child(1)', 'Mobile navigation by product shown in the existing iPhone frame'],
    ['mobile-goals-iphone', '[id="06-mobile"] .phone:nth-child(2)', 'Mobile navigation by wellness goal shown in the existing iPhone frame'],
  ];
  const media = [];
  for (const [name, selector, alt] of deviceExports) {
    await page.locator(selector).screenshot({ path: path.join(finalRoot, 'images', name + '.png'), omitBackground: true });
    media.push({ src: 'images/' + name + '.png', alt, presentation: 'device', ...(name === 'pre-checkout-macbook' ? { caption: 'Opening the cart reveals a pre-checkout panel with product quantities, shipping progress, discounts and the order total before checkout.' } : {}) });
  }
  const componentNames = {
    '5764': ['navigation-products', 'Desktop navigation with a grid of supplement products'],
    'filter-panel': ['filters', 'Catalogue filters with categories, availability, prices and product weights'],
    'cart-panel': ['cart', 'Shopping cart with product quantities, shipping progress and order totals'],
    'product-information': ['product-information', 'Product composition and usage guidance for creatine'],
    '6061': ['navigation-goals', 'Visual navigation by wellness goal with models and supplement products'],
    'product-benefits': ['product-benefits', 'Six benefit cards on the creatine product page'],
    'campaign-ironhair': ['campaign-ironhair', 'IronHair campaign banner featuring an AI-generated model and product'],
    'catalogue-products': ['catalogue-products', 'Supplement catalogue with product cards, sorting and filters'],
    'campaign-ironfit': ['campaign-ironfit', 'IronFit campaign banner with an AI-generated product composition'],
    '3450': ['sticky-purchase', 'Persistent purchase bar with product, price and add-to-cart action'],
  };
  for (const [name, crop] of tiles) {
    const [filename, alt] = componentNames[name];
    fs.copyFileSync(crop ? path.join(root, 'crops', name + '.png') : source(name), path.join(finalRoot, 'images', filename + '.png'));
    media.push({ src: 'images/' + filename + '.png', alt, presentation: 'masonry' });
  }
  const bannerIntro = 'I used AI as part of a professional image production workflow to create realistic scenes featuring models and products, directing lighting, colour and composition across the campaign banners.';
  for (const [group, name, alt] of [
    [11, 'ironhair', 'IronHair campaign with a model holding the supplement'],
    [10, 'ironfit', 'IronFit product composition with capsules and dried orange'],
    [9, 'metapower', 'MetaPower campaign with a model in a blue studio scene'],
    [8, 'orapro-nobis', 'OraPro Nobis product composition with leaves and lime'],
    [12, 'magnesium', 'Magnesium campaign with a couple holding the supplement'],
  ]) {
    const nameWithExtension = 'banner-' + name + '.jpg';
    fs.copyFileSync(path.join(root, 'banners', `Group ${group}.jpg`), path.join(finalRoot, 'images', nameWithExtension));
    media.push({ src: 'images/' + nameWithExtension, alt, presentation: 'banners', ...(group === 11 ? { groupCaption: bannerIntro } : {}) });
  }
  fs.copyFileSync(path.join(root, 'copy.md'), path.join(finalRoot, 'copy.md'));
  fs.writeFileSync(path.join(finalRoot, 'media.json'), JSON.stringify({ project: 'Meta Suplementos', imageBorder: '1px solid rgb(0 0 0 / 8%)', radius: 16, gap: 16, shadow: 'none', media }, null, 2) + '\n');
  const finalImage = m => `<figure style="margin:0"><img src="${m.src}" alt="${m.alt}" loading="lazy">${m.caption ? `<figcaption>${m.caption}</figcaption>` : ''}</figure>`;
  const finalHtml = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meta Suplementos — final assets</title><style>*{box-sizing:border-box}body{margin:0;background:#faf9f5;color:#171717;font:16px/1.5 -apple-system,BlinkMacSystemFont,sans-serif}main{max-width:1200px;margin:auto;padding:32px}header{max-width:640px;margin:0 auto 48px}h1{font-size:28px;line-height:1.2}h2{font-size:18px}a{color:inherit}.desktop{display:grid;gap:40px}.desktop img{width:100%;height:auto;display:block}.phones{display:flex;justify-content:center;gap:16px;margin:40px 0}.phones figure{width:calc(50% - 8px);max-width:280px}.phones img{width:100%;height:auto;object-fit:contain}.banners{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:48px}.banners p{grid-column:1/-1}.banners img{width:100%;height:auto;border:1px solid rgb(0 0 0 / 8%);border-radius:16px}.masonry{columns:3;column-gap:16px}.masonry a{break-inside:avoid;display:block;margin:0 0 16px;border:1px solid rgb(0 0 0 / 8%);border-radius:16px;overflow:hidden;line-height:0}.masonry img{width:100%;height:auto}@media(max-width:900px){.masonry{columns:2}}@media(max-width:600px){main{padding:16px}.masonry{columns:1}.banners{grid-template-columns:1fr}}</style><main><header><h1>Meta Suplementos</h1><p>UX/UI + AI Art Direction · E-commerce</p><p>A supplement store redesign, from shopping flows to product imagery.</p><p>UX/UI redesign of the Meta Suplementos online store, informed by market and persona research. I redesigned every screen, from product discovery and catalogue browsing to product details and cart, with close attention to typography, spacing and component consistency. I also created AI-generated imagery featuring models and products, directing cohesive scenes across the storefront.</p><a href="copy.md">Approved copy</a> · <a href="media.json">Image list</a></header><div class="desktop">${media.filter(m => m.presentation === 'device' && m.src.includes('macbook')).map(finalImage).join('')}</div><div class="phones">${media.filter(m => m.presentation === 'device' && m.src.includes('iphone')).map(finalImage).join('')}</div><div class="masonry">${media.filter(m => m.presentation === 'masonry').map(m => `<a href="${m.src}">${finalImage(m)}</a>`).join('')}</div><div class="banners"><p>${bannerIntro}</p>${media.filter(m => m.presentation === 'banners').map(finalImage).join('')}</div></main></html>`;
  fs.writeFileSync(path.join(finalRoot, 'index.html'), finalHtml);
  await page.goto('file://' + path.join(root, 'components.html'));
  await page.locator('img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
  await page.screenshot({ path: path.join(root, 'components-masonry.png'), fullPage: true });
  await page.setContent(`<style>body{margin:0;background:#faf9f5;padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px}img{width:100%;display:block}</style>${boards.map(([id]) => `<img src="${uri(path.join(root, 'compositions', id + '.png'))}">`).join('')}`);
  await page.locator('img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
  await page.screenshot({ path: path.join(root, 'contact-sheet.jpg'), fullPage: true, type: 'jpeg', quality: 88 });
} finally { await browser.close(); }
console.log('Prepared 19 crops, 15 review boards and final package with 12 device images, 8 masonry images and 5 campaign banners.');
