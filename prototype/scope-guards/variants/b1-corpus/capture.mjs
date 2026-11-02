import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const browser = await chromium.launch({executablePath:execFileSync('chromiumfish',['path'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
const shots = '/home/eturkes/Projects/cnl-ckc-demo/.scratch/agents/shots';
const errors=[];
for (const width of [1280,375]) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://localhost:5189/prototype/scope-guards/variants/b1-corpus/');
  await page.waitForSelector('[data-sentence="3"]',{timeout:60000});
  for (const theme of ['light','dark']) {
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    for (const state of ['rec12','s7','list']) {
      if (state==='rec12') await page.getByRole('button',{name:'rec12-imp08',exact:true}).click();
      if (state==='s7') await page.getByRole('button',{name:'s7-02',exact:true}).click();
      if (state==='list') await page.getByRole('button',{name:'Every document',exact:true}).click();
      if (state!=='list') await page.waitForSelector('.sentence-records');
      const section=page.locator('.corpus-browser');
      await section.scrollIntoViewIfNeeded();
      if (state==='list') await page.locator('.documents li').filter({hasText:'cdc2022-opioid-rec12-imp08'}).scrollIntoViewIfNeeded();
      await section.screenshot({style:'.site-header { position: static !important; }',path:`${shots}/builder-9-${state}-${width}-${theme}.png`});
      console.log(JSON.stringify({state,width,theme,marks:await page.locator('.statement-status').allTextContents(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
    }
  }
  for(const suffix of ['s3-03','s9-01','s10-04']) {
    await page.getByRole('button',{name:suffix,exact:true}).click();
    await page.waitForSelector('.sentence-records');
    console.log(JSON.stringify({suffix,marks:await page.locator('.statement-status').count()}));
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify({errors}));
if(errors.length) process.exitCode=1;
