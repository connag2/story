// Upstash Redis 저장소 점검 (가짜 Redis 로): node scripts/test-redis.mjs
import assert from "node:assert/strict";
const db = new Map();
let calls = 0;
globalThis.fetch = async (url, o) => {
  assert.ok(String(url).endsWith("/pipeline"));
  assert.equal(o.headers.authorization, "Bearer tok");
  calls++;
  const out = JSON.parse(o.body).map(([cmd, ...a]) => {
    if (cmd === "GET") return { result: db.has(a[0]) ? db.get(a[0]) : null };
    if (cmd === "SET") { db.set(a[0], a[1]); return { result: "OK" }; }
    if (cmd === "MGET") return { result: a.map((k) => (db.has(k) ? db.get(k) : null)) };
    if (cmd === "DEL") { let n = 0; a.forEach((k) => { if (db.delete(k)) n++; }); return { result: n }; }
    if (cmd === "EXISTS") return { result: db.has(a[0]) ? 1 : 0 };
    return { error: "unknown " + cmd };
  });
  return new Response(JSON.stringify(out));
};
delete process.env.BLOB_READ_WRITE_TOKEN;
process.env.KV_REST_API_URL = "https://fake.upstash.io/";
process.env.KV_REST_API_TOKEN = "tok";
const { readJson, writeJson, removeJson, storeKind } = await import("../api/_lib.js");
assert.equal(storeKind(), "redis");
await writeJson("users/a.json", { name: "가" });
assert.deepEqual(await readJson("users/a.json"), { name: "가" });
assert.equal(db.get("story:users/a.json"), JSON.stringify({ name: "가" }));
// 큰 값은 나눠서
const big = { images: ["x".repeat(2_500_000)] };
await writeJson("emoticons/p/1.json", big);
assert.match(db.get("story:emoticons/p/1.json"), /^\u0000parts:3$/);
assert.deepEqual(await readJson("emoticons/p/1.json"), big);
await removeJson(["emoticons/p/1.json", "users/a.json"]);
assert.equal([...db.keys()].length, 0, "조각까지 모두 지움");
assert.equal(await readJson("users/a.json"), null);
// 회원가입·로그인이 Redis 로 동작
const { POST: auth } = await import("../api/auth.js");
const r = await auth(new Request("http://x/api/auth", { method: "POST", body: JSON.stringify({ action: "signup", name: "레디스", password: "1234" }) }));
assert.equal(r.status, 200);
const l = await auth(new Request("http://x/api/auth", { method: "POST", body: JSON.stringify({ action: "login", name: "레디스", password: "1234" }) }));
assert.equal(l.status, 200);
assert.ok([...db.keys()].some((k) => k.startsWith("story:users/")));
console.log(`ok — Upstash Redis 저장소 (읽기·쓰기·큰 값 나누기·지우기·가입/로그인, 요청 ${calls}번)`);
