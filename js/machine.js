// Machine: slot grid, physical bodies, press logic, refill.
import { DRINK_TYPES } from './drinks.js';
import { Bodies, Body, Composite, Events, Vector, CAT } from './physics.js';

// World geometry (also used by renderer).
export const WORLD = {
  w: 500, h: 800,
  machine: { x: 40, y: 60, w: 420, h: 720 },
  inner:   { x: 60, y: 90, w: 380, h: 660 },
  binTop:  620,        // y of top of bin (inside inner area)
  // 4x4 max grid. Row/col 0 = top-left.
  rows: 4, cols: 4,
  rowY: [180, 310, 440, 568],  // y of drink center when resting on shelf
  colX: [120, 203, 287, 380],   // x of drink center
  ledgeW: 72, ledgeH: 8,
  ledgeOffsetY: 36  // ledge center y = drink center y + offset (approx drink half + ledge half)
};

export class Machine {
  constructor(world, engine, hooks) {
    this.world = world;
    this.engine = engine;
    this.hooks = hooks;  // { onBinLand, onDrinkLand, onCollision }
    this.slots = {};      // key "r_c" -> slot
    this.staticBodies = [];
    this.drinkBodies = new Set();   // live Matter bodies
    this.pendingRefill = new Map(); // slotKey -> timeoutId
    this.initialSlots = [
      [0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2]
    ];
    this.buildStatics();
    this.installInitialSlots();
    this.wireCollisions();
  }

  key(r, c) { return r + '_' + c; }

  buildStatics() {
    const m = WORLD.inner;
    const wallOpts = { isStatic: true, friction: 0.6, restitution: 0.1,
      collisionFilter: { category: CAT.WALL, mask: CAT.DRINK } };
    const wallThick = 20;
    // Left and right inner walls
    const left  = Bodies.rectangle(m.x - wallThick/2, m.y + m.h/2, wallThick, m.h, wallOpts);
    const right = Bodies.rectangle(m.x + m.w + wallThick/2, m.y + m.h/2, wallThick, m.h, wallOpts);
    // Bin floor (slightly below actual bin top so drinks settle inside)
    const floor = Bodies.rectangle(m.x + m.w/2, m.y + m.h + wallThick/2 - 10, m.w + 2*wallThick, wallThick, wallOpts);
    // Bin sides
    const binLeft  = Bodies.rectangle(m.x + 20, (WORLD.binTop + m.y + m.h) / 2, 10, m.y + m.h - WORLD.binTop, wallOpts);
    const binRight = Bodies.rectangle(m.x + m.w - 20, (WORLD.binTop + m.y + m.h) / 2, 10, m.y + m.h - WORLD.binTop, wallOpts);

    this.staticBodies.push(left, right, floor, binLeft, binRight);
    Composite.add(this.world, this.staticBodies);

    // Bin sensor: any body entering this zone is "collected"
    this.binSensor = Bodies.rectangle(
      m.x + m.w/2, (WORLD.binTop + m.y + m.h) / 2,
      m.w - 50, (m.y + m.h) - WORLD.binTop - 8,
      { isStatic: true, isSensor: true,
        collisionFilter: { category: CAT.BIN, mask: CAT.DRINK } }
    );
    this.binSensor.label = 'binSensor';
    Composite.add(this.world, this.binSensor);
  }

  installInitialSlots() {
    for (const [r, c] of this.initialSlots) this.addSlot(r, c);
  }

  addSlot(r, c) {
    const k = this.key(r, c);
    if (this.slots[k]) return false;
    const x = WORLD.colX[c], y = WORLD.rowY[r];
    const ledgeY = y + WORLD.ledgeOffsetY;
    const ledge = Bodies.rectangle(x, ledgeY, WORLD.ledgeW, WORLD.ledgeH, {
      isStatic: true, friction: 0.9, frictionStatic: 1.4, restitution: 0.02,
      collisionFilter: { category: CAT.SHELF, mask: CAT.DRINK },
      label: 'ledge:' + k
    });
    Composite.add(this.world, ledge);
    this.slots[k] = {
      key: k, r, c, x, y, ledgeY, ledge,
      drinkId: null, modifier: null, // modifier: 'coil' | 'x2' | null
      resting: null,                  // the current resting drink body
      awaitingRest: false
    };
    return true;
  }

  firstEmptySlot() {
    for (let r = 0; r < WORLD.rows; r++) {
      for (let c = 0; c < WORLD.cols; c++) {
        if (!this.slots[this.key(r, c)]) return [r, c];
      }
    }
    return null;
  }

  slotCount() { return Object.keys(this.slots).length; }

  // Assign a drink type to a slot. Also spawns the resting drink if slot was empty.
  assignDrink(slotKey, drinkId) {
    const s = this.slots[slotKey];
    if (!s) return;
    s.drinkId = drinkId;
    this.refillSlot(s, true);
  }

  getSlotAt(x, y) {
    // find the slot whose cell contains the point
    let best = null, bestDist = 1e9;
    for (const s of Object.values(this.slots)) {
      const dx = x - s.x, dy = y - (s.y + 10);
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) { bestDist = d2; best = s; }
    }
    if (best && bestDist < 90 * 90) return best;
    return null;
  }

  installModifier(slotKey, modifier) {
    const s = this.slots[slotKey];
    if (!s) return false;
    s.modifier = modifier;
    return true;
  }

  // Place a drink body at the slot's resting position (on the ledge).
  refillSlot(slot, immediate = false) {
    if (!slot.drinkId) return;
    if (slot.resting && !slot.resting.isRemoved) return;
    const spawn = () => {
      if (slot.resting && !slot.resting.isRemoved) return;
      // Small random x offset so drinks don't all align perfectly — encourages chains.
      const xoff = (Math.random() - 0.5) * 10;
      const body = this.makeDrinkBody(slot.drinkId, slot.x + xoff, slot.y, { resting: true });
      body.slotKey = slot.key;
      Composite.add(this.world, body);
      this.drinkBodies.add(body);
      slot.resting = body;
      slot.refillAt = 0;
    };
    if (immediate) spawn();
    else {
      slot.refillAt = performance.now() + 450;
    }
  }

  freeFromSlot(body) {
    if (!body.slotKey) return;
    const slot = this.slots[body.slotKey];
    if (slot && slot.resting === body) slot.resting = null;
    body.slotKey = null;
    body.isResting = false;
  }

  makeDrinkBody(drinkId, x, y, { resting = false } = {}) {
    const def = DRINK_TYPES[drinkId];
    const opts = {
      density: def.density,
      restitution: def.restitution,
      friction: def.friction,
      frictionStatic: def.frictionStatic,
      slop: 0.02,
      collisionFilter: { category: CAT.DRINK,
        mask: CAT.WALL | CAT.SHELF | CAT.DRINK | CAT.BIN }
    };
    let body;
    if (def.shape === 'can') {
      body = Bodies.rectangle(x, y, def.w, def.h, { ...opts, chamfer: { radius: 8 } });
    } else {
      body = Bodies.rectangle(x, y, def.w, def.h, { ...opts, chamfer: { radius: 6 } });
    }
    body.drinkId = drinkId;
    body.effect = def.effect;
    body.sound = def.sound;
    body.pressed = false;
    body.counted = false;
    body.isResting = resting;
    body.createdAt = performance.now();
    body.pressId = null;
    return body;
  }

  // Press a slot: launches its resting drink.
  pressSlot(slotKey, pressId) {
    const s = this.slots[slotKey];
    if (!s || !s.drinkId || !s.resting) return [];
    const launched = [];
    const launchOne = () => {
      const body = s.resting;
      if (!body) return;
      this.freeFromSlot(body);
      body.pressed = true;
      body.pressId = pressId;
      // Pressed drink ignores shelves so it falls straight down to the bin
      // (may still collide with resting drinks in the way, enabling chains).
      body.collisionFilter.mask = CAT.DRINK | CAT.WALL | CAT.BIN;
      const nudgeX = (Math.random() - 0.5) * 1.6;
      Body.setVelocity(body, { x: nudgeX, y: 4 });
      launched.push(body);
    };
    launchOne();
    // Over-spin coil: spawn a second drink falling from above the slot.
    if (s.modifier === 'coil') {
      const def = DRINK_TYPES[s.drinkId];
      const body2 = this.makeDrinkBody(s.drinkId, s.x, s.y - def.h - 8);
      body2.pressed = true;
      body2.pressId = pressId;
      body2.slotKey = s.key; // for x2 attribution
      body2.collisionFilter.mask = CAT.DRINK | CAT.WALL | CAT.BIN;
      Body.setVelocity(body2, { x: 0, y: 4 });
      body2.fromCoil = true;
      Composite.add(this.world, body2);
      this.drinkBodies.add(body2);
      launched.push(body2);
    }
    s.refillAt = performance.now() + 550;
    return launched;
  }

  // Remove drinks that have been collected or left the world.
  cullBody(body) {
    if (!this.drinkBodies.has(body)) return;
    this.drinkBodies.delete(body);
    body.isRemoved = true;
    Composite.remove(this.world, body);
  }

  // Multiplier applied to the drink when counting money (slot's x2 modifier).
  moneyMultiplierFor(body) {
    if (!body.slotKey) return 1;
    // Fallback: if the drink came from a specific slot and that slot has x2 modifier,
    // apply doubling. We track via a tag baked when pressing.
    const s = this.slots[body.slotKey];
    if (s && s.modifier === 'x2') return 2;
    return 1;
  }

  setBodyOriginSlot(body, slotKey) {
    body.slotKey = slotKey;
  }

  wireCollisions() {
    Events.on(this.engine, 'collisionStart', (ev) => {
      for (const pair of ev.pairs) {
        const a = pair.bodyA, b = pair.bodyB;
        // Bin landing
        if (a.label === 'binSensor' || b.label === 'binSensor') {
          const drink = a.label === 'binSensor' ? b : a;
          this.handleBinEnter(drink);
          continue;
        }
        // Drink <-> drink (chain, effects)
        if (a.drinkId && b.drinkId) {
          this.handleDrinkHit(a, b, pair);
        }
      }
    });
  }

  handleBinEnter(drink) {
    if (!drink || drink.counted) return;
    drink.counted = true;
    this.hooks.onBinLand && this.hooks.onBinLand(drink);
  }

  handleDrinkHit(a, b, pair) {
    // Figure out which was moving fast; that is the aggressor.
    const va = Math.hypot(a.velocity.x, a.velocity.y);
    const vb = Math.hypot(b.velocity.x, b.velocity.y);
    const aggressor = va > vb ? a : b;
    const victim    = aggressor === a ? b : a;
    // Chain: if a pressed/falling drink hits a resting drink, knock the resting
    // drink off its ledge and send it falling to the bin as well.
    if (aggressor.pressed && victim.isResting && !victim.counted) {
      this.freeFromSlot(victim);
      victim.pressed = true;
      victim.pressId = aggressor.pressId;
      victim.collisionFilter.mask = CAT.DRINK | CAT.WALL | CAT.BIN;
      const dir = Math.sign(victim.position.x - aggressor.position.x) || (Math.random() < 0.5 ? -1 : 1);
      const vx = dir * (1.5 + Math.random() * 1.5);
      const vy = Math.max(2.5, victim.velocity.y + 1.5);
      Body.setVelocity(victim, { x: vx, y: vy });
      this.hooks.onChain && this.hooks.onChain(aggressor, victim);
    }
    const def = DRINK_TYPES[aggressor.drinkId];
    const speed = va;
    if (!def) return;
    if (speed > 3 && def.effect === 'fizz') this.applyFizzBurst(aggressor);
    if (speed > 3 && def.effect === 'smash' && victim !== aggressor) {
      const dir = Vector.normalise(Vector.sub(victim.position, aggressor.position));
      Body.setVelocity(victim, { x: dir.x * 6, y: Math.max(2, victim.velocity.y + 2) });
      victim.smashed = true;
      this.hooks.onSmash && this.hooks.onSmash(aggressor, victim);
    }
    this.hooks.onCollision && this.hooks.onCollision(aggressor, victim, speed);
  }

  applyFizzBurst(origin) {
    if (origin._fizzed) return;
    origin._fizzed = true;
    const radius = 130;
    for (const body of this.drinkBodies) {
      if (body === origin || body.counted) continue;
      const dx = body.position.x - origin.position.x;
      const dy = body.position.y - origin.position.y;
      const d = Math.hypot(dx, dy);
      if (d > radius || d < 1) continue;
      const falloff = 1 - d / radius;
      if (body.isResting) {
        this.freeFromSlot(body);
        body.pressed = true;
        body.pressId = origin.pressId;
        body.collisionFilter.mask = CAT.DRINK | CAT.WALL | CAT.BIN;
      }
      const dir = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1);
      Body.setVelocity(body, {
        x: dir * (2 + falloff * 2),
        y: Math.max(body.velocity.y, 1 + falloff * 1.5)
      });
    }
    this.hooks.onFizz && this.hooks.onFizz(origin);
  }

  // Called each tick.
  update(now) {
    // Refill slots whose drink has been pressed or knocked away.
    for (const s of Object.values(this.slots)) {
      if (!s.drinkId) continue;
      if (s.resting && !s.resting.isRemoved) continue;
      if (s.resting && s.resting.isRemoved) s.resting = null;
      if (s.refillAt && now >= s.refillAt) {
        this.refillSlot(s, true);
      } else if (!s.refillAt) {
        s.refillAt = now + 250;
      }
    }
    // Cull drinks outside world and counted-settled ones.
    for (const b of Array.from(this.drinkBodies)) {
      if (b.counted) {
        if (b.countedAt == null) b.countedAt = now;
        const vx = b.velocity.x, vy = b.velocity.y;
        if (now - b.countedAt > 220 && Math.abs(vx) + Math.abs(vy) < 1.2) {
          this.cullBody(b);
        } else if (now - b.countedAt > 1200) {
          this.cullBody(b);
        }
      }
      if (b.position.y > WORLD.h + 200 || b.position.x < -200 || b.position.x > WORLD.w + 200) {
        this.cullBody(b);
      }
    }
  }

  drinkCount() { return this.drinkBodies.size; }

  reset() {
    // Remove all drinks and slots.
    for (const b of this.drinkBodies) Composite.remove(this.world, b);
    this.drinkBodies.clear();
    for (const s of Object.values(this.slots)) {
      Composite.remove(this.world, s.ledge);
    }
    for (const [, tid] of this.pendingRefill) clearTimeout(tid);
    this.pendingRefill.clear();
    this.slots = {};
    this.installInitialSlots();
  }
}
