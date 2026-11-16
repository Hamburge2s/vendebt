// Upgrade system: pick-3 cards at the end of each day.
import { DRINK_ORDER, DRINK_TYPES } from './drinks.js';

export const UPGRADE_KINDS = {
  NEW_DRINK: 'new_drink',
  NEW_SLOT:  'new_slot',
  COIL:      'coil',
  X2:        'x2',
  CUSTOMER:  'customer'
};

export function generateOffer(state) {
  // Return 3 upgrade cards, with at most one "new drink" card.
  const pool = [];
  const lockedDrinks = DRINK_ORDER.filter(id => !state.unlocked.includes(id));
  if (lockedDrinks.length && state.canAddDrink) {
    for (const id of lockedDrinks) {
      pool.push(drinkCard(id));
    }
  }
  if (state.canAddSlot) pool.push(slotCard());
  if (state.hasAnySlot) {
    pool.push(coilCard());
    pool.push(x2Card());
  }
  pool.push(customerCard());

  // Enforce rule: at most one new-drink card per pick.
  const drinks = pool.filter(c => c.kind === UPGRADE_KINDS.NEW_DRINK);
  const others = pool.filter(c => c.kind !== UPGRADE_KINDS.NEW_DRINK);
  shuffle(drinks); shuffle(others);
  const chosen = [];
  if (drinks.length) chosen.push(drinks[0]);
  while (chosen.length < 3 && others.length) chosen.push(others.pop());
  // If still short (e.g., tiny pool), top up with fallback customer cards.
  while (chosen.length < 3) chosen.push(customerCard());
  shuffle(chosen);
  return chosen;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function drinkCard(id) {
  const d = DRINK_TYPES[id];
  return {
    kind: UPGRADE_KINDS.NEW_DRINK,
    drinkId: id,
    icon: '🥤',
    title: 'New drink: ' + d.name,
    desc: pricingFlavor(d) + '. $' + d.price + ' / bottle.'
  };
}
function slotCard() {
  return {
    kind: UPGRADE_KINDS.NEW_SLOT,
    icon: '🟩',
    title: 'Extra slot',
    desc: 'Adds a new slot to your machine. Up to 4 x 4.'
  };
}
function coilCard() {
  return {
    kind: UPGRADE_KINDS.COIL,
    icon: '🌀',
    title: 'Over-spin coil',
    desc: 'Pick a slot. That slot drops 2 drinks per press.'
  };
}
function x2Card() {
  return {
    kind: UPGRADE_KINDS.X2,
    icon: '✨',
    title: 'x2 slot',
    desc: 'Pick a slot. Drinks from that slot earn double.'
  };
}
function customerCard() {
  return {
    kind: UPGRADE_KINDS.CUSTOMER,
    icon: '👥',
    title: '+1 customer / day',
    desc: 'One more customer visits each day.'
  };
}

function pricingFlavor(d) {
  const effectText = {
    'none':    'Plain plastic bottle',
    'bouncy':  'Bouncy aluminium can',
    'fizz':    'Pops a fizz burst on impact',
    'smash':   'Heavy glass. Smashes the drink it lands on',
    'slippery':'Slips off ledges at the smallest touch'
  };
  return effectText[d.effect] || d.name;
}
