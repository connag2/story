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

// ── 비밀 값: 토큰 서명용. AUTH_SECRET 을 따로 두는 것을 권장 (없으면 Blob 토큰을 사용)
function secret() {
  const s = process.env.AUTH_SECRET || process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL ? "" : "local-dev-secret");
  if (!s) throw new HttpError(503, "서버 설정이 필요해요 (Blob 저장소 연결 또는 AUTH_SECRET).");
  return s;
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
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
export function makeToken(id, name, days = 180) {
  const body = b64u(JSON.stringify({ u: id, n: name, e: Date.now() + days * 864e5 }));
  return body + "." + sign(body);
}
export function readToken(req) {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/);
  if (!m) throw new HttpError(401, "로그인이 필요해요.");
  const [body, sig] = m[1].split(".");
  const want = body && sign(body);
  if (!sig || !want || sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) {
    throw new HttpError(401, "로그인이 만료됐어요. 다시 로그인해 주세요.");
  }
  let p = null;
  try { p = JSON.parse(Buffer.from(body, "base64url").toString()); } catch (e) { /* 아래에서 처리 */ }
  if (!p || !p.u || !p.e || p.e < Date.now()) throw new HttpError(401, "로그인이 만료됐어요. 다시 로그인해 주세요.");
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
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "서버 오류가 났어요. 잠시 뒤 다시 시도해 주세요." }, 500);
  }
}
export async function body(req, limit = 3_000_000) {
  const text = await req.text();
  if (text.length > limit) throw new HttpError(413, "데이터가 너무 커요.");
  try { return JSON.parse(text || "{}"); } catch (e) { throw new HttpError(400, "잘못된 요청이에요."); }
}
