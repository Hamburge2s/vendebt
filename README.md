# Vendebt

Your old corner shop is $9,999 in debt. All you have left is one glass-front drinks vending machine. Set it up each morning, then sit back and watch physics do the work.

**Play it:** open `index.html` in a modern browser.

## How to play

1. Tap a drink in the panel, then tap a slot inside the machine to assign it. Each slot auto-refills.
2. Hit **Start Day**. Customers walk in one by one, swipe a card and press a random slot. The drink drops. If it clips another bottle on the way down, that one falls too. Chains pay more.
3. 4+ bottles from a single press triggers a **JACKPOT**.
4. End of day: pick one of three upgrade cards. New drinks, new slots, over-spin coils, x2 slots, or more customers per day.

Two drinks are unlocked at the start: Water and Can. Upgrades unlock Soda (fizz burst), Glass Cola (heavy smasher), and Iced Tea (slippery on ledges).

## Running locally

Any static HTTP server will do — the game uses ES modules, so `file://` is blocked by CORS. Pick one:

```bash
# Python 3 (not `python3` on this machine — use plain `python`)
python -m http.server 8000
```

```bash
# Node (no install)
npx --yes http-server . -p 8000
```

Then open http://localhost:8000.

## Test panel

Click the `⚙` button top right for a test panel:

- Game speed x1 / x2 / x3
- Sound on / off
- **Unlock everything**: all drinks, all 16 slots, more customers
- Restart

## Automated test

```bash
npm install playwright
npx playwright install chromium
node test-harness.mjs
```

The harness spins up a tiny static server, loads the game at 400×820 (mobile) and 1280×820 (desktop), plays 4 days with everything unlocked, picks upgrades, and writes a JSON report plus screenshots to `test-out/`.

## Project layout

```
index.html            entry page
css/game.css          styles
js/
  main.js             state machine, hooks
  physics.js          Matter.js wrapper + collision categories
  drinks.js           drink definitions
  machine.js          slots, ledges, press + chain logic
  customers.js        customer queue
  upgrades.js         pick-3 offers
  render.js           canvas drawing, particles, shake
  ui.js               DOM UI, modals, test panel, drink cards
  audio.js            Web Audio synth (no files)
vendor/
  matter.min.js       Matter.js, MIT licence (see CREDITS.txt)
img/                  (reserved for future sprites)
```

## Hosting

The repo is designed for GitHub Pages at the root. The `.nojekyll` file prevents the Jekyll build step from hiding files whose names start with `_`.

## Not in the prototype

- Debt deadlines, losing, meta progression. The core loop and the upgrade pick are all that is in scope here.
