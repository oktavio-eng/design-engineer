import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchChromium} from '../../tests/ui/helpers/browser.mjs';
import {PNG} from 'pngjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(fs.readFileSync(path.join(root,'final/media.json')));
const crops=JSON.parse(fs.readFileSync(path.join(root,'crop-manifest.json')));
for(const m of data.media.filter(m=>m.device==='macbook')){
 const crop=crops.find(c=>c.name===m.crop);
 if(crop.width/crop.height!==1060/662.5)throw new Error('MacBook screen is not filled: '+m.src);
}
const browser=await launchChromium({executablePath:'/Users/oktavio/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
const results=[];
try{
 const page=await browser.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:1000});
  await page.goto('http://127.0.0.1:8766/final/');
  await page.locator('img').evaluateAll(imgs=>imgs.forEach(i=>{i.loading='eager';}));
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  const facts=await page.evaluate(()=>({images:[...document.images].length,broken:[...document.images].filter(i=>!i.naturalWidth).length,overflow:document.documentElement.scrollWidth>innerWidth,masonry:{gap:getComputedStyle(document.querySelector('.masonry')).columnGap,columns:getComputedStyle(document.querySelector('.masonry')).columnCount,border:getComputedStyle(document.querySelector('.masonry figure')).border,radius:getComputedStyle(document.querySelector('.masonry figure')).borderRadius,shadow:getComputedStyle(document.querySelector('.masonry figure')).boxShadow}}));
  if(facts.broken||facts.overflow||facts.images!==data.media.length)throw new Error(JSON.stringify(facts));
  results.push({width,...facts});
  await page.screenshot({path:path.join(root,`qa/presentation-${width}.png`),fullPage:true});
 }
 await page.setViewportSize({width:1600,height:1100});
 await page.setContent(`<html><head><title>Assopra QA contact sheet</title><style>*{box-sizing:border-box}body{margin:0;background:#fff;font:14px/1.4 system-ui;padding:24px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}figure{margin:0;break-inside:avoid}img{width:100%;height:310px;object-fit:contain}figcaption{font-size:13px;padding:10px 0 16px;border-bottom:1px solid #ddd}</style></head><body><h1>Assopra Store — asset review</h1><div class="grid">${data.media.map(m=>`<figure><img src="http://127.0.0.1:8766/final/${m.src}"><figcaption>${m.src}<br>${m.alt}</figcaption></figure>`).join('')}</div></body></html>`);
 await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 await page.screenshot({path:path.join(root,'qa/contact-sheet.jpg'),fullPage:true,type:'jpeg',quality:90});
 if(errors.length)throw new Error(errors.join('\n'));
 for(const m of data.media){const png=PNG.sync.read(fs.readFileSync(path.join(root,'final',m.src)));if(m.presentation==='device'&&png.data[3]!==0)throw new Error('Opaque device corner: '+m.src);}
 fs.writeFileSync(path.join(root,'qa/verification.json'),JSON.stringify({images:data.media.length,errors,results,deviceCornersTransparent:true},null,2)+'\n');
 console.log(JSON.stringify({images:data.media.length,widths:results.map(r=>r.width),errors}));
}finally{await browser.close();}
