// 로그인 API 점검 (서버 없이 함수를 바로 호출, 메모리 저장소 사용): node scripts/test-api.js
import assert from "node:assert/strict";
import { POST as auth } from "../api/auth.js";
import { GET as pull, PUT as push } from "../api/sync.js";
import { GET as cget, POST as cpost } from "../api/comments.js";
import { GET as eget, POST as epost } from "../api/emoticons.js";
import { GET as pget } from "../api/points.js";

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

// ── 대댓글 · 신고 · 가림 · 정지
const tokC = (await A({ action: "signup", name: "셋째", password: "1234" })).data.token;
const tokD = (await A({ action: "signup", name: "넷째", password: "1234" })).data.token;
const root = (await C({ action: "add", key: "general", kind: "opinion", text: "원글입니다" }, tokA)).data.item;
const rep = (await C({ action: "add", key: "general", kind: "bug", text: "답글입니다", parent: root.id }, tokB)).data.item;
assert.equal(rep.parent, root.id);
assert.equal(rep.kind, "opinion", "답글은 종류 없이 의견");
await new Promise((ok) => setTimeout(ok, 0));
// 원글 삭제 → 답글이 있으니 "삭제된 댓글"로 남음
assert.equal((await C({ action: "del", id: root.id }, tokA)).status, 200);
let all = (await call(cget, { method: "GET" })).data.items;
assert.ok(all.find((x) => x.id === root.id).deleted, "원글 소프트 삭제");
// 신고 3명 → 자동 가림, 글쓴이·관리자는 내용 보임, 남에게는 빈칸
for (const t of [tokA, tokC, tokD]) await C({ action: "report", id: rep.id }, t);
const seenByOther = (await call(cget, { method: "GET", token: tokC })).data.items.find((x) => x.id === rep.id);
assert.ok(seenByOther.hidden && seenByOther.text === "", "신고 3번 → 가림");
assert.equal((await call(cget, { method: "GET", token: tokM })).data.items.find((x) => x.id === rep.id).text, "답글입니다", "관리자는 보임");
assert.equal((await C({ action: "report", id: rep.id }, tokB)).status, 400, "내 글 신고 불가");
await C({ action: "hide", id: rep.id, hidden: false }, tokM);
assert.equal((await call(cget, { method: "GET", token: tokC })).data.items.find((x) => x.id === rep.id).hidden, false, "관리자가 풀기");
// 정지
assert.equal((await C({ action: "ban", id: rep.id }, tokA)).status, 403);
assert.equal((await C({ action: "ban", id: rep.id }, tokM)).data.bans[0].name, "다른사람");
assert.equal((await C({ action: "add", key: "general", kind: "opinion", text: "정지 중 글" }, tokB)).status, 403, "정지된 사람 글쓰기");
await C({ action: "unban", name: "다른사람" }, tokM);
// 답글 지우면 삭제된 원글 자리도 정리
assert.equal((await C({ action: "del", id: rep.id }, tokB)).status, 200);
all = (await call(cget, { method: "GET" })).data.items;
assert.ok(!all.find((x) => x.id === root.id), "남은 답글 없으면 원글 자리 정리");

// ── 포인트: 처음 맞힌 문제마다 1점, 다시 풀거나 지워도 그대로
const P = (t) => call(pget, { method: "GET", token: t });
const prog = (o) => ({ keys: { "story-progress-v1": { v: JSON.stringify(o), t: Date.now() } } });
await call(push, { method: "PUT", token: tokA, body: prog({ "math/1/0-0": "o", "math/1/0-1": "x", "math/1/0-2": "o", "../evil": "o" }) });
assert.equal((await P(tokA)).data.points, 2, "맞힌 2문제 = 2점 (틀린 것·이상한 id 제외)");
await call(push, { method: "PUT", token: tokA, body: prog({ "math/1/0-0": "o", "math/1/0-1": "o" }) });
assert.equal((await P(tokA)).data.points, 3, "새로 맞힌 1문제 추가, 빠진 것도 유지");
await call(push, { method: "PUT", token: tokA, body: prog({}) });
assert.equal((await P(tokA)).data.points, 3, "기록 지워도 포인트 유지");

// ── 이모티콘: 올리기 · 사기 · 판매 수익 · 댓글에 쓰기
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const E = (body, t) => call(epost, { body, token: t });
assert.equal((await E({ action: "create", name: "곰", price: 2, images: ["data:text/html;base64,AAAA"] }, tokB)).status, 400, "이미지 아닌 것");
r = await E({ action: "create", name: "곰돌이콘", desc: "귀여운 곰", price: 2, images: [png, png, png] }, tokB);
assert.equal(r.status, 200);
const pack = r.data.pack;
assert.ok(pack.owned && pack.mine, "만든 사람은 바로 가짐");
assert.equal((await call(eget, { method: "GET" })).data.packs.length, 1);
assert.equal((await call(eget, { method: "GET" })).data.packs[0].thumb, png);
assert.equal((await call(eget, { method: "GET", body: undefined })).status, 200);
const bad = await C({ action: "add", key: "general", kind: "opinion", text: `[[emo:${pack.id}:0]]` }, tokC);
assert.equal(bad.status, 403, "안 산 이모티콘 사용");
assert.equal((await E({ action: "buy", id: pack.id }, tokC)).status, 400, "포인트 부족(0점)");
r = await E({ action: "buy", id: pack.id }, tokA);
assert.equal(r.status, 200);
assert.equal(r.data.points.points, 1, "3 − 2 = 1");
assert.equal((await P(tokB)).data.points, 2, "판 사람 +2");
assert.equal((await E({ action: "buy", id: pack.id }, tokA)).status, 400, "중복 구매");
r = await C({ action: "add", key: "general", kind: "opinion", text: `[[emo:${pack.id}:1]]` }, tokA);
assert.equal(r.status, 200, "산 이모티콘만으로 댓글");
assert.equal((await call(eget, { method: "GET", token: tokA, body: undefined })).status, 200);
const detail = await call(async (rq) => eget(new Request(`http://x/api?id=${pack.id}`, { headers: rq.headers })), { method: "GET" });
assert.equal(detail.data.images.length, 3);
assert.equal((await E({ action: "delete", id: pack.id }, tokB)).status, 400, "팔린 묶음은 만든 사람이 못 지움");
for (const t of [tokA, tokC, tokD]) await E({ action: "report", id: pack.id }, t);
assert.equal((await call(eget, { method: "GET", token: tokC })).data.packs.length, 0, "신고 3번 → 상점에서 가림");
assert.equal((await call(eget, { method: "GET", token: tokA })).data.packs.length, 1, "이미 산 사람은 계속 보임");
console.log("ok — 대댓글·신고·가림·정지 · 포인트 · 이모티콘 상점 통과");
console.log("ok — 댓글 게시판 (글쓰기·좋아요·삭제 권한·관리자 상태·도배 방지) 통과");
console.log("ok — 로그인 API (가입·로그인·복구·변경·전체 로그아웃·삭제·잠금) 통과");
