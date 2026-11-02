import { writeFile, mkdir } from 'node:fs/promises';
import { launch } from '../../../../tools/browser.mjs';
const out = process.argv[2];
if (!out) throw new Error('Pass the screenshot directory.');
await mkdir(out, { recursive: true });
const browser = await launch(message => { throw new Error(message); });
try {
  for (const width of [1280, 375]) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(`localStorage.setItem('cnl-ckc-theme', '${theme}');`);
    await page.goto('http://localhost:5187/prototype/scope-guards/variants/a3-struck/');
    await page.waitForSelector('.retired-point');
    await page.waitForFunction("document.querySelector('.mark-goals')?.textContent.includes('15 live records')");
    await page.evaluate("document.querySelector('.site-header').style.position = 'static'");
    const shot = await page.locator('.answer-region').screenshot();
    await writeFile(`${out}/builder-7-${width}-${theme}.png`, shot);
    console.log(JSON.stringify({ width, theme, superseded: await page.locator('.retired-point').count(), scope: await page.locator('.scope-note li').count(), errors, overflow: await page.evaluate('document.documentElement.scrollWidth > innerWidth') }));
    await page.close();
  }
} finally { await browser.close(); }
