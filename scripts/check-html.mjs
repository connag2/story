// 문제·풀이 글 안의 "<" 가 HTML 태그로 잘못 읽히는 곳 찾기: node scripts/check-html.mjs
// (예: $-3<x<3$ → 브라우저가 <x...> 를 태그로 먹어 버림 → app.js 의 safeHtml 이 &lt; 로 바꿔 줌)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k), get length() { return 0; } };
globalThis.window = globalThis; globalThis.addEventListener = () => {};
globalThis.document = { addEventListener() {}, getElementById() { return null; } }; globalThis.setInterval = () => 0;
require("../js/app.js");
for (const f of ["reading", "reading-mock-2026-09", "reading-2", "math", "english", "programming", "programming-2", "korean", "guides",
  "solutions-math-1", "solutions-math-2", "solutions-math-3", "solutions-reading", "solutions-programming", "solutions-korean"]) require(`../data/${f}.js`);
// 화면에 넣을 때 쓰는 safeHtml 을 거친 뒤에도 태그처럼 보이는 "<" 가 남는지 (= 모르는 태그를 썼는지) 확인
const { safeHtml } = STORY._check;
const bad = [];
const look = (where, html) => {
  if (typeof html !== "string") return;
  const out = safeHtml(html);
  for (const m of out.matchAll(/<(?=[A-Za-z])([a-z0-9]+)/gi)) if (!/^(b|i|u|s|em|strong|br|div|span|p|ul|ol|li|code|pre|sub|sup|small|table|tr|td|th|thead|tbody|caption|img|hr|mark|h[1-6]|a|blockquote|details|summary|figure|figcaption)$/i.test(m[1])) bad.push(`${where}: …${out.slice(Math.max(0, m.index - 15), m.index + 20)}…`);
};
for (const s of STORY._check.subjects) {
  look(`${s.id} 공부법`, s.guide);
  for (const u of s.units) {
    look(`${s.id}/${u.id} 개념`, u.concept);
    u.groups.forEach((g, gi) => {
      ["q", "passage", "explain"].forEach((k) => look(`${s.id}/${u.id}/${gi} ${k}`, g[k]));
      g.items.forEach((it) => { ["q", "a", "explain"].forEach((k) => look(`${it.id} ${k}`, it[k])); (it.choices || []).forEach((c) => look(`${it.id} 보기`, c)); (it.steps || []).forEach((t) => look(`${it.id} 풀이`, t)); });
    });
  }
}
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
console.log("ok — 글 속 < 가 태그로 잘못 읽히는 곳 없음");
