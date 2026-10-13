// 포인트 장부 · 관리자 · 정지 목록 (서버 공용)
//   맞힌 문제 목록(earned)은 학습 기록 파일 data/<uid>.json 에 같이 저장 → 동기화할 때 쓰기 한 번으로 끝 (저장소 아끼기)
//   points/<uid>.json = { bonus(이모티콘 판매 수익), spent, owned: [이모티콘id], earned(예전 방식 — 그대로 합쳐서 셈) }
//   잔액 = 맞힌 문제 수(한 문제 처음 맞히면 1점) + bonus − spent
import { HttpError, readJson, writeJson } from "./_lib.js";

const MAX_EARNED = 20000;
const PROBLEM_ID = /^[\w-]{1,40}\/[\w.-]{1,40}\/\d{1,3}-\d{1,3}$/;

const readLedger = async (uid, ttl = 0) => (await readJson(`points/${uid}.json`, ttl)) || {};
// ttl: 읽기만 할 때 잠깐 기억 (포인트를 바꾸는 곳은 ttl 없이 새로 읽기)
export async function loadPoints(uid, ttl = 0) {
  const [p, d] = await Promise.all([readLedger(uid, ttl), readJson(`data/${uid}.json`, ttl)]);
  const earned = [...new Set([...(p.earned || []), ...((d && d.earned) || [])])];
  return { earned, bonus: p.bonus || 0, spent: p.spent || 0, owned: p.owned || [] };
}
export const savePoints = (uid, p) => writeJson(`points/${uid}.json`, p);
export const balance = (p) => p.earned.length + p.bonus - p.spent;
export const pointsView = (p) => ({ points: balance(p), solved: p.earned.length, bonus: p.bonus, spent: p.spent, owned: p.owned });

// 동기화(PUT) 때: 이전 기록 파일의 earned 에 새로 맞힌 문제를 더한 목록을 돌려줌. 한 번 받은 점수는 다시 풀거나 지워도 그대로.
//   prev = 이전 data 파일, 처음이면 예전 장부의 earned 로 시작
export async function mergeEarned(uid, prev, progressJson) {
  let earned = prev && Array.isArray(prev.earned) ? prev.earned.slice() : ((await readLedger(uid)).earned || []).slice();
  let prog = null;
  try { prog = JSON.parse(progressJson || "null"); } catch (e) { prog = null; }
  const have = new Set(earned);
  let added = 0;
  if (prog && typeof prog === "object") {
    for (const [id, st] of Object.entries(prog)) {
      if (st !== "o" || have.has(id) || !PROBLEM_ID.test(id)) continue;
      if (earned.length >= MAX_EARNED) break;
      earned.push(id); have.add(id); added++;
    }
  }
  return { earned, added };
}
// 새로 맞힌 게 있을 때만 장부를 읽어 잔액을 알려 줌
export async function pointsAfterEarn(uid, earned, added) {
  if (!added) return null;
  const p = await readLedger(uid);
  const all = [...new Set([...(p.earned || []), ...earned])];
  return { added, ...pointsView({ earned: all, bonus: p.bonus || 0, spent: p.spent || 0, owned: p.owned || [] }) };
}

// ── 관리자 (Vercel 환경 변수 ADMIN_NAMES="이름1,이름2")
export const isAdmin = (name) =>
  (process.env.ADMIN_NAMES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    .includes(String(name || "").toLowerCase());

// ── 글쓰기 정지
const BANS = "mod/bans.json";
export async function loadBans(ttl = 0) { return (await readJson(BANS, ttl)) || { users: [] }; }
export const saveBans = (b) => writeJson(BANS, b);
export async function assertNotBanned(uid) {
  const b = await loadBans(60_000);
  if (b.users.some((x) => x.uid === uid)) throw new HttpError(403, "관리자가 글쓰기를 막아 둔 계정이에요.");
}

// 신고가 이만큼 쌓이면 자동으로 가림 (관리자가 다시 풀 수 있음)
export const REPORT_HIDE = 3;
