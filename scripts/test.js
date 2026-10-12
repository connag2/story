// 간단한 자체 점검: node scripts/test.js
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// ── 브라우저 흉내
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k), get length() { return store.size; },
};
Object.defineProperty(globalThis.localStorage, "keys", { value: undefined });
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.document = { addEventListener() {}, getElementById() { return null; }, visibilityState: "visible" };
globalThis.setInterval = () => 0;
require("../js/app.js");
for (const f of ["reading", "reading-mock-2026-09", "math", "english", "programming", "korean"]) require(`../data/${f}.js`);
require("../js/sync.js");
const { same, subjects } = STORY._check;
const { merge } = STORY._sync;

// 1) 모든 문제: 정답이 스스로를 맞다고 채점하는지
let n = 0;
for (const s of subjects) for (const u of s.units) for (const g of u.groups) for (const it of g.items) {
  n++;
  if (it.type === "input") for (const o of it.ok) assert.ok(same(o, o, it.any, it.math), `${it.id} ${o}`);
  if (it.type === "choice") assert.ok(it.choices.includes(it.ok[0]), `${it.id} 정답이 보기에 없음`);
}
// 2) 채점 규칙
const m = (a, b, any) => same(a, b, any, true);
assert.ok(m("0.25", "1/4") && m("루트6", "√6") && m("무한대", "∞") && m("a=9, b=3", "a=9,b=3"));
assert.ok(m("y=4x-3 또는 y=4x+1", "y=4x+1,y=4x-3", true) && !m("3x-5", "y=3x-5"));

// 3) 동기화 병합
const P = "story-progress-v1", T = "story-progress-t-v1", J = JSON.stringify;
const L = { [P]: { v: J({ a: "x", b: "o" }), t: 1 }, [T]: { v: J({ a: 100, b: 100 }), t: 1 } };
const R = { [P]: { v: J({ a: "o", c: "x" }), t: 1 }, [T]: { v: J({ a: 200, b: 300, c: 50 }), t: 1 } };
const out = merge(L, R);
assert.deepEqual(JSON.parse(out[P].v), { a: "o", c: "x" }, "문제별 최신 (b는 다른 기기에서 지움)");
// 영어 공부장 진행: 내부 t 비교 → 새 기기의 빈 기록(t:0)이 서버 기록을 덮지 않음
const sp = merge({ "sp:p:x": { v: J({ v: 1, t: 0, it: {} }), t: 999, fresh: true } }, { "sp:p:x": { v: J({ v: 1, t: 50, it: { k: 1 } }), t: 10 } });
assert.equal(JSON.parse(sp["sp:p:x"].v).t, 50);
// 처음 맞추는 단어장은 합집합
const w = merge({ "sp:words": { v: J(["a", "b"]), t: 9, fresh: true } }, { "sp:words": { v: J(["b", "c"]), t: 1 } });
assert.deepEqual(JSON.parse(w["sp:words"].v).sort(), ["a", "b", "c"]);
// 이미 맞춘 키는 최신 쪽
const lw = merge({ "sp:ui": { v: "new", t: 9 } }, { "sp:ui": { v: "old", t: 1 } });
assert.equal(lw["sp:ui"].v, "new");

console.log(`ok — 문제 ${n}개, 채점·동기화 규칙 통과`);
