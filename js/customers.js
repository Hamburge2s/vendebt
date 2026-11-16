// Customer queue: visits machine one at a time, inserts card, presses a slot.
export class CustomerQueue {
  constructor() {
    this.count = 0;      // customers served this day
    this.target = 5;     // customers per day (configurable)
    this.state = 'idle'; // idle | walking | waiting | pressing | leaving
    this.current = null;
    this.timer = 0;      // seconds in current state
    this.onAction = null; // callback (customer, eventName)
    this.seed = 0;
  }

  setTargetCount(n) { this.target = Math.max(1, n | 0); }
  reset() { this.count = 0; this.state = 'idle'; this.current = null; this.timer = 0; }

  startDay() {
    this.count = 0;
    this.state = 'walking';
    this.timer = 0;
    this.spawnNext();
  }

  spawnNext() {
    const faces = ['happy', 'cool', 'curious', 'tired', 'kid', 'grouch'];
    const palettes = [
      { skin: '#f7c69a', shirt: '#4a8bc2', hair: '#2a1d0f' },
      { skin: '#d9a373', shirt: '#e67e22', hair: '#3b2111' },
      { skin: '#f0cfa8', shirt: '#9b59b6', hair: '#2d1b0a' },
      { skin: '#b07a52', shirt: '#2ecc71', hair: '#1a0e03' },
      { skin: '#f2c9a3', shirt: '#e74c3c', hair: '#633a1b' }
    ];
    this.current = {
      face: faces[(Math.random() * faces.length) | 0],
      palette: palettes[(Math.random() * palettes.length) | 0],
      x: -60, targetX: 230, y: 760,
      bobPhase: Math.random() * Math.PI * 2,
      pressChoice: null
    };
    this.state = 'walking';
    this.timer = 0;
  }

  // Called by the game to pick which slot to press. Returns slotKey or null.
  pickSlot(slotKeys) {
    if (!slotKeys.length) return null;
    return slotKeys[(Math.random() * slotKeys.length) | 0];
  }

  tick(dt, { onInsert, onPress, onLeave }) {
    if (!this.current && this.state !== 'idle') return;
    this.timer += dt;
    const c = this.current;
    switch (this.state) {
      case 'walking': {
        const speed = 220; // px/s
        c.x = Math.min(c.targetX, c.x + speed * dt);
        c.bobPhase += dt * 8;
        if (c.x >= c.targetX - 0.5) {
          this.state = 'inserting';
          this.timer = 0;
          onInsert && onInsert(c);
        }
        break;
      }
      case 'inserting': {
        if (this.timer > 0.45) {
          this.state = 'pressing';
          this.timer = 0;
          onPress && onPress(c);
        }
        break;
      }
      case 'pressing': {
        // Wait for chain to settle before leaving.
        if (this.timer > 2.4) {
          this.state = 'leaving';
          this.timer = 0;
        }
        break;
      }
      case 'leaving': {
        const speed = 260;
        c.x += speed * dt;
        c.bobPhase += dt * 9;
        if (c.x > 600) {
          this.count += 1;
          onLeave && onLeave(c);
          if (this.count >= this.target) {
            this.state = 'done';
            this.current = null;
          } else {
            this.spawnNext();
          }
        }
        break;
      }
    }
  }

  isDone() { return this.state === 'done'; }
}
