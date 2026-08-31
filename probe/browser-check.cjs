const { chromium } = require('/var/home/eturkes/debian/.local/share/pnpm/global/5/.pnpm/playwright-core@1.62.1/node_modules/playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
  const context = browser.contexts()[0];
  const page = await context.newPage();
  const events = [];
  page.on('console', (message) => events.push({ type: 'console', level: message.type(), text: message.text() }));
  page.on('pageerror', (error) => events.push({ type: 'pageerror', text: error.message }));
  page.on('requestfailed', (request) => events.push({ type: 'requestfailed', url: request.url(), text: request.failure()?.errorText }));
  page.on('worker', (worker) => events.push({ type: 'worker', url: worker.url() }));
  await page.goto(process.argv[2] || 'http://127.0.0.1:4174/', { waitUntil: 'networkidle' });
  try {
    await page.waitForFunction(() => document.querySelector('#result')?.textContent !== 'loading', null, { timeout: 30000 });
  } catch (error) {
    events.push({ type: 'timeout', text: error.message });
  }
  console.log(JSON.stringify({ result: await page.locator('#result').textContent(), events }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
