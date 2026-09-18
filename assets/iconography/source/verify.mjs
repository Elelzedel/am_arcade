import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],defaultViewport:{width:1440,height:1100,deviceScaleFactor:1}});
try {
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(new URL('index.html',root).href,{waitUntil:'load'});
  await page.evaluate(()=>Promise.all([...document.images].map(im=>im.decode())));
  const state=await page.evaluate(()=>({images:document.images.length,broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src),icons:document.querySelectorAll('.icon-cell').length,overflow:document.documentElement.scrollWidth>innerWidth}));
  await page.screenshot({path:fileURLToPath(new URL('preview/collection.png',root)),fullPage:true});
  await page.type('#search','volume');
  const filtered=await page.$$eval('.icon-cell',els=>els.filter(e=>!e.hidden).length);
  if(filtered!==2)throw new Error('Icon filtering failed');
  await page.click('#theme');
  if(await page.$eval('#theme',e=>e.getAttribute('aria-pressed'))!=='true')throw new Error('Theme toggle failed');
  await page.$eval('#search',e=>{e.value='';e.dispatchEvent(new Event('input'))});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const lightHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
  await page.screenshot({path:fileURLToPath(new URL('preview/light-ui.png',root)),clip:{x:0,y:0,width:1440,height:lightHeight},captureBeyondViewport:true});
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  await page.screenshot({path:fileURLToPath(new URL('preview/mobile.png',root)),fullPage:true});
  if(state.broken.length||state.overflow||mobileOverflow||errors.length||state.icons!==40)throw new Error(JSON.stringify({state,mobileOverflow,errors}));
  const report={...state,mobileOverflow,errors,filtering:'passed',themeToggle:'passed',desktop:'1440px',mobile:'390px'};
  await fs.writeFile(new URL('preview/verification.json',root),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
