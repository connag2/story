// 과목의 문제 목록 보기 (풀이 쓰기용): node scripts/list-items.mjs math [단원id...]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k), get length() { return 0; } };
globalThis.window = globalThis; globalThis.addEventListener = () => {};
globalThis.document = { addEventListener() {}, getElementById() { return null; } }; globalThis.setInterval = () => 0;
require("../js/app.js");
for (const f of ["reading", "reading-mock-2026-09", "math", "english", "programming", "korean"]) require(`../data/${f}.js`);
const [sid, ...uids] = process.argv.slice(2);
const s = STORY._check.subjects.find((x) => x.id === sid);
for (const u of s.units) {
  if (uids.length && !uids.includes(u.id)) continue;
  console.log(`\n### 단원 ${u.id} ${u.title}`);
  u.groups.forEach((g, gi) => {
    console.log(`\n-- 묶음 ${gi}${g.q ? " | 발문: " + g.q : ""}${g.passage ? " | (지문 있음: " + g.passage.replace(/<[^>]+>/g, "").slice(0, 400) + "…)" : ""}${g.explain ? " | 묶음해설: " + g.explain : ""}`);
    g.items.forEach((it) => console.log(`${it.id.slice(sid.length + 1)} [${it.type}] ${it.label || ""} ${it.q || ""}${it.choices ? " | 보기: " + it.choices.join(" / ") : ""} | 정답: ${it.a}${it.explain ? " | 해설: " + it.explain : ""}`));
  });
}
