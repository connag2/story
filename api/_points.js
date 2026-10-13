// 포인트 장부 · 관리자 · 정지 목록 (서버 공용)
//   points/<uid>.json = { earned: [문제id...], bonus, spent, owned: [이모티콘id...] }
//   잔액 = earned.length(한 문제 처음 맞히면 1점) + bonus(이모티콘 판매 수익) − spent
import { createHash } from "node:crypto";
import { HttpError, readJson, writeJson } from "./_lib.js";

const MAX_EARNED = 20000;
const PROBLEM_ID = /^[\w-]{1,40}\/[\w.-]{1,40}\/\d{1,3}-\d{1,3}$/;

// ttl: 읽기만 할 때 잠깐 기억 (포인트를 바꾸는 곳은 ttl 없이 새로 읽기)
export async function loadPoints(uid, ttl = 0) {
  const p = (await readJson(`points/${uid}.json`, ttl)) || {};
  return { earned: p.earned || [], bonus: p.bonus || 0, spent: p.spent || 0, owned: p.owned || [] };
}
export const savePoints = (uid, p) => writeJson(`points/${uid}.json`, p);
export const balance = (p) => p.earned.length + p.bonus - p.spent;
export const pointsView = (p) => ({ points: balance(p), solved: p.earned.length, bonus: p.bonus, spent: p.spent, owned: p.owned });

// 동기화된 학습 기록(story-progress-v1)에서 처음 맞힌 문제를 장부에 더함. 한 번 받은 점수는 다시 풀거나 지워도 그대로.
const seenO = new Map();   // uid → 마지막으로 확인한 "맞힌 문제 목록" 지문(hash)
export async function earnFromProgress(uid, progressJson) {
  let prog = null;
  try { prog = JSON.parse(progressJson || "null"); } catch (e) { return null; }
  if (!prog || typeof prog !== "object") return null;
  // 맞힌 문제 목록이 지난번(이 서버 인스턴스에서 본 것)과 같으면 장부를 읽지 않음 → Blob 연산 아끼기
  const nO = createHash("sha1").update(Object.keys(prog).filter((k) => prog[k] === "o").sort().join("|")).digest("base64");
  if (seenO.get(uid) === nO) return null;
  const p = await loadPoints(uid);
  const have = new Set(p.earned);
  let added = 0;
  for (const [id, st] of Object.entries(prog)) {
    if (st !== "o" || have.has(id) || !PROBLEM_ID.test(id)) continue;
    if (p.earned.length >= MAX_EARNED) break;
    p.earned.push(id); have.add(id); added++;
  }
  if (added) await savePoints(uid, p);
  if (seenO.size > 2000) seenO.clear();
  seenO.set(uid, nO);
  return { added, ...pointsView(p) };
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
