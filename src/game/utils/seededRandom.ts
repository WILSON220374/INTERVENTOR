// src/game/utils/seededRandom.ts

export function sn(s: number): number {
  const x = Math.sin(s + 0.1) * 43758.5453;
  return x - Math.floor(x);
}
