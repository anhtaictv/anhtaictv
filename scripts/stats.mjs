// Vẽ thẻ thống kê (stats.svg) từ lịch đóng góp GitHub — có cả đóng góp repo riêng tư
// (khi profile bật "Include private contributions"). Chạy: GH_TOKEN=... node scripts/stats.mjs
import { writeFileSync } from 'node:fs';

const USER = 'anhtaictv';
const token = process.env.GH_TOKEN;
if (!token) throw new Error('Thiếu GH_TOKEN');

async function gql(query, variables) {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST', headers: { authorization: `bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

const { user } = await gql(`query($u:String!){ user(login:$u){ createdAt
  repositories(ownerAffiliations:OWNER){ totalCount }
  pullRequests{ totalCount } } }`, { u: USER });

// lịch theo từng năm từ lúc tạo tài khoản (API giới hạn tối đa 1 năm mỗi lần)
const days = [];
const now = new Date();
for (let y = new Date(user.createdAt).getUTCFullYear(); y <= now.getUTCFullYear(); y++) {
  const d = await gql(`query($u:String!,$f:DateTime!,$t:DateTime!){ user(login:$u){ contributionsCollection(from:$f,to:$t){
    contributionCalendar{ weeks{ contributionDays{ date contributionCount } } } } } }`,
  { u: USER, f: `${y}-01-01T00:00:00Z`, t: `${y}-12-31T23:59:59Z` });
  for (const w of d.user.contributionsCollection.contributionCalendar.weeks) days.push(...w.contributionDays);
}
const today = now.toISOString().slice(0, 10);
const past = days.filter(d => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));

const total = past.reduce((s, d) => s + d.contributionCount, 0);
const year = past.filter(d => d.date.startsWith(today.slice(0, 4))).reduce((s, d) => s + d.contributionCount, 0);
let longest = 0, run = 0, longFrom = '', longTo = '', runFrom = '';
for (const d of past) {
  if (d.contributionCount > 0) { if (!run) runFrom = d.date; run++; if (run > longest) { longest = run; longFrom = runFrom; longTo = d.date; } }
  else run = 0;
}
// chuỗi hiện tại: hôm nay chưa có đóng góp thì vẫn tính chuỗi tới hôm qua
let cur = 0, i = past.length - 1;
if (i >= 0 && past[i].contributionCount === 0) i--;
for (; i >= 0 && past[i].contributionCount > 0; i--) cur++;

const vi = s => { const [y, m, d] = s.split('-'); return `${+d}/${+m}/${y}`; };
const n = x => x.toLocaleString('vi-VN');
const cells = [
  [n(total), 'Tổng đóng góp', `từ ${vi(user.createdAt.slice(0, 10))}`],
  [n(year), `Đóng góp năm ${today.slice(0, 4)}`, `${n(user.repositories.totalCount)} repo · ${n(user.pullRequests.totalCount)} PR`],
  [n(cur), 'Chuỗi hiện tại', cur ? 'ngày liên tiếp 🔥' : 'bắt đầu lại hôm nay'],
  [n(longest), 'Chuỗi dài nhất', longest ? `${vi(longFrom)} – ${vi(longTo)}` : ''],
];
const W = 820, H = 150, cw = W / cells.length;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Segoe UI',Ubuntu,Arial,sans-serif">
<style>.v{font-size:34px;font-weight:700;fill:#f0592a}.l{font-size:14px;font-weight:600;fill:#57606a}.s{font-size:12px;fill:#8c959f}
@media (prefers-color-scheme:dark){.l{fill:#c9d1d9}.s{fill:#8b949e}}</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" stroke="#f0592a" stroke-opacity=".35"/>
${cells.map(([v, l, s], k) => `<g transform="translate(${cw * k + cw / 2},0)" text-anchor="middle">
${k ? `<line x1="${-cw / 2}" y1="30" x2="${-cw / 2}" y2="${H - 30}" stroke="#d0d7de"/>` : ''}
<text class="v" y="62">${v}</text><text class="l" y="92">${l}</text><text class="s" y="114">${s}</text></g>`).join('\n')}
</svg>
`;
writeFileSync('stats.svg', svg);
console.log({ total, year, cur, longest });
