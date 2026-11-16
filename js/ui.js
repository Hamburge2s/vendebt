// DOM-side UI: drink picker, HUD, modal, test panel, speech bubbles.
import { DRINK_TYPES, DRINK_ORDER } from './drinks.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.selectedDrink = null;
    this.dayEl = document.getElementById('day');
    this.moneyEl = document.getElementById('money');
    this.debtEl = document.getElementById('debt');
    this.drinkListEl = document.getElementById('drink-list');
    this.startBtn = document.getElementById('start-day');
    this.statusEl = document.getElementById('status-line');
    this.overlay = document.getElementById('overlay-layer');
    this.hintEl = document.getElementById('hint');
    this.modalRoot = document.getElementById('modal-root');
    this.testBtn = document.getElementById('test-btn');
    this.testPanel = null;
    this.chooseSlotFor = null;   // when a modifier upgrade awaits slot pick: {kind, label}

    this.startBtn.addEventListener('click', () => {
      if (this.startBtn.disabled) return;
      this.game.startDay();
    });
    this.testBtn.addEventListener('click', () => this.toggleTestPanel());
    // Canvas click = either place drink or install modifier.
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) return;
      const t = e.touches[0];
      this.onCanvasClick({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });
  }

  refreshDrinkList(unlockedIds) {
    this.drinkListEl.innerHTML = '';
    for (const id of DRINK_ORDER) {
      const def = DRINK_TYPES[id];
      const isUnlocked = unlockedIds.includes(id);
      const card = document.createElement('button');
      card.className = 'drink-card' + (isUnlocked ? '' : ' locked');
      card.dataset.id = id;
      card.innerHTML = `
        ${drinkSvg(def)}
        <div class="nm">${def.name}</div>
        <div class="pr">$${def.price}</div>
      `;
      if (isUnlocked) {
        card.addEventListener('click', () => this.selectDrink(id));
      }
      this.drinkListEl.appendChild(card);
    }
    this.highlightSelection();
  }

  selectDrink(id) {
    this.selectedDrink = id;
    this.chooseSlotFor = null;
    this.hintEl.textContent = 'Now tap a slot to place ' + DRINK_TYPES[id].name;
    this.highlightSelection();
  }

  highlightSelection() {
    for (const card of this.drinkListEl.querySelectorAll('.drink-card')) {
      card.classList.toggle('selected', card.dataset.id === this.selectedDrink);
    }
  }

  setChooseSlotFor(info) {
    this.chooseSlotFor = info;
    if (info) this.setStatus('Tap a slot to install ' + info.label);
  }

  onCanvasClick(e) {
    const canvas = document.getElementById('game-canvas');
    const r = canvas.getBoundingClientRect();
    const wx = (e.clientX - r.left) / r.width * 500;
    const wy = (e.clientY - r.top) / r.height * 800;
    if (this.chooseSlotFor) {
      const slot = this.game.machine.getSlotAt(wx, wy);
      if (!slot) return;
      this.game.applyModifierAtSlot(slot.key, this.chooseSlotFor.kind);
      this.chooseSlotFor = null;
      this.setStatus('Installed. Ready for next day.');
      this.updateStartButton();
      return;
    }
    if (!this.selectedDrink) {
      this.setStatus('Pick a drink first, then tap a slot.');
      return;
    }
    if (this.game.state !== 'setup') return;
    const slot = this.game.machine.getSlotAt(wx, wy);
    if (!slot) return;
    this.game.assignDrinkToSlot(slot.key, this.selectedDrink);
    this.updateStartButton();
  }

  setDay(n)   { this.dayEl.textContent = n; }
  setMoney(n) { this.moneyEl.textContent = '$' + n.toFixed(0); }
  setDebt(n)  { this.debtEl.textContent = '$' + n.toLocaleString(); }
  setStatus(t){ this.statusEl.textContent = t; }

  updateStartButton() {
    const assigned = Object.values(this.game.machine.slots).filter(s => s.drinkId).length;
    this.startBtn.disabled = assigned === 0 || this.game.state !== 'setup';
    this.startBtn.textContent = this.game.state === 'setup' ? 'Start Day' : 'Running...';
  }

  speak(x, y, text, big = false) {
    const el = document.createElement('div');
    el.className = 'speech' + (big ? ' big' : '');
    el.textContent = text;
    const canvas = document.getElementById('game-canvas');
    const r = canvas.getBoundingClientRect();
    el.style.left = (r.left - this.overlay.getBoundingClientRect().left + x / 500 * r.width) + 'px';
    el.style.top  = (r.top  - this.overlay.getBoundingClientRect().top  + y / 800 * r.height) + 'px';
    this.overlay.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  floater(x, y, text, big = false) {
    const el = document.createElement('div');
    el.className = 'floater' + (big ? ' big' : '');
    el.textContent = text;
    const canvas = document.getElementById('game-canvas');
    const r = canvas.getBoundingClientRect();
    el.style.left = (r.left - this.overlay.getBoundingClientRect().left + x / 500 * r.width) + 'px';
    el.style.top  = (r.top  - this.overlay.getBoundingClientRect().top  + y / 800 * r.height) + 'px';
    this.overlay.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  showEndOfDay({ day, earned, biggestDrop, totalMoney }, onContinue) {
    const html = `
      <div class="modal">
        <h2>Day ${day} complete</h2>
        <p class="sub">Customers have gone home. Here is the tally.</p>
        <div class="summary">
          <div><span>Earned today</span><span>$${earned.toFixed(0)}</span></div>
          <div><span>Biggest drop</span><span>${biggestDrop} drink${biggestDrop===1?'':'s'}</span></div>
          <div><span>Cash on hand</span><span>$${totalMoney.toFixed(0)}</span></div>
        </div>
        <div style="text-align:right">
          <button class="primary" id="eod-next">Pick an upgrade</button>
        </div>
      </div>`;
    this.openModal(html);
    document.getElementById('eod-next').addEventListener('click', () => {
      this.closeModal();
      onContinue();
    });
  }

  showUpgradeOffer(cards, onPick) {
    const row = cards.map((c, i) => `
      <button class="upgrade-card" data-i="${i}">
        <div class="icon">${c.icon}</div>
        <div class="ttl">${c.title}</div>
        <div class="dsc">${c.desc}</div>
      </button>`).join('');
    const html = `
      <div class="modal">
        <h2>Pick one</h2>
        <p class="sub">Choose an upgrade for tomorrow.</p>
        <div class="upgrade-row">${row}</div>
      </div>`;
    this.openModal(html);
    for (const btn of this.modalRoot.querySelectorAll('.upgrade-card')) {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.i;
        this.closeModal();
        onPick(cards[idx]);
      });
    }
  }

  openModal(html) {
    this.modalRoot.innerHTML = html;
    this.modalRoot.classList.add('open');
  }
  closeModal() {
    this.modalRoot.classList.remove('open');
    this.modalRoot.innerHTML = '';
  }

  toggleTestPanel() {
    if (this.testPanel && this.testPanel.classList.contains('open')) {
      this.testPanel.classList.remove('open');
      return;
    }
    if (!this.testPanel) {
      const el = document.createElement('div');
      el.className = 'test-panel';
      el.innerHTML = `
        <h3>Test</h3>
        <div class="row"><span>Speed</span>
          <span>
            <button data-sp="1">x1</button>
            <button data-sp="2">x2</button>
            <button data-sp="3">x3</button>
          </span></div>
        <div class="row"><span>Sound</span>
          <button id="tp-mute">On</button></div>
        <div class="row"><span>Unlock all</span>
          <button id="tp-unlock">Do it</button></div>
        <div class="row"><span>Restart</span>
          <button id="tp-restart">Reset</button></div>
      `;
      document.body.appendChild(el);
      this.testPanel = el;
      for (const b of el.querySelectorAll('[data-sp]')) {
        b.addEventListener('click', () => {
          this.game.setSpeed(+b.dataset.sp);
          for (const bb of el.querySelectorAll('[data-sp]')) bb.classList.toggle('on', +bb.dataset.sp === this.game.speed);
        });
      }
      el.querySelector('#tp-mute').addEventListener('click', () => {
        this.game.toggleMute();
        el.querySelector('#tp-mute').textContent = this.game.isMuted() ? 'Off' : 'On';
        el.querySelector('#tp-mute').classList.toggle('on', !this.game.isMuted());
      });
      el.querySelector('#tp-unlock').addEventListener('click', () => this.game.testUnlockAll());
      el.querySelector('#tp-restart').addEventListener('click', () => this.game.restart());
      // initial on-states
      for (const b of el.querySelectorAll('[data-sp]')) b.classList.toggle('on', +b.dataset.sp === this.game.speed);
      el.querySelector('#tp-mute').classList.toggle('on', !this.game.isMuted());
    }
    this.testPanel.classList.add('open');
  }
}

function drinkSvg(def) {
  if (def.shape === 'can') {
    return `<svg viewBox="0 0 40 54">
      <rect x="4" y="2" width="32" height="50" rx="5" fill="${def.color}" stroke="#2a1d0f" stroke-width="2"/>
      <rect x="4" y="2" width="32" height="5" fill="#c0c0c0" stroke="#2a1d0f" stroke-width="1"/>
      <rect x="4" y="47" width="32" height="5" fill="#c0c0c0" stroke="#2a1d0f" stroke-width="1"/>
      <rect x="7" y="12" width="26" height="30" rx="2" fill="${def.label}"/>
      <text x="20" y="31" font-size="9" font-weight="700" fill="${def.color}" text-anchor="middle">${def.labelText}</text>
    </svg>`;
  }
  return `<svg viewBox="0 0 40 54">
    <rect x="15" y="0" width="10" height="10" fill="${def.color}" stroke="#2a1d0f" stroke-width="1.5"/>
    <rect x="14" y="-2" width="12" height="6" rx="1" fill="${def.cap}" stroke="#2a1d0f" stroke-width="1"/>
    <rect x="4" y="10" width="32" height="42" rx="6" fill="${def.color}" stroke="#2a1d0f" stroke-width="2"/>
    <rect x="7" y="20" width="26" height="22" rx="2" fill="${def.label}"/>
    <text x="20" y="35" font-size="8" font-weight="700" fill="#2a1d0f" text-anchor="middle">${def.labelText}</text>
  </svg>`;
}
