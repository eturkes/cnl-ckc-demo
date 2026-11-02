import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const out=process.argv[2];
if(!out)throw Error('Pass screenshot directory');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:execFileSync('chromiumfish',['path'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox']});
try {
 for(const width of [1280,375])for(const dark of [false,true]){
  const page=await browser.newPage({viewport:{width,height:1000},colorScheme:dark?'dark':'light'});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(d=>localStorage.setItem('cnl-ckc-theme',d?'dark':'light'),dark);
  await page.goto('http://localhost:5186/prototype/scope-guards/variants/a2-sources/');
  await page.waitForSelector('.superseded-text',{state:'attached',timeout:60000});
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.answer-region').scrollIntoViewIfNeeded();
  const prefix=`${out}/builder-6-${width}-${dark?'dark':'light'}`;
  await page.screenshot({path:`${prefix}-closed.png`});
  await page.locator('.explanation > summary').click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`${prefix}-open.png`,fullPage:true});
  if(width===1280&&!dark){
   await page.locator('.ladder > summary').click();
   await page.evaluate(()=>{for(const e of document.querySelectorAll('.ladder details.technical')) if(e.textContent.includes('No exclusion'))e.open=true;});
   await page.locator('.scope-reading').scrollIntoViewIfNeeded();
   await page.screenshot({path:`${out}/builder-6-ladder.png`});
  }
  console.log(JSON.stringify({width,dark,errors,rows:await page.locator('.superseded-text').allTextContents(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
  await page.close();
 }
} finally {await browser.close();}
