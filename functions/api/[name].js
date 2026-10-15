// Cloudflare Pages Functions — /api/이름 요청을 api/이름.js 의 GET/POST/PUT/DELETE 로 넘겨요.
//   서버 코드는 Vercel 과 똑같은 api/*.js 를 그대로 써요 (Vercel 은 그대로 두고 둘 다 돌아가요).
//   필요한 설정은 wrangler.toml · README 「Cloudflare Pages」를 보세요.
import * as auth from "../../api/auth.js";
import * as comments from "../../api/comments.js";
import * as emoticons from "../../api/emoticons.js";
import * as migrate from "../../api/migrate.js";
import * as points from "../../api/points.js";
import * as sync from "../../api/sync.js";
import * as tts from "../../api/tts.js";

const ROUTES = { auth, comments, emoticons, migrate, points, sync, tts };

export async function onRequest({ request, env, params }) {
  // 환경 변수(대시보드 Settings → Variables and Secrets)를 process.env 로 — api/*.js 가 process.env 를 읽어요
  globalThis.process = globalThis.process || { env: {} };
  process.env = process.env || {};
  for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
  globalThis.__STORY_CF = true;
  globalThis.__STORY_KV = env.STORY_KV || null;
  // 공부 자료 파일은 같은 사이트의 정적 파일에서 읽어요 (api/tts.js)
  const origin = new URL(request.url).origin;
  globalThis.__STORY_ASSET = async (rel) => {
    const r = await env.ASSETS.fetch(new Request(origin + "/" + rel.split("/").map(encodeURIComponent).join("/")));
    if (!r.ok) throw new Error(`asset ${rel}: ${r.status}`);
    return r.text();
  };

  const mod = ROUTES[params.name];
  const fn = mod && mod[request.method];
  if (!fn) return new Response(JSON.stringify({ error: "없는 주소예요." }), { status: mod ? 405 : 404, headers: { "content-type": "application/json; charset=utf-8" } });
  return fn(request);
}
