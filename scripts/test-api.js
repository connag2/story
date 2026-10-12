// 로그인 API 점검 (서버 없이 함수를 바로 호출, 메모리 저장소 사용): node scripts/test-api.js
import assert from "node:assert/strict";
import { POST as auth } from "../api/auth.js";
import { GET as pull, PUT as push } from "../api/sync.js";
import { GET as cget, POST as cpost } from "../api/comments.js";

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


// ── 댓글 게시판
process.env.ADMIN_NAMES = "관리자";
const tokA = (await A({ action: "signup", name: "글쓴이", password: "1234" })).data.token;
const tokB = (await A({ action: "signup", name: "다른사람", password: "1234" })).data.token;
const tokM = (await A({ action: "signup", name: "관리자", password: "1234" })).data.token;
const C = (body, token) => call(cpost, { body, token });
const list = async (key, token) => (await call(cget, { method: "GET", token })).data; // 전체
assert.equal((await C({ action: "add", key: "unit:math/2", kind: "tip", text: "공식은 손으로 써요" })).status, 401, "로그인 없이 글쓰기");
r = await C({ action: "add", key: "unit:math/2", kind: "tip", text: "공식은 손으로 <b>써요</b>" }, tokA);
assert.equal(r.status, 200);
const cid = r.data.item.id;
assert.equal(r.data.item.text, "공식은 손으로 <b>써요</b>", "글은 그대로 저장(화면에서는 글자로만 표시)");
assert.equal((await C({ action: "add", key: "unit:math/2", kind: "tip", text: "또 씀" }, tokA)).status, 429, "10초 도배 방지");
assert.equal((await C({ action: "add", key: "../etc", kind: "tip", text: "xx" }, tokB)).status, 400, "잘못된 위치");
assert.equal((await C({ action: "add", key: "general", kind: "nope", text: "xx" }, tokB)).status, 400, "잘못된 종류");
const byKey = (await call(cget, { method: "GET" })).data;
assert.equal(byKey.items.length, 1);
assert.equal((await C({ action: "like", id: cid }, tokB)).data.item.likes, 1);
assert.equal((await C({ action: "like", id: cid }, tokB)).data.item.likes, 0, "좋아요 취소");
assert.equal((await C({ action: "del", id: cid }, tokB)).status, 403, "남의 글 삭제");
assert.equal((await C({ action: "status", id: cid, status: "done" }, tokA)).status, 403, "관리자 아님");
assert.equal((await C({ action: "status", id: cid, status: "planned" }, tokM)).data.item.status, "planned");
assert.equal((await call(cget, { method: "GET", token: tokM })).data.admin, true);
assert.equal((await C({ action: "del", id: cid }, tokA)).status, 200, "내 글 삭제");
assert.equal((await call(cget, { method: "GET" })).data.items.length, 0);
console.log("ok — 댓글 게시판 (글쓰기·좋아요·삭제 권한·관리자 상태·도배 방지) 통과");
console.log("ok — 로그인 API (가입·로그인·복구·변경·전체 로그아웃·삭제·잠금) 통과");
