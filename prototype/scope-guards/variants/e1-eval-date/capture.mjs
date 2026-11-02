import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch } from '../../../../tools/browser.mjs';
const out = resolve(process.argv[2]);
await mkdir(out, { recursive: true });
const browser = await launch(message => { throw new Error(message); });
const report = [];
try {
  for (const width of [1280, 375]) for (const theme of ['light','dark']) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('http://localhost:5190/prototype/scope-guards/variants/e1-eval-date/');
    await page.locator('[data-ready="true"]').waitFor();
    if (await page.locator('header button').getAttribute('aria-pressed') !== String(theme === 'dark')) await page.locator('header button').click();
    for (const [name, date, count] of [['empty','',0],['before','2022-06-01',3],['after','2023-01-01',0],['boundary','2022-12-29',0],['empty-again','',0]]) {
      await page.locator('input').fill(date);
      await page.getByRole('button',{name:'Run',exact:true}).click();
      await page.locator('[data-ready="true"]').waitFor();
      const status = await page.getByRole('status').innerText();
      if (!status.startsWith(`${count} of 3`)) throw new Error(`${width}/${theme}/${name}: ${status}`);
      if (errors.length) throw new Error(errors.join('\n'));
      if (name === 'before') {
        const proof = await page.locator('article details pre').first().textContent();
        if (!proof.includes('guideline_evaluation_date(20220601)')) throw new Error('date premise absent');
        for (const article of await page.locator('article').all()) {
          const returned = await article.locator('details pre').nth(1).textContent();
          if (!returned.includes('assumption(guideline_evaluation_date(20220601))') || !returned.includes('builtin(guideline_satisfies(exactly,20220601,less,20221229))')) throw new Error('A statement lacks the live date premise or comparison');
        }
        await page.locator('.ladder details').first().evaluate(e => { e.open = true; });
        await page.locator('.ladder details').evaluateAll(nodes => nodes.forEach(e => e.open = true));
        const text = await page.locator('section.ladder').innerText();
        if (!text.includes('20220601') || !text.includes('20221229')) throw new Error('ladder does not show date comparison');
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw new Error(`${width}/${theme}/${name}: horizontal overflow`);
      let screenshot;
      if (['empty','before','after'].includes(name)) {
        screenshot = `${out}/builder-10-${name}-${width}-${theme}.png`;
        await page.screenshot({ path: screenshot, fullPage: true });
      }
      report.push({width, theme, name, date, status, overflow, errors: [...errors], screenshot});
    }
    await page.close();
  }
  await writeFile(`${out}/builder-10-results.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({states:report.length,screenshots:report.filter(x=>x.screenshot).length,passed:true}));
} finally { await browser.close(); }
