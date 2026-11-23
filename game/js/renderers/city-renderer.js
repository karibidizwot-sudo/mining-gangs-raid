'use strict';

/* 24.08: чужой текст (имена игроков, названия банд) попадает в innerHTML —
   экранируем локально, чтобы файл не зависел от порядка загрузки map.html. */
function mgEsc(value) {
  return String(value == null ? '' : value)
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/* 14.08: кирпичная кладка для стен гаража — процедурно, тем же путём, что и
   остальные текстуры (createPattern одинаково берёт и Image, и canvas), без
   зависимости от арт-генератора: тот рисует в фотореалистичном стиле (фото
   серверных стоек), который будет чужеродно смотреться на плоской
   изометрической сцене гаража — проверено на уже сгенерённых int_workshop.png
   и site_garage_v3.png. Тайл кэшируется один раз. */
let _brickTileCv = null;
/* 14.08 (просьба «сделать кирпич старее»): та же кладка, но состаренная —
   грязный тёмный раствор вместо чистого бежевого, копоть и потёки к низу
   стены (низ тайла = низ стены, кладка тайлится по вертикали), редкие
   сколы кирпича и пятна высолов/мха в швах. Детерминированный «случай»
   через (row,col) — тайл кэшируется один раз, но при перегенерации
   результат стабилен, а не мигает новым узором. */
function brickTile() {
  if (_brickTileCv) return _brickTileCv;
  const cv = document.createElement('canvas');
  cv.width = 96; cv.height = 48;
  const g = cv.getContext('2d');
  g.fillStyle = '#4c4238';                  // раствор — тёмный, грязный, не новодел
  g.fillRect(0, 0, 96, 48);
  const BW = 32, BH = 16, GAP = 2;
  const shades = ['#6e3a2d', '#78402f', '#5f3226', '#71402f', '#582c22', '#7a4632', '#4f2a20'];
  const rnd = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };
  let n = 0;
  for (let row = -1; row < 4; row++) {
    const offset = (((row % 2) + 2) % 2) ? BW / 2 : 0;
    const nearBottom = row / 3;                          // 0 верх .. ~1 низ — копоть гуще внизу
    for (let col = -1; col < 4; col++) {
      const x = col * BW + offset, y = row * BH;
      g.fillStyle = shades[(n++ * 7 + row * 3 + col * 5 + 11) % shades.length];
      g.fillRect(x + GAP / 2, y + GAP / 2, BW - GAP, BH - GAP);
      /* скол — треугольный кусок кирпича отсутствует, виден раствор */
      if (rnd(row, col) > .86) {
        g.fillStyle = '#463c33';
        g.beginPath();
        g.moveTo(x + GAP, y + BH - GAP); g.lineTo(x + GAP + 6, y + BH - GAP);
        g.lineTo(x + GAP, y + BH - GAP - 6); g.closePath(); g.fill();
      }
      /* копоть/грязь — темнее и чаще к низу стены */
      const grime = rnd(row + 5, col + 5);
      if (grime < .35 + nearBottom * .4) {
        g.fillStyle = `rgba(10,8,6,${(.10 + nearBottom * .22) * (1 - grime)})`;
        g.fillRect(x + GAP / 2, y + GAP / 2, BW - GAP, BH - GAP);
      }
      /* высолы — редкие светлые известковые потёки в шве */
      if (rnd(row + 11, col + 3) > .92) {
        g.fillStyle = 'rgba(196,190,172,.16)';
        g.fillRect(x + GAP + 4, y - GAP, 3, BH + GAP * 2);
      }
      /* мох в единичных швах у низа */
      if (nearBottom > .55 && rnd(row + 20, col + 7) > .90) {
        g.fillStyle = 'rgba(90,110,60,.20)';
        g.beginPath(); g.arc(x + BW / 2, y + BH - 1, 4, 0, 7); g.fill();
      }
      g.fillStyle = 'rgba(0,0,0,.14)';        // лёгкая тень снизу кирпича — объём
      g.fillRect(x + GAP / 2, y + BH - GAP - 2, BW - GAP, 2);
      g.fillStyle = 'rgba(255,255,255,.035)'; // едва заметный блик сверху — не «новый глянец»
      g.fillRect(x + GAP / 2, y + GAP / 2, BW - GAP, 1.5);
    }
  }
  _brickTileCv = cv;
  return cv;
}

/* --- изометрия --- */
const TW = 52, TH = 26;                 // тайл 2:1
const iso = (i, j) => [(i - j) * TW / 2, (i + j) * TH / 2];

/* --- палитра --- */
const P = {
  ground: '#101321', groundHi: '#131728', road: '#0a0c14', roadLine: '#1d2233',
  wallL: '#1a1e2f', wallR: '#12151f', roof: '#232840', roofHi: '#2a3050',
  winWarm: '#ffcf6e', winCold: '#9fd8ff', winDim: '#6a5a35',
  gold: '#f5c542', green: '#3ddc84', red: '#ff5d6c', acc: '#4fa3ff',
};
/* members (13.08): численность банды-соперника — нужна, чтобы во время
   объявленной войны показать «сколько у них онлайн для битвы», а не только
   свою сторону. У чужих банд нет настоящего состава (это NPC), поэтому
   members — фиксированное число для этого расчёта, примерно по силе банды. */
/* 29.08: массив достался от прототипа и рассчитан ровно на три банды.
   Сервер кладёт в слот 0 твою банду, а ЧУЖИЕ банды получают слоты с третьего
   и выше — в этом массиве их нет. Из 45 обращений вида GANGS[n].name защищены
   были шесть, остальные роняли рендер, стоило посмотреть на чужую территорию:
   карточка квартала, разведка, тосты. Свой клан у всех слот 0 и всегда есть,
   поэтому у владельца аккаунта всё работало, а у остальных нет.
   Обёртка отдаёт заглушку вместо пустого слота — это чинит все места сразу,
   а не 45 по отдельности. Запись GANGS[n] = {...} работает как раньше, длина
   массива тоже настоящая. Признак missing оставлен, чтобы отрисовка при
   желании могла показать «данные ещё едут», а не выдумывать имя. */
const GANGS_RAW = [
  { name: 'СЕВЕРНЫЕ', c: '#3ddc84', score: 1240, members: 18 },
  { name: 'ДОКИ',     c: '#4fa3ff', score: 980,  members: 14 },
  { name: 'КОЛЬЦО',   c: '#ff5d6c', score: 1515, members: 22 },
];
const GANGS = new Proxy(GANGS_RAW, {
  get(target, prop, recv) {
    if (typeof prop === 'string' && /^\d+$/.test(prop) && !(prop in target)) {
      return { name: '—', c: '#7d84a0', score: 0, members: 0, missing: true };
    }
    return Reflect.get(target, prop, recv);
  },
});
/* Настоящее наличие слота: заглушка выше всегда истинна, поэтому проверять
   через `if (!GANGS[slot])` больше нельзя. */
window.GANGS_HAS = slot => Object.prototype.hasOwnProperty.call(GANGS_RAW, slot);
const SEASON_END = Date.now() + (4 * 24 + 11) * 3600 * 1000;   // демо-таймер

/* ============================== ГОРОД =====================================
   Сетка кварталов (по умолчанию 4x4, каждый 4x4 тайла, между ними дороги
   шириной 1 тайл). Типы: apart (жилые), garage (гаражи), hotel (центр),
   wind (ветряк кита), yard (пустырь). У квартала — банда-владелец или
   нейтралитет.

   Просьба (13.08, пятый заход): «увеличить надо не карту мира, а то, что
   внутри района — и не у всех районов сразу, а начать с ЦЕНТРа, у него
   должен быть свой, отдельный, большой интерьер». До этого «квартальный
   вид» был один на всю игру — какой бы район на карте мира ты ни выбрал,
   «Войти в район» вело в одну и ту же сетку 4x4. Разносить интерьер для
   каждого из двадцати районов карты — отдельная большая работа на потом (по
   просьбе самого игрока), а вот ЦЕНТР получает свою сетку уже сейчас: в 7x7
   почти втрое больше кварталов, свой замес типов (плотнее к центру, где
   стоит башня, реже к краю) и своя расстановка жителей.

   Технически это ЗНАЧИТ, что вся генерация квартального вида — не разовый
   код при загрузке страницы, а функция genCity(cfg), которую можно вызвать
   ещё раз с другими параметрами. «Войти в район» из ЦЕНТРа пересобирает
   сетку под CENTER_CITY_CFG, из любого другого района — возвращает под
   DEFAULT_CITY_CFG. Существующие функции отрисовки (renderStatic, hitTag,
   drawZoomDetail и т.д.) ничего не знают о переключении — они как читали
   districts/builds/BLOCKS/BS/SIDE, так и читают, просто теперь это не
   константы, а всегда «текущий активный город».                            */
let BLOCKS, BS, GAP, SIDE, MINE;
const districts = [];
const builds = [];
/* All city variants use the same readable, low-density zoning. The URL art
   flag only selects the sprite family; it never changes the city layout. */
const THEMED_CITY_MODE = true;
/* Test-art city zoning: each block must read as one place, not as a random
   sampler of every sprite.  Density is intentionally low: empty cells leave
   breathing room for roads, trees and the static street props below. */
const CONCEPT_GROUND = Object.freeze({
  apart: ['#1b2b32', '#20343b'], garage: ['#252833', '#2d303b'],
  hotel: ['#2b2930', '#343039'], wind: ['#18323a', '#1d3c44'],
  yard: ['#20382d', '#294634'], dock: ['#17303b', '#1d3b47'],
  factory: ['#292b31', '#34363c'], scrap: ['#332a2a', '#413232'],
  plant: ['#202b34', '#293641'], quarry: ['#352f27', '#41382e'],
  hangar: ['#222b34', '#2b3641'],
});
const distAt = (i, j) => districts.find(d =>
  i >= d.i0 && i < d.i0 + BS && j >= d.j0 && j < d.j0 + BS) || null;

/* Состав квартала: имена и риги — не выдумка на каждый визит, а фиксированный
   набор, чтобы город был узнаваемым. Пул ников общий для обоих городов (он и
   так большой и по договорённости не переводится — см. словарь EN ниже). */
const NICKS = ['ШУРА','ТИМОХА','ЗАВХОЗ','ЛЫСЫЙ','ДЯДЯ ВИТЯ','ПАУК','МОНТЁР','КАРАСЬ',
               'БАТЯ','ЖЕКА','ТОЩИЙ','СТАКАН','ФАРАОН','ГАЙКА','СВАРЩИК','НЕМОЙ',
               'ПОЧТАЛЬОН','РЫЖИЙ','ТУМАН','КРОТ','БОЦМАН','ЩУКА','КЛЁН','ПРОВОД'];

const TYPES = ['apart','garage','apart','garage','yard','garage','apart','wind',
               'garage','apart','garage','apart','garage','yard','apart','garage'];
/* First-generation street PNGs contain an entire road tile around the object.
   Rendering them as individual lamps/cars/trees duplicates road geometry and
   produces the tall cut-off rectangles seen on the map.  Keep them loaded for
   archive/reference, but use the clean procedural props until isolated sprites
   replace them. */
const USE_LEGACY_STREET_PROP_SPRITES = false;
/* Запасной вариант на случай района без явного описания (сейчас у всех 22
   районов оно есть, см. CITY_CFGS ниже) — отеля тут больше нет: по правилу
   игрока отель один, и только в ЦЕНТРе. */
const DEFAULT_CITY_CFG = { blocks: 4, bs: 4, gap: 1, seed: 20260812, hotelAt: null, types: TYPES };

/* ЦЕНТР: замес типов не наугад — ближе к башне (центр сетки) плотная жилая и
   гаражная застройка, к краю всё чаще пустыри и ветряки, как и положено
   деловому центру, у которого есть окраина. Генерируется один раз тем же
   мини-ГПСЧ, что и всё остальное в файле — не Math.random(), чтобы город был
   стабильным между визитами в рамках сессии. */
const CENTER_TYPES = (() => {
  let s = 90210;
  const r = () => (s = s * 16807 % 2147483647) / 2147483647;
  const out = [];
  for (let bj = 0; bj < 7; bj++)
    for (let bi = 0; bi < 7; bi++) {
      const distC = Math.abs(bi - 3) + Math.abs(bj - 3);
      const roll = r();
      out.push(distC <= 2 ? (roll < .55 ? 'apart' : 'garage')
                           : roll < .38 ? 'apart' : roll < .72 ? 'garage' : roll < .88 ? 'yard' : 'wind');
    }
  return out;
})();
const CENTER_CITY_CFG = { blocks: 7, bs: 4, gap: 1, seed: 20260813, hotelAt: [3, 3], types: CENTER_TYPES };

/* СЕВЕРНЫЕ ГАРАЖИ (13.08, седьмой-восьмой заходы): твой родной район
   (WORLD_HOME) — тоже 7x7, но замес типов совсем другой, чем в ЦЕНТРе: не
   «плотнее к башне», а гаражи почти везде, потому что это буквально
   гаражный кооператив, а не деловой центр. К краю сетки чаще попадаются
   пустыри (склады/хлам), изредка жилой дом — для дыхания, но не как
   основа. БЕЗ ветряков — это тема ВЕТРЯНОГО ПОЛЯ, другого района на карте,
   не гаражей. И БЕЗ отеля — по правилам игрока отель только один, в
   ЦЕНТРе; hotelAt здесь намеренно null (см. genCity — при null тайл-отель
   просто не назначается никому). Доступ к борьбе за отель у игрока
   остаётся всё равно — отдельной кнопкой в Арене («Перейти к борьбе за
   отель»), она не завязана на то, есть ли в текущем городе тайл-отель.
   Своя ухоженность зданий (см. b.cond в genCity) даёт визуальную пестроту
   без раздувания типов района.                                          */
const NORTH_TYPES = (() => {
  let s = 60606;
  const r = () => (s = s * 16807 % 2147483647) / 2147483647;
  const out = [];
  for (let bj = 0; bj < 7; bj++)
    for (let bi = 0; bi < 7; bi++) {
      const distC = Math.abs(bi - 3) + Math.abs(bj - 3);
      const roll = r();
      out.push(distC <= 3 ? (roll < .85 ? 'garage' : roll < .96 ? 'apart' : 'yard')
                           : roll < .68 ? 'garage' : roll < .93 ? 'yard' : 'apart');
    }
  return out;
})();
const NORTH_CITY_CFG = { blocks: 7, bs: 4, gap: 1, seed: 20260814, hotelAt: null, types: NORTH_TYPES };

/* ВСЕ ОСТАЛЬНЫЕ РАЙОНЫ (13.08, девятый заход): «сделай все районы 7на7 со
   своим дизайном по названию». У нас есть только 4 вида застройки в движке
   (apart/garage/yard/wind — своя новая графика есть пока только у гаражей),
   так что «свой дизайн» здесь — не новые картинки под каждое имя (это
   отдельная, гораздо более долгая работа, будем дорисовывать по одному
   району за раз, как гаражи), а свой замес этих типов и свой сид на район,
   подобранный по смыслу названия: где гуще жильё, где голый пустырь, где
   почти сплошные ветряки и т.д. Это тот же принцип, что и в ЦЕНТРе/СЕВЕРНЫХ
   ГАРАЖАХ (плотнее к центру сетки / чаще к краю), просто вынесенный в
   функцию, а не переписанный 20 раз вручную.
   mixCore/mixEdge — пары [тип, доля], доли складываются в 1. coreRadius —
   манхэттенское расстояние от центра сетки (3,3), внутри которого действует
   mixCore, снаружи — mixEdge. Отель нигде из них не ставится (hotelAt всегда
   null) — по правилу «отель один, в ЦЕНТРе». */
function makeTypesGrid(seed, mixCore, mixEdge, coreRadius = 2) {
  let s = seed;
  const r = () => (s = s * 16807 % 2147483647) / 2147483647;
  const pick = (mix, roll) => {
    let acc = 0;
    for (const [t, w] of mix) { acc += w; if (roll < acc) return t; }
    return mix[mix.length - 1][0];
  };
  const out = [];
  for (let bj = 0; bj < 7; bj++)
    for (let bi = 0; bi < 7; bi++) {
      const distC = Math.abs(bi - 3) + Math.abs(bj - 3);
      out.push(pick(distC <= coreRadius ? mixCore : mixEdge, r()));
    }
  return out;
}
const cityCfg7 = (seed, mixCore, mixEdge, coreRadius) =>
  ({ blocks: 7, bs: 4, gap: 1, seed, hotelAt: null, types: makeTypesGrid(seed, mixCore, mixEdge, coreRadius) });

/* ДОКИ — плотные портовые склады (гараж как замена пакгауза) и открытые
   грузовые дворы, немного жилья для докеров. */
/* 13.08, десятый заход: первый район со СВОЕЙ графикой (не гараж/жильё/пустырь,
   а честный портовый склад, тип 'dock') — см. genCity ниже, ART_SRC bDock*
   и очередь генератора. Пока картинки не готовы — ok() их отфильтрует, ничего
   не сломается (тот же принцип, что и с гаражами). */
const DOCKS_CITY_CFG = cityCfg7(30301,
  [['dock', .55], ['yard', .30], ['apart', .15]],
  [['dock', .35], ['yard', .45], ['apart', .20]]);
/* ПРОМЗОНА (13.08, одиннадцатый заход: второй район со своей графикой) —
   почти сплошные цеха/мастерские (тип 'factory', см. genCity/ART_SRC ниже),
   жильё редкость. */
const INDUSTRY_CITY_CFG = cityCfg7(30303,
  [['factory', .60], ['yard', .35], ['apart', .05]],
  [['factory', .40], ['yard', .55], ['apart', .05]]);
/* ВЕТРЯНОЕ ПОЛЕ — буквально поле ветряков, единственный район, где ветряк —
   основа застройки, а не редкий акцент. */
const WINDFIELD_CITY_CFG = cityCfg7(30304,
  [['wind', .70], ['yard', .25], ['garage', .05]],
  [['wind', .55], ['yard', .35], ['garage', .10]]);
/* СТАРЫЙ РАЙОН — старая уютная застройка, жильё вперемешку с гаражами. */
const OLDDIST_CITY_CFG = cityCfg7(30305,
  [['apart', .45], ['garage', .40], ['yard', .15]],
  [['apart', .35], ['garage', .35], ['yard', .30]]);
/* ВЫСОТКИ — почти сплошной жилой массив, высотки доминируют. */
const HIGHRISE_CITY_CFG = cityCfg7(30306,
  [['apart', .80], ['garage', .15], ['yard', .05]],
  [['apart', .65], ['garage', .20], ['yard', .15]]);
/* ДЕПО — ряды мастерских/боксов, как у депо, умеренные дворы. */
const DEPOT_CITY_CFG = cityCfg7(30307,
  [['garage', .65], ['yard', .25], ['apart', .10]],
  [['garage', .45], ['yard', .40], ['apart', .15]]);
/* РЫНОК — плотная суета: жильё и гаражи-лавки почти поровну, дворов мало. */
const MARKET_CITY_CFG = cityCfg7(30308,
  [['apart', .45], ['garage', .45], ['yard', .10]],
  [['apart', .35], ['garage', .40], ['yard', .25]]);
/* СВАЛКА (13.08, двенадцатый заход: третий район со своей графикой) —
   свалка/скрап-площадка, тип 'scrap' (см. genCity/ART_SRC ниже) — сараи с
   ломом и прессованным металлом вместо гаражей, пустырь как редкий фон. */
const DUMP_CITY_CFG = cityCfg7(30309,
  [['scrap', .70], ['yard', .25], ['apart', .05]],
  [['scrap', .55], ['yard', .40], ['apart', .05]]);
/* НАБЕРЕЖНАЯ — просторная жилая набережная, дворы как променад. */
const EMBANK_CITY_CFG = cityCfg7(30310,
  [['apart', .45], ['yard', .35], ['garage', .20]],
  [['apart', .30], ['yard', .50], ['garage', .20]]);
/* КОЛЬЦО — тип тот же, что у СЕВЕРНЫХ ГАРАЖЕЙ, но рисунок наоборот: пусто в
   середине, гаражи плотным кольцом по краю сетки — само название района
   буквально в раскладке. */
const RING_CITY_CFG = cityCfg7(30311,
  [['yard', .55], ['garage', .35], ['apart', .10]],
  [['garage', .70], ['yard', .20], ['apart', .10]], 2);
/* ТУННЕЛИ — почти пусто, редкие постройки у входов. */
const TUNNELS_CITY_CFG = cityCfg7(30312,
  [['yard', .60], ['garage', .30], ['apart', .10]],
  [['yard', .80], ['garage', .15], ['apart', .05]]);
/* ПУСТЫРИ — ровно, без деления на центр/край: почти сплошной пустырь. */
const WASTELAND_CITY_CFG = cityCfg7(30313,
  [['yard', .85], ['garage', .12], ['apart', .03]],
  [['yard', .85], ['garage', .12], ['apart', .03]]);
/* НЕДОСТРОЙ (13.08, замена СТАРОГО ПОРТА — тот был слишком похож по смыслу
   на ДОКИ, тем более когда у ДОКОВ появилась своя графика складов, а тут
   даже раньше был generic замес). Заброшенная стройка: скелеты недостроенных
   высоток (жильё как замена — самое похожее, что есть) торчат среди пустырей
   и вагончиков-времянок, ни одного гаража-мастерской как основы. */
const UNFINISHED_CITY_CFG = cityCfg7(30322,
  [['yard', .65], ['apart', .25], ['garage', .10]],
  [['yard', .80], ['apart', .15], ['garage', .05]]);
/* ТЭЦ — плотный промышленный узел в центре сетки, минимум жилья. */
/* ТЭЦ (13.08, тринадцатый заход: четвёртый район со своей графикой) —
   энергетический узел, тип 'plant' (см. genCity/ART_SRC ниже) — подстанции
   и котельные плотно в центре сетки, пустырь редким фоном по краю. */
const TETS_CITY_CFG = cityCfg7(30315,
  [['plant', .60], ['yard', .35], ['apart', .05]],
  [['plant', .30], ['yard', .65], ['apart', .05]], 1);
/* КАРЬЕР — открытый пустырь с редкими сараями техники. */
/* КАРЬЕР (13.08, четырнадцатый заход: пятый район со своей графикой) —
   карьерная техника и постройки, тип 'quarry' (см. genCity/ART_SRC ниже),
   пустырь остаётся фоном — карьер по смыслу открытый, не сплошная застройка. */
const QUARRY_CITY_CFG = cityCfg7(30316,
  [['quarry', .35], ['yard', .60], ['apart', .05]],
  [['quarry', .18], ['yard', .80], ['apart', .02]]);
/* АЭРОДРОМ — самый открытый район: почти голое поле, изредка ангар. */
/* АЭРОДРОМ (13.08, пятнадцатый заход: шестой район со своей графикой) —
   ангары и служебные постройки лётного поля, тип 'hangar' (см. genCity/
   ART_SRC ниже), пустырь остаётся фоном — аэродром по смыслу открытый. */
const AIRFIELD_CITY_CFG = cityCfg7(30317,
  [['hangar', .30], ['yard', .65], ['garage', .05]],
  [['hangar', .12], ['yard', .86], ['garage', .02]]);
/* ЭЛЕВАТОР — высокие силосы (замена — высокое жильё) плюс мастерские. */
const ELEVATOR_CITY_CFG = cityCfg7(30318,
  [['apart', .55], ['garage', .35], ['yard', .10]],
  [['apart', .40], ['garage', .40], ['yard', .20]]);
/* СОРТИРОВКА — сортировочный двор: пустыри с редкими боксами. */
const SORT_CITY_CFG = cityCfg7(30319,
  [['yard', .55], ['garage', .40], ['apart', .05]],
  [['yard', .70], ['garage', .25], ['apart', .05]]);
/* ОКРАИНЫ — тихая окраина, жильё вперемешку с пустырями. */
const OUTSKIRTS_CITY_CFG = cityCfg7(30320,
  [['apart', .45], ['yard', .40], ['garage', .15]],
  [['apart', .30], ['yard', .55], ['garage', .15]]);
/* РАДИОВЫШКА — пустырь с одной высокой доминантой (жилой корпус как
   заменитель вышки) у центра сетки. */
const RADIOTOWER_CITY_CFG = cityCfg7(30321,
  [['yard', .55], ['apart', .35], ['garage', .10]],
  [['yard', .75], ['apart', .15], ['garage', .10]]);

/* Все варианты города — по ИМЕНИ района (не по типу: у типа 'garage'/'waste'/
   'industry'/'resid'/'docks' по нескольку разных районов, и у каждого свой
   замес, см. выше), единый разбор вместо тернарников в switchCityVariant/
   applyState/w-enter — и единственное место, куда дописывать новый вариант. */
const CITY_CFGS = {
  default: DEFAULT_CITY_CFG,
  'ЦЕНТР': CENTER_CITY_CFG,
  'СЕВЕРНЫЕ ГАРАЖИ': NORTH_CITY_CFG,
  'ДОКИ': DOCKS_CITY_CFG,
  'ПРОМЗОНА': INDUSTRY_CITY_CFG,
  'ВЕТРЯНОЕ ПОЛЕ': WINDFIELD_CITY_CFG,
  'СТАРЫЙ РАЙОН': OLDDIST_CITY_CFG,
  'ВЫСОТКИ': HIGHRISE_CITY_CFG,
  'ДЕПО': DEPOT_CITY_CFG,
  'РЫНОК': MARKET_CITY_CFG,
  'СВАЛКА': DUMP_CITY_CFG,
  'НАБЕРЕЖНАЯ': EMBANK_CITY_CFG,
  'КОЛЬЦО': RING_CITY_CFG,
  'ТУННЕЛИ': TUNNELS_CITY_CFG,
  'ПУСТЫРИ': WASTELAND_CITY_CFG,
  'НЕДОСТРОЙ': UNFINISHED_CITY_CFG,
  'ТЭЦ': TETS_CITY_CFG,
  'КАРЬЕР': QUARRY_CITY_CFG,
  'АЭРОДРОМ': AIRFIELD_CITY_CFG,
  'ЭЛЕВАТОР': ELEVATOR_CITY_CFG,
  'СОРТИРОВКА': SORT_CITY_CFG,
  'ОКРАИНЫ': OUTSKIRTS_CITY_CFG,
  'РАДИОВЫШКА': RADIOTOWER_CITY_CFG,
};
const cityCfgFor = variant => CITY_CFGS[variant] || DEFAULT_CITY_CFG;
const HOME_CITY_VARIANT = 'СЕВЕРНЫЕ ГАРАЖИ';
const homeCityVariant = () => typeof homeProvince === 'function' ? homeProvince().name : HOME_CITY_VARIANT;
const isHomeCity = variant => variant === homeCityVariant();

/* The garage is a player location, not a crew-captured tile.  A server board
   deliberately contains only flags and conquered quarters, so applying that
   board must never erase the one local garage inside the player's home
   district. */
function restoreHomeGarageMarker(provinceIdx = window.activeWorldProvinceIdx) {
  const homeIdx = typeof homeProvince === 'function' && typeof PROVINCES !== 'undefined'
    ? PROVINCES.indexOf(homeProvince()) : -1;
  if (Number(provinceIdx) !== Number(homeIdx) || !districts.length) return;
  /* A garage has a server-owned cell, not a new randomly selected "closest"
     block on every redraw. This keeps the same physical garage visible after
     a global-map round trip and after an F5. Older sessions fall back to the
     generated central marker until their first state_sync arrives. */
  const serverQuarter = Number(window.serverHomeQuarterIdx);
  const marker = Number.isInteger(serverQuarter) && serverQuarter >= 0 && serverQuarter < districts.length
    ? districts[serverQuarter] : MINE;
  if (!marker) return;
  districts.forEach(d => { if (d !== marker) delete d.mine; });
  MINE = marker;
  MINE.mine = true;
  /* 28.08: здесь безусловно стояло MINE.gang = 0. Функция вызывается ПОСЛЕ
     применения серверной доски, поэтому квартал, который держит чужая банда,
     перекрашивался в твой цвет и выглядел захваченным — при том что сервер
     на любое действие с ним справедливо отвечал отказом. В онлайне владельца
     определяет только сервер; метка остаётся меткой (mine + имя), а цвет
     принадлежности не трогаем. В одиночной игре гараж и правда твой. */
  const serverBoardRules = !!(window.MP && window.MP.connected)
    || /(^|\.)mininggang\.online$/i.test(window.location.hostname);
  if (!serverBoardRules) MINE.gang = 0;
  MINE.name = 'ТВОЙ ГАРАЖ';
}

function genCity(cfg, hasHome = false) {
  BLOCKS = cfg.blocks; BS = cfg.bs; GAP = cfg.gap;
  SIDE = BLOCKS * BS + (BLOCKS + 1) * GAP;
  const cRng = (() => { let s = cfg.seed; return () => (s = s * 16807 % 2147483647) / 2147483647; })();
  const mid = (BLOCKS - 1) / 2;

  districts.length = 0;
  for (let bj = 0; bj < BLOCKS; bj++)
    for (let bi = 0; bi < BLOCKS; bi++) {
      const idx = bj * BLOCKS + bi;
      let type = cfg.types[idx % cfg.types.length];
      if (cfg.hotelAt && bi === cfg.hotelAt[0] && bj === cfg.hotelAt[1]) type = 'hotel';
      /* Production never generates ownership.  The old prototype drew a
         plausible coloured city before the server board was applied, which
         made fake "your quarter" labels appear on the live map. */
      const liveWorld = /(^|\.)mininggang\.online$/i.test(window.location.hostname);
      const gang = liveWorld || type === 'hotel' || type === 'wind' ? -1
        : (cRng() < .3 ? -1 : Math.floor(cRng() * GANGS.length));
      districts.push({
        i0: GAP + bi * (BS + GAP), j0: GAP + bj * (BS + GAP), bi, bj, type, gang,
        name: { apart: 'Жилой квартал', garage: 'Гаражный кооператив', hotel: 'ОТЕЛЬ',
                wind: 'Ветряк кита', yard: 'Пустырь', dock: 'Портовый склад', factory: 'Цех',
                scrap: 'Скрап-площадка', plant: 'Энергоузел', quarry: 'Карьерный участок',
                hangar: 'Ангар' }[type]
              + (type === 'hotel' || type === 'wind' ? '' : ' №' + (idx + 1)),
        power: { apart: 55, garage: 40, hotel: 62, wind: 30, yard: 48, dock: 46, factory: 58, scrap: 44, plant: 60, quarry: 42, hangar: 50 }[type],
        risk:  { apart: 2, garage: 12, hotel: 0, wind: 5, yard: 8, dock: 10, factory: 14, scrap: 16, plant: 18, quarry: 13, hangar: 11 }[type],
        store: Math.round(80 + cRng() * 900),
        /* Кто здесь вообще майнит. Народ и хешрейт делают квартал местом, а
           не клеткой: гаражный кооператив набит людьми с дешёвыми ригами,
           жилой дом — десяток квартир с одним асиком под столом.           */
        pop: Math.max(1, Math.round({ apart: 14, garage: 22, hotel: 30, wind: 1, yard: 4, dock: 20, factory: 26, scrap: 18, plant: 16, quarry: 17, hangar: 19 }[type]
                                    * (.55 + cRng() * .9))),
      });
    }
  /* твой гараж: ближайший к центру сетки гаражный квартал. С появлением
     районов без единого гаражного квартала (ДОКИ — сплошь 'dock', ПРОМЗОНА —
     сплошь 'factory', СВАЛКА — сплошь 'scrap', ТЭЦ — сплошь 'plant') —
     запасной вариант: сначала гараж, потом склад, потом цех, потом
     скрап-площадка, потом энергоузел, потом карьерный участок, а если нет
     вообще ничего из перечисленного — ближайший квартал любого типа, лишь
     бы точка входа была всегда. */
  const byDist = (a, b) => (Math.abs(a.bi - mid) + Math.abs(a.bj - mid)) - (Math.abs(b.bi - mid) + Math.abs(b.bj - mid));
  MINE = districts.filter(d => d.type === 'garage').sort(byDist)[0]
      || districts.filter(d => d.type === 'dock').sort(byDist)[0]
      || districts.filter(d => d.type === 'factory').sort(byDist)[0]
      || districts.filter(d => d.type === 'scrap').sort(byDist)[0]
      || districts.filter(d => d.type === 'plant').sort(byDist)[0]
      || districts.filter(d => d.type === 'quarry').sort(byDist)[0]
      || districts.filter(d => d.type === 'hangar').sort(byDist)[0]
      || districts.filter(d => d.type !== 'hotel' && d.type !== 'wind').sort(byDist)[0]
      || districts.slice().sort(byDist)[0];
  /* База игрока существует только в СЕВЕРНЫХ ГАРАЖАХ. В других районах MINE
     остаётся технической опорной точкой для старого кода камеры, но не
     становится ни «ТВОИМ ГАРАЖОМ», ни кварталом игрока. */
  if (hasHome) { MINE.mine = true; MINE.gang = 0; MINE.name = 'ТВОЙ ГАРАЖ'; }

  for (const d of districts) {
    const base = { apart: 26, garage: 62, hotel: 95, wind: 640, yard: 18, dock: 58, factory: 66, scrap: 50, plant: 70, quarry: 48, hangar: 56 }[d.type];
    d.crew = [];
    for (let k = 0; k < Math.min(d.pop, 6); k++) {
      const th = Math.max(4, Math.round(base * (.5 + cRng() * 1.5)));
      /* У NPC есть конечный кошелёк: рейд забирает его, а не печатает BAND.
         На сервере это будет баланс другого игрока/бота. */
      d.crew.push({ n: NICKS[(d.bi * 7 + d.bj * 13 + k * 5) % NICKS.length], th,
                    wallet: Math.round(th * (.8 + cRng() * 1.6)) });
    }
    d.crew.sort((a, b) => b.th - a.th);
    /* остальные не перечислены поимённо, но их мощность в общем счёте есть */
    d.hash = d.crew.reduce((a, m) => a + m.th, 0)
           + Math.max(0, d.pop - d.crew.length) * Math.round(base * .8);
  }

  /* --- здания: (тайл, тип, высота, сид) --- */
  builds.length = 0;
  for (const d of districts) {
    for (let j = d.j0; j < d.j0 + BS; j++)
      for (let i = d.i0; i < d.i0 + BS; i++) {
        const seed = cRng();
        if (d.type === 'hotel') {
          if (i === d.i0 + 1 && j === d.j0 + 1) builds.push({ i, j, w: 2, h: 150, kind: 'hotel', seed, d });
          else if (i > d.i0 + 1 || j > d.j0 + 1) continue;
          else if (!THEMED_CITY_MODE || seed < .16) builds.push({ i, j, w: 1, h: 26 + seed * 10, kind: 'shop', seed, d });
        } else if (d.type === 'wind') {
          if (!THEMED_CITY_MODE ? (i + j) % 2 === 0 : (i + j) % 4 === 0)
            builds.push({ i, j, w: 1, h: 90, kind: 'wind', seed, d });
        } else if (d.type === 'apart') {
          /* Residential districts are deliberately sparse: small groups of
             homes surrounded by courtyards, never shops or factories. */
          if (THEMED_CITY_MODE && seed >= .14 && seed < .23) {
            builds.push({ i, j, w: 1, h: 0, kind: 'park', seed, d });
          } else if (seed < (THEMED_CITY_MODE ? .14 : .68)) {
            builds.push({ i, j, w: 1, h: 34 + seed * 88, kind: 'apart', seed, d });
          }
        } else if (d.type === 'garage') {
          /* «ухоженность» — своя случайность, не завязанная на seed (тот уже
             выбирает высоту/спрайт-индекс среди «живых» вариантов), иначе
             состояние здания жёстко коррелировало бы с тем, какая картинка
             выпадет, и разнообразие бы не работало как задумано. */
          const cond = (seed * 7919.271 + 3.71) % 1;
          if (!THEMED_CITY_MODE || seed < .18) {
            builds.push({ i, j, w: 1, h: 15 + seed * 7, kind: 'garage', seed, cond, d });
          }
        } else if (d.type === 'dock') {
          /* та же независимая «ухоженность», что у гаражей — см. выше. */
          const cond = (seed * 7919.271 + 3.71) % 1;
          if (!THEMED_CITY_MODE || seed < .22) builds.push({ i, j, w: 1, h: 16 + seed * 8, kind: 'dock', seed, cond, d });
        } else if (d.type === 'factory') {
          /* та же независимая «ухоженность» — см. выше. Цеха пошире гаражей. */
          const cond = (seed * 7919.271 + 3.71) % 1;
          if (!THEMED_CITY_MODE || seed < .20) builds.push({ i, j, w: 1, h: 18 + seed * 10, kind: 'factory', seed, cond, d });
        } else if (d.type === 'scrap') {
          /* та же независимая «ухоженность» — см. выше. Сараи скрап-площадки
             пониже цехов, вровень с гаражами. */
          const cond = (seed * 7919.271 + 3.71) % 1;
          if (!THEMED_CITY_MODE || seed < .18) builds.push({ i, j, w: 1, h: 14 + seed * 6, kind: 'scrap', seed, cond, d });
        } else if (d.type === 'plant') {
          /* та же независимая «ухоженность» — см. выше. Энергоузел пониже
             цехов — компактные подстанции, не башни. */
          const cond = (seed * 7919.271 + 3.71) % 1;
          if (!THEMED_CITY_MODE || seed < .20) builds.push({ i, j, w: 1, h: 13 + seed * 6, kind: 'plant', seed, cond, d });
        } else if (d.type === 'quarry') {
          /* та же независимая «ухоженность» — см. выше. Карьерные постройки
             невысокие — сараи и будки, не цеха. */
          const cond = (seed * 7919.271 + 3.71) % 1;
          if (!THEMED_CITY_MODE || seed < .16) builds.push({ i, j, w: 1, h: 11 + seed * 5, kind: 'quarry', seed, cond, d });
        } else if (d.type === 'hangar') {
          /* та же независимая «ухоженность» — см. выше. Ангары пошире
             гаражей, вровень с цехами. */
          const cond = (seed * 7919.271 + 3.71) % 1;
          if (!THEMED_CITY_MODE || seed < .20) builds.push({ i, j, w: 1, h: 17 + seed * 9, kind: 'hangar', seed, cond, d });
        } else if (d.type === 'yard' && THEMED_CITY_MODE) {
          /* A vacant block becomes a civic-green district: parks and rare
             public services, never another random row of houses. */
          if (seed < .25) builds.push({ i, j, w: 1, h: 0, kind: 'park', seed, d });
          else if (seed < .33) builds.push({ i, j, w: 1, h: 0, kind: 'landmark', seed, d });
        } else {
          if (seed < .25) builds.push({ i, j, w: 1, h: 10 + seed * 8, kind: 'junk', seed, d });
        }
      }
  }
  builds.sort((a, b) => (a.i + a.j) - (b.i + b.j));

  /* --- метки жильцов для большого зума: закрепляем один раз, иначе подписи
     будут прыгать по зданиям от кадра к кадру. */
  for (const d of districts) {
    const spots = builds.filter(b => b.d === d && b.kind !== 'wind');
    const n = Math.min(4, d.crew.length);
    d.tags = [];
    for (let k = 0; k < n; k++) {
      const m = d.crew[k];
      m.raidUntil = 0;                  // v7.3: разведка/нападение — см. scoutOpen()
      const b = spots.length ? spots[k % spots.length] : null;
      const bi = b ? b.i + (b.w - 1) / 2 : d.i0 + 1 + (k % 2) * 1.6;
      const bj = b ? b.j + (b.w - 1) / 2 : d.j0 + 1 + Math.floor(k / 2) * 1.6;
      const bh = b ? (b.kind === 'hotel' ? 150 : b.h) : 20;
      const [x0, y0] = iso(bi, bj);
      d.tags.push({ x: x0, y: y0 - bh - 16, crew: m, d, b });
    }
  }
}
genCity(cityCfgFor(HOME_CITY_VARIANT), true);

/* --- окна и диоды (динамика): собираются при рендере зданий --- */
const windows = [];   // {x,y,w,h,warm,phase,speed,base}
const roofFans = [];  // вытяжки на крышах гаражей: крутятся
const cityBeacons = []; // красные маяки на высотках: мигают
const neonSigns = []; // вывески: дышат светом
const leds = [];      // {x,y,c,phase}
let hotelSign = null; // {x,y}
const turbines = [];  // {x,y,h}

/* ============================ РИСОВАНИЕ =================================== */
function tilePath(c, x, y, w = 1) {
  c.beginPath();
  c.moveTo(x, y - TH / 2 * w);
  c.lineTo(x + TW / 2 * w, y);
  c.lineTo(x, y + TH / 2 * w);
  c.lineTo(x - TW / 2 * w, y);
  c.closePath();
}

/* коробка здания в изометрии: три грани */
function box(c, x, y, w, h, roof, wl, wr) {
  const hw = TW / 2 * w, hh = TH / 2 * w;
  c.fillStyle = wl;                       // левая грань
  c.beginPath();
  c.moveTo(x - hw, y); c.lineTo(x, y + hh);
  c.lineTo(x, y + hh - h); c.lineTo(x - hw, y - h); c.closePath(); c.fill();
  c.fillStyle = wr;                       // правая грань
  c.beginPath();
  c.moveTo(x + hw, y); c.lineTo(x, y + hh);
  c.lineTo(x, y + hh - h); c.lineTo(x + hw, y - h); c.closePath(); c.fill();
  c.fillStyle = roof;                     // крыша
  c.beginPath();
  c.moveTo(x, y - h - hh); c.lineTo(x + hw, y - h);
  c.lineTo(x, y - h + hh); c.lineTo(x - hw, y - h); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(120,135,190,.28)'; c.lineWidth = .8;   // кромка
  c.beginPath();
  c.moveTo(x - hw, y - h); c.lineTo(x, y - h - hh); c.lineTo(x + hw, y - h);
  c.stroke();
}

/* Гаражи разной степени ухоженности (13.08): b.cond — независимая от seed
   псевдослучайность 0..1 (см. genCity). Ниже .28 — полуразрушенный, выше
   .72 — нарядный, посередине — любой из всего пула (в т.ч. и новые). Пока
   картинки не сгенерированы на диске, pick() их просто не увидит через ok(). */
const GARAGE_NICE = () => [ART.bGarage0, ART.bGarage3, ART.bGarage4, ART.bGarage5, ART.bGarage6,
                            ART.bGarage7, ART.bGarage11, ART.bGarage12, ART.bGarage15, ART.bGarage16];
const GARAGE_RUINED = () => [ART.bGarage1, ART.bGarage8, ART.bGarage9, ART.bGarage10,
                              ART.bGarage13, ART.bGarage14];
const GARAGE_ALL = () => [ART.bGarage0, ART.bGarage1, ART.bGarage2, ART.bGarage3, ART.bGarage4,
                           ART.bGarage5, ART.bGarage6, ART.bGarage7, ART.bGarage8, ART.bGarage9, ART.bGarage10,
                           ART.bGarage11, ART.bGarage12, ART.bGarage13, ART.bGarage14, ART.bGarage15, ART.bGarage16];

/* The 80 new city sprites live in themed lazy-load packs.  This bridge keeps
   the renderer's old procedural/legacy-art fallback intact: before a pack is
   ready, `pick()` filters these null entries out; when it arrives, only the
   static canvas is rebuilt and all board coordinates remain untouched. */
const CITY_PACK = name => (window.CITY_SPRITE_PACKS?.[name] || [])
  .map(file => typeof window.getCitySpriteArt === 'function' ? window.getCitySpriteArt(file) : null);
const CITY_GREEN = () => CITY_PACK('green');
const CITY_HOUSING = () => CITY_PACK('housing');
const CITY_COMMERCE = () => CITY_PACK('commerce');
const CITY_INDUSTRY = () => CITY_PACK('industry');
const CITY_TRANSIT = () => CITY_PACK('transit');
const CITY_STREETS = () => CITY_PACK('streets');

/* ДОКИ (13.08): из первой партии в 6 картинок реально прижилось 4 (a,b,c,d) —
   e и f вышли не изолированными зданиями (генератор нарисовал интерьер и
   заваленную сцену вместо силуэта), их выкинули без замены. С одной живой
   «убитой» (b) отдельный RUINED-пул давал бы 30%+ повторов одной и той же
   картинки — пока не дорисуем ещё, все 4 доступны в любом состоянии, а не
   только строго по тиру. Как только появятся ещё убитые/нарядные — вернём
   раздельные пулы, как у гаражей. */
const DOCK_NICE = () => [ART.bDock0, ART.bDock1, ART.bDock2, ART.bDock3, ART.bDock4, ART.bDock5, ...CITY_TRANSIT()];
const DOCK_RUINED = DOCK_NICE;
const DOCK_ALL = DOCK_NICE;

/* ПРОМЗОНА: та же история — первая партия, без раздельных тиров, пока не
   наберётся достаточно картинок под каждый (см. DOCK_* выше). */
const FACTORY_NICE = () => [ART.bFactory0, ART.bFactory1, ART.bFactory2, ART.bFactory3, ART.bFactory4, ART.bFactory5, ...CITY_INDUSTRY()];
const FACTORY_RUINED = FACTORY_NICE;
const FACTORY_ALL = FACTORY_NICE;

/* СВАЛКА: та же история — первая и вторая партии слиты в один список, без
   раздельных тиров, пока не наберётся достаточно картинок под каждый
   (см. DOCK_* выше). */
const SCRAP_NICE = () => [ART.bScrap0, ART.bScrap1, ART.bScrap2, ART.bScrap3, ART.bScrap4, ART.bScrap5,
                           ART.bScrap6, ART.bScrap7, ...CITY_INDUSTRY(), ...CITY_STREETS()];
const SCRAP_RUINED = SCRAP_NICE;
const SCRAP_ALL = SCRAP_NICE;

/* ТЭЦ: та же история — первая партия, без раздельных тиров, пока не
   наберётся достаточно картинок под каждый (см. DOCK_* выше). */
const PLANT_NICE = () => [ART.bPlant0, ART.bPlant1, ART.bPlant2, ART.bPlant3, ART.bPlant4, ART.bPlant5, ...CITY_INDUSTRY()];
const PLANT_RUINED = PLANT_NICE;
const PLANT_ALL = PLANT_NICE;

/* КАРЬЕР: та же история — первая партия, без раздельных тиров, пока не
   наберётся достаточно картинок под каждый (см. DOCK_* выше). */
const QUARRY_NICE = () => [ART.bQuarry0, ART.bQuarry1, ART.bQuarry2, ART.bQuarry3, ART.bQuarry4, ART.bQuarry5, ...CITY_INDUSTRY()];
const QUARRY_RUINED = QUARRY_NICE;
const QUARRY_ALL = QUARRY_NICE;

/* АЭРОДРОМ: та же история — первая партия, без раздельных тиров, пока не
   наберётся достаточно картинок под каждый (см. DOCK_* выше). */
const HANGAR_NICE = () => [ART.bHangar0, ART.bHangar1, ART.bHangar2, ART.bHangar3, ART.bHangar4, ART.bHangar5, ...CITY_TRANSIT()];
const HANGAR_RUINED = HANGAR_NICE;
const HANGAR_ALL = HANGAR_NICE;

/* нарисованные изометрические здания: если спрайт есть — рисуем его вместо
   процедурной коробки. Выбор детерминирован сидом, чтобы город не менялся. */
function buildSprite(b) {
  const pick = arr => {
    const live = arr.filter(ok);
    return live.length ? live[Math.floor(b.seed * 997) % live.length] : null;
  };
  if (b.kind === 'garage') {
    const cond = b.cond !== undefined ? b.cond : .5;
    const variants = cond <= .28 ? GARAGE_RUINED() : cond >= .72 ? GARAGE_NICE() : GARAGE_ALL();
    return pick(THEMED_CITY_MODE ? [ART.bGarageConcept0, ...variants] : variants);
  }
  if (b.kind === 'dock') {
    const cond = b.cond !== undefined ? b.cond : .5;
    const variants = cond <= .28 ? DOCK_RUINED() : cond >= .72 ? DOCK_NICE() : DOCK_ALL();
    return pick(THEMED_CITY_MODE ? [ART.bDockConcept0, ...variants] : variants);
  }
  if (b.kind === 'factory') {
    const cond = b.cond !== undefined ? b.cond : .5;
    const variants = cond <= .28 ? FACTORY_RUINED() : cond >= .72 ? FACTORY_NICE() : FACTORY_ALL();
    return pick(THEMED_CITY_MODE ? [ART.bFactoryConcept0, ...variants] : variants);
  }
  if (b.kind === 'scrap') {
    const cond = b.cond !== undefined ? b.cond : .5;
    return pick(cond <= .28 ? SCRAP_RUINED() : cond >= .72 ? SCRAP_NICE() : SCRAP_ALL());
  }
  if (b.kind === 'plant') {
    const cond = b.cond !== undefined ? b.cond : .5;
    return pick(cond <= .28 ? PLANT_RUINED() : cond >= .72 ? PLANT_NICE() : PLANT_ALL());
  }
  if (b.kind === 'quarry') {
    const cond = b.cond !== undefined ? b.cond : .5;
    return pick(cond <= .28 ? QUARRY_RUINED() : cond >= .72 ? QUARRY_NICE() : QUARRY_ALL());
  }
  if (b.kind === 'hangar') {
    const cond = b.cond !== undefined ? b.cond : .5;
    return pick(cond <= .28 ? HANGAR_RUINED() : cond >= .72 ? HANGAR_NICE() : HANGAR_ALL());
  }
  if (b.kind === 'apart') {
    if (THEMED_CITY_MODE) return pick([ART.bApartConcept0, ART.bApartConcept1, ART.bApartConcept2, ART.bApartConcept3, ART.bApartConcept4, ART.bApartConcept5, ART.bApartConcept6, ART.bApartConcept7, ...CITY_HOUSING()]);
    /* высокий дом получает высокий спрайт — иначе город становится плоским */
    const tall = b.h > 100 ? [ART.bApart2, ART.bApart7]
               : b.h > 75 ? [ART.bApart1, ART.bApart5]
               : b.h > 50 ? [ART.bApart0, ART.bApart4]
               : [ART.bApart3, ART.bApart6];
    return pick([...tall, ...CITY_HOUSING()]);
  }
  if (b.kind === 'shop') return pick(THEMED_CITY_MODE ? [ART.bShopConcept0, ART.bShop0, ...CITY_COMMERCE()] : [ART.bShop0, ART.bApart3, ...CITY_COMMERCE()]);
  if (b.kind === 'hotel') return pick([ART.bHotel0, ART.hotel]);
  if (b.kind === 'park') return pick([ART.bParkConcept0, ART.bParkConcept1, ART.bParkConcept2, ART.bParkConcept3, ART.bParkConcept4, ART.bParkConcept5, ART.bParkConcept6, ...CITY_GREEN()]);
  /* A plaza is intentionally rare: it breaks up green districts with a
     readable paved public space instead of another patch of grass. */
  if (b.kind === 'landmark') return pick([ART.bLandmarkConcept0, ART.bLandmarkConcept1, ART.bLandmarkConcept2, ART.bLandmarkConcept3, ART.bLandmarkConcept4, ART.bLandmarkConcept5, ART.bLandmarkConcept6, ART.bLandmarkConcept7, ART.bPlazaConcept0, ...CITY_STREETS(), ...CITY_TRANSIT()]);
  if (b.kind === 'junk') return pick([ART.bYard0, ART.bPark0, ...CITY_STREETS(), ...CITY_GREEN()]);
  return null;
}

/* The new pack includes both landmark buildings and small urban props.  A
   bus stop or planted median at the same scale as a factory would cover a
   whole block, so keep its contact footprint proportional to the role while
   preserving the existing scale for the old art. */
function citySpriteScale(im) {
  const src = String(im && (im.currentSrc || im.src) || '');
  if (!/city_[a-z0-9_]+_v1\.(?:png|webp)(?:\?|$)/i.test(src)) return 1;
  if (/city_(bus_stop|tram_stop|metro_entrance|taxi_rank|public_toilet|police_booth|street_light_cluster|signal_crossing|planted_median|billboard_corner|roadworks|pedestrian_bridge|fourway_intersection|underpass_entrance)_v1/i.test(src)) return .62;
  if (/city_(park_|playground|community_garden|basketball|dog_park|fountain|tree_lined|skate|rooftop_garden|rain_garden|picnic|memorial|urban_greenhouse|parking|overgrown|construction)_v1/i.test(src)) return .86;
  if (/city_(cargo|port_crane|customs|rail_loading|ferry|truck_weighbridge|petrol|vehicle_repair)_v1/i.test(src)) return .92;
  if (/city_(machine|brick|recycling|concrete|foundry|refrigeration|logistics|print|textile|power|water)_v1/i.test(src)) return 1.08;
  return 1;
}

/* A self-contained isometric car, deliberately drawn from simple geometry.
   The old raster cars were full road-tile illustrations, not transparent
   vehicle sprites. This remains legible at map scale without painting a
   rectangle over the street beneath it. */
function drawRoadCar(c, x, y, col, axis = 1, scale = 1) {
  const s = scale;
  const poly = pts => { c.beginPath(); pts.forEach(([px, py], k) => k ? c.lineTo(x + px * s, y + py * s) : c.moveTo(x + px * s, y + py * s)); c.closePath(); c.fill(); };
  const body = axis > 0
    ? [[-9,-3], [3,-6], [9,-1], [5,4], [-7,4]]
    : [[-3,-6], [9,-3], [7,4], [-5,4], [-9,-1]];
  const cabin = axis > 0
    ? [[-3,-4.4], [1,-5.4], [5,-2.2], [1,0]]
    : [[-1,-5.4], [5,-4.4], [-1,0], [-5,-2.2]];
  c.save();
  c.fillStyle = '#101623'; poly(axis > 0 ? [[-7,3],[5,3],[7,5],[-8,5]] : [[-5,3],[7,3],[8,5],[-7,5]]);
  c.fillStyle = col; poly(body);
  c.fillStyle = 'rgba(174,215,236,.68)'; poly(cabin);
  c.fillStyle = 'rgba(255,255,255,.18)';
  c.fillRect(x + (axis > 0 ? -3 : -1) * s, y - 3.5 * s, 4 * s, .7 * s);
  c.fillStyle = '#080b11';
  const wheels = axis > 0 ? [[-6,3],[6,-1]] : [[-6,-1],[6,3]];
  for (const [wx, wy] of wheels) c.fillRect(x + wx * s - 1.4 * s, y + wy * s - .8 * s, 2.8 * s, 1.6 * s);
  c.fillStyle = '#ffcf6e';
  const [hx, hy] = axis > 0 ? [8,-.8] : [-8,-.8];
  c.fillRect(x + hx * s - .9 * s, y + hy * s - .55 * s, 1.8 * s, 1.1 * s);
  c.restore();
}

function renderStatic(c, ox, oy) {
  /* The cache is deliberately supersampled when the camera settles after a
     zoom.  Everything below still draws in CSS/game coordinates, so never
     use canvas.width/height here: those are physical pixels and change with
     cache resolution.  Mixing the two made the night vignette jump between
     light and dark halves of the city at different zoom levels. */
  const cssW = c.canvas._cssW || c.canvas.width / DPR;
  const cssH = c.canvas._cssH || c.canvas.height / DPR;
  /* земля и дороги */
  for (let j = 0; j < SIDE; j++)
    for (let i = 0; i < SIDE; i++) {
      const [x0, y0] = iso(i, j); const x = x0 + ox, y = y0 + oy;
      const d = distAt(i, j);
      tilePath(c, x, y);
      if (!d) {                            // дорога
        c.fillStyle = P.road; c.fill();
        c.strokeStyle = P.roadLine; c.lineWidth = .5; c.stroke();
      } else {
        const themedGround = THEMED_CITY_MODE && CONCEPT_GROUND[d.type];
        c.fillStyle = themedGround ? themedGround[(i + j) % 2] : ((i + j) % 2 ? P.ground : P.groundHi);
        c.fill();
        if (d.gang >= 0) {                 // подсветка территории банды
          c.fillStyle = (GANGS[d.gang] || { c: '#f5c542' }).c + '28'; c.fill();
        }
      }
    }
  /* асфальт поверх плоской заливки: source-atop — только там, где уже нарисовано,
     пустой холст за пределами города остаётся прозрачным */
  if (ok(ART.texRoad)) {
    c.save();
    c.globalCompositeOperation = 'source-atop';
    texFill(c, ART.texRoad, 0, 0, cssW, cssH, .22, .55);
    c.restore();
  }

  /* Цельный изометрический ночной город. Он служит художественным основанием,
     не «скриншотом»: прозрачность оставляет читаемыми сетку, дороги и будущие
     интерактивные кварталы, а здания/флаги ниже в этом же рендере остаются
     живыми и кликабельными. */
  /* `map.html?district=seaport` (and the other authored themes) can swap
     only this artistic base.  Grid, buildings, territory, flags, clicks and
     marches are still rendered by the layers below; the established hero is
     the hard fallback for an unavailable theme. */
  const cityBackground = typeof window.getCityBackgroundArt === 'function'
    ? window.getCityBackgroundArt() : ART.bgCityHero;
  if (ok(cityBackground)) {
    c.save();
    c.globalAlpha = .30;
    c.drawImage(cityBackground, 0, 0, cssW, cssH);
    const shade = c.createLinearGradient(0, 0, 0, cssH);
    shade.addColorStop(0, 'rgba(4,7,16,.18)');
    shade.addColorStop(.58, 'rgba(4,7,16,0)');
    shade.addColorStop(1, 'rgba(4,7,16,.34)');
    c.globalAlpha = 1; c.fillStyle = shade; c.fillRect(0, 0, cssW, cssH);
    c.restore();
  }

  /* The gaps between blocks are a real street network, not a row of dark
     tiles.  One continuous asphalt strip per lane removes the chessboard
     look; worn lane markings make the paths legible at every zoom. */
  const laneStep = BS + GAP;
  const drawRoad = (dir, lane) => {
    const [a0, b0] = dir === 'i' ? [iso(lane, -.65), iso(lane, SIDE + .65)]
                                  : [iso(-.65, lane), iso(SIDE + .65, lane)];
    const ax = a0[0] + ox, ay = a0[1] + oy, bx = b0[0] + ox, by = b0[1] + oy;
    c.save();
    c.lineCap = 'butt'; c.strokeStyle = '#090f16'; c.lineWidth = TW * .60;
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    c.strokeStyle = '#18232e'; c.lineWidth = TW * .38;
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    c.globalAlpha = .58; c.strokeStyle = '#d5ad58'; c.lineWidth = 1.15;
    c.setLineDash([8, 13]); c.lineDashOffset = dir === 'i' ? 4 : 0;
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    c.restore();
  };
  for (let k = 0; k <= BLOCKS; k++) {
    const lane = k * laneStep;
    drawRoad('i', lane); drawRoad('j', lane);
  }

  /* Empty cells are intentional urban space, not missing content.  Mark them
     as wet paving or low shrubs so the much rarer landmark-scale buildings
     have room to breathe without leaving a featureless chessboard. */
  const occupied = new Set();
  for (const b of builds) {
    for (let dj = 0; dj < Math.max(1, b.w); dj++)
      for (let di = 0; di < Math.max(1, b.w); di++) occupied.add(`${b.i + di}:${b.j + dj}`);
  }
  if (THEMED_CITY_MODE) {
    for (const d of districts) {
      const greenZone = d.type === 'yard' || d.type === 'wind' || d.type === 'quarry';
      if (greenZone) {
        /* One opaque lawn under the whole green district — no per-cell green
           overlay, so it reads as a real park rather than translucent tiles. */
        const [gx0, gy0] = iso(d.i0 + (BS - 1) / 2, d.j0 + (BS - 1) / 2);
        const gx = gx0 + ox, gy = gy0 + oy;
        c.save(); c.fillStyle = d.type === 'yard' ? '#234b32' : '#203d2b';
        tilePath(c, gx, gy, BS); c.fill();
        c.globalAlpha = .22; c.fillStyle = '#5e8952'; tilePath(c, gx, gy, BS * .84); c.fill();
        c.globalAlpha = .34; c.strokeStyle = '#9bb56a'; c.lineWidth = .8;
        c.beginPath(); c.moveTo(gx - TW * BS * .22, gy + TH * BS * .08); c.lineTo(gx + TW * BS * .18, gy - TH * BS * .10); c.stroke();
        c.restore();
      }
      for (let j = d.j0; j < d.j0 + BS; j++) for (let i = d.i0; i < d.i0 + BS; i++) {
        if (occupied.has(`${i}:${j}`)) continue;
        const [cx0, cy0] = iso(i, j); const cx = cx0 + ox, cy = cy0 + oy;
        const detail = ((i * 1597334677 ^ j * 3812015801 ^ d.bi * 958282597 ^ d.bj * 1103515245) >>> 0) / 4294967296;
        if (!greenZone) {
          /* Every ordinary empty cell becomes one continuous, opaque asphalt
             court.  Bushes sit on it as rare planters, never as a green tile. */
          c.save(); c.globalAlpha = .88;
          c.fillStyle = '#131b23'; tilePath(c, cx, cy); c.fill();
          c.globalAlpha = .13; c.strokeStyle = '#7b97ab'; c.lineWidth = .4;
          c.beginPath(); c.moveTo(cx - TW * .19, cy + TH * .05); c.lineTo(cx + TW * .18, cy - TH * .05); c.stroke();
          c.restore();
        }
        const hasShrub = greenZone ? detail < .28 : detail > .93;
        if (!hasShrub) continue;
        const bush = detail < .18 ? '#2d613c' : '#397349';
        const bx = -6 + ((detail * 91) % 1) * 12, by = -5 + ((detail * 137) % 1) * 7;
        c.save(); c.translate(cx, cy + 1); c.scale(1, .5);
        c.globalAlpha = .62; c.fillStyle = 'rgba(5,12,9,.42)';
        c.beginPath(); c.ellipse(bx + 1, by + 7, 7, 3.1, 0, 0, 7); c.fill();
        c.globalAlpha = 1; c.fillStyle = bush;
        c.beginPath(); c.arc(bx - 3, by, 3.0, 0, 7); c.arc(bx + 1, by - 2, 4.1, 0, 7); c.arc(bx + 5, by + .5, 2.8, 0, 7); c.fill();
        c.fillStyle = 'rgba(151,205,120,.35)'; c.beginPath(); c.arc(bx, by - 4, 1.05, 0, 7); c.fill();
        c.restore();
      }
    }
  }

  /* фонари: лужи тёплого света на перекрёстках — дороги оживают */
  const LAMP = BS + GAP;
  for (let j = 0; j <= BLOCKS; j++)
    for (let i = 0; i <= BLOCKS; i++) {
      const li = i * LAMP + .0, lj = j * LAMP + .0;
      const [lx0, ly0] = iso(li, lj); const lx = lx0 + ox, ly = ly0 + oy;
      const g = c.createRadialGradient(lx, ly, 0, lx, ly, 34);
      g.addColorStop(0, 'rgba(255,207,110,.16)');
      g.addColorStop(1, 'rgba(255,207,110,0)');
      c.save(); c.translate(lx, ly); c.scale(1, .5); c.translate(-lx, -ly);
      c.fillStyle = g;
      c.beginPath(); c.arc(lx, ly, 34, 0, 7); c.fill();
      c.restore();
      if (ok(ART.pLampClean0)) {
        const wpx = TW * .22, hpx = wpx * ART.pLampClean0.naturalHeight / ART.pLampClean0.naturalWidth;
        c.drawImage(ART.pLampClean0, lx - wpx / 2, ly + 3 - hpx, wpx, hpx);
      } else {
        c.strokeStyle = '#2a3050'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx, ly - 14); c.stroke();
        c.fillStyle = '#ffcf6e';
        c.fillRect(lx - 1.2, ly - 15.4, 2.4, 2);
      } 
    }

  /* границы территорий — неоновая кромка по периметру квартала */
  for (const d of districts) {
    if (d.gang < 0) continue;
    const col = (GANGS[d.gang] || { c: '#f5c542' }).c;
    const corners = [[d.i0, d.j0], [d.i0 + BS, d.j0], [d.i0 + BS, d.j0 + BS], [d.i0, d.j0 + BS]];
    c.save();
    c.shadowColor = col; c.shadowBlur = 16;
    c.strokeStyle = col + 'e8'; c.lineWidth = 3;
    c.beginPath();
    corners.forEach(([ci, cj], k) => {
      const [x, y] = iso(ci - .5, cj - .5);
      k ? c.lineTo(x + ox, y + oy) : c.moveTo(x + ox, y + oy);
    });
    c.closePath(); c.stroke();
    c.restore();
  }
  /* ---- КОНТАКТ С ЗЕМЛЁЙ И СВЕТ ОТ ФАСАДОВ ----
     Ночью тень почти не читается — работает обратное: у освещённого дома
     на асфальте лежит пятно света, а под самим домом узкая тёмная кайма.
     Без этих двух вещей здание выглядит наклейкой. */
  for (const b of builds) {
    if (b.kind === 'wind') continue;
    const [x0, y0] = iso(b.i + (b.w - 1) / 2, b.j + (b.w - 1) / 2);
    const x = x0 + ox, y = y0 + oy;
    const hw = TW / 2 * b.w, hh = TH / 2 * b.w;
    /* световая лужа: тем больше, чем выше дом (больше окон) */
    if (b.kind === 'apart' || b.kind === 'hotel' || b.kind === 'shop') {
      const r = 16 + b.h * .28;
      const g = c.createRadialGradient(x, y + hh * .6, 2, x, y + hh * .6, r);
      const warm = b.seed < .7;
      g.addColorStop(0, warm ? 'rgba(255,207,110,.13)' : 'rgba(159,216,255,.11)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.save(); c.translate(x, y + hh * .6); c.scale(1, .5); c.translate(-x, -(y + hh * .6));
      c.fillStyle = g; c.beginPath(); c.arc(x, y + hh * .6, r, 0, 7); c.fill(); c.restore();
    }
    /* контактная кайма под основанием */
    c.save();
    c.globalAlpha = .45;
    const ao = c.createLinearGradient(x, y - hh, x, y + hh * 1.6);
    ao.addColorStop(0, 'rgba(0,0,0,.55)'); ao.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = ao;
    c.beginPath();
    c.moveTo(x - hw - 3, y); c.lineTo(x, y + hh + 3);
    c.lineTo(x + hw + 3, y); c.lineTo(x, y - hh - 1);
    c.closePath(); c.fill();
    c.restore();
  }

  /* ---- УЛИЧНАЯ МЕЛОЧЬ ----
     У FoE на экране всегда сотни мелких объектов: деревья, урны, машины,
     заборы. Расставляем детерминированно по сиду, чтобы город не «плясал». */
  const props = [], propSlots = new Set();
  const prng = (() => { let s = 77003; return () => (s = s * 16807 % 2147483647) / 2147483647; })();
  for (const d of districts) {
    for (let k = 0; k < 3; k++) {
      const side = prng();
      let pi, pj;
      /* Vegetation lives on a verge inside a block, never in the middle of a
         traffic lane.  That also prevents three district-edge generators from
         planting trees on top of each other at an intersection. */
      if (side < .5) { pi = d.i0 + .18;        pj = d.j0 + .35 + prng() * (BS - .7); }
      else           { pi = d.i0 + .35 + prng() * (BS - .7); pj = d.j0 + .18; }
      const r = prng();
      const kind = r < .30 ? 'tree' : r < .54 ? 'bin' : 'car';
      if (kind === 'tree' && occupied.has(`${Math.floor(pi)}:${Math.floor(pj)}`)) continue;
      const slot = `${Math.round(pi * 2)}:${Math.round(pj * 2)}`;
      if (propSlots.has(slot)) continue;
      propSlots.add(slot);
      props.push({ i: pi, j: pj, kind, s: prng() });
    }
  }
  props.sort((a, b2) => (a.i + a.j) - (b2.i + b2.j));
  for (const p of props) {
    const [px0, py0] = iso(p.i, p.j);
    const px = px0 + ox, py = py0 + oy;
    c.save(); c.globalAlpha = .3; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(px + 2, py + 1, 7, 3, 0, 0, 7); c.fill(); c.restore();
    const psp = p.kind === 'tree' ? ART.pTreeClean0
      : p.kind === 'car' ? ART.pCarClean0 : null;
    if (ok(psp)) {
      const wpx = p.kind === 'tree' ? TW * .55 : p.kind === 'car' ? TW * .43
                : p.kind === 'bin' ? TW * .5 : TW * .34;
      const hpx = wpx * psp.naturalHeight / psp.naturalWidth;
      c.drawImage(psp, px - wpx / 2, py + 4 - hpx, wpx, hpx);
      continue;
    }
    if (p.kind === 'tree') {
      c.strokeStyle = '#2a2318'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - 9); c.stroke();
      const g = c.createRadialGradient(px, py - 14, 1, px, py - 14, 8);
      g.addColorStop(0, '#2f5d3a'); g.addColorStop(1, '#16301f');
      c.fillStyle = g;
      c.beginPath(); c.ellipse(px, py - 14, 8, 7, 0, 0, 7); c.fill();
    } else if (p.kind === 'bin') {
      c.fillStyle = '#2b3450'; c.fillRect(px - 5, py - 7, 10, 7);
      c.fillStyle = '#3a4568'; c.fillRect(px - 6, py - 8.5, 12, 2);
    } else if (p.kind === 'car') {
      const col = ['#2e3a5c', '#3d2f2a', '#26404a', '#4a3a2a'][(p.s * 4) | 0];
      drawRoadCar(c, px, py - 2, col, p.s < .5 ? 1 : -1, .78);
    } else {
      c.fillStyle = '#3a2f20'; c.fillRect(px - 6, py - 6, 12, 6);
      c.fillStyle = '#4a3c28'; c.fillRect(px - 4, py - 9, 8, 4);
    }
  }

  /* здания */
  for (const b of builds) {
    const [x0, y0] = iso(b.i + (b.w - 1) / 2, b.j + (b.w - 1) / 2);
    const x = x0 + ox, y = y0 + oy;
    const s = b.seed;
    if (b.kind === 'wind') {               // мачта ветряка (лопасти — динамика)
      c.fillStyle = '#2a3050';
      c.fillRect(x - 2, y - b.h, 4, b.h);
      c.fillStyle = '#39406a'; c.beginPath();
      c.arc(x, y - b.h, 4.5, 0, 7); c.fill();
      turbines.push({ x, y: y - b.h });
      continue;
    }
    /* нарисованное здание: спрайт стоит основанием на нижней вершине тайла */
    const bs = buildSprite(b);
    if (bs && b.kind !== 'hotel') {
      const hh2 = TH / 2 * b.w;
      /* New concept sprites are landmark-scale on purpose: their silhouette
         must read above the dense city texture. The normal map remains at
         its established scale. */
      /* 27.08 (Claude): расширение теперь не только .png — весь набор
         продублирован в WebP. Без этого концепт-тайлы теряли множитель 1.5
         и рисовались на треть мельче задуманного. */
      const isConceptSprite = /_concept_v\d+\.(?:png|webp|jpe?g)(?:\?|$)/i.test(bs.currentSrc || bs.src || '');
      const wpx = TW * b.w * 1.45 * (isConceptSprite ? 1.5 : citySpriteScale(bs));
      const hpx = wpx * (bs.naturalHeight || bs.height) / (bs.naturalWidth || bs.width);
      /* контактная тень «приземляет» здание: раньше её имел только отель. */
      shadowUnder(c, x, y + hh2 + 3, wpx * 0.34, .42);
      c.drawImage(bs, x - wpx / 2, y + hh2 + 4 - hpx, wpx, hpx);
      /* точки жизни: у гаража вытяжка на крыше, у высотки маяк, у лавки вывеска */
      const topY = y + hh2 + 4 - hpx;
      if (b.kind === 'garage' && b.seed < .45)
        roofFans.push({ x: x + wpx * .16, y: topY + hpx * .24, r: 3.4 + b.seed * 2, ph: b.seed * 7 });
      if (b.kind === 'apart' && b.h > 80) cityBeacons.push({ x, y: topY + hpx * .06, ph: b.seed * 7 });
      if (b.kind === 'shop' || (b.kind === 'apart' && b.seed > .8))
        neonSigns.push({ x: x - wpx * .2, y: topY + hpx * .72, w: wpx * .3, ph: b.seed * 7,
                         c: b.seed < .5 ? '#4fa3ff' : '#ff5d6c' });
      if (b.kind === 'garage') {                    // диод у ворот остаётся живым
        leds.push({ x: x + TW * .18, y: y - 6, c: b.seed < .5 ? P.green : (b.seed < .8 ? P.gold : P.acc),
                    phase: b.seed * 6.28, slit: { x, y, h: 8, hw: TW / 2 } });
      }
      continue;
    }

    /* отель: вместо процедурной коробки — нарисованная башня с неоном */
    if (b.kind === 'hotel' && ok(ART.hotel)) {
      const hhh = TH / 2 * b.w;
      shadowUnder(c, x, y + hhh * .5, TW * 1.7, .55);
      const wpx = TW * 3.2;
      spr(c, ART.hotel, x, y + hhh + 8, wpx);
      hotelSign = { x, y: y + hhh + 8 - wpx * ART.hotel.naturalHeight / ART.hotel.naturalWidth - 10 };
      continue;
    }
    const dark = .82 + s * .3;
    box(c, x, y, b.w,
        b.h,
        shade(b.kind === 'garage' ? '#1c2136' : P.roof, dark),
        shade(P.wallL, dark), shade(P.wallR, dark));
    if (b.kind === 'apart' || b.kind === 'hotel' || b.kind === 'shop') {
      /* окна двумя гранями: экранные координаты копим для динамики */
      const hw = TW / 2 * b.w, hh = TH / 2 * b.w;
      const rows = Math.floor((b.h - 12) / 11);
      const cols = b.kind === 'hotel' ? 5 : 3;
      for (let side = 0; side < 2; side++)
        for (let r = 0; r < rows; r++)
          for (let q = 0; q < cols; q++) {
            if ((s * 997 + side * 131 + r * 17 + q * 7) % 1 < .45) continue;
            const t = (q + .5) / cols;
            const wx = side ? x + t * hw : x - hw + t * hw;
            const wy = side
              ? y + hh - t * hh - 9 - r * 11 - b.h + b.h  // right face
              : y + t * hh - 9 - r * 11;
            const yy = side ? (y + (1 - t) * hh) : (y + t * hh);
            windows.push({
              x: wx, y: yy - 9 - r * 11, w: 2.4, h: 3.4,
              warm: (s * 31 + r * 3 + q) % 1 < .72,
              phase: (s * 53 + r * 7 + q * 13) % 6.28, speed: .1 + s * .4,
              base: .18 + ((s * 71 + r + q) % 1) * .55,
            });
          }
    }
    if (b.kind === 'garage') {             // щель ворот + диод
      const hw = TW / 2;
      c.fillStyle = '#0b0d14';
      c.beginPath();
      c.moveTo(x + hw * .15, y + TH * .28); c.lineTo(x + hw * .78, y + TH * .02);
      c.lineTo(x + hw * .78, y - b.h + 6 + TH * .02); c.lineTo(x + hw * .15, y - b.h + 6 + TH * .28);
      c.closePath(); c.fill();
      leds.push({ x: x + hw * .45, y: y - b.h + 10, c: s < .5 ? P.green : (s < .8 ? P.gold : P.acc),
                  phase: s * 6.28, slit: { x, y, h: b.h, hw } });
    }
    if (b.kind === 'hotel') hotelSign = { x, y: y - b.h - 16 };
  }

  /* край карты растворяется в ночи — иначе город обрывается ножом */
  {
    const g = c.createRadialGradient(cssW / 2, cssH * .55, cssH * .30,
                                     cssW / 2, cssH * .55, cssH * .62);
    g.addColorStop(0, 'rgba(5,6,11,0)'); g.addColorStop(1, 'rgba(5,6,11,.92)');
    c.save(); c.globalCompositeOperation = 'source-atop';
    c.fillStyle = g; c.fillRect(0, 0, cssW, cssH); c.restore();
  }

  /* гербы банд на углу своего квартала: сразу видно, чья земля */
  const CREST = [MY.crest || ART.symWolf, ART.symAnchor, ART.symRing];
  for (const d of districts) {
    if (d.gang < 0) continue;
    const im = CREST[d.gang % CREST.length];
    if (!im || (im instanceof Image && !ok(im))) continue;
    const [cx0, cy0] = iso(d.i0 - .5, d.j0 + BS - .5);
    const cx2 = cx0 + ox, cy2 = cy0 + oy;
    c.save();
    c.globalAlpha = .20;
    c.fillStyle = (GANGS[d.gang] || { c: '#f5c542' }).c;
    c.beginPath(); c.ellipse(cx2, cy2 + 2, 15, 7, 0, 0, 7); c.fill();
    c.restore();
    spr(c, im, cx2, cy2 + 2, 21, .92);
  }
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) * k), g = Math.min(255, ((n >> 8) & 255) * k), b = Math.min(255, (n & 255) * k);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/* --- заранее отрисованное пятно света (быстрее shadowBlur в цикле) --- */
function glowSprite(color, r) {
  const s = document.createElement('canvas'); s.width = s.height = r * 2;
  const g = s.getContext('2d');
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, color + 'cc'); gr.addColorStop(.4, color + '44'); gr.addColorStop(1, color + '00');
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return s;
}
const G_WARM = glowSprite('#ffcf6e', 7), G_COLD = glowSprite('#9fd8ff', 7);
const G_GOLD = glowSprite('#f5c542', 8), G_GREEN = glowSprite('#3ddc84', 8),
      G_ACC = glowSprite('#4fa3ff', 8), G_HEAD = glowSprite('#fff3c9', 18);

/* ============================== МАРШИ ==================================== */
const marches = [];   // {path:[[i,j]..], t, speed, from, to, cars, col}
/* Local prototype marches are part of the player profile. Keep the minimal
   payload needed to restore a player convoy after a page refresh; online
   marches remain exclusively server-owned. */
function localCityMarchSnapshot() {
  return marches.filter(m => !m.serverCity && m.from === MINE && m.to && districts.includes(m.to))
    .map(m => ({ targetIdx: districts.indexOf(m.to), startTime: Number(m.startTime), durationMs: Number(m.durationMs) }));
}
function restoreLocalCityMarches(saved) {
  if (!Array.isArray(saved) || (window.MP && window.MP.connected)) return;
  marches.splice(0, marches.length);
  for (const row of saved) {
    const targetIdx = Number(row && row.targetIdx), target = districts[targetIdx];
    const startTime = Number(row && row.startTime), durationMs = Number(row && row.durationMs);
    if (!MINE || !target || !Number.isFinite(startTime) || !Number.isFinite(durationMs) || durationMs <= 0) continue;
    const path = makePath(MINE, target);
    let len = 0;
    for (let k = 1; k < path.length; k++) len += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
    marches.push({ path, t: 0, len, from: MINE, to: target, startTime, durationMs, rally: null,
      serverCity: false, col: MINE.gang >= 0 ? GANGS[MINE.gang].c : P.gold });
  }
  if (typeof renderMarchModal === 'function') renderMarchModal();
}
function roadPoint(d) {                     // центр дорожного тайла над кварталом
  return [d.i0 + BS / 2 - .5, d.j0 - 1];
}
function makePath(a, b) {                   // строго по дорогам: улица -> проспект -> улица
  const [ai, aj] = roadPoint(a), [bi, bj] = roadPoint(b);
  const ri = b.i0 - 1;                      // дорожная колонна слева от цели
  return [[ai, aj], [ri, aj], [ri, bj], [bi, bj]];
}
/* Территориальные флаги: кварталы разделены одной полосой дороги, поэтому
   касанием считаем общую границу или расстояние в один дорожный тайл. */
function districtsTouch(a, b) {
  if (!a || !b || a === b) return false;
  const dx = Math.max(0, Math.max(a.i0, b.i0) - Math.min(a.i0 + BS, b.i0 + BS));
  const dy = Math.max(0, Math.max(a.j0, b.j0) - Math.min(a.j0 + BS, b.j0 + BS));
  return dx <= 1 && dy <= 1;
}
const flagBuilds = [];                 // {d,start,end,helpers}
let flagPlacementMode = null;          // цена выбранного, но ещё не оплаченного флага
let activeRally = null;                // сбор перед ударом по крупному объекту
const FLAG_HP_MAX = 100;
const FLAG_BURN_PER_SEC = 1.25;        // полный незащищённый флаг сгорит примерно за 80 сек.
const FLAG_REPAIR_HP = 20;
function flagHp(d) { return Math.max(0, Math.min(FLAG_HP_MAX, Number(d.flagHp) || FLAG_HP_MAX)); }
function rallyRoster() {
  const people = [
    ...(Array.isArray(gar.hired) ? gar.hired : []),
    ...((MY.gang && Array.isArray(MY.gang.members)) ? MY.gang.members : [])
  ].filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i);
  const fighters = people.filter(p => /КУВАЛДА|БОЕЦ|БУЛЬДОГ/i.test(p.role || p.name || ''));
  const scouts = people.filter(p => /ШНЫРЬ|развед/i.test(p.role || p.name || ''));
  const leader = fighters.sort((a, b) => (b.bonus || 0) - (a.bonus || 0))[0] || people[0];
  const members = Math.max(1, (MY.gang && MY.gang.members && MY.gang.members.length) || 1);
  return {
    leader: leader ? leader.name : 'Ты',
    fighters: Math.max(1, fighters.length), scouts: scouts.length,
    capacity: Math.min(12, 3 + members * 2),
    power: Math.round(gar.hash * garEff() * (1 + Math.min(.55, fighters.length * .08))
      * (typeof kvkRallyMultiplier === 'function' ? kvkRallyMultiplier() : 1))
  };
}
function flagGarrisonCap() { return Math.min(12, 2 + rallyRoster().capacity); }
function connectedOwnedDistricts(gang = 0) {
  const root = gang === 0 ? MINE : null;
  const all = districts.filter(d => d.gang === gang && d.flagState !== 'burned');
  /* 28.08: в онлайне связность считает сервер и присылает готовый признак
     flagLinked. Локальный обход от MINE здесь неверен принципиально: первый
     флаг банды разрешено ставить не у гаража игрока, а у второго участника
     банды флаги вообще не касаются чужого гаража — прежнее правило погасило
     бы их все. Корень цепи на сервере — край района, а не гараж. */
  if (window.MP && window.MP.connected) return all.filter(d => d.flagLinked !== false);
  if (!root || !all.includes(root)) return all;
  const seen = new Set([root]), queue = [root];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of all) if (!seen.has(next) && districtsTouch(cur, next)) {
      seen.add(next); queue.push(next);
    }
  }
  return all.filter(d => seen.has(d));
}
function isActiveTerritory(d, gang = 0) { return connectedOwnedDistricts(gang).includes(d); }
function cityTerritoryYieldMultiplier() {
  return 1 + connectedOwnedDistricts(0).filter(d => !d.mine).length * .01;
}
/* 24.08: восстановлена потерянная при рефакторинге функция — её отсутствие
   роняло flagPlacementTargets → hallHTML → весь Штаб банды показывал вечное
   "CREW SYNCING". Правило соседства 1:1 повторяет сервер (placeCrewFlag):
   4 ортогональные клетки на сетке 7x7 (CITY_SIDE=7), idx = row*7 + col. */
function quarterTouchesOwned(activeFlags, idx) {
  const W = 7;
  const row = Math.floor(idx / W), col = idx % W;
  const nb = [];
  if (row > 0) nb.push(idx - W);
  if (row < W - 1) nb.push(idx + W);
  if (col > 0) nb.push(idx - 1);
  if (col < W - 1) nb.push(idx + 1);
  return nb.some(n => activeFlags[n] === 0);
}
function flagPlacementTargets(gang = 0) {
  if (gang === 0 && window.MP && window.MP.connected) {
    const provinceIdx = Number(window.activeWorldProvinceIdx);
    const province = typeof PROVINCES !== 'undefined' && PROVINCES[provinceIdx];
    if (!province || provinceIdx === 0) return [];
    const flags = Array.isArray(province.flags) ? province.flags : Array(49).fill(-1);
    const firstFlag = !(typeof PROVINCES !== 'undefined' && PROVINCES.some(p =>
      Array.isArray(p.flags) && p.flags.some(owner => owner === 0)));
    /* Construction reserves a tile but cannot extend the line. Only an
       already active flag creates legal adjacent placement cells. */
    /* 28.08: продолжать линию можно только от ЖИВОГО флага — связанного с
       краем района. Ту же проверку делает сервер (FLAG_LINE_CUT); здесь она
       нужна, чтобы игрок не тыкал в клетку под гарантированный отказ. */
    const activeFlags = flags.map((owner, idx) => {
      if (owner !== 0) return -1;
      const st = province.flagStates && province.flagStates[idx];
      if (st && st.status !== 'active') return -1;
      if (st && st.linked === false) return -1;
      return 0;
    });
    /* A flag can extend only onto a genuinely neutral block.  The old client
       ignored `quarters`, so it could offer an occupied block and then leave
       the player with a server denial after they clicked it. */
    const quarters = Array.isArray(province.quarters) ? province.quarters : Array(49).fill(-1);
    /* 27.08: вход в НОВЫЙ район - только свободный КРАЙНИЙ квартал, по
       периметру сетки 7x7. Внутрь линия идёт уже обычным соседством. Ту же
       проверку делает сервер (FLAG_MUST_START_AT_EDGE); здесь она нужна, чтобы
       игрок видел допустимые кварталы, а не тыкал наугад под отказ. */
    const firstHere = !flags.some(owner => owner === 0);
    if (firstHere && !firstFlag) {
      /* Заходить можно только в район, граничащий с уже заявленным. Таблицу
         соседства и список заявленных районов присылает сервер - тот же
         источник, по которому он и отказывает (PROVINCE_NOT_ADJACENT). */
      if (typeof crewCanEnterProvince === 'function' && !crewCanEnterProvince(provinceIdx)) return [];
      return districts.filter((d, idx) => flags[idx] === -1 && quarters[idx] === -1
        && (idx < 7 || idx >= 42 || idx % 7 === 0 || idx % 7 === 6));
    }
    return districts.filter((d, idx) => flags[idx] === -1 && quarters[idx] === -1 &&
      (firstFlag ? rootOk(idx) : quarterTouchesOwned(activeFlags, idx)));
  }
  const owned = connectedOwnedDistricts(gang);
  return districts.filter(d => d.gang < 0 && owned.some(o => districtsTouch(d, o)));
}
function startFlagBuild(d, price) {
  if (window.MP && window.MP.connected) {
    if (typeof crewCanManageTactics === 'function' && !crewCanManageTactics()) {
      toast(LANG === 'en' ? 'Only the leader or an officer can place crew flags.' : 'Флаги банды могут ставить только главарь или заместитель.');
      return false;
    }
    if (typeof myFlags === 'function' && myFlags() === 0 && typeof myCrewRole === 'function' && myCrewRole() !== 'leader') {
      toast(LANG === 'en' ? 'Only the leader can place the first crew base flag.' : 'Первый флаг-общак может поставить только главарь.');
      return false;
    }
    const provinceIdx = Number(window.activeWorldProvinceIdx);
    const targetIdx = districts.indexOf(d);
    if (!Number.isInteger(provinceIdx) || targetIdx < 0) return false;
    if (!window.MP.send('place_crew_flag', { provinceIdx, targetIdx })) {
      toast(LANG === 'en' ? 'The world server is reconnecting. Try flag placement again in a moment.' : 'Сервер мира переподключается. Повтори установку флага через секунду.');
      return false;
    }
    flagPlacementMode = null;
    toast(LANG === 'en' ? 'Flag placement request sent to the crew server.' : 'Запрос на установку флага отправлен на сервер банды.');
    return true;
  }
  if (!MY.gang || !d || !flagPlacementTargets(0).includes(d)) return false;
  if (MY.gang.treasury < price) { toast('В казне уже не хватает BAND для флага.'); return false; }
  MY.gang.treasury -= price; MY.gang.flags = (MY.gang.flags || 0) + 1; MY.gang.spent.flags += price;
  d.flagState = 'building'; d.flagHp = FLAG_HP_MAX; d.garrison = 0;
  const b = { d, price, start: Date.now(), end: Date.now() + 45000, helpers: 1 };
  flagBuilds.push(b); flagPlacementMode = null;
  if (typeof queueLocalCitySave === 'function') queueLocalCitySave();
  toast(`Стройка флага в «${d.name}» началась. Отправь помощь — будет быстрее.`);
  return true;
}
function helpFlagBuild(d) {
  const b = flagBuilds.find(x => x.d === d);
  if (!b) return false;
  b.helpers = Math.min(6, b.helpers + 1);
  b.end = Math.max(Date.now() + 4000, b.end - 7000);
  toast(`Помощь отправлена: строителей ${b.helpers}.`);
  return true;
}
function igniteFlag(d) {
  if (!d || d.mine || d.gang < 0 || d.flagState === 'burned') return;
  d.flagState = 'burning';
  d.flagHp = Math.max(1, flagHp(d) - 25);       // успешный удар сначала выбивает четверть прочности
  d.burnAt = Date.now();
  if (typeof queueLocalCitySave === 'function') queueLocalCitySave();
  toast(`Флаг «${d.name}» горит: прочность ${Math.ceil(d.flagHp)}/100. Нужен ремонт или гарнизон.`);
}
function repairFlag(d) {
  if (!d || d.gang !== 0 || d.flagState !== 'burning') return false;
  const cost = Math.max(50, Math.round(DAY_YIELD));
  if (!MY.gang || MY.gang.treasury < cost) { toast(`На ремонт нужно ${cost.toLocaleString('ru')} BAND из казны.`); return false; }
  MY.gang.treasury -= cost;
  d.flagHp = Math.min(FLAG_HP_MAX, flagHp(d) + FLAG_REPAIR_HP);
  d.burnAt = Date.now();
  if (d.flagHp >= FLAG_HP_MAX) { d.flagState = 'active'; delete d.burnAt; }
  if (typeof queueLocalCitySave === 'function') queueLocalCitySave();
  toast(`Ремонт «${d.name}»: ${Math.ceil(d.flagHp)}/100 прочности.`); return true;
}
function reinforceFlag(d) {
  if (!d || d.gang !== 0 || d.mine || d.flagState === 'building') return false;
  const cap = flagGarrisonCap();
  d.garrison = Math.min(cap, (d.garrison || 0) + 1);
  toast(`Гарнизон «${d.name}»: ${d.garrison}/${cap}. Гарнизон снижает урон от атак.`);
  return true;
}
function startRally(target) {
  /* The production client must never fall back to its single-player rally
     simulation. A reconnect used to create a convincing local march that
     was not stored on the server. */
  const relay = window.MP;
  if (relay || /(^|\.)mininggang\.online$/i.test(window.location.hostname)) {
    if (!relay || !relay.connected || !relay.ready) {
      toast(LANG === 'en' ? 'The world server is reconnecting. No local rally was started.' : 'Сервер мира переподключается. Локальное ралли не создано.');
      return;
    }
    if (activeRally && activeRally.server && activeRally.target === target) {
      if (!relay.send('join_crew_rally', { rallyId: activeRally.id })) {
        toast(LANG === 'en' ? 'The world server is reconnecting. Try joining again in a moment.' : 'Сервер мира переподключается. Попробуй вступить в ралли через секунду.');
        return;
      }
      toast(LANG === 'en' ? 'Joining the crew rally…' : 'Вступаю в ралли банды…');
      return;
    }
    if (typeof crewCanManageTactics === 'function' && !crewCanManageTactics()) {
      toast(LANG === 'en' ? 'Only the leader or an officer can start a crew rally. Join an active rally instead.' : 'Начать ралли может только главарь или заместитель. В активное ралли может вступить любой участник.');
      return;
    }
    /* The selected world panel can remain on the previously viewed province.
       The current city variant is the actual district from which this rally
       is being launched. */
    const namedProvince = typeof activeCityVariant === 'string'
      ? PROVINCES.findIndex(p => p.name === activeCityVariant) : -1;
    /* The map click is authoritative. `activeCityVariant` is only a visual
       preset name and can survive a scene transition with an old value. */
    const selectedProvinceIdx = Number(window.activeWorldProvinceIdx);
    const provinceIdx = Number.isInteger(selectedProvinceIdx) && PROVINCES[selectedProvinceIdx]
      ? selectedProvinceIdx : namedProvince;
    const targetIdx = districts.indexOf(target);
    if (!Number.isInteger(provinceIdx) || targetIdx < 0) return;
    if (!relay.send('launch_city_march', { provinceIdx, targetIdx })) {
      toast(LANG === 'en' ? 'The world server is reconnecting. Try starting the rally again in a moment.' : 'Сервер мира переподключается. Попробуй начать ралли через секунду.');
      return;
    }
    toast(LANG === 'en' ? 'Crew rally requested. Assembly lasts 3 minutes.' : 'Ралли запрошено. Сбор длится 3 минуты.');
    return;
  }
  const roster = rallyRoster();
  if (activeRally) {
    if (activeRally.target === target) {
      activeRally.joined = Math.min(activeRally.capacity, activeRally.joined + 1);
      activeRally.power = Math.round(activeRally.power * 1.08);
      toast(`Ты усилил ралли: ${activeRally.joined}/${activeRally.capacity} мест, сила ${activeRally.power.toLocaleString('ru')} TH.`);
    }
    return;
  }
  const supply = Math.max(200, Math.round(DAY_YIELD * .20));
  if (!MY.gang || MY.gang.treasury < supply) {
    toast(`Для ралли нужно ${supply.toLocaleString('ru')} BAND снабжения из казны.`);
    return;
  }
  MY.gang.treasury -= supply;
  MY.gang.spent.kvk = (MY.gang.spent.kvk || 0) + supply;
  activeRally = { target, start: Date.now(), end: Date.now() + 180000, joined: 1, supply, ...roster };
  toast(`Ралли на «${target.name}»: лидер ${roster.leader}, снабжение ${supply.toLocaleString('ru')} BAND, сбор 3 минуты.`);
}
function tickTerritoryFlags() {
  if (window.MP || /(^|\.)mininggang\.online$/i.test(window.location.hostname)) {
    /* Online flags are advanced only by server events. */
    if (activeRally && !activeRally.server && Date.now() >= activeRally.end) {
      const r = activeRally; activeRally = null; launchMarch(MINE, r.target, { rally: r });
    }
    return;
  }
  const now = Date.now();
  for (let i = flagBuilds.length - 1; i >= 0; i--) {
    const b = flagBuilds[i];
    if (now < b.end) continue;
    b.d.gang = 0; b.d.flagState = 'active'; b.d.flagHp = FLAG_HP_MAX; b.d.garrison = 0; flagBuilds.splice(i, 1); rebuildStatic();
    if (typeof queueLocalCitySave === 'function') queueLocalCitySave();
    evShow('bg_flag.jpg', 'ФЛАГ ПОСТРОЕН', `${b.d.name} подключён к общаку банды.`);
  }
  for (const d of districts) if (d.flagState === 'burning') {
    const elapsed = Math.max(0, now - (d.burnAt || now)) / 1000;
    const guardFactor = Math.max(.35, 1 - (d.garrison || 0) * .08);
    d.flagHp = Math.max(0, flagHp(d) - elapsed * FLAG_BURN_PER_SEC * guardFactor);
    d.burnAt = now;
    if (d.flagHp > 0) continue;
    d.gang = -1; d.flagState = 'burned'; d.garrison = 0; rebuildStatic();
    if (typeof queueLocalCitySave === 'function') queueLocalCitySave();
    toast(`Флаг «${d.name}» сгорел. Земля за ним отключена от общака.`);
  }
  if (activeRally && !activeRally.server && now >= activeRally.end) {
    const r = activeRally; activeRally = null;
    toast(`Ралли собрано: ${r.leader}, ${r.joined}/${r.capacity} мест, сила ${r.power.toLocaleString('ru')} TH.`);
    launchMarch(MINE, r.target, { rally: r });
  }
}
function applyServerCrewRally(rally) {
  if (!rally || rally.status !== 'forming') return;
  const namedProvince = typeof activeCityVariant === 'string'
    ? PROVINCES.findIndex(p => p.name === activeCityVariant) : -1;
  const selectedProvinceIdx = Number(window.activeWorldProvinceIdx);
  const currentProvinceIdx = Number.isInteger(selectedProvinceIdx) && PROVINCES[selectedProvinceIdx]
    ? selectedProvinceIdx : namedProvince;
  const sameDistrict = currentProvinceIdx === Number(rally.provinceIdx);
  const target = sameDistrict && Number.isInteger(rally.targetIdx) && districts[rally.targetIdx]
    ? districts[rally.targetIdx]
    : { name: typeof rallyTargetLabel === 'function' ? rallyTargetLabel(rally) : `${PROVINCES[rally.provinceIdx] ? PROVINCES[rally.provinceIdx].name : 'District'} · block ${Number(rally.targetIdx) + 1}` };
  activeRally = {
    id: rally.id, server: true, status: rally.status, target,
    leader: rally.leader, start: Number(rally.startsAt), end: Number(rally.departsAt),
    joined: Array.isArray(rally.members) ? rally.members.length : 0,
    capacity: MY.gang && Array.isArray(MY.gang.members) ? MY.gang.members.length : 10,
    power: Number(rally.power || 0), members: rally.members || [],
  };
}
function clearServerCrewRally(id) {
  if (activeRally && activeRally.server && (!id || activeRally.id === id)) activeRally = null;
}
setInterval(tickTerritoryFlags, 500);
function launchMarch(from, to, opts = {}) {
  /* In an online assault the server owns both the battle and the resulting
     flag. The browser only asks to start a march; it receives the visible
     convoy/result back through the multiplayer relay. */
  const namedProvince = typeof activeCityVariant === 'string'
    ? PROVINCES.findIndex(p => p.name === activeCityVariant) : -1;
  const selectedProvinceIdx = Number(window.activeWorldProvinceIdx);
  const activeProvinceIdx = Number.isInteger(selectedProvinceIdx) && PROVINCES[selectedProvinceIdx]
    ? selectedProvinceIdx : namedProvince;
  const activeProvince = typeof PROVINCES !== 'undefined' && Number.isInteger(activeProvinceIdx)
    ? PROVINCES[activeProvinceIdx] : null;
  const relay = window.MP;
  if (!opts.serverCity && from === MINE && (relay || /(^|\.)mininggang\.online$/i.test(window.location.hostname))) {
    if (!relay || !relay.connected || !relay.ready) {
      toast(LANG === 'en' ? 'The world server is reconnecting. No local march was started.' : 'Сервер мира переподключается. Локальный марш не создан.');
      return;
    }
    if (!activeProvince) {
      toast(LANG === 'en' ? 'The district is still loading from the server.' : 'Район ещё загружается с сервера.');
      return;
    }
    const targetIdx = districts.indexOf(to);
    if (targetIdx < 0) return;
    if (!relay.send('launch_city_march', { provinceIdx: activeProvinceIdx, targetIdx })) {
      toast(LANG === 'en' ? 'The world server is reconnecting. Try sending the rally again in a moment.' : 'Сервер мира переподключается. Попробуй отправить ралли через секунду.');
      return;
    }
    toast(`Штурм отправлен: ${from.name} → ${to.name}. Сервер считает бой.`);
    return;
  }
  if (from === MINE && gar.shield > 0) {      // агрессия снимает щит — правило ROK
    gar.shield = 0;
    toast('Щит снят: пошёл маршем — значит, и тебя можно бить.');
  }
  const path = makePath(from, to);
  let len = 0;
  for (let k = 1; k < path.length; k++)
    len += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
  if (from === MINE) { QST.marched = true; SFX.march(); }  // марши ботов не звучат и задание не засчитывают
  /* Городской марш не должен долетать за пару кадров: время зависит от
     длины улиц, минимум 25 секунд — как и на большой карте. */
  const durationMs = Math.max(25000, Math.round(len * 4000));
  marches.push({ path, t: 0, len, from, to, startTime: opts.startTime || Date.now(), durationMs: opts.durationMs || durationMs, rally: opts.rally || null, serverCity: !!opts.serverCity,
                  serverId: opts.serverId || null, col: opts.col || (from.gang >= 0 ? GANGS[from.gang].c : P.gold) });
  if (typeof renderMarchModal === 'function') renderMarchModal();
  if (from === MINE && !opts.serverCity && typeof queueLocalCitySave === 'function') queueLocalCitySave();
  toast(`Марш вышел: ${from.name} → ${to.name}. В пути ${clockLeft(durationMs)}.`);
}
function marchXY(m) {
  let dist = m.t, k = 1;
  while (k < m.path.length) {
    const seg = Math.hypot(m.path[k][0] - m.path[k - 1][0], m.path[k][1] - m.path[k - 1][1]);
    if (dist <= seg) {
      const f = dist / seg;
      return [m.path[k - 1][0] + (m.path[k][0] - m.path[k - 1][0]) * f,
              m.path[k - 1][1] + (m.path[k][1] - m.path[k - 1][1]) * f];
    }
    dist -= seg; k++;
  }
  return m.path[m.path.length - 1];
}

/* ============================ КАМЕРА/ВВОД ================================= */
let zoom = 1, panX = 0, panY = 0, staticCv = null, S_OX = 0, S_OY = 0;
let zoomT = 1, panXT = 0, panYT = 0;        // цели камеры: реальная едет к ним плавно
let hoverD = null;                          // квартал под курсором
/* v7.2: потолок зума подняли с 2.2 — на нём город из деталей ниже открыться не
   успевал. ZOOM_DETAIL_* — окно, в котором подписи жильцов появляются плавно. */
const ZOOM_MAX = 2.85;
const ZOOM_DETAIL_MIN = 1.55, ZOOM_DETAIL_FULL = 2.15;
/* Статическая часть города — тяжёлый кэш, но камера может приблизить её почти
   втрое. Кэш в одном экранном разрешении при таком зуме растягивается как
   картинка и одновременно смягчает все кварталы. Увеличиваем его плотность
   лишь после завершения жеста зума: карта остаётся плавной, а детали резкими. */
const STATIC_CACHE_MAX_SCALE = 2;
let staticCacheScale = 1, staticQualityTimer = 0;
function desiredStaticCacheScale(z) {
  return Math.max(1, Math.min(STATIC_CACHE_MAX_SCALE, z));
}
function scheduleStaticQuality(z) {
  const wanted = desiredStaticCacheScale(z);
  if (Math.abs(wanted - staticCacheScale) < .16) return;
  clearTimeout(staticQualityTimer);
  staticQualityTimer = setTimeout(() => {
    if (scene !== 'city') return;
    const next = desiredStaticCacheScale(zoomT);
    if (Math.abs(next - staticCacheScale) < .16) return;
    staticCacheScale = next;
    rebuildStatic();
  }, 220);
}
function rebuildStatic() {
  /* This cache is rebuilt after resize, world re-entry and each authoritative
     board change.  Make the server-assigned home cell an invariant at the
     rendering boundary too: no earlier transition is allowed to leave a
     freshly drawn home district without its garage marker. */
  if (typeof restoreHomeGarageMarker === 'function') restoreHomeGarageMarker(window.activeWorldProvinceIdx);
  windows.length = 0; leds.length = 0; turbines.length = 0;
  roofFans.length = 0; cityBeacons.length = 0; neonSigns.length = 0;
  const [xMin] = iso(0, SIDE), [xMax] = iso(SIDE, 0);
  const [, yMax] = iso(SIDE, SIDE);
  const w = xMax - xMin + 80, h = yMax + 260;
  staticCv = document.createElement('canvas');
  /* Кэш города должен иметь столько же физических пикселей, сколько экран.
     Внутри всё по-прежнему рисуем в логических координатах игры. */
  staticCv._cssW = w; staticCv._cssH = h;
  const cacheDpr = DPR * staticCacheScale;
  staticCv.width = Math.ceil(w * cacheDpr); staticCv.height = Math.ceil(h * cacheDpr);
  const staticCx = staticCv.getContext('2d');
  staticCx.setTransform(cacheDpr, 0, 0, cacheDpr, 0, 0);
  staticCx.imageSmoothingEnabled = true;
  staticCx.imageSmoothingQuality = 'high';
  S_OX = -xMin + 40; S_OY = 190;
  renderStatic(staticCx, S_OX, S_OY);
}

function resize() {
  /* Safari/Retina can change devicePixelRatio when a window moves between
     displays or browser zoom changes.  Re-read it on every resize; otherwise
     the main canvas becomes soft while cached scene layers stay at old scale. */
  const previousDpr = DPR;
  DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
  CV.width = W * DPR; CV.height = H * DPR;
  CV.style.width = W + 'px'; CV.style.height = H + 'px';
  if (staticCv && previousDpr !== DPR) {
    rebuildStatic();
    panX = panXT = (W - staticCv._cssW) / 2;
    panY = panYT = (H - staticCv._cssH) / 2 + 20;
  }
  if (typeof updateResponsiveHud === 'function') updateResponsiveHud();
}
addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize); resize(); rebuildStatic();
panX = panXT = (W - staticCv._cssW) / 2; panY = panYT = (H - staticCv._cssH) / 2 + 20;

/* ======================== ОБЩАЯ АТМОСФЕРА СЦЕН ==========================
   Это намеренно пост-обработка, а не очередной фильтр на ассетах: один
   недорогой проход в конце кадра одинаково связывает город, большую карту и
   гараж. Слой не влияет на клики и не «запекает» интерфейс в Canvas. */
const POST_GRAIN = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), image = g.createImageData(128, 128);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 105 + ((i * 1103515245 + 12345) >>> 16 & 31);
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 38;
  }
  g.putImageData(image, 0, 0);
  return c;
})();
function drawPostFX(kind) {
  CX.save();
  CX.setTransform(DPR, 0, 0, DPR, 0, 0);
  CX.globalCompositeOperation = 'screen';
  const glow = CX.createRadialGradient(W * .52, H * (kind === 'garage' ? .43 : .37), 10,
                                       W * .52, H * .48, Math.max(W, H) * .72);
  glow.addColorStop(0, kind === 'garage' ? 'rgba(255,184,86,.075)' : 'rgba(80,135,255,.052)');
  glow.addColorStop(.55, 'rgba(40,90,170,.018)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  CX.fillStyle = glow; CX.fillRect(0, 0, W, H);
  CX.globalCompositeOperation = 'source-over';
  const vignette = CX.createRadialGradient(W * .5, H * .44, Math.min(W, H) * .12,
                                           W * .5, H * .48, Math.max(W, H) * .78);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(.62, 'rgba(0,3,12,.025)');
  vignette.addColorStop(1, 'rgba(0,0,0,.31)');
  CX.fillStyle = vignette; CX.fillRect(0, 0, W, H);
  CX.globalAlpha = .028;
  CX.fillStyle = CX.createPattern(POST_GRAIN, 'repeat');
  CX.fillRect(0, 0, W, H);
  CX.restore();
}

/* Дождь живёт только снаружи: карта и район получают глубину мокрой ночи,
   а в гараже остаётся сухой интерьер. Частицы фиксированы, поэтому эффект
   не мерцает и не создаёт мусор в памяти на каждом кадре. */
const RAIN_DROPS = Array.from({ length: 125 }, (_, i) => ({
  x: (i * 47 % 997) / 997,
  y: (i * 131 % 991) / 991,
  len: 8 + i % 13,
  v: .24 + (i % 7) * .035,
  a: .11 + (i % 5) * .024,
}));
function drawRainFX() {
  CX.save();
  CX.setTransform(DPR, 0, 0, DPR, 0, 0);
  CX.lineCap = 'round';
  for (const d of RAIN_DROPS) {
    const x = d.x * (W + 90) - 45;
    const y = ((d.y + T * d.v * .08) % 1) * (H + 80) - 40;
    CX.globalAlpha = d.a;
    CX.strokeStyle = '#9bc9ff'; CX.lineWidth = .65;
    CX.beginPath(); CX.moveTo(x, y); CX.lineTo(x - d.len * .28, y + d.len); CX.stroke();
  }
  /* Небольшие растянутые блики на мокром асфальте. */
  CX.globalCompositeOperation = 'screen';
  CX.globalAlpha = .055;
  for (let i = 0; i < 15; i++) {
    const x = ((i * 179) % 1000) / 1000 * W;
    const y = ((i * 271) % 1000) / 1000 * H;
    const g = CX.createLinearGradient(x, y - 16, x, y + 22);
    g.addColorStop(0, 'rgba(255,190,100,0)');
    g.addColorStop(.5, i % 3 ? 'rgba(115,176,255,.8)' : 'rgba(255,192,104,.9)');
    g.addColorStop(1, 'rgba(255,190,100,0)');
    CX.fillStyle = g; CX.fillRect(x - 2, y - 16, 4, 38);
  }
  CX.restore();
}

/* ЦЕНТР vs остальные районы (13.08, пятый заход): «Войти в район» переключает,
   какая сетка сейчас активна — genCity() честно пересобирает districts/builds
   заново, а тут — обвязка вокруг: подобрать/сохранить, кто чем в этом городе
   владел (см. также stateSnapshot/applyState — то же самое для сейва), сбросить
   выделение и камеру, перестроить жизнь улиц и статичную картинку под новый
   размер. Один и тот же код обслуживает переключение в обе стороны.        */
let activeCityVariant = HOME_CITY_VARIANT;
let cityOwnershipCache = { default: null, center: null, north: null, [HOME_CITY_VARIANT]: null };

/* Прогресс штурма виден прямо в городе: иначе игроку непонятно, почему
   большой район ещё не сменил цвет после удачного марша. */
function updateCityCaptureStatus() {
  let el = document.getElementById('city-capture-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'city-capture-status';
    el.style.cssText = 'display:none;position:fixed;z-index:80;top:92px;left:50%;transform:translateX(-50%);min-width:270px;padding:10px 15px;border:1px solid #f5c542;border-radius:12px;background:rgba(10,14,28,.94);box-shadow:0 10px 28px #000a;color:#f7f2dc;text-align:center;font:12px Arial,sans-serif;pointer-events:none';
    document.body.appendChild(el);
  }
  /* This used to be a fixed banner shown after every city redraw. It covered
     raid, rally and district panels, while saying the same thing those views
     already show. Keep the renderer/data path for a future opt-in district
     overview, but never leave a passive overlay on the player's screen. */
  if (window.cityCaptureStatusOpen !== true) { el.style.display = 'none'; return; }
  const idx = window.activeWorldProvinceIdx;
  const p = typeof PROVINCES !== 'undefined' && Number.isInteger(idx) ? PROVINCES[idx] : null;
  if (!p || p.siegedBy !== 0 || p.gang === 0) { el.style.display = 'none'; return; }
  const capturable = districts.filter(d => d.type !== 'hotel' && d.type !== 'wind');
  const serverBoard = window.MP && window.MP.connected && Array.isArray(p.quarters) ? p.quarters : null;
  const held = serverBoard ? serverBoard.filter(x => x === 0).length : capturable.filter(d => d.gang === 0).length;
  const total = serverBoard ? serverBoard.length : capturable.length;
  const fullAt = (window.PROVINCE_CONTROL && window.PROVINCE_CONTROL.full) || 33;
  const phase = held >= fullAt ? 'FULL CONTROL — claim is being confirmed'
    : held >= 30 ? 'DOMINANCE — the crew flag is visible on the world map'
      : held >= 25 ? 'INFLUENCE — district is now tinted in crew colour'
        : held >= 13 ? 'PRESENCE — the crew border is now visible' : 'BREACH — push deeper into the district';
  const income = typeof provinceBonus === 'function' ? provinceBonus(p).income : 0;
  el.style.display = 'block';
  el.innerHTML = `<b style="color:#f5c542;letter-spacing:.4px">⚔ ШТУРМ: ${p.name}</b><br>` +
    `Quarters under control: <b>${held} / ${total}</b> · full control at <b>${fullAt}</b>` +
    `<br><span style="color:#7de5a6">${phase}</span>` +
    `<br><span style="color:#f5c542">Full control: +${Math.round(income).toLocaleString('ru')} BAND/day.</span>`;
}
function switchCityVariant(variant) {
  /* Re-entering the already-open district must still apply the latest server
     board. The old early return preserved the generated demo grid forever. */
  if (variant === activeCityVariant && !window.MP && !/(^|\.)mininggang\.online$/i.test(window.location.hostname)) return;
  /* A city is identified by its province name on the world-map click path.
     Keep that identity in sync before generating its board: after returning
     from the world map an old active index could make the home variant use a
     foreign server board, which erased the physical garage marker. */
  const variantProvinceIdx = typeof PROVINCES !== 'undefined'
    ? PROVINCES.findIndex(province => province && province.name === variant) : -1;
  if (variantProvinceIdx >= 0) window.activeWorldProvinceIdx = variantProvinceIdx;
  /* Theme selection is asynchronous and presentation-only.  `genCity()` and
     the server board run immediately as before; when the image arrives it
     simply rebuilds the static paint layer beneath those live layers. */
  if (typeof window.setCityDistrictForProvince === 'function') window.setCityDistrictForProvince(variant);
  cityOwnershipCache[activeCityVariant] = districts.map(d => d.gang);
  const selectedIsHome = Number(window.activeWorldProvinceIdx) === Number(typeof PROVINCES !== 'undefined' ? PROVINCES.indexOf(homeProvince()) : -1);
  genCity(cityCfgFor(variant), selectedIsHome || isHomeCity(variant));
  activeCityVariant = variant;
  const saved = cityOwnershipCache[variant];
  if (saved) districts.forEach((d, i) => { if (saved[i] !== undefined) d.gang = saved[i]; });
  /* A saved ownership board must never hide the player's base.  This is kept
     here as well as in genCity because this function is the one used by the
     “Enter district” button on the world map. */
  if (selectedIsHome || isHomeCity(variant)) restoreHomeGarageMarker();
  /* После успешного марша в чужой район появляется штурмовая точка. Она
     нужна как начало связной цепи флагов: без неё игрок не мог бы взять
     первый квартал внутри района. Сам район пока остаётся чужого цвета. */
  const selectedProvinceIdx = Number(window.activeWorldProvinceIdx);
  const province = typeof PROVINCES !== 'undefined' && Number.isInteger(selectedProvinceIdx) && PROVINCES[selectedProvinceIdx]
    ? PROVINCES[selectedProvinceIdx]
    : (typeof PROVINCES !== 'undefined' && PROVINCES.find(p => p.name === variant));
  if (province && province.siegedBy === 0 && !isHomeCity(variant)) {
    MINE.gang = 0; MINE.mine = true; MINE.name = 'ШТУРМОВАЯ ТОЧКА';
  }
  /* A generated city contains an attractive single-player ownership pattern.
     It must be discarded, not merged, as soon as this is the online game.
     On a slow WebSocket handshake we deliberately show neutral blocks until
     the complete server board arrives; otherwise the old colours look like
     captured territory and lead players to invalid attack targets. */
  if (province && (window.MP || /(^|\.)mininggang\.online$/i.test(window.location.hostname))) {
    const quarters = Array.isArray(province.quarters) ? province.quarters : [];
    const states = Array.isArray(province.flagStates) ? province.flagStates : [];
    districts.forEach((d, i) => {
      d.gang = Number.isInteger(quarters[i]) ? quarters[i] : -1;
      d.flagState = null; d.flagHp = FLAG_HP_MAX;
      d.flagBuildEndsAt = null; d.flagBurnEndsAt = null;
      const state = states[i];
      /* A projected board can briefly contain an owner whose visual slot has
         not arrived yet. Do not render an invalid GANGS[-1] flag; the next
         complete server snapshot restores it once the slot is available. */
      if (!state || !Number.isInteger(state.owner) || state.owner < 0) return;
      d.gang = state.owner;
      d.flagState = state.status || 'active'; d.flagHp = Number(state.hp ?? FLAG_HP_MAX);
      d.flagBuildEndsAt = state.buildEndsAt || null; d.flagBurnEndsAt = state.burnEndsAt || null;
      d.flagLinked = state.linked !== false;
    });
    /* The garage is a location marker, not a fabricated captured block. */
    restoreHomeGarageMarker();
  }
  /* A server-city convoy can outlive a visit to the world map. Recreate it
     against this freshly generated district with the original server clock. */
  if (typeof restoreServerCityMarches === 'function') restoreServerCityMarches(selectedProvinceIdx);
  buildLife();
  rebuildStatic();
  panX = panXT = (W - staticCv._cssW) / 2; panY = panYT = (H - staticCv._cssH) / 2 + 20;
  zoom = zoomT = 1;
  selected = null; hoverD = null;
  const panelEl = document.getElementById('panel');
  if (panelEl) panelEl.style.display = 'none';
  updateCityCaptureStatus();
}

let scene = 'city';
let drag = null;
/* ============================== СЕНСОР =====================================
   До сих пор весь ввод держался на mousedown/mousemove/wheel — у сенсорного
   экрана этого просто нет физически, ни одного из трёх событий телефон не
   пришлёт. Переезд на Pointer Events закрывает это одним заходом: мышь, палец
   и перо приходят одним и тем же типом событий с одинаковыми clientX/Y и
   movementX/Y, и весь код перетаскивания и клика остаётся ровно тем же кодом.
   Отдельно нужен только жест, у мыши не существующий, — щипок для зума.      */
const _pointers = new Map();               // id -> {x, y}: активные пальцы/мышь
let _pinchD0 = 0, _pinchZ0 = 1;

function pinchDist() {
  const pts = [..._pointers.values()];
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

CV.addEventListener('pointerdown', e => {
  /* Записываем палец ПЕРВЫМ делом. setPointerCapture кидает исключение в
     части браузеров/устройств (и во всех синтетических событиях — так это и
     нашлось), а исключение в середине обработчика обрывает его — тогда
     _pointers.set() ниже просто не выполнялся, и второй палец щипка никогда
     не попадал в карту. Само перетаскивание при этом не ломалось, потому что
     оно живёт в отдельной переменной drag, а вот распознавание щипка — только
     через _pointers, так что зум молча переставал работать на части устройств. */
  _pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { CV.setPointerCapture(e.pointerId); } catch (err) {}
  /* 28.08: щипок двумя пальцами теперь начинается и в гараже, от его
     собственного масштаба. Начатое одним пальцем перетаскивание рига при этом
     сбрасывается — иначе риг уезжал вместе с зумом. */
  if (_pointers.size === 2 && (scene === 'city' || scene === 'world' || scene === 'garage')) {
    _pinchD0 = pinchDist();
    _pinchZ0 = scene === 'city' ? zoomT : scene === 'garage' ? (Number(window.garZoom) || 1) : wZoom;
    drag = null; wDrag = null; rigDrag = null;
    return;
  }
  if (_pointers.size > 1) return;          // третий палец и далее игнорируем
  if (scene === 'garage') {
    /* clientX/clientY относятся к окну браузера, а hitbox ASIC — к canvas.
       При панели, зуме браузера или safe-area они расходились, из-за чего
       красивый риг был виден, но не ловил перетаскивание. */
    const rect = CV.getBoundingClientRect();
    if (garagePointerDown(e.clientX - rect.left, e.clientY - rect.top)) { CV.classList.add('drag'); return; }
    return;
  }
  if (scene === 'world') { worldMouseDown(e); CV.classList.add('drag'); return; }
  if (scene !== 'city') return;
  drag = { x: e.clientX - panXT, y: e.clientY - panYT, moved: 0 }; CV.classList.add('drag');
});
addEventListener('pointermove', e => {
  if (_pointers.has(e.pointerId)) _pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (scene === 'garage' && rigDrag) {
    const rect = CV.getBoundingClientRect();
    garagePointerMove(e.clientX - rect.left, e.clientY - rect.top); return;
  }
  if (_pointers.size === 2 && scene === 'garage') {
    window.garZoom = Math.max(1, Math.min(2.2, _pinchZ0 * pinchDist() / Math.max(1, _pinchD0)));
    return;
  }
  if (_pointers.size === 2 && (scene === 'city' || scene === 'world')) {
    const pts = [..._pointers.values()];
    const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
    if (scene === 'city') {
      const z = Math.max(.5, Math.min(ZOOM_MAX, _pinchZ0 * pinchDist() / Math.max(1, _pinchD0)));
      panXT = cx - (cx - panXT) * z / zoomT;
      panYT = cy - (cy - panYT) * z / zoomT;
      zoomT = z;
      scheduleStaticQuality(z);
    } else {
      const z = Math.max(.32, Math.min(1.6, _pinchZ0 * pinchDist() / Math.max(1, _pinchD0)));
      wPanX = cx - (cx - wPanX) * z / wZoom;
      wPanY = cy - (cy - wPanY) * z / wZoom;
      wZoom = z;
    }
    return;
  }
  // v7.1: на большой карте мышь вообще не обрабатывалась — worldMouseMove была
  // объявлена, но не подключена, поэтому карта не таскалась и районы не
  // подсвечивались под курсором.
  if (scene === 'world') { worldMouseMove(e); return; }
  if (scene === 'city' && !drag) {                  // квартал под курсором
    const x = (e.clientX - panX) / zoom - S_OX, y = (e.clientY - panY) / zoom - S_OY;
    const i = Math.floor((y / (TH / 2) + x / (TW / 2)) / 2 + .5);
    const j = Math.floor((y / (TH / 2) - x / (TW / 2)) / 2 + .5);
    hoverD = distAt(i, j);
    CV.style.cursor = hoverD ? 'pointer' : 'grab';
  }
  if (!drag) return;
  drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
  panXT = e.clientX - drag.x; panYT = e.clientY - drag.y;
  panX = panXT; panY = panYT;                      // при перетаскивании — без задержки
});
function pointerUp(e) {
  _pointers.delete(e.pointerId);
  if (_pointers.size >= 1) return;          // отпустили один палец из щипка — не кликаем
  /* 27.08: этот обработчик висит на ОКНЕ, а не на канве, — иначе карта,
     отпущенная за её краем, оставалась приклеенной к курсору. Из-за этого
     клик по панели района доходил сюда как клик по КАРТЕ: под панелью в
     правом верхнем углу лежит ТЭЦ, worldClick выбирал её, и кнопка «Войти в
     район» (её onclick срабатывает уже ПОСЛЕ pointerup) уводила в ТЭЦ вместо
     выбранного района. В виде города так же выбирался квартал под панелью.
     Перетаскивание завершаем всегда, но кликом считаем только то, что
     отпущено на самой канве. */
  if (e.target !== CV) {
    if (scene === 'garage') garagePointerUp();
    wDrag = null; drag = null; CV.classList.remove('drag');
    return;
  }
  if (scene === 'garage') {
    const wasDraggingRig = garagePointerUp();
    if (!wasDraggingRig) {
      const rect = CV.getBoundingClientRect();
      garageClick(e.clientX - rect.left, e.clientY - rect.top);
    }
    CV.classList.remove('drag');
    return;
  }
  if (scene === 'world') { worldClick(e); wDrag = null; CV.classList.remove('drag'); return; }
  if (scene === 'garage') { garageClick(e.clientX, e.clientY); return; }
  if (drag && drag.moved < 6) clickAt(e.clientX, e.clientY);
  drag = null; CV.classList.remove('drag');
}
addEventListener('pointerup', pointerUp);
addEventListener('pointercancel', pointerUp);
addEventListener('keydown', e => { if (e.key === 'Escape' && scene === 'garage') exitGarage(); });
/* 28.08: шаг зума от величины прокрутки, а не «одно событие — один шаг».
   Трекпад macOS шлёт на один жест несколько десятков событий wheel с
   инерцией; при постоянном множителе 1.12 масштаб за свайп улетал в упор.
   deltaMode приводим к пикселям, один рывок ограничиваем. Для обычной мыши
   (deltaY около 100) множитель остаётся прежним: 1.127 / 0.887. */
function wheelZoomStep(e) {
  let d = Number(e.deltaY) || 0;
  if (e.deltaMode === 1) d *= 16;
  else if (e.deltaMode === 2) d *= 100;
  d = Math.max(-120, Math.min(120, d));
  return Math.exp(-d * 0.0012);
}
CV.addEventListener('wheel', e => {
  e.preventDefault();
  /* 28.08: в гараже колесо не делало ничего — этот обработчик выходил на
     scene !== 'city', а обработчик мира на scene !== 'world'. */
  if (scene === 'garage') {
    window.garZoom = Math.max(1, Math.min(2.2, (Number(window.garZoom) || 1) * wheelZoomStep(e)));
    return;
  }
  if (scene !== 'city') return;
  const z = Math.max(.5, Math.min(ZOOM_MAX, zoomT * wheelZoomStep(e)));
  panXT = e.clientX - (e.clientX - panXT) * z / zoomT;
  panYT = e.clientY - (e.clientY - panYT) * z / zoomT;
  zoomT = z;
  scheduleStaticQuality(z);
}, { passive: false });

/* клик: экран -> тайл -> квартал */
let selected = null;
function clickAt(sx, sy) {
  const hit = hitTag(sx, sy);              // сперва проверяем метки жильцов — они поверх квартала
  if (hit) { scoutOpen(hit.d, hit.t); return; }
  const x = (sx - panX) / zoom - S_OX, y = (sy - panY) / zoom - S_OY;
  const i = Math.floor((y / (TH / 2) + x / (TW / 2)) / 2 + .5);
  const j = Math.floor((y / (TH / 2) - x / (TW / 2)) / 2 + .5);
  const d = distAt(i, j);
  const panel = document.getElementById('panel');
  if (!d) { panel.style.display = 'none'; selected = null; return; }
  if (flagPlacementMode) {
    if (!flagPlacementTargets(0).includes(d)) { toast(window.MP && window.MP.connected ? 'Choose a neutral block connected to the crew flag line.' : 'Ставить флаг можно только на нейтральной земле у границы общака.'); return; }
    if (startFlagBuild(d, flagPlacementMode.price)) {
      panel.style.display = 'none'; selected = null;
      if (typeof gangRender === 'function') gangRender();
    }
    return;
  }
  /* Второй клик по своему кварталу — быстрый вход. Первый оставляет детали
     открытыми, чтобы игрок всё ещё видел пыль, склад и кнопку. */
  if (d.mine && selected === d) { enterGarage(); return; }
  selected = d;
  document.getElementById('p-type').textContent = tr(
    d.type === 'hotel' ? 'под защитой админа' : d.type === 'wind' ? 'площадка кита' : 'квартал');
  document.getElementById('p-name').textContent = d.name;
  /* Тот же неизвестный слот: панель квартала не должна падать от клика по
     чужому флагу, пока таблица банд в пути. */
  const ownerGang = d.gang >= 0 ? (GANGS[d.gang] || { name: tr('чужая банда'), c: '#f5c542' }) : null;
  document.getElementById('p-gang').textContent = ownerGang ? ownerGang.name : tr('нейтрально');
  document.getElementById('p-gang').style.color = ownerGang ? ownerGang.c : 'var(--dim)';
  /* Свой гараж считается по-настоящему: там сидишь ты, и хешрейт тот самый,
     что падает от пыли. Чужие кварталы — сгенерированный, но постоянный
     состав: город не должен меняться от того, что по нему кликнули.        */
  const pop = d.mine ? 1 : d.pop;
  const hash = d.mine ? Math.round(gar.hash * garEff()) : d.hash;
  document.getElementById('p-pop').textContent = pop === 1 ? tr('только ты') : tr(pop + ' чел.');
  document.getElementById('p-hash').textContent = hash.toLocaleString('ru') + ' TH';
  document.getElementById('p-power').textContent = tr(d.power + '% добычи');
  document.getElementById('p-risk').textContent = tr(d.risk + '%/день');
  document.getElementById('p-store').textContent = Math.round(d.store).toLocaleString('ru') + ' BAND';
  const raidBtn = document.getElementById('p-raid');
  if (activeRally && activeRally.target === d) {
    raidBtn.textContent = '🤝 ' + tr('Усилить ралли');
  } else if (d.type === 'hotel') {
    raidBtn.textContent = '⚔ ' + tr('Борьба за отель');
  } else if (d.type === 'wind') {
    raidBtn.textContent = '⚔ ' + tr('Собрать ралли');
  } else if (d.gang === 0 && !d.mine && d.flagState === 'burning') {
    raidBtn.textContent = '🔧 ' + tr('Ремонт флага');
  } else if (d.flagState === 'building') {
    raidBtn.textContent = '👷 ' + tr('Помочь стройке');
  } else if (d.gang === 0 && !d.mine) {
    raidBtn.textContent = d.flagState === 'burning'
      ? `🔧 Ремонт · ${Math.ceil(flagHp(d))}/100`
      : `🛡 ${tr('Гарнизон')} · ${d.garrison || 0}/${flagGarrisonCap()}`;
  } else {
    raidBtn.textContent = d.mine ? '🔧 ' + tr('Войти в гараж') : '⚔ ' + tr('Напасть');
  }
  const crew = document.getElementById('p-crew');
  if (d.mine) {
    crew.innerHTML = `<div class="m"><span>${tr('ТЫ')} · ${gar.hired.length ? gar.hired.map(m => tr(m.name)).join(', ') : tr('без людей')}</span>`
      + `<b>${hash.toLocaleString('ru')} TH</b></div>`
      + `<div class="more">пыль ${Math.round(gar.dust * 100)}% · склад ур. ${gar.wh} прячет `
      + `${Math.round(Math.min(d.store, whProtected())).toLocaleString('ru')} BAND</div>`;
  } else {
    /* Просьба (13.08): хешрейт чужих жильцов убран отсюда же, где и с карты —
       иначе панель квартала выдаёт то, за что должна платить разведка. */
    crew.innerHTML = d.crew.map(m =>
      `<div class="m"><span>${tr(m.n)}</span></div>`).join('')
      + (d.pop > d.crew.length
         ? `<div class="more">и ещё ${d.pop - d.crew.length} чел. помельче</div>` : '');
  }
  if (!d.mine && d.gang === 0) {
    crew.innerHTML += `<div class="more">⚑ флаг: ${d.flagState === 'burning' ? `горит · ${Math.ceil(flagHp(d))}/100` : 'исправен'} · гарнизон ${d.garrison || 0}/${flagGarrisonCap()}</div>`;
  }
  raidBtn.disabled = false;
  panel.style.display = 'block';
}
document.getElementById('p-raid').onclick = () => {
  if (!selected) return;
  if (selected.mine) { enterGarage(); return; }
  /* Отель ведёт ТОЛЬКО в KvK-панель (открывает слушатель в map.html);
     ралли по клику на отель убрано — заявка только внутри панели (kvk-go). */
  if (selected.type === 'hotel') return;
  if (selected.gang === 0 && selected.flagState === 'burning') {
    if (window.MP && window.MP.connected) {
      const provinceIdx = Number(window.activeWorldProvinceIdx), targetIdx = districts.indexOf(selected);
      window.MP.send('repair_crew_flag', { provinceIdx, targetIdx });
      toast('Flag repair request sent to the crew server.');
    } else repairFlag(selected);
    return;
  }
  if (selected.flagState === 'building') { helpFlagBuild(selected); return; }
  if ((activeRally && activeRally.target === selected) || selected.type === 'wind') { startRally(selected); return; }
  if (selected.gang === 0 && !selected.mine) { reinforceFlag(selected); return; }
  launchMarch(MINE, selected);
};

/* ===================== РАЗВЕДКА И НАПАДЕНИЕ НА ЖИЛЬЦА =====================
   Просьба (13.08): каждого, кого видно на приближённой карте, можно разведать
   и посмотреть его гараж/квартиру, а потом решить — напасть. Исход не
   рандомный, как и было сказано: чьё хешрейт выше, тот и забирает. Награда и
   потеря считаются от «суточной добычи» жильца — той же формулы, что и для
   игрока (DAY_YIELD * TH / HASH_REF), чтобы цифры не были взяты с потолка. */
const NPC_FLAVOR = {
  garage: ['Ворота приоткрыты, изнутри тянет тёплым воздухом и гулом вентиляторов.',
           'Свет из щели ворот дрожит — стойка асиков молотит без остановки.',
           'На воротах меловая закорючка — свои узнают, чужим лучше не соваться.'],
  dock: ['За ржавой дверью склада гудят вентиляторы — среди бочек спрятана стойка асиков.',
         'На въезде свежий след погрузчика, а из щели в стене торчит удлинитель к рижу.',
         'Пахнет солью и горячим текстолитом — ферма стоит прямо между поддонов.'],
  factory: ['За стальными воротами цеха ровный гул станков — и ещё один, потише, ровнее.',
            'Из вентиляции цеха тянет не гарью, а горячим пластиком — обычная примета фермы.',
            'На проходной цеха список смен, а в углу за станками — своя стойка асиков.'],
  scrap: ['Среди прессованных кузовов спрятан генератор — гудит тише, чем пресс, но ровнее.',
          'На воротах скрап-площадки амбарный замок для виду — щель под ним для кабеля к рижу.',
          'Из вагончика приёмщика тянет паяльником, а не металлоломом — там своя стойка асиков.'],
  plant: ['За дверью подстанции гудят не только трансформаторы — есть и свой, потише.',
          'Кабель от щита уходит не наружу, а в сторону — кто-то подключился в обход счётчика.',
          'На двери энергоузла табличка «высокое напряжение», а из щели тянет тёплым воздухом.'],
  quarry: ['В будке весовщика горит свет допоздна — считает не только тонны щебня.',
           'За дверью карьерного сарая пыльный генератор кормит что-то потише экскаватора.',
           'На двери участка список смен, а рядом — самодельная стойка под тентом от пыли.'],
  hangar: ['За воротами ангара гудит не только компрессор — есть звук и потише, ровнее.',
           'На двери техсклада список бортов, а в углу за ящиками — своя стойка асиков.',
           'Из щели ангарных ворот тянет тёплым воздухом сильнее, чем от одной лампы.'],
  apart: ['За шторой горит настольная лампа и синеет монитор фермы на столе.',
          'Балкон завален проводами — судя по всему, ферма не помещается в комнату.',
          'Форточка открыта настежь: асики греют квартиру лучше батарей.'],
  hotel: ['Гость с ноутбуком в лобби — судя по вентилятору у розетки, тоже майнит.',
          'В номере на верхнем этаже не выключают свет — там ферма, а не кровать.'],
  shop: ['Витрина закрыта решёткой, но за ней ровным рядом мигают диоды.',
         'Над входом — та же вывеска, что и у соседей: франшиза кооператива.'],
  junk: ['Ржавый вагончик на пустыре, из щели в стене торчит удлинитель.',
         'Кустарная стойка под тентом — работает на честном слове и такте разгона.'],
};
const npcYield = th => Math.round(DAY_YIELD * th / HASH_REF);
const RAID_COOLDOWN_MS = 4 * 60 * 1000;   // 4 минуты реального времени
/* Просьба (13.08, продолжение): налёт игрок-на-игрока не бесплатен и не
   показывает шансы сразу. Разведка (SCOUT_COST) платно раскрывает хешрейт
   цели и точный расклад win/lose; можно и пропустить разведку и напасть
   вслепую — риск/награда те же самые (детерминированные по хешрейту), просто
   игрок узнаёт результат по факту, а не заранее. Атака сама по себе всегда
   стоит RAID_ATTACK_COST — это отдельная статья расхода поверх выигрыша или
   проигрыша, а не часть их суммы. Сами константы объявлены ниже, у D() и
   MERC_HIRE — здесь их только читаем внутри функций, к моменту клика игрока
   скрипт уже весь выполнился и D() точно существует. */
let scoutTarget = null;
let scoutRevealed = false;
const scoutEl = document.getElementById('scout');

function scoutOpen(d, t) {
  scoutTarget = { d, t };
  scoutRevealed = false;
  scoutRenderModal();
  scoutEl.classList.add('on');
}

function scoutRenderModal() {
  if (!scoutTarget) return;
  const { d, t } = scoutTarget;
  const m = t.crew;
  const kind = t.b ? t.b.kind : (d.type === 'hotel' ? 'hotel' : 'garage');
  const pool = NPC_FLAVOR[kind] || NPC_FLAVOR.garage;
  const seed = (m.n.length * 7 + (t.b ? Math.round(t.b.seed * 997) : d.bi * 3 + d.bj * 5));
  const flavor = pool[seed % pool.length];
  const sprite = t.b ? buildSprite(t.b) : null;
  const myHash = Math.round(gar.hash * garEff());
  const cooling = m.raidUntil > Date.now();
  const isMine = !!d.mine;
  const take = Math.min(m.wallet || 0, npcYield(m.th) * .5 | 0);
  const cost = Math.min(Math.round(MY.band), Math.round(dayYield() * .35));
  const left = raidsLeft();
  const limitHit = left <= 0;

  let statRow = '', odds, actions;
  if (isMine) {
    odds = `<div class="odds neutral">Свой человек — часть твоей команды, не враг.</div>`;
    actions = `<button class="btn alt" id="scout-leave">Уйти</button>`;
  } else if (limitHit) {
    odds = `<div class="odds neutral">Лимит налётов на сегодня исчерпан: ${RAID_DAILY_LIMIT}/${RAID_DAILY_LIMIT}. Возвращайся после сброса.</div>`;
    actions = `<button class="btn alt" id="scout-leave">Уйти</button>`;
  } else if (cooling) {
    const minLeft = Math.max(1, Math.ceil((m.raidUntil - Date.now()) / 60000));
    odds = `<div class="odds neutral">Недавно уже наведывался — насторожен ещё ${minLeft} мин.</div>`;
    actions = `<button class="btn alt" id="scout-leave">Уйти</button>`;
  } else if (scoutRevealed) {
    statRow = `<div class="stat"><span>его хешрейт</span><b style="color:var(--acc)">${m.th.toLocaleString('ru')} TH</b></div>`;
    odds = myHash > m.th
      ? `<div class="odds win">Твой хешрейт выше — заберёшь ≈${take.toLocaleString('ru')} BAND.</div>`
      : `<div class="odds lose">Хешрейта не хватает — потеряешь ≈${cost.toLocaleString('ru')} BAND.</div>`;
    actions = `<button class="btn alt" id="scout-leave">Уйти</button>
      <button class="btn" id="scout-attack">⚔ Напасть · ${RAID_ATTACK_COST.toLocaleString('ru')} BAND</button>`;
  } else {
    statRow = `<div class="stat"><span>его хешрейт</span><b style="color:var(--dim)">???</b></div>`;
    odds = `<div class="odds neutral">Сколько заберёшь или потеряешь — неизвестно, пока не разведаешь или не рискнёшь вслепую.</div>`;
    actions = `<button class="btn alt" id="scout-leave">Уйти</button>
      <button class="btn alt" id="scout-reveal">🔍 Разведать · ${SCOUT_COST.toLocaleString('ru')} BAND</button>
      <button class="btn" id="scout-attack-blind">⚔ Напасть вслепую · ${RAID_ATTACK_COST.toLocaleString('ru')} BAND</button>`;
  }

  const el = document.getElementById('scout-in');
  el.innerHTML = `
    <div class="av">${sprite ? `<img src="${sprite.src}">` : '⛏'}</div>
    <h2>${m.n}</h2>
    <div class="loc">${d.name} · <span>${d.gang >= 0 ? mgEsc(GANGS[d.gang] && GANGS[d.gang].name) : 'нейтрально'}</span></div>
    <div class="flavor">${flavor}</div>
    <div class="stat"><span>твой хешрейт</span><b style="color:var(--acc)">${myHash.toLocaleString('ru')} TH</b></div>
    ${statRow}
    <div class="stat"><span>налётов осталось</span><b style="color:var(--amber)">${Math.max(0, left)} / ${RAID_DAILY_LIMIT}</b></div>
    ${odds}
    <div class="btnrow">${actions}</div>`;
  const leave = document.getElementById('scout-leave'); if (leave) leave.onclick = scoutClose;
  const reveal = document.getElementById('scout-reveal'); if (reveal) reveal.onclick = scoutReveal;
  const atk = document.getElementById('scout-attack'); if (atk) atk.onclick = () => scoutAttack(false);
  const atkBlind = document.getElementById('scout-attack-blind'); if (atkBlind) atkBlind.onclick = () => scoutAttack(true);
}

function scoutReveal() {
  if (!scoutTarget) return;
  if (MY.band < SCOUT_COST) { SFX.fail(); toast(`Не хватает BAND на разведку: нужно ${SCOUT_COST.toLocaleString('ru')}, есть ${Math.round(MY.band).toLocaleString('ru')}.`); return; }
  MY.band -= SCOUT_COST; gar.burned += SCOUT_COST;
  scoutRevealed = true;
  SFX.click();
  scoutRenderModal();
}

function scoutClose() { scoutEl.classList.remove('on'); scoutTarget = null; scoutRevealed = false; }
document.getElementById('scout-close').onclick = scoutClose;

function scoutAttack(blind) {
  if (!scoutTarget) return;
  const { d, t } = scoutTarget;
  const m = t.crew;
  if (d.mine || m.raidUntil > Date.now()) return;
  if (raidsLeft() <= 0) { toast(`Лимит налётов на сегодня исчерпан: ${RAID_DAILY_LIMIT}/${RAID_DAILY_LIMIT}.`); scoutClose(); return; }
  if (MY.band < RAID_ATTACK_COST) { SFX.fail(); toast(`Не хватает BAND на налёт: нужно ${RAID_ATTACK_COST.toLocaleString('ru')}, есть ${Math.round(MY.band).toLocaleString('ru')}.`); return; }
  MY.band -= RAID_ATTACK_COST; gar.burned += RAID_ATTACK_COST;
  gar.raidCount++;
  gar.raidsMade = (gar.raidsMade || 0) + 1;
  const myHash = Math.round(gar.hash * garEff());
  m.raidUntil = Date.now() + RAID_COOLDOWN_MS;
  if (myHash > m.th) {
    const take = Math.min(m.wallet || 0, npcYield(m.th) * .5 | 0);
    m.wallet = Math.max(0, (m.wallet || 0) - take);
    MY.band += take;
    gar.earned = (gar.earned || 0) + take;
    SFX.coins();
    evShow('bg_flag.jpg', 'НАЛЁТ УДАЧЕН', `${m.n} не устоял против ${myHash.toLocaleString('ru')} TH — забрано ${take.toLocaleString('ru')} BAND.`);
    logEvent('out', `Напал на ${m.n}${blind ? ' вслепую' : ''} — забрал ${take.toLocaleString('ru')} BAND.`, true);
  } else {
    const cost = Math.min(Math.round(MY.band), Math.round(dayYield() * .35));
    MY.band -= cost;
    SFX.fail();
    toast(`${m.n} отбился — у него ${m.th.toLocaleString('ru')} TH против твоих ${myHash.toLocaleString('ru')}. Потеряно ${cost.toLocaleString('ru')} BAND.`);
    logEvent('out', `Напал на ${m.n}${blind ? ' вслепую' : ''} — отбился, потерял ${cost.toLocaleString('ru')} BAND.`, false);
  }
  scoutClose();
}

/* ===================== КАРТОЧКА СОБЫТИЯ ==================================
   Тост в углу годится для «собрано 400 BAND», но не для того, что случается
   раз за игру: своя банда, первый флаг, поднятый щит. Такие моменты должны
   чем-то отличаться от текучки, иначе игрок их просто не заметит. Карточка
   показывает сгенерированную сцену минимум 30 секунд или до закрытия самим
   игроком — важный результат нельзя потерять за пару кадров.               */
function evShow(pic, title, text, ms = 30000) {
  const c = document.getElementById('evcard');
  if (!c) return;
  /* 27.08 (Claude): карточки событий тоже берут WebP — фоны здесь ставятся
     через CSS, где onerror-отката нет, поэтому все эти файлы гарантированно
     присутствуют в наборе. */
  c.querySelector('.pic').style.backgroundImage =
    `url(art/sprites/${pic.replace(/\.(png|jpe?g)$/i, '.webp')})`;
  c.querySelector('h3').textContent = tr(title);
  c.querySelector('p').textContent = tr(text);
  const actions = c.querySelector('.actions');
  if (actions) {
    actions.innerHTML = '<button type="button">Close</button>';
    actions.firstElementChild.onclick = () => { clearTimeout(c._h); c.classList.remove('on'); };
  }
  c.classList.add('on');
  clearTimeout(c._h);
  c._h = setTimeout(() => c.classList.remove('on'), ms);
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = tr(msg); t.style.display = 'block';
  clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', 3500);
}

/* ============================== АРЕНА ====================================
   Сезонный рейтинг банд: приз — титул и рамка, НЕ деньги. Рейтинг не печатает
   монету, он только заставляет банды чаще воевать и больше жечь (v3.7).      */
const arenaEl = document.getElementById('arena');
const arenaW = document.getElementById('arenaw');
document.getElementById('abtn').onclick = () => {
  arenaW.classList.add('on');
  /* Рейтинг тянем при каждом открытии: сезонная таблица должна быть свежей,
     а не такой, какой была на прошлом заходе. */
  ARENA_VIEW.crews = null;
  arenaBigRender();
  void arenaLoadRanking();
  if (typeof MP !== 'undefined' && MP.connected) MP.send('crew_lobby_request', {});
};
document.getElementById('arenaw-close').onclick = () => arenaW.classList.remove('on');
arenaW.addEventListener('mousedown', e => { if (e.target === arenaW) arenaW.classList.remove('on'); });
addEventListener('keydown', e => { if (e.key === 'Escape') arenaW.classList.remove('on'); });

/* Герб игрока живёт в канвасе, а канвас с картинками из file:// «испорчен»
   для toDataURL — браузер запрещает вытащить пиксели. Поэтому в разметку
   кладём пустой канвас и дорисовываем в него после вставки. */
function crestImg(gang) {
  if (gang === 0 && MY.crest)
    return `<canvas class="crest-mini" data-gang="0" width="68" height="68"
             style="width:34px;height:34px"></canvas>`;
  const im = [ART.symWolf, ART.symAnchor, ART.symRing][gang % 3];
  return im && im.src
    ? `<img src="${im.src}" style="width:34px;height:34px;object-fit:contain">` : '';
}
function paintMiniCrests(root) {
  for (const cv of root.querySelectorAll('canvas.crest-mini')) {
    if (MY.gang) drawCrest(cv, MY.gang, 68);
    cv.style.width = cv.style.height = '34px';
  }
}

/* Панель арены. В СЕТЕВОЙ игре таблица — это настоящий серверный рейтинг
   банд (/api/leaderboard: репутация участников + районы + флаги + казна),
   а не локальные очки, которые раньше дрейфовали случайно и у всех, кроме
   трёх демо-банд, были нулями. Запись в сезон тоже настоящая: сервер снимает
   взнос с казны и отмечает банду. Офлайн-режим остаётся как был. */
let ARENA_VIEW = { loading: false, crews: null, error: '' };
function arenaState() {
  return (typeof CREW_LOBBY !== 'undefined' && CREW_LOBBY && CREW_LOBBY.arena) || null;
}
async function arenaLoadRanking() {
  if (typeof remoteProfile !== 'function' || !remoteProfile()) return;
  ARENA_VIEW.loading = true; ARENA_VIEW.error = '';
  try {
    const data = await serverRequest('/leaderboard', 'GET', undefined, null);
    ARENA_VIEW.crews = Array.isArray(data && data.crews) ? data.crews : [];
  } catch (err) {
    ARENA_VIEW.error = (err && err.message) || 'Рейтинг недоступен.';
    ARENA_VIEW.crews = [];
  }
  ARENA_VIEW.loading = false;
  if (arenaW.classList.contains('on')) arenaBigRender();
}
function arenaBigRender() {
  const el = document.getElementById('arenaw-in');
  document.getElementById('arenaw-wrap').style.backgroundImage = 'url(art/sprites/bg_arena_win.webp)';
  const online = typeof remoteProfile === 'function' && remoteProfile();
  const st = arenaState();
  const endsAt = st && st.seasonEnd ? st.seasonEnd : SEASON_END;
  const left = Math.max(0, endsAt - Date.now());
  const dd = left / 86400000 | 0, hh = (left % 86400000) / 3600000 | 0;
  const mine = MY.gang;
  const fee = st && st.fee ? st.fee : ARENA_FEE;
  const entered = st ? !!st.entered : !!(mine && mine.arena);
  const treasury = st && st.treasury ? st.treasury : Number((mine && mine.treasury) || 0);

  let rows;
  if (online) {
    if (ARENA_VIEW.loading || ARENA_VIEW.crews === null) rows = '<div class="cost">Загружаю серверный рейтинг…</div>';
    else if (ARENA_VIEW.error) rows = `<div class="cost">${mgEsc(ARENA_VIEW.error)}</div>`;
    else if (!ARENA_VIEW.crews.length) rows = '<div class="cost">Пока ни одна банда не набрала очков.</div>';
    else rows = ARENA_VIEW.crews.map((c, pl) => {
      const isMine = mine && mine.name && c.name === mine.name;
      const inSeason = Number(c.arenaSeason || 0) > 0;
      return `
        <div class="mem" style="${isMine ? 'outline:1px solid var(--gold)' : ''}">
          <b style="width:20px;color:${pl === 0 ? 'var(--gold)' : 'var(--dim)'};font-size:15px">${pl + 1}</b>
          <div><div class="nm" style="color:${mgEsc(c.color || '#f5c542')}">${mgEsc(c.name)}${isMine ? ' · ты' : ''}</div>
               <div class="rl">${Number(c.memberCount || 0)} чел. · ${Number(c.territory || 0)} районов · ${Number(c.flags || 0)} флагов${inSeason ? ' · <span style="color:var(--green)">в сезоне</span>' : ''}</div></div>
          <b style="margin-left:auto;color:var(--gold)">${Math.round(Number(c.total || 0)).toLocaleString('ru')}</b>
        </div>`;
    }).join('');
  } else {
    const order = GANGS.map((g, k) => ({ ...g, k })).sort((a, b) => b.score - a.score);
    rows = order.map((g, pl) => `
      <div class="mem" style="${g.k === 0 ? 'outline:1px solid var(--gold)' : ''}">
        <b style="width:20px;color:${pl === 0 ? 'var(--gold)' : 'var(--dim)'};font-size:15px">${pl + 1}</b>
        ${crestImg(g.k)}
        <div><div class="nm">${mgEsc(tr(g.name))}${g.k === 0 ? ' · ты' : ''}</div>
             <div class="rl">${g.k === 0 && mine ? (entered ? 'взнос уплачен' : 'не записаны в сезон') : 'записаны'}</div></div>
        <b style="margin-left:auto;color:var(--gold)">${g.score.toLocaleString('ru')}</b>
      </div>`).join('');
  }

  const canEnter = !!mine && !entered && left > 0 && treasury >= fee;
  const enterLabel = !mine ? 'Сначала создай банду'
    : entered ? 'Банда записана в сезон'
    : left <= 0 ? 'Сезон закрыт'
    : treasury < fee ? `Мало в казне: ${Math.round(treasury).toLocaleString('ru')} из ${fee.toLocaleString('ru')} BAND`
    : `Записаться в сезон · ${fee.toLocaleString('ru')} BAND`;

  el.innerHTML = `
  <h2>АРЕНА <span>· СЕЗОН ${st && st.season ? st.season : 1}</span></h2>
  <div class="sub">до конца сезона ${dd}д ${hh}ч · приз — титул и рамка, не деньги</div>
  <div class="cols">
    <div class="col">
      <div class="box">
        <div class="lbl">таблица сезона</div>
        ${rows}
        <div class="cost" style="margin-top:10px">${online
          ? 'Место считает сервер: репутация участников, районы, флаги и казна. Локально это число подделать нельзя.'
          : 'Очки капают с добычи маршей. Взнос сезона сгорает — арена жжёт монету, а не печатает её.'}</div>
      </div>
    </div>
    <div class="col">
      <div class="box">
        <div class="lbl">участие в сезоне</div>
        <div class="stat"><span>казна банды</span><b>${Math.round(treasury).toLocaleString('ru')} BAND</b></div>
        <div class="stat"><span>взнос</span><b>${fee.toLocaleString('ru')} BAND</b></div>
        <div class="stat"><span>статус</span><b style="color:${entered ? 'var(--green)' : 'var(--amber)'}">${entered ? 'в сезоне' : 'не записаны'}</b></div>
        <button class="btn" id="a-enter" ${canEnter ? '' : 'disabled'}>${enterLabel}</button>
        <div class="cost" style="margin-top:8px">Взнос сгорает и не достаётся никому. Записывает только главарь.
          В таблице записанные банды помечены — титул сезона разыгрывается между ними.</div>
      </div>
      <div class="box">
        <div class="lbl">дом сезона</div>
        <div class="stat"><span>отель держит</span><b style="color:${KVK.owner >= 0 ? GANGS[KVK.owner].c : 'var(--dim)'}">${KVK.owner >= 0 ? GANGS[KVK.owner].name : 'никто'}</b></div>
        <div class="stat"><span>недель подряд</span><b>${KVK.held}</b></div>
        <div class="stat"><span>коек занято</span><b>${KVK.taken} / ${KVK.beds}</b></div>
        ${KVK.log.map(w => `<div class="mem"><div class="rl" style="width:100%">
            ${w.w} — недель во главе: ${w.n}</div></div>`).join('')}
        <button class="btn" id="a-kvk">Перейти к борьбе за отель</button>
      </div>
    </div>
  </div>`;
  paintMiniCrests(el);
  const kb = document.getElementById('a-kvk');
  if (kb) kb.onclick = () => { arenaW.classList.remove('on'); kvkOpen(); };
  const eb = document.getElementById('a-enter');
  if (eb && canEnter) eb.onclick = () => {
    if (online) {
      if (!MP.connected) return toast('Connect to the game server first.');
      eb.disabled = true;
      MP.send('arena_enter', {});
      return;
    }
    /* Офлайн: как было — списываем из локальной казны. */
    if (mine.treasury < fee) return toast('Казна не тянет взнос сезона.');
    mine.treasury -= fee; mine.spent.arena += fee; mine.arena = true;
    toast(`Банда записана в сезон. ${fee.toLocaleString('ru')} BAND сожжено.`);
    arenaBigRender();
  };
}
function renderArena() {
  if (arenaEl.style.display !== 'block') return;
  const left = Math.max(0, SEASON_END - Date.now());
  const dd = left / 86400000 | 0, hh = (left % 86400000) / 3600000 | 0;
  document.getElementById('a-season').textContent =
    `до конца сезона ${dd}д ${hh}ч · приз: титул и рамка`;
  const order = GANGS.map((g, k) => ({ ...g, k })).sort((a, b) => b.score - a.score);
  document.getElementById('a-rows').innerHTML = order.map((g, pl) =>
    `<div class="row${g.k === 0 ? ' me' : ''}">
       <span class="place">${pl + 1}</span>
       <span class="dot" style="background:${g.c};box-shadow:0 0 6px ${g.c}"></span>
       ${mgEsc(tr(g.name))}${g.k === 0 ? ' · ты' : ''}
       <span class="score">${g.score.toLocaleString('ru')}</span>
     </div>`).join('');
}
setInterval(renderArena, 1000);

/* легенда банд */
document.getElementById('legend').innerHTML = GANGS.map(g =>
  `<div class="gang"><div class="dot" style="background:${g.c};box-shadow:0 0 6px ${g.c}"></div>${g.name}</div>`).join('');

/* ============================== ЦИКЛ ===================================== */
let T = 0;
/* Читаемая подпись на карте: тёмная обводка держит контур на любом фоне. */
function mapLabel(c, text, x, y, fill, lw = 3) {
  c.save();
  c.lineJoin = 'round';
  c.lineWidth = lw;
  c.strokeStyle = 'rgba(0,0,0,.85)';
  c.strokeText(text, x, y);
  c.fillStyle = fill;
  c.fillText(text, x, y);
  c.restore();
}

function drawCityOwnership(ox, oy) {
  const crests = [MY.crest || ART.symWolf, ART.symAnchor, ART.symRing];
  for (const d of districts) {
    if (d.gang < 0) continue;
    /* «Твой» — только если у игрока РЕАЛЬНО есть банда. До её создания слот 0
       занят ботом «СЕВЕРНЫЕ», и его территории подписывались «ТВОЙ КВАРТАЛ». */
    const mine = d.gang === 0 && !!MY.gang;
    /* 28.08: серым гасим ЛЮБОЙ отрезанный от края квартал, не только свой.
       Иначе поджигающий не видит результата собственного удара: он перерезал
       чужую линию, а на его экране она осталась прежнего цвета. */
    const active = d.flagLinked === false ? false : (!mine || isActiveTerritory(d, 0));
    /* Неизвестный слот больше не роняет отрисовку: пока не пришла таблица
       банд, чужой квартал рисуется нейтральным цветом, а не убивает весь
       слой владения вместе с флагами хозяина района. */
    const col = active ? (GANGS[d.gang] || { c: '#f5c542' }).c : '#667080';
    const corners = [[d.i0, d.j0], [d.i0 + BS, d.j0], [d.i0 + BS, d.j0 + BS], [d.i0, d.j0 + BS]];
    CX.save();
    CX.globalAlpha = mine ? .16 : .09;
    CX.fillStyle = col;
    CX.beginPath();
    corners.forEach(([ci, cj], k) => {
      const [x, y] = iso(ci - .5, cj - .5);
      k ? CX.lineTo(x + ox, y + oy) : CX.moveTo(x + ox, y + oy);
    });
    CX.closePath(); CX.fill();
    CX.globalAlpha = mine ? .9 : .72;
    CX.strokeStyle = col; CX.lineWidth = mine ? 4 : 2.5;
    CX.shadowColor = col; CX.shadowBlur = mine ? 22 : 12;
    CX.stroke(); CX.restore();

    const [cx0, cy0] = iso(d.i0 + BS / 2 - .5, d.j0 + BS / 2 - .5);
    const cx = cx0 + ox, cy = cy0 + oy - 20;
    const flagY = cy - 58;
    /* Territory and a flag are different server records. A captured block
       gets its coloured border; only a real flag row gets a pole and crest. */
    const hasFlag = d.flagState === 'active' || d.flagState === 'building' || d.flagState === 'burning';
    if (hasFlag) {
      CX.save();
      CX.strokeStyle = '#f1ead5'; CX.lineWidth = mine ? 4 : 3;
      CX.shadowColor = '#000'; CX.shadowBlur = 5;
      CX.beginPath(); CX.moveTo(cx, cy + 30); CX.lineTo(cx, flagY); CX.stroke();
      CX.fillStyle = col;
      CX.beginPath(); CX.moveTo(cx + 1, flagY + 3); CX.lineTo(cx + (mine ? 58 : 43), flagY + 15); CX.lineTo(cx + 1, flagY + 34); CX.closePath(); CX.fill();
      CX.strokeStyle = '#111522'; CX.lineWidth = 1.8; CX.stroke();
      const crest = crests[d.gang % crests.length], size = mine ? 32 : 25;
      CX.beginPath(); CX.arc(cx, flagY, size / 2, 0, 7); CX.clip();
      CX.fillStyle = '#111522'; CX.fillRect(cx - size / 2, flagY - size / 2, size, size);
      if (crest && (crest.naturalWidth || crest.width)) CX.drawImage(crest, cx - size / 2, flagY - size / 2, size, size);
      CX.restore();
      CX.save(); CX.strokeStyle = col; CX.lineWidth = 2; CX.beginPath(); CX.arc(cx, flagY, size / 2, 0, 7); CX.stroke();
    } else {
      CX.save();
    }
    if (mine) {
      CX.font = '800 11px Segoe UI'; CX.textAlign = 'center';
      mapLabel(CX, typeof LANG !== 'undefined' && LANG === 'en' ? 'YOUR BLOCK' : 'ТВОЙ КВАРТАЛ', cx, hasFlag ? flagY - 24 : cy - 10, '#f7d46a');
    }
    if (mine && !active) {
      CX.font = '800 10px Segoe UI'; CX.textAlign = 'center';
      mapLabel(CX, typeof LANG !== 'undefined' && LANG === 'en' ? 'INACTIVE' : 'ОТКЛЮЧЁН', cx, hasFlag ? flagY - 10 : cy + 5, '#c9ced8');
    }
    CX.restore();
  }
}
/* --- детали крупного зума: подписи жильцов над зданиями ---
   Проявляются плавно между ZOOM_DETAIL_MIN и ZOOM_DETAIL_FULL, размер держим
   постоянным на экране (масштаб 1/zoom), иначе на максимальном зуме таблички
   расползаются в исполинские. Дальность не ограничена кварталом игрока —
   так же можно подглядеть, кто майнит у соседей и в отеле. */
/* экранный прямоугольник подписи жильца — общий для отрисовки и клика,
   чтобы хит-тест никогда не расходился с тем, что реально нарисовано */
function tagBox(t, ox, oy) {
  const wx = t.x + ox, wy = t.y + oy;
  const sx = wx * zoom + panX, sy = wy * zoom + panY;
  CX.font = '700 10px Segoe UI, sans-serif';
  /* Просьба (13.08): хешрейт у ника на карте убран — иначе разведка перед
     налётом теряет смысл, его и так видно без разведки. Ник остаётся, чтобы
     подписи над домами не пропали совсем. */
  const label = tr(t.crew.n);
  const w = CX.measureText(label).width + 14, h = 17;
  return { wx, wy, sx, sy, w, h, label };
}

function drawZoomDetail(ox, oy) {
  if (zoom < ZOOM_DETAIL_MIN) return;
  const reveal = Math.min(1, (zoom - ZOOM_DETAIL_MIN) / (ZOOM_DETAIL_FULL - ZOOM_DETAIL_MIN));
  const marginPx = 60;
  for (const d of districts) {
    if (!d.tags || !d.tags.length) continue;
    for (const t of d.tags) {
      const b = tagBox(t, ox, oy);
      if (b.sx < -marginPx || b.sx > W + marginPx || b.sy < -marginPx || b.sy > H + marginPx) continue;
      CX.save();
      CX.translate(b.wx, b.wy);
      CX.scale(1 / zoom, 1 / zoom);
      CX.globalAlpha = reveal;
      const pulse = .5 + .5 * Math.sin(T * 2.4 + t.x * .05);
      const cooling = t.crew.raidUntil > Date.now();
      CX.fillStyle = cooling ? P.red : P.green;
      CX.beginPath(); CX.arc(0, -5, 1.8 + pulse, 0, 7); CX.fill();
      CX.fillStyle = 'rgba(10,12,20,.85)';
      CX.strokeStyle = cooling ? 'rgba(255,93,108,.4)' : 'rgba(159,216,255,.4)'; CX.lineWidth = 1;
      CX.beginPath(); CX.roundRect(-b.w / 2, -b.h - 9, b.w, b.h, 6); CX.fill(); CX.stroke();
      CX.fillStyle = '#dfe6ff';
      CX.textAlign = 'center'; CX.textBaseline = 'middle';
      CX.fillText(b.label, 0, -b.h - 9 + b.h / 2 + 1);
      CX.textBaseline = 'alphabetic';
      CX.restore();
    }
  }
  CX.globalAlpha = 1;
}

/* клик по подписи — та же геометрия, что и в drawZoomDetail, но без канвы:
   считаем сразу в экранных координатах и ищем ближайшее попадание */
function hitTag(mx, my) {
  if (zoom < ZOOM_DETAIL_MIN) return null;
  for (const d of districts) {
    if (!d.tags) continue;
    for (const t of d.tags) {
      const b = tagBox(t, S_OX, S_OY);
      const pad = 5;
      if (mx >= b.sx - b.w / 2 - pad && mx <= b.sx + b.w / 2 + pad &&
          my >= b.sy - b.h - 9 - pad - 6 && my <= b.sy - 9 + pad) return { d, t };
    }
  }
  return null;
}

/* Ночной bloom (свечение ярких мест). ВЫКЛЮЧЕН по умолчанию — включить:
   CITY_BLOOM = true (из консоли). Один half-res проход на кадр. */
let CITY_BLOOM = false;
let _bloomCv = null;
function drawCityBloom() {
  const cv = CX.canvas, w = cv.width, h = cv.height;
  if (w < 2 || h < 2) return;
  if (!_bloomCv) _bloomCv = document.createElement('canvas');
  const sw = Math.max(1, w >> 1), sh = Math.max(1, h >> 1);
  if (_bloomCv.width !== sw || _bloomCv.height !== sh) { _bloomCv.width = sw; _bloomCv.height = sh; }
  const bx = _bloomCv.getContext('2d');
  bx.clearRect(0, 0, sw, sh);
  bx.drawImage(cv, 0, 0, sw, sh);
  CX.save();
  CX.setTransform(1, 0, 0, 1, 0, 0);
  CX.globalCompositeOperation = 'lighter';
  CX.globalAlpha = 0.22;
  CX.filter = 'blur(6px)';
  CX.drawImage(_bloomCv, 0, 0, w, h);
  CX.filter = 'none';
  CX.restore();
}

function frame() {
  /* 24.08: раньше исключение в любой draw-функции (например GANGS[slot] до
     прихода gang_state) не давало дойти до requestAnimationFrame на той же
     строке — и вся анимация вставала намертво до перезагрузки. Теперь кадр
     перепланируется всегда, а ошибка логируется один раз. */
  try { frameBody(); }
  catch (e) { if (!frame._warned) { console.error('render frame error:', e); frame._warned = true; } }
  requestAnimationFrame(frame);
}

function frameBody() {
  T += 1 / 60;
  CX.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (scene === 'garage') { drawGarage(); if (!window.garage3DVisible) drawPostFX('garage'); return; }
  if (scene === 'world') { drawWorld(); drawPostFX('world'); drawRainFX(); return; }
  /* фон: глубокая ночь с виньеткой */
  const bgGrad = CX.createRadialGradient(W / 2, H * .35, 60, W / 2, H / 2, Math.max(W, H) * .75);
  bgGrad.addColorStop(0, '#0e1120'); bgGrad.addColorStop(1, '#05060a');
  CX.fillStyle = bgGrad; CX.fillRect(0, 0, W, H);

  zoom += (zoomT - zoom) * .18;                     // инерция камеры, как в сити-билдерах
  panX += (panXT - panX) * .18;
  panY += (panYT - panY) * .18;
  CX.setTransform(DPR * zoom, 0, 0, DPR * zoom, DPR * panX, DPR * panY);
  CX.drawImage(staticCv, 0, 0, staticCv._cssW, staticCv._cssH);

  /* Владение кварталами должно читаться сразу, а не только по маленькому гербу. */
  drawCityOwnership(S_OX, S_OY);

  /* Режим размещения: только законные клетки у границы светятся зелёным. */
  if (flagPlacementMode) {
    for (const d of flagPlacementTargets(0)) {
      const [cx0, cy0] = iso(d.i0 + BS / 2 - .5, d.j0 + BS / 2 - .5);
      const cx = cx0 + S_OX, cy = cy0 + S_OY;
      CX.save(); CX.globalAlpha = .25 + .12 * Math.sin(T * 3 + d.i0);
      CX.fillStyle = '#48e29a'; CX.shadowColor = '#48e29a'; CX.shadowBlur = 22;
      CX.beginPath(); CX.ellipse(cx, cy, 58, 29, 0, 0, 7); CX.fill();
      CX.globalAlpha = 1; CX.fillStyle = '#d7ffe9'; CX.font = '800 11px Segoe UI'; CX.textAlign = 'center';
  CX.fillText(tr('ПОСТАВИТЬ ФЛАГ'), cx, cy); CX.restore();
    }
  }

  /* подсветка квартала под курсором */
  if (hoverD && hoverD !== selected) {
    const d = hoverD;
    CX.save();
    CX.globalAlpha = .10;
    CX.fillStyle = d.gang >= 0 ? (GANGS[d.gang] || { c: '#9fd8ff' }).c : '#9fd8ff';
    CX.beginPath();
    [[d.i0, d.j0], [d.i0 + BS, d.j0], [d.i0 + BS, d.j0 + BS], [d.i0, d.j0 + BS]]
      .forEach(([ci, cj], k) => {
        const [x, y] = iso(ci - .5, cj - .5);
        k ? CX.lineTo(x + S_OX, y + S_OY) : CX.moveTo(x + S_OX, y + S_OY);
      });
    CX.closePath(); CX.fill();
    CX.restore();
  }

  /* подсветка ВЫБРАННОГО квартала — золотой пульсирующий контур + свечение. */
  if (selected) {
    const d = selected;
    const pts = [[d.i0, d.j0], [d.i0 + BS, d.j0], [d.i0 + BS, d.j0 + BS], [d.i0, d.j0 + BS]];
    const pulse = .5 + .5 * Math.sin(T * 3);
    CX.save();
    CX.globalAlpha = .10 + .06 * pulse;
    CX.fillStyle = '#ffcf6e';
    CX.beginPath();
    pts.forEach(([ci, cj], k) => {
      const [x, y] = iso(ci - .5, cj - .5);
      k ? CX.lineTo(x + S_OX, y + S_OY) : CX.moveTo(x + S_OX, y + S_OY);
    });
    CX.closePath(); CX.fill();
    CX.globalAlpha = 1;
    CX.strokeStyle = '#ffd873'; CX.lineWidth = 2.5;
    CX.shadowColor = '#ffcf6e'; CX.shadowBlur = 14 + 8 * pulse;
    CX.stroke();
    CX.restore();
  }

  /* --- динамика --- */
  const ox = S_OX, oy = S_OY;

  const renderedBuilds = (window.MP && window.MP.connected)
    ? districts.filter(d => d.flagState === 'building').map(d => ({ d, end: Number(d.flagBuildEndsAt || Date.now() + 1) }))
    : flagBuilds;
  for (const b of renderedBuilds) {
    const [x0, y0] = iso(b.d.i0 + BS / 2 - .5, b.d.j0 + BS / 2 - .5);
    const total = (window.MP && window.MP.connected) ? 90000 : 45000;
    const left = Math.max(0, b.end - Date.now()), pct = Math.round(100 * (1 - left / total));
    CX.save(); CX.textAlign = 'center'; CX.font = '800 12px Segoe UI';
    mapLabel(CX, `⚑ ${tr('СТРОЙКА')} ${Math.max(0, pct)}%`, x0 + ox, y0 + oy - 36, '#f7d46a');
    CX.fillStyle = 'rgba(5,8,15,.85)'; CX.fillRect(x0 + ox - 42, y0 + oy - 29, 84, 6);
    CX.fillStyle = '#48e29a'; CX.fillRect(x0 + ox - 41, y0 + oy - 28, 82 * Math.max(0, pct) / 100, 4);
    CX.restore();
  }
  for (const d of districts) if (d.flagState === 'burning') {
    const [x0, y0] = iso(d.i0 + BS / 2 - .5, d.j0 + BS / 2 - .5);
    const burnLeft = Number(d.flagBurnEndsAt) ? Math.max(0, Number(d.flagBurnEndsAt) - Date.now()) : 0;
    const burnTimer = burnLeft && typeof clockLeft === 'function' ? ` · ${clockLeft(burnLeft)}` : '';
    CX.save(); CX.textAlign = 'center'; CX.font = '800 12px Segoe UI';
    const burnLabel = `🔥 ${tr('ФЛАГ ГОРИТ')} · ${Math.ceil(flagHp(d))}/100${burnTimer}`;
    CX.lineJoin = 'round'; CX.lineWidth = 3; CX.strokeStyle = 'rgba(0,0,0,.85)';
    CX.strokeText(burnLabel, x0 + ox, y0 + oy - 38);
    CX.fillStyle = '#ff6570'; CX.shadowColor = '#ff302f'; CX.shadowBlur = 14;
    CX.fillText(burnLabel, x0 + ox, y0 + oy - 38); CX.restore();
  }

  /* окна: мерцают медленно, тёплые и холодные */
  for (const w of windows) {
    const a = w.base * (0.72 + 0.28 * Math.sin(T * w.speed + w.phase));
    if (a < .18) continue;
    CX.globalAlpha = Math.min(1, a);
    CX.drawImage(w.warm ? G_WARM : G_COLD, w.x - 7, w.y - 7);
    CX.fillStyle = w.warm ? P.winWarm : P.winCold;
    CX.fillRect(w.x - w.w / 2, w.y - w.h / 2, w.w, w.h);
  }
  CX.globalAlpha = 1;

  /* гаражи: щель ворот дышит светом, диоды асиков мигают */
  for (const l of leds) {
    const pulse = .5 + .5 * Math.sin(T * 2.2 + l.phase);
    const sl = l.slit;
    CX.globalAlpha = .10 + .13 * pulse;
    CX.fillStyle = l.c;
    CX.beginPath();
    CX.moveTo(sl.x + sl.hw * .15, sl.y + TH * .28);
    CX.lineTo(sl.x + sl.hw * .78, sl.y + TH * .02);
    CX.lineTo(sl.x + sl.hw * .78, sl.y - sl.h + 6 + TH * .02);
    CX.lineTo(sl.x + sl.hw * .15, sl.y - sl.h + 6 + TH * .28);
    CX.closePath(); CX.fill();
    CX.globalAlpha = .5 + .5 * pulse;
    CX.drawImage(l.c === P.green ? G_GREEN : (l.c === P.gold ? G_GOLD : G_ACC), l.x - 8, l.y - 8);
    CX.fillStyle = l.c; CX.fillRect(l.x - 1.2, l.y - 1.2, 2.4, 2.4);
  }
  CX.globalAlpha = 1;

  /* неон отеля: HOTEL с пульсом и лёгким «пропаданием» буквы */
  if (hotelSign) {
    const flick = Math.sin(T * 1.4) > -0.92 ? 1 : .25;
    CX.save();
    CX.font = '800 17px Segoe UI, sans-serif';
    CX.textAlign = 'center';
    CX.shadowColor = P.gold; CX.shadowBlur = 18 * flick;
    CX.fillStyle = `rgba(245,197,66,${.88 * flick})`;
    CX.fillText('H O T E L', hotelSign.x, hotelSign.y);
    CX.shadowBlur = 0;
    CX.restore();
  }

  /* ветряки: лопасти крутятся */
  for (const t of turbines) {
    CX.save();
    CX.translate(t.x, t.y);
    CX.strokeStyle = '#4a548c'; CX.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const a = T * 1.1 + k * 2.094;
      CX.beginPath(); CX.moveTo(0, 0);
      CX.lineTo(Math.cos(a) * 16, Math.sin(a) * 16 * .5 - Math.abs(Math.cos(a)) * 2);
      CX.stroke();
    }
    CX.fillStyle = P.green; CX.globalAlpha = .5 + .5 * Math.sin(T * 3);
    CX.fillRect(-1.5, -1.5, 3, 3); CX.globalAlpha = 1;
    CX.restore();
  }

  /* марши: колонна из трёх машин с фарами, стоп по прибытии */
  for (let mi = marches.length - 1; mi >= 0; mi--) {
    const m = marches[mi];
    const progress = Math.max(0, Math.min(1, (Date.now() - m.startTime) / m.durationMs));
    m.t = m.len * progress;
    for (let carN = 0; carN < 3; carN++) {
      const back = { ...m, t: Math.max(0, m.t - carN * .8) };
      const [ti, tj] = marchXY(back);
      const [x0, y0] = iso(ti, tj);
      const x = x0 + ox, y = y0 + oy;
      CX.globalAlpha = .9;
      CX.drawImage(G_HEAD, x - 18, y - 18 - 4);
      /* колонна: головной — броневик, за ним фургоны */
      const car = carN === 0 ? ART.vanArm : ART.van;
      if (ok(car)) {
        shadowUnder(CX, x, y + 2, 11, .45);
        spr(CX, car, x, y + 3, 22);
        CX.globalAlpha = .55;                       // метка цвета банды на крыше
        CX.fillStyle = m.col;
        CX.fillRect(x - 2.5, y - 9, 5, 2);
      } else {
        CX.fillStyle = m.col;
        CX.fillRect(x - 4, y - 7, 8, 5);
        CX.fillStyle = '#fff3c9';
        CX.fillRect(x + 2.5, y - 6.4, 1.8, 1.8);
      }
      CX.globalAlpha = 1;
    }
    /* след территории цвета банды */
    if (m.t >= m.len) {
      const [x0, y0] = iso(...m.path[m.path.length - 1]);
      CX.save();
      CX.globalAlpha = .8; CX.shadowColor = m.col; CX.shadowBlur = 30;
      CX.fillStyle = m.col + '33';
      CX.beginPath(); CX.arc(x0 + ox, y0 + oy, 26, 0, 7); CX.fill();
      CX.restore();
      marches.splice(mi, 1);
      resolveMarch(m);
    }
  }

  drawLife(ox, oy);      // прохожие, трафик, дым, флаги — от этого город живой
  drawClouds();          // облака над городом, как в FoE
  drawZoomDetail(ox, oy); // v7.2: подписи жильцов — открываются при приближении

  /* --- ТВОЙ ГАРАЖ: его надо находить с первого взгляда ---
     Раньше свой квартал ничем не отличался от полутора десятков соседних:
     тот же цвет банды, те же коробки. Теперь золотая рамка, тёплая подсветка
     земли и табличка с указателем. Размер таблички делится на зум, чтобы она
     не разрасталась при приближении. */
  if (MINE && MINE.mine) {
    const d = MINE;
    const corners = [[d.i0, d.j0], [d.i0 + BS, d.j0], [d.i0 + BS, d.j0 + BS], [d.i0, d.j0 + BS]];
    const pulse = .5 + .5 * Math.sin(T * 2);
    CX.save();
    CX.beginPath();
    corners.forEach(([ci, cj], k) => {
      const [x, y] = iso(ci - .5, cj - .5);
      k ? CX.lineTo(x + ox, y + oy) : CX.moveTo(x + ox, y + oy);
    });
    CX.closePath();
    CX.fillStyle = `rgba(245,197,66,${(.05 + .05 * pulse).toFixed(3)})`;
    CX.fill();
    CX.shadowColor = P.gold; CX.shadowBlur = 12;
    CX.strokeStyle = `rgba(245,197,66,${(.55 + .35 * pulse).toFixed(2)})`;
    CX.lineWidth = 2.2 / zoom;
    CX.stroke();
    CX.restore();

    /* табличка с указателем над кварталом */
    const [mx0, my0] = iso(d.i0 + BS / 2 - .5, d.j0 - .5);
    const mx = mx0 + ox, my = my0 + oy - 74 - 4 * pulse;
    CX.save();
    CX.translate(mx, my);
    CX.scale(1 / zoom, 1 / zoom);
    const label = tr('⚑ ТВОЙ ГАРАЖ');
    CX.font = '900 16px Segoe UI, sans-serif';
    const w = CX.measureText(label).width + 48, h = 30;
    CX.fillStyle = 'rgba(10,12,20,.88)';
    CX.strokeStyle = P.gold; CX.lineWidth = 1.4;
    CX.beginPath(); CX.roundRect(-w / 2, -h, w, h, 8); CX.fill(); CX.stroke();
    CX.beginPath();                                   // хвостик вниз, на квартал
    CX.moveTo(-7, 0); CX.lineTo(7, 0); CX.lineTo(0, 9); CX.closePath();
    CX.fillStyle = 'rgba(10,12,20,.88)'; CX.fill();
    CX.strokeStyle = P.gold; CX.stroke();
    if (ok(ART.symPick)) CX.drawImage(ART.symPick, -w / 2 + 9, -h + 5, 16, 16);
    CX.fillStyle = P.gold;
    CX.textAlign = 'center'; CX.textBaseline = 'middle';
    CX.fillText(label, 10, -h / 2 + 1);
    CX.textBaseline = 'alphabetic';
    CX.restore();
  }

  /* A city assault has a server-owned three-minute assembly window.  Previously
     it was represented only by a small notification below the map, so a player
     could not tell whether the click had registered or which block was being
     prepared.  Keep the countdown purely visual; the deadline still comes
     from the server rally payload and no browser timer can resolve the fight. */
  if (activeRally && activeRally.server && activeRally.status === 'forming' &&
      districts.includes(activeRally.target)) {
    const d = activeRally.target;
    const corners = [[d.i0, d.j0], [d.i0 + BS, d.j0], [d.i0 + BS, d.j0 + BS], [d.i0, d.j0 + BS]];
    const pulse = .5 + .5 * Math.sin(T * 4);
    const secondsLeft = Math.max(0, Math.ceil((Number(activeRally.end || 0) - Date.now()) / 1000));
    const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
    CX.save();
    CX.beginPath();
    corners.forEach(([ci, cj], k) => {
      const [x, y] = iso(ci - .5, cj - .5);
      k ? CX.lineTo(x + ox, y + oy) : CX.moveTo(x + ox, y + oy);
    });
    CX.closePath();
    CX.fillStyle = `rgba(245,197,66,${(.08 + .08 * pulse).toFixed(3)})`;
    CX.fill();
    CX.strokeStyle = `rgba(245,197,66,${(.6 + .35 * pulse).toFixed(2)})`;
    CX.shadowColor = P.gold; CX.shadowBlur = 18; CX.lineWidth = 2.5 / zoom;
    CX.stroke();
    const [tx0, ty0] = iso(d.i0 + BS / 2 - .5, d.j0 - .5);
    CX.translate(tx0 + ox, ty0 + oy - 48);
    CX.scale(1 / zoom, 1 / zoom);
    const label = `⚔ СБОР РАЛЛИ · ${countdown}`;
    CX.font = '900 14px Segoe UI, sans-serif';
    const w = CX.measureText(label).width + 30;
    CX.fillStyle = 'rgba(13,15,24,.92)'; CX.strokeStyle = P.gold; CX.lineWidth = 1.3;
    CX.beginPath(); CX.roundRect(-w / 2, -25, w, 25, 7); CX.fill(); CX.stroke();
    CX.fillStyle = P.gold; CX.textAlign = 'center'; CX.textBaseline = 'middle';
    CX.fillText(label, 0, -12);
    CX.textBaseline = 'alphabetic';
    CX.restore();
  }

  /* выделение выбранного квартала */
  if (selected) {
    const d = selected;
    const corners = [[d.i0, d.j0], [d.i0 + BS, d.j0], [d.i0 + BS, d.j0 + BS], [d.i0, d.j0 + BS]];
    CX.save();
    CX.shadowColor = P.gold; CX.shadowBlur = 14;
    CX.strokeStyle = P.gold; CX.lineWidth = 1.8;
    CX.setLineDash([7, 5]); CX.lineDashOffset = -T * 24;
    CX.beginPath();
    corners.forEach(([ci, cj], k) => {
      const [x, y] = iso(ci - .5, cj - .5);
      k ? CX.lineTo(x + ox, y + oy) : CX.moveTo(x + ox, y + oy);
    });
    CX.closePath(); CX.stroke();
    CX.restore();
  }

  drawPostFX('city');
  if (CITY_BLOOM) drawCityBloom();
  drawRainFX();
}
