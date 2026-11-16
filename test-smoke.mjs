import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, resolve, join } from 'path';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  const p = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
  try {
    const buf = await readFile(resolve('.' + p));
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch (e) { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const url = 'http://127.0.0.1:' + port + '/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 400, height: 820 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERR:', e.message));
page.on('console', (m) => console.log('CONSOLE[' + m.type() + ']:', m.text()));
page.on('requestfailed', (r) => console.log('REQFAIL:', r.url(), r.failure()?.errorText));
await page.goto(url);
await page.waitForTimeout(3000);
const state = await page.evaluate(() => ({
  hasMatter: !!window.Matter,
  hasGame: !!window.game,
  gameState: window.game?.state,
  errorsOnPage: document.body.textContent?.slice(0, 200)
}));
console.log('STATE:', JSON.stringify(state));
await browser.close();
server.close();
