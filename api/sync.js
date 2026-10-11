// 학습 기록 동기화
//   GET /api/sync  → { keys: { 키: { v: 값|null, t: 시각 } }, t }
//   PUT /api/sync  { keys } → { ok, t }
// 병합은 브라우저(js/sync.js)가 하고, 서버는 로그인한 사람의 최신 묶음을 보관만 해요.
import { HttpError, body, handle, json, readJson, readToken, writeJson } from "./_lib.js";

export function GET(req) {
  return handle(async () => {
    const { u } = readToken(req);
    const data = await readJson(`data/${u}.json`);
    return json(data || { keys: {}, t: 0 });
  });
}

export function PUT(req) {
  return handle(async () => {
    const { u } = readToken(req);
    const { keys } = await body(req);
    if (!keys || typeof keys !== "object" || Array.isArray(keys)) throw new HttpError(400, "잘못된 요청이에요.");
    for (const [k, e] of Object.entries(keys)) {
      if (k.length > 200 || !e || typeof e !== "object" || (e.v !== null && typeof e.v !== "string") || typeof e.t !== "number") {
        throw new HttpError(400, "잘못된 요청이에요.");
      }
    }
    const t = Date.now();
    await writeJson(`data/${u}.json`, { keys, t });
    return json({ ok: true, t });
  });
}
