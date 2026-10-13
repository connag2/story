// Blob → Upstash Redis 옮기기 (관리자만)
//   POST /api/migrate  → { copied, skipped }
// Blob 저장소가 한도 초과로 멈췄다가 다시 열렸을 때(다음 달 또는 요금제 변경) 한 번 누르면
// 예전 계정·학습 기록·댓글·포인트·이모티콘을 Redis 로 가져와요. 이미 Redis 에 있는 것은 덮어쓰지 않아요.
import { HttpError, authUser, copyBlobToRedis, handle, json } from "./_lib.js";
import { isAdmin } from "./_points.js";

export function POST(req) {
  return handle(async () => {
    const { rec } = await authUser(req, { fresh: true });
    if (!isAdmin(rec.name)) throw new HttpError(403, "관리자만 할 수 있어요.");
    try { return json(await copyBlobToRedis()); }
    catch (e) { if (e instanceof HttpError) throw e; console.error(e); throw new HttpError(503, "Blob 이 아직 닫혀 있어서 옮기지 못했어요. 한도가 풀린 뒤 다시 눌러 주세요."); }
  });
}
