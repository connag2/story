// 서버 공용 코드 (파일 이름이 _ 로 시작하면 Vercel에서 주소로 열리지 않음)
//   Vercel(api/*.js) 과 Cloudflare Pages(functions/api/[name].js 가 이 파일들을 그대로 불러요) 양쪽에서 돌아가요.
//
// 저장소 (먼저 있는 것을 써요)
//  1) Upstash Redis — Vercel → Storage → Upstash for Redis 를 연결하면 KV_REST_API_URL/KV_REST_API_TOKEN
//     (또는 UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN) 이 생겨요. 무료로 한 달 50만 번이라 넉넉해요.
//     Cloudflare 에도 같은 두 값을 넣으면 두 사이트가 같은 계정·기록을 함께 써요.
//  2) Cloudflare KV — Cloudflare Pages 에 STORY_KV 바인딩을 연결했을 때 (Redis 가 없을 때만)
//  3) Vercel Blob (비공개) — BLOB_READ_WRITE_TOKEN. 무료 한도가 작아서 예비용.
//  4) 모두 없으면(로컬 개발) 메모리 — 서버를 끄면 사라져요.
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const mem = new Map();
let blob = null;
async function blobApi() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  if (!blob) blob = await import("@vercel/blob");
  return blob;
}
const kv = () => globalThis.__STORY_KV || null;          // functions/api/[name].js 가 넣어 줘요
export const onCloudflare = () => !!globalThis.__STORY_CF;

// ── Upstash Redis (REST — 따로 설치할 것 없음)
const REDIS_URL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const storeKind = () => (REDIS_URL() && REDIS_TOKEN() ? "redis" : kv() ? "kv" : process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "memory");
async function redis(cmds) {                 // cmds: [["GET", k], ["SET", k, v]] → 결과 배열
  const r = await fetch(REDIS_URL().replace(/\/$/, "") + "/pipeline", {
    method: "POST", headers: { authorization: `Bearer ${REDIS_TOKEN()}`, "content-type": "application/json" }, body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`redis ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
  const out = await r.json();
  return out.map((x) => { if (x.error) throw new Error("redis: " + x.error); return x.result; });
}
// 큰 값(이모티콘 그림 묶음)은 나눠서 저장: 본 키에는 "\u0000parts:N", 조각은 key#0 … key#N-1
const PART = 900_000, MARK = "\u0000parts:";
const K = (path) => "story:" + path;
async function redisGet(path) {
  const [v] = await redis([["GET", K(path)]]);
  if (v == null || !String(v).startsWith(MARK)) return v;
  const n = Number(String(v).slice(MARK.length));
  const parts = await redis([["MGET", ...Array.from({ length: n }, (_, i) => `${K(path)}#${i}`)]]);
  return parts[0].join("");
}
async function redisSet(path, body) {
  if (body.length <= PART) return redis([["SET", K(path), body]]);
  const n = Math.ceil(body.length / PART);
  const cmds = Array.from({ length: n }, (_, i) => ["SET", `${K(path)}#${i}`, body.slice(i * PART, (i + 1) * PART)]);
  for (let i = 0; i < cmds.length; i += 4) await redis(cmds.slice(i, i + 4));   // 한 번에 너무 크지 않게
  return redis([["SET", K(path), MARK + n]]);
}
async function redisDel(paths) {
  const heads = await redis(paths.map((p) => ["GET", K(p)]));
  const keys = [];
  paths.forEach((p, i) => {
    keys.push(K(p));
    const v = heads[i];
    if (v != null && String(v).startsWith(MARK)) for (let j = 0; j < Number(String(v).slice(MARK.length)); j++) keys.push(`${K(p)}#${j}`);
  });
  if (keys.length) await redis([["DEL", ...keys]]);
}

// ── 같은 서버 인스턴스 안에서 잠깐 기억해 두기 (저장소 사용량 줄이기)
//   readJson(path, ttl) — ttl(ms) 안에 다시 읽으면 저장소에 가지 않음. 읽어서 고쳐 쓰는 곳(POST)은 ttl 없이 항상 새로 읽어요.
//   쓰기·지우기는 기억도 함께 고침.
const memo = new Map();   // path → { text|null, exp }
const MEMO_MAX = 500;
function remember(path, text, ttl) {
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value);
  memo.set(path, { text, exp: Date.now() + ttl });
}
async function rawRead(path, immutable) {
  if (process.env.STORE_LOG) console.log("STORE read", path);
  const kind = storeKind();
  if (kind === "redis") return redisGet(path);
  if (kind === "kv") return kv().get(K(path));
  if (kind === "memory") return mem.has(path) ? mem.get(path) : null;
  const b = await blobApi();
  // 바뀌지 않는 파일(이모티콘 그림)은 Blob 캐시를 써서 연산을 아낌
  const r = await b.get(path, { access: "private", useCache: immutable });
  return r && r.statusCode === 200 ? await new Response(r.stream).text() : null;
}
export async function readJson(path, ttl = 0, { immutable = false } = {}) {
  const m = ttl && memo.get(path);
  if (m && m.exp > Date.now()) return m.text == null ? null : JSON.parse(m.text);
  let text;
  try { text = await rawRead(path, immutable); }
  catch (e) { console.error("store read", path, e); throw new HttpError(503, "저장소에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요. (관리자: 저장소 한도·연결을 확인하세요)"); }
  if (ttl) remember(path, text, ttl);
  return text == null ? null : JSON.parse(text);
}

export async function writeJson(path, data) {
  const body = JSON.stringify(data);
  if (memo.has(path)) remember(path, body, 60_000);
  if (process.env.STORE_LOG) console.log("STORE write", path);
  const kind = storeKind();
  try {
    if (kind === "redis") return void (await redisSet(path, body));
    if (kind === "kv") return void (await kv().put(K(path), body));
    if (kind === "memory") { mem.set(path, body); return; }
    const b = await blobApi();
    await b.put(path, body, {
      access: "private", addRandomSuffix: false, allowOverwrite: true,
      contentType: "application/json", cacheControlMaxAge: 60,
    });
  } catch (e) { console.error("store write", path, e); throw new HttpError(503, "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요. (관리자: 저장소 한도·연결을 확인하세요)"); }
}

export async function removeJson(paths) {
  paths.forEach((p) => memo.delete(p));
  const kind = storeKind();
  if (kind === "redis") return redisDel(paths);
  if (kind === "kv") { await Promise.all(paths.map((p) => kv().delete(K(p)))); return; }
  if (kind === "memory") { paths.forEach((p) => mem.delete(p)); return; }
  const b = await blobApi();
  await b.del(paths);
}

// ── Blob → Redis 옮기기 (관리자 · api/migrate.js): Blob 이 다시 열렸을 때 예전 계정·기록을 가져와요
export async function copyBlobToRedis() {
  if (storeKind() !== "redis") throw new HttpError(400, "먼저 Upstash Redis 를 연결해 주세요.");
  const b = await blobApi();
  if (!b) throw new HttpError(400, "Blob 저장소가 연결되어 있지 않아요.");
  let cursor, copied = 0, skipped = 0;
  do {
    const page = await b.list({ cursor, limit: 1000 });
    for (const it of page.blobs) {
      const [have] = await redis([["EXISTS", K(it.pathname)]]);
      if (have) { skipped++; continue; }                         // 이미 새로 만든 것은 덮어쓰지 않음
      const r = await b.get(it.pathname, { access: "private", useCache: false });
      if (!r || r.statusCode !== 200) continue;
      await redisSet(it.pathname, await new Response(r.stream).text());
      copied++;
    }
    cursor = page.hasMore ? page.cursor : null;
  } while (cursor);
  return { copied, skipped };
}

// ── 비밀 값: 토큰 서명용. AUTH_SECRET 을 따로 두는 것을 권장 (없으면 Blob → Redis 토큰을 사용)
function secret() {
  const deployed = process.env.VERCEL || onCloudflare();
  const s = process.env.AUTH_SECRET || process.env.BLOB_READ_WRITE_TOKEN || REDIS_TOKEN() || (deployed ? "" : "local-dev-secret");
  if (!s) throw new HttpError(503, "서버 설정이 필요해요 (Upstash Redis 연결 또는 AUTH_SECRET).");
  return s;
}

export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

// ── 이름 → 저장 경로용 id (이름은 대소문자 구분 없음)
export function normName(name) {
  const n = String(name || "").normalize("NFC").trim();
  if (!/^[0-9A-Za-z가-힣_.-]{2,20}$/.test(n)) throw new HttpError(400, "이름은 2~20자의 한글·영문·숫자·_ . - 만 쓸 수 있어요.");
  return n;
}
export const userId = (name) => createHash("sha256").update("story-user:" + name.toLowerCase()).digest("hex").slice(0, 32);

// ── 비밀번호: scrypt + 소금
const scryptAsync = (pw, salt) => new Promise((ok, no) => scrypt(pw, salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? no(e) : ok(k))));
export async function hashPassword(pw) {
  const salt = randomBytes(16);
  return { salt: salt.toString("base64"), hash: (await scryptAsync(pw, salt)).toString("base64") };
}
export async function checkPassword(pw, rec) {
  const k = await scryptAsync(pw, Buffer.from(rec.salt, "base64"));
  const want = Buffer.from(rec.hash, "base64");
  return k.length === want.length && timingSafeEqual(k, want);
}

// ── 로그인 토큰: base64url(JSON) + "." + HMAC
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const sign = (data) => createHmac("sha256", secret()).update(data).digest("base64url");
// v: 토큰 버전. 비밀번호를 바꾸거나 "모든 기기 로그아웃"을 하면 올라가서 예전 토큰이 무효가 됨
export function makeToken(id, name, v = 0, days = 180) {
  const body = b64u(JSON.stringify({ u: id, n: name, v, e: Date.now() + days * 864e5 }));
  return body + "." + sign(body);
}
export function readToken(req) {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/);
  if (!m) throw new HttpError(401, "로그인이 필요해요.", "auth");
  const [body, sig] = m[1].split(".");
  const want = body && sign(body);
  if (!sig || !want || sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) {
    throw new HttpError(401, "로그인이 만료됐어요. 다시 로그인해 주세요.", "auth");
  }
  let p = null;
  try { p = JSON.parse(Buffer.from(body, "base64url").toString()); } catch (e) { /* 아래에서 처리 */ }
  if (!p || !p.u || !p.e || p.e < Date.now()) throw new HttpError(401, "로그인이 만료됐어요. 다시 로그인해 주세요.", "auth");
  return p;
}

// ── 응답 도우미
//   cdn: Vercel CDN 에만 주는 기억 시간 (브라우저는 매번 새로 물어봄 → 남이 쓴 새 글도 바로 보임)
export function json(data, status = 200, cache = "no-store", cdn = null) {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": cache };
  if (cdn) headers["vercel-cdn-cache-control"] = cdn;
  return new Response(JSON.stringify(data), { status, headers });
}
export async function handle(fn) {
  try { return await fn(); } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, e.status);
    console.error(e);
    return json({ error: "서버 오류가 났어요. 잠시 뒤 다시 시도해 주세요." }, 500);
  }
}
export async function body(req, limit = 3_000_000) {
  const text = await req.text();
  if (text.length > limit) throw new HttpError(413, "데이터가 너무 커요.");
  try { return JSON.parse(text || "{}"); } catch (e) { throw new HttpError(400, "잘못된 요청이에요."); }
}

// ── 로그인한 사람 확인: 토큰 + 저장된 계정 (토큰 버전까지)
//   verify 일 때 계정 파일은 2분 동안 기억. 계정을 고치는 곳(api/auth.js)은 { fresh: true } 로 새로 읽어요.
//   verify:false(기본) 이면 서명된 토큰만 믿고 계정 파일을 읽지 않아요 (읽기 요청·댓글 등 — 저장소 아끼기).
//   쓰기·돈(포인트)·계정 관련은 verify/fresh 로 계정 파일까지 확인 (비밀번호 변경 · 전체 로그아웃 · 삭제 반영).
export async function authUser(req, { fresh = false, verify = false } = {}) {
  const p = readToken(req);
  if (!fresh && !verify) return { id: p.u, rec: { name: p.n, tv: p.v || 0 } };
  const rec = await readJson(`users/${p.u}.json`, fresh ? 0 : 120_000);
  if (!rec || (rec.tv || 0) !== (p.v || 0)) throw new HttpError(401, "로그인이 만료됐어요. 다시 로그인해 주세요.", "auth");
  return { id: p.u, rec };
}

// ── 복구 코드: 비밀번호를 잊었을 때 쓰는 12자리 코드 (헷갈리는 글자 0/O, 1/I 제외)
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeRecoveryCode() {
  const bytes = randomBytes(12);
  const c = [...bytes].map((x) => ALPHA[x % ALPHA.length]).join("");
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}
export const normCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
