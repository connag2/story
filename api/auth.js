// POST /api/auth  { action: "signup" | "login", name, password }  →  { token, name }
import { HttpError, body, checkPassword, handle, hashPassword, json, makeToken, normName, readJson, userId, writeJson } from "./_lib.js";

const MAX_FAILS = 5;            // 연속 실패 허용 횟수
const LOCK_MS = 5 * 60 * 1000;  // 잠금 시간

export function POST(req) {
  return handle(async () => {
    const { action, name: raw, password } = await body(req, 10_000);
    const name = normName(raw);
    const pw = String(password || "");
    if (pw.length < 4 || pw.length > 100) throw new HttpError(400, "비밀번호는 4자 이상으로 해 주세요.");
    const id = userId(name);
    const path = `users/${id}.json`;
    const rec = await readJson(path);

    if (action === "signup") {
      if (rec) throw new HttpError(409, "이미 있는 이름이에요. 다른 이름을 쓰거나 로그인해 주세요.");
      await writeJson(path, { name, ...(await hashPassword(pw)), created: Date.now(), fails: 0 });
      return json({ token: makeToken(id, name), name });
    }

    if (action === "login") {
      if (!rec) throw new HttpError(404, "없는 이름이에요. 처음이라면 '회원가입'을 눌러 주세요.");
      if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
        throw new HttpError(429, "비밀번호를 여러 번 틀려서 잠시 잠겼어요. 5분 뒤 다시 해 주세요.");
      }
      if (!(await checkPassword(pw, rec))) {
        rec.fails = (rec.fails || 0) + 1;
        if (rec.fails >= MAX_FAILS) { rec.fails = 0; rec.lockedUntil = Date.now() + LOCK_MS; }
        await writeJson(path, rec);
        throw new HttpError(401, "비밀번호가 맞지 않아요.");
      }
      if (rec.fails || rec.lockedUntil) { rec.fails = 0; delete rec.lockedUntil; await writeJson(path, rec); }
      return json({ token: makeToken(id, rec.name), name: rec.name });
    }

    throw new HttpError(400, "잘못된 요청이에요.");
  });
}
