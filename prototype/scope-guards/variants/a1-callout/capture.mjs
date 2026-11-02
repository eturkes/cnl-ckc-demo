import { launch } from '../../../../tools/browser.mjs';
const browser = await launch(message => { throw new Error(message); });
const directory = process.argv[2];
const url = process.argv[3] ?? 'http://localhost:5185/prototype/scope-guards/variants/a1-callout/';
try {
  for (const width of [1280,375]) for (const theme of ['light','dark']) {
    const page = await browser.newPage({viewport:{width,height:5000},colorScheme:theme});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);
    await page.waitForSelector('.scope-exclusions',{timeout:60000});
    await page.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
    await page.locator('.answer-region').screenshot({path:`${directory}/builder-5-${width}-${theme}.png`});
    console.log(JSON.stringify({width,theme,errors,read:await page.locator('.notice-goals').textContent(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
    if(width===1280&&theme==='light') {
      await page.setViewportSize({width,height:1100});
      await page.locator('.notice-goals > summary').click();
      await page.locator('.notice-goals').evaluate(element=>window.scrollTo(0,scrollY+element.getBoundingClientRect().top-85));
      await page.screenshot({path:`${directory}/builder-5-disclosure.png`});
      await page.locator('.scope-exclusions > summary').click();
      await page.locator('.scope-exclusions').screenshot({path:`${directory}/builder-5-exclusions.png`});
    }
    await page.close();
  }
  for(const width of [1280,375]) {
    const page=await browser.newPage({viewport:{width,height:5000},colorScheme:'light'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${url}?q=starting-opioid-therapy`);
    await page.waitForSelector('.scope-exclusions',{timeout:60000});
    await page.locator('.scope-exclusions > summary').click();
    await page.locator('.answer-region').screenshot({path:`${directory}/builder-5-second-${width}.png`});
    console.log(JSON.stringify({secondQuestion:true,width,errors,supersessionNotices:await page.locator('.scope-notice').count(),scopeRules:await page.locator('.scope-exclusions > ul > li').count(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
    await page.close();
  }
} finally {await browser.close();}
