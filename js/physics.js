// Physics wrapper around Matter.js (loaded globally as window.Matter).
const M = window.Matter;
export const { Engine, World, Bodies, Body, Events, Composite, Vector, Vertices } = M;

export const CAT = {
  WALL:   0x0001,
  SHELF:  0x0002,
  DRINK:  0x0004,
  BIN:    0x0008,
  SENSOR: 0x0010
};

export function makeEngine() {
  const engine = Engine.create();
  engine.gravity.y = 1.1;
  engine.positionIterations = 8;
  engine.velocityIterations = 6;
  engine.constraintIterations = 3;
  return engine;
}

export function step(engine, dt) {
  Engine.update(engine, dt);
}
