// Canvas renderer. Draws machine, shelves, drinks, bin, customer, particles.
import { DRINK_TYPES } from './drinks.js';
import { WORLD } from './machine.js';

export class Renderer {
  constructor(canvas, machine, customers) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.machine = machine;
    this.customers = customers;
    this.shake = 0;
    this.particles = [];
    this.flash = 0;
    this.time = 0;
  }

  addShake(mag) { this.shake = Math.min(18, this.shake + mag); }
  addFlash() { this.flash = 1; }

  addParticles(x, y, kind, count = 10) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 1,
        life: 0.6 + Math.random() * 0.4,
        age: 0,
        kind
      });
    }
  }

  draw(dt) {
    const ctx = this.ctx, c = this.canvas;
    this.time += dt;
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    this.shake = Math.max(0, this.shake - 60 * dt);
    this.flash = Math.max(0, this.flash - dt * 1.4);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.translate(sx, sy);

    this.drawBackground(ctx);
    this.drawMachine(ctx);
    this.drawShelvesAndLedges(ctx);
    this.drawDrinks(ctx);
    this.drawBin(ctx);
    this.drawMachineGlass(ctx);
    this.drawCustomer(ctx);
    this.drawParticles(ctx, dt);
    if (this.flash > 0) this.drawFlash(ctx);
    ctx.restore();
  }

  drawBackground(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
    g.addColorStop(0, '#fff2c6');
    g.addColorStop(1, '#f6c45a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    // shop floor
    ctx.fillStyle = '#b28050';
    ctx.fillRect(0, 740, WORLD.w, 60);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = 0; x < WORLD.w; x += 30) {
      ctx.fillRect(x, 740, 2, 60);
    }
    // sign
    ctx.save();
    ctx.translate(WORLD.w/2, 30);
    ctx.fillStyle = '#2a1d0f';
    ctx.font = 'bold 22px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('VENDEBT', 0, 10);
    ctx.font = '11px system-ui';
    ctx.fillStyle = '#5b3f22';
    ctx.fillText('— est. yesterday —', 0, 26);
    ctx.restore();
  }

  drawMachine(ctx) {
    const m = WORLD.machine;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(m.x + m.w/2, m.y + m.h + 6, m.w/2 - 10, 10, 0, 0, Math.PI*2);
    ctx.fill();
    // Body
    ctx.fillStyle = '#e44f2d';
    this.roundRect(ctx, m.x, m.y, m.w, m.h, 20);
    ctx.fill();
    ctx.strokeStyle = '#2a1d0f';
    ctx.lineWidth = 6;
    ctx.stroke();
    // Top panel
    ctx.fillStyle = '#ffd658';
    this.roundRect(ctx, m.x + 12, m.y + 12, m.w - 24, 50, 12);
    ctx.fill();
    ctx.strokeStyle = '#2a1d0f';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#2a1d0f';
    ctx.font = 'bold 22px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('SODAVERSE', m.x + m.w/2, m.y + 44);
    // Glass area
    const inner = WORLD.inner;
    ctx.fillStyle = '#152436';
    this.roundRect(ctx, inner.x, inner.y, inner.w, inner.h, 10);
    ctx.fill();
    // Inside tint
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(inner.x + 4, inner.y + 4, 18, inner.h - 8);
  }

  drawMachineGlass(ctx) {
    const inner = WORLD.inner;
    // Highlight shimmer on glass front
    ctx.save();
    ctx.globalAlpha = 0.14;
    const g = ctx.createLinearGradient(inner.x, inner.y, inner.x + inner.w, inner.y + inner.h);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.5, 'transparent');
    g.addColorStop(1, '#fff');
    ctx.fillStyle = g;
    this.roundRect(ctx, inner.x, inner.y, inner.w, inner.h, 10);
    ctx.fill();
    ctx.restore();
    // Frame outline
    ctx.strokeStyle = '#2a1d0f';
    ctx.lineWidth = 3;
    this.roundRect(ctx, inner.x, inner.y, inner.w, inner.h, 10);
    ctx.stroke();
  }

  drawShelvesAndLedges(ctx) {
    const inner = WORLD.inner;
    // Thin row lines behind to suggest shelves.
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (const y of WORLD.rowY) {
      const ly = y + WORLD.ledgeOffsetY;
      ctx.beginPath();
      ctx.moveTo(inner.x + 10, ly);
      ctx.lineTo(inner.x + inner.w - 10, ly);
      ctx.stroke();
    }
    // Each slot: ledge drawn as a shiny chrome bar + coil indicator if modified.
    for (const slot of Object.values(this.machine.slots)) {
      const lx = slot.x - WORLD.ledgeW/2;
      const ly = slot.ledgeY - WORLD.ledgeH/2;
      ctx.fillStyle = '#9fb0bf';
      ctx.fillRect(lx, ly, WORLD.ledgeW, WORLD.ledgeH);
      ctx.fillStyle = '#d6e3ec';
      ctx.fillRect(lx, ly, WORLD.ledgeW, 2);
      ctx.strokeStyle = '#2a1d0f';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lx, ly, WORLD.ledgeW, WORLD.ledgeH);
      // Modifier badge
      if (slot.modifier === 'coil') {
        ctx.fillStyle = '#f2a541';
        ctx.beginPath(); ctx.arc(slot.x + 30, slot.ledgeY, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#2a1d0f';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('2x', slot.x + 30, slot.ledgeY + 1);
      } else if (slot.modifier === 'x2') {
        ctx.fillStyle = '#3fa34d';
        ctx.beginPath(); ctx.arc(slot.x + 30, slot.ledgeY, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('$', slot.x + 30, slot.ledgeY + 1);
      }
      // Empty slot hint
      if (!slot.drinkId) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('pick a drink', slot.x, slot.y);
      }
    }
  }

  drawDrinks(ctx) {
    for (const body of this.machine.drinkBodies) {
      const def = DRINK_TYPES[body.drinkId];
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);
      if (def.shape === 'can') this.drawCan(ctx, def);
      else this.drawBottle(ctx, def);
      ctx.restore();
    }
  }

  drawBottle(ctx, def) {
    const w = def.w, h = def.h;
    // body
    ctx.fillStyle = def.color;
    this.roundRect(ctx, -w/2, -h/2 + 8, w, h - 10, 8);
    ctx.fill();
    ctx.strokeStyle = '#2a1d0f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // neck
    ctx.fillStyle = def.color;
    ctx.fillRect(-w/5, -h/2, w * 0.4, 12);
    ctx.strokeRect(-w/5, -h/2, w * 0.4, 12);
    // cap
    ctx.fillStyle = def.cap;
    this.roundRect(ctx, -w/5 - 1, -h/2 - 6, w * 0.4 + 2, 8, 2);
    ctx.fill();
    ctx.stroke();
    // label
    ctx.fillStyle = def.label;
    this.roundRect(ctx, -w/2 + 4, -4, w - 8, 22, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.stroke();
    ctx.fillStyle = '#2a1d0f';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.labelText, 0, 8);
    // shine
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-w/2 + 4, -h/2 + 12, 4, h - 20);
  }

  drawCan(ctx, def) {
    const w = def.w, h = def.h;
    ctx.fillStyle = def.color;
    this.roundRect(ctx, -w/2, -h/2, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = '#2a1d0f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // top rim
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(-w/2, -h/2 - 2, w, 5);
    ctx.strokeRect(-w/2, -h/2 - 2, w, 5);
    ctx.fillRect(-w/2, h/2 - 3, w, 5);
    ctx.strokeRect(-w/2, h/2 - 3, w, 5);
    // label
    ctx.fillStyle = def.label;
    this.roundRect(ctx, -w/2 + 3, -h/2 + 8, w - 6, h - 16, 2);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.labelText, 0, 0);
    // shine
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(-w/2 + 2, -h/2 + 5, 3, h - 10);
  }

  drawBin(ctx) {
    const inner = WORLD.inner;
    ctx.fillStyle = '#2a1d0f';
    ctx.fillRect(inner.x + 10, WORLD.binTop - 8, inner.w - 20, 6);
    ctx.fillStyle = '#5b3f22';
    this.roundRect(ctx, inner.x + 20, WORLD.binTop - 2, inner.w - 40, inner.y + inner.h - WORLD.binTop - 4, 4);
    ctx.fill();
    ctx.strokeStyle = '#2a1d0f';
    ctx.lineWidth = 2;
    ctx.stroke();
    // bin label
    ctx.fillStyle = '#ffd658';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('TAKE DRINK', inner.x + inner.w/2, WORLD.binTop + 16);
  }

  drawCustomer(ctx) {
    const c = this.customers.current;
    if (!c) return;
    const bob = Math.sin(c.bobPhase) * 3;
    const x = c.x, y = c.y + bob;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x, y + 32, 28, 6, 0, 0, Math.PI*2); ctx.fill();
    // body
    ctx.fillStyle = c.palette.shirt;
    this.roundRect(ctx, x - 22, y - 10, 44, 40, 10);
    ctx.fill();
    ctx.strokeStyle = '#2a1d0f';
    ctx.lineWidth = 2;
    ctx.stroke();
    // head
    ctx.fillStyle = c.palette.skin;
    ctx.beginPath(); ctx.arc(x, y - 24, 18, 0, Math.PI*2); ctx.fill();
    ctx.stroke();
    // hair
    ctx.fillStyle = c.palette.hair;
    ctx.beginPath();
    ctx.arc(x, y - 30, 18, Math.PI, Math.PI*2);
    ctx.fill();
    // face
    ctx.fillStyle = '#2a1d0f';
    ctx.beginPath(); ctx.arc(x - 6, y - 24, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 6, y - 24, 2, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#2a1d0f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y - 18, 4, 0, Math.PI);
    ctx.stroke();
    // legs
    ctx.fillStyle = '#2a1d0f';
    ctx.fillRect(x - 16, y + 28, 10, 14);
    ctx.fillRect(x + 6, y + 28, 10, 14);
    // card (during inserting)
    if (this.customers.state === 'inserting') {
      const t = this.customers.timer;
      const prog = Math.min(1, t / 0.4);
      const cx = x + 18 - prog * 10, cy = y - 2 + prog * 6;
      ctx.fillStyle = '#4fc3f7';
      ctx.fillRect(cx, cy, 20, 12);
      ctx.strokeStyle = '#2a1d0f';
      ctx.strokeRect(cx, cy, 20, 12);
    }
  }

  drawParticles(ctx, dt) {
    const alive = [];
    for (const p of this.particles) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      const a = 1 - p.age / p.life;
      if (p.kind === 'fizz') {
        ctx.fillStyle = 'rgba(255,255,255,' + (a * 0.8).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, 2 + a * 2, 0, Math.PI*2); ctx.fill();
      } else if (p.kind === 'smash') {
        ctx.fillStyle = 'rgba(255,220,100,' + a.toFixed(2) + ')';
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      } else {
        ctx.fillStyle = 'rgba(255,220,100,' + a.toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI*2); ctx.fill();
      }
      alive.push(p);
    }
    this.particles = alive;
  }

  drawFlash(ctx) {
    ctx.fillStyle = 'rgba(255, 220, 120, ' + (this.flash * 0.35).toFixed(2) + ')';
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  }

  roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, Math.min(w, h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // Convert client (CSS) coords to world coords for the canvas.
  clientToWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const sx = (clientX - r.left) / r.width * WORLD.w;
    const sy = (clientY - r.top)  / r.height * WORLD.h;
    return { x: sx, y: sy };
  }
}
