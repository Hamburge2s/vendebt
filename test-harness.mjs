// Playwright harness: play several days, capture logs and screenshots.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, extname } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { createServer } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, 'test-out');
mkdirSync(outDir, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const p = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
  try {
    const buf = await readFile(resolve(__dirname + p));
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const indexUrl = 'http://127.0.0.1:' + port + '/';

const browser = await chromium.launch({ headless: true });

async function runViewport(name, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await page.goto(indexUrl);
  // wait for game ready
  await page.waitForFunction(() => window.game && window.game.state === 'setup', { timeout: 10000 });
  // Unlock everything + max speed so days zip by.
  await page.evaluate(() => {
    window.game.testUnlockAll();
    window.game.setSpeed(3);
  });
  // Assign drinks to every slot, mix types.
  const assignReport = await page.evaluate(() => {
    const ids = ['water', 'can', 'soda', 'cola', 'iced'];
    const slots = Object.values(window.game.machine.slots);
    slots.forEach((s, i) => {
      window.game.assignDrinkToSlot(s.key, ids[i % ids.length]);
    });
    return { slotCount: slots.length };
  });

  const dayStats = [];
  async function playOneDay(label) {
    await page.evaluate(() => {
      // Dismiss any open modal and ensure setup.
      const el = document.getElementById('modal-root');
      if (el) { el.classList.remove('open'); el.innerHTML = ''; }
      if (window.game.state === 'setup') {
        window.game.startDay();
      }
    });
    // Wait until running kicks off then until the upgrade modal appears.
    await page.waitForFunction(() => window.game.state === 'running', { timeout: 10000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('modal-root');
      return el && el.classList.contains('open') && el.querySelector('#eod-next');
    }, { timeout: 60000 });
    const stats = await page.evaluate(() => ({
      day: window.game.day,
      earned: window.game.earnedToday,
      biggest: window.game.biggestDrop,
      money: window.game.money,
      drinkCount: window.game.machine.drinkCount()
    }));
    dayStats.push({ label, ...stats });
    // Click "Pick an upgrade"
    await page.click('#eod-next');
    // Upgrade modal: wait and pick the first non-slot-targeting card if possible, else the first.
    await page.waitForFunction(() => {
      const el = document.getElementById('modal-root');
      return el && el.classList.contains('open') && el.querySelector('.upgrade-card');
    }, { timeout: 5000 });
    const picked = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.upgrade-card'));
      // Prefer upgrades that don't need a slot pick.
      let card = cards.find((c) => !/Over-spin coil|x2 slot/i.test(c.textContent));
      if (!card) card = cards[0];
      card.click();
      return card.querySelector('.ttl').textContent;
    });
    // If a slot-choice upgrade was picked, click an occupied slot to install.
    await page.waitForTimeout(400);
    const needsSlot = await page.evaluate(() => window.game.state === 'choosingSlot');
    if (needsSlot) {
      await page.evaluate(() => {
        // Click first slot with a drink.
        const s = Object.values(window.game.machine.slots).find(x => x.drinkId);
        if (s) window.game.applyModifierAtSlot(s.key, window.game.ui.chooseSlotFor.kind);
        window.game.ui.chooseSlotFor = null;
      });
    }
    // Wait for nextDay to tick setup back.
    await page.waitForFunction(() => window.game.state === 'setup', { timeout: 5000 });
    return picked;
  }

  const picks = [];
  for (let i = 1; i <= 4; i++) {
    const pick = await playOneDay(name + '-day' + i);
    picks.push(pick);
  }

  // Screenshot of final state.
  await page.screenshot({ path: join(outDir, name + '-final.png'), fullPage: false });
  // Clean up.
  const totals = await page.evaluate(() => ({
    money: window.game.money,
    day: window.game.day,
    unlocked: window.game.unlocked,
    customers: window.game.customers.target,
    slots: Object.keys(window.game.machine.slots).length
  }));
  const report = { name, viewport: { width, height }, assignReport, picks, dayStats, totals, errors, consoleErrors };
  writeFileSync(join(outDir, name + '-report.json'), JSON.stringify(report, null, 2));
  await ctx.close();
  return report;
}

const mobile = await runViewport('mobile', 400, 820);
const desktop = await runViewport('desktop', 1280, 820);

await browser.close();
server.close();

console.log(JSON.stringify({ mobile, desktop }, null, 2));
