// 서버 공용 코드 (파일 이름이 _ 로 시작하면 Vercel에서 주소로 열리지 않음)
//
// 저장소: Vercel Blob (비공개). 프로젝트에 Blob 저장소를 연결하면 BLOB_READ_WRITE_TOKEN 이 자동으로 생겨요.
// 토큰이 없으면(로컬 개발) 메모리에 저장합니다 — 서버를 끄면 사라져요.
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const mem = new Map();
let blob = null;
async function blobApi() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  if (!blob) blob = await import("@vercel/blob");
  return blob;
}

export async function readJson(path) {
  const b = await blobApi();
  if (!b) return mem.has(path) ? JSON.parse(mem.get(path)) : null;
  const r = await b.get(path, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

export async function writeJson(path, data) {
  const body = JSON.stringify(data);
  const b = await blobApi();
  if (!b) { mem.set(path, body); return; }
  await b.put(path, body, {
    access: "private", addRandomSuffix: false, allowOverwrite: true,
    contentType: "application/json", cacheControlMaxAge: 60,
  });
}

export async function removeJson(paths) {
  const b = await blobApi();
  if (!b) { paths.forEach((p) => mem.delete(p)); return; }
  await b.del(paths);
}

// ── 비밀 값: 토큰 서명용. AUTH_SECRET 을 따로 두는 것을 권장 (없으면 Blob 토큰을 사용)
function secret() {
  const s = process.env.AUTH_SECRET || process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL ? "" : "local-dev-secret");
  if (!s) throw new HttpError(503, "서버 설정이 필요해요 (Blob 저장소 연결 또는 AUTH_SECRET).");
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
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
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
export async function authUser(req) {
  const p = readToken(req);
  const rec = await readJson(`users/${p.u}.json`);
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
