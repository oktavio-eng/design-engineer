import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';
import {launchChromium} from '../../tests/ui/helpers/browser.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const final=path.join(root,'final');
for(const dir of ['crops','final/images','qa'])fs.mkdirSync(path.join(root,dir),{recursive:true});
const cuts=[
 ['home-opening','home',0,6,1440,900,'desktop','The Assopra storefront, campaign opening and clothing categories'],
 ['home-products','home',112,790,1216,760,'desktop','Clothing categories and the first product collection'],
 ['home-collections','home',80,2035,1280,800,'desktop','Coordinated collection cards for boys and girls'],
 ['home-story','home',80,2840,1280,800,'desktop','The brand story and family campaign in the middle of the home page'],
 ['catalogue-opening','catalogue',0,150,1440,900,'desktop','Catalogue opening with a campaign banner, filters and clothing products'],
 ['catalogue-discovery','catalogue',0,1048,1440,900,'desktop','Campaign imagery interspersed with the clothing catalogue'],
 ['product-opening','product',0,118,1440,900,'desktop','Product gallery, size selection, quantity, purchase action and shipping estimate'],
 ['product-family','product',80,2490,1280,800,'desktop','Coordinated looks for cousins, siblings and children further down the product page'],
 ['cart-context','cart-desktop',0,0,1440,900,'desktop','Cart panel open over the product page, including quantities, matching pieces and subtotal'],
 ['home-mobile-opening','home-mobile',0,0,402,871,'phone','Original mobile storefront with navigation, family campaign and clothing categories'],
 ['product-mobile-selection','product-mobile',0,730,402,871,'phone','Original mobile product details with size and quantity selection, add-to-cart action and shipping estimate'],
 ['quick-add','quick-add-mobile',16,46,370,800,'phone','Mobile quick-add panel with product imagery and size availability, including a sold-out size'],
 ['cart-phone','cart-mobile',0,0,362,842,'phone','Original mobile cart with quantities, matching pieces, free-shipping progress and subtotal'],
 ['navigation','navigation',0,0,1440,560,'masonry','Desktop navigation expanded into clothing categories and featured products'],
 ['search-results','search',50,50,1004,580,'masonry','Search query with product, collection and coordinated-outfit result categories'],
 ['filters','filters',24,12,292,655,'masonry','Clothing filters by garment type, price range and age, with an apply action'],
 ['cart','cart-mobile',0,0,362,842,'masonry','Cart details with quantity controls, matching products and subtotal'],
 ['product-options','product',944,166,384,1364,'masonry','Product options, shipping calculator, care information and coordinated pieces'],
 ['collection-boys','home',222,2063,486,651,'masonry','Boys collection card with campaign photography and its discovery action'],
 ['collection-girls','home',732,2153,486,651,'masonry','Girls collection card with campaign photography and its discovery action'],
 ['campaign-siblings','home',16,138,1408,640,'banners','Sibling campaign with coordinated clothing in an everyday family setting'],
 ['campaign-home','home',16,1555,1408,436,'banners','Clothing campaign presented in a warm domestic setting'],
 ['campaign-family','home',16,4944,1408,556,'banners','Family campaign featuring children in coordinated blue clothing'],
];
const sources=JSON.parse(fs.readFileSync(path.join(root,'sources/manifest.json')));
const manifest=[];const media=[];
for(const [name,from,x,y,width,height,presentation,alt] of cuts){
 const file=path.join(root,'sources',from+'.png');const original=PNG.sync.read(fs.readFileSync(file));
 if(x<0||y<0||x+width>original.width||y+height>original.height)throw new Error('Crop outside source: '+name);
 const crop=new PNG({width,height});PNG.bitblt(original,crop,x,y,width,height,0,0);
 fs.writeFileSync(path.join(root,'crops',name+'.png'),PNG.sync.write(crop));
 if(presentation==='desktop'&&width/height!==1.6)throw new Error('MacBook crop must fill the screen: '+name);
 const suffix=presentation==='desktop'?'-macbook':presentation==='phone'?'-iphone':'';
 const nodeId=sources.sources.find(s=>s.name===from).nodeId;
 manifest.push({name,source:'sources/'+from+'.png',nodeId,sourceWidth:original.width,sourceHeight:original.height,x,y,width,height,output:'images/'+name+suffix+'.png',externalShadowRemoved:['search-results','filters','quick-add'].includes(name)});
 if(!['desktop','phone'].includes(presentation))fs.copyFileSync(path.join(root,'crops',name+'.png'),path.join(final,'images',name+'.png'));
 media.push({src:'images/'+name+suffix+'.png',alt,presentation:['desktop','phone'].includes(presentation)?'device':presentation,device:presentation==='desktop'?'macbook':presentation==='phone'?'iphone':undefined,sourceNode:nodeId,crop:name,...(name==='cart-context'?{caption:'The cart opens over the product page with quantities, matching pieces, free-shipping progress and a subtotal.'}:{})});
}
fs.writeFileSync(path.join(root,'crop-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const uri=(p,mime='image/png')=>`data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
const devices=media.filter(m=>m.presentation==='device');
const compose=devices.map(m=>{const crop=manifest.find(c=>c.name===m.crop);return `<div class="${m.device}" id="${m.crop}"><div class="screen"><img src="${uri(path.join(root,'crops',crop.name+'.png'))}" alt=""></div><img class="frame" src="${uri(path.join(root,'../../assets/projects/devices',m.device+'.svg'),'image/svg+xml')}" alt=""></div>`;}).join('');
const deviceCSS=`*{box-sizing:border-box}html,body{margin:0;background:transparent}.macbook{position:relative;width:1440px;aspect-ratio:1200/760}.iphone{position:relative;width:520px;aspect-ratio:260/535.333}.frame{position:absolute;inset:0;width:100%;height:100%}.screen{position:absolute;overflow:hidden;background:#faf9f5;display:flex;align-items:center;justify-content:center}.screen img{width:100%;height:100%;object-fit:contain;display:block}.macbook .screen{left:5.833333%;top:3.947368%;width:88.333333%;height:87.171053%;border-radius:9.6px}.iphone .screen{padding-top:60px;left:4.615385%;top:2.24159%;width:90.769231%;height:95.5168%;border-radius:14.40678%/6.649283%}`;
fs.writeFileSync(path.join(root,'device-render.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Device export source</title><style>${deviceCSS}</style></head><body>${compose}</body></html>`);
const browser=await launchChromium({executablePath:'/Users/oktavio/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1200},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:8766/device-render.html');
 await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 for(const m of devices)await page.locator(`[id="${m.crop}"]`).screenshot({path:path.join(final,m.src),omitBackground:true});
}finally{await browser.close();}
for(const m of media){const png=PNG.sync.read(fs.readFileSync(path.join(final,m.src)));m.width=png.width;m.height=png.height;if(m.presentation==='device'&&png.data[3]!==0)throw new Error('Device background is not transparent: '+m.src);}
fs.copyFileSync(path.join(root,'copy.md'),path.join(final,'copy.md'));
fs.copyFileSync(path.join(root,'crop-manifest.json'),path.join(final,'crop-manifest.json'));
fs.writeFileSync(path.join(final,'media.json'),JSON.stringify({project:'Assopra Store',imageBorder:'1px solid rgb(0 0 0 / 8%)',radius:16,gap:16,shadow:'none',media},null,2)+'\n');
const copy=fs.readFileSync(path.join(root,'copy.md'),'utf8');
const fields=Object.fromEntries([...copy.matchAll(/\*\*([^*]+)\*\*\n\n([\s\S]*?)(?=\n\n\*\*|$)/g)].map(m=>[m[1],m[2].trim()]));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const img=m=>`<figure><a href="${m.src}"><img src="${m.src}" width="${m.width}" height="${m.height}" alt="${esc(m.alt)}" loading="lazy"></a>${m.caption?`<figcaption>${esc(m.caption)}</figcaption>`:''}</figure>`;
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Assopra Store — portfolio review</title><style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#242420;font:16px/1.6 -apple-system,BlinkMacSystemFont,sans-serif}main{max-width:1200px;margin:auto;padding:48px 32px 80px}header,.copy{max-width:680px;margin:0 auto 48px}h1{font-size:30px;line-height:1.2;letter-spacing:-.6px;margin:16px 0}h2{font-size:18px;line-height:1.4;margin:32px 0 12px}.role,nav,figcaption{color:#68685f}a{color:inherit}nav{font-size:14px}figure{margin:0}img{display:block;width:100%;height:auto}.desktops{display:grid;gap:40px}.phones{display:grid;grid-template-columns:repeat(2,minmax(0,280px));justify-content:center;gap:24px 16px;margin:48px 0}.masonry{columns:3;column-gap:16px}.masonry figure{break-inside:avoid;margin:0 0 16px;border:1px solid rgb(0 0 0 / 8%);border-radius:16px;overflow:hidden}.masonry a{display:block;line-height:0}.banners{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.banners figure:first-child{grid-column:1/-1}.banners figure{overflow:hidden;border:1px solid rgb(0 0 0 / 8%);border-radius:16px}figcaption{font-size:14px;max-width:680px;margin:12px auto 0}.copy p{margin:0 0 20px}.section-label{max-width:680px;margin:48px auto 24px}@media(max-width:900px){.masonry{columns:2}}@media(max-width:600px){main{padding:24px 16px 48px}.masonry{columns:1}.banners{grid-template-columns:1fr}.phones{gap:20px 12px}.desktops{gap:24px}h1{font-size:26px}}
</style></head><body><main><header><nav><a href="copy.md">Approved copy</a> · <a href="media.json">Media index</a> · <a href="crop-manifest.json">Crop records</a></nav><h1>Assopra Store</h1><p class="role">${esc(fields.Role)}</p><p>${esc(fields.Summary)}</p></header><div class="copy"><h2>Overview</h2><p>${esc(fields.Overview)}</p><h2>The challenge</h2><p>${esc(fields['The challenge'])}</p><h2>Design decisions</h2><p>${esc(fields['Design decisions'])}</p></div><div class="desktops">${media.filter(m=>m.device==='macbook').map(img).join('')}</div><div class="phones">${media.filter(m=>m.device==='iphone').map(img).join('')}</div><h2 class="section-label">Interface details</h2><div class="masonry">${media.filter(m=>m.presentation==='masonry').map(img).join('')}</div><div class="copy"><h2>Image direction</h2><p>${esc(fields['Image direction'])}</p></div><div class="banners">${media.filter(m=>m.presentation==='banners').map(img).join('')}</div></main></body></html>`;
fs.writeFileSync(path.join(final,'index.html'),html);
console.log(`Prepared ${manifest.length} recorded crops and ${media.length} individual assets.`);
