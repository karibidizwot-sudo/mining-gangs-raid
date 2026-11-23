'use strict';

/* ======================= ЖИЗНЬ ГОРОДА ====================================
   Главное отличие FoE от «доски с домиками» — на экране всё время что-то
   движется: люди ходят по улицам, машины едут, из труб идёт дым, флаги
   полощутся. Дома при этом статичны. Здесь ровно это: статика лежит в
   офф-скрине, а каждый кадр поверх рисуется только движение.               */
const PEDS = [], TRAFFIC = [], CHIMNEYS = [];
/* Просьба (13.08, пятый заход): у ЦЕНТРа своя, бо́льшая сетка (см. genCity
   выше) — эту функцию раньше вызывали один раз при загрузке страницы, теперь
   она вызывается заново при каждом переключении города (см. switchCityVariant),
   иначе прохожие и машины остались бы бродить по старым, уже не существующим
   полосам маленького города. Количество прохожих/машин масштабируется по
   числу полос, чтобы плотность улиц не «размазывалась» на большей сетке.    */
function buildLife() {
  PEDS.length = 0; TRAFFIC.length = 0; CHIMNEYS.length = 0;
  const R = (() => { let s = 4242; return () => (s = s * 16807 % 2147483647) / 2147483647; })();
  const LANES = [];                       // дорожные полосы: между кварталами
  for (let k = 0; k <= BLOCKS; k++) {
    const t = k * (BS + GAP);
    LANES.push({ dir: 'i', c: t }, { dir: 'j', c: t });
  }
  const density = LANES.length / 10;      // 10 полос — плотность по умолчанию (BLOCKS=4)
  for (let k = 0; k < Math.round(90 * density); k++) {          // прохожие
    const l = LANES[(R() * LANES.length) | 0];
    PEDS.push({ lane: l, t: R() * SIDE, v: (.18 + R() * .3) * (R() < .5 ? 1 : -1),
                ph: R() * 7, warm: R() < .5 });
  }
  for (let k = 0; k < Math.round(16 * density); k++) {          // редкий трафик: дороги остаются читаемыми
    const l = LANES[(R() * LANES.length) | 0];
    TRAFFIC.push({ lane: l, t: R() * SIDE, v: (.9 + R() * .8) * (R() < .5 ? 1 : -1),
                   variant: (R() * 8) | 0,
                   col: ['#2e3a5c', '#3d2f2a', '#26404a', '#555f7a'][(R() * 4) | 0] });
  }
  for (const b of builds) {               // трубы: над гаражами и жилыми
    if (b.kind !== 'garage' && b.kind !== 'apart') continue;
    if (b.seed > .45) continue;
    CHIMNEYS.push({ i: b.i, j: b.j, h: b.h, ph: b.seed * 7, warm: b.kind === 'apart' });
  }
}
buildLife();

function lanePos(l, t) {                  // точка на полосе -> тайловые координаты
  return l.dir === 'i' ? [t, l.c] : [l.c, t];
}

/* Generated vehicle sprites face along the positive i-axis (screen
   down-right).  Roads use both isometric axes and each car can travel in
   either direction, so draw around its centre and transform the sprite to
   the actual heading.  This avoids the old "sliding sideways" effect. */
function sprVehicle(c, im, x, y, w, lane, velocity, a = 1) {
  if (!im) return false;
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  if (!iw || !ih) return false;
  const h = w * ih / iw;
  const forward = velocity >= 0;
  c.save();
  c.globalAlpha *= a;
  c.translate(x, y - h / 2);
  if (lane.dir === 'i') {
    if (!forward) c.rotate(Math.PI);          // up-left
  } else if (forward) {
    c.scale(-1, 1);                           // down-left
  } else {
    c.scale(1, -1);                           // up-right
  }
  c.drawImage(im, -w / 2, -h / 2, w, h);
  c.restore();
  return true;
}

function vehicleHeading(lane, velocity) {
  const forward = velocity >= 0 ? 1 : -1;
  return lane.dir === 'i' ? { x: forward, y: forward * .5 }
    : { x: -forward, y: forward * .5 };
}

function drawLife(ox, oy) {
  const dt = 1 / 60;
  /* --- дым из труб: медленные редкие клубы --- */
  for (const ch of CHIMNEYS) {
    const [x0, y0] = iso(ch.i, ch.j);
    const bx = x0 + ox, by = y0 + oy - ch.h - 4;
    for (let k = 0; k < 3; k++) {
      const life = ((T * .22 + ch.ph + k * .33) % 1);
      const yy = by - life * 34;
      const rr = 2.6 + life * 7;
      CX.globalAlpha = (1 - life) * .16;
      CX.fillStyle = ch.warm ? '#c9c2b4' : '#9aa3c4';
      CX.beginPath(); CX.arc(bx + Math.sin(life * 4 + ch.ph) * 5, yy, rr, 0, 7); CX.fill();
    }
  }
  CX.globalAlpha = 1;

  /* --- прохожие: точка с тенью и лёгким покачиванием --- */
  for (const p of PEDS) {
    p.t += p.v * dt;
    if (p.t > SIDE) p.t = -1; if (p.t < -1) p.t = SIDE;
    const [ti, tj] = lanePos(p.lane, p.t);
    const [x0, y0] = iso(ti, tj);
    const x = x0 + ox, y = y0 + oy + Math.sin(T * 6 + p.ph) * .6;
    CX.globalAlpha = .35; CX.fillStyle = '#000';
    CX.beginPath(); CX.ellipse(x, y + 1, 2.6, 1.2, 0, 0, 7); CX.fill();
    CX.globalAlpha = 1;
    CX.globalAlpha = .8;
    CX.fillStyle = p.warm ? '#4a5570' : '#3f4966';
    CX.fillRect(x - .9, y - 4, 1.8, 3.2);
    CX.fillStyle = '#8d7461';
    CX.fillRect(x - .8, y - 5.2, 1.6, 1.3);
    CX.globalAlpha = 1;
  }

  /* --- трафик: машина с фарами и отражением на асфальте --- */
  for (const c2 of TRAFFIC) {
    c2.t += c2.v * dt;
    if (c2.t > SIDE) c2.t = -1; if (c2.t < -1) c2.t = SIDE;
    const [ti, tj] = lanePos(c2.lane, c2.t);
    const [x0, y0] = iso(ti, tj);
    const x = x0 + ox, y = y0 + oy;
    CX.globalAlpha = .32; CX.fillStyle = '#000';
    CX.beginPath(); CX.ellipse(x + 1, y + 2, 8, 3, 0, 0, 7); CX.fill();
    CX.globalAlpha = 1;
    const carSprites = [ART.pCarClean0, ART.pCarClean1, ART.pCarClean2,
      ART.pCarClean3, ART.pCarClean4, ART.pCarClean5, ART.pCarClean6,
      ART.pCarClean7].filter(Boolean);
    const vehicleSprite = carSprites[c2.variant % carSprites.length] || ART.pCarClean0;
    const vehicleWidth = c2.variant >= 6 ? 25 : c2.variant === 5 ? 23 : c2.variant >= 3 ? 21 : 19;
    if (!sprVehicle(CX, vehicleSprite, x, y + 3, vehicleWidth, c2.lane, c2.v, .95)) {
      drawRoadCar(CX, x, y - 2, c2.col, c2.lane.dir === 'i' ? 1 : -1, .92);
    }
    const heading = vehicleHeading(c2.lane, c2.v);
    CX.globalAlpha = .5;
    CX.drawImage(G_HEAD, x + heading.x * 8 - 9, y + heading.y * 8 - 9, 18, 18);
    CX.globalAlpha = 1;
  }

  /* --- вытяжки на крышах гаражей: лопасти крутятся --- */
  for (const f of roofFans) {
    CX.save();
    CX.translate(f.x, f.y); CX.scale(1, .5); CX.rotate(T * 2.2 + f.ph);
    CX.strokeStyle = 'rgba(150,165,220,.32)'; CX.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const a = k * 2.094;
      CX.beginPath(); CX.moveTo(0, 0); CX.lineTo(Math.cos(a) * f.r, Math.sin(a) * f.r); CX.stroke();
    }
    CX.restore();
  }
  /* --- маяки на высотках --- */
  for (const bc of cityBeacons) {
    if (Math.sin(T * 2 + bc.ph) < .3) continue;
    CX.globalAlpha = .9;
    CX.drawImage(G_HEAD, bc.x - 9, bc.y - 9, 18, 18);
    CX.fillStyle = '#ff5d6c';
    CX.fillRect(bc.x - 1, bc.y - 1, 2, 2);
    CX.globalAlpha = 1;
  }
  /* --- неоновые вывески: дышат --- */
  for (const sg of neonSigns) {
    const k = .55 + .45 * Math.sin(T * 1.7 + sg.ph);
    CX.save();
    CX.globalAlpha = .25 + .35 * k;
    CX.shadowColor = sg.c; CX.shadowBlur = 8 * k;
    CX.fillStyle = sg.c;
    CX.fillRect(sg.x, sg.y, sg.w, 2.2);
    CX.restore();
  }

  /* --- флаги банд на угловых зданиях: полощутся --- */
  for (const d of districts) {
    if (d.gang < 0) continue;
    const [x0, y0] = iso(d.i0 + BS - 1, d.j0);
    const b = builds.find(q => q.i === d.i0 + BS - 1 && q.j === d.j0);
    const h = b ? b.h : 20;
    const x = x0 + ox, y = y0 + oy - h - 6;
    CX.strokeStyle = '#39406a'; CX.lineWidth = 1.4;
    CX.beginPath(); CX.moveTo(x, y); CX.lineTo(x, y - 14); CX.stroke();
    /* Последнее незащищённое обращение к таблице банд. Доска района может
       прийти раньше неё, и тогда здесь падал весь анимированный слой сразу:
       не только флаги на крышах, но и машины с людьми ниже по функции. */
    CX.fillStyle = (GANGS[d.gang] || { c: '#f5c542' }).c;
    CX.globalAlpha = .85;
    CX.beginPath();
    CX.moveTo(x, y - 14);
    for (let k = 0; k <= 4; k++) {
      const w = k / 4;
      CX.lineTo(x + w * 8, y - 14 + Math.sin(T * 3 + w * 4 + d.i0) * 1.1 + w * .4);
    }
    for (let k = 4; k >= 0; k--) {
      const w = k / 4;
      CX.lineTo(x + w * 8, y - 9 + Math.sin(T * 3 + w * 4 + d.i0) * 1.1 + w * .4);
    }
    CX.closePath(); CX.fill();
    CX.globalAlpha = 1;
  }
}

/* ---- облака: приём Forge of Empires — полупрозрачный слой над миром ----
   Несколько мягких пятен из радиальных градиентов, дрейфуют очень медленно.
   Дешёво, а карта сразу перестаёт быть плоской доской. */
const clouds = [];
for (let k = 0; k < 5; k++)
  clouds.push({ x: Math.random(), y: Math.random(), r: 140 + Math.random() * 220,
                vx: 4 + Math.random() * 7, squash: .45 + Math.random() * .15,
                a: .045 + Math.random() * .05, seed: Math.random() * 99 });
const CLOUD_SPR = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (const [ox, oy, r, a] of [[128,128,120,.9],[80,100,70,.7],[176,110,80,.7],
                                 [110,160,60,.5],[170,165,55,.5],[60,140,45,.4]]) {
    const gr = g.createRadialGradient(ox, oy, 0, ox, oy, r);
    gr.addColorStop(0, `rgba(190,200,225,${a})`); gr.addColorStop(1, 'rgba(190,200,225,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(ox, oy, r, 0, 7); g.fill();
  }
  return c;
})();
function drawClouds() {
  for (const cl of clouds) {
    const x = ((cl.x + T * cl.vx / 4000) % 1.3 - .15) * W;
    const y = (cl.y + Math.sin(T * .02 + cl.seed) * .02) * H;
    CX.save();
    const useArt = ok(ART.cloud);
    CX.globalAlpha = cl.a * (useArt ? 2.4 : 1) * (1 + .2 * Math.sin(T * .1 + cl.seed));
    CX.translate(x, y); CX.scale(cl.r / 128, cl.r / 128 * cl.squash);
    if (useArt) CX.drawImage(ART.cloud, -128, -110, 256, 220);
    else CX.drawImage(CLOUD_SPR, -128, -128);
    CX.restore();
  }
  CX.globalAlpha = 1;
}
