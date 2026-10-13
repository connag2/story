// POST /api/auth  { action, ... }
//   signup   { name, password }                 → { token, name, recovery }   복구 코드는 이때 한 번만 보여 줌
//   login    { name, password }                 → { token, name }
//   reset    { name, recovery, newPassword }    → { token, name, recovery }   비밀번호를 잊었을 때 (새 복구 코드 발급)
//   --- 아래는 로그인 토큰(Authorization: Bearer) 필요 ---
//   change   { password, newPassword }          → { token }                    비밀번호 바꾸기 (다른 기기는 로그아웃)
//   logoutAll{ }                                → { token }                    다른 기기 모두 로그아웃
//   recovery { password }                       → { recovery }                 복구 코드 새로 받기
//   delete   { password }                       → { ok }                       계정과 기록 삭제
//   me       { }                                → { name, created }
import {
  HttpError, authUser, body, checkPassword, handle, hashPassword, json, makeRecoveryCode, makeToken,
  normCode, normName, readJson, removeJson, userId, writeJson,
} from "./_lib.js";

const MAX_FAILS = 5;            // 연속 실패 허용 횟수
const LOCK_MS = 5 * 60 * 1000;  // 잠금 시간

function checkNewPassword(pw) {
  const p = String(pw || "");
  if (p.length < 4 || p.length > 100) throw new HttpError(400, "비밀번호는 4자 이상으로 해 주세요.");
  return p;
}

// 비밀번호(또는 복구 코드) 확인 + 연속 실패 잠금
async function verify(path, rec, secret, field = "password") {
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
    throw new HttpError(429, "여러 번 틀려서 잠시 잠겼어요. 5분 뒤 다시 해 주세요.");
  }
  const ok = field === "password"
    ? await checkPassword(String(secret || ""), rec)
    : !!rec.rhash && await checkPassword(normCode(secret), { salt: rec.rsalt, hash: rec.rhash });
  if (!ok) {
    rec.fails = (rec.fails || 0) + 1;
    if (rec.fails >= MAX_FAILS) { rec.fails = 0; rec.lockedUntil = Date.now() + LOCK_MS; }
    await writeJson(path, rec);
    throw new HttpError(401, field === "password" ? "비밀번호가 맞지 않아요." : "복구 코드가 맞지 않아요.");
  }
  if (rec.fails || rec.lockedUntil) { rec.fails = 0; delete rec.lockedUntil; }
}

async function newRecovery(rec) {
  const code = makeRecoveryCode();
  const h = await hashPassword(normCode(code));
  rec.rsalt = h.salt; rec.rhash = h.hash;
  return code;
}

export function POST(req) {
  return handle(async () => {
    const b = await body(req, 10_000);
    const action = b.action;

    // ── 로그인 전
    if (action === "signup" || action === "login" || action === "reset") {
      const name = normName(b.name);
      const id = userId(name);
      const path = `users/${id}.json`;
      const rec = await readJson(path);

      if (action === "signup") {
        if (rec) throw new HttpError(409, "이미 있는 이름이에요. 다른 이름을 쓰거나 로그인해 주세요.");
        const pw = checkNewPassword(b.password);
        const nr = { name, ...(await hashPassword(pw)), created: Date.now(), fails: 0, tv: 0 };
        const recovery = await newRecovery(nr);
        await writeJson(path, nr);
        return json({ token: makeToken(id, name, 0), name, recovery });
      }
      if (!rec) throw new HttpError(404, "없는 이름이에요. 처음이라면 '회원가입'을 눌러 주세요.");

      if (action === "login") {
        await verify(path, rec, b.password);
        await writeJson(path, rec);
        return json({ token: makeToken(id, rec.name, rec.tv || 0), name: rec.name });
      }

      // reset: 복구 코드로 비밀번호 다시 정하기
      await verify(path, rec, b.recovery, "recovery");
      Object.assign(rec, await hashPassword(checkNewPassword(b.newPassword)));
      rec.tv = (rec.tv || 0) + 1;
      const recovery = await newRecovery(rec);
      await writeJson(path, rec);
      return json({ token: makeToken(id, rec.name, rec.tv), name: rec.name, recovery });
    }

    // ── 로그인 후
    const { id, rec } = await authUser(req, { fresh: true });
    const path = `users/${id}.json`;
    switch (action) {
      case "me":
        return json({ name: rec.name, created: rec.created, hasRecovery: !!rec.rhash });
      case "change": {
        await verify(path, rec, b.password);
        Object.assign(rec, await hashPassword(checkNewPassword(b.newPassword)));
        rec.tv = (rec.tv || 0) + 1;
        await writeJson(path, rec);
        return json({ token: makeToken(id, rec.name, rec.tv) });
      }
      case "logoutAll": {
        rec.tv = (rec.tv || 0) + 1;
        await writeJson(path, rec);
        return json({ token: makeToken(id, rec.name, rec.tv) });
      }
      case "recovery": {
        await verify(path, rec, b.password);
        const recovery = await newRecovery(rec);
        await writeJson(path, rec);
        return json({ recovery });
      }
      case "delete": {
        await verify(path, rec, b.password);
        await removeJson([path, `data/${id}.json`]);
        return json({ ok: true });
      }
      default:
        throw new HttpError(400, "잘못된 요청이에요.");
    }
  });
}
