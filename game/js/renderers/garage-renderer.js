'use strict';

/* Canvas labels do not pass through the DOM translation observer. */
const canvasTr = s => typeof tr === 'function' ? tr(s) : s;

/* Shop cards use captures of the exact GLB variants installed on the shelves.
   The former concept illustrations looked different from the purchased hardware. */
Object.assign(ART_SRC, {
  asicLevel01: 'asic-model/rig-01.webp',
  asicLevel02: 'asic-model/rig-02.webp',
  asicLevel03: 'asic-model/rig-03.webp',
  asicLevel04: 'asic-model/rig-04.webp',
  asicLevel05: 'asic-model/rig-05.webp',
  asicLevel06: 'asic-model/rig-06.webp',
  asicLevel07: 'asic-model/rig-07.webp',
});

/* ============================ ГАРАЖ ИЗНУТРИ ===============================
   Свой гараж как «внутренний город» Forge of Empires: вошёл с карты — попал в
   помещение; ворота ведут обратно. Всё тот же процедурный стиль: бетон, стойки
   асиков с диодами, склад с золотом, вентилятор, пыль в луче лампы.           */
const gar = { dust: .34, store: 0, hash: 6, fan: false, coins: [], motes: [], burst: [] };
/* hash/store здесь — просто заглушки до объявления RIG_TYPES ниже, там же и
   переопределяются на настоящий стартовый риг (см. «Бесплатный старт»).     */

/* ============================ МАГАЗИН АСИКОВ ==============================
   Просьба (13.08): в гараже — магазин, где покупаешь любой тип и любое
   количество асиков за BAND или USDT, и они реально появляются в гараже —
   купил 3, значит стоят 3, хешрейт суммируется. gar.hash остаётся тем же
   рубильником, что и раньше (его читает вся экономика — dayYield, KVK,
   скины), просто теперь его наращивают ещё и покупки; ничего из старых
   формул трогать не пришлось. gar.rigInv — сколько чего куплено, отдельно
   от gar.hash, нужен только для витрины и для отрисовки стоек в гараже. */
/* Цены заданы в новой PoW-экономике: стартовый риг бесплатный, следующий
   покупается примерно за неделю активной игры, а цена за TH плавно падает у
   старших моделей. BAND здесь — игровая монета прототипа; выпуск настоящего
   токена и вывод должны жить на сервере и иметь отдельные лимиты. */
const RIG_TYPES = [
  /* Один узнаваемый форм-фактор Antminer: от ржавого старого до чистого
     флагмана. Экономика не меняется — заменены только модели на полках и в
     магазине. */
  { id: 'rig1', name: 'Старый',        art: 'asicLevel01', th: 6,   band: 25,   usdt: .25, heat: 'низкий',   rel: 72 },
  { id: 'rig2', name: 'Б/У',           art: 'asicLevel02', th: 15,  band: 70,   usdt: .70, heat: 'средний',  rel: 78 },
  { id: 'rig3', name: 'Восстановленный', art: 'asicLevel03', th: 28,  band: 130,  usdt: 1.3, heat: 'средний',  rel: 86 },
  { id: 'rig4', name: 'Крепкий',       art: 'asicLevel04', th: 50,  band: 230,  usdt: 2.3, heat: 'высокий',  rel: 89 },
  { id: 'rig5', name: 'Про',           art: 'asicLevel05', th: 88,  band: 400,  usdt: 4,   heat: 'высокий',  rel: 92 },
  { id: 'rig6', name: 'Премиум',       art: 'asicLevel06', th: 150, band: 680,  usdt: 6.8, heat: 'жаркий',  rel: 95 },
  { id: 'rig7', name: 'Титан',         art: 'asicLevel07', th: 245, band: 1100, usdt: 11,  heat: 'низкий',   rel: 98 },
];
gar.rigInv = {};
RIG_TYPES.forEach(r => gar.rigInv[r.id] = 0);
const rigOwnedTotal = () => Object.values(gar.rigInv).reduce((a, b) => a + b, 0);
/* Бесплатный старт (13.08): игра не должна начинаться с готового кошелька —
   каждый новый игрок получает ровно один стартовый риг (RIG_TYPES[0], тот
   самый «Стартовый», 6 TH) и ни одного BAND сверху. Хешрейт гаража = хешрейт
   этого рига и только его — раньше здесь стояла отдельная константа «для
   витрины», из-за которой бесплатный риг вообще ничего не менял в добыче. */
gar.hash = RIG_TYPES[0].th;
gar.rigInv[RIG_TYPES[0].id] = 1;

/* ============================ ЛИМИТ НАЛЁТОВ ================================
   Просьба (13.08): игрок-на-игрока — 10 налётов в сутки, нападать можно в
   любое время (никакого расписания, в отличие от войны банд ниже). Демо-
   сутки — тот же DAY_MS=60000, что и у KVK/склада, ради единообразия и живой
   проверки в рамках одной сессии. Счётчик и время сброса живут прямо в gar,
   поэтому сохраняются/восстанавливаются вместе со всем остальным гаражом. */
gar.raidCount = 0;
gar.raidReset = 0;
const RAID_DAILY_LIMIT = 10;
function raidsLeft() {
  if (Date.now() >= gar.raidReset) { gar.raidCount = 0; gar.raidReset = Date.now() + DAY_MS; }
  return RAID_DAILY_LIMIT - gar.raidCount;
}
/* места в гараже и внешность — по одному на возможного наёмника; кто реально
   стоит в гараже, решает список нанятых (gar.hired), см. garageMercs() */
const MERC_SPOTS = {
  'ШНЫРЬ':   { c: '#4a6a8a', ti: 3.3, tj: 4.9, smoke: false, av: 'avShnyr' },
  'КУВАЛДА': { c: '#6a4a7a', ti: 1.1, tj: 4.6, smoke: false, av: 'avKuvalda' },
  'СТАРИК':  { c: '#4a5a6a', ti: 2.2, tj: 0.8, smoke: false, av: 'avStarik' },
};
const garageMercs = () => gar.hired
  .filter(m => MERC_SPOTS[m.name])
  .map(m => ({ name: m.name, role: m.role, ...MERC_SPOTS[m.name] }));
/* охрана (13.08): отдельные слоты по периметру комнаты — не там, где стойки
   асиков (GRID_SLOTS) и не там, где старые наёмники (MERC_SPOTS), чтобы не
   налезали друг на друга. guardSprites() отдаёт объекты той же формы, что и
   garageMercs(), поэтому оба списка рисуются одним и тем же циклом.        */
const GUARD_SLOTS_OLD = [
  [5.5, 0.6], [5.5, 1.5], [5.5, 2.4], [5.5, 3.3], [5.5, 4.2],
  [0.5, 5.5], [1.4, 5.5], [2.3, 5.5], [3.2, 5.5], [4.1, 5.5],
];
/* 15.08: под картинку-фон точки пересчитаны так, чтобы охрана стояла на
   открытом полу, а не поверх прожектора/бочки/ямы, которые на этой картинке
   уже нарисованы (см. комментарий у heroRect в drawGarage). */
const GUARD_SLOTS_HERO = [
  [3.4, 5.3], [3.77, 2.47], [5.07, 2.77], [6.53, 3.23], [7.99, 3.69],
  [5.23, 5.17], [6.72, 5.92], [8.06, 6.5], [9.39, 7.09], [3.9, 4.58],
];
const GUARD_SLOTS = () => ok(ART.bgGarageHero) ? GUARD_SLOTS_HERO : GUARD_SLOTS_OLD;
const GUARD_COLORS = { bum: '#5a5a5a', athlete: '#2f6f4f' };
function guardSprites() {
  return gar.guards.map((g, i) => {
    const t = GUARD_TYPES.find(x => x.id === g.type);
    const w = WEAPON_TYPES.find(x => x.id === g.weapon);
    const slots = GUARD_SLOTS();
    const [ti, tj] = slots[i % slots.length];
    /* Каждый тип получает свой вариант при найме. Высота всех персонажей
       выравнивается ниже, в месте отрисовки. */
    const full = t.fullKeys[(g.variant || 0) % t.fullKeys.length];
    return { name: `${t.name} №${i + 1}`, role: w ? w.name : 'без оружия',
             c: GUARD_COLORS[g.type], ti, tj, smoke: false, av: t.avKey, full,
             guardIndex: i, guardType: g.type, variant: g.variant || 0 };
  });
}
gar.mercs = [];
for (let k = 0; k < 26; k++)
  gar.motes.push({ x: Math.random(), y: Math.random(), s: .3 + Math.random() * .9, ph: Math.random() * 7 });
let doorRect = null;
let mailRect = null;
let guardHitboxes = [];
let rigHitboxes = [];
/* 28.08: кадр комнаты текущего кадра отрисовки. Нужен снаружи drawGarage —
   и для показа асиков, и для их перетаскивания: без него асик привязан к
   канвасу, а комната при зуме растёт мимо него. `bx/by` — тот же кадр при
   зуме 1, в его долях позиции и хранятся. */
let garFrame = null;
let rigDrag = null;
let rigLayoutRevision = 0;
let rigLayoutDirty = false;
gar.rigPos = {};
let selectedGuard = null;

function enterGarage() {
  QST.entered = true;
  scene = 'garage';
  document.getElementById('panel').style.display = 'none';
  document.getElementById('ghud').style.display = 'flex';
  /* 28.08: #garage-title в разметке нет, а обращение к нему шло без проверки —
     enterGarage падал с TypeError ровно здесь, и всё, что ниже (миграция
     раскладки асиков, HUD дохода, звук, подсказка, тост), не выполнялось
     никогда. Элемент необязательный: если он появится, заголовок подсветится,
     если нет — вход в гараж всё равно доводится до конца. */
  const garageTitle = document.getElementById('garage-title');
  if (garageTitle) garageTitle.classList.add('on');
  const hintEl = document.getElementById('hint');
  if (hintEl) hintEl.textContent = canvasTr('клик по воротам или Esc — выход в город');
  /* Migrate layouts written by the previous raw-pixel version once, while the
     current viewport still shows the player where those rigs were placed.
     Thereafter every device receives the same proportional shelf layout. */
  migrateLegacyRigLayout();
  updateGarageIncomeHud();
  sndAmbient('garage');
  toast('Твоя база. Потяни ASIC за корпус — раскладка сохранится на сервере.');
}

function updateGarageIncomeHud() {
  const income = document.getElementById('g-income');
  if (!income || typeof dayYield !== 'function' || typeof powerCost !== 'function') return;
  const gross = dayYield();
  const bill = powerCost();
  const net = gross - bill;
  const fmt = n => (Math.abs(n) < 100 ? n.toFixed(2) : Math.round(n).toString()).replace('.', ',');
  income.textContent = `${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))} BAND`;
  income.style.color = net > 0 ? 'var(--green)' : (net === 0 ? 'var(--amber)' : 'var(--red)');
  income.title = `Добыча ${fmt(gross)} BAND − свет ${fmt(bill)} BAND`;
}
function exitGarage(immediate=false) {
  if(immediate!==true&&window.requestGarage3DExit?.())return;
  scene = 'city';
  document.getElementById('ghud').style.display = 'none';
  const garageTitleOut = document.getElementById('garage-title');
  if (garageTitleOut) garageTitleOut.classList.remove('on');
  const hintOut = document.getElementById('hint');
  if (hintOut) hintOut.textContent = canvasTr('колесо — масштаб · зажать — двигать карту');
  sndAmbient('city');
}
document.getElementById('g-exit').onclick = exitGarage;
/* The same account can be open on a phone and a desktop.  Server-side row
   locks protect the balance, while this small client mutex prevents a single
   device from sending duplicate clicks before the first response returns. */
let garageActionBusy = false;
async function runGarageAction(buttonId, action) {
  if (garageActionBusy) return;
  garageActionBusy = true;
  const button = document.getElementById(buttonId);
  const label = button && button.innerHTML;
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.style.opacity = '.68';
  }
  try {
    await action();
  } finally {
    garageActionBusy = false;
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.style.opacity = '';
      if (label) button.innerHTML = label;
    }
  }
}
document.getElementById('g-blow').onclick = () => runGarageAction('g-blow', async () => {
  if (typeof remoteProfile === 'function' && remoteProfile()) {
    try { await remoteBlowMining(); QST.blown = true; SFX.blow(); toast('Продувка подтверждена сервером.'); accSave(); }
    catch (e) { SFX.fail(); toast(e.message || 'Не удалось выполнить продувку. Проверь подключение и попробуй ещё раз.'); }
    return;
  }
  for (let k = 0; k < 40; k++)
    gar.burst.push({ x: .30 + Math.random() * .45, y: .35 + Math.random() * .4,
                     vx: (Math.random() - .5) * .012, vy: -.004 - Math.random() * .01, a: 1 });
  gar.dust = 0;
  QST.blown = true;
  SFX.blow();
  toast('Продувка! Пыль сброшена, хешрейт 100%.');
});
document.getElementById('g-take').onclick = () => runGarageAction('g-take', async () => {
  if (typeof remoteProfile === 'function' && remoteProfile()) {
    try {
      const data = await remoteCollectMining();
      QST.taken = true; SFX.coins();
      const raidText = data.raid ? ` ${data.raid.text}` : '';
      toast(`Добыча собрана. Баланс подтверждён сервером: ${Math.round(MY.band).toLocaleString('ru')} BAND.${raidText}`);
      accSave();
    } catch (e) { SFX.fail(); toast(e.message || 'Не удалось собрать добычу. Проверь подключение и попробуй ещё раз.'); }
    return;
  }
  if (gar.store < 1) { SFX.fail(); toast('Пока пусто — асики ещё копят.'); return; }
  SFX.coins();
  for (let k = 0; k < 14; k++)
    gar.coins.push({ x: .68 + Math.random() * .1, y: .62 + Math.random() * .06, t: -k * .06 });
  if (MY.gang) {                       // взнос банде: 8% с каждого сбора (v3.7)
    const dues = gar.store * 0.08;
    MY.gang.treasury += dues;
    gar.store -= dues;
  }
  MY.band += gar.store;
  QST.taken = true;
  toast(`Собрано ${Math.round(gar.store)} BAND — теперь их не отнять. В кошельке ${Math.round(MY.band).toLocaleString('ru')}.`);
  gar.store = 0;
});
function garageClick(x, y) {
  if (mailRect && x > mailRect[0] && x < mailRect[2] && y > mailRect[1] && y < mailRect[3]) { mailOpen(); return; }
  if (doorRect && x > doorRect[0] && x < doorRect[2] && y > doorRect[1] && y < doorRect[3]) { exitGarage(); return; }
  for (const h of guardHitboxes) {
    if (x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1) { selectedGuard = h.i; shopOpen('security'); return; }
  }
}
function garagePointerDown(x, y) {
  if (scene !== 'garage') return false;
  const h = [...rigHitboxes].reverse().find(r => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1);
  if (!h) return false;
  rigDrag = { n: h.n, key: h.posKey || String(h.n), dx: x - h.x, dy: y - h.y };
  CV.style.cursor = 'grabbing';
  return true;
}
function garagePointerMove(x, y) {
  if (!rigDrag) return false;
  /* Курсор даёт экранные пиксели; храним в кадре зума 1, иначе асик,
     подвинутый на зуме 2, сохранился бы со смещением. */
  gar.rigPos[rigDrag.key] = rigScreenToBase({ x: x - rigDrag.dx, y: y - rigDrag.dy });
  rigLayoutDirty = true;
  return true;
}

/* A Canvas has physical pixels (CV.width) but pointer events use CSS pixels.
   Saving the latter as raw pixels made a shelf layout jump after F5 on Retina,
   a phone, or simply after resizing the window.  Persist positions as a
   fraction of the visible playfield instead.  Old raw-pixel saves are still
   read below, then become relative as soon as that ASIC is moved again. */
/* Хранимое значение -> пиксели кадра при зуме 1. Доля канваса и «сырые»
   пиксели старых сохранений читаются как раньше. */
function rigStoredToBase(pos) {
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null;
  const relative = pos.x >= 0 && pos.x <= 1 && pos.y >= 0 && pos.y <= 1;
  return relative ? { x: pos.x * W, y: pos.y * H } : { x: pos.x, y: pos.y };
}
function rigBaseToScreen(p) {
  if (!p || !garFrame) return p;
  return { x: garFrame.x + (p.x - garFrame.bx) * garFrame.gz,
           y: garFrame.y + (p.y - garFrame.by) * garFrame.gz };
}
function rigScreenToBase(p) {
  if (!p || !garFrame || !garFrame.gz) return p;
  return { x: garFrame.bx + (p.x - garFrame.x) / garFrame.gz,
           y: garFrame.by + (p.y - garFrame.y) / garFrame.gz };
}
function rigPositionOnScreen(pos) { return rigBaseToScreen(rigStoredToBase(pos)); }
function rigLayoutSnapshot() {
  const width = Math.max(1, W || CV.clientWidth || 1);
  const height = Math.max(1, H || CV.clientHeight || 1);
  return Object.fromEntries(Object.entries(gar.rigPos).map(([key, pos]) => {
    /* Именно rigStoredToBase, а не rigPositionOnScreen: доля берётся от кадра
       при зуме 1. Иначе текущий зум запёкся бы в сохранённую раскладку. */
    const point = rigStoredToBase(pos);
    if (!point) return null;
    return [key, {
      x: Math.round(Math.max(0, Math.min(1, point.x / width)) * 100000) / 100000,
      y: Math.round(Math.max(0, Math.min(1, point.y / height)) * 100000) / 100000,
    }];
  }).filter(Boolean));
}
function migrateLegacyRigLayout() {
  if (!gar.rigPos || typeof gar.rigPos !== 'object') return;
  const hasLegacyPixels = Object.values(gar.rigPos).some(pos => pos &&
    Number.isFinite(pos.x) && Number.isFinite(pos.y) && (pos.x > 1 || pos.y > 1));
  if (!hasLegacyPixels) return;
  gar.rigPos = rigLayoutSnapshot();
  rigLayoutDirty = true;
  persistRigLayout();
  if (typeof accSave === 'function') accSave();
}
function persistRigLayout({ keepalive = false } = {}) {
  if (!rigLayoutDirty) return;
  const positions = rigLayoutSnapshot();
  /* Make the browser snapshot use exactly the same layout which is sent to
     PostgreSQL.  This also gives an immediate local fallback if a connection
     drops while the player is dragging. */
  gar.rigPos = positions;
  if (!(typeof remoteProfile === 'function' && remoteProfile()) || typeof serverRequest !== 'function') return;
  const revision = ++rigLayoutRevision;
  if (keepalive && typeof fetch === 'function') {
    const headers = { 'Content-Type': 'application/json' };
    if (ACC && ACC.token) headers.Authorization = `Bearer ${ACC.token}`;
    fetch('/api/garage/layout', { method: 'PUT', headers, body: JSON.stringify({ positions }), keepalive: true })
      .catch(error => console.warn('Could not save ASIC layout before leaving:', error && error.message));
    return;
  }
  void serverRequest('/garage/layout', 'PUT', { positions }).then(data => {
    if (revision !== rigLayoutRevision || !data || !data.garage) return;
    if (data.garage.rigPositions && typeof data.garage.rigPositions === 'object') {
      gar.rigPos = data.garage.rigPositions;
      rigLayoutDirty = false;
    }
  }).catch(error => console.warn('Could not save ASIC layout:', error && error.message));
}
function garagePointerUp() {
  if (!rigDrag) return false;
  rigDrag = null;
  CV.style.cursor = 'default';
  /* Do not wait for the ten-second profile snapshot.  An ASIC layout is saved
     as its own server-side garage field, so a refresh or a second device can
     never roll a just-finished drag back to an old shelf position. */
  persistRigLayout();
  if (typeof accSave === 'function') accSave();
  return true;
}

/* A regular fetch can be cancelled during F5.  keepalive lets the small
   layout request finish even while the old page is being destroyed. */
addEventListener('pagehide', () => persistRigLayout({ keepalive: true }));

/* коробка с произвольным тайлом */
function box2(c, x, y, tw, th, w, h, roof, wl, wr) {
  const hw = tw / 2 * w, hh = th / 2 * w;
  c.fillStyle = wl; c.beginPath();
  c.moveTo(x - hw, y); c.lineTo(x, y + hh); c.lineTo(x, y + hh - h); c.lineTo(x - hw, y - h); c.closePath(); c.fill();
  c.fillStyle = wr; c.beginPath();
  c.moveTo(x + hw, y); c.lineTo(x, y + hh); c.lineTo(x, y + hh - h); c.lineTo(x + hw, y - h); c.closePath(); c.fill();
  c.fillStyle = roof; c.beginPath();
  c.moveTo(x, y - h - hh); c.lineTo(x + hw, y - h); c.lineTo(x, y - h + hh); c.lineTo(x - hw, y - h); c.closePath(); c.fill();
}

let garage3DHudNextUpdate = 0;
function drawGarage() {
  // The 3D iframe animates independently. This function only presents the
  // parent's HUD in that mode; mining/economy updates live outside rendering.
  // Refresh at 10 Hz instead of rewriting the same DOM every display frame.
  if (window.garage3DVisible) {
    rigHitboxes.length = 0; guardHitboxes.length = 0; doorRect = null; mailRect = null;
    const now = performance.now();
    if (now < garage3DHudNextUpdate) return;
    garage3DHudNextUpdate = now + 100;
  } else {
    garage3DHudNextUpdate = 0;
  }
  /* состояние тикает */
  const eff = garEff();          // пыль и добыча тикают в mineTick, здесь только показ
  document.getElementById('g-hash').textContent = Math.round(gar.hash * eff) + ' TH';
  document.getElementById('g-hash').style.color = eff > .8 ? 'var(--green)' : (eff > .5 ? 'var(--amber)' : 'var(--red)');
  const bill = powerCost();
  updateGarageIncomeHud();
  document.getElementById('g-power').textContent = bill > 0
    ? '−' + (bill < 100 ? bill.toFixed(2).replace('.', ',') : Math.round(bill).toLocaleString('ru')) + ' BAND'
    : 'бесплатно';
  document.getElementById('g-power').style.color = bill > 0 ? 'var(--red)' : 'var(--green)';
  document.getElementById('g-dust').textContent = Math.round(gar.dust * 100) + '%';
  document.getElementById('g-store').textContent = Math.round(gar.store) + ' BAND';
  document.getElementById('g-prot').textContent = Math.round(Math.min(gar.store, whProtected())) + ' BAND';
  const titleStatus = document.getElementById('garage-title-status');
  if (titleStatus) {
    const rigs = typeof rigOwnedTotal === 'function' ? rigOwnedTotal() : 0;
    const health = Math.round(garEff() * 100);
    titleStatus.textContent = `${rigs} ASIC · ${health}% МОЩНОСТЬ`;
    titleStatus.style.color = health < 55 ? '#ff8d8d' : health < 80 ? '#f3ca72' : '#8ee2b4';
  }
  const shSt = document.getElementById('g-shield-st');
  shSt.style.display = gar.shield > 0 ? 'block' : 'none';
  if (gar.shield > 0) document.getElementById('g-shield').textContent = gar.shield + (LANG === 'en' ? ' d' : ' сут.');
  const riskEl = document.getElementById('g-risk');
  const openStore = gar.store - whProtected();
  if (gar.broken) {
    riskEl.textContent = canvasTr('ремонт нужен');
    riskEl.style.color = 'var(--red)';
  } else if (gar.dust >= .7) {
    riskEl.textContent = canvasTr('перегрев близко');
    riskEl.style.color = 'var(--red)';
  } else if (gar.dust >= .4) {
    riskEl.textContent = canvasTr('пыль растёт');
    riskEl.style.color = 'var(--amber)';
  } else if (gar.shield <= 0 && openStore >= dayYield() * .3) {
    riskEl.textContent = canvasTr('налёт возможен');
    riskEl.style.color = 'var(--amber)';
  } else {
    riskEl.textContent = canvasTr('гараж в порядке');
    riskEl.style.color = 'var(--green)';
  }
  if (typeof LANG !== 'undefined' && LANG === 'en') {
    const riskEN = {
      'ремонт нужен': 'repair needed', 'перегрев близко': 'overheating soon',
      'пыль растёт': 'dust rising', 'налёт возможен': 'raid risk',
      'гараж в порядке': 'garage secure',
    };
    riskEl.textContent = riskEN[riskEl.textContent] || riskEl.textContent;
  }

  // Keep the existing HUD/economy updates, but avoid drawing a hidden second room.
  if (window.garage3DVisible) return;
  /* 15.08 (просьба «полностью заменить фон» — картинка гаража от GPT вместо
     процедурной кладки): картинка встаёт letterbox'ом (contain-fit) в канвас,
     а изометрическая сетка at(i,j) пересчитана так, чтобы её (0,0)/(0,RM)/(RM,0)
     совпадали с дальним/левым/правым углом пола НА ЭТОЙ картинке — координаты
     угол ов сняты вручную по картинке с сеткой 10%. Без картинки — всё как раньше. */
  const RM = 6;
  let S, tw, th, cx, cy, heroRect = null;
  /* 28.08: масштаб гаража. Вся сцена построена от прямоугольника фоновой
     картинки (или от S в процедурном запасном варианте), поэтому зум — это
     один множитель здесь: за ним следуют пол, стены, риги и их хитбоксы. */
  /* Нижняя граница — ровно 1: фон вписан в экран по размеру (contain-fit),
     и всё, что меньше, добавляет чёрные поля по краям, ничего не показывая.
     «Отдалить» здесь значит вернуться к обзору из приближенного вида. */
  const gz = Math.max(1, Math.min(2.2, Number(window.garZoom) || 1));
  if (ok(ART.bgGarageHero)) {
    const imgAr = ART.bgGarageHero.naturalWidth / ART.bgGarageHero.naturalHeight;
    let bgw = W, bgh = W / imgAr;
    if (bgh > H) { bgh = H; bgw = H * imgAr; }
    bgw *= gz; bgh *= gz;
    heroRect = { x: (W - bgw) / 2, y: (H - bgh) / 2, w: bgw, h: bgh };
    /* Тот же прямоугольник при зуме 1 — опора для позиций асиков. */
    garFrame = { x: heroRect.x, y: heroRect.y, gz,
                 bx: (W - bgw / gz) / 2, by: (H - bgh / gz) / 2 };
    tw = .1608 * heroRect.w; th = .0625 * heroRect.h;
    cx = heroRect.x + .495 * heroRect.w; cy = heroRect.y + .710 * heroRect.h;
    S = th / .78;
  } else {
    S = Math.min(W / 15.5, H / 10.5) * gz;        // масштаб комнаты
    /* Процедурная комната растёт от центра канваса — берём его как кадр.
       Эта ветка работает только без фоновой картинки HQ. */
    garFrame = { x: (W - W * gz) / 2, y: (H - H * gz) / 2, gz, bx: 0, by: 0 };
    tw = S * 1.55; th = S * .78;
    cx = W / 2; cy = H / 2 + S * 3.1;
  }
  const at = (i, j) => [cx + (i - j) * tw / 2, cy + (i + j) * th / 2 - RM * th];
  const WH = S * 3.1;                            // высота стен

  /* СТАТИЧЕСКИЙ СЛОЙ ГАРАЖА.
     Пол, стены, текстуры и улица за воротами не меняются от кадра к кадру, а
     заливка паттерном по клипу — самая дорогая операция сцены. Рисуем один раз
     в офф-скрин, дальше только копируем. Тот же приём, что и в городе. */
  /* Статический слой кэшируется по размеру канваса — без масштаба в ключе
     он остался бы нарисованным в старом зуме. */
  const gkey = W + 'x' + H + '|' + DPR + '|' + gz.toFixed(3) + '|' + (ok(ART.texFloor) ? 1 : 0) + '|' + (ok(ART.bgGarageHero) ? 1 : 0);
  if (drawGarage._key !== gkey) {
    const cv = document.createElement('canvas');
    cv._cssW = W; cv._cssH = H;
    cv.width = Math.ceil(W * DPR); cv.height = Math.ceil(H * DPR);
    const GC = cv.getContext('2d');
    GC.setTransform(DPR, 0, 0, DPR, 0, 0);
    GC.imageSmoothingEnabled = true;
    GC.imageSmoothingQuality = 'high';
    const ANIM = {};
  if (heroRect) {
    /* ФОН-ГЕРОЙ: готовая изометрическая картинка вместо процедурной кладки.
       Леттербокс тем же тоном, что раньше было небо за воротами. */
    GC.fillStyle = '#05060a'; GC.fillRect(0, 0, W, H);
    GC.drawImage(ART.bgGarageHero, heroRect.x, heroRect.y, heroRect.w, heroRect.h);

    /* вытяжка/кондиционер — точка совпадает с нарисованным на картинке блоком
       (верхняя правая часть задней стены), поверх неё только «живой» блик,
       когда куплен апгрейд вентиляции (gar.fan). */
    {
      /* Центр двойной решётки вытяжки на фоновой картинке HQ. */
      const fx = heroRect.x + .545 * heroRect.w, fy = heroRect.y + .095 * heroRect.h;
      ANIM.fan = { fx, fy };
    }

    /* почтовый ящик — справа от ворот, на чистый кусок кладки между воротами и
       кондиционером (тот же журнал событий, что и раньше). */
    {
      /* Ящик закреплён на воротах и стал заметнее — в два раза крупнее. */
      const mx2 = heroRect.x + .295 * heroRect.w, my2 = heroRect.y + .315 * heroRect.h;
      const mw = S * .60, mh = S * .68;
      GC.save();
      shadowUnder(GC, mx2, my2 + mh * .45, S * .22, .22);
      if (ok(ART.mailboxArt)) {
        GC.drawImage(ART.mailboxArt, mx2 - mw * .7, my2 - mh * .7, mw * 1.4, mh * 1.4);
      } else {
        GC.fillStyle = '#1c1f2c';
        GC.beginPath(); GC.roundRect(mx2 - mw / 2, my2 - mh / 2, mw, mh, S * .035); GC.fill();
        GC.strokeStyle = 'rgba(0,0,0,.55)'; GC.lineWidth = 1.5; GC.stroke();
        GC.fillStyle = '#262a3c';
        GC.beginPath();
        GC.moveTo(mx2 - mw / 2, my2 - mh / 2);
        GC.lineTo(mx2 + mw / 2, my2 - mh / 2);
        GC.lineTo(mx2 + mw / 2 - S * .02, my2 - mh / 2 - S * .07);
        GC.lineTo(mx2 - mw / 2 + S * .02, my2 - mh / 2 - S * .07);
        GC.closePath(); GC.fill();
        GC.strokeStyle = 'rgba(0,0,0,.5)'; GC.lineWidth = 1; GC.stroke();
        GC.fillStyle = '#0d0f18';
        GC.beginPath(); GC.roundRect(mx2 - mw * .32, my2 - mh * .06, mw * .64, mh * .12, 2); GC.fill();
        GC.fillStyle = P.gold; GC.font = '700 ' + (S * .075 | 0) + 'px Segoe UI';
  GC.textAlign = 'center'; GC.fillText(canvasTr('ПОЧТА'), mx2, my2 + mh * .30);
        GC.strokeStyle = 'rgba(245,197,66,.4)'; GC.lineWidth = 1;
        GC.strokeRect(mx2 - mw / 2, my2 - mh / 2, mw, mh);
      }
      GC.save(); GC.translate(mx2 + mw / 2, my2 - mh * .08);
      GC.strokeStyle = '#7a7f96'; GC.lineWidth = 2;
      GC.beginPath(); GC.moveTo(0, 0); GC.lineTo(0, -mh * .5); GC.stroke();
      GC.restore();
      GC.restore();
      ANIM.mail = { x: mx2, y: my2, w: mw, h: mh };
    }

    /* золотая плашка банда: изначально пробовал левую стену над стеллажом, но
       там всегда открыта панель заданий (перекрывает canvas) — перенёс на
       чистый кусок кирпича на правой стене, над полкой с банками. */
    {
      const lx2 = heroRect.x + .90 * heroRect.w, ly2 = heroRect.y + .18 * heroRect.h;
      const lr = S * .30;
      GC.save();
      const lglow = GC.createRadialGradient(lx2, ly2, 0, lx2, ly2, lr * 2.1);
      lglow.addColorStop(0, 'rgba(245,197,66,.20)'); lglow.addColorStop(1, 'rgba(245,197,66,0)');
      GC.fillStyle = lglow; GC.beginPath(); GC.arc(lx2, ly2, lr * 2.1, 0, 7); GC.fill();
      if (ok(ART.plaqueCoin)) {
        GC.drawImage(ART.plaqueCoin, lx2 - lr * 1.15, ly2 - lr * 1.15, lr * 2.3, lr * 2.3);
      } else {
        GC.fillStyle = '#161310';
        GC.beginPath(); GC.arc(lx2, ly2, lr, 0, 7); GC.fill();
        GC.strokeStyle = P.gold; GC.lineWidth = 3; GC.stroke();
        GC.strokeStyle = 'rgba(0,0,0,.5)'; GC.lineWidth = 1; GC.beginPath(); GC.arc(lx2, ly2, lr - 3, 0, 7); GC.stroke();
        if (ok(ART.coin)) {
          GC.save();
          GC.beginPath(); GC.arc(lx2, ly2, lr * .74, 0, 7); GC.clip();
          GC.drawImage(ART.coin, lx2 - lr * .74, ly2 - lr * .74, lr * 1.48, lr * 1.48);
          GC.restore();
        } else {
          GC.fillStyle = P.gold; GC.font = '700 ' + (lr * .62 | 0) + 'px Segoe UI';
          GC.textAlign = 'center'; GC.fillText('₿', lx2, ly2 + lr * .22);
        }
      }
      GC.font = '700 ' + (S * .075 | 0) + 'px Segoe UI'; GC.textAlign = 'center';
      GC.fillStyle = 'rgba(230,232,240,.85)';
      GC.fillText('BAND GANG', lx2, ly2 + lr + S * .11);
      GC.restore();
      ANIM.logo = { x: lx2, y: ly2, r: lr };
    }

    /* Ворота на картинке уже закрыты. Подпись наносим прямо на рольставни,
       как потёртый трафарет, а не как отдельный синий интерфейсный ярлык. */
    {
      const dx0 = heroRect.x + .285 * heroRect.w, dx1 = heroRect.x + .445 * heroRect.w;
      const dyTop = heroRect.y + .165 * heroRect.h, dyBot = heroRect.y + .44 * heroRect.h;
      doorRect = [dx0 - 8, dyTop - 8, dx1 + 8, dyBot + 8];
      ANIM.door = { gx0: dx0, gy0: dyBot, gx1: dx1, gy1: dyBot, DH: dyBot - dyTop };
      const doorLabelX = (dx0 + dx1) / 2;
      const doorLabelY = dyTop + (dyBot - dyTop) * .56;
      GC.font = '900 ' + Math.max(14, (S * .12 | 0)) + 'px Impact, Arial Black, sans-serif';
      GC.textAlign = 'center';
      GC.lineWidth = Math.max(1, S * .012);
      GC.strokeStyle = 'rgba(35,29,20,.92)';
      GC.fillStyle = '#cb4a42';
      GC.shadowColor = 'rgba(0,0,0,.72)'; GC.shadowBlur = 3;
      GC.strokeText(tr('В ГОРОД'), doorLabelX, doorLabelY);
      GC.fillText(tr('В ГОРОД'), doorLabelX, doorLabelY);
      GC.shadowBlur = 0;
    }
  } else {
  /* фон за воротами: город и небо */
  const sky = GC.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a0d1c'); sky.addColorStop(1, '#05060a');
  GC.fillStyle = sky; GC.fillRect(0, 0, W, H);

  /* пол */
  for (let j = 0; j < RM; j++)
    for (let i = 0; i < RM; i++) {
      const [x, y] = at(i, j);
      GC.beginPath();
      GC.moveTo(x, y - th / 2); GC.lineTo(x + tw / 2, y); GC.lineTo(x, y + th / 2); GC.lineTo(x - tw / 2, y);
      GC.closePath();
      GC.fillStyle = (i + j) % 2 ? '#191714' : '#1c1a17'; GC.fill();
      GC.strokeStyle = '#100e0c'; GC.lineWidth = 1; GC.stroke();
    }
  /* бетон поверх плитки: клип по ромбу пола, чтобы текстура не лезла на стены */
  if (ok(ART.texFloor)) {
    const c0 = at(-.5, -.5), c1 = at(RM - .5, -.5), c2 = at(RM - .5, RM - .5), c3 = at(-.5, RM - .5);
    GC.save();
    GC.beginPath();
    GC.moveTo(c0[0], c0[1]); GC.lineTo(c1[0] + tw / 2, c1[1] + th / 2);
    GC.lineTo(c2[0], c2[1] + th); GC.lineTo(c3[0] - tw / 2, c3[1] + th / 2);
    GC.closePath(); GC.clip();
    const fx0 = Math.min(c3[0] - tw / 2, c0[0]), fx1 = Math.max(c1[0] + tw / 2, c2[0]);
    texFill(GC, ART.texFloor, fx0, c0[1], fx1 - fx0, c2[1] + th - c0[1], .30, .34);
    GC.restore();
  }

  /* масляные пятна */
  GC.fillStyle = 'rgba(0,0,0,.25)';
  for (const [oi, oj, r] of [[1.2, 3.5, .5], [3.8, 1.6, .7], [2.5, 4.2, .35]]) {
    const [x, y] = at(oi, oj);
    GC.save(); GC.translate(x, y); GC.scale(1, .5);
    GC.beginPath(); GC.arc(0, 0, r * S, 0, 7); GC.fill(); GC.restore();
  }

  /* ЗАДНЯЯ-ЛЕВАЯ стена (ребро i=0): кирпич, вытяжка.
     14.08: раньше был холодный флэт-металл-панель ('#2b3254') — по просьбе
     переделано на тёплую кирпичную кладку, подходит гаражному кооперативу
     из лора игры лучше, чем безликий металл. */
  {
    const [p0x, p0y] = at(0, 0), [p1x, p1y] = at(0, RM);
    GC.fillStyle = '#6b3a2c';
    GC.beginPath();
    GC.moveTo(p0x, p0y - th / 2); GC.lineTo(p1x, p1y - th / 2);
    GC.lineTo(p1x, p1y - th / 2 - WH); GC.lineTo(p0x, p0y - th / 2 - WH);
    GC.closePath(); GC.fill();
    {                                              // кирпичная кладка
      GC.save(); GC.clip();
      const wx0 = Math.min(p0x, p1x), wx1 = Math.max(p0x, p1x);
      texFill(GC, brickTile(), wx0, p0y - th / 2 - WH, wx1 - wx0, WH + th, .96, .60);
      GC.restore();
      /* лёгкая тень у пола — кладка не висит в воздухе */
      const shg = GC.createLinearGradient(0, p0y - th / 2 - S * .5, 0, p0y - th / 2);
      shg.addColorStop(0, 'rgba(0,0,0,0)'); shg.addColorStop(1, 'rgba(0,0,0,.32)');
      GC.save(); GC.beginPath();
      GC.moveTo(p0x, p0y - th / 2); GC.lineTo(p1x, p1y - th / 2);
      GC.lineTo(p1x, p1y - th / 2 - WH); GC.lineTo(p0x, p0y - th / 2 - WH);
      GC.closePath(); GC.clip();
      GC.fillStyle = shg; GC.fillRect(wx0, p0y - th / 2 - WH, wx1 - wx0, WH + th);
      GC.restore();
    }
    GC.strokeStyle = 'rgba(255,225,190,.06)'; GC.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      GC.beginPath();
      GC.moveTo(p0x + (p1x - p0x) * t, p0y + (p1y - p0y) * t - th / 2);
      GC.lineTo(p0x + (p1x - p0x) * t, p0y + (p1y - p0y) * t - th / 2 - WH);
      GC.stroke();
    }
    /* вытяжка */
    const fx = p0x + (p1x - p0x) * .42, fy = p0y + (p1y - p0y) * .42 - th / 2 - WH * .40;
    GC.save(); GC.translate(fx, fy); GC.scale(1, .6);
    GC.fillStyle = '#0b0d14'; GC.beginPath(); GC.arc(0, 0, S * .40, 0, 7); GC.fill();
    GC.strokeStyle = '#3a2c22'; GC.lineWidth = 3; GC.stroke();
    ANIM.fan = { fx, fy };
    GC.restore();
    /* плакат с киркой */
    const px2 = p0x + (p1x - p0x) * .76, py2 = p0y + (p1y - p0y) * .76 - th / 2 - WH * .34;
    GC.fillStyle = '#241a14'; GC.fillRect(px2 - S * .16, py2 - S * .22, S * .32, S * .44);
    GC.strokeStyle = P.gold + '55'; GC.lineWidth = 1; GC.strokeRect(px2 - S * .16, py2 - S * .22, S * .32, S * .44);
    if (!spr(GC, ART.symPick, px2, py2 + S * .16, S * .26, .95)) {
      GC.fillStyle = P.gold; GC.font = '700 ' + (S * .18 | 0) + 'px Segoe UI';
      GC.textAlign = 'center'; GC.fillText('⛏', px2, py2 + S * .07);
    }

    /* 14.08 (просьба): «отдельно на стене логотип банд коин» — медальон
       ближе к воротам, подальше от вытяжки и плаката, свой купол света. */
    const lx2 = p0x + (p1x - p0x) * .14, ly2 = p0y + (p1y - p0y) * .14 - th / 2 - WH * .62;
    const lr = S * .30;
    GC.save();
    const lglow = GC.createRadialGradient(lx2, ly2, 0, lx2, ly2, lr * 2.1);
    lglow.addColorStop(0, 'rgba(245,197,66,.20)'); lglow.addColorStop(1, 'rgba(245,197,66,0)');
    GC.fillStyle = lglow; GC.beginPath(); GC.arc(lx2, ly2, lr * 2.1, 0, 7); GC.fill();
    if (ok(ART.plaqueCoin)) {                       // готовая сгенерённая плашка целиком
      GC.drawImage(ART.plaqueCoin, lx2 - lr * 1.15, ly2 - lr * 1.15, lr * 2.3, lr * 2.3);
    } else {
      GC.fillStyle = '#161310';
      GC.beginPath(); GC.arc(lx2, ly2, lr, 0, 7); GC.fill();
      GC.strokeStyle = P.gold; GC.lineWidth = 3; GC.stroke();
      GC.strokeStyle = 'rgba(0,0,0,.5)'; GC.lineWidth = 1; GC.beginPath(); GC.arc(lx2, ly2, lr - 3, 0, 7); GC.stroke();
      if (ok(ART.coin)) {
        GC.save();
        GC.beginPath(); GC.arc(lx2, ly2, lr * .74, 0, 7); GC.clip();
        GC.drawImage(ART.coin, lx2 - lr * .74, ly2 - lr * .74, lr * 1.48, lr * 1.48);
        GC.restore();
      } else {
        GC.fillStyle = P.gold; GC.font = '700 ' + (lr * .62 | 0) + 'px Segoe UI';
        GC.textAlign = 'center'; GC.fillText('₿', lx2, ly2 + lr * .22);
      }
    }
    GC.font = '700 ' + (S * .075 | 0) + 'px Segoe UI'; GC.textAlign = 'center';
    GC.fillStyle = 'rgba(230,232,240,.85)';
    GC.fillText('BAND GANG', lx2, ly2 + lr + S * .11);
    GC.restore();
    ANIM.logo = { x: lx2, y: ly2, r: lr };
  }

  /* ЗАДНЯЯ-ПРАВАЯ стена (ребро j=0) с ВОРОТАМИ в город */
  {
    const [q0x, q0y] = at(0, 0), [q1x, q1y] = at(RM, 0);
    const px = t => q0x + (q1x - q0x) * t, py = t => q0y + (q1y - q0y) * t - th / 2;
    const dA = .34, dB = .84, DH = WH * .62;       // проём
    GC.fillStyle = '#6b3a2c';
    GC.beginPath(); GC.moveTo(px(0), py(0)); GC.lineTo(px(dA), py(dA));
    GC.lineTo(px(dA), py(dA) - WH); GC.lineTo(px(0), py(0) - WH); GC.closePath(); GC.fill();
    GC.beginPath(); GC.moveTo(px(dB), py(dB)); GC.lineTo(px(1), py(1));
    GC.lineTo(px(1), py(1) - WH); GC.lineTo(px(dB), py(dB) - WH); GC.closePath(); GC.fill();
    GC.fillStyle = '#8f8577';                      // бетонная перемычка над воротами
    GC.beginPath(); GC.moveTo(px(dA), py(dA) - DH); GC.lineTo(px(dB), py(dB) - DH);
    GC.lineTo(px(dB), py(dB) - WH); GC.lineTo(px(dA), py(dA) - WH); GC.closePath(); GC.fill();
    {                                              // кирпич на боковых простенках ворот
      GC.save();
      GC.beginPath();
      GC.moveTo(px(0), py(0)); GC.lineTo(px(dA), py(dA));
      GC.lineTo(px(dA), py(dA) - WH); GC.lineTo(px(0), py(0) - WH); GC.closePath();
      GC.moveTo(px(dB), py(dB)); GC.lineTo(px(1), py(1));
      GC.lineTo(px(1), py(1) - WH); GC.lineTo(px(dB), py(dB) - WH); GC.closePath();
      GC.clip();
      const rx0 = Math.min(px(0), px(1)), rx1 = Math.max(px(0), px(1));
      texFill(GC, brickTile(), rx0, py(0) - WH, rx1 - rx0, WH + th, .96, .60);
      /* тень у пола — та же грамматика, что и на левой стене: кладка не висит в воздухе */
      const shg2 = GC.createLinearGradient(0, py(0) - S * .5, 0, py(0));
      shg2.addColorStop(0, 'rgba(0,0,0,0)'); shg2.addColorStop(1, 'rgba(0,0,0,.34)');
      GC.fillStyle = shg2; GC.fillRect(rx0, py(0) - WH, rx1 - rx0, WH + th);
      GC.restore();
    }

    /* 14.08 (просьба): почтовый ящик на стене — весь журнал событий (налёты
       на тебя/тобой, пыль, ремонт) виден кликом прямо в гараже, без похода
       в мастерскую. Вешаем на левый простенок ворот, на уровне руки. */
    {
      const mx2 = px(.14), my2 = py(.14) - th / 2 - WH * .30;
      const mw = S * .30, mh = S * .34;
      GC.save();
      shadowUnder(GC, mx2, my2 + mh * .45, S * .22, .22);
      if (ok(ART.mailboxArt)) {                        // готовая сгенерённая картинка целиком
        GC.drawImage(ART.mailboxArt, mx2 - mw * .7, my2 - mh * .7, mw * 1.4, mh * 1.4);
      } else {
        GC.fillStyle = '#1c1f2c';                       // корпус ящика
        GC.beginPath(); GC.roundRect(mx2 - mw / 2, my2 - mh / 2, mw, mh, S * .035); GC.fill();
        GC.strokeStyle = 'rgba(0,0,0,.55)'; GC.lineWidth = 1.5; GC.stroke();
        GC.fillStyle = '#262a3c';                        // крышка чуть приоткрыта
        GC.beginPath();
        GC.moveTo(mx2 - mw / 2, my2 - mh / 2);
        GC.lineTo(mx2 + mw / 2, my2 - mh / 2);
        GC.lineTo(mx2 + mw / 2 - S * .02, my2 - mh / 2 - S * .07);
        GC.lineTo(mx2 - mw / 2 + S * .02, my2 - mh / 2 - S * .07);
        GC.closePath(); GC.fill();
        GC.strokeStyle = 'rgba(0,0,0,.5)'; GC.lineWidth = 1; GC.stroke();
        GC.fillStyle = '#0d0f18';                         // прорезь
        GC.beginPath(); GC.roundRect(mx2 - mw * .32, my2 - mh * .06, mw * .64, mh * .12, 2); GC.fill();
        GC.fillStyle = P.gold; GC.font = '700 ' + (S * .075 | 0) + 'px Segoe UI';
  GC.textAlign = 'center'; GC.fillText(canvasTr('ПОЧТА'), mx2, my2 + mh * .30);
        GC.strokeStyle = 'rgba(245,197,66,.4)'; GC.lineWidth = 1;
        GC.strokeRect(mx2 - mw / 2, my2 - mh / 2, mw, mh);
      }
      /* флажок — красный, если есть непрочитанные события; серый, если пусто */
      GC.save(); GC.translate(mx2 + mw / 2, my2 - mh * .08);
      GC.strokeStyle = '#7a7f96'; GC.lineWidth = 2;
      GC.beginPath(); GC.moveTo(0, 0); GC.lineTo(0, -mh * .5); GC.stroke();
      GC.restore();
      GC.restore();
      ANIM.mail = { x: mx2, y: my2, w: mw, h: mh };
    }
    if (ok(ART.texFloor)) {                       // фактура на бетонной перемычке
      GC.save();
      GC.beginPath();
      GC.moveTo(px(dA), py(dA) - DH); GC.lineTo(px(dB), py(dB) - DH);
      GC.lineTo(px(dB), py(dB) - WH); GC.lineTo(px(dA), py(dA) - WH); GC.closePath();
      GC.clip();
      const rx0 = Math.min(px(dA), px(dB)), rx1 = Math.max(px(dA), px(dB));
      texFill(GC, ART.texFloor, rx0, py(dA) - WH - th, rx1 - rx0, WH + th * 2, .30, .5);
      GC.restore();
    }
    /* рама ворот */
    GC.strokeStyle = 'rgba(150,165,220,.30)'; GC.lineWidth = 2;
    GC.beginPath(); GC.moveTo(px(dA), py(dA)); GC.lineTo(px(dA), py(dA) - DH);
    GC.lineTo(px(dB), py(dB) - DH); GC.lineTo(px(dB), py(dB)); GC.stroke();

    /* за воротами: далёкий город колонками окон */
    const gx0 = px(dA), gy0 = py(dA), gx1 = px(dB), gy1 = py(dB);
    GC.save();
    GC.beginPath();
    GC.moveTo(gx0, gy0); GC.lineTo(gx1, gy1);
    GC.lineTo(gx1, gy1 - DH); GC.lineTo(gx0, gy0 - DH); GC.closePath(); GC.clip();
    const ng = GC.createLinearGradient(0, Math.min(gy0, gy1) - DH, 0, Math.max(gy0, gy1));
    ng.addColorStop(0, '#0b0f22'); ng.addColorStop(1, '#182348');
    GC.fillStyle = ng;
    GC.fillRect(Math.min(gx0, gx1) - 40, Math.min(gy0, gy1) - DH - 40,
                Math.abs(gx1 - gx0) + 80, DH + 120);
    if (ok(ART.street)) {                          // за воротами — настоящая улица
      const bx0 = Math.min(gx0, gx1) - 30, by0 = Math.min(gy0, gy1) - DH - 20;
      const bw = Math.abs(gx1 - gx0) + 60, bh = DH + 80;
      const key = (bw | 0) + 'x' + (bh | 0);
      if (drawGarage._stKey !== key) {             // масштабирование раз, а не 60 раз в секунду
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, bw | 0); cv.height = Math.max(1, bh | 0);
        const g2 = cv.getContext('2d');
        const ar = ART.street.naturalWidth / ART.street.naturalHeight;
        let dw = bw, dh = bw / ar;
        if (dh < bh) { dh = bh; dw = bh * ar; }
        g2.globalAlpha = .72;
        g2.drawImage(ART.street, (bw - dw) / 2, (bh - dh) * .35, dw, dh);
        g2.globalAlpha = 1;
        g2.fillStyle = 'rgba(8,10,22,.5)';
        g2.fillRect(0, 0, bw, bh);
        drawGarage._st = cv; drawGarage._stKey = key;
      }
      GC.drawImage(drawGarage._st, bx0, by0);
    } else
    for (let bld = 0; bld < 5; bld++) {            // силуэты с колонками окон
      const bt = .08 + bld * .19, bw = .10;
      const bx = gx0 + (gx1 - gx0) * bt, bxe = gx0 + (gx1 - gx0) * (bt + bw);
      const bh = DH * (.42 + ((bld * 47) % 40) / 100);
      const byBase = gy0 + (gy1 - gy0) * (bt + bw / 2);
      GC.fillStyle = '#10142b';
      GC.fillRect(bx, byBase - bh, bxe - bx, bh + 60);
      for (let r = 0; r < 7; r++)
        for (let q = 0; q < 2; q++) {
          if ((bld * 13 + r * 3 + q) % 5 < 2) continue;
          GC.fillStyle = (bld + r + q) % 3 ? '#ffcf6e' : '#9fd8ff';
          GC.globalAlpha = .5 + ((bld * 7 + r + q * 3) % 40) / 100;
          GC.fillRect(bx + 4 + q * ((bxe - bx) / 2), byBase - bh + 6 + r * (bh / 7), 2.4, 3.4);
        }
      GC.globalAlpha = 1;
    }
    const lampX = (gx0 + gx1) / 2, lampY = Math.max(gy0, gy1) - 4;   // фонарь у въезда
    GC.drawImage(G_WARM, lampX - 7, lampY - 22);
    GC.restore();

    /* холодный отсвет из ворот на пол */
    GC.save(); GC.translate((gx0 + gx1) / 2 + S * .3, (gy0 + gy1) / 2 + S * .55);
    GC.scale(1, .5); GC.globalAlpha = .10;
    const dg = GC.createRadialGradient(0, 0, 0, 0, 0, S * 1.5);
    dg.addColorStop(0, '#8fb4ff'); dg.addColorStop(1, 'transparent');
    GC.fillStyle = dg; GC.beginPath(); GC.arc(0, 0, S * 1.5, 0, 7); GC.fill();
    GC.restore();

    ANIM.door = { gx0, gy0, gx1, gy1, DH };
    doorRect = [Math.min(gx0, gx1) - 8, Math.min(gy0, gy1) - DH,
                Math.max(gx0, gx1) + 8, Math.max(gy0, gy1) + 8];
    /* Тот же трафарет прямо на воротах в процедурном запасном варианте. */
    GC.font = '900 ' + Math.max(14, (S * .12 | 0)) + 'px Impact, Arial Black, sans-serif';
    GC.textAlign = 'center';
    GC.lineWidth = Math.max(1, S * .012);
    GC.strokeStyle = 'rgba(35,29,20,.92)';
    GC.fillStyle = '#cb4a42';
    GC.shadowColor = 'rgba(0,0,0,.72)'; GC.shadowBlur = 3;
    GC.strokeText(tr('В ГОРОД'), (gx0 + gx1) / 2, (gy0 + gy1) / 2 - DH * .42);
    GC.fillText(tr('В ГОРОД'), (gx0 + gx1) / 2, (gy0 + gy1) / 2 - DH * .42);
    GC.shadowBlur = 0;
  }

  /* кромки стен: верх и угловой стык — стены перестают сливаться с ночью */
  {
    const [c0x, c0y] = at(0, 0), [l1x, l1y] = at(0, RM), [r1x, r1y] = at(RM, 0);
    GC.strokeStyle = 'rgba(210,190,160,.30)'; GC.lineWidth = 1.5;
    GC.beginPath();
    GC.moveTo(l1x, l1y - th / 2 - WH); GC.lineTo(c0x, c0y - th / 2 - WH);
    GC.lineTo(r1x, r1y - th / 2 - WH);
    GC.stroke();
    GC.strokeStyle = 'rgba(210,190,160,.38)'; GC.lineWidth = 2;
    GC.beginPath(); GC.moveTo(c0x, c0y - th / 2); GC.lineTo(c0x, c0y - th / 2 - WH); GC.stroke();
    /* плинтус */
    GC.strokeStyle = 'rgba(0,0,0,.5)'; GC.lineWidth = 2.5;
    GC.beginPath();
    GC.moveTo(l1x, l1y - th / 2); GC.lineTo(c0x, c0y - th / 2); GC.lineTo(r1x, r1y - th / 2);
    GC.stroke();
  }
  }


    drawGarage._cv = cv; drawGarage._key = gkey;
    drawGarage._anim = ANIM; drawGarage._door = doorRect;
  }
  CX.drawImage(drawGarage._cv, 0, 0, drawGarage._cv._cssW, drawGarage._cv._cssH);
  doorRect = drawGarage._door;
  const ANIM = drawGarage._anim;

  /* почтовый ящик: флажок и мигающая точка живут в динамике, чтобы новое
     событие подсвечивалось, не перерисовывая всю кэшированную стену. */
  if (ANIM.mail) {
    const { x: mxA, y: myA, w: mwA, h: mhA } = ANIM.mail;
    mailRect = [mxA - mwA / 2 - 8, myA - mhA / 2 - 14, mxA + mwA / 2 + 8, myA + mhA / 2 + 10];
    const unread = gar.log.length > (gar.mailSeen || 0);
    CX.save(); CX.translate(mxA + mwA / 2, myA - mhA * .08 - mhA * .5);
    CX.fillStyle = unread ? '#e5493f' : '#4a4f66';
    CX.beginPath(); CX.moveTo(0, 0); CX.lineTo(S * .11, S * .035); CX.lineTo(0, S * .07); CX.closePath(); CX.fill();
    CX.restore();
    if (unread) {
      const pulse = .55 + .45 * Math.sin(T * 4);
      CX.save();
      CX.globalAlpha = pulse;
      CX.fillStyle = '#ff5a4d';
      CX.beginPath(); CX.arc(mxA + mwA * .38, myA - mhA * .5, S * .045, 0, 7); CX.fill();
      CX.globalAlpha = 1;
      CX.restore();
    }
  }

  /* --- динамика поверх статики: вытяжка и щит --- */
  if (ANIM.fan && gar.fan) {
    const { fx, fy } = ANIM.fan;
    /* Никакого второго корпуса: рисуем только вращающиеся лопасти ровно
       внутри круглой решётки уже существующей вытяжки. */
    CX.save();
    CX.translate(fx, fy);
    CX.beginPath(); CX.arc(0, 0, S * .54, 0, 7); CX.clip();
    CX.rotate(T * 3.2);
    CX.fillStyle = 'rgba(16,22,25,.80)';
    for (let k = 0; k < 5; k++) {
      CX.rotate(Math.PI * 2 / 5);
      CX.beginPath();
      CX.moveTo(-S * .04, -S * .03);
      CX.quadraticCurveTo(S * .37, -S * .20, S * .43, S * .04);
      CX.lineTo(S * .07, S * .12);
      CX.closePath(); CX.fill();
    }
    CX.fillStyle = '#63dbe0'; CX.beginPath(); CX.arc(0, 0, S * .09, 0, 7); CX.fill();
    CX.restore();
  }
  if (ANIM.door && gar.shield > 0) {
    const { gx0, gy0, gx1, gy1, DH } = ANIM.door;
    if (gar.shield > 0) {                       // щит: барьер в проёме, видно сразу
      CX.save();
      CX.beginPath();
      CX.moveTo(gx0, gy0); CX.lineTo(gx1, gy1);
      CX.lineTo(gx1, gy1 - DH); CX.lineTo(gx0, gy0 - DH); CX.closePath();
      CX.globalAlpha = .16 + .07 * Math.sin(T * 2);
      CX.fillStyle = '#4fa3ff'; CX.fill();
      CX.globalAlpha = .55 + .25 * Math.sin(T * 2);
      CX.strokeStyle = '#9fd8ff'; CX.lineWidth = 2; CX.stroke();
      CX.restore();
      spr(CX, ART.shield, (gx0 + gx1) / 2, (gy0 + gy1) / 2 - DH * .35, S * .5, .9, 'center');
    }

  }

  /* стойки асиков: аккуратный стеллаж в два ряда вдоль левой стены.
     v7.4: если в gar.rigInv что-то куплено по-настоящему в магазине — стоят
     ИМЕННО купленные модели, а не случайный набор «для красоты». Пустой
     инвентарь (свежий профиль/старый сейв без магазина) — старая заглушка,
     чтобы гараж не выглядел пустым до первой покупки.
     14.08 (просьба): раньше слоты стояли впритык (шаг .9/1.2 при спрайте
     шириной почти в S) — риги налезали друг на друга сплошной кучей мусора,
     и гараж в целом читался слишком тёмным и «страшным». Раздвинули шаг,
     подняли риги на настоящую полку-стеллаж (см. ниже) и подписали каждый
     подписью модели/хешрейта — теперь видно, что именно у тебя стоит. */
  const owned = rigOwnedTotal();
  /* В HQ-фоне ASIC живут именно в реальных правых стеллажах. Старая
     изометрическая сетка от процедурной комнаты давала диагональную «лесенку»
     в воздухе: она не знает геометрию новой картинки. Для HQ точки заданы
     как доли фонового изображения — эта привязка остаётся верной на любом
     разрешении и при любом соотношении сторон canvas. */
  const GRID_SLOTS = heroRect
    ? [[.660, .340], [.760, .370], [.855, .400],
       [.660, .405], [.760, .435], [.855, .465],
       [.660, .470], [.760, .500], [.855, .530],
       [.660, .535], [.760, .565], [.855, .595]]
    : [[.5, .75], [2.3, .75], [.5, 1.95], [2.3, 1.95],
       [.5, 3.15], [2.3, 3.15], [.5, 4.35], [2.3, 4.35]];
  const ownedList = [];
  if (owned > 0) RIG_TYPES.forEach(r => {
    for (let k = 0; k < gar.rigInv[r.id]; k++) ownedList.push({ ...r, _posKey: `${r.id}:${k}` });
  });
  /* Одна физическая ячейка стеллажа вмещает несколько компактных ASIC.
     Раньше мы показывали лишь 24, хотя сервер не ограничивает владельца:
     25-й превращался в неинформативное «+1». Теперь весь первый шкаф
     честно вмещает 50 машин. После 50 интерфейс покажет остаток, пока не
     появится отдельное расширение гаража/второй шкаф. */
  const VISUAL_RIG_CAP = 50;
  const SHELF_PACK = Math.max(1, Math.ceil(Math.min(owned || 1, VISUAL_RIG_CAP) / GRID_SLOTS.length));
  const PACK_SCALE = SHELF_PACK === 1 ? (heroRect ? 1.24 : 1)
    : SHELF_PACK === 2 ? .68
      : SHELF_PACK === 3 ? .56
        : SHELF_PACK <= 5 ? .46 : .38;
  const VISIBLE_CAP = VISUAL_RIG_CAP;
  const rows = [];
  rigHitboxes = [];
  if (owned > 0) {
    for (let n = 0; n < Math.min(ownedList.length, VISIBLE_CAP); n++) {
      const slot = GRID_SLOTS[Math.floor(n / SHELF_PACK)];
      rows.push([slot[0], slot[1], n % SHELF_PACK]);
    }
  }

  /* полка-стеллаж под рядами: приподнятая металлическая плоскость с торцом —
     без неё риги «стояли» прямо на голом полу и выглядели брошенными. Рисуем
     по рядам (общий j), только на всю ширину занятых рядов. */
  const usedRows = [...new Set(rows.map(r => r[1]))];
  if (!heroRect) usedRows.forEach(rj => {
    const d = .20, i0 = .18, i1 = 2.62, rh = S * .15;
    const a0 = at(i0, rj - d), a1 = at(i1, rj - d), a2 = at(i1, rj + d), a3 = at(i0, rj + d);
    CX.fillStyle = '#252b48';
    CX.beginPath();
    CX.moveTo(a0[0], a0[1] - rh); CX.lineTo(a1[0], a1[1] - rh);
    CX.lineTo(a2[0], a2[1] - rh); CX.lineTo(a3[0], a3[1] - rh);
    CX.closePath(); CX.fill();
    CX.fillStyle = '#12142780';
    CX.beginPath();
    CX.moveTo(a3[0], a3[1] - rh); CX.lineTo(a2[0], a2[1] - rh);
    CX.lineTo(a2[0], a2[1]); CX.lineTo(a3[0], a3[1]);
    CX.closePath(); CX.fill();
    /* неоновая кромка под полкой (14.08: «как в лучших играх» — тонкая
       светящаяся полоса вдоль торца, дешёвый и надёжный приём для «геймерского»
       индустриального стеллажа, не зависит от арт-генератора). */
    CX.save();
    CX.strokeStyle = '#5fd0ff'; CX.lineWidth = 2;
    CX.shadowColor = '#5fd0ff'; CX.shadowBlur = 8;
    CX.globalAlpha = .55 + .25 * Math.sin(T * 2.2 + rj);
    CX.beginPath(); CX.moveTo(a3[0], a3[1] - 1); CX.lineTo(a2[0], a2[1] - 1); CX.stroke();
    CX.restore();
    CX.globalAlpha = .16 + .06 * Math.sin(T * 2.2 + rj);
    CX.fillStyle = '#5fd0ff';
    CX.beginPath();
    CX.moveTo(a3[0], a3[1]); CX.lineTo(a2[0], a2[1]);
    CX.lineTo(a2[0], a2[1] + S * .12); CX.lineTo(a3[0], a3[1] + S * .12);
    CX.closePath(); CX.fill(); CX.globalAlpha = 1;
    CX.strokeStyle = 'rgba(150,165,220,.30)'; CX.lineWidth = 1;
    CX.beginPath(); CX.moveTo(a0[0], a0[1] - rh); CX.lineTo(a1[0], a1[1] - rh); CX.stroke();
    /* тёплая рабочая подсветка над полкой — без неё стеллаж терялся в темноте */
    const [mx, my] = at((i0 + i1) / 2, rj);
    CX.globalAlpha = .5 + .15 * Math.sin(T * 1.3 + rj);
    CX.drawImage(G_WARM, mx - 7, my - S * .95 - 2);
    CX.globalAlpha = 1;
  });

  rows.forEach(([ri, rj, pk], n) => {
    const [bx, by] = heroRect
      ? [heroRect.x + ri * heroRect.w, heroRect.y + rj * heroRect.h]
      : at(ri, rj);
    /* Компактные риги внутри одной секции стоят не диагональной стопкой, а
       маленькой сеткой. Поэтому 50 машин остаются различимыми и не рисуют
       одну большую кашу. */
    const packCols = SHELF_PACK <= 3 ? SHELF_PACK : Math.ceil(Math.sqrt(SHELF_PACK));
    const packRows = Math.ceil(SHELF_PACK / packCols);
    const packCol = pk % packCols, packRow = Math.floor(pk / packCols);
    /* В стойке ASIC стоят плотнее, чем на полу. HQ получает ещё небольшой
       коэффициент: новые полки уже нарисованы на фоне и не должны скрываться
       увеличенными спрайтами. */
    const rigScale = PACK_SCALE * (heroRect ? 1 : 1);
    const packOffX = (packCol - (packCols - 1) / 2) * S * .42 * rigScale;
    const packOffY = (packRow - (packRows - 1) / 2) * S * .28 * rigScale;
    const baseX = bx + packOffX;
    const baseY = by + packOffY + (heroRect ? S * .06 : 0);
    const rigData = owned > 0 ? ownedList[n] : null;
    const posKey = rigData ? rigData._posKey : String(n);
    /* Numeric keys are a harmless migration path for layouts saved before
       rigs had stable inventory keys.  New moves are saved as rigId:index,
       so buying another model can no longer shift old placements. */
    const savedPos = rigPositionOnScreen(gar.rigPos[posKey] || gar.rigPos[n]);
    /* W/H are CSS pixels, matching pointer coordinates and the transformed
       Canvas context.  CV.width/CV.height are Retina backing-store pixels. */
    const x = savedPos ? Math.max(12, Math.min(W - 12, savedPos.x)) : baseX;
    const y = savedPos ? Math.max(24, Math.min(H - 12, savedPos.y)) : baseY;
    const hh = S * rigScale * .86;
      const alive0 = 1 - gar.dust * .7;
      const rigImg = ART[rigData.art];
      if (ok(rigImg)) {
        /* настоящий асик: чем больше пыли, тем тусклее и желтее корпус */
        const wpx = S * rigScale * .92;
        /* Зона захвата шире видимой фронтальной панели: так ASIC удобно
           перетаскивать и мышью, и пальцем, даже если браузер масштабирует
           canvas или у спрайта есть прозрачные поля. */
        const grabW = Math.max(wpx * .72, S * rigScale * .55);
        const grabH = Math.max(hh * 1.7, S * rigScale * 1.15);
        rigHitboxes.push({ n, posKey, x, y, x0: x - grabW, x1: x + grabW, y0: y - grabH, y1: y + S * .34 });
        shadowUnder(CX, x, y + th * .18, wpx * .40, .5);
      CX.globalAlpha = .28 + .22 * alive0 * (.6 + .4 * Math.sin(T * 2 + n));
      const gold = rigData.id === 'rig6' || rigData.id === 'rig7';
      CX.drawImage(gold ? G_GOLD : G_GREEN, x - 22 * rigScale, y - hh * .5 - 22 * rigScale, 44 * rigScale, 44 * rigScale);
      CX.globalAlpha = 1;
      spr(CX, dusty(rigImg, gar.dust), x, y + th * .18, wpx);
      if (gar.broken && n === 1) {             // деградировавший асик искрит
        CX.globalAlpha = .5 + .5 * Math.sin(T * 9);
        CX.fillStyle = '#ff5d6c';
        CX.beginPath(); CX.arc(x, y - hh * .8, 3.2 * rigScale, 0, 7); CX.fill();
        CX.globalAlpha = 1;
        CX.font = '700 ' + Math.max(9, S * rigScale * .09 | 0) + 'px Segoe UI';
        CX.textAlign = 'center'; CX.fillStyle = '#ff5d6c';
        CX.fillText('−30%', x, y - hh - S * .1);
      }
      /* подпись модели и хешрейта — только когда риг один на полке, иначе
         в уменьшенном парном виде текст всё равно не прочитать */
      if (rigData && SHELF_PACK === 1) {
        const label = `${canvasTr(rigData.name)} · ${rigData.th} TH`;
        CX.font = '700 ' + Math.max(9, S * .10 | 0) + 'px Segoe UI';
        CX.textAlign = 'center';
        const ltw = CX.measureText(label).width + 12;
        CX.fillStyle = 'rgba(8,10,18,.72)';
        CX.beginPath();
        CX.roundRect(x - ltw / 2, y + th * .30, ltw, S * .17, 5);
        CX.fill();
        CX.fillStyle = 'rgba(220,228,255,.92)';
        CX.fillText(label, x, y + th * .30 + S * .13);
      }
      /* У HQ проводка проложена за стеллажом: отдельный кабель над каждым
         ASIC создавал на новой стене спутанную паутину. */
      if (!heroRect) {
        CX.strokeStyle = 'rgba(80,90,140,.5)'; CX.lineWidth = 1.2;
        CX.beginPath(); CX.moveTo(x, y - hh * .7);
        CX.quadraticCurveTo(x + 8, y - hh - S * .8, x, y - hh - S * 1.5); CX.stroke();
      }
      return;
    }
    box2(CX, x, y, tw * .52, th * .52, PACK_SCALE, hh, '#2b3150', '#222741', '#181c2e');
    /* диоды: сетка на правой грани, гаснут от пыли */
    const alive = 1 - gar.dust * .7;
    for (let r = 0; r < 6; r++)
      for (let q = 0; q < 3; q++) {
        if ((n * 7 + r * 3 + q) % 10 > alive * 10) continue;
        const t = (q + .6) / 3.6;
        const lx = x + t * tw * .3 * PACK_SCALE, ly = y + th * .3 * (1 - t) * PACK_SCALE - hh + S * .18 * PACK_SCALE + r * (hh - S * .28 * PACK_SCALE) / 6;
        const on = Math.sin(T * (2 + n) + r * 2 + q * 3) > -.3;
        if (!on) continue;
        CX.fillStyle = (r + q + n) % 4 ? '#3ddc84' : '#ffb545';
        CX.fillRect(lx - 1.4, ly - 1.4, 2.8, 2.8);
      }
    /* кабель к потолку */
    CX.strokeStyle = 'rgba(80,90,140,.5)'; CX.lineWidth = 1.2;
    CX.beginPath(); CX.moveTo(x, y - hh - th * .3);
    CX.quadraticCurveTo(x + 8, y - hh - S * .8, x, y - hh - S * 1.5); CX.stroke();
  });
  /* Переполнение появляется только после заполнения 50 мест первого шкафа. */
  if (owned > VISIBLE_CAP) {
    const [ox2, oy2] = at(1.35, 3.6);
    CX.save();
    CX.font = '700 ' + Math.max(10, S * .11 | 0) + 'px Segoe UI';
    CX.textAlign = 'center';
    CX.fillStyle = 'rgba(10,12,20,.82)';
    const label = LANG === 'en' ? `+${owned - VISIBLE_CAP} more` : `+${owned - VISIBLE_CAP} ещё`;
    const tw2 = CX.measureText(label).width + 16;
    CX.beginPath(); CX.roundRect(ox2 - tw2 / 2, oy2 - th * .6 - 22, tw2, 20, 6); CX.fill();
    CX.fillStyle = P.gold;
    CX.fillText(label, ox2, oy2 - th * .6 - 8);
    CX.restore();
  }

  /* В hero-фоне пол уже собран и этот старый процедурный ящик лишний. */
  if (!heroRect) {
    const [x, y] = at(3.6, 4.4);
    if (ok(ART.toolbox)) {
      shadowUnder(CX, x, y + th * .2, S * .34, .45);
      spr(CX, ART.toolbox, x, y + th * .28, S * .60, .95);
    }
  }

  /* 14.08 (просьба «гараж — наше лицо, самое красивое место»): пара
     захламляющих предметов на свободном полу справа от стойки с асиками —
     референсы мастерских (ArtStation/Pinterest) показывают, что пустой пол
     читается дёшево, а мелкий хлам держит взгляд. Готовые картинки заведены
     в очередь (prop_tirestack/prop_oildrum), пока их нет — рисуем кодом. */
  if (!heroRect) {
    const [x, y] = at(3.5, 1.1);
    if (ok(ART.propTirestack)) {
      shadowUnder(CX, x, y + th * .2, S * .3, .4);
      spr(CX, ART.propTirestack, x, y + th * .22, S * .5, .95);
    } else {
      shadowUnder(CX, x, y + th * .18, S * .32, .4);
      for (let k = 0; k < 3; k++) {
        const ty = y - k * S * .10;
        CX.save(); CX.translate(x, ty); CX.scale(1, .42);
        CX.fillStyle = '#111116'; CX.beginPath(); CX.arc(0, 0, S * .21, 0, 7); CX.fill();
        CX.fillStyle = '#1c1c22'; CX.beginPath(); CX.arc(0, 0, S * .21, 0, 7); CX.lineWidth = S * .09; CX.strokeStyle = '#1c1c22'; CX.stroke();
        CX.fillStyle = '#000'; CX.beginPath(); CX.arc(0, 0, S * .095, 0, 7); CX.fill();
        CX.restore();
      }
      CX.globalAlpha = .18; CX.fillStyle = '#fff';
      CX.beginPath(); CX.ellipse(x - S * .1, y - S * .24, S * .07, S * .025, .4, 0, 7); CX.fill();
      CX.globalAlpha = 1;
    }
  }
  if (!heroRect) {
    const [x, y] = at(4.35, .95);
    if (ok(ART.propOildrum)) {
      shadowUnder(CX, x, y + th * .18, S * .22, .4);
      spr(CX, ART.propOildrum, x, y + th * .2, S * .40, .95);
    } else {
      shadowUnder(CX, x, y + th * .18, S * .2, .42);
      const dw = S * .24, dh = S * .42;
      CX.fillStyle = '#5a2c1e';
      CX.beginPath(); CX.roundRect(x - dw / 2, y - dh, dw, dh, S * .03); CX.fill();
      CX.fillStyle = '#e2b23a'; CX.globalAlpha = .85;      // предупреждающая полоса
      CX.fillRect(x - dw / 2, y - dh * .58, dw, dh * .12);
      CX.globalAlpha = 1;
      CX.fillStyle = 'rgba(0,0,0,.35)';
      CX.fillRect(x - dw / 2, y - dh, dw * .32, dh);         // тень с одной стороны
      CX.save(); CX.translate(x, y - dh); CX.scale(1, .45);
      CX.fillStyle = '#6b3626'; CX.beginPath(); CX.arc(0, 0, dw / 2, 0, 7); CX.fill();
      CX.strokeStyle = 'rgba(0,0,0,.4)'; CX.lineWidth = 1.4; CX.stroke();
      CX.restore();
      CX.globalAlpha = .25; CX.fillStyle = '#fff';
      CX.fillRect(x - dw * .32, y - dh * .92, dw * .12, dh * .8);
      CX.globalAlpha = 1;
    }
  }

  /* 15.08 (просьба «гараж типо референса» — домкрат и штативный свет с фото):
     домкрат у ремонтной ямы, свет освещает угол с асиками. */
  if (!heroRect) {
    const [x, y] = at(3.35, 1.55);
    if (ok(ART.propFloorjack)) {
      shadowUnder(CX, x, y + th * .2, S * .32, .4);
      spr(CX, ART.propFloorjack, x, y + th * .22, S * .5, .95);
    } else {
      shadowUnder(CX, x, y + th * .18, S * .28, .4);
      CX.strokeStyle = '#8a2e22'; CX.lineWidth = S * .06;
      CX.beginPath(); CX.moveTo(x - S * .12, y); CX.lineTo(x + S * .05, y - S * .5); CX.stroke();
    }
  }
  if (!heroRect) {
    const [x, y] = at(3.7, 2.5);
    if (ok(ART.propTripodlight)) {
      shadowUnder(CX, x, y + th * .18, S * .22, .4);
      spr(CX, ART.propTripodlight, x, y + th * .2, S * .62, .95);
      CX.globalAlpha = .16 + .05 * Math.sin(T * 1.3);
      const glow = CX.createRadialGradient(x, y - S * 1.1, 0, x, y - S * 1.1, S * 1.1);
      glow.addColorStop(0, 'rgba(255,206,110,.55)'); glow.addColorStop(1, 'rgba(255,206,110,0)');
      CX.fillStyle = glow; CX.beginPath(); CX.arc(x, y - S * 1.1, S * 1.1, 0, 7); CX.fill();
      CX.globalAlpha = 1;
    } else {
      shadowUnder(CX, x, y + th * .16, S * .18, .4);
      CX.strokeStyle = '#7a6a3a'; CX.lineWidth = S * .035;
      CX.beginPath(); CX.moveTo(x, y); CX.lineTo(x, y - S * .85); CX.stroke();
      CX.fillStyle = '#ffdf96'; CX.beginPath(); CX.arc(x, y - S * .9, S * .1, 0, 7); CX.fill();
    }
  }

  /* Склад и сейф остаются в процедурном запасном гараже. В hero-фоне эта
     зона отдана под полки и должна оставаться свободной от лишнего силуэта. */
  if (!heroRect) {
    const [x, y] = heroRect ? at(4.1, 1.6) : at(4.6, 3.9);
    if (ok(ART.safe)) {
      shadowUnder(CX, x, y + th * .25, S * .5, .5);
      spr(CX, ART.safe, x, y + th * .34, S * 1.05);
    } else
    box2(CX, x, y, tw * .55, th * .55, 1, S * .62, '#2c2416', '#20190e', '#171208');
    CX.fillStyle = P.gold;
    const stacks = Math.min(12, 1 + gar.store / 60 | 0);
    const useSafe = ok(ART.safe);
    for (let k = 0; k < stacks; k++) {
      const sx = x - S * (useSafe ? .52 : .28) + (k % 4) * S * .17,
            sy = y + (useSafe ? S * .30 - (k / 4 | 0) * S * .08 : -S * .66 - (k / 4 | 0) * S * .11);
      CX.save(); CX.translate(sx, sy); CX.scale(1, .5);
      CX.globalAlpha = .95;
      CX.beginPath(); CX.arc(0, 0, S * .07, 0, 7); CX.fill();
      CX.restore();
    }
    CX.globalAlpha = .55 + .25 * Math.sin(T * 1.7);
    CX.drawImage(G_GOLD, x - 8, y - S * .7 - 8);
    CX.globalAlpha = 1;
  }

  /* лампа и конус света с пылью */
  {
    const [lx, ly] = at(2.6, 2.6);
    const topY = ly - WH * 1.15, sway = Math.sin(T * .7) * S * .05;
    CX.strokeStyle = '#2a3050'; CX.lineWidth = 2;
    CX.beginPath(); CX.moveTo(lx, topY); CX.lineTo(lx + sway, topY + S * .5); CX.stroke();
    const bx = lx + sway, by = topY + S * .5;
    CX.fillStyle = '#39406a'; CX.fillRect(bx - 5, by, 10, 6);
    /* конус */
    const cone = CX.createLinearGradient(bx, by, bx, by + S * 2.6);
    cone.addColorStop(0, 'rgba(255,223,150,.20)'); cone.addColorStop(1, 'rgba(255,223,150,0)');
    CX.fillStyle = cone;
    CX.beginPath();
    CX.moveTo(bx - 6, by + 6); CX.lineTo(bx + 6, by + 6);
    CX.lineTo(bx + S * 1.15 + sway * 2, by + S * 2.6); CX.lineTo(bx - S * 1.15 + sway * 2, by + S * 2.6);
    CX.closePath(); CX.fill();
    CX.drawImage(G_WARM, bx - 7, by - 2);
    /* пылинки в луче: чем грязнее, тем гуще */
    const vis = Math.floor(6 + gar.dust * 20);
    for (let k = 0; k < vis; k++) {
      const m = gar.motes[k % gar.motes.length];
      const mx = bx + Math.sin(T * .25 * m.s + m.ph) * S * (0.2 + m.x * .8) * (0.3 + m.y);
      const my = by + S * .3 + ((T * .022 * m.s + m.y) % 1) * S * 2.1;
      CX.globalAlpha = .25 * (1 - ((T * .022 * m.s + m.y) % 1));
      CX.fillStyle = '#ffdf96';
      CX.fillRect(mx, my, 1.6, 1.6);
    }
    CX.globalAlpha = 1;
  }

  /* наёмники и охрана: полноценная фигура в полный рост, а не «палка с
     портретом» (просьба 14.08 — «полную модель, а не пиксель с картинкой
     на лице»). Плечи шире бёдер, видны руки и ботинки, портрет остаётся
     на месте головы. guardSprites() отдаёт объекты той же формы (ti/tj/
     av/c/name/role), что и наёмники, поэтому оба списка идут одним циклом;
     хитбоксы для клика по охраннику копим тут же и раз в кадр очищаем. */
  guardHitboxes = [];
  for (const mrc of [...garageMercs(), ...guardSprites()]) {
    /* Охрана и наёмники не стоят манекенами: на hero-сцене они медленно
       обходят свободный пол, сохраняя свои безопасные зоны. */
    const walkPhase = (mrc.guardIndex !== undefined ? mrc.guardIndex : 20 + mrc.ti * 3 + mrc.tj) * 1.71;
    const walk = heroRect ? {
      i: Math.sin(T * .18 + walkPhase) * .34,
      j: Math.cos(T * .15 + walkPhase * .73) * .22,
    } : { i: 0, j: 0 };
    const [mx, my] = at(mrc.ti + walk.i, mrc.tj + walk.j);
    if (mrc.guardIndex !== undefined)
      guardHitboxes.push({ i: mrc.guardIndex, x0: mx - S * .55, y0: my - S * 1.15, x1: mx + S * .55, y1: my + S * .2 });
    const br = Math.sin(T * 1.6 + mrc.ti) * 1.2;          // дыхание
    const face = ART[mrc.av];
    /* тень под ногами */
    CX.save(); CX.translate(mx, my); CX.scale(1, .5);
    CX.fillStyle = 'rgba(0,0,0,.42)';
    CX.beginPath(); CX.arc(0, 0, S * .17, 0, 7); CX.fill(); CX.restore();

    /* если для этого типа охраны сгенерилась готовая фигура в полный рост
       (bandy_art/queue.txt, 14.08) — используем её вместо процедурной,
       та остаётся запасным вариантом, пока картинки нет на диске. */
    /* Возвращаем полноразмерные красивые спрайты охраны; проблемный №10
       рисуем процедурно, чтобы убрать его прозрачность. */
    const fullArt = mrc.full && ART[mrc.full];
    if (ok(fullArt)) {
      CX.globalAlpha = 1;
      /* У исходных PNG разная ширина, поэтому масштаб по ширине делал
         персонажей разного роста. Фиксируем высоту, а ширину считаем
         из пропорций каждого спрайта. */
      const nativeW = fullArt.naturalWidth || fullArt.width;
      const nativeH = fullArt.naturalHeight || fullArt.height;
      const guardH = S * 1.42;
      const guardW = guardH * nativeW / nativeH;
      CX.drawImage(fullArt, mx - guardW / 2, my - guardH, guardW, guardH);
      CX.font = '700 ' + Math.max(9, S * .085 | 0) + 'px Segoe UI';
      CX.textAlign = 'center';
      CX.fillStyle = 'rgba(230,232,240,.92)';
      CX.fillText(tr(mrc.name), mx, my - guardH - S * .08);
      CX.font = (Math.max(8, S * .07 | 0)) + 'px Segoe UI';
      CX.fillStyle = 'rgba(125,132,160,.85)';
      CX.fillText(tr(mrc.role), mx, my - guardH + S * .03);
      continue;
    }

    /* тон куртки: тёмный/светлый вариант для тени и света по бокам фигуры */
    const cDark = shade(mrc.c, .68), cLight = shade(mrc.c, 1.22);

    /* ---- ноги: бёдра + голени + ботинки, чуть расставлены для устойчивости ---- */
    const hipY = my - S * .40, legW = S * .072;
    for (const side of [-1, 1]) {
      const lx = mx + side * S * .058;
      CX.fillStyle = side < 0 ? cDark : mrc.c;             // штаны в цвет формы, потемнее с одной стороны
      CX.beginPath(); CX.roundRect(lx - legW / 2, hipY, legW, S * .28, S * .02); CX.fill();
      CX.fillStyle = '#14151d';                             // ботинок
      CX.beginPath(); CX.roundRect(lx - legW / 2 - 1, my - S * .05, legW + 2, S * .08, S * .018); CX.fill();
    }

    /* ---- торс: сужается к поясу, шире в плечах — читается объём, а не прямоугольник ---- */
    const shY = my - S * .68 + br, waY = my - S * .40;
    const shW = S * .21, waW = S * .15;
    CX.fillStyle = mrc.c;
    CX.beginPath();
    CX.moveTo(mx - shW / 2, shY); CX.lineTo(mx + shW / 2, shY);
    CX.lineTo(mx + waW / 2, waY); CX.lineTo(mx - waW / 2, waY);
    CX.closePath(); CX.fill();
    CX.fillStyle = cDark; CX.globalAlpha = .55;             // тень с правой стороны торса
    CX.beginPath();
    CX.moveTo(mx + shW * .12, shY); CX.lineTo(mx + shW / 2, shY);
    CX.lineTo(mx + waW / 2, waY); CX.lineTo(mx + waW * .12, waY);
    CX.closePath(); CX.fill(); CX.globalAlpha = 1;
    CX.fillStyle = cLight; CX.globalAlpha = .35;             // блик слева
    CX.beginPath();
    CX.moveTo(mx - shW / 2, shY); CX.lineTo(mx - shW * .18, shY);
    CX.lineTo(mx - waW * .18, waY); CX.lineTo(mx - waW / 2, waY);
    CX.closePath(); CX.fill(); CX.globalAlpha = 1;
    CX.strokeStyle = '#14151d'; CX.lineWidth = 1;            // ремень на поясе
    CX.beginPath(); CX.moveTo(mx - waW / 2, waY - 2); CX.lineTo(mx + waW / 2, waY - 2); CX.stroke();

    /* ---- руки: от плеча вдоль корпуса, с кистью у бедра ---- */
    for (const side of [-1, 1]) {
      const ax = mx + side * (shW / 2 - S * .01), ay0 = shY + S * .02;
      CX.fillStyle = side < 0 ? cLight : cDark;
      CX.beginPath();
      CX.roundRect(ax - S * .026 + side * S * .01, ay0, S * .052, S * .24, S * .022);
      CX.fill();
      CX.fillStyle = '#c9a184';                              // кисть
      CX.beginPath(); CX.arc(ax + side * S * .01, ay0 + S * .25, S * .026, 0, 7); CX.fill();
    }

    /* ---- голова: портрет, если загрузился, иначе кружок как раньше ---- */
    const hy = shY - S * .10;
    if (ok(face)) {
      const r = S * .108;
      shadowUnder(CX, mx, my, S * .16, .25);
      CX.fillStyle = '#c9a184';                              // шея
      CX.fillRect(mx - S * .03, hy + r * .55, S * .06, S * .07);
      CX.save();
      CX.beginPath(); CX.arc(mx, hy - r * .35, r, 0, 7); CX.clip();
      CX.drawImage(face, mx - r, hy - r * 1.35, r * 2, r * 2);
      CX.restore();
      CX.strokeStyle = 'rgba(245,197,66,.55)'; CX.lineWidth = 1.4;
      CX.beginPath(); CX.arc(mx, hy - r * .35, r, 0, 7); CX.stroke();
    } else {
      CX.fillStyle = '#c9a184';
      CX.fillRect(mx - S * .03, hy + S * .01, S * .06, S * .06);
      CX.beginPath(); CX.arc(mx, hy - S * .045, S * .062, 0, 7); CX.fill();
      CX.fillStyle = '#0f1220';
      CX.beginPath(); CX.arc(mx, hy - S * .11, S * .062, Math.PI, 0); CX.fill();
    }
    /* сигарета */
    if (mrc.smoke) {
      const em = .5 + .5 * Math.sin(T * 2.4);
      CX.fillStyle = `rgba(255,120,60,${.4 + .6 * em})`;
      CX.fillRect(mx + S * .07, hy - S * .04, 2.5, 2.5);
      CX.globalAlpha = .16;
      CX.fillStyle = '#aab';
      CX.beginPath();
      CX.arc(mx + S * .09 + Math.sin(T) * 3, hy - S * .13 - (T * 8 % 20), 3 + (T * 8 % 20) / 4, 0, 7);
      CX.fill();
      CX.globalAlpha = 1;
    }
    const top = hy - S * .30;
    /* бейдж */
    CX.font = '700 ' + Math.max(9, S * .085 | 0) + 'px Segoe UI';
    CX.textAlign = 'center';
    CX.fillStyle = 'rgba(230,232,240,.92)';
    CX.fillText(tr(mrc.name), mx, top);
    CX.font = (Math.max(8, S * .07 | 0)) + 'px Segoe UI';
    CX.fillStyle = 'rgba(125,132,160,.85)';
    CX.fillText(tr(mrc.role), mx, top + S * .09);
  }

  /* Собака — это не только бонус в формуле защиты. Раньше покупка записывала
     gar.dog, но на Canvas не было ни одного draw-вызова: игрок платил и не
     видел питомца. Рисуем её у ворот отдельным компактным спрайтом, чтобы не
     пересекалась с охраной и стойками асиков. */
  if (gar.dog) {
    const dog = (typeof DOG_TYPES !== 'undefined' ? DOG_TYPES.find(d => d.id === gar.dog) : null);
    const [dx, dy] = at(heroRect ? 2.72 : 1.1, heroRect ? 4.75 : 4.7);
    const coat = gar.dog === 'bull' ? '#b98552' : gar.dog === 'shep' ? '#523d2d' : '#827460';
    const belly = gar.dog === 'bull' ? '#e2c69b' : '#c3b69b';
    const bob = Math.sin(T * 2.1) * S * .012;
    CX.save();
    CX.translate(dx, dy + bob);
    CX.scale(1, .55);
    CX.fillStyle = 'rgba(0,0,0,.43)';
    CX.beginPath(); CX.ellipse(0, 0, S * .23, S * .12, 0, 0, Math.PI * 2); CX.fill();
    CX.restore();
    CX.fillStyle = coat;
    CX.beginPath(); CX.ellipse(dx, dy - S * .12 + bob, S * .19, S * .12, 0, 0, Math.PI * 2); CX.fill();
    CX.beginPath(); CX.arc(dx + S * .16, dy - S * .18 + bob, S * .085, 0, Math.PI * 2); CX.fill();
    CX.fillStyle = '#17151a';
    CX.beginPath(); CX.arc(dx + S * .225, dy - S * .19 + bob, S * .022, 0, Math.PI * 2); CX.fill();
    CX.fillStyle = belly;
    for (const lx of [-.11, .07]) CX.fillRect(dx + lx * S, dy - S * .09 + bob, S * .038, S * .13);
    CX.strokeStyle = coat; CX.lineWidth = Math.max(2, S * .027);
    CX.beginPath(); CX.moveTo(dx - S * .17, dy - S * .16 + bob); CX.quadraticCurveTo(dx - S * .30, dy - S * .25 + bob, dx - S * .31, dy - S * .09 + bob); CX.stroke();
    CX.font = '700 ' + Math.max(9, S * .078 | 0) + 'px Segoe UI';
    CX.textAlign = 'center'; CX.fillStyle = 'rgba(230,232,240,.92)';
    CX.fillText(dog ? `${dog.emoji} ${tr(dog.name)}` : (LANG === 'en' ? '🐕 Dog' : '🐕 Собака'), dx, dy - S * .38 + bob);
  }

  /* всплеск продувки */
  for (let k = gar.burst.length - 1; k >= 0; k--) {
    const b = gar.burst[k];
    b.x += b.vx; b.y += b.vy; b.a -= .016;
    if (b.a <= 0) { gar.burst.splice(k, 1); continue; }
    CX.globalAlpha = b.a * .5;
    CX.fillStyle = '#9aa3c4';
    CX.fillRect(b.x * W, b.y * H, 2.2, 2.2);
  }
  CX.globalAlpha = 1;

  /* монеты, летящие в счётчик при сборе */
  for (let k = gar.coins.length - 1; k >= 0; k--) {
    const c = gar.coins[k];
    c.t += .022;
    if (c.t < 0) continue;
    if (c.t >= 1) { gar.coins.splice(k, 1); continue; }
    const e = c.t * c.t * (3 - 2 * c.t);
    const x = c.x * W + (W * .5 - c.x * W) * e;
    const y = c.y * H + (H * .12 - c.y * H) * e - Math.sin(e * Math.PI) * 70;
    CX.drawImage(G_GOLD, x - 8, y - 8);
    CX.fillStyle = P.gold;
    CX.save(); CX.translate(x, y); CX.scale(1, .6);
    CX.beginPath(); CX.arc(0, 0, 4, 0, 7); CX.fill(); CX.restore();
  }

  /* виньетка + лёгкая цветокоррекция (14.08: «должно быть самое красивое
     место» — референсы мастерских/гаражей в топовых играх держат контраст
     через тёмные углы и чуть холодный край против тёплого центра). */
  if (!drawGarage._vg || drawGarage._vgKey !== W + 'x' + H) {
    const vg = CX.createRadialGradient(W / 2, H * .46, S * 1.6, W / 2, H / 2, Math.max(W, H) * .70);
    vg.addColorStop(0, 'rgba(20,14,8,0)');
    vg.addColorStop(.6, 'rgba(8,8,14,.10)');
    vg.addColorStop(1, 'rgba(4,5,12,.62)');
    drawGarage._vg = vg; drawGarage._vgKey = W + 'x' + H;
  }
  CX.fillStyle = drawGarage._vg; CX.fillRect(0, 0, W, H);
  /* едва заметный тёплый оттенок в зоне света — не красит всё подряд, только усиливает уже тёплый луч */
  CX.save();
  /* 28.08: 'soft-light' знают не все браузеры. По спецификации присваивание
     неизвестного режима ИГНОРИРУЕТСЯ, и остаётся 'source-over' — тёплый
     градиент ложился сплошной оранжевой заливкой на весь гараж, отчего сцена
     выглядела засвеченной. Проверяем, что режим действительно применился, и
     без него просто не рисуем этот декоративный слой. */
  CX.globalCompositeOperation = 'soft-light';
  if (CX.globalCompositeOperation === 'soft-light') {
    const wg = CX.createRadialGradient(W / 2, H * .40, 0, W / 2, H * .40, Math.max(W, H) * .45);
    wg.addColorStop(0, 'rgba(255,190,120,.28)'); wg.addColorStop(1, 'rgba(255,190,120,0)');
    CX.fillStyle = wg; CX.fillRect(0, 0, W, H);
  }
  CX.restore();
}
