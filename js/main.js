// Main game loop, state machine, glue.
import { DRINK_TYPES, INITIAL_UNLOCKED, DRINK_ORDER } from './drinks.js';
import { makeEngine, step, Composite, Body } from './physics.js';
import { Machine, WORLD } from './machine.js';
import { CustomerQueue } from './customers.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { generateOffer, UPGRADE_KINDS } from './upgrades.js';
import { sfx, setMuted, isMuted, unlock as unlockAudio } from './audio.js';

class Game {
  constructor() {
    this.engine = makeEngine();
    this.world = this.engine.world;
    this.day = 1;
    this.money = 0;
    this.debt = 9999;
    this.speed = 1;
    this.state = 'setup'; // setup | running | upgrading | choosingSlot
    this.unlocked = INITIAL_UNLOCKED.slice();
    this.currentPressMoney = 0;
    this.currentPressCount = 0;
    this.currentPressId = 0;
    this.biggestDrop = 0;
    this.earnedToday = 0;
    this.pendingPressDrinks = new Map(); // pressId -> count
    this.pendingPressMoney = new Map();  // pressId -> $
    this.jackpotShown = new Set();        // pressIds already triggered a jackpot

    this.machine = new Machine(this.world, this.engine, {
      onBinLand: (b) => this.onBinLand(b),
      onCollision: (a, v, speed) => this.onCollision(a, v, speed),
      onFizz: (b) => this.onFizzBurst(b),
      onSmash: (a, v) => this.onSmash(a, v),
      onChain: (a, v) => this.onChain(a, v)
    });
    this.customers = new CustomerQueue();
    this.renderer = new Renderer(document.getElementById('game-canvas'), this.machine, this.customers);
    this.ui = new UI(this);

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    // Expose for tests.
    window.game = this;

    // First-touch unlocks audio.
    const unlock = () => { unlockAudio(); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock, { once: true });

    this.ui.refreshDrinkList(this.unlocked);
    this.ui.setDay(this.day);
    this.ui.setMoney(this.money);
    this.ui.setDebt(this.debt);
    this.ui.setStatus('Set up your drinks, then start the day.');
    this.ui.updateStartButton();
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const sdt = dt * this.speed;
    step(this.engine, sdt * 1000);
    this.machine.update(now);
    if (this.state === 'running') {
      this.customers.tick(sdt, {
        onInsert: (c) => { sfx.cardInsert(); },
        onPress: (c) => this.customerPress(c),
        onLeave: (c) => this.customerLeave(c)
      });
      if (this.customers.isDone()) this.endDay();
    }
    this.renderer.draw(dt);
    requestAnimationFrame((t) => this.loop(t));
  }

  // === player setup actions ===
  assignDrinkToSlot(slotKey, drinkId) {
    if (!this.unlocked.includes(drinkId)) return;
    this.machine.assignDrink(slotKey, drinkId);
    this.ui.setStatus('Drink placed. Add more or start the day.');
  }

  applyModifierAtSlot(slotKey, kind) {
    const mod = kind === UPGRADE_KINDS.COIL ? 'coil' : 'x2';
    this.machine.installModifier(slotKey, mod);
  }

  startDay() {
    this.state = 'running';
    this.earnedToday = 0;
    this.biggestDrop = 0;
    this.currentPressId = 0;
    this.pendingPressDrinks.clear();
    this.pendingPressMoney.clear();
    this.jackpotShown.clear();
    this.customers.startDay();
    this.ui.updateStartButton();
    this.ui.setStatus('Day ' + this.day + ' underway');
  }

  // === customer behavior ===
  customerPress(c) {
    const slotKeys = Object.values(this.machine.slots)
      .filter(s => s.drinkId && s.resting)
      .map(s => s.key);
    if (!slotKeys.length) return; // no drinks? customer wastes press
    const pick = this.customers.pickSlot(slotKeys);
    c.pressChoice = pick;
    this.currentPressId += 1;
    this.pendingPressDrinks.set(this.currentPressId, 0);
    this.pendingPressMoney.set(this.currentPressId, 0);
    const launched = this.machine.pressSlot(pick, this.currentPressId);
    for (const b of launched) {
      b.pressId = this.currentPressId;
      // Also tag with the originating slot for x2 money.
      this.machine.setBodyOriginSlot(b, pick);
    }
    sfx.press();
  }

  customerLeave(c) {
    // Nothing additional beyond customer queue.
  }

  endDay() {
    this.state = 'upgrading';
    this.ui.updateStartButton();
    // Wait a beat for any late settles.
    setTimeout(() => {
      this.ui.showEndOfDay({
        day: this.day,
        earned: this.earnedToday,
        biggestDrop: this.biggestDrop,
        totalMoney: this.money
      }, () => this.offerUpgrade());
    }, 550);
  }

  offerUpgrade() {
    const state = {
      unlocked: this.unlocked,
      canAddDrink: DRINK_ORDER.some(id => !this.unlocked.includes(id)),
      canAddSlot: this.machine.firstEmptySlot() !== null,
      hasAnySlot: Object.values(this.machine.slots).some(s => s.drinkId)
    };
    const cards = generateOffer(state);
    this.ui.showUpgradeOffer(cards, (card) => this.applyUpgrade(card));
  }

  applyUpgrade(card) {
    switch (card.kind) {
      case UPGRADE_KINDS.NEW_DRINK:
        if (!this.unlocked.includes(card.drinkId)) this.unlocked.push(card.drinkId);
        this.ui.refreshDrinkList(this.unlocked);
        break;
      case UPGRADE_KINDS.NEW_SLOT: {
        const pos = this.machine.firstEmptySlot();
        if (pos) this.machine.addSlot(pos[0], pos[1]);
        break;
      }
      case UPGRADE_KINDS.COIL:
      case UPGRADE_KINDS.X2:
        this.state = 'choosingSlot';
        this.ui.setChooseSlotFor({ kind: card.kind, label: card.title });
        this.ui.updateStartButton();
        break;
      case UPGRADE_KINDS.CUSTOMER:
        this.customers.setTargetCount(this.customers.target + 1);
        break;
    }
    if (card.kind !== UPGRADE_KINDS.COIL && card.kind !== UPGRADE_KINDS.X2) {
      this.nextDay();
    } else {
      // Will go to nextDay after player clicks a slot.
      // Watch for click: UI calls applyModifierAtSlot, we observe via a tiny poll.
      const poll = setInterval(() => {
        if (this.state !== 'choosingSlot') return;
        if (!this.ui.chooseSlotFor) {
          clearInterval(poll);
          this.nextDay();
        }
      }, 120);
    }
  }

  nextDay() {
    this.state = 'setup';
    this.day += 1;
    this.ui.setDay(this.day);
    // Pay down debt with earnings.
    this.debt = Math.max(0, this.debt - Math.floor(this.earnedToday));
    this.ui.setDebt(this.debt);
    this.ui.updateStartButton();
    this.ui.setStatus('New day. Adjust drinks if you like, then start.');
  }

  // === physics hooks ===
  onBinLand(body) {
    const def = DRINK_TYPES[body.drinkId];
    let price = def.price;
    // x2 slot?
    if (this.machine.moneyMultiplierFor(body) === 2) price *= 2;
    this.money += price;
    this.earnedToday += price;
    this.ui.setMoney(this.money);
    // chain accounting
    const pid = body.pressId || 0;
    if (pid) {
      const n = (this.pendingPressDrinks.get(pid) || 0) + 1;
      const $ = (this.pendingPressMoney.get(pid) || 0) + price;
      this.pendingPressDrinks.set(pid, n);
      this.pendingPressMoney.set(pid, $);
      if (n > this.biggestDrop) this.biggestDrop = n;
      if (n >= 4 && !this.jackpotShown.has(pid)) {
        this.jackpotShown.add(pid);
        this.renderer.addShake(16);
        this.renderer.addFlash();
        this.renderer.addParticles(body.position.x, body.position.y, 'smash', 30);
        sfx.jackpot();
        this.ui.speak(WORLD.w/2, 200, 'JACKPOT!', true);
      } else {
        this.renderer.addShake(3);
      }
    }
    // Floating "+$x"
    this.ui.floater(body.position.x, body.position.y - 10, '+$' + price);
    // Sound by material
    if (def.sound === 'glass') sfx.glass();
    else if (def.sound === 'can') sfx.can();
    else sfx.plastic();
    sfx.coin();
  }

  onCollision(a, v, speed) {
    if (speed > 6) this.renderer.addShake(2);
  }

  onChain(a, v) {
    this.renderer.addParticles(v.position.x, v.position.y, 'fizz', 6);
    this.renderer.addShake(1.5);
  }

  onFizzBurst(body) {
    sfx.fizz();
    this.renderer.addParticles(body.position.x, body.position.y, 'fizz', 20);
    this.renderer.addShake(2);
  }

  onSmash(a, victim) {
    sfx.smash();
    this.renderer.addParticles(victim.position.x, victim.position.y, 'smash', 18);
    this.renderer.addShake(6);
  }

  // === controls ===
  setSpeed(s) { this.speed = Math.max(1, Math.min(3, s | 0)); }
  toggleMute() { setMuted(!isMuted()); }
  isMuted() { return isMuted(); }
  testUnlockAll() {
    for (const id of DRINK_ORDER) if (!this.unlocked.includes(id)) this.unlocked.push(id);
    // also add slots up to 4x4
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) this.machine.addSlot(r, c);
    this.customers.setTargetCount(8);
    this.ui.refreshDrinkList(this.unlocked);
    this.ui.setStatus('Unlocked everything. Try different drinks.');
  }
  restart() {
    this.money = 0; this.debt = 9999; this.day = 1;
    this.earnedToday = 0; this.biggestDrop = 0;
    this.unlocked = INITIAL_UNLOCKED.slice();
    this.machine.reset();
    this.customers.reset();
    this.customers.setTargetCount(5);
    this.state = 'setup';
    this.ui.refreshDrinkList(this.unlocked);
    this.ui.setDay(1);
    this.ui.setMoney(0);
    this.ui.setDebt(this.debt);
    this.ui.setStatus('Reset. Place drinks and start day 1.');
    this.ui.updateStartButton();
  }
}

new Game();
