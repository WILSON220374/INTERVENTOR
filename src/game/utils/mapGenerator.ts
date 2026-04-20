import { TileType, ObjectType, EntityType } from '../types/mapTypes';
import type { GameMapData, MapObject, MapEntity, Cloud, Bird, Fish, SmokeSource, WeatherParticle, DamageData } from '../types/mapTypes';
import { sn } from './seededRandom';

const COLS = 48;
const ROWS = 48;

export function generateGrid(): TileType[][] {
  const map: TileType[][] = [];
  for (let r = 0; r < ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < COLS; c++) map[r][c] = TileType.GRASS;
  }
  for (let r = 0; r < ROWS; r++) {
    const rc = Math.floor(COLS * 0.7 - r * 0.45 + Math.sin(r * 0.22) * 1.8);
    if (rc >= 0 && rc < COLS) map[r][rc] = TileType.RIVER;
    if (rc + 1 >= 0 && rc + 1 < COLS) map[r][rc + 1] = TileType.RIVER;
  }
  for (let r = 0; r < ROWS; r++) {
    const rc = Math.floor(COLS * 0.32 + r * 0.38 + Math.cos(r * 0.18) * 1.0);
    if (rc >= 0 && rc < COLS) {
      map[r][rc] = map[r][rc] === TileType.RIVER ? TileType.BRIDGE_YELLOW : TileType.ROAD_YELLOW;
    }
  }
  const coreStart = Math.floor(ROWS * 0.22);
  const coreEnd = Math.floor(ROWS * 0.78);
  for (let r = coreStart; r <= coreEnd; r++) {
    const rc = Math.floor(COLS * 0.32 + r * 0.38 + Math.cos(r * 0.18) * 1.0);
    if (rc >= 0 && rc < COLS) {
      if (map[r][rc] === TileType.BRIDGE_YELLOW || map[r][rc] === TileType.RIVER) {
        map[r][rc] = TileType.BRIDGE_GRAY;
      } else {
        map[r][rc] = TileType.ROAD_GRAY;
      }
    }
  }
  return map;
}

export function generateRoadDamage(grid: TileType[][]): DamageData {
  const damage: DamageData = {};
  const coreStart = Math.floor(ROWS * 0.22);
  const coreEnd = Math.floor(ROWS * 0.78);
  for (let r = coreStart; r <= coreEnd; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === TileType.ROAD_GRAY || grid[r][c] === TileType.BRIDGE_GRAY) {
        const seed = sn(r * 211 + c * 137 + 77);
        const dmg: string[] = [];
        if (seed < 0.25) dmg.push('pothole');
        else if (seed < 0.45) dmg.push('crack');
        else if (seed < 0.6) dmg.push('patch');
        else if (seed < 0.7) dmg.push('rubble');
        if (sn(r * 59 + c * 43) < 0.3) dmg.push('weed');
        damage[`${r},${c}`] = dmg;
      }
    }
  }
  return damage;
}

export function generateObjects(grid: TileType[][]): MapObject[] {
  const objs: MapObject[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== TileType.GRASS) continue;
      const h = sn(r * 197 + c * 131 + 42);
      if (h < 0.035) {
        const v = Math.floor(sn(r * 31 + c * 77) * 3);
        const types = [ObjectType.HOUSE_SMALL, ObjectType.HOUSE_MEDIUM, ObjectType.HOUSE_LARGE];
        objs.push({ type: types[v], gridX: c, gridY: r, variant: v });
      } else if (h < 0.07) {
        objs.push({ type: ObjectType.TREE_LARGE, gridX: c, gridY: r, variant: 0, windPhase: sn(r * 23 + c * 61) * Math.PI * 2 });
      } else if (h < 0.09) {
        objs.push({ type: ObjectType.TREE_PINE, gridX: c, gridY: r, variant: 1, windPhase: sn(r * 29 + c * 67) * Math.PI * 2 });
      } else if (h < 0.11) {
        objs.push({ type: ObjectType.TREE_SMALL, gridX: c, gridY: r, variant: 2, windPhase: sn(r * 37 + c * 71) * Math.PI * 2 });
      } else if (h < 0.14) {
        objs.push({ type: ObjectType.BUSH, gridX: c, gridY: r });
      } else if (h < 0.19) {
        objs.push({ type: ObjectType.FLOWER, gridX: c, gridY: r });
      }
    }
  }
  return objs;
}

export function generateEntities(grid: TileType[][]): MapEntity[] {
  const ents: MapEntity[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== TileType.GRASS) continue;
      const h = sn(r * 197 + c * 131 + 42);
      let type: EntityType | null = null;
      let variant = 0;
      if (h >= 0.14 && h < 0.17) { type = EntityType.PERSON; variant = Math.floor(sn(r * 19 + c * 67) * 4); }
      else if (h >= 0.19 && h < 0.21) { type = EntityType.COW; variant = Math.floor(sn(r * 89 + c * 23) * 2); }
      else if (h >= 0.21 && h < 0.225) { type = EntityType.SHEEP; }
      else if (h >= 0.225 && h < 0.235) { type = EntityType.DOG; variant = Math.floor(sn(r * 47 + c * 13) * 2); }
      else if (h >= 0.235 && h < 0.25) { type = EntityType.CHICKEN; }
      else if (h >= 0.25 && h < 0.258) { type = EntityType.HORSE; variant = Math.floor(sn(r * 61 + c * 37) * 2); }
      if (type) {
        let speed = 0.003 + sn(r * 71 + c * 43) * 0.006;
        if (type === EntityType.DOG) speed *= 1.8;
        if (type === EntityType.HORSE) speed *= 1.5;
        if (type === EntityType.CHICKEN) speed *= 2.0;
        if (type === EntityType.COW || type === EntityType.SHEEP) speed *= 0.6;
        let wanderR = 0.6 + sn(r * 53 + c * 17) * 1.2;
        if (type === EntityType.DOG || type === EntityType.HORSE) wanderR *= 1.6;
        ents.push({
          type, variant, homeR: r, homeC: c, curR: r, curC: c,
          angle: sn(r * 37 + c * 89) * Math.PI * 2, speed, wanderR,
          turnTimer: 0, turnInterval: 2000 + sn(r * 91 + c * 31) * 5000,
          flipX: sn(r * 13 + c * 79) > 0.5 ? 1 : -1,
          bobPhase: sn(r * 23 + c * 61) * Math.PI * 2,
          legPhase: sn(r * 41 + c * 53) * Math.PI * 2,
        });
      }
    }
  }
  return ents;
}

export function generateClouds(): Cloud[] {
  const clouds: Cloud[] = [];
  const cw = (COLS + ROWS) * 68 / 2 + 68 * 2;
  for (let i = 0; i < 12; i++) {
    clouds.push({ x: sn(i * 73) * cw, y: 30 + sn(i * 47) * 180, w: 60 + sn(i * 31) * 100, h: 18 + sn(i * 59) * 20, speed: 0.15 + sn(i * 83) * 0.3, opacity: 0.15 + sn(i * 29) * 0.2 });
  }
  return clouds;
}

export function generateBirds(): Bird[] {
  const birds: Bird[] = [];
  const cw = (COLS + ROWS) * 68 / 2 + 68 * 2;
  for (let i = 0; i < 18; i++) {
    birds.push({ x: sn(i * 113) * cw, y: 50 + sn(i * 67) * 250, speed: 0.6 + sn(i * 41) * 0.8, wingPhase: sn(i * 97) * Math.PI * 2, size: 3 + sn(i * 53) * 3, drift: sn(i * 79) * 0.3 });
  }
  return birds;
}

export function generateFish(grid: TileType[][]): Fish[] {
  const arr: Fish[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === TileType.RIVER && sn(r * 151 + c * 97) < 0.12) {
        arr.push({ r, c, offX: (sn(r * 31 + c * 17) - 0.5) * 20, offY: (sn(r * 19 + c * 41) - 0.5) * 8, speed: 0.5 + sn(r * 67 + c * 23) * 1.0, phase: sn(r * 43 + c * 71) * Math.PI * 2, size: 2 + sn(r * 89 + c * 13) * 2, dir: sn(r * 37 + c * 59) > 0.5 ? 1 : -1 });
      }
    }
  }
  return arr;
}

export function generateSmokeSources(objects: MapObject[]): SmokeSource[] {
  const sources: SmokeSource[] = [];
  for (const o of objects) {
    if ((o.type === ObjectType.HOUSE_SMALL || o.type === ObjectType.HOUSE_MEDIUM || o.type === ObjectType.HOUSE_LARGE) && sn(o.gridY * 71 + o.gridX * 37) < 0.4) {
      sources.push({ r: o.gridY, c: o.gridX, variant: o.variant ?? 0, particles: [] });
    }
  }
  return sources;
}

export function generateWeatherParticles(): WeatherParticle[] {
  const particles: WeatherParticle[] = [];
  const cw = (COLS + ROWS) * 68 / 2 + 68 * 2;
  const ch = (COLS + ROWS) * 34 / 2 + 34 * 2 + 120;
  for (let i = 0; i < 40; i++) {
    particles.push({ x: sn(i * 131) * cw, y: sn(i * 97) * ch, vx: 0.3 + sn(i * 43) * 0.5, vy: 0.1 + sn(i * 67) * 0.3, rot: sn(i * 53) * Math.PI * 2, rotSpeed: (sn(i * 79) - 0.5) * 0.05, size: 2 + sn(i * 37) * 3, type: sn(i * 19) > 0.5 ? 'leaf' : 'dust', color: sn(i * 29) > 0.5 ? '#8B6914' : '#5a8a2a' });
  }
  return particles;
}

export function generateFullMap(): GameMapData {
  const grid = generateGrid();
  return {
    cols: COLS, rows: ROWS, tileWidth: 68, tileHeight: 34, grid,
    objects: generateObjects(grid), roadDamage: generateRoadDamage(grid),
    coreStart: Math.floor(ROWS * 0.22), coreEnd: Math.floor(ROWS * 0.78),
  };
}


