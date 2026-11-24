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
//
// 비밀번호와 함께 브라우저가 계산한 pk(password 의 키) · newPk(newPassword 의 키)를 같이 보내요 (api/_lib.js pwKey).
//   새 방식(kdf: 2) 계정은 서버가 sha256 하나만 계산 → Cloudflare 무료 CPU 한도(10ms) 안.
//   예전 방식(scrypt) 계정은 한 번 로그인하면 새 방식으로 바뀌어요.
import {
  HttpError, authUser, body, checkPassword, handle, json, makeRecoveryCode, makeToken,
  normCode, normName, pwKey, quickCheck, quickHash, readJson, removeJson, userId, writeJson,
} from "./_lib.js";

const MAX_FAILS = 5;            // 연속 실패 허용 횟수
const LOCK_MS = 5 * 60 * 1000;  // 잠금 시간

function checkNewPassword(pw) {
  const p = String(pw || "");
  if (p.length < 4 || p.length > 100) throw new HttpError(400, "비밀번호는 4자 이상으로 해 주세요.");
  return p;
}

// pk: 브라우저가 보낸 값, 없으면(옛 화면) 서버가 계산
const keyOf = (name, pw, pk) => (typeof pk === "string" && /^[\w-]{43}$/.test(pk) ? pk : pwKey(name, pw));
async function setPassword(rec, name, pw, pk) {
  Object.assign(rec, quickHash(await keyOf(name, checkNewPassword(pw), pk)), { kdf: 2 });
}

// 비밀번호(또는 복구 코드) 확인 + 연속 실패 잠금
//   돌려주는 값: 계정 파일을 다시 써야 하면 true (실패 기록이 지워졌거나 새 방식으로 바뀜) — 쓸데없는 쓰기를 줄여요
async function verify(path, rec, b, field = "password") {
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
    throw new HttpError(429, "여러 번 틀려서 잠시 잠겼어요. 5분 뒤 다시 해 주세요.");
  }
  let ok, upgraded = false;
  if (field === "password") {
    if (rec.kdf === 2) ok = quickCheck(await keyOf(rec.name, b.password, b.pk), rec);
    else {                                                          // 예전 방식 → 맞으면 새 방식으로 바꿔 둠
      ok = await checkPassword(String(b.password || ""), rec);
      if (ok) { Object.assign(rec, quickHash(await keyOf(rec.name, b.password, b.pk)), { kdf: 2 }); upgraded = true; }
    }
  } else {
    const code = normCode(b.recovery);
    ok = !!rec.rhash && (rec.rkdf === 2 ? quickCheck(code, { salt: rec.rsalt, hash: rec.rhash }) : await checkPassword(code, { salt: rec.rsalt, hash: rec.rhash }));
  }
  if (!ok) {
    rec.fails = (rec.fails || 0) + 1;
    if (rec.fails >= MAX_FAILS) { rec.fails = 0; rec.lockedUntil = Date.now() + LOCK_MS; }
    await writeJson(path, rec);
    throw new HttpError(401, field === "password" ? "비밀번호가 맞지 않아요." : "복구 코드가 맞지 않아요.");
  }
  if (rec.fails || rec.lockedUntil) { rec.fails = 0; delete rec.lockedUntil; return true; }
  return upgraded;
}

// 복구 코드는 12자리 무작위(약 60비트)라 가벼운 sha256 으로 충분해요
function newRecovery(rec) {
  const code = makeRecoveryCode();
  const h = quickHash(normCode(code));
  rec.rsalt = h.salt; rec.rhash = h.hash; rec.rkdf = 2;
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
        const nr = { name, created: Date.now(), fails: 0, tv: 0 };
        await setPassword(nr, name, b.password, b.pk);
        const recovery = newRecovery(nr);
        await writeJson(path, nr);
        return json({ token: makeToken(id, name, 0), name, recovery });
      }
      if (!rec) throw new HttpError(404, "없는 이름이에요. 처음이라면 '회원가입'을 눌러 주세요.");

      if (action === "login") {
        if (await verify(path, rec, b)) await writeJson(path, rec);   // 바뀐 게 없으면 쓰지 않음
        return json({ token: makeToken(id, rec.name, rec.tv || 0), name: rec.name });
      }

      // reset: 복구 코드로 비밀번호 다시 정하기
      await verify(path, rec, b, "recovery");
      await setPassword(rec, rec.name, b.newPassword, b.newPk);
      rec.tv = (rec.tv || 0) + 1;
      const recovery = newRecovery(rec);
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
        await verify(path, rec, b);
        await setPassword(rec, rec.name, b.newPassword, b.newPk);
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
        await verify(path, rec, b);
        const recovery = newRecovery(rec);
        await writeJson(path, rec);
        return json({ recovery });
      }
      case "delete": {
        await verify(path, rec, b);
        await removeJson([path, `data/${id}.json`]);
        return json({ ok: true });
      }
      default:
        throw new HttpError(400, "잘못된 요청이에요.");
    }
  });
}
