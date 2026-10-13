// 학습 기록 동기화
//   GET /api/sync  → { keys: { 키: { v: 값|null, t: 시각 } }, t, earned: [포인트 받은 문제 id] }
//   PUT /api/sync  { keys } → { ok, t, points }   (처음 맞힌 문제만큼 포인트 적립, 맞힌 목록 earned 도 이 파일에)
// 병합은 브라우저(js/sync.js)가 하고, 서버는 로그인한 사람의 최신 묶음을 보관만 해요.
import { HttpError, authUser, body, handle, json, readJson, writeJson } from "./_lib.js";
import { mergeEarned, pointsAfterEarn } from "./_points.js";

export function GET(req) {
  return handle(async () => {
    const { id: u } = await authUser(req, { verify: true });   // 내 기록은 비밀번호 변경·전체 로그아웃 뒤엔 못 읽게
    const data = await readJson(`data/${u}.json`);
    return json(data || { keys: {}, t: 0 });
  });
}

export function PUT(req) {
  return handle(async () => {
    const { id: u } = await authUser(req, { verify: true });   // 쓰기 전에는 계정이 살아 있는지 확인
    const { keys } = await body(req);
    if (!keys || typeof keys !== "object" || Array.isArray(keys)) throw new HttpError(400, "잘못된 요청이에요.");
    for (const [k, e] of Object.entries(keys)) {
      if (k.length > 200 || !e || typeof e !== "object" || (e.v !== null && typeof e.v !== "string") || typeof e.t !== "number") {
        throw new HttpError(400, "잘못된 요청이에요.");
      }
    }
    const t = Date.now();
    // 처음 맞힌 문제마다 1포인트 — 맞힌 문제 목록은 이 파일에 같이 저장 (쓰기 한 번)
    const prev = await readJson(`data/${u}.json`);
    const { earned, added } = await mergeEarned(u, prev, keys["story-progress-v1"] && keys["story-progress-v1"].v);
    await writeJson(`data/${u}.json`, { keys, t, earned });
    return json({ ok: true, t, points: await pointsAfterEarn(u, earned, added) });
  });
}
