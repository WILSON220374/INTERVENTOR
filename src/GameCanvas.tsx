import { useEffect, useRef } from 'react';
import { TileType } from './game/types/mapTypes';
import { IsometricRenderer } from './game/sprites/IsometricRenderer';
import { sn } from './game/utils/seededRandom';
import {
  generateFullMap,
  generateEntities,
  generateClouds,
  generateBirds,
  generateFish,
  generateSmokeSources,
  generateWeatherParticles,
} from './game/utils/mapGenerator';

interface Props {
  isNight: boolean;
  nightOpacity: number;
  startTile: { r: number; c: number } | null;
  roadProgress: number;
  onGrayTileClick: (r: number, c: number) => void;
  workingNow: boolean;
  lluviaIntensaActiva: boolean;
  derrumbeActivo: boolean;
}

export default function GameCanvas({
  startTile,
  roadProgress,
  onGrayTileClick,
  workingNow,
  lluviaIntensaActiva,
  derrumbeActivo,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbackRef = useRef(onGrayTileClick);
  const startTileRef = useRef(startTile);
  const progressRef = useRef(roadProgress);
  const workingRef = useRef(workingNow);
  const lluviaIntensaRef = useRef(lluviaIntensaActiva);
  const derrumbeActivoRef = useRef(derrumbeActivo);

  useEffect(() => {
    callbackRef.current = onGrayTileClick;
  }, [onGrayTileClick]);

  useEffect(() => {
    startTileRef.current = startTile;
  }, [startTile]);

  useEffect(() => {
    progressRef.current = roadProgress;
  }, [roadProgress]);

  useEffect(() => {
    workingRef.current = workingNow;
  }, [workingNow]);

  useEffect(() => {
    lluviaIntensaRef.current = lluviaIntensaActiva;
  }, [lluviaIntensaActiva]);

  useEffect(() => {
    derrumbeActivoRef.current = derrumbeActivo;
  }, [derrumbeActivo]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const cx = cv.getContext('2d');
    if (!cx) return;

    const mapData = generateFullMap();
    const grid = mapData.grid;
    const COLS = 48;
    const ROWS = 48;
    const TW = 68;
    const TH = 34;
    const rnd = new IsometricRenderer(cx, COLS, ROWS, TW, TH);
    const CW = rnd.CW;
    const CH = rnd.CH;
    cv.width = CW;
    cv.height = CH;

    const entities = generateEntities(grid);
    const clouds = generateClouds();
    const birds = generateBirds();
    const fishArr = generateFish(grid);
    const smokeArr = generateSmokeSources(mapData.objects);
    const weatherArr = generateWeatherParticles();
    const rainDrops = Array.from({ length: 520 }, (_, i) => ({
      x: sn(i * 17 + 1.1) * CW,
      y: sn(i * 23 + 2.3) * CH,
      len: 14 + sn(i * 31 + 3.7) * 18,
      speed: 14 + sn(i * 13 + 4.9) * 12,
      drift: 5 + sn(i * 19 + 5.5) * 4,
      alpha: 0.28 + sn(i * 29 + 6.1) * 0.28,
    }));

    let ox = window.innerWidth / 2 - (CW * 0.7) / 2;
    let oy = window.innerHeight / 2 - (CH * 0.7) / 2;
    let sc = 0.7;
    let drag = false;
    let mx = 0;
    let my = 0;
    let clickX = 0;
    let clickY = 0;
    let lastTime = Date.now();
    let ws = 1.0;
    let animId = 0;

    const grayTiles: { r: number; c: number }[] = [];
    const progressTiles: { r: number; c: number }[] = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === TileType.ROAD_GRAY) {
          grayTiles.push({ r, c });
          progressTiles.push({ r, c });
        } else if (grid[r][c] === TileType.BRIDGE_GRAY) {
          progressTiles.push({ r, c });
        }
      }
    }

    function hitTestGray(screenX: number, screenY: number): { r: number; c: number } | null {
      const worldX = (screenX - ox) / sc;
      const worldY = (screenY - oy) / sc;
      let bestDist = Infinity;
      let bestTile: { r: number; c: number } | null = null;

      for (const tile of grayTiles) {
        const tileX = rnd.isoX(tile.r, tile.c);
        const tileY = rnd.isoY(tile.r, tile.c) + TH / 2;
        const dx = worldX - tileX;
        const dy = worldY - tileY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < bestDist) {
          bestDist = dist;
          bestTile = tile;
        }
      }

      if (bestDist > TW * 2) return null;
      return bestTile;
    }

    function handleCanvasSelection(clientX: number, clientY: number) {
      if (startTileRef.current) return;

      const rect = cv.getBoundingClientRect();
      const scaleX = cv.width / rect.width;
      const scaleY = cv.height / rect.height;

      const sx = (clientX - rect.left) * scaleX;
      const sy = (clientY - rect.top) * scaleY;

      const hit = hitTestGray(sx, sy);
      console.log('click canvas', { sx, sy, hit });

      if (hit) {
        callbackRef.current(hit.r, hit.c);
      }
    }

    function getYellowTiles(): Set<string> {
      const result = new Set<string>();
      const start = startTileRef.current;
      const progress = progressRef.current;

      if (!start || progressTiles.length === 0 || progress <= 0) return result;

      let startIdx = -1;
      let minDist = Infinity;

      for (let i = 0; i < progressTiles.length; i++) {
        const d =
          Math.abs(progressTiles[i].r - start.r) +
          Math.abs(progressTiles[i].c - start.c);

        if (d < minDist) {
          minDist = d;
          startIdx = i;
        }
      }

      if (startIdx < 0) return result;

      const total = progressTiles.length;
      const numToPaint = Math.max(1, Math.floor((total * progress) / 100));
      const tilesBelow = total - startIdx - 1;
      const tilesAbove = startIdx;
      let painted = 0;

      result.add(`${progressTiles[startIdx].r},${progressTiles[startIdx].c}`);
      painted++;

      if (tilesBelow >= tilesAbove) {
        for (let i = startIdx + 1; i < total && painted < numToPaint; i++) {
          result.add(`${progressTiles[i].r},${progressTiles[i].c}`);
          painted++;
        }
        for (let i = startIdx - 1; i >= 0 && painted < numToPaint; i--) {
          result.add(`${progressTiles[i].r},${progressTiles[i].c}`);
          painted++;
        }
      } else {
        for (let i = startIdx - 1; i >= 0 && painted < numToPaint; i--) {
          result.add(`${progressTiles[i].r},${progressTiles[i].c}`);
          painted++;
        }
        for (let i = startIdx + 1; i < total && painted < numToPaint; i++) {
          result.add(`${progressTiles[i].r},${progressTiles[i].c}`);
          painted++;
        }
      }

      return result;
    }

    function getConstructionFront(): { r: number; c: number } | null {
      const start = startTileRef.current;
      const progress = progressRef.current;
      if (!start || progressTiles.length === 0) return null;

      let startIdx = -1;
      let minDist = Infinity;

      for (let i = 0; i < progressTiles.length; i++) {
        const d =
          Math.abs(progressTiles[i].r - start.r) +
          Math.abs(progressTiles[i].c - start.c);

        if (d < minDist) {
          minDist = d;
          startIdx = i;
        }
      }

      if (startIdx < 0) return start;

      if (progress <= 0) {
        return progressTiles[startIdx];
      }

      const total = progressTiles.length;
      const numToPaint = Math.max(1, Math.floor((total * progress) / 100));
      const tilesBelow = total - startIdx - 1;
      const tilesAbove = startIdx;

      if (tilesBelow >= tilesAbove) {
        const downCount = Math.min(numToPaint, total - startIdx);
        return progressTiles[Math.min(startIdx + downCount - 1, total - 1)];
      } else {
        const upCount = Math.min(numToPaint, startIdx + 1);
        return progressTiles[Math.max(startIdx - upCount + 1, 0)];
      }
    }

    function drawConstructionSite(front: { r: number; c: number }): void {
      if (!workingRef.current) return;

      const x = rnd.isoX(front.r, front.c);
      const y = rnd.isoY(front.r, front.c);
      const t = Date.now() * 0.003;

      cx.fillStyle = 'rgba(0,0,0,0.12)';
      cx.beginPath();
      cx.ellipse(x, y + 8, 18, 6, 0, 0, Math.PI * 2);
      cx.fill();

      cx.fillStyle = '#F9A825';
      cx.fillRect(x - 16, y - 6, 22, 11);
      cx.fillStyle = '#F57F17';
      cx.fillRect(x - 16, y - 6, 22, 3);

      cx.fillStyle = '#E65100';
      cx.fillRect(x - 14, y - 15, 12, 9);
      cx.fillStyle = '#BF360C';
      cx.fillRect(x - 14, y - 15, 12, 2);

      cx.fillStyle = '#212121';
      cx.beginPath();
      cx.arc(x - 12, y + 6, 4.5, 0, Math.PI * 2);
      cx.fill();
      cx.beginPath();
      cx.arc(x + 2, y + 6, 4.5, 0, Math.PI * 2);
      cx.fill();

      cx.fillStyle = '#555';
      cx.beginPath();
      cx.arc(x - 12, y + 6, 2, 0, Math.PI * 2);
      cx.fill();
      cx.beginPath();
      cx.arc(x + 2, y + 6, 2, 0, Math.PI * 2);
      cx.fill();

      for (let w = 0; w < 4; w++) {
        const wx = x + 14 + w * 9 + Math.sin(t + w * 1.5) * 2;
        const wy = y - 1 + Math.cos(t + w * 2) * 1;

        cx.fillStyle = '#FDD835';
        cx.beginPath();
        cx.arc(wx, wy - 13, 3.5, Math.PI, 0);
        cx.fill();

        cx.fillStyle = '#FFCCBC';
        cx.beginPath();
        cx.arc(wx, wy - 11, 2.8, 0, Math.PI * 2);
        cx.fill();

        cx.fillStyle = '#E65100';
        cx.fillRect(wx - 2.5, wy - 8, 5, 7);

        cx.save();
        cx.translate(wx - 3, wy - 7);
        cx.rotate(Math.sin(t * 2 + w) * 0.4);
        cx.fillRect(0, 0, 2, 5);
        cx.restore();

        cx.save();
        cx.translate(wx + 2, wy - 7);
        cx.rotate(-Math.sin(t * 2 + w) * 0.4);
        cx.fillRect(0, 0, 2, 5);
        cx.restore();

        cx.fillStyle = '#BF360C';
        cx.fillRect(wx - 2.5, wy - 1, 2, 5);
        cx.fillRect(wx + 0.5, wy - 1, 2, 5);

        cx.fillStyle = '#5D4037';
        cx.fillRect(wx - 3, wy + 4, 3, 2);
        cx.fillRect(wx, wy + 4, 3, 2);
      }

      for (let i = 0; i < 2; i++) {
        const coneX = x + 44 + i * 12;
        const coneY = y - 4;
        cx.beginPath();
        cx.moveTo(coneX, coneY - 10);
        cx.lineTo(coneX + 5, coneY);
        cx.lineTo(coneX - 5, coneY);
        cx.closePath();
        cx.fillStyle = '#FF6F00';
        cx.fill();
        cx.fillStyle = '#fff';
        cx.fillRect(coneX - 3, coneY - 5, 6, 2);
      }
    }

    function drawDerrumbe(tile: { r: number; c: number }, size = 1): void {
      const x = rnd.isoX(tile.r, tile.c);
      const y = rnd.isoY(tile.r, tile.c);
      const scale = 1.1 + size * 0.25;

      cx.save();

      cx.fillStyle = 'rgba(0,0,0,0.22)';
      cx.beginPath();
      cx.ellipse(x, y + 10, 18 * scale, 8 * scale, 0, 0, Math.PI * 2);
      cx.fill();

      cx.fillStyle = '#facc15';
      cx.beginPath();
      cx.moveTo(x, y - 24 * scale);
      cx.lineTo(x + 16 * scale, y + 8 * scale);
      cx.lineTo(x - 16 * scale, y + 8 * scale);
      cx.closePath();
      cx.fill();

      cx.fillStyle = '#fde047';
      cx.beginPath();
      cx.moveTo(x, y - 18 * scale);
      cx.lineTo(x + 8 * scale, y + 2 * scale);
      cx.lineTo(x - 8 * scale, y + 2 * scale);
      cx.closePath();
      cx.fill();

      cx.strokeStyle = '#a16207';
      cx.lineWidth = 2;
      cx.beginPath();
      cx.moveTo(x, y - 24 * scale);
      cx.lineTo(x + 16 * scale, y + 8 * scale);
      cx.lineTo(x - 16 * scale, y + 8 * scale);
      cx.closePath();
      cx.stroke();

     cx.restore();
    }


    const onMD = (e: MouseEvent) => {
      drag = true;
      mx = e.clientX;
      my = e.clientY;
      clickX = e.clientX;
      clickY = e.clientY;
      cv.style.cursor = 'grabbing';
    };

    const onMM = (e: MouseEvent) => {
      if (!drag) return;
      ox += e.clientX - mx;
      oy += e.clientY - my;
      mx = e.clientX;
      my = e.clientY;
    };

    const onMU = (e: MouseEvent) => {
      const moved =
        Math.abs(e.clientX - clickX) > 5 || Math.abs(e.clientY - clickY) > 5;

      if (!moved && !startTileRef.current) {
        const rect = cv.getBoundingClientRect();
        const scaleX = cv.width / rect.width;
        const scaleY = cv.height / rect.height;
        const sx = (e.clientX - rect.left) * scaleX;
        const sy = (e.clientY - rect.top) * scaleY;
        const hit = hitTestGray(sx, sy);

        if (hit) {
          console.log('clic detectado en gris', hit);
          callbackRef.current(hit.r, hit.c);
        }
      }

      drag = false;
      cv.style.cursor = 'grab';
    };

    const onWH = (e: WheelEvent) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const f = e.deltaY > 0 ? 0.93 : 1.07;
      const ns = Math.min(3, Math.max(0.3, sc * f));
      ox = px - (px - ox) * (ns / sc);
      oy = py - (py - oy) * (ns / sc);
      sc = ns;
    };

    const onClick = (e: MouseEvent) => {
      handleCanvasSelection(e.clientX, e.clientY);
    };

    let touchDist = 0;

    const onTS = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        drag = true;
        mx = e.touches[0].clientX;
        my = e.touches[0].clientY;
        clickX = mx;
        clickY = my;
      }

      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchDist = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const onTM = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1 && drag) {
        ox += e.touches[0].clientX - mx;
        oy += e.touches[0].clientY - my;
        mx = e.touches[0].clientX;
        my = e.touches[0].clientY;
      }

      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const nd = Math.sqrt(dx * dx + dy * dy);
        sc = Math.min(3, Math.max(0.3, sc * (nd / touchDist)));
        touchDist = nd;
      }
    };

    const onTE = (e: TouchEvent) => {
      if (e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        const moved =
          Math.abs(t.clientX - clickX) > 5 || Math.abs(t.clientY - clickY) > 5;

        if (!moved && !startTileRef.current) {
          const rect = cv.getBoundingClientRect();
          const scaleX = cv.width / rect.width;
          const scaleY = cv.height / rect.height;
          const hit = hitTestGray(
            (t.clientX - rect.left) * scaleX,
            (t.clientY - rect.top) * scaleY
          );
          if (hit) callbackRef.current(hit.r, hit.c);
        }
      }

      drag = false;
    };

    cv.addEventListener('mousedown', onMD);
    cv.addEventListener('click', onClick);
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    cv.addEventListener('wheel', onWH, { passive: false });
    cv.addEventListener('touchstart', onTS, { passive: true });
    cv.addEventListener('touchmove', onTM, { passive: false });
    cv.addEventListener('touchend', onTE);
    cv.style.cursor = 'grab';

    function updateWorld(dt: number): void {
      const now = Date.now();
      ws = 0.8 + Math.sin(now * 0.0003) * 0.4;

      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        e.turnTimer += dt;
        e.bobPhase += dt * 0.005;
        e.legPhase += dt * (e.speed * 3);

        if (e.turnTimer >= e.turnInterval) {
          e.turnTimer = 0;
          e.angle += (sn(now * 0.001 + i * 7) - 0.5) * Math.PI * 1.2;
          e.turnInterval = 2000 + sn(now * 0.001 + i * 13) * 5000;
        }

        let nr = e.curR + Math.sin(e.angle) * e.speed * dt * 0.06;
        let nc = e.curC + Math.cos(e.angle) * e.speed * dt * 0.06;
        const dr = nr - e.homeR;
        const dc = nc - e.homeC;

        if (Math.sqrt(dr * dr + dc * dc) > e.wanderR) {
          e.angle =
            Math.atan2(e.homeR - e.curR, e.homeC - e.curC) +
            (sn(now + i) - 0.5) * 0.5;
          nr = e.curR + Math.sin(e.angle) * e.speed * dt * 0.06;
          nc = e.curC + Math.cos(e.angle) * e.speed * dt * 0.06;
        }

        const gr = Math.round(nr);
        const gc = Math.round(nc);

        if (
          gr >= 0 &&
          gr < ROWS &&
          gc >= 0 &&
          gc < COLS &&
          grid[gr][gc] === TileType.GRASS
        ) {
          e.curR = nr;
          e.curC = nc;
        } else {
          e.angle += Math.PI * 0.7;
        }

        if (Math.cos(e.angle) > 0.1) e.flipX = 1;
        else if (Math.cos(e.angle) < -0.1) e.flipX = -1;
      }

      for (const cl of clouds) {
        cl.x += cl.speed * ws;
        if (cl.x > CW + 200) cl.x = -200;
      }

      for (const b of birds) {
        b.x += b.speed * ws;
        b.y += Math.sin(b.wingPhase) * b.drift;
        b.wingPhase += dt * 0.008;
        if (b.x > CW + 100) {
          b.x = -50;
          b.y = 50 + sn(now * 0.001 + birds.indexOf(b)) * 250;
        }
      }

      for (let si = 0; si < smokeArr.length; si++) {
        const sh = smokeArr[si];
        if (sn(now * 0.001 + si * 7) < 0.03) {
          const hx = rnd.isoX(sh.r, sh.c);
          const hy = rnd.isoY(sh.r, sh.c);
          sh.particles.push({
            x: hx,
            y: hy + (sh.variant === 1 ? -24 : -18),
            life: 1,
            vx: 0.2 * ws,
            vy: -0.4,
            size: 2,
          });
        }

        for (let j = sh.particles.length - 1; j >= 0; j--) {
          const p = sh.particles[j];
          p.x += p.vx + Math.sin(now * 0.002 + j) * 0.1;
          p.y += p.vy;
          p.size += 0.03;
          p.life -= 0.008;
          if (p.life <= 0) sh.particles.splice(j, 1);
        }
      }

      for (const f of fishArr) {
        f.phase += dt * 0.003 * f.speed;
      }

      for (let wi = 0; wi < weatherArr.length; wi++) {
        const wp = weatherArr[wi];
        wp.x += wp.vx * ws;
        wp.y += wp.vy + Math.sin(wp.rot) * 0.2;
        wp.rot += wp.rotSpeed;
        if (wp.x > CW + 20) wp.x = -10;
        if (wp.y > CH + 20) {
          wp.y = -10;
          wp.x = sn(now * 0.001 + wi) * CW;
        }
      }

      if (lluviaIntensaRef.current) {
        for (let i = 0; i < rainDrops.length; i++) {
          const d = rainDrops[i];
          d.x -= d.drift * ws;
          d.y += d.speed * ws;

          if (d.y > CH + 30 || d.x < -30) {
            d.x = sn(now * 0.001 + i * 9.7) * (CW + 80);
            d.y = -20 - sn(now * 0.001 + i * 5.3) * 80;
          }
        }
      }
    }

    function render(): void {
      const now = Date.now();
      const dt = now - lastTime;
      lastTime = now;
      updateWorld(dt);

      const yellowTiles = getYellowTiles();
      const front = getConstructionFront();

      cx.save();
      cx.setTransform(sc, 0, 0, sc, ox, oy);

      cx.fillStyle = '#2a5418';
      cx.fillRect(-ox / sc - 200, -oy / sc - 200, CW / sc + 600, CH / sc + 600);

      for (const cl of clouds) rnd.drawCloud(cl);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = rnd.isoX(r, c);
          const y = rnd.isoY(r, c);
          const t = grid[r][c];

          if (t === TileType.GRASS) {
            rnd.drawGrass(x, y, r, c);
          } else if (t === TileType.RIVER) {
            rnd.drawRiver(x, y, r, c);
          } else if (t === TileType.ROAD_GRAY) {
            const key = `${r},${c}`;
            if (yellowTiles.has(key)) {
              rnd.drawTile(x, y, '#f97316', true);
              cx.fillStyle = 'rgba(255,255,255,0.15)';
              cx.beginPath();
              cx.moveTo(x - 2, y + 2);
              cx.lineTo(x + TW / 4 - 2, y + TH / 2 + 2);
              cx.lineTo(x - 2, y + TH + 2);
              cx.lineTo(x - TW / 4 - 2, y + TH / 2 + 2);
              cx.closePath();
              cx.fill();
            } else {
              rnd.drawDamagedRoad(x, y, r, c, mapData.roadDamage, ws);
            }
          } else if (t === TileType.ROAD_YELLOW) {
            rnd.drawYellowRoad(x, y);
          } else if (t === TileType.BRIDGE_GRAY) {
            const key = `${r},${c}`;
            if (yellowTiles.has(key)) {
              rnd.drawBridge(x, y, false);
              cx.fillStyle = 'rgba(249,115,22,0.35)';
              cx.beginPath();
              cx.moveTo(x, y);
              cx.lineTo(x + TW / 2, y + TH / 2);
              cx.lineTo(x, y + TH);
              cx.lineTo(x - TW / 2, y + TH / 2);
              cx.closePath();
              cx.fill();
            } else {
              rnd.drawBridge(x, y, true);
            }
          } else if (t === TileType.BRIDGE_YELLOW) {
            rnd.drawBridge(x, y, false);
          }
        }
      }

      if (derrumbeActivoRef.current) {
      drawDerrumbe({ r: 18, c: 21 }, 1.8);
      }

      if (startTileRef.current) {
        const sx = rnd.isoX(startTileRef.current.r, startTileRef.current.c);
        const sy = rnd.isoY(startTileRef.current.r, startTileRef.current.c);

        cx.fillStyle = '#ef4444';
        cx.beginPath();
        cx.moveTo(sx, sy - 18);
        cx.lineTo(sx - 6, sy - 8);
        cx.lineTo(sx + 6, sy - 8);
        cx.closePath();
        cx.fill();

        cx.beginPath();
        cx.arc(sx, sy - 20, 4, 0, Math.PI * 2);
        cx.fill();

        cx.fillStyle = '#fff';
        cx.beginPath();
        cx.arc(sx, sy - 20, 1.5, 0, Math.PI * 2);
        cx.fill();
      }

      for (const f of fishArr) rnd.drawFish(f);
      for (const obj of mapData.objects) rnd.drawObject(obj, ws);

      for (const sh of smokeArr) {
        for (const p of sh.particles) rnd.drawSmoke(p);
      }

      if (front) drawConstructionSite(front);

      entities.sort((a, b) => a.curR + a.curC - (b.curR + b.curC));
      for (const e of entities) rnd.drawEntity(e);

      for (const b of birds) rnd.drawBird(b);
      for (const wp of weatherArr) rnd.drawWeatherP(wp);

      if (lluviaIntensaRef.current) {
        const overlayX = -ox / sc - 200;
        const overlayY = -oy / sc - 200;
        const overlayW = CW / sc + 600;
        const overlayH = CH / sc + 600;

        cx.fillStyle = 'rgba(18, 26, 40, 0.34)';
        cx.fillRect(overlayX, overlayY, overlayW, overlayH);

        cx.fillStyle = 'rgba(70, 110, 150, 0.12)';
        cx.fillRect(overlayX, overlayY, overlayW, overlayH);

        cx.fillStyle = 'rgba(210, 220, 230, 0.06)';
        cx.fillRect(overlayX, overlayY, overlayW, overlayH);

        cx.lineCap = 'round';

        for (let i = 0; i < rainDrops.length; i++) {
          const d = rainDrops[i];
          cx.strokeStyle = `rgba(220, 235, 255, ${d.alpha})`;
          cx.lineWidth = 1.6;
          cx.beginPath();
          cx.moveTo(d.x, d.y);
          cx.lineTo(d.x - d.drift * 1.9, d.y + d.len);
          cx.stroke();
        }
      }
      rnd.drawLightingOverlay();  // ← NUEVA LÍNEA (única que agregas)
      cx.restore();
      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      cv.removeEventListener('mousedown', onMD);
      cv.removeEventListener('click', onClick);
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
      cv.removeEventListener('wheel', onWH);
      cv.removeEventListener('touchstart', onTS);
      cv.removeEventListener('touchmove', onTM);
      cv.removeEventListener('touchend', onTE);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    />
  );
}