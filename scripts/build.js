// scripts/build.js — генерирует subs.txt из 3 источников.
// Логика идентична index.html: парсим фрагмент после #, достаём флаг + страну,
// переводим EN→RU, группируем по стране в порядке первого появления,
// нумеруем №1..№N внутри группы, добавляем ?serverDescription=<base64>.

const fs = require('fs');
const path = require('path');
const https = require('https');

const COUNTRY_RU = {
  "Russia":"Россия","United States":"США","USA":"США","United Kingdom":"Великобритания","UK":"Великобритания",
  "Germany":"Германия","France":"Франция","Poland":"Польша","Czechia":"Чехия","Czech Republic":"Чехия",
  "Netherlands":"Нидерланды","Holland":"Нидерланды","Finland":"Финляндия","Sweden":"Швеция","Norway":"Норвегия",
  "Switzerland":"Швейцария","Austria":"Австрия","Italy":"Италия","Spain":"Испания","Portugal":"Португалия",
  "Romania":"Румыния","Bulgaria":"Болгария","Hungary":"Венгрия","Slovakia":"Словакия","Slovenia":"Словения",
  "Croatia":"Хорватия","Serbia":"Сербия","Greece":"Греция","Turkey":"Турция","Ukraine":"Украина",
  "Belarus":"Беларусь","Moldova":"Молдова","Lithuania":"Литва","Latvia":"Латвия","Estonia":"Эстония",
  "Ireland":"Ирландия","Iceland":"Исландия","Denmark":"Дания","Belgium":"Бельгия",
  "Luxembourg":"Люксембург","Japan":"Япония","South Korea":"Южная Корея","Korea":"Корея",
  "China":"Китай","Hong Kong":"Гонконг","Taiwan":"Тайвань","Singapore":"Сингапур","India":"Индия",
  "Israel":"Израиль","UAE":"ОАЭ","United Arab Emirates":"ОАЭ","Canada":"Канада","Mexico":"Мексика",
  "Brazil":"Бразилия","Argentina":"Аргентина","Australia":"Австралия","New Zealand":"Новая Зеландия",
  "South Africa":"ЮАР","Egypt":"Египет","Kazakhstan":"Казахстан","Georgia":"Грузия","Armenia":"Армения",
  "Azerbaijan":"Азербайджан",
};
const ruName = n => COUNTRY_RU[n] || n;
const DESC_B64 = "0JHQtdC70YvQtSDRgdC/0LjRgdC60Lg=";
const FLAG_RE = /^([\u{1F1E6}-\u{1F1FF}]{2}|\u{1F310})\s*([A-Za-z][A-Za-z\s\-]*?)(?=\s*[|\u2022\u2756\u2014\u2013\[\u2026]|$)/u;

const SOURCES = [
  "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/main/Vless-Reality-White-Lists-Rus-Mobile.txt",
  "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/main/WHITE-CIDR-RU-all.txt",
  "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/main/WHITE-CIDR-RU-checked.txt",
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} ${url}`)); }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseLine(line) {
  const hi = line.indexOf('#');
  if (hi === -1) return null;
  const urlPart = line.slice(0, hi);
  const fragEnc = line.slice(hi + 1);
  let frag;
  try { frag = decodeURIComponent(fragEnc); } catch { frag = fragEnc; }
  const m = frag.match(FLAG_RE);
  if (!m) return null;
  const symbol = m[1];
  const c_en = m[2].trim();
  const c_ru = symbol === '\u{1F310}' ? `Anycast (${c_en})` : ruName(c_en);
  return { symbol, c_ru, urlPart };
}

(async () => {
  const grouped = {};
  const order = [];
  for (const url of SOURCES) {
    const txt = await fetchText(url);
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const p = parseLine(line);
      if (!p) continue;
      if (!grouped[p.c_ru]) { grouped[p.c_ru] = []; order.push(p.c_ru); }
      grouped[p.c_ru].push({ symbol: p.symbol, urlPart: p.urlPart });
    }
  }

  const out = [];
  for (const country of order) {
    const entries = grouped[country];
    entries.forEach((e, i) => {
      const num = i + 1;
      const title = `${e.symbol} ${country} №${num}`;
      const titleEnc = encodeURIComponent(title);
      out.push(`${e.urlPart}#${titleEnc}?serverDescription=${DESC_B64}`);
    });
  }

  const header = [
    '# VPN White Lists - auto-generated',
    `# Updated: ${new Date().toISOString()}`,
    `# Total: ${out.length}`,
    `# Countries: ${order.length}`,
    '',
  ].join('\n');

  const body = out.join('\n') + '\n';
  fs.writeFileSync(path.join(__dirname, '..', 'subs.txt'), header + body);
  console.log(`Wrote subs.txt: ${out.length} lines, ${order.length} countries`);
  console.log('Order:', order.join(' -> '));
})().catch(e => { console.error(e); process.exit(1); });
