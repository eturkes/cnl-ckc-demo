import { launch } from '../../../../tools/browser.mjs';
import { mkdir } from 'node:fs/promises';
const out = process.argv[2];
if (!out) throw Error('Pass screenshot directory');
await mkdir(out, {recursive:true});
const browser = await launch(m => { throw Error(m); });
try {
  for (const [width, dark] of [[1280,false],[1280,true],[375,false]]) {
    const page = await browser.newPage({viewport:{width,height:900}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:5183/prototype/scope-guards/variants/g3-patient/');
    await page.waitForSelector('.canvas canvas');
    if(dark) await page.getByRole('button',{name:'Dark theme',exact:true}).click();
    for(const [name,label] of [['patient','patient'],['palliative','palliative care'],['waiver','waiver statements']]) {
      await page.getByRole('button',{name:label,exact:true}).first().click();
      await page.waitForFunction(`document.querySelector('.selection-card h3')?.textContent.includes(${JSON.stringify(name==='palliative'?'palliative care':name==='waiver'?'waiver':'patient')})`);
      await page.evaluate(`new Promise(resolve=>{ const cy=document.querySelector('.canvas')._cyreg.cy; let stable=0,last=''; function frame(){const s=JSON.stringify(cy.nodes().map(n=>n.position()));stable=s===last?stable+1:0;last=s;if(stable>8)resolve();else requestAnimationFrame(frame)}frame()})`);
      await page.evaluate('window.scrollTo(0,0)');
      const path=`${out}/builder-3-${name}-${width}-${dark?'dark':'light'}.png`;
      await page.screenshot({path,fullPage:true});
      console.log(JSON.stringify({path,errors,overflow:await page.evaluate('({viewport:innerWidth,scroll:document.documentElement.scrollWidth})'),selected:await page.locator('.selection-card h3').textContent()}));
    }
    await page.close();
  }
} finally { await browser.close(); }
