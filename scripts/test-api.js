// 로그인 API 점검 (서버 없이 함수를 바로 호출, 메모리 저장소 사용): node scripts/test-api.js
import assert from "node:assert/strict";
import { POST as auth } from "../api/auth.js";
import { GET as pull, PUT as push } from "../api/sync.js";

delete process.env.BLOB_READ_WRITE_TOKEN;
const call = async (fn, { body, token, method = "POST" } = {}) => {
  const r = await fn(new Request("http://x/api", {
    method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
    body: method === "GET" ? undefined : JSON.stringify(body || {}),
  }));
  return { status: r.status, data: await r.json() };
};
const A = (body, token) => call(auth, { body, token });

// 회원가입 → 복구 코드 한 번 받음
let r = await A({ action: "signup", name: "테스트", password: "1234" });
assert.equal(r.status, 200);
assert.match(r.data.recovery, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
const code1 = r.data.recovery;
let t1 = r.data.token;
assert.equal((await A({ action: "signup", name: "테스트", password: "1234" })).status, 409, "같은 이름 중복 가입");
assert.equal((await A({ action: "signup", name: "x", password: "1234" })).status, 400, "이름 규칙");
assert.equal((await A({ action: "signup", name: "새사람", password: "12" })).status, 400, "짧은 비밀번호");

// 동기화
assert.equal((await call(push, { method: "PUT", token: t1, body: { keys: { a: { v: "1", t: 1 } } } })).status, 200);
assert.equal((await call(pull, { method: "GET", token: t1 })).data.keys.a.v, "1");
assert.equal((await call(pull, { method: "GET" })).status, 401, "토큰 없음");

// 로그인 / 틀린 비밀번호
assert.equal((await A({ action: "login", name: "테스트", password: "1234" })).status, 200);
assert.equal((await A({ action: "login", name: "테스트", password: "nope" })).status, 401);
assert.equal((await A({ action: "me" }, t1)).data.name, "테스트");

// 복구 코드로 비밀번호 재설정 → 예전 토큰은 무효, 새 복구 코드 발급, 코드는 소문자·하이픈 없이도 됨
r = await A({ action: "reset", name: "테스트", recovery: code1.toLowerCase().replace(/-/g, ""), newPassword: "abcd" });
assert.equal(r.status, 200);
assert.notEqual(r.data.recovery, code1);
assert.equal((await call(pull, { method: "GET", token: t1 })).status, 401, "재설정 뒤 예전 토큰");
t1 = r.data.token;
assert.equal((await A({ action: "reset", name: "테스트", recovery: code1, newPassword: "zzzz" })).status, 401, "쓴 복구 코드 재사용");
assert.equal((await A({ action: "login", name: "테스트", password: "abcd" })).status, 200);

// 비밀번호 바꾸기
assert.equal((await A({ action: "change", password: "wrong", newPassword: "efgh" }, t1)).status, 401);
r = await A({ action: "change", password: "abcd", newPassword: "efgh" }, t1);
assert.equal(r.status, 200);
assert.equal((await A({ action: "me" }, t1)).status, 401, "바꾼 뒤 다른 기기 토큰");
let t2 = r.data.token;
assert.equal((await A({ action: "me" }, t2)).status, 200, "바꾼 기기는 그대로");

// 다른 기기 모두 로그아웃
const other = (await A({ action: "login", name: "테스트", password: "efgh" })).data.token;
r = await A({ action: "logoutAll" }, t2);
assert.equal((await A({ action: "me" }, other)).status, 401);
t2 = r.data.token;

// 복구 코드 새로 받기 (비밀번호 필요)
assert.equal((await A({ action: "recovery", password: "x" }, t2)).status, 401);
assert.match((await A({ action: "recovery", password: "efgh" }, t2)).data.recovery, /-/);

// 계정 삭제 → 기록도 지워짐
assert.equal((await A({ action: "delete", password: "efgh" }, t2)).status, 200);
assert.equal((await A({ action: "login", name: "테스트", password: "efgh" })).status, 404);
assert.equal((await A({ action: "signup", name: "테스트", password: "1234" })).status, 200, "지운 이름 다시 가입");

// 연속 실패 잠금
for (let i = 0; i < 5; i++) await A({ action: "login", name: "테스트", password: "bad" });
assert.equal((await A({ action: "login", name: "테스트", password: "1234" })).status, 429);

console.log("ok — 로그인 API (가입·로그인·복구·변경·전체 로그아웃·삭제·잠금) 통과");
