'use strict';

/* 24.08: чужой текст (имена игроков, названия банд) попадает в innerHTML —
   экранируем локально, чтобы файл не зависел от порядка загрузки map.html. */
function mgEsc(value) {
  return String(value == null ? '' : value)
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/* ========================== БОЛЬШАЯ КАРТА ГОРОДА ==========================
   Ответ на «сделай как в Forge of Empires»: их континентальная карта — это
   провинции с границами, ленты с названиями, облака и живые детали (корабли).
   Наш перевод в ночной сеттинг: город с высоты птичьего полёта — светящиеся
   артерии дорог между районами, скопления окон, река с баржами, краны доков,
   маяки труб. Провинции — Вороной от центров районов, границы подсвечены
   цветом банды-владельца, ленты-названия золотом. Клик по району — вход в
   знакомый квартальный вид (как у FoE вход в город).                        */

const WORLD_W = 3600, WORLD_H = 2300;
const MAP_KM_W = 240, MAP_KM_H = 150, MARCH_SECONDS_PER_KM = 3, MARCH_MIN_SECONDS = 25;
const PROVINCES = [
  { name: 'ЦЕНТР',            type: 'center', gang: -1, x: .50, y: .47 },
  { name: 'ДОКИ',             type: 'docks',  gang: 1,  x: .18, y: .60 },
  { name: 'СЕВЕРНЫЕ ГАРАЖИ',  type: 'garage', gang: 0,  x: .38, y: .18 },
  { name: 'ПРОМЗОНА',         type: 'industry', gang: 2, x: .74, y: .28 },
  { name: 'ВЕТРЯНОЕ ПОЛЕ',    type: 'wind',   gang: -1, x: .88, y: .55 },
  { name: 'СТАРЫЙ РАЙОН',     type: 'resid',  gang: 0,  x: .30, y: .40 },
  { name: 'ВЫСОТКИ',          type: 'resid',  gang: 2,  x: .62, y: .60 },
  { name: 'ДЕПО',             type: 'industry', gang: 1, x: .52, y: .78 },
  { name: 'РЫНОК',            type: 'resid',  gang: -1, x: .70, y: .43, market: true },
  { name: 'СВАЛКА',           type: 'waste',  gang: -1, x: .12, y: .25 },
  { name: 'НАБЕРЕЖНАЯ',       type: 'resid',  gang: 1,  x: .33, y: .68 },
  { name: 'КОЛЬЦО',           type: 'garage', gang: 2,  x: .85, y: .80 },
  { name: 'ТУННЕЛИ',          type: 'waste',  gang: 0,  x: .60, y: .16 },
  { name: 'ПУСТЫРИ',          type: 'waste',  gang: -1, x: .14, y: .86 },
  /* окраины: НЕРАЗВЕДАННЫЕ — под туманом, как облачные провинции FoE.
     Клик отправляет Шныря на разведку и открывает район. */
  { name: 'НЕДОСТРОЙ',    type: 'waste',    gang: -1, x: .05, y: .44, hid: 1, unlock: 1 },
  { name: 'ТЭЦ',          type: 'industry', gang: -1, x: .93, y: .18, hid: 1, unlock: 1 },
  { name: 'КАРЬЕР',       type: 'waste',    gang: -1, x: .96, y: .40, hid: 1, unlock: 2 },
  { name: 'АЭРОДРОМ',     type: 'waste',    gang: -1, x: .42, y: .05, hid: 1, unlock: 2 },
  { name: 'ЭЛЕВАТОР',     type: 'industry', gang: -1, x: .08, y: .08, hid: 1, unlock: 3 },
  { name: 'СОРТИРОВКА',   type: 'industry', gang: -1, x: .78, y: .93, hid: 1, unlock: 3 },
  { name: 'ОКРАИНЫ',      type: 'resid',    gang: -1, x: .30, y: .95, hid: 1, unlock: 4 },
  { name: 'РАДИОВЫШКА',   type: 'waste',    gang: -1, x: .97, y: .68, hid: 1, unlock: 4 },
];
PROVINCES.forEach(p => { p.px = p.x * WORLD_W; p.py = p.y * WORLD_H;
                         p.explored = !p.hid;
                         p.store = Math.round(400 + Math.random() * 4000);
                         /* хешрейт района: сколько там реально майнят — основа для
                            «сложности сети» на большой карте, см. worldNetworkStats() */
                         p.hash = Math.round(300 + Math.random() * 3200);
                         /* Симуляция занятости: сколько чужих гаражей уже в районе. */
                         p.garageLoad = Math.round(2 + Math.random() * 9 + (p.type === 'garage' ? 7 : 0)); });

function homeProvince() {
  const serverHome = Number(window.serverHomeProvince);
  const i = Number.isInteger(serverHome) && PROVINCES[serverHome]
    ? serverHome
    : (Number.isInteger(MY.homeProvince) ? MY.homeProvince : 2);
  return PROVINCES[i] || PROVINCES[2];
}
function marchDistanceKm(a, b) {
  return Math.hypot((a.px - b.px) / WORLD_W * MAP_KM_W, (a.py - b.py) / WORLD_H * MAP_KM_H);
}
function marchDurationMs(a, b) {
  return Math.max(MARCH_MIN_SECONDS * 1000, Math.round(marchDistanceKm(a, b) * MARCH_SECONDS_PER_KM * 1000));
}
function clockLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function chooseNewHomeProvince() {
  const candidates = PROVINCES.map((p, i) => ({ p, i })).filter(x =>
    x.p.type !== 'center' && x.p.type !== 'wind' && !x.p.hid);
  const min = Math.min(...candidates.map(x => x.p.garageLoad));
  const quiet = candidates.filter(x => x.p.garageLoad <= min + 1);
  return quiet[Math.floor(Math.random() * quiet.length)].i;
}

const PROVINCE_BONUSES = {
  docks:    { label: 'марши +15%', income: 180 },
  industry: { label: 'свет −10%', income: 140 },
  wind:     { label: 'свет −20%', income: 80 },
  garage:   { label: 'добыча +5%', income: 120 },
  waste:    { label: 'лом +100 BAND', income: 100 },
  resid:    { label: 'сеть жильцов', income: 110 },
  center:   { label: 'влияние в центре', income: 250 },
};
function provinceBonus(p) { return PROVINCE_BONUSES[p.type] || PROVINCE_BONUSES.resid; }
function ownedProvinces() { return PROVINCES.filter(p => p.gang === 0 && p !== homeProvince()); }
function territoryYieldMultiplier() {
  return 1 + ownedProvinces().filter(p => p.type === 'garage').length * .05;
}
function territoryPowerDiscount() {
  const land = ownedProvinces();
  return Math.min(.45, land.filter(p => p.type === 'industry').length * .10 + land.filter(p => p.type === 'wind').length * .20);
}
function territoryPassiveYield() {
  return ownedProvinces().reduce((sum, p) => sum + provinceBonus(p).income, 0);
}
function territoryMarchMultiplier() {
  return 1 + ownedProvinces().filter(p => p.type === 'docks').length * .15;
}

/* Окраины открываются вместе с ростом банды, а не просто по случайному клику. */
function worldProgress() {
  const held = PROVINCES.filter((p, i) => p !== homeProvince() && p.gang === 0).length;
  const members = MY.gang?.members?.length || 0;
  let tier = 1, goal = 'Разведай Недострой или ТЭЦ';
  if (MY.gang || held >= 1) { tier = 2; goal = 'Возьми 2 района под свой цвет'; }
  if (MY.gang && held >= 2) { tier = 3; goal = 'Набери 4 бойцов в банду'; }
  if (MY.gang && held >= 2 && members >= 4) { tier = 4; goal = 'Окраины и Радиовышка открыты'; }
  return { tier, held, members, goal };
}
/* Разведка никогда не запирается: этапы показывают развитие и открывают более
   выгодные цели, но активное задание должно работать с любым «???». */
function canExploreProvince(p) { return true; }
function lockedProvinceText(p) {
  const tier = worldProgress().tier;
  return `нужен этап ${p.unlock || 1} · сейчас ${tier}`;
}

/* река: ломаная с юга-запада на северо-восток */
const RIVER = [[0, .78], [.14, .70], [.24, .64], [.34, .60], [.42, .55],
               [.52, .52], [.60, .46], [.70, .36], [.80, .24], [.90, .12], [1, .04]]
  .map(([x, y]) => [x * WORLD_W, y * WORLD_H]);

/* грубая сетка принадлежности пикселей провинциям (для кликов и границ).
   Просьба (13.08, четвёртый заход): «районы слишком маленькие, начни с
   центра» — обычный Вороной делит карту строго по ближайшему центру, и
   увеличить один район, не трогая соседей, одним RAD не получится: соседняя
   граница всё равно проходит на полпути между центрами. Раздаём ЦЕНТРу вес —
   это взвешенная (степенная) диаграмма Вороного: у ЦЕНТРа дистанция до
   каждой точки карты считается «короче» на CENTER_BIAS, поэтому его клетка
   расталкивает соседей и становится заметно больше, а не только гуще
   застроена. Подобрано так, чтобы граница отодвинулась почти вдвое, но не
   съела ни одного соседнего центра (у ближайшей ВЫСОТКИ остаётся запас).   */
const CENTER_BIAS = 170000;
const PGRID = 8, PW = Math.ceil(WORLD_W / PGRID), PH = Math.ceil(WORLD_H / PGRID);
const pIdx = new Int8Array(PW * PH);
(function () {
  for (let gy = 0; gy < PH; gy++)
    for (let gx = 0; gx < PW; gx++) {
      const x = gx * PGRID, y = gy * PGRID;
      let best = 0, bd = 1e18;
      for (let k = 0; k < PROVINCES.length; k++) {
        const p = PROVINCES[k];
        const bias = p.type === 'center' ? CENTER_BIAS : 0;
        const d = (p.px - x) ** 2 + (p.py - y) ** 2 - bias;
        if (d < bd) { bd = d; best = k; }
      }
      pIdx[gy * PW + gx] = best;
    }
})();
/* 27.08: форма района для подсветки. Раньше владение и осада рисовались КРУГОМ
   вокруг центра провинции — круг не совпадал с настоящими границами, которые
   задаёт та же сетка pIdx, и «зелёным горел» кружок посреди чужой земли.

   Считаем один раз при первом обращении две вещи:
   spans  — клетки сетки, сжатые в горизонтальные отрезки (заливка);
   edges  — только те рёбра клеток, за которыми лежит ЧУЖОЙ район (контур).
   Обводить сами прямоугольники нельзя: их внутренние рёбра складываются
   в полосатую сетку поверх заливки. */
const _provSpans = new Map();
const _provEdges = new Map();
function provinceSpans(k) {
  let spans = _provSpans.get(k);
  if (spans) return spans;
  spans = [];
  for (let gy = 0; gy < PH; gy++) {
    let start = -1;
    for (let gx = 0; gx <= PW; gx++) {
      const inside = gx < PW && pIdx[gy * PW + gx] === k;
      if (inside && start < 0) start = gx;
      else if (!inside && start >= 0) { spans.push([start * PGRID, gy * PGRID, (gx - start) * PGRID, PGRID]); start = -1; }
    }
  }
  _provSpans.set(k, spans);
  return spans;
}
function provinceEdges(k) {
  let edges = _provEdges.get(k);
  if (edges) return edges;
  edges = [];
  const at = (gx, gy) => (gx < 0 || gy < 0 || gx >= PW || gy >= PH) ? -1 : pIdx[gy * PW + gx];
  for (let gy = 0; gy < PH; gy++) {
    for (let gx = 0; gx < PW; gx++) {
      if (pIdx[gy * PW + gx] !== k) continue;
      const x = gx * PGRID, y = gy * PGRID, s = PGRID;
      if (at(gx, gy - 1) !== k) edges.push([x, y, x + s, y]);
      if (at(gx, gy + 1) !== k) edges.push([x, y + s, x + s, y + s]);
      if (at(gx - 1, gy) !== k) edges.push([x, y, x, y + s]);
      if (at(gx + 1, gy) !== k) edges.push([x + s, y, x + s, y + s]);
    }
  }
  _provEdges.set(k, edges);
  return edges;
}
function provincePath(ctx, k) {
  ctx.beginPath();
  for (const [x, y, w, h] of provinceSpans(k)) ctx.rect(x, y, w, h);
}
function provinceOutline(ctx, k) {
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of provinceEdges(k)) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
}

const provAt = (x, y) => {
  const gx = Math.max(0, Math.min(PW - 1, x / PGRID | 0));
  const gy = Math.max(0, Math.min(PH - 1, y / PGRID | 0));
  return PROVINCES[pIdx[gy * PW + gx]];
};

/* --- статичный мир рисуется один раз --- */
let worldCv = null;
const beacons = [];         // мигающие красные маяки труб
const goldBeacons = [];     // тёплый мигающий огонёк на шпиле центральной башни
const worldRoads = [];      // кривые дороги мира: по ним пойдут марши
const barges = [];          // баржи на реке
const windmillsW = [];      // ветряки мира

function riverPoint(t) {    // точка на реке, t 0..1
  const seg = Math.min(RIVER.length - 2, Math.floor(t * (RIVER.length - 1)));
  const f = t * (RIVER.length - 1) - seg;
  return [RIVER[seg][0] + (RIVER[seg + 1][0] - RIVER[seg][0]) * f,
          RIVER[seg][1] + (RIVER[seg + 1][1] - RIVER[seg][1]) * f];
}

function buildWorld() {
  worldCv = document.createElement('canvas');
  /* Мир — такой же статический слой, как город и гараж: храним его в
     физическом DPI, но используем прежнюю игровую сетку WORLD_W×WORLD_H. */
  worldCv._cssW = WORLD_W; worldCv._cssH = WORLD_H;
  worldCv.width = Math.ceil(WORLD_W * DPR); worldCv.height = Math.ceil(WORLD_H * DPR);
  const c = worldCv.getContext('2d');
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  const R = (() => { let s = 977; return () => (s = s * 16807 % 2147483647) / 2147483647; })();

  /* земля: тёмная с пятнами разной глубины */
  const bg = c.createLinearGradient(0, 0, WORLD_W, WORLD_H);
  bg.addColorStop(0, '#0b0e19'); bg.addColorStop(.5, '#0d1020'); bg.addColorStop(1, '#090c16');
  c.fillStyle = bg; c.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let k = 0; k < 260; k++) {                       // пятна рельефа
    const x = R() * WORLD_W, y = R() * WORLD_H, r = 60 + R() * 200;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const tone = R() < .5 ? '18,22,40' : '8,10,18';
    g.addColorStop(0, `rgba(${tone},${.10 + R() * .12})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }

  /* Главная карта больше не начинается с одного процедурного фона: цельный
     ночной город даёт ей масштаб и узнаваемые дороги. Территории, кварталы,
     флаги и все кликабельные объекты рисуются дальше отдельными слоями. */
  if (ok(ART.bgCityHero)) {
    c.save();
    c.globalAlpha = .64;
    c.drawImage(ART.bgCityHero, 0, 0, WORLD_W, WORLD_H);
    const night = c.createLinearGradient(0, 0, 0, WORLD_H);
    night.addColorStop(0, 'rgba(2,5,12,.12)');
    night.addColorStop(.58, 'rgba(2,5,12,.04)');
    night.addColorStop(1, 'rgba(2,5,12,.36)');
    c.globalAlpha = 1; c.fillStyle = night; c.fillRect(0, 0, WORLD_W, WORLD_H);
    c.restore();
  }

  /* заливка территорий банд — едва заметная, как политическая карта */
  for (let gy = 0; gy < PH; gy++)
    for (let gx = 0; gx < PW; gx++) {
      const p = PROVINCES[pIdx[gy * PW + gx]];
      if (p.gang < 0 || !p.explored) continue;
      c.fillStyle = (GANGS[p.gang] || { c: '#f5c542' }).c + '18';
      c.fillRect(gx * PGRID, gy * PGRID, PGRID, PGRID);
    }

  /* границы провинций: точки, где сосед другой; цвет = банда/серый */
  for (let gy = 1; gy < PH - 1; gy++)
    for (let gx = 1; gx < PW - 1; gx++) {
      const a = pIdx[gy * PW + gx];
      if (pIdx[gy * PW + gx + 1] !== a || pIdx[(gy + 1) * PW + gx] !== a) {
        const p = PROVINCES[a];
        c.fillStyle = p.gang >= 0 ? (GANGS[p.gang] || { c: '#f5c542' }).c + 'c8' : 'rgba(120,132,170,.40)';
        c.fillRect(gx * PGRID, gy * PGRID, 3.4, 3.4);
      }
    }

  /* артерии: каждый центр к 2 ближайшим — светящиеся дороги */
  const links = new Set();
  for (let i = 0; i < PROVINCES.length; i++) {
    const near = PROVINCES.map((q, j) => [((q.px - PROVINCES[i].px) ** 2 +
      (q.py - PROVINCES[i].py) ** 2), j]).sort((a, b) => a[0] - b[0]).slice(1, 3);
    for (const [, j] of near) links.add(i < j ? i + '-' + j : j + '-' + i);
  }
  /* Дороги ИЗОГНУТЫЕ. Прямые отрезки между центрами и делали из карты схему
     метро — глаз читает прямую линию как связь, а не как шоссе. Кривая Безье
     со смещением по нормали сразу превращает её в дорогу на местности. */
  worldRoads.length = 0;
  for (const l of links) {
    const [i, j] = l.split('-').map(Number);
    const a = PROVINCES[i], b = PROVINCES[j];
    if (!a.explored || !b.explored) continue;
    const mx = (a.px + b.px) / 2, my = (a.py + b.py) / 2;
    const dx = b.px - a.px, dy = b.py - a.py, L = Math.hypot(dx, dy) || 1;
    const bend = (R() - .5) * L * .28;                 // изгиб в сторону
    const cx2 = mx - dy / L * bend, cy2 = my + dx / L * bend;
    worldRoads.push({ a: [a.px, a.py], c: [cx2, cy2], b: [b.px, b.py], len: L });
    const draw = (w, style) => {
      c.strokeStyle = style; c.lineWidth = w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(a.px, a.py); c.quadraticCurveTo(cx2, cy2, b.px, b.py); c.stroke();
    };
    draw(15, '#05070d');                                // полотно
    draw(9, '#0c1020');
    draw(3.2, 'rgba(255,190,90,.09)');                  // тёплый отсвет
    const n = L / 30 | 0;                               // фонари вдоль полотна
    for (let k = 1; k < n; k++) {
      const t = k / n, it = 1 - t;
      const x = it * it * a.px + 2 * it * t * cx2 + t * t * b.px;
      const y = it * it * a.py + 2 * it * t * cy2 + t * t * b.py;
      c.fillStyle = 'rgba(255,200,110,.6)';
      c.fillRect(x - .8, y - .8, 1.6, 1.6);
    }
  }

  /* ЗАСТРОЙКА КВАРТАЛАМИ, а не россыпью точек.
     Раньше район был облаком светящихся пикселей — красиво, но читается как
     созвездие, а не как город. Теперь у каждого района своя сетка кварталов,
     повёрнутая под своим углом: улицы, крыши, светящиеся окна. Сверху это
     сразу опознаётся как застройка, и карта перестаёт быть схемой. */
  const BLOCK = {
    resid:    { grid: 34, roof: '#232a42', lit: ['#ffcf6e', '#ffb545', '#9fd8ff'], fill: .94, n: 5 },
    center:   { grid: 30, roof: '#2b3352', lit: ['#f5c542', '#ffdf96', '#9fd8ff'], fill: .97, n: 6 },
    garage:   { grid: 27, roof: '#1e2438', lit: ['#3ddc84', '#ffcf6e'],            fill: .86, n: 3 },
    industry: { grid: 56, roof: '#222840', lit: ['#ffb545', '#ff8a5c'],            fill: .7,  n: 3 },
    docks:    { grid: 52, roof: '#1c2540', lit: ['#4fa3ff', '#9fd8ff'],            fill: .66, n: 3 },
    waste:    { grid: 44, roof: '#191e2c', lit: ['#6a5a35', '#ffb545'],            fill: .3,  n: 1 },
    wind:     { grid: 80, roof: '#171d2c', lit: ['#3ddc84'],                       fill: .16, n: 1 },
  };
  for (const p of PROVINCES) {
    if (!p.explored) continue;                    // под туманом города не видно
    const B = BLOCK[p.type] || BLOCK.resid;
    const ang = (R() - .5) * 1.1;                 // свой угол сетки у каждого района
    const ca = Math.cos(ang), sa = Math.sin(ang);
    /* Просьба (13.08, четвёртый заход): «случись много игроков — все ники
       слепятся в кучу» — на карте мира сейчас нет ничьих ников (мультиплеера
       тут нет), но сама провинция ЦЕНТРА — самая маленькая по факту застройки
       относительно своей важности (там отель, там будущие метки игроков).
       Начинаем расширять районы с него: было 400, стало 560 — почти вдвое
       по площади, с запасом под будущую разметку.                          */
    const RAD = p.type === 'center' ? 560 : 340;
    const steps = Math.ceil(RAD / B.grid);
    c.save();                                     // сетка улиц под кварталами
    c.translate(p.px, p.py); c.rotate(ang);
    c.strokeStyle = 'rgba(90,105,150,.13)'; c.lineWidth = 2.4;
    for (let k = -steps; k <= steps; k++) {
      const o = k * B.grid + B.grid / 2;
      const lim = Math.sqrt(Math.max(0, RAD * RAD - o * o));
      if (lim < 10) continue;
      c.beginPath(); c.moveTo(-lim, o); c.lineTo(lim, o); c.stroke();
      c.beginPath(); c.moveTo(o, -lim); c.lineTo(o, lim); c.stroke();
    }
    c.restore();
    for (let gy = -steps; gy <= steps; gy++)
      for (let gx = -steps; gx <= steps; gx++) {
        const lx = gx * B.grid, ly = gy * B.grid;
        const x = p.px + lx * ca - ly * sa, y = p.py + lx * sa + ly * ca;
        const dist = Math.hypot(lx, ly) / RAD;
        if (dist > 1) continue;
        if (R() > B.fill * .8 * (1 - dist * .75)) continue;  // к краю застройка редеет
        if (x < 12 || y < 12 || x > WORLD_W - 12 || y > WORLD_H - 12) continue;
        if (provAt(x, y) !== p) continue;
        const big = R() < .12;                              // изредка крупное здание
        const park = p.type !== 'industry' && p.type !== 'docks' && R() < .10;
        const bw = B.grid * (big ? 1.35 : .6 + R() * .22);
        const bh = B.grid * (big ? 1.2 : .55 + R() * .25);
        if (park) {                                          // двор или сквер вместо дома
          c.save(); c.translate(x, y); c.rotate(ang);
          c.fillStyle = 'rgba(28,48,34,.55)';
          c.fillRect(-bw / 2, -bh / 2, bw, bh);
          for (let k = 0; k < 3; k++) {
            c.fillStyle = 'rgba(38,66,44,.8)';
            c.beginPath();
            c.arc(-bw / 4 + R() * bw / 2, -bh / 4 + R() * bh / 2, 2.6 + R() * 2, 0, 7);
            c.fill();
          }
          c.restore();
          continue;
        }
        /* квартал — это не один дом: режем его на 2-4 корпуса разной высоты,
           каждый со своей тенью. При приближении видна застройка, а не ковёр. */
        c.save();
        c.translate(x, y); c.rotate(ang);
        const parts = big ? 1 : 2 + (R() * 3 | 0);
        const cols2 = parts <= 2 ? parts : 2, rows2 = Math.ceil(parts / cols2);
        for (let py2 = 0; py2 < rows2; py2++)
          for (let px2 = 0; px2 < cols2; px2++) {
            if (py2 * cols2 + px2 >= parts) break;
            const cw = bw / cols2, chh = bh / rows2;
            const ox2 = -bw / 2 + px2 * cw, oy2 = -bh / 2 + py2 * chh;
            const w2 = cw - 1.6, h2 = chh - 1.6;
            if (w2 < 3 || h2 < 3) continue;
            const tall = R();                                // «высота» = длина тени
            c.fillStyle = `rgba(0,0,0,${(.30 + tall * .3).toFixed(2)})`;
            c.fillRect(ox2 + 1.5 + tall * 2, oy2 + 1.5 + tall * 2, w2, h2);
            c.fillStyle = B.roof;
            c.fillRect(ox2, oy2, w2, h2);
            c.strokeStyle = 'rgba(130,145,200,.12)'; c.lineWidth = 1;
            c.strokeRect(ox2, oy2, w2, h2);
            const nWin = Math.max(1, Math.round(B.n * (w2 * h2) / (bw * bh)));
            for (let k = 0; k < nWin; k++) {
              const wx = ox2 + 2 + R() * Math.max(1, w2 - 4);
              const wy = oy2 + 2 + R() * Math.max(1, h2 - 4);
              c.globalAlpha = .55 + R() * .45;
              c.fillStyle = B.lit[(R() * B.lit.length) | 0];
              const s2 = R() < .8 ? 2 : 3.2;
              c.fillRect(wx, wy, s2, s2);
            }
            c.globalAlpha = 1;
          }
        c.restore();
      }
  }

  /* ПОДЛОЖКА РАЙОНОВ: нарисованные куски настоящей застройки сверху.
     Процедурные кварталы дают связность и правильные границы, но вблизи
     остаются схемой. Аэрофото-пятна кладём ПОВЕРХ них — деталь появляется там,
     где её не нарисуешь кодом: машины во дворах, краны, штабеля, деревья,
     а процедурная сетка внизу склеивает пятна между собой. */
  const WTEX = { resid: 'wResid', center: 'wCity', garage: 'wResid',
                 industry: 'wIndustry', docks: 'wDocks', waste: 'wWaste', wind: 'wForest' };
  for (const p of PROVINCES) {
    if (!p.explored) continue;
    const im = ART[WTEX[p.type]];
    if (!ok(im)) continue;
    /* ЦЕНТР вырос почти вдвое по площади (см. CENTER_BIAS выше) — фотопятен
       нужно больше и разбрасывать их дальше, иначе застройка на новых,
       дальних окраинах района останется голой процедурной сеткой без
       фактуры аэрофото. */
    const n = p.type === 'center' ? 15 : p.type === 'waste' || p.type === 'wind' ? 3 : 6;
    const scatterR = p.type === 'center' ? 460 : 300;
    for (let k = 0; k < n; k++) {
      const ang2 = R() * 6.283, rad2 = Math.abs(R() + R() - 1) * scatterR;
      const x = p.px + Math.cos(ang2) * rad2 * 1.2, y = p.py + Math.sin(ang2) * rad2 * .95;
      if (provAt(x, y) !== p) continue;
      const size = 280 + R() * 240;
      c.save();
      c.translate(x, y); c.rotate(R() * 6.283);
      c.globalAlpha = .9;
      c.drawImage(im, -size / 2, -size / 2, size, size);
      c.restore();
    }
  }
  c.globalAlpha = 1;

  /* река поверх дорог: тёмная лента с отблеском и мостами */
  c.strokeStyle = '#060a16'; c.lineWidth = 44; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); RIVER.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
  c.strokeStyle = 'rgba(90,140,220,.10)'; c.lineWidth = 34; c.stroke();
  c.strokeStyle = 'rgba(140,180,255,.07)'; c.lineWidth = 14; c.stroke();
  for (const t of [.22, .46, .68]) {                    // мосты
    const [x, y] = riverPoint(t), [x2, y2] = riverPoint(t + .02);
    const dx = x2 - x, dy = y2 - y, L = Math.hypot(dx, dy);
    const nx = -dy / L, ny = dx / L;
    c.strokeStyle = '#1a2036'; c.lineWidth = 8;
    c.beginPath(); c.moveTo(x - nx * 34, y - ny * 34); c.lineTo(x + nx * 34, y + ny * 34); c.stroke();
    c.fillStyle = 'rgba(255,200,110,.9)';
    c.fillRect(x - nx * 30 - 1, y - ny * 30 - 1, 2, 2);
    c.fillRect(x + nx * 30 - 1, y + ny * 30 - 1, 2, 2);
  }

  /* достопримечательности */
  for (const p of PROVINCES) {
    if (!p.explored) continue;
    if (p.type === 'center') {
      /* Просьба (13.08, четвёртый заход): «доработай ЦЕНТР до идеала» — тут
         раньше стояла одна плоская коробка с точками вместо окон, единственная
         достопримечательность на карте без настоящей картинки (у дока — кран,
         у ТЭЦ — труба, у элеватора — силос, а у отеля — прямоугольник). Своей
         top-down картинки для башни нет и рисовать новую я не умею, зато есть
         готовый ART.hotel — та самая красивая башня, что уже стоит в квартале
         отеля внутри района. Ставим её же сюда, крупно, плюс два меньших
         небоскрёба по бокам (та же процедурная застройка, что и у обычных
         кварталов, просто выше и ближе друг к другу) — получается не одна
         коробка, а маленький деловой центр с площадью у подножия.          */
      const RGLOW = 170;
      const g = c.createRadialGradient(p.px, p.py, 0, p.px, p.py, RGLOW);
      g.addColorStop(0, 'rgba(245,197,66,.42)'); g.addColorStop(.5, 'rgba(245,197,66,.14)');
      g.addColorStop(1, 'rgba(245,197,66,0)');
      c.fillStyle = g; c.beginPath(); c.arc(p.px, p.py, RGLOW, 0, 7); c.fill();

      /* площадь у подножия: кольцо мощения со скамьями-точками света */
      c.save(); c.translate(p.px, p.py); c.scale(1, .5);
      c.strokeStyle = 'rgba(245,197,66,.22)'; c.lineWidth = 3;
      c.beginPath(); c.arc(0, 0, 118, 0, 7); c.stroke();
      c.fillStyle = 'rgba(20,16,8,.5)'; c.beginPath(); c.arc(0, 0, 116, 0, 7); c.fill();
      for (let r = 0; r < 14; r++) {
        const a2 = r / 14 * 6.283;
        c.fillStyle = 'rgba(255,223,150,.65)';
        c.fillRect(Math.cos(a2) * 108 - 1.4, Math.sin(a2) * 108 - 1.4, 2.8, 2.8);
      }
      c.restore();

      const towerAt = (dx, dy, wpx, lit) => {              // меньшая процедурная башня-спутник
        const x = p.px + dx, y = p.py + dy, hh = 150 * (wpx / 90);
        c.fillStyle = `rgba(0,0,0,.4)`; c.fillRect(x - wpx / 2 + 4, y - hh + 6, wpx, hh);
        c.fillStyle = '#232b4a'; c.fillRect(x - wpx / 2, y - hh, wpx, hh);
        c.strokeStyle = 'rgba(255,223,150,.28)'; c.lineWidth = 1.4;
        c.strokeRect(x - wpx / 2, y - hh, wpx, hh);
        const cols = Math.max(2, Math.round(wpx / 9));
        const rows = Math.round(hh / 11);
        for (let r2 = 0; r2 < rows; r2++) for (let q2 = 0; q2 < cols; q2++) {
          if ((r2 * 7 + q2 * 3) % 5 === 0) continue;
          c.fillStyle = lit[(r2 + q2) % lit.length];
          c.fillRect(x - wpx / 2 + 3 + q2 * (wpx - 6) / cols, y - hh + 6 + r2 * 11, 2.2, 3);
        }
        return { x, topY: y - hh };
      };
      const litCols = ['#ffdf96', '#f5c542', '#9fd8ff'];
      towerAt(-72, 6, 34, litCols);
      towerAt(70, 2, 30, litCols);

      if (ok(ART.hotel)) {                                  // главная башня — тот же арт, что и в квартале
        const w = 150, h = w * ART.hotel.naturalHeight / ART.hotel.naturalWidth;
        c.save();
        c.globalAlpha = .22; c.fillStyle = '#000';
        c.beginPath(); c.ellipse(p.px + 6, p.py + 8, w * .34, w * .12, 0, 0, 7); c.fill();
        c.restore();
        c.drawImage(ART.hotel, p.px - w / 2, p.py - h + 14, w, h);
        goldBeacons.push({ x: p.px, y: p.py - h + 14 + h * .04, ph: .6 });
      } else {                                              // без картинки — прежняя коробка, но крупнее
        c.fillStyle = '#0c0f1c';
        c.fillRect(p.px - 14, p.py - 84, 28, 84);
        for (let r = 0; r < 13; r++) for (let q = 0; q < 4; q++) {
          c.fillStyle = (r * 4 + q) % 4 ? '#ffdf96' : '#9fd8ff';
          c.fillRect(p.px - 10 + q * 6.6, p.py - 76 + r * 6, 2.6, 3.2);
        }
        goldBeacons.push({ x: p.px, y: p.py - 84, ph: .6 });
      }
    }
    if (p.type === 'docks') {                     // портовые краны
      if (ok(ART.lmCrane)) {
        for (let k = 0; k < 2; k++) {
          const x = p.px - 70 + k * 130, y = p.py + 40 - k * 30, w = 190;
          c.drawImage(ART.lmCrane, x - w / 2, y - w / 2, w, w * ART.lmCrane.naturalHeight / ART.lmCrane.naturalWidth);
        }
      } else for (let k = 0; k < 3; k++) {
        const x = p.px - 60 + k * 56, y = p.py + 30 - k * 14;
        c.strokeStyle = '#232b47'; c.lineWidth = 4;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 52); c.lineTo(x + 42, y - 64); c.stroke();
        c.strokeStyle = 'rgba(159,216,255,.5)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x + 42, y - 64); c.lineTo(x + 42, y - 34); c.stroke();
        c.fillStyle = '#4fa3ff'; c.fillRect(x + 40.6, y - 35, 2.8, 2.8);
      }
    }
    if (p.type === 'industry') {                  // трубы: маяки в динамику
      for (let k = 0; k < 2; k++) {
        const x = p.px - 40 + k * 90, y = p.py + 20;
        if (ok(ART.lmChimney)) {
          const w = 150, h = w * ART.lmChimney.naturalHeight / ART.lmChimney.naturalWidth;
          c.drawImage(ART.lmChimney, x - w / 2, y - h * .7, w, h);
          beacons.push({ x, y: y - h * .6, ph: (k * 3.1) % 7 });
        } else {
          c.fillStyle = '#141a2e'; c.fillRect(x - 6, y - 66, 12, 66);
          c.fillStyle = '#1d2540'; c.fillRect(x - 8, y - 70, 16, 6);
          beacons.push({ x, y: y - 72, ph: (k * 3.1) % 7 });
        }
      }
    }
    if (p.type === 'waste' && ok(ART.lmRadio)) {   // на пустырях — радиовышка
      const w = 130, h = w * ART.lmRadio.naturalHeight / ART.lmRadio.naturalWidth;
      c.drawImage(ART.lmRadio, p.px - w / 2, p.py - h * .55, w, h);
      beacons.push({ x: p.px, y: p.py - h * .45, ph: 1.7 });
    }
    if (p.name === 'ЭЛЕВАТОР' && ok(ART.lmElevator)) {
      const w = 190, h = w * ART.lmElevator.naturalHeight / ART.lmElevator.naturalWidth;
      c.drawImage(ART.lmElevator, p.px - w / 2, p.py - h * .55, w, h);
    }
    const NAMED = { 'КАРЬЕР': 'lmQuarry', 'ДЕПО': 'lmDepot', 'РЫНОК': 'lmMarket',
                    'ТУННЕЛИ': 'lmTunnel', 'НАБЕРЕЖНАЯ': 'lmBridge' };
    if (NAMED[p.name] && ok(ART[NAMED[p.name]])) {
      const im2 = ART[NAMED[p.name]];
      const w = 180, h = w * im2.naturalHeight / im2.naturalWidth;
      c.drawImage(im2, p.px - w / 2, p.py - h * .55, w, h);
    }
    if (p.name === 'АЭРОДРОМ' && ok(ART.lmHangar)) {
      const w = 200, h = w * ART.lmHangar.naturalHeight / ART.lmHangar.naturalWidth;
      c.drawImage(ART.lmHangar, p.px - w / 2, p.py - h * .5, w, h);
    }
    if (p.type === 'wind')                        // ветряки в динамику
      for (let k = 0; k < 4; k++)
        windmillsW.push({ x: p.px - 60 + (k % 2) * 90 + R() * 30,
                          y: p.py - 30 + (k / 2 | 0) * 70, ph: R() * 7 });
  }

  /* виньетка краёв мира */
  const vg = c.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * .4,
                                    WORLD_W / 2, WORLD_H / 2, WORLD_W * .62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,3,7,.85)');
  c.fillStyle = vg; c.fillRect(0, 0, WORLD_W, WORLD_H);

  /* баржи */
  for (let k = 0; k < 3; k++)
    barges.push({ t: R(), v: .00022 + R() * .0002, dir: R() < .5 ? 1 : -1 });
}

/* конвои между районами: по тем же кривым, что и дороги. Пустая карта мертва,
   а пара едущих огней сразу говорит, что мир живёт и без тебя. */
const worldCars = [];
function seedWorldCars() {
  worldCars.length = 0;
  const R2 = (() => { let s2 = 31337; return () => (s2 = s2 * 16807 % 2147483647) / 2147483647; })();
  for (let k = 0; k < Math.min(14, worldRoads.length * 2); k++) {
    const r = worldRoads[(R2() * worldRoads.length) | 0];
    if (!r) continue;
    worldCars.push({ r, t: R2(), v: (.02 + R2() * .03) * (R2() < .5 ? 1 : -1), col: R2() < .3 ? '#ffcf6e' : '#fff3c9' });
  }
}
function bez(r, t) {
  const it = 1 - t;
  return [it * it * r.a[0] + 2 * it * t * r.c[0] + t * t * r.b[0],
          it * it * r.a[1] + 2 * it * t * r.c[1] + t * t * r.b[1]];
}
function drawWorldCars() {
  if (!worldCars.length) seedWorldCars();
  for (const w of worldCars) {
    w.t += w.v / 60;
    if (w.t > 1) w.t = 0; if (w.t < 0) w.t = 1;
    const [x, y] = bez(w.r, w.t);
    CX.globalAlpha = .8;
    CX.drawImage(G_HEAD, x - 16, y - 16, 32, 32);
    CX.fillStyle = w.col;
    CX.fillRect(x - 1.4, y - 1.4, 2.8, 2.8);
    CX.globalAlpha = 1;
  }
}

/* лента-название: рисуется в кадре (нужен hover-эффект) */
function ribbon(cx2, y, text, sub, hot, gang) {
  CX.font = '700 15px Georgia, serif';
  const w = Math.max(90, CX.measureText(text).width + 34);
  const x = cx2 - w / 2;
  const g = CX.createLinearGradient(x, y, x, y + 26);
  g.addColorStop(0, hot ? '#ffe08a' : '#e8c268'); g.addColorStop(.5, hot ? '#f5c542' : '#c89a3a');
  g.addColorStop(1, hot ? '#c89a3a' : '#8a6a20');
  CX.fillStyle = 'rgba(0,0,0,.45)';
  CX.beginPath(); CX.roundRect(x + 2, y + 3, w, 26, 6); CX.fill();
  CX.fillStyle = g;
  CX.beginPath(); CX.roundRect(x, y, w, 26, 6); CX.fill();
  /* хвостики ленты */
  CX.beginPath(); CX.moveTo(x - 10, y + 13); CX.lineTo(x, y + 4); CX.lineTo(x, y + 22); CX.fill();
  CX.beginPath(); CX.moveTo(x + w + 10, y + 13); CX.lineTo(x + w, y + 4); CX.lineTo(x + w, y + 22); CX.fill();
  CX.strokeStyle = 'rgba(90,60,10,.8)'; CX.lineWidth = 1;
  CX.beginPath(); CX.roundRect(x, y, w, 26, 6); CX.stroke();
  CX.fillStyle = '#241a00'; CX.textAlign = 'center';
  CX.fillText(tr(text), cx2, y + 18);
  if (sub) {
    CX.font = '600 10px Segoe UI';
    CX.fillStyle = 'rgba(230,232,240,.85)';
    CX.fillText(tr(sub), cx2, y + 40);
  }
  if (gang !== undefined && gang >= 0) {          // герб владельца на краю ленты
    const im = [MY.crest || ART.symWolf, ART.symAnchor, ART.symRing][gang % 3];
    const s2 = 22;
    if (im && (im.naturalWidth || im.width)) {
      CX.save();
      CX.globalAlpha = .95;
      CX.beginPath(); CX.arc(x - 14, y + 13, 13, 0, 7);
      CX.fillStyle = 'rgba(10,12,20,.85)'; CX.fill();
      CX.strokeStyle = (GANGS[gang] || { c: '#f5c542' }).c + 'cc'; CX.lineWidth = 1.4; CX.stroke();
      CX.clip();
      CX.drawImage(im, x - 14 - s2 / 2, y + 13 - s2 / 2, s2, s2);
      CX.restore();
    }
  }
}

/* камера мира */
let wZoom = .55, wPanX = 0, wPanY = 0, wHover = null;
function drawTerritoryOwnership() {
  for (const p of PROVINCES) {
    if (!p.explored || p.gang < 0) continue;
    const mine = p.gang === 0;
    const col = (GANGS[p.gang] || { c: '#f5c542' }).c;
    const pulse = mine ? .72 + .28 * Math.sin(T * 2.2 + p.px * .01) : .8;
    const k = PROVINCES.indexOf(p);
    /* 27.08: захваченный район заливается целиком по своей форме. Круг вокруг
       центра не совпадал с границами и оставлял «зелёный кружок» посреди
       чужой земли — а район принадлежит банде целиком. */
    CX.save();
    provincePath(CX, k);
    CX.fillStyle = col + (mine ? '1c' : '12'); CX.fill();      // 11% / 7%
    CX.restore();
    CX.save();
    provinceOutline(CX, k);
    CX.strokeStyle = col + (mine ? 'ee' : 'aa');
    CX.lineWidth = mine ? 3.5 : 2;
    CX.lineJoin = 'round';
    CX.globalAlpha = pulse;
    CX.stroke();
    CX.globalAlpha = 1;
    CX.restore();
    CX.save(); provincePath(CX, k); CX.clip();
    const glow = CX.createRadialGradient(p.px, p.py, 12, p.px, p.py, mine ? 190 : 130);
    glow.addColorStop(0, col + (mine ? '30' : '1e'));
    glow.addColorStop(1, col + '00');
    CX.fillStyle = glow; CX.fillRect(p.px - 200, p.py - 200, 400, 400);
    CX.restore();

    /* большой флаг над центром района: собственные земли заметны без чтения ленты */
    const mastTop = p.py - (mine ? 110 : 78), mastBottom = p.py - 20;
    CX.strokeStyle = '#e9e5d5'; CX.lineWidth = mine ? 5 : 3.5;
    CX.beginPath(); CX.moveTo(p.px, mastBottom); CX.lineTo(p.px, mastTop); CX.stroke();
    CX.fillStyle = col;
    CX.beginPath(); CX.moveTo(p.px + 2, mastTop + 4); CX.lineTo(p.px + (mine ? 68 : 45), mastTop + 17); CX.lineTo(p.px + 2, mastTop + 39); CX.closePath(); CX.fill();
    CX.strokeStyle = '#111522'; CX.lineWidth = 2; CX.stroke();
    const crest = [MY.crest || ART.symWolf, ART.symAnchor, ART.symRing][p.gang % 3];
    const badge = mine ? 34 : 24;
    CX.save(); CX.beginPath(); CX.arc(p.px, mastTop, badge / 2, 0, 7); CX.clip();
    CX.fillStyle = '#111522'; CX.fillRect(p.px - badge / 2, mastTop - badge / 2, badge, badge);
    if (crest && (crest.naturalWidth || crest.width)) CX.drawImage(crest, p.px - badge / 2, mastTop - badge / 2, badge, badge);
    CX.restore();
    CX.strokeStyle = col; CX.lineWidth = 2; CX.beginPath(); CX.arc(p.px, mastTop, badge / 2, 0, 7); CX.stroke();
    if (mine) {
      CX.font = '800 12px Segoe UI'; CX.textAlign = 'center';
  CX.fillStyle = '#f7d46a'; CX.fillText(tr('ТВОЙ РАЙОН'), p.px, p.py - 146);
    }
  }
}
/* A siege changes the map before the final claim.  The province remains
   legally enemy/neutral until 33 of 49 quarters are controlled, but players
   can read presence (13), influence (25) and dominance + flag (30) at a
   glance instead of guessing from a hidden counter. */
function sharedProvinceControl(p) {
  const counts = new Map();
  for (const owner of (Array.isArray(p.quarters) ? p.quarters : [])) {
    if (!Number.isInteger(owner) || owner < 0) continue;
    counts.set(owner, (counts.get(owner) || 0) + 1);
  }
  let owner = -1, held = 0;
  for (const [slot, count] of counts) if (count > held) { owner = slot; held = count; }
  return { owner, held };
}
function drawSiegeControl() {
  const rule = window.PROVINCE_CONTROL || { presence: 13, influence: 25, dominance: 30, full: 33, total: 49 };
  for (const p of PROVINCES) {
    if (!p.explored || p.gang >= 0 || !Array.isArray(p.quarters)) continue;
    const control = sharedProvinceControl(p);
    const owner = control.owner, held = control.held;
    if (owner < 0) continue;
    if (held < rule.presence) continue;
    const influence = Math.min(1, held / rule.full);
    const dominant = held >= rule.dominance;
    const gang = GANGS[owner] || { c: '#f5c542' };
    const col = gang.c;
    const k = PROVINCES.indexOf(p);
    /* Заливка по НАСТОЯЩЕЙ форме района, а не кругом: сила захвата читается
       как площадь, залитая цветом банды, и совпадает с границами на карте.
       Прозрачность растёт вместе с долей захваченных кварталов. */
    /* Заливка по НАСТОЯЩЕЙ форме района, лёгкая и полупрозрачная: карта под
       ней должна читаться. Плотность чуть растёт вместе с долей захвата. */
    const a = Math.round(9 + influence * 11);          // 0x09..0x14 — 3.5%..8%
    const hex = a.toString(16).padStart(2, '0');
    CX.save();
    provincePath(CX, k);
    CX.fillStyle = col + hex; CX.fill();
    CX.restore();
    /* Контур строится ТОЛЬКО из внешних рёбер — внутренних полос не возникает. */
    CX.save();
    provinceOutline(CX, k);
    CX.strokeStyle = col + (dominant ? 'dd' : '99');
    CX.lineWidth = dominant ? 3 : 2;
    CX.lineJoin = 'round';
    CX.setLineDash(dominant ? [] : [14, 10]); CX.lineDashOffset = -T * 18;
    CX.stroke(); CX.setLineDash([]);
    CX.restore();
    /* Мягкое свечение к центру — оно и раньше давало объём. */
    CX.save(); provincePath(CX, k); CX.clip();
    const glow = CX.createRadialGradient(p.px, p.py, 8, p.px, p.py, 170);
    glow.addColorStop(0, col + (dominant ? '2a' : '18'));
    glow.addColorStop(1, col + '00');
    CX.fillStyle = glow; CX.fillRect(p.px - 180, p.py - 180, 360, 360);
    CX.restore();
    const label = dominant ? 'DOMINATING' : held >= rule.influence ? 'INFLUENCE' : 'PRESENCE';
    CX.font = dominant ? '800 12px Segoe UI' : '700 10px Segoe UI'; CX.textAlign = 'center';
    CX.fillStyle = dominant ? '#f7d46a' : col;
    CX.shadowColor = '#000'; CX.shadowBlur = 6;
    CX.fillText(`${label} ${held}/${rule.total}`, p.px, p.py - 152);
    CX.shadowBlur = 0;
    const radius = 62 + influence * 86;
    if (!dominant) continue;
    const top = p.py - 62;
    CX.strokeStyle = '#e9e5d5'; CX.lineWidth = 4; CX.beginPath(); CX.moveTo(p.px, p.py - 10); CX.lineTo(p.px, top); CX.stroke();
    CX.fillStyle = col; CX.beginPath(); CX.moveTo(p.px + 2, top + 3); CX.lineTo(p.px + 62, top + 16); CX.lineTo(p.px + 2, top + 37); CX.closePath(); CX.fill();
    const crest = owner === 0 ? (MY.crest || ART.symWolf) : [ART.symAnchor, ART.symRing, ART.symWolf][owner % 3];
    if (crest && (crest.naturalWidth || crest.width)) CX.drawImage(crest, p.px - 14, top - 14, 28, 28);
    CX.strokeStyle = col; CX.lineWidth = 2; CX.beginPath(); CX.arc(p.px, top, 15, 0, 7); CX.stroke();
  }
}
function drawWorld() {
  if (!worldCv) {
    buildWorld();
  }
  /* The canvas first paints before an authenticated session is restored.
     Re-focus exactly once when the server later supplies the real home,
     otherwise the player can stay looking at the default North Garages. */
  /* The server-assigned home is authoritative. Do not centre the world on a
     stale browser save while the real home marker points to another district. */
  const homeIdx = PROVINCES.indexOf(homeProvince());
  if (!drawWorld._init || drawWorld._homeProvinceIdx !== homeIdx) {
    drawWorld._init = true;
    drawWorld._homeProvinceIdx = homeIdx;
    wZoom = .82;
    const me = homeProvince();
    wPanX = W / 2 - me.px * wZoom; wPanY = H / 2 - me.py * wZoom;
  }
  CX.fillStyle = '#05060b'; CX.fillRect(0, 0, W, H);
  CX.save();
  CX.translate(wPanX, wPanY); CX.scale(wZoom, wZoom);
  CX.drawImage(worldCv, 0, 0, worldCv._cssW, worldCv._cssH);

  /* маяки труб мигают */
  for (const b of beacons) {
    const on = Math.sin(T * 2 + b.ph) > .2;
    if (!on) continue;
    CX.drawImage(G_HEAD, b.x - 18, b.y - 18);
    CX.fillStyle = '#ff5d6c'; CX.fillRect(b.x - 1.6, b.y - 1.6, 3.2, 3.2);
  }
  /* тёплый огонёк на шпиле башни ЦЕНТРа — мягче и медленнее аварийных маяков труб,
     чтобы читался как «маяк отеля», а не как тревога */
  for (const b of goldBeacons) {
    const on = Math.sin(T * 1.1 + b.ph) > -.1;
    if (!on) continue;
    CX.drawImage(G_HEAD, b.x - 16, b.y - 16, 32, 32);
    CX.fillStyle = '#ffdf96'; CX.fillRect(b.x - 1.6, b.y - 1.6, 3.2, 3.2);
  }
  /* ветряки мира */
  for (const wm of windmillsW) {
    CX.strokeStyle = '#39406a'; CX.lineWidth = 2.4;
    CX.beginPath(); CX.moveTo(wm.x, wm.y); CX.lineTo(wm.x, wm.y - 26); CX.stroke();
    for (let k = 0; k < 3; k++) {
      const a = T * 1.3 + wm.ph + k * 2.094;
      CX.beginPath(); CX.moveTo(wm.x, wm.y - 26);
      CX.lineTo(wm.x + Math.cos(a) * 12, wm.y - 26 + Math.sin(a) * 12 * .6); CX.stroke();
    }
    CX.fillStyle = '#3ddc84'; CX.globalAlpha = .6 + .4 * Math.sin(T * 3 + wm.ph);
    CX.fillRect(wm.x - 1.2, wm.y - 27.2, 2.4, 2.4); CX.globalAlpha = 1;
  }
  /* баржи по реке: огонёк + кильватер */
  for (const bg2 of barges) {
    bg2.t += bg2.v * bg2.dir;
    if (bg2.t > 1) bg2.t = 0; if (bg2.t < 0) bg2.t = 1;
    const [x, y] = riverPoint(bg2.t);
    CX.fillStyle = 'rgba(140,180,255,.25)';
    CX.fillRect(x - 6, y - 2, 12, 4);
    CX.drawImage(G_WARM, x - 7, y - 7);
    CX.fillStyle = '#ffcf6e'; CX.fillRect(x - 1.4, y - 1.4, 2.8, 2.8);
  }
  /* подсветка провинции под курсором */
  if (wHover) {
    CX.strokeStyle = P.gold + 'cc'; CX.lineWidth = 2 / wZoom;
    CX.setLineDash([8 / wZoom, 6 / wZoom]); CX.lineDashOffset = -T * 30;
    CX.beginPath();
    CX.arc(wHover.px, wHover.py, 150, 0, 7); CX.stroke();
    CX.setLineDash([]);
  }
  drawTerritoryOwnership();
  drawSiegeControl();
  /* Home is not crew territory. Give it its own bright, stable landmark so
     players can find their garage even if the surrounding blocks are owned
     by other crews or covered with flags. */
  {
    const home = homeProvince();
    const bob = Math.sin(T * 2.2) * 3;
    const y = home.py - 82 + bob;
    const label = LANG === 'en' ? 'YOUR GARAGE' : 'ТВОЙ ГАРАЖ';
    CX.save();
    CX.globalCompositeOperation = 'lighter';
    CX.fillStyle = 'rgba(245,197,66,.20)'; CX.beginPath(); CX.arc(home.px, y, 48, 0, 7); CX.fill();
    CX.strokeStyle = '#ffd85a'; CX.lineWidth = 3.2; CX.beginPath(); CX.arc(home.px, y, 29, 0, 7); CX.stroke();
    CX.globalCompositeOperation = 'source-over';
    CX.fillStyle = '#111725'; CX.fillRect(home.px - 19, y - 10, 38, 24);
    CX.fillStyle = '#f5c542'; CX.fillRect(home.px - 16, y - 7, 32, 18);
    CX.fillStyle = '#1b2132'; CX.fillRect(home.px - 11, y + 1, 22, 10);
    CX.fillStyle = '#e9f4ff'; CX.fillRect(home.px - 10, y - 5, 8, 5); CX.fillRect(home.px + 3, y - 5, 8, 5);
    CX.font = '800 14px Segoe UI'; CX.textAlign = 'center';
    CX.shadowColor = '#000'; CX.shadowBlur = 7; CX.fillStyle = '#ffe783';
    CX.fillText(label, home.px, y - 42);
    CX.restore();
  }
  /* туман над неразведанным: тёмные клубы дышат */
  for (const p of PROVINCES) {
    if (p.explored) continue;
    for (let k = 0; k < 6; k++) {
      const a = k * 1.047 + p.px * .01;
      const fx = p.px + Math.cos(a + T * .05) * (70 + (k % 3) * 75);
      const fy = p.py + Math.sin(a + T * .04) * (55 + (k % 2) * 60);
      CX.save();
      CX.globalAlpha = .5 + .12 * Math.sin(T * .3 + k);
      CX.translate(fx, fy); CX.scale(2.1, 1.35);
      CX.globalCompositeOperation = 'source-over';
      const fg = CX.createRadialGradient(0, 0, 0, 0, 0, 120);
      fg.addColorStop(0, 'rgba(10,12,22,.95)');
      fg.addColorStop(.7, 'rgba(14,17,30,.55)');
      fg.addColorStop(1, 'rgba(14,17,30,0)');
      CX.fillStyle = fg; CX.beginPath(); CX.arc(0, 0, 120, 0, 7); CX.fill();
      if (ok(ART.cloud)) {                 // клубы: картинка поверх тёмного пятна
        CX.globalAlpha *= .38;
        CX.drawImage(ART.cloud, -150, -130, 300, 260);
      }
      CX.restore();
    }
  }
  CX.globalAlpha = 1;
  drawWorldCars();
  drawWorldMarches();
  /* ленты-названия */
  for (const p of PROVINCES) {
    if (!p.explored) {
      ribbon(p.px, p.py + 10, '???', canExploreProvince(p) ? 'неразведано — клик: разведка' : lockedProvinceText(p), wHover === p);
      continue;
    }
    const shared = sharedProvinceControl(p);
    const held = shared.held;
    const own = p.gang === 0 ? '✓ ТВОЙ РАЙОН'
      : held >= ((window.PROVINCE_CONTROL && window.PROVINCE_CONTROL.dominance) || 30) ? `⚑ DOMINATING ${held}/49`
        : held >= ((window.PROVINCE_CONTROL && window.PROVINCE_CONTROL.influence) || 25) ? `INFLUENCE ${held}/49`
          : held >= ((window.PROVINCE_CONTROL && window.PROVINCE_CONTROL.presence) || 13) ? `PRESENCE ${held}/49`
            : p.gang >= 0 ? ((GANGS[p.gang] || {}).name || 'Банда')
              : shared.owner >= 0 ? `${(GANGS[shared.owner] || {}).name || 'Банда'} · ${held}/49` : 'нейтрально';
    ribbon(p.px, p.py + 62, p.name, own, wHover === p, p.gang >= 0 ? p.gang : shared.owner);
  }
  CX.restore();
  drawClouds();
}

/* ---- панель района и марши по большой карте ----
   Раньше клик по району сразу проваливал в город — мир был просто меню.
   Теперь это выбор: войти самому или послать марш, как в квартальном виде. */
let wSelected = null;
const worldMarches = [];   // {road, t, dir, from, to, cars}
function showWorldPanel(p) {
  wSelected = p;
  const el = document.getElementById('wpanel');
  const home = homeProvince();
  document.getElementById('w-type').textContent = tr(
    p === home ? 'твой район' : p.gang === 0 ? 'земля твоей банды'
      : p.siegedBy === 0 ? 'штурм района: забери все кварталы'
      : p.gang > 0 ? 'чужая земля' : 'нейтральная земля');
  document.getElementById('w-name').textContent = p.name;
  document.getElementById('w-gang').textContent = p.gang >= 0 ? ((GANGS[p.gang] || {}).name || tr('нейтрально')) : tr('нейтрально');
  document.getElementById('w-gang').style.color = p.gang >= 0 ? (GANGS[p.gang] || { c: 'var(--dim)' }).c : 'var(--dim)';
  document.getElementById('w-store').textContent = Math.round(p.store).toLocaleString('ru') + ' BAND';
  const d = Math.round(marchDistanceKm(home, p));
  document.getElementById('w-dist').textContent = p === home ? tr('ты здесь') : tr(d + ' км') + ' · ' + clockLeft(marchDurationMs(home, p));
  const bonus = provinceBonus(p);
  document.getElementById('w-bonus').textContent = bonus.label;
  document.getElementById('w-income').textContent = p.gang === 0 && p !== home
    ? `+${bonus.income.toLocaleString('ru')} BAND/${LANG === 'en' ? 'day' : 'сут.'}` : tr(`после захвата: +${bonus.income.toLocaleString('ru')}`);
  const progress = worldProgress();
  document.getElementById('w-stage').textContent = tr(`этап ${progress.tier}/4 · ${progress.held} район(а)`);
  const mb = document.getElementById('w-march');
  const canMarch = p !== home && p.type !== 'center' && p.type !== 'wind';
  mb.disabled = !canMarch;
  mb.style.opacity = canMarch ? 1 : .4;
  mb.title = tr(canMarch ? 'Отправить марш' : (p.type === 'center' ? 'Центр захватывается через KvK' : p.type === 'wind' ? 'Ветряное поле — особый объект' : 'Ты уже здесь'));
  /* «Рынок» — единственная провинция с настоящим внутренним рынком асиков
     (13.08, третий заход): кнопка есть только у неё, остальные районы этой
     функции не получают, чтобы не плодить магазин на каждом углу карты. */
  document.getElementById('w-market').style.display = p.market ? 'block' : 'none';
  /* Подсказка «что дальше». Игрок брал свой район и упирался в тишину: карта
     не говорила ни что соседей можно штурмовать маршем, ни что к Центру ведут
     ровно три района. MP_CENTER_GATE приходит с сервера и знает и пороги, и
     чего не хватает — берём оттуда, а не дублируем правила в клиенте. */
  const hint = document.getElementById('w-hint');
  if (hint) {
    const gate = typeof MP_CENTER_GATE !== 'undefined' ? MP_CENTER_GATE : null;
    const pIdx = PROVINCES.indexOf(p);
    const cand = gate && Array.isArray(gate.candidates) ? gate.candidates.find(c => c.idx === pIdx) : null;
    const need = (gate && gate.requiredCaptures) || 33;
    let text = '';
    if (p === home) {
      text = 'Твой дом. Отсюда выходят марши: выбери соседний район и жми «Отправить марш» — придёт осада, дальше кварталы берут внутри района.';
    } else if (cand) {
      text = (cand.controlled && cand.captured >= need && cand.hasFlag)
        ? 'Район-сосед Центра уже под твоей бандой — путь к отелю открыт.'
        : `Район-сосед Центра. Возьми ${need} кварталов и поставь флаг банды — откроется борьба за Центр и отель.`;
    } else if (p.type === 'center') {
      /* Список соседей считает сервер по карте - берём его оттуда, а не
         повторяем названия в тексте: они разъехались бы при первом же
         изменении карты. */
      const names = gate && Array.isArray(gate.candidates) && gate.candidates.length
        ? gate.candidates.map(c => tr(c.name)).join(', ') : '';
      text = names
        ? `Центр берут только на еженедельном KvK и только через район-сосед: ${names}.`
        : 'Центр берут только на еженедельном KvK и только через район, граничащий с ним.';
    } else if (canMarch) {
      text = 'Соседний район: марш открывает осаду, дальше кварталы берут внутри района.';
    }
    hint.textContent = text;
    hint.style.display = text ? 'block' : 'none';
  }
  el.style.display = 'block';
}
document.getElementById('w-market').onclick = () => {
  document.getElementById('wpanel').style.display = 'none';
  marketOpen();
};
document.getElementById('w-enter').onclick = () => {
  document.getElementById('wpanel').style.display = 'none';
  const home = homeProvince();
  const selectedIdx = PROVINCES.indexOf(wSelected);
  const target = selectedIdx >= 0 ? wSelected : home;
  const targetIdx = PROVINCES.indexOf(target);
  toast(`Вхожу в район: ${target.name}…`);
  /* Раньше тут был тернарник на 2 варианта (ЦЕНТР/дом), сейчас у каждого из
     22 районов свой замес в CITY_CFGS по ИМЕНИ (см. определение выше) — так
     что просто смотрим, есть ли запись под этим именем, и если нет —
     запасной DEFAULT_CITY_CFG (сейчас такого случая быть не должно). */
  /* Keep the real province identity even when it uses DEFAULT_CITY_CFG.
     `switchCityVariant()` uses this identity to decide whether the selected
     city is the player's home; replacing it with the literal `default`
     made a world-map garage open as an ordinary district. */
  const variant = targetIdx === PROVINCES.indexOf(home) ? home.name : target.name;
  window.activeWorldProvinceIdx = targetIdx;
  setTimeout(() => { switchCityVariant(variant); scene = 'city'; syncSceneUI(); }, 500);
};
/* Дорога между двумя провинциями, если она есть на карте, иначе прямая линия —
   раньше это было написано один раз внутри клика игрока; ботам для их маршей
   нужна та же функция, дублировать её означало через полгода чинить в двух
   местах одно и то же. */
function roadBetween(from, to) {
  let road = worldRoads.find(r =>
    (Math.hypot(r.a[0] - from.px, r.a[1] - from.py) < 5 && Math.hypot(r.b[0] - to.px, r.b[1] - to.py) < 5) ||
    (Math.hypot(r.b[0] - from.px, r.b[1] - from.py) < 5 && Math.hypot(r.a[0] - to.px, r.a[1] - to.py) < 5));
  let dir = 1;
  if (road && Math.hypot(road.a[0] - from.px, road.a[1] - from.py) > 5) dir = -1;
  if (!road) road = { a: [from.px, from.py], c: [(from.px + to.px) / 2, (from.py + to.py) / 2], b: [to.px, to.py] };
  return { road, dir };
}
document.getElementById('w-march').onclick = () => {
  if (!wSelected) return;
  /* Мультиплеер: марш запускает и разрешает сервер (общий для всех друзей),
     локально ничего не двигаем — марш появится, когда придёт world_march_started. */
  /* Online play is server-authoritative. Do not create a private animated
     march while the socket is reconnecting: it cannot affect the real map. */
  const relay = window.MP;
  if (relay || /(^|\.)mininggang\.online$/i.test(window.location.hostname)) {
    if (!relay || !relay.connected || !relay.ready) {
      toast(LANG === 'en' ? 'The world server is reconnecting. No local march was started.' : 'Сервер мира переподключается. Локальный марш не создан.');
      return;
    }
    if (typeof crewCanManageTactics === 'function' && !crewCanManageTactics()) {
      toast(LANG === 'en' ? 'Only the leader or an officer can start a crew rally. Join an active rally instead.' : 'Начать ралли может только главарь или заместитель.');
      return;
    }
    if (!relay.send('launch_world_march', { toIdx: PROVINCES.indexOf(wSelected) })) {
      toast(LANG === 'en' ? 'The world server is reconnecting. Try starting the rally again in a moment.' : 'Сервер мира переподключается. Попробуй начать ралли через секунду.');
      return;
    }
    if (typeof gar !== 'undefined') gar.shield = 0;
    document.getElementById('wpanel').style.display = 'none';
    return;
  }
  const home = homeProvince();
  const { road, dir } = roadBetween(home, wSelected);
  const durationMs = marchDurationMs(home, wSelected);
  worldMarches.push({ road, t: dir > 0 ? 0 : 1, dir, from: home, to: wSelected, gang: 0,
    col: GANGS[0].c, startTime: Date.now(), durationMs });
  renderMarchModal();
  toast(`Марш вышел на ${wSelected.name}: ${clockLeft(durationMs)} в пути.`);
  document.getElementById('wpanel').style.display = 'none';
};

/* Марш дошёл до провинции. Раньше здесь только вычитался склад и очки
   зачислялись игроку в лоб — марш ботов существовать не мог технически: не
   было ни атакующей банды, ни смены владельца. Из-за этого карта провинций
   застывала точно так же, как раньше застывала карта района (см. resolveMarch
   для города) — своя земля навсегда, чужая навсегда. Правило переноса
   владения то же самое: чужую берут с шансом по соотношению силы банд,
   нейтральную почти всегда, дом игрока (СЕВЕРНЫЕ ГАРАЖИ) не отбирают никогда. */
function resolveWorldMarch(m) {
  const worldHome = homeProvince();
  const taken = Math.round(m.to.store * .55 * (m.gang === 0 ? territoryMarchMultiplier() : 1));
  m.to.store = Math.max(0, m.to.store - taken);
  if (m.gang >= 0) GANGS[m.gang].score += taken;

  let flipped = false;
  if (m.to !== worldHome && m.to.type !== 'wind' && m.to.type !== 'center' && m.from.gang !== m.to.gang) {
    if (m.gang === 0) {
      m.to.siegedBy = 0;
    } else {
      const atk = m.gang >= 0 ? GANGS[m.gang].score : 0;
      const def = m.to.gang >= 0 ? GANGS[m.to.gang].score : 0;
      const p = m.to.gang < 0 ? .8 : Math.min(.45, Math.max(.05, .25 * atk / Math.max(1, def)));
      if (Math.random() < p) { m.to.gang = m.gang; flipped = true; worldCv = null; }
    }
  }

  const playerInvolved = m.gang === 0 || m.to === worldHome || m.to.gang === 0;
  if (m.gang === 0) {
    showMarchResult(m, taken, flipped);
    toast(`Марш дошёл: ${m.to.name}. Унесено ${taken.toLocaleString('ru')} BAND. Штурм открыт: захвати все кварталы внутри района.`);
    if (flipped) evShow('bg_flag.jpg', 'РАЙОН ВЗЯТ', `${m.to.name} теперь под твоим цветом.`);
  } else if (playerInvolved && flipped) {
    toast(`${m.gang >= 0 ? GANGS[m.gang].name : 'Банда'} забрала ${m.to.name}.`);
  }
}

function drawWorldMarches() {
  for (let i = worldMarches.length - 1; i >= 0; i--) {
    const m = worldMarches[i];
    /* Марши из мультиплеера (_mpId) идут по времени сервера — так у всех
       друзей, независимо от FPS и момента подключения, колонна в один и тот
       же миг стоит в одной и той же точке дороги. Разрешает их тоже сервер:
       мы просто убираем маршрут по приходу world_march_resolved (см. MP). */
    let done;
    if (m._mpId) {
      const progress = Math.max(0, Math.min(1, (Date.now() - m.startTime) / m.durationMs));
      m.t = m.dir > 0 ? progress : 1 - progress;
      done = false;
    } else {
      const progress = Math.max(0, Math.min(1, (Date.now() - m.startTime) / m.durationMs));
      m.t = m.dir > 0 ? progress : 1 - progress;
      done = progress >= 1;
    }
    if (m.kind === 'crew') {                       // one shared crew truck
      const [x, y] = bez(m.road, m.t);
      const bounce = Math.sin(T * 8) * 1.5;
      CX.save();
      CX.translate(x, y + bounce);
      CX.shadowColor = m.col || '#3ddc84'; CX.shadowBlur = 16;
      CX.fillStyle = '#151923'; CX.fillRect(-18, -10, 36, 20);
      CX.fillStyle = m.col || '#3ddc84'; CX.fillRect(-15, -8, 24, 12);
      CX.fillStyle = '#0b0d14'; CX.fillRect(10, -8, 7, 12);
      CX.fillStyle = '#dfe6f3'; CX.fillRect(11, -6, 4, 5);
      CX.fillStyle = '#06070b'; CX.beginPath(); CX.arc(-10, 11, 5, 0, 7); CX.arc(10, 11, 5, 0, 7); CX.fill();
      CX.fillStyle = '#fff3c9'; CX.fillRect(17, -4, 3, 4); CX.fillRect(17, 3, 3, 4);
      CX.restore();
      CX.font = '800 10px Segoe UI'; CX.textAlign = 'center'; CX.fillStyle = '#f7d46a';
      CX.fillText('CREW TRUCK', x, y - 22);
    } else if (m.kind === 'player') {             // one personal raid car
      const [x, y] = bez(m.road, m.t);
      CX.save(); CX.translate(x, y + Math.sin(T * 10) * 1.2);
      CX.shadowColor = m.col || '#f5c542'; CX.shadowBlur = 14;
      CX.fillStyle = '#121722'; CX.fillRect(-14, -7, 28, 14);
      CX.fillStyle = m.col || '#f5c542'; CX.fillRect(-9, -6, 14, 9);
      CX.fillStyle = '#8bd7ff'; CX.fillRect(6, -5, 5, 5);
      CX.fillStyle = '#06070b'; CX.beginPath(); CX.arc(-8, 8, 4, 0, 7); CX.arc(9, 8, 4, 0, 7); CX.fill();
      CX.restore();
      CX.font = '800 10px Segoe UI'; CX.textAlign = 'center'; CX.fillStyle = '#fff3c9';
      CX.fillText('RAID CAR', x, y - 19);
    } else for (let k = 0; k < 3; k++) {          // bot convoy
      const tt = Math.max(0, Math.min(1, m.t - k * .035 * m.dir));
      const [x, y] = bez(m.road, tt);
      CX.globalAlpha = .85;
      CX.drawImage(G_HEAD, x - 20, y - 20, 40, 40);
      CX.fillStyle = k === 0 ? m.col : '#fff3c9';
      CX.fillRect(x - 2, y - 2, 4, 4);
      CX.globalAlpha = 1;
    }
    if (done) {
      resolveWorldMarch(m);
      worldMarches.splice(i, 1);
    }
  }
  renderWorldMarchStatus();
}

let lastMarchStatus = '';
let marchResult = null;
function showMarchResult(m, taken, flipped) {
  marchResult = { to: m.to.name, taken, flipped, until: Date.now() + 20000 };
  renderMarchModal();
}
function renderMarchModal() {
  const el = document.getElementById('march-modal');
  if (!el) return;
  const now = Date.now();
  if (marchResult && now < marchResult.until) {
    el.className = 'result';
    const gain = marchResult.taken >= 0;
    el.innerHTML = `<div class="mm-title">Марш завершён</div><div class="mm-route">${marchResult.to}</div>` +
      `<div class="mm-row"><span>${gain ? 'Добыча' : 'Потеря снабжения'}</span><b>${gain ? '+' : '−'}${Math.abs(marchResult.taken).toLocaleString('ru')} BAND</b></div>` +
      `<div class="mm-row"><span>Результат</span><b>${marchResult.flipped ? 'победа' : 'рейд завершён'}</b></div>`;
    el.style.display = 'block';
    return;
  }
  if (marchResult) marchResult = null;
  /* A short line in the live journal is easy to miss. Keep one clear card
     visible for both local and server rallies until the convoy is resolved. */
  if (typeof activeRally !== 'undefined' && activeRally) {
    const left = Math.max(0, activeRally.end - now);
    const serverRally = !!activeRally.server;
    el.className = '';
    el.innerHTML = `<div class="mm-title">${serverRally ? '🚚 РАЛЛИ БАНДЫ — СБОР' : '⚔ СБОР РАЛЛИ'}</div><div class="mm-route">Штурм: ${activeRally.target.name}</div>` +
      `<div class="mm-row"><span>Лидер</span><b>${mgEsc(activeRally.leader || 'Ты')}</b></div>` +
      `<div class="mm-row"><span>Участников</span><b>${activeRally.joined}/${activeRally.capacity || 10}</b></div>` +
      `<div class="mm-row"><span>Сила ралли</span><b>${(activeRally.power || 0).toLocaleString('ru')} TH</b></div>` +
      `<div class="mm-row"><span>${serverRally ? 'Выезд через' : 'Выход через'}</span><b>${clockLeft(left)}</b></div>`;
    el.style.display = 'block';
    return;
  }
  const home = homeProvince();
  let m = worldMarches.find(x => x.kind === 'player' && (Number(x.ownerId) === Number(ACC.id) || x.targetName === ACC.name)) || worldMarches.find(x => x.kind === 'crew') || worldMarches.find(x => x.to === home && x.gang !== 0);
  let cityMarch = false;
  if (!m && typeof marches !== 'undefined') {
    /* On an online district assault the local source is a technical city
       anchor, not the home garage. `serverCity` is therefore the reliable
       ownership flag for the outgoing convoy. */
    m = marches.find(x => x.serverCity) || marches.find(x => x.from && x.from.mine) || marches.find(x => x.to && x.to.mine);
    cityMarch = !!m;
  }
  if (!m) { el.style.display = 'none'; return; }
  const personal = !cityMarch && m.kind === 'player';
  const incoming = cityMarch ? !(m.serverCity || m.from.mine) : personal ? m.targetName === ACC.name : m.to === home && m.gang !== 0;
  const leftMs = Math.max(0, m.durationMs - (now - m.startTime));
  const distance = cityMarch ? Math.max(1, Math.round(m.len * .45)) : Math.round(marchDistanceKm(m.from, m.to));
  const route = cityMarch
    ? incoming ? `${m.from.name} → ${LANG === 'en' ? 'your garage' : 'твой гараж'}` : `${LANG === 'en' ? 'Your crew' : 'Твоя банда'} → ${m.to.name}`
    : personal ? (incoming ? `${m.ownerName} → ${LANG === 'en' ? 'your garage' : 'твой гараж'}` : `${LANG === 'en' ? 'Your car' : 'Твоя машина'} → ${m.targetName}`) : incoming ? `${GANGS[m.gang]?.name || (LANG === 'en' ? 'Enemy crew' : 'Чужая банда')} → ${LANG === 'en' ? 'your garage' : 'твой гараж'}` : `${LANG === 'en' ? 'Your crew' : 'Твоя банда'} → ${m.to.name}`;
  el.className = incoming ? 'incoming' : '';
  el.innerHTML = `<div class="mm-title">${incoming ? '⚠ ВРАЖЕСКИЙ МАРШ' : cityMarch ? '🚚 ШТУРМОВАЯ КОЛОННА В ПУТИ' : m.kind === 'crew' ? '🚚 ГРУЗОВИК БАНДЫ В ПУТИ' : '🚙 ЛИЧНЫЙ РЕЙД В ПУТИ'}</div><div class="mm-route">${route}</div>` +
    `<div class="mm-row"><span>Расстояние</span><b>${distance} км</b></div>` +
    `<div class="mm-row"><span>Осталось идти</span><b>${clockLeft(leftMs)}</b></div>`;
  el.style.display = 'block';
}
setInterval(renderMarchModal, 250);
function renderWorldMarchStatus() {
  const el = document.getElementById('march-status');
  if (!el) return;
  if (scene !== 'world' || !worldMarches.length) { el.style.display = 'none'; return; }
  const home = homeProvince();
  const rows = worldMarches.slice(0, 4).map(m => {
    const personal = m.kind === 'player';
    const incoming = personal ? m.targetName === ACC.name : m.to === home && m.gang !== 0;
    const mine = m.kind === 'crew' || (personal && Number(m.ownerId) === Number(ACC.id));
    const left = clockLeft(Math.max(0, m.durationMs - (Date.now() - m.startTime)));
    const label = incoming ? `⚠ Raid incoming → ${home.name}` : personal && mine ? `🚙 Your raid → ${m.targetName}` : mine ? `🚚 Crew truck → ${m.to.name}` : `${GANGS[m.gang]?.name || 'Crew'} → ${m.to.name}`;
    return `<div class="mr ${incoming ? 'in' : ''}"><span>${label}</span><b>${left}</b></div>`;
  }).join('');
  const html = `<div class="mh">марши в пути</div>${rows}`;
  if (html !== lastMarchStatus) { el.innerHTML = html; lastMarchStatus = html; }
  el.style.display = 'block';
  renderMarchModal();
}

/* Боты ходят и по большой карте, не только по району — иначе провинции стоят
   декорацией до первого клика игрока, а вернувшись через десять минут он
   видит ту же карту, что оставил. Реже, чем в городе (провинции крупнее,
   дорога длиннее), и только между уже разведанными землями — под туманом
   маршей не бывает, туда сначала нужно послать Шныря.                       */
setInterval(() => {
  /* В мультиплеере ботов мира и добычу провинций считает сервер один раз на
     всех и рассылает — если считать их ещё и локально, карта будет дважды
     жить своей жизнью и разъезжаться между друзьями. */
  if (typeof MP !== 'undefined' && MP.connected) return;
  if (worldMarches.length >= 1) return;
  const froms = PROVINCES.filter(p => p.gang >= 1 && p.explored);         // боты — банды 1 и 2
  const tos = PROVINCES.filter(p => p.explored && p.store > 300 && p.type !== 'wind' && p.type !== 'center');
  if (!froms.length || !tos.length || Math.random() > .5) return;
  const f = froms[Math.floor(Math.random() * froms.length)];
  const cand = tos.filter(t => t !== f && t.gang !== f.gang);
  if (!cand.length) return;
  cand.sort((a, b) => (b.store / (1 + (b.gang >= 0 ? GANGS[b.gang].score : 0)))
                    - (a.store / (1 + (a.gang >= 0 ? GANGS[a.gang].score : 0))));
  const to = cand[Math.floor(Math.random() * Math.min(3, cand.length))];
  const { road, dir } = roadBetween(f, to);
  worldMarches.push({ road, t: dir > 0 ? 0 : 1, dir, from: f, to, gang: f.gang, col: GANGS[f.gang].c,
    startTime: Date.now(), durationMs: marchDurationMs(f, to) });
}, 11000);

/* Разведанные провинции копят добычу сами, как кварталы города — иначе после
   пары маршей грабить на карте нечего, и живой мир на ней снова замирает. */
setInterval(() => {
  if (typeof MP !== 'undefined' && MP.connected) return;   // сервер уже прислал/пришлёт provinces_tick
  for (const p of PROVINCES) {
    if (!p.explored || p === homeProvince()) continue;
    p.store = Math.min(6000, p.store + Math.round(140 + Math.random() * 260));
    /* сеть живая даже без кликов игрока: хешрейт районов слегка дрейфует —
       кто-то докупил ригов, у кого-то асик встал. ±5% за тик. */
    p.hash = Math.max(100, Math.round(p.hash * (1 + (Math.random() - .5) * .10)));
  }
}, 8000);

/* ввод мира */
let wDrag = null;
function worldMouseDown(e) {
  wDrag = { x: e.clientX - wPanX, y: e.clientY - wPanY, moved: 0 };
}
function worldMouseMove(e) {
  if (wDrag) {
    wDrag.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
    wPanX = e.clientX - wDrag.x; wPanY = e.clientY - wDrag.y;
  } else {
    /* Курсор над панелью района или другим HUD — это не наведение на карту.
       Раньше район ПОД панелью подсвечивался лентой, будто игрок целится в
       него: так и «подсвечивалась ТЭЦ», пока мышь шла к кнопке. Проверка
       стоит после ветки перетаскивания — тянуть карту с курсором над панелью
       по-прежнему можно. */
    if (e.target !== CV) { wHover = null; return; }
    const wx = (e.clientX - wPanX) / wZoom, wy = (e.clientY - wPanY) / wZoom;
    wHover = (wx >= 0 && wy >= 0 && wx < WORLD_W && wy < WORLD_H) ? provAt(wx, wy) : null;
    CV.style.cursor = wHover ? 'pointer' : 'grab';
  }
}
function worldClick(e) {
  if (wDrag && wDrag.moved > 6) return;
  const wx = (e.clientX - wPanX) / wZoom, wy = (e.clientY - wPanY) / wZoom;
  if (wx < 0 || wy < 0 || wx >= WORLD_W || wy >= WORLD_H) return;
  /* The garage marker is deliberately drawn above the district centre.  It
     used to be processed as a generic map click, so a click on its icon could
     pick a nearby province instead of the player's actual home. */
  const home = homeProvince();
  const markerY = home.py - 82;
  if (Math.hypot(wx - home.px, wy - markerY) <= 72) {
    showWorldPanel(home);
    return;
  }
  const p = provAt(wx, wy);
  if (!p.explored) {
    if (!canExploreProvince(p)) {
      toast(`Окраина пока закрыта: ${lockedProvinceText(p)}.`);
      return;
    }
    p.explored = true;
    worldCv = null;                       // мир перерисуется уже с огнями района
    beacons.length = 0; goldBeacons.length = 0; windmillsW.length = 0; barges.length = 0;
    toast(`Шнырь разведал: ${p.name}. Теперь туда можно ходить маршем.`);
    if (typeof MP !== 'undefined' && MP.connected) MP.send('explore_province', { idx: PROVINCES.indexOf(p) });
    return;
  }
  showWorldPanel(p);
}
CV.addEventListener('wheel', e => {
  if (scene !== 'world') return;
  e.preventDefault();
  /* Помощник объявлен в city-renderer.js, который подключается раньше;
     проверка на всякий случай, если порядок скриптов когда-нибудь изменят. */
  const z = Math.max(.32, Math.min(1.6, wZoom * (typeof wheelZoomStep === 'function'
    ? wheelZoomStep(e) : (e.deltaY < 0 ? 1.12 : .89))));
  wPanX = e.clientX - (e.clientX - wPanX) * z / wZoom;
  wPanY = e.clientY - (e.clientY - wPanY) * z / wZoom;
  wZoom = z;
}, { passive: false });

function syncSceneUI() {
  document.getElementById('wbtn').textContent = tr(scene === 'world' ? 'В район' : 'Большая карта');
  document.getElementById('wbtn').setAttribute('aria-pressed', String(scene === 'world'));
  document.getElementById('homebtn').setAttribute('aria-pressed', String(scene === 'garage'));
  document.getElementById('hint').textContent = scene === 'world'
    ? 'клик по району — войти · колесо — масштаб'
    : 'колесо — масштаб · зажать — двигать карту';
  document.getElementById('whud').style.display = scene === 'world' ? 'flex' : 'none';
  const ownershipKey = document.getElementById('world-ownership-key');
  if (ownershipKey) ownershipKey.style.display = scene === 'world' ? 'block' : 'none';
  if (typeof renderMpWorldEvents === 'function') renderMpWorldEvents();
  if (scene !== 'world') document.getElementById('march-status').style.display = 'none';
}
