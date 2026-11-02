import { launch } from '../../../../tools/browser.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const output = process.argv[2];
if (!output) throw Error('pass screenshot directory');
await mkdir(output,{recursive:true});
const browser = await launch((message)=>{throw Error(message)});
const readings=[];
try {
  for(const width of [1280,375]) for(const theme of ['light','dark']) {
    const page=await browser.newPage({ viewport:{width,height:1000} });
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(`localStorage.setItem('cnl-ckc-theme','${theme}')`);
    await page.goto('http://localhost:5188/prototype/scope-guards/variants/c1-chat/');
    await page.waitForSelector('[data-chat-state="answered"]',{timeout:90000});
    await page.locator('a.tag.kb').first().click();
    await page.evaluate(`document.documentElement.dataset.theme='${theme}'; window.scrollTo(0,0)`);
    const reading=await page.evaluate(`({text:document.querySelector('[data-chat-conversation]').innerText,overflow:document.documentElement.scrollWidth>innerWidth,theme:document.documentElement.dataset.theme,cardsOpen:document.querySelector('[data-chat-cards]').open,labels:[...document.querySelectorAll('[data-chat-segment]')].map(e=>e.dataset.chatSegment)})`);
    const path=`${output}/builder-8-${width}-${theme}.png`;
    await page.screenshot({path,fullPage:true});
    readings.push({width,theme,path,errors,...reading});
    await page.close();
  }
  await writeFile(`${output}/builder-8-readings.json`,JSON.stringify(readings,null,2));
  console.log(JSON.stringify(readings.map(({text,...r})=>({...r,textStart:text.slice(0,130)})),null,2));
} finally {await browser.close()}
