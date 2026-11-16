import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, resolve } from 'path';
import { writeFileSync } from 'fs';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const p = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
  try {
    const buf = await readFile(resolve('.' + p));
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const url = 'http://127.0.0.1:' + port + '/';

const browser = await chromium.launch({ headless: true });

async function one(name, w, h, runs) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [], ce = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') ce.push(m.text()); });
  const out = [];
  for (let r = 0; r < runs; r++) {
    await page.goto(url);
    await page.waitForFunction(() => window.game?.state === 'setup');
    await page.evaluate(() => window.game.setSpeed(3));
    await page.evaluate(() => {
      const ids = ['water', 'can'];
      const slots = Object.values(window.game.machine.slots);
      slots.forEach((s, i) => window.game.assignDrinkToSlot(s.key, ids[i % ids.length]));
    });
    await page.evaluate(() => window.game.startDay());
    await page.waitForFunction(() => {
      const el = document.getElementById('modal-root');
      return el?.classList.contains('open') && el.querySelector('#eod-next');
    }, { timeout: 30000 });
    const stats = await page.evaluate(() => ({
      earned: window.game.earnedToday,
      biggest: window.game.biggestDrop,
      slots: Object.keys(window.game.machine.slots).length,
      live: window.game.machine.drinkCount()
    }));
    out.push(stats);
  }
  if (name === 'mobile') await page.screenshot({ path: 'test-out/mobile-shot.png' });
  else await page.screenshot({ path: 'test-out/desktop-shot.png' });
  await ctx.close();
  return { out, errors, ce };
}

const mobile = await one('mobile', 400, 820, 5);
const desktop = await one('desktop', 1280, 820, 5);

const summary = { mobile, desktop };
console.log(JSON.stringify(summary, null, 2));
writeFileSync('test-out/day1-summary.json', JSON.stringify(summary, null, 2));

await browser.close();
server.close();
