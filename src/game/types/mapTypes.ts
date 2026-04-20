export enum TileType {
  GRASS = 0,
  RIVER = 1,
  ROAD_GRAY = 2,
  ROAD_YELLOW = 3,
  BRIDGE_GRAY = 4,
  BRIDGE_YELLOW = 5,
  GRASS_DARK = 6,
  HILL = 7,
}

export enum ObjectType {
  TREE_LARGE = 'tree_large',
  TREE_PINE = 'tree_pine',
  TREE_SMALL = 'tree_small',
  HOUSE_SMALL = 'house_small',
  HOUSE_MEDIUM = 'house_medium',
  HOUSE_LARGE = 'house_large',
  BUSH = 'bush',
  FLOWER = 'flower',
}

export enum EntityType {
  PERSON = 'person',
  COW = 'cow',
  SHEEP = 'sheep',
  DOG = 'dog',
  CHICKEN = 'chicken',
  HORSE = 'horse',
}

export interface MapObject {
  type: ObjectType;
  gridX: number;
  gridY: number;
  variant?: number;
  windPhase?: number;
}

export interface MapEntity {
  type: EntityType;
  variant: number;
  homeR: number;
  homeC: number;
  curR: number;
  curC: number;
  angle: number;
  speed: number;
  wanderR: number;
  turnTimer: number;
  turnInterval: number;
  flipX: number;
  bobPhase: number;
  legPhase: number;
}

export interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  opacity: number;
}

export interface Bird {
  x: number;
  y: number;
  speed: number;
  wingPhase: number;
  size: number;
  drift: number;
}

export interface Fish {
  r: number;
  c: number;
  offX: number;
  offY: number;
  speed: number;
  phase: number;
  size: number;
  dir: number;
}

export interface SmokeParticle {
  x: number;
  y: number;
  life: number;
  vx: number;
  vy: number;
  size: number;
}

export interface SmokeSource {
  r: number;
  c: number;
  variant: number;
  particles: SmokeParticle[];
}

export interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  size: number;
  type: 'leaf' | 'dust';
  color: string;
}

export interface DamageData {
  [key: string]: string[];
}

export interface GameMapData {
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  grid: TileType[][];
  objects: MapObject[];
  roadDamage: DamageData;
  coreStart: number;
  coreEnd: number;
}
