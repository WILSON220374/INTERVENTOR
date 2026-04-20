import { sn } from '../utils/seededRandom';
import { ObjectType } from '../types/mapTypes';
import type { DamageData, MapEntity, Fish, SmokeSource, Cloud, Bird, WeatherParticle, MapObject } from '../types/mapTypes';

const GC = ['#4cba2c','#47b226','#42a822','#4ec030','#45ae24','#50c432','#48b428','#43aa20'];
const PC = ['#3d9a1e','#3a921c','#378a1a','#409e20'];

export class IsometricRenderer {
  private cx: CanvasRenderingContext2D;
  private TW: number;
  private TH: number;
  public CW: number;
  public CH: number;
  private cols: number;
  private rows: number;

  constructor(cx: CanvasRenderingContext2D, cols: number, rows: number, tw: number, th: number) {
    this.cx = cx; this.TW = tw; this.TH = th; this.cols = cols; this.rows = rows;
    this.CW = (cols + rows) * tw / 2 + tw * 2;
    this.CH = (cols + rows) * th / 2 + th * 2 + 120;
  }

  isoX(r: number, c: number): number { return (c - r) * this.TW / 2 + this.CW / 2; }
  isoY(r: number, c: number): number { return (c + r) * this.TH / 2 + 80; }

  drawTile(x: number, y: number, col: string, shade: boolean): void {
    const c = this.cx, W = this.TW, H = this.TH;

    // --- Rombo con gradiente radial interno MÁS INTENSO ---
    const cx = x, cy = y + H / 2;
    const grad = c.createRadialGradient(cx, cy - H * 0.25, 0, cx, cy, W * 0.6);
    grad.addColorStop(0, this._shadeColor(col, 0.14));
    grad.addColorStop(0.7, col);
    grad.addColorStop(1, this._shadeColor(col, -0.14));

    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + W / 2, y + H / 2);
    c.lineTo(x, y + H);
    c.lineTo(x - W / 2, y + H / 2);
    c.closePath();
    c.fillStyle = grad;
    c.fill();

    // --- Sombra lateral inferior (tu lógica original, intacta) ---
    if (shade) {
      c.beginPath();
      c.moveTo(x, y + H);
      c.lineTo(x + W / 2, y + H / 2);
      c.lineTo(x + W / 2, y + H / 2 + 4);
      c.lineTo(x, y + H + 4);
      c.closePath();
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fill();
      c.beginPath();
      c.moveTo(x, y + H);
      c.lineTo(x - W / 2, y + H / 2);
      c.lineTo(x - W / 2, y + H / 2 + 4);
      c.lineTo(x, y + H + 4);
      c.closePath();
      c.fillStyle = 'rgba(0,0,0,0.06)';
      c.fill();
    }

    // --- SIN borde visible (principal cambio: rompe la grilla) ---
    // (no dibujamos stroke — el ojo ya no ve rejilla)

    // --- Motitas de hierba SIEMPRE (no filtramos por verde) ---
    if (this._isGreenish(col) || col.startsWith('#4') || col.startsWith('#5')) {
      this._drawGrassDots(x, y, W, H, col);
    }
  }

  // ============ HELPERS PRIVADOS (nuevos) ============

  private _shadeColor(hex: string, factor: number): string {
    // Aclara (factor > 0) u oscurece (factor < 0) un color hex
    if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const adj = (v: number) =>
      Math.max(0, Math.min(255, Math.round(v + v * factor)));
    return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
  }

  private _isGreenish(hex: string): boolean {
    if (!hex || hex[0] !== '#' || hex.length < 7) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return g > r + 15 && g > b + 15;
  }

  private _hash01(x: number, y: number): number {
    const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }

  private _drawGrassDots(x: number, y: number, W: number, H: number, col: string): void {
    const c = this.cx;
    const seed1 = this._hash01(x, y);
    const seed2 = this._hash01(x + 7.3, y - 3.1);
    const seed3 = this._hash01(x - 4.7, y + 9.2);
    const seed4 = this._hash01(x + 1.1, y + 5.5);
    const seed5 = this._hash01(x + 3.7, y - 6.2);
    const seed6 = this._hash01(x - 8.3, y + 2.7);

    const dots = [
      { t: seed1, u: seed2, s: 1.2 },
      { t: seed3, u: seed4, s: 0.9 },
      { t: (seed1 + seed3) * 0.5, u: (seed2 + seed4) * 0.5, s: 1.5 },
      { t: seed5, u: seed6, s: 0.7 },
      { t: (seed5 + seed1) * 0.5, u: (seed6 + seed2) * 0.5, s: 1.1 },
    ];

    c.save();
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const lx = (d.t - 0.5) * 0.8;
      const ly = (d.u - 0.5) * 0.8;
      const px = x + lx * W * 0.5;
      const py = y + H * 0.5 + ly * H * 0.5;
      const size = d.s + d.t * 0.6;
      const tone = d.u < 0.33
        ? this._shadeColor(col, -0.22)
        : d.u < 0.66
        ? this._shadeColor(col, 0.18)
        : this._shadeColor(col, -0.1);
      c.fillStyle = tone;
      c.globalAlpha = 0.5 + d.t * 0.3;
      c.beginPath();
      c.ellipse(px, py, size, size * 0.65, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    c.restore();
  }

private _mixColors(base: string, n1: string, n2: string, blend: number): string {
    const parse = (hex: string): [number, number, number] => {
      if (!hex || hex[0] !== '#' || hex.length < 7) {
        return [100, 180, 80] as [number, number, number];
      }
      return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
    };
    const [r1, g1, b1] = parse(base);
    const [r2, g2, b2] = parse(n1);
    const [r3, g3, b3] = parse(n2);
    const keep = 1 - blend * 2;
    const r = Math.round(r1 * keep + r2 * blend + r3 * blend);
    const g = Math.round(g1 * keep + g2 * blend + g3 * blend);
    const b = Math.round(b1 * keep + b2 * blend + b3 * blend);
    const hex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  // ============ ILUMINACIÓN GLOBAL (llamar al final del render) ============

  public drawLightingOverlay(): void {
    const c = this.cx;
    const W = this.CW;
    const H = this.CH;

    // Viñeta oscura en bordes
    const vg = c.createRadialGradient(
      W * 0.5, H * 0.45, Math.min(W, H) * 0.32,
      W * 0.5, H * 0.5, Math.max(W, H) * 0.7,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.32)');
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
    c.restore();

    // Luz cálida arriba-izquierda (sol)
    const sg = c.createRadialGradient(
      W * 0.2, H * 0.15, 0,
      W * 0.2, H * 0.15, Math.max(W, H) * 0.55,
    );
    sg.addColorStop(0, 'rgba(255, 232, 170, 0.14)');
    sg.addColorStop(1, 'rgba(255, 232, 170, 0)');
    c.save();
    c.globalCompositeOperation = 'screen';
    c.fillStyle = sg;
    c.fillRect(0, 0, W, H);
    c.restore();
  }

  drawGrass(x: number, y: number, r: number, col: number): void {
    const c = this.cx;

    // --- Opción A: Desplazamiento vertical sutil (rompe alineación) ---
    const el = sn(r * 17 + col * 23) * 0.5;
    const dy = 0;
    const dx = 0;

    // --- Opción B: Color mezclado con vecinos (transiciones suaves) ---
    const ci = (r * 3 + col * 7) % GC.length;
    const ciN = ((r - 1) * 3 + col * 7) % GC.length;
    const ciE = (r * 3 + (col + 1) * 7) % GC.length;
    const baseCol = GC[(ci + GC.length) % GC.length];
    const northCol = GC[(ciN + GC.length) % GC.length];
    const eastCol = GC[(ciE + GC.length) % GC.length];
    const mixedCol = this._mixColors(baseCol, northCol, eastCol, 0.15);

    // Dibuja el tile con color mezclado y desplazamiento
    this.drawTile(x + dx, y - el + dy, mixedCol, true);

    // --- Detalle floral ocasional (tu lógica original, intacta) ---
    if (sn(r * 41 + col * 59) > 0.92) {
      c.fillStyle = PC[(r + col) % PC.length];
      c.beginPath();
      c.ellipse(
        x + dx + sn(r * 7 + col) * 8 - 4,
        y - el + dy + this.TH / 2 - 2,
        5, 2, 0.3, 0, Math.PI * 2,
      );
      c.fill();
    }
  }

  drawRiver(x: number, y: number, r: number, c: number): void {
    const cx=this.cx, H=this.TH, t=Date.now()*0.001, cols=['#2494d0','#208cc8','#1c84bc','#2898d4'];
    this.drawTile(x,y,cols[(r+c)%4],true);
    cx.fillStyle='rgba(180,230,255,0.18)'; const s=Math.sin(t+r*0.5+c*0.3)*6;
    cx.beginPath(); cx.ellipse(x+s,y+H/2-2,10,2.5,0,0,Math.PI*2); cx.fill();
    cx.beginPath(); cx.ellipse(x-4+s*0.6,y+H/2+5,7,1.8,0,0,Math.PI*2); cx.fill();
  }

  drawDamagedRoad(x: number, y: number, r: number, c: number, damage: DamageData, ws: number): void {
    const cx = this.cx, H = this.TH, W = this.TW;

    // Asfalto gris con gradiente (tu lógica de variación por fila/col intacta)
    const asphaltColor = sn(r * 113 + c * 79) > 0.5 ? '#5a5a5a' : '#636363';
    this.drawTile(x, y, asphaltColor, true);

    // Textura de grava sutil (rompe la sensación plana)
    cx.save();
    cx.globalAlpha = 0.18;
    for (let i = 0; i < 5; i++) {
      const ang = sn(r * i * 7 + c * 3) * Math.PI * 2;
      const rad = 4 + sn(r + c * i) * 8;
      const gx = x + Math.cos(ang) * rad;
      const gy = y + H / 2 + Math.sin(ang) * rad * 0.5;
      cx.fillStyle = i % 2 === 0 ? '#3a3a3a' : '#7a7a7a';
      cx.beginPath();
      cx.arc(gx, gy, 0.7 + sn(r * i + c) * 0.6, 0, Math.PI * 2);
      cx.fill();
    }
    cx.restore();

    // === Lógica de daños original, INTACTA ===
    const dmg = damage[`${r},${c}`] || [];
    for (const d of dmg) {
      if (d === 'pothole') {
        const px = x + (sn(r * 7 + c * 3) - 0.5) * 16, py = y + H / 2 + (sn(r * 3 + c * 7) - 0.5) * 8, pr = 3 + sn(r * 11 + c * 13) * 4;
        cx.fillStyle = '#3a3a3a'; cx.beginPath(); cx.ellipse(px, py, pr, pr * 0.55, 0.2, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#2a2a2a'; cx.beginPath(); cx.ellipse(px, py + 1, pr * 0.7, pr * 0.35, 0.2, 0, Math.PI * 2); cx.fill();
      }
      if (d === 'crack') {
        cx.strokeStyle = '#3a3a3a'; cx.lineWidth = 1.2; cx.beginPath();
        let x1 = x - 10 + sn(r * 17 + c) * 8, y1 = y + H / 2 - 6 + sn(r + c * 19) * 4;
        cx.moveTo(x1, y1);
        for (let k = 0; k < 4; k++) { x1 += 4 + sn(r * k + c) * 5; y1 += (sn(r + c * k + 7) - 0.5) * 6; cx.lineTo(x1, y1); }
        cx.stroke();
      }
      if (d === 'patch') {
        const px = x + (sn(r * 23 + c * 17) - 0.5) * 12, py = y + H / 2 + (sn(r * 19 + c * 11) - 0.5) * 6;
        cx.fillStyle = '#4e4e4e'; cx.beginPath(); cx.ellipse(px, py, 6 + sn(r + c) * 3, 3 + sn(r * c) * 2, sn(r * 7) * 0.5, 0, Math.PI * 2); cx.fill();
      }
      if (d === 'rubble') {
        for (let b = 0; b < 4; b++) {
          const rx = x + (sn(r * b * 7 + c) - 0.5) * 20, ry = y + H / 2 + (sn(r + c * b * 5) - 0.5) * 10, rs = 1 + sn(r * b + c * 3) * 2;
          cx.fillStyle = sn(r * b + c) > 0.5 ? '#7a7a7a' : '#888';
          cx.beginPath(); cx.arc(rx, ry, rs, 0, Math.PI * 2); cx.fill();
        }
      }
      if (d === 'weed') {
        const wx = x + (sn(r * 31 + c * 41) - 0.5) * 14, wy = y + H / 2 + (sn(r * 43 + c * 31) - 0.5) * 6, wt = Date.now() * 0.001;
        for (let w = 0; w < 3; w++) {
          const wa = -0.4 + w * 0.4 + Math.sin(wt + w) * 0.15 * ws;
          cx.strokeStyle = '#4a7a22'; cx.lineWidth = 1.2; cx.beginPath();
          cx.moveTo(wx, wy);
          cx.quadraticCurveTo(wx + Math.sin(wa) * 4, wy - 5, wx + Math.sin(wa) * 3, wy - 7 - sn(r * w + c) * 3);
          cx.stroke();
        }
      }
    }
    if (sn(r * 67 + c * 89) < 0.35) {
      cx.fillStyle = '#4a7a22';
      const side = sn(r * 43 + c * 67) > 0.5 ? 1 : -1;
      cx.beginPath(); cx.arc(x + side * (W / 2 - 5), y + H / 2, 3, 0, Math.PI * 2); cx.fill();
    }
  }

  drawYellowRoad(x: number, y: number): void {
    const W = this.TW, H = this.TH, c = this.cx;

    // Asfalto amarillo con gradiente (volumen)
    this.drawTile(x, y, '#c9a020', true);

    // Textura de grava (puntos dispersos, semilla fija por posición)
    const h1 = Math.abs(Math.sin(x * 12.9 + y * 78.2)) % 1;
    const h2 = Math.abs(Math.sin(x * 43.1 + y * 21.7)) % 1;
    const h3 = Math.abs(Math.sin(x * 91.4 + y * 55.6)) % 1;
    c.save();
    c.globalAlpha = 0.25;
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + h1 * 2;
      const rad = 3 + h2 * 8;
      const gx = x + Math.cos(ang) * rad;
      const gy = y + H / 2 + Math.sin(ang) * rad * 0.5;
      c.fillStyle = i % 2 === 0 ? '#8a6a18' : '#a88420';
      c.beginPath();
      c.arc(gx, gy, 0.8 + h3 * 0.7, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // Brillo lateral sutil (ya estaba en tu versión, lo suavizo)
    c.fillStyle = 'rgba(255,255,200,0.08)';
    c.beginPath();
    c.moveTo(x - 2, y + 2);
    c.lineTo(x + W / 4 - 2, y + H / 2 + 2);
    c.lineTo(x - 2, y + H + 2);
    c.lineTo(x - W / 4 - 2, y + H / 2 + 2);
    c.closePath();
    c.fill();
  }

  drawBridge(x: number, y: number, gray: boolean): void {
    const c = this.cx, W = this.TW, H = this.TH, t = Date.now() * 0.001;

    // Agua de fondo con gradiente (en lugar del azul plano)
    const waterGrad = c.createLinearGradient(x, y, x, y + H);
    waterGrad.addColorStop(0, '#3aa5d8');
    waterGrad.addColorStop(0.5, '#2090c4');
    waterGrad.addColorStop(1, '#156a9a');
    c.fillStyle = waterGrad;
    c.beginPath();
    c.moveTo(x, y + 2);
    c.lineTo(x + W / 2, y + H / 2 + 2);
    c.lineTo(x, y + H + 2);
    c.lineTo(x - W / 2, y + H / 2 + 2);
    c.closePath();
    c.fill();

    // Reflejos animados en el agua
    c.fillStyle = 'rgba(180,230,255,0.25)';
    const s = Math.sin(t + x * 0.01) * 4;
    c.beginPath(); c.ellipse(x + s - 12, y + H / 2 + 2, 6, 1.5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(x + s + 12, y + H / 2 + 2, 5, 1.5, 0, 0, Math.PI * 2); c.fill();

    // Sombra proyectada del puente sobre el agua
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath();
    c.moveTo(x, y + 2);
    c.lineTo(x + W / 2 - 2, y + H / 2 + 4);
    c.lineTo(x, y + H + 6);
    c.lineTo(x - W / 2 + 2, y + H / 2 + 4);
    c.closePath();
    c.fill();

    // Tablero del puente (ahora más arriba para dar sensación de altura)
    this.drawTile(x, y - 3, gray ? '#5a5a5a' : '#c9a020', true);

    // Detalle superficial
    if (gray) {
      c.fillStyle = '#3e3e3e';
      c.beginPath(); c.ellipse(x - 5, y + H / 2 - 3, 4, 2, 0.3, 0, Math.PI * 2); c.fill();
    } else {
      c.fillStyle = 'rgba(255,255,200,0.12)';
      c.beginPath();
      c.moveTo(x - 2, y - 1);
      c.lineTo(x + W / 4 - 2, y + H / 2 - 1);
      c.lineTo(x - 2, y + H - 1);
      c.lineTo(x - W / 4 - 2, y + H / 2 - 1);
      c.closePath();
      c.fill();
    }

    // Barandilla superior con grosor
    c.strokeStyle = gray ? '#888' : '#d4a83a';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x - W / 2 + 4, y + H / 2 - 3);
    c.lineTo(x - 2, y - 3);
    c.lineTo(x + W / 2 - 4, y + H / 2 - 3);
    c.stroke();

    // Pilotes del puente (nuevo: 2 líneas verticales cortas dan volumen)
    c.strokeStyle = gray ? '#444' : '#8a6a18';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x - W / 3, y + H / 2);
    c.lineTo(x - W / 3, y + H / 2 + 6);
    c.moveTo(x + W / 3, y + H / 2);
    c.lineTo(x + W / 3, y + H / 2 + 6);
    c.stroke();
  }

  drawHouse(x: number, y: number, v: number): void {
    const c=this.cx, bw=v===0?18:v===1?22:16, bh=v===0?13:v===1?16:11;
    c.fillStyle='rgba(0,0,0,0.1)'; c.beginPath(); c.ellipse(x+2,y+6,bw*0.7,4,0,0,Math.PI*2); c.fill();
    c.fillStyle=v===0?'#a88966':v===1?'#c4a882':'#8b7355'; c.fillRect(x-bw/2,y-bh+4,bw,bh);
    c.fillStyle='rgba(0,0,0,0.08)'; c.fillRect(x,y-bh+4,bw/2,bh);
    c.fillStyle=v===1?'#6d5a42':'#7a6548'; c.fillRect(x-bw/2,y+1,bw,3);
    c.beginPath(); c.moveTo(x-bw/2-4,y-bh+4); c.lineTo(x,y-bh-10-(v===1?4:0)); c.lineTo(x+bw/2+4,y-bh+4); c.closePath();
    c.fillStyle=v===2?'#8B4513':'#c0392b'; c.fill();
    c.fillStyle='rgba(0,0,0,0.08)'; c.beginPath(); c.moveTo(x,y-bh-10-(v===1?4:0)); c.lineTo(x+bw/2+4,y-bh+4); c.lineTo(x,y-bh+4); c.closePath(); c.fill();
    c.fillStyle='#f5e6a0';
    if(v!==2){c.fillRect(x-4,y-bh+7,4,5);c.fillRect(x+2,y-bh+7,4,5);}else c.fillRect(x-2,y-bh+7,4,5);
    c.fillStyle='#5D4037'; c.fillRect(x-1.5,y-2,3,6);
  }

  drawTree(x: number, y: number, v: number, wp: number, ws: number): void {
    const c=this.cx, t=Date.now()*0.001, sw=Math.sin(t*1.2+wp)*2.5*ws;
    c.fillStyle='rgba(0,0,0,0.08)'; c.beginPath(); c.ellipse(x+1,y+5,7,3,0,0,Math.PI*2); c.fill();
    c.fillStyle='#5D4037'; c.fillRect(x-1.5,y-3,3,11);
    c.save(); c.translate(x,y-3); c.rotate(sw*0.015);
    if(v===0){c.fillStyle='#2E7D32';c.beginPath();c.moveTo(0,-19);c.lineTo(11,0);c.lineTo(-11,0);c.closePath();c.fill();c.fillStyle='#388E3C';c.beginPath();c.moveTo(0,-25);c.lineTo(8,-9);c.lineTo(-8,-9);c.closePath();c.fill();}
    else if(v===1){c.fillStyle='#2E7D32';c.beginPath();c.arc(0,-9,10,0,Math.PI*2);c.fill();c.fillStyle='#1B5E20';c.beginPath();c.arc(4,-11,7,0,Math.PI*2);c.fill();}
    else{c.fillStyle='#33691E';c.beginPath();c.moveTo(0,-15);c.lineTo(8,0);c.lineTo(-8,0);c.closePath();c.fill();c.fillStyle='#43A047';c.beginPath();c.moveTo(0,-21);c.lineTo(6,-7);c.lineTo(-6,-7);c.closePath();c.fill();c.fillStyle='#66BB6A';c.beginPath();c.moveTo(0,-25);c.lineTo(4,-15);c.lineTo(-4,-15);c.closePath();c.fill();}
    c.restore();
  }

  drawBush(x: number, y: number, ws: number): void {
    const c=this.cx, t=Date.now()*0.001, sw=Math.sin(t*1.5+x*0.1)*0.8*ws;
    c.fillStyle='#2E7D32';c.beginPath();c.arc(x+sw,y-2,5,0,Math.PI*2);c.fill();
    c.fillStyle='#388E3C';c.beginPath();c.arc(x+3+sw,y-4,4,0,Math.PI*2);c.fill();
    c.fillStyle='#43A047';c.beginPath();c.arc(x-2+sw,y-4,3.5,0,Math.PI*2);c.fill();
  }

  drawFlower(x: number, y: number, ws: number): void {
    const c=this.cx, t=Date.now()*0.001, sw=Math.sin(t*1.5+x*0.1)*1.5*ws;
    c.fillStyle='#4CAF50';c.fillRect(x-0.5+sw*0.3,y-4,1,6);
    const cols=['#E53935','#FF7043','#FFB300','#AB47BC'];
    c.fillStyle=cols[Math.floor(sn(x*7+y*3)*4)];
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;c.beginPath();c.arc(x+Math.cos(a)*2.5+sw,y-6+Math.sin(a)*2.5,1.8,0,Math.PI*2);c.fill();}
    c.fillStyle='#FFF176';c.beginPath();c.arc(x+sw,y-6,1.5,0,Math.PI*2);c.fill();
  }

  drawObject(obj: MapObject, ws: number): void {
    const x=this.isoX(obj.gridY,obj.gridX), y=this.isoY(obj.gridY,obj.gridX), el=sn(obj.gridY*17+obj.gridX*23)*0.5;
    switch(obj.type){
      case ObjectType.HOUSE_SMALL: case ObjectType.HOUSE_MEDIUM: case ObjectType.HOUSE_LARGE: this.drawHouse(x,y-el,obj.variant??0); break;
      case ObjectType.TREE_LARGE: case ObjectType.TREE_PINE: case ObjectType.TREE_SMALL: this.drawTree(x,y-el,obj.variant??0,obj.windPhase??0,ws); break;
      case ObjectType.BUSH: this.drawBush(x,y-el,ws); break;
      case ObjectType.FLOWER: this.drawFlower(x,y-el,ws); break;
    }
  }

  drawPerson(x: number, y: number, v: number, e: MapEntity): void {
    const c=this.cx, sh=['#1565C0','#C62828','#6A1B9A','#00838F'], pa=['#37474F','#4E342E','#263238','#1B5E20'], bob=Math.sin(e.bobPhase)*1.2;
    c.save();c.translate(x,y);if(e.flipX<0)c.scale(-1,1);
    c.fillStyle='rgba(0,0,0,0.08)';c.beginPath();c.ellipse(0,4,5,2,0,0,Math.PI*2);c.fill();
    c.fillStyle=pa[v||0];c.fillRect(-3,-3+bob,2.5,6);
    c.save();c.translate(0.5,-3+bob);c.rotate(Math.sin(e.legPhase)*0.15);c.fillRect(0,0,2.5,6);c.restore();
    c.fillStyle='#5D4037';c.fillRect(-3,3+bob,3,2);c.fillRect(0,3+bob+Math.sin(e.legPhase)*0.8,3,2);
    c.fillStyle=sh[v||0];c.fillRect(-3,-10+bob,6,7);
    c.save();c.translate(-4,-8+bob);c.rotate(Math.sin(e.legPhase)*0.3);c.fillRect(0,0,2,5);c.restore();
    c.save();c.translate(3,-8+bob);c.rotate(-Math.sin(e.legPhase)*0.3);c.fillRect(0,0,2,5);c.restore();
    c.fillStyle='#FFCCBC';c.beginPath();c.arc(0,-13+bob,3,0,Math.PI*2);c.fill();
    c.fillStyle='#4E342E';c.beginPath();c.arc(0,-14.5+bob,3.2,Math.PI+0.3,Math.PI*2-0.3);c.fill();
    c.restore();
  }

  drawCow(x: number, y: number, v: number, e: MapEntity): void {
    const c=this.cx, bob=Math.sin(e.bobPhase*0.7)*0.6, la=Math.sin(e.legPhase)*2, ts=Math.sin(e.bobPhase*2)*0.4;
    c.save();c.translate(x,y);if(e.flipX<0)c.scale(-1,1);
    c.fillStyle='rgba(0,0,0,0.06)';c.beginPath();c.ellipse(0,4,10,4,0,0,Math.PI*2);c.fill();
    c.fillStyle=v===0?'#E0E0E0':'#795548';
    c.fillRect(-7,1+la*0.3,2,5);c.fillRect(-3,1-la*0.3,2,5);c.fillRect(3,1+la*0.3,2,5);c.fillRect(7,1-la*0.3,2,5);
    c.fillStyle=v===0?'#F5F5F5':'#8D6E63';c.beginPath();c.ellipse(0,-4+bob,10,6,0,0,Math.PI*2);c.fill();
    if(v===0){c.fillStyle='#4E342E';c.beginPath();c.ellipse(-4,-5+bob,3,4,0.3,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(5,-2+bob,4,3,-0.2,0,Math.PI*2);c.fill();}
    c.strokeStyle=v===0?'#BDBDBD':'#6D4C41';c.lineWidth=1.5;c.beginPath();c.moveTo(-9,-2+bob);c.quadraticCurveTo(-14+Math.sin(ts)*3,-5+bob,-12,-7+bob);c.stroke();
    c.fillStyle=v===0?'#EFEBE9':'#6D4C41';c.beginPath();c.ellipse(10,-5+bob,4,3.5,0,0,Math.PI*2);c.fill();
    c.fillStyle='#FFCCBC';c.beginPath();c.ellipse(12,-3+bob,2.5,2,0,0,Math.PI*2);c.fill();
    c.fillStyle='#333';c.beginPath();c.arc(12,-5+bob,0.8,0,Math.PI*2);c.fill();
    c.fillStyle='#795548';c.beginPath();c.moveTo(9,-8+bob);c.lineTo(7,-12+bob);c.lineTo(9,-10+bob);c.fill();
    c.beginPath();c.moveTo(11,-8+bob);c.lineTo(13,-12+bob);c.lineTo(11,-10+bob);c.fill();
    c.restore();
  }

  drawSheep(x: number, y: number, e: MapEntity): void {
    const c=this.cx, bob=Math.sin(e.bobPhase*0.6)*0.5, la=Math.sin(e.legPhase)*1.5;
    c.save();c.translate(x,y);if(e.flipX<0)c.scale(-1,1);
    c.fillStyle='#424242';c.fillRect(-4,la*0.2,1.5,4);c.fillRect(-1,-la*0.2,1.5,4);c.fillRect(2,la*0.2,1.5,4);c.fillRect(5,-la*0.2,1.5,4);
    c.fillStyle='#FAFAFA';
    c.beginPath();c.arc(-2,-4+bob,4,0,Math.PI*2);c.fill();c.beginPath();c.arc(2,-3+bob,4,0,Math.PI*2);c.fill();
    c.beginPath();c.arc(0,-6+bob,4.5,0,Math.PI*2);c.fill();
    c.fillStyle='#212121';c.beginPath();c.ellipse(6,-4+bob,3,2.5,0,0,Math.PI*2);c.fill();
    c.fillStyle='#333';c.beginPath();c.arc(7.5,-4.5+bob,0.7,0,Math.PI*2);c.fill();
    c.restore();
  }

  drawDog(x: number, y: number, v: number, e: MapEntity): void {
    const c=this.cx, bob=Math.sin(e.bobPhase)*0.8, la=Math.sin(e.legPhase)*2.5, tw=Math.sin(e.bobPhase*4)*0.6, bc=v===0?'#8D6E63':'#F9A825';
    c.save();c.translate(x,y);if(e.flipX<0)c.scale(-1,1);
    c.fillStyle=bc;c.fillRect(-5,1+la*0.3,2,4);c.fillRect(-2,1-la*0.3,2,4);c.fillRect(2,1+la*0.3,2,4);c.fillRect(5,1-la*0.3,2,4);
    c.beginPath();c.ellipse(0,-2+bob,7,4,0,0,Math.PI*2);c.fill();
    c.fillStyle=v===0?'#5D4037':'#E65100';c.beginPath();c.moveTo(-7,-1+bob);c.quadraticCurveTo(-12+Math.sin(tw)*4,-4+bob,-10+Math.sin(tw)*3,-7+bob);c.lineTo(-7,-2+bob);c.fill();
    c.fillStyle=bc;c.beginPath();c.ellipse(7,-4+bob,3.5,3,0,0,Math.PI*2);c.fill();
    c.fillStyle='#333';c.beginPath();c.arc(9,-4.5+bob,0.8,0,Math.PI*2);c.fill();
    c.fillStyle=v===0?'#6D4C41':'#F57F17';
    c.beginPath();c.moveTo(7,-7+bob);c.lineTo(5,-11+bob);c.lineTo(9,-7+bob);c.fill();
    c.beginPath();c.moveTo(9,-7+bob);c.lineTo(11,-11+bob);c.lineTo(11,-7+bob);c.fill();
    c.restore();
  }

  drawChicken(x: number, y: number, e: MapEntity): void {
    const c=this.cx, bob=Math.sin(e.bobPhase*2)*1, hb=Math.sin(e.bobPhase*3)*2;
    c.save();c.translate(x,y);if(e.flipX<0)c.scale(-1,1);
    c.fillStyle='#FF8F00';c.fillRect(-1.5,1,1.5,3);c.fillRect(1,1,1.5,3);
    c.fillStyle='#F5F5F5';c.beginPath();c.ellipse(0,-2+bob,4,3.5,0,0,Math.PI*2);c.fill();
    c.fillStyle='#FAFAFA';c.beginPath();c.ellipse(3+hb*0.3,-5+bob,2.5,2.5,0,0,Math.PI*2);c.fill();
    c.fillStyle='#E53935';c.beginPath();c.arc(3+hb*0.3,-7.5+bob,1.2,0,Math.PI*2);c.fill();
    c.fillStyle='#FF8F00';c.beginPath();c.moveTo(5+hb*0.3,-5+bob);c.lineTo(7.5+hb*0.5,-4.5+bob);c.lineTo(5+hb*0.3,-4+bob);c.fill();
    c.fillStyle='#333';c.beginPath();c.arc(4+hb*0.3,-5.5+bob,0.5,0,Math.PI*2);c.fill();
    c.restore();
  }

  drawHorse(x: number, y: number, v: number, e: MapEntity): void {
    const c=this.cx, bob=Math.sin(e.bobPhase*0.8)*0.8, ts=Math.sin(e.bobPhase*1.5)*0.4, bc=v===0?'#6D4C41':'#3E2723';
    c.save();c.translate(x,y);if(e.flipX<0)c.scale(-1,1);
    c.fillStyle='rgba(0,0,0,0.06)';c.beginPath();c.ellipse(0,5,10,4,0,0,Math.PI*2);c.fill();
    c.fillStyle=bc;
    c.save();c.translate(-8,2);c.rotate(Math.sin(e.legPhase)*0.15);c.fillRect(0,0,2.5,6);c.restore();
    c.save();c.translate(-4,2);c.rotate(-Math.sin(e.legPhase)*0.15);c.fillRect(0,0,2.5,6);c.restore();
    c.save();c.translate(4,2);c.rotate(Math.sin(e.legPhase+0.5)*0.15);c.fillRect(0,0,2.5,6);c.restore();
    c.save();c.translate(8,2);c.rotate(-Math.sin(e.legPhase+0.5)*0.15);c.fillRect(0,0,2.5,6);c.restore();
    c.fillStyle='#212121';c.fillRect(-8,7,3,2);c.fillRect(-4,7,3,2);c.fillRect(4,7,3,2);c.fillRect(8,7,3,2);
    c.fillStyle=bc;c.beginPath();c.ellipse(0,-3+bob,11,6,0,0,Math.PI*2);c.fill();
    c.fillStyle=v===0?'#4E342E':'#1B1B1B';
    c.beginPath();c.moveTo(-9,-2+bob);c.quadraticCurveTo(-14+Math.sin(ts)*4,2+bob,-12+Math.sin(ts)*3,6+bob);c.lineTo(-10+Math.sin(ts)*2,4+bob);c.quadraticCurveTo(-11,0+bob,-8,-1+bob);c.fill();
    c.fillStyle=bc;c.beginPath();c.ellipse(10,-8+bob,4,5,-0.3,0,Math.PI*2);c.fill();
    c.fillStyle='#333';c.beginPath();c.arc(12,-9+bob,0.9,0,Math.PI*2);c.fill();
    c.fillStyle=v===0?'#5D4037':'#212121';
    c.beginPath();c.moveTo(10,-13+bob);c.quadraticCurveTo(7,-17+bob,9,-18+bob);c.lineTo(11,-13+bob);c.fill();
    c.fillStyle='#FFCCBC';c.beginPath();c.ellipse(12.5,-5.5+bob,1.8,1.2,0,0,Math.PI*2);c.fill();
    c.restore();
  }

  drawEntity(e: MapEntity): void {
    const ex=this.isoX(e.curR,e.curC), ey=this.isoY(e.curR,e.curC), el=sn(Math.round(e.curR)*17+Math.round(e.curC)*23)*0.5;
    switch(e.type){
      case 'person':this.drawPerson(ex,ey-el,e.variant,e);break;
      case 'cow':this.drawCow(ex,ey-el,e.variant,e);break;
      case 'sheep':this.drawSheep(ex,ey-el,e);break;
      case 'dog':this.drawDog(ex,ey-el,e.variant,e);break;
      case 'chicken':this.drawChicken(ex,ey-el,e);break;
      case 'horse':this.drawHorse(ex,ey-el,e.variant,e);break;
    }
  }

  drawCloud(cl: Cloud): void {
    const c=this.cx; c.fillStyle=`rgba(255,255,255,${cl.opacity})`;
    c.beginPath();c.ellipse(cl.x,cl.y,cl.w/2,cl.h/2,0,0,Math.PI*2);c.fill();
    c.beginPath();c.ellipse(cl.x-cl.w*0.25,cl.y+3,cl.w*0.35,cl.h*0.4,0,0,Math.PI*2);c.fill();
    c.beginPath();c.ellipse(cl.x+cl.w*0.3,cl.y+2,cl.w*0.3,cl.h*0.35,0,0,Math.PI*2);c.fill();
  }

  drawBird(b: Bird): void {
    const c=this.cx, wy=Math.sin(b.wingPhase)*4;
    c.strokeStyle='rgba(40,40,40,0.5)';c.lineWidth=1.2;c.beginPath();
    c.moveTo(b.x-b.size*2,b.y+wy);c.quadraticCurveTo(b.x-b.size*0.5,b.y-Math.abs(wy)*0.5,b.x,b.y);
    c.quadraticCurveTo(b.x+b.size*0.5,b.y-Math.abs(wy)*0.5,b.x+b.size*2,b.y+wy);c.stroke();
  }

  drawFish(f: Fish): void {
    const c=this.cx, H=this.TH, x=this.isoX(f.r,f.c)+f.offX+Math.sin(f.phase)*8*f.dir, y=this.isoY(f.r,f.c)+H/2+f.offY;
    c.fillStyle='rgba(200,230,255,0.5)';c.save();c.translate(x,y);if(f.dir<0)c.scale(-1,1);
    c.beginPath();c.ellipse(0,0,f.size,f.size*0.45,0,0,Math.PI*2);c.fill();
    c.beginPath();c.moveTo(-f.size,0);c.lineTo(-f.size-3,-2);c.lineTo(-f.size-3,2);c.closePath();c.fill();
    c.restore();
  }

  drawSmoke(p: {x:number;y:number;life:number;size:number}): void {
    this.cx.fillStyle=`rgba(180,180,180,${(p.life*0.35).toFixed(3)})`;
    this.cx.beginPath();this.cx.arc(p.x,p.y,p.size,0,Math.PI*2);this.cx.fill();
  }

  drawWeatherP(wp: WeatherParticle): void {
    const c=this.cx;c.save();c.translate(wp.x,wp.y);c.rotate(wp.rot);
    if(wp.type==='leaf'){c.fillStyle=wp.color;c.beginPath();c.ellipse(0,0,wp.size,wp.size*0.4,0,0,Math.PI*2);c.fill();}
    else{c.fillStyle='rgba(180,160,120,0.3)';c.beginPath();c.arc(0,0,wp.size*0.5,0,Math.PI*2);c.fill();}
    c.restore();
  }
}
