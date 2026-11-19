#!/usr/bin/env node
// 办案期限计算器（刑事 / 治安）
// 用法：
//   node calc.mjs 刑事 --拘留 2026-11-01 --延长 1
//   node calc.mjs 治安 --立案 2026-11-01 --延长 1
//   node calc.mjs 取保 --起算 2026-11-01
// 全部输出日期都按自然日计算，遇节假日顺延规则需按本单位规定自行处理。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(path.join(HERE, 'rules.json'), 'utf8'));

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const parseDate = (s) => {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error('日期格式应为 YYYY-MM-DD：' + s);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const args = process.argv.slice(2);
const mode = args[0];
const opt = {};
for (let i = 1; i < args.length; i++) {
  if (args[i].startsWith('--')) { opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true; }
}

const out = [];
const line = (s) => out.push(s);

if (!mode || ['-h', '--help', 'help'].includes(mode)) {
  console.log(`办案期限计算器

用法：
  node calc.mjs 刑事 --拘留 2026-11-01 [--延长 1|2|3]
  node calc.mjs 治安 --立案 2026-11-01 [--延长 1|2]
  node calc.mjs 取保 --起算 2026-11-01 [--监视居住]
  node calc.mjs 审限 --受理 2026-11-01 [--延长 1]

说明：日期按自然日推，节假日顺延需按本单位规定自行处理。`);
  process.exit(0);
}

if (mode === '刑事') {
  const d = parseDate(opt['拘留'] || opt['起算'] || new Date().toISOString().slice(0, 10));
  const ext = Number(opt['延长'] || 0);
  const r = RULES['刑事']['刑事拘留'];
  let days = r['一般'].天数;
  if (ext >= 1) days += r['延长1_4日'].天数;
  if (ext >= 2) days = r['流窜多次结伙_30日'].天数;
  line(`刑事拘留起算：${fmt(d)}`);
  line(`拘留期限（${ext >= 2 ? '流窜/多次/结伙，30日' : ext >= 1 ? '一般+延长，7日' : '一般，3日'}）：至 ${fmt(addDays(d, days))}`);
  line(`　依据：${ext >= 2 ? r['流窜多次结伙_30日'].依据 : ext >= 1 ? r['延长1_4日'].依据 : r['一般'].依据}`);
  line(`提请批捕后，检察院审查：7日内 → 最迟 ${fmt(addDays(addDays(d, days), 7))}`);
  line(`　依据：${r['提请批捕后检察院审查'].依据}`);
  line(`⚠️ 注意：拘留期限届满前必须作出提请批捕或变更强制措施的决定。`);
}

if (mode === '治安') {
  const d = parseDate(opt['立案'] || opt['起算'] || new Date().toISOString().slice(0, 10));
  const ext = Math.min(2, Number(opt['延长'] || 0));
  const r = RULES['治安']['办案期限'];
  const total = r.基本.天 + ext * r.延长.天;
  line(`治安案件立案：${fmt(d)}`);
  line(`办案期限：${total} 日（基本30日${ext ? ` + 延长${ext}次×30日` : ''}）→ 至 ${fmt(addDays(d, total))}`);
  line(`　依据：${r.基本.依据}`);
  if (ext) line(`　延长依据：${r.延长.依据}`);
  line(`⚠️ 延长以二次为限；超期须按规定办理延期手续并在卷内注明理由。`);
}

if (mode === '取保') {
  const d = parseDate(opt['起算'] || new Date().toISOString().slice(0, 10));
  if (opt['监视居住']) {
    const m = RULES['刑事']['监视居住'].月;
    line(`监视居住起算：${fmt(d)} → 最长至 ${fmt(addMonths(d, m))}（${m}个月）`);
    line(`　依据：${RULES['刑事']['监视居住'].依据}`);
  } else {
    const m = RULES['刑事']['取保候审'].月;
    line(`取保候审起算：${fmt(d)} → 最长至 ${fmt(addMonths(d, m))}（${m}个月）`);
    line(`　依据：${RULES['刑事']['取保候审'].依据}`);
    line(`⚠️ 每满3个月应有一次考察/提醒记录。`);
  }
}

if (mode === '审限') {
  const d = parseDate(opt['受理'] || opt['起算'] || new Date().toISOString().slice(0, 10));
  const r = RULES['刑事']['一审审限'];
  line(`一审受理：${fmt(d)}`);
  line(`基本审限至 ${fmt(addMonths(d, r.基本.月))}，至迟 ${fmt(addMonths(d, r.上限.月))}`);
  line(`　依据：${r.基本.依据}`);
  if (opt['延长']) line(`经上一级法院批准延长3个月 → 至 ${fmt(addMonths(d, r.上限.月 + 3))}`);
  line(`上诉期：判决 ${RULES['刑事']['上诉抗诉期'].判决.天} 日 / 裁定 ${RULES['刑事']['上诉抗诉期'].裁定.天} 日`);
}

console.log(out.join('\n'));
console.log('\n（参考推算，以现行法条与本单位规定为准）');
