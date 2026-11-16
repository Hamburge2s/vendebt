// Drink type catalog. Each entry describes physics + visuals + effect.
export const DRINK_TYPES = {
  water: {
    id: 'water', name: 'Water', price: 1,
    color: '#c7ecff', cap: '#4096d3', label: '#1b4e73', labelText: 'H2O',
    shape: 'bottle', w: 42, h: 64,
    density: 0.0015, restitution: 0.08, friction: 0.5, frictionStatic: 1.1,
    effect: 'none',
    sound: 'plastic'
  },
  can: {
    id: 'can', name: 'Can', price: 1,
    color: '#e74c3c', cap: '#b5392b', label: '#fff2c6', labelText: 'POP',
    shape: 'can', w: 40, h: 52,
    density: 0.0013, restitution: 0.55, friction: 0.35, frictionStatic: 0.9,
    effect: 'bouncy',
    sound: 'can'
  },
  soda: {
    id: 'soda', name: 'Soda', price: 2,
    color: '#39c05b', cap: '#1f7a37', label: '#fff', labelText: 'FIZZ',
    shape: 'bottle', w: 44, h: 68,
    density: 0.0016, restitution: 0.3, friction: 0.4, frictionStatic: 1.0,
    effect: 'fizz',
    sound: 'glass'
  },
  cola: {
    id: 'cola', name: 'Glass Cola', price: 3,
    color: '#362418', cap: '#b00020', label: '#fff8e4', labelText: 'COLA',
    shape: 'bottle', w: 46, h: 72,
    density: 0.0045, restitution: 0.04, friction: 0.6, frictionStatic: 1.3,
    effect: 'smash',
    sound: 'glass'
  },
  iced: {
    id: 'iced', name: 'Iced Tea', price: 2,
    color: '#c89260', cap: '#5a3a22', label: '#fff2c6', labelText: 'ICE',
    shape: 'bottle', w: 42, h: 66,
    density: 0.0014, restitution: 0.25, friction: 0.02, frictionStatic: 0.12,
    effect: 'slippery',
    sound: 'plastic'
  }
};

export const INITIAL_UNLOCKED = ['water', 'can'];
export const DRINK_ORDER = ['water', 'can', 'soda', 'cola', 'iced'];

export function allDrinkIds() { return DRINK_ORDER.slice(); }
