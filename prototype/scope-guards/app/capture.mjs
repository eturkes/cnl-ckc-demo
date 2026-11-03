import {writeFile,mkdir} from 'node:fs/promises';
import {launch} from '../../../tools/browser.mjs';
const out=process.argv[2]; if(!out) throw Error('Pass capture directory'); await mkdir(out,{recursive:true});
console.log('launch');const browser=await launch(m=>{throw Error(m)});console.log('launched'); const results=[];
try {
 for(const [width,theme] of [[1280,'light'],[1280,'dark'],[375,'light']]) {
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(theme=>localStorage.setItem('cnl-ckc-theme',theme),theme);
  console.log('goto',width,theme);await page.goto(process.env.PROTO_URL ?? 'http://localhost:5173/prototype/scope-guards/app/');
  console.log('ready wait');await page.waitForSelector('.retired-point');await page.waitForFunction(()=>!document.querySelector('[data-action=run]').disabled);
  await page.evaluate(()=>document.querySelector('.site-header').style.position='static');
  async function shot(name,selector){console.log('shot',name,width,theme);await page.locator(selector).screenshot({path:`${out}/builder-11-${name}-${width}-${theme}.png`});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error(`overflow ${name}`);}
  async function date(value){console.log('date',value);await page.locator('#evaluation-date').fill(value);await page.locator('#evaluation-date').blur();await page.locator('[data-action=run]').click();await page.waitForSelector('.retired-point');await page.waitForFunction(()=>!document.querySelector('[data-action=run]').disabled);}
  if(await page.locator('.retired del').count()!==3)throw Error('empty date not 3 struck');
  await shot('oud-empty','.answer-region');
  await date('2022-06-01');if(await page.locator('.historical-derived').count()!==3)throw Error('before date not 3 derived');
  await shot('oud-before','.answer-region');await shot('date-controls','.evaluation-date');
  await date('2023-01-01');if(await page.locator('.retired del').count()!==3)throw Error('after date not 3 struck');
  await date('2022-12-29');if(await page.locator('.retired del').count()!==3)throw Error('boundary date not 3 struck');
  await date('');if(await page.locator('.retired del').count()!==3)throw Error('empty again not 3 struck');
  await page.locator('[role=combobox]').click();await page.locator('[role=option][id$="-option-starting-opioid-therapy"]').click();await page.locator('[data-action=run]').click();await page.waitForSelector('.scope-note');await page.waitForFunction(()=>!document.querySelector('[data-action=run]').disabled);
  await page.locator('.scope-note summary').click();
  if(await page.locator('.scope-note li').count()!==8)throw Error('not eight exclusions');
  const scope=await page.locator('.scope-note').textContent();if(!scope.includes('with a possible inpatient admission')||!scope.includes('sentence 17'))throw Error('condition qualifier or source missing');
  await shot('second-scope','.answer-region');
  if(width===1280&&theme==='light') for(const id of ['when-to-use-opioids','acute-pain-prescription-duration','opioid-follow-up','continuing-or-tapering-opioids','opioid-safety','opioid-use-disorder-treatment']) {
   await page.locator('[role=combobox]').click();await page.locator(`[role=option][id$="-option-${id}"]`).click();await page.locator('[data-action=run]').click();await page.waitForSelector('.scope-note');await page.waitForFunction(()=>!document.querySelector('[data-action=run]').disabled);if(await page.locator('.scope-note li').count()!==8)throw Error(`scope missing ${id}`);
  }
  await page.getByRole('button',{name:'cdc2022-opioid-rec12-imp08',exact:true}).click();await shot('corpus','.corpus-browser');
  await page.getByRole('button',{name:'Replay scope question',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.recorded-chat').textContent.includes('absence of this exclusion'));
  await shot('chat','.recorded-chat');
  await page.locator('[data-action=explore-graph]').click();await page.waitForFunction(()=>document.querySelector('.graph-shell canvas'));await page.waitForTimeout(3000);await shot('graph','.graph-shell');
  const audit=await page.evaluate(()=>window.__scopeAudit.map(x=>({date:x.date,goal:x.goal,positive:x.positive.solutions?.[0]?.display.N,absent:x.absent.kind,context:x.context.kind})));
  if(audit.some(x=>x.positive!=='3'||x.absent!=='failure'||x.context!=='failure'))throw Error('isolation failed');
  const provenance=await page.evaluate(()=>window.__demo.provenance.kind);if(provenance!=='ready')throw Error(`proof ${provenance}`);
  if(errors.length)throw Error(JSON.stringify(errors));results.push({width,theme,auditCalls:audit.length,audit,provenance,errors});await page.close();
 }
 await writeFile(`${out}/builder-11-results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({viewports:results.length,dateCycles:results.length*5,preparedQuestionIds:7,screenshots:results.length*7,passed:true}));
}finally{await browser.close()}
