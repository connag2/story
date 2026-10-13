// 댓글 · 피드백 게시판 (모든 사람이 함께 봄)
//   GET  /api/comments?key=unit:math/2   → { items, admin }   key 없으면 전체(최신순)
//   POST /api/comments  (로그인 필요)
//     { action: "add", key, kind, text, parent? }   kind: opinion | tip | request | bug, parent = 답글 달 글 id
//         text 안의 [[emo:묶음id:번호]] 는 이모티콘 (가진 것만 쓸 수 있음)
//     { action: "del", id }                글쓴이 또는 관리자 (답글이 있으면 "삭제된 댓글"로 남김)
//     { action: "like", id }               👍 누르기/취소
//     { action: "report", id }             신고 (3명이면 자동으로 가림)
//     { action: "status", id, status }     관리자: "" | checking | planned | done
//     { action: "hide", id, hidden }       관리자: 가리기/풀기
//     { action: "ban", id } / { action: "unban", name } / { action: "bans" }   관리자: 글쓴이 글쓰기 정지
// 관리자: Vercel 환경 변수 ADMIN_NAMES 에 이름을 쉼표로 (예: 수아,민수)
import { randomBytes } from "node:crypto";
import { HttpError, authUser, body, handle, json, readJson, readToken, writeJson } from "./_lib.js";
import { REPORT_HIDE, assertNotBanned, isAdmin, loadBans, loadPoints, saveBans } from "./_points.js";

const PATH = "comments/all.json";
const KINDS = ["opinion", "tip", "request", "bug"];
const STATUS = ["", "checking", "planned", "done"];
const MAX_ITEMS = 3000;
const EMO = /\[\[emo:([\w-]{1,20}):(\d{1,2})\]\]/g;

async function load(ttl = 0) { return (await readJson(PATH, ttl)) || { items: [] }; }
const isHidden = (it) => it.adminHidden === true || (it.adminHidden !== false && (it.reports || []).length >= REPORT_HIDE);

// 보내는 모양: 누가 눌렀는지·신고했는지 목록 대신 개수와 "내가 했는지"만
function view(it, uid, admin) {
  const hidden = isHidden(it);
  return {
    id: it.id, key: it.key, kind: it.kind, parent: it.parent || null,
    text: it.deleted ? "" : hidden && !admin && it.uid !== uid ? "" : it.text,
    name: it.deleted ? "" : it.name, t: it.t, status: it.status || "",
    deleted: !!it.deleted, hidden,
    likes: (it.likes || []).length, liked: !!uid && (it.likes || []).includes(uid),
    reported: !!uid && (it.reports || []).includes(uid),
    mine: !!uid && it.uid === uid, canDelete: !it.deleted && !!uid && (it.uid === uid || admin),
    ...(admin ? { reports: (it.reports || []).length } : {}),
  };
}

// 로그인했으면 누구인지 (안 했으면 null) — 읽기는 로그인 없이도 됨
function whoMaybe(req) {
  try { return readToken(req); } catch (e) { return null; }
}

export function GET(req) {
  return handle(async () => {
    const key = new URL(req.url).searchParams.get("key");
    const me = whoMaybe(req);
    const admin = !!me && isAdmin(me.n);
    const { items } = await load(15_000);            // 읽기만 할 때는 15초 기억 (Blob 연산 아끼기)
    const list = (key ? items.filter((it) => it.key === key) : items)
      .slice().sort((a, b) => b.t - a.t).slice(0, 400)
      .map((it) => view(it, me && me.u, admin));
    return json({ items: list, admin }, 200, "private, max-age=10");
  });
}

export function POST(req) {
  return handle(async () => {
    const b = await body(req, 20_000);
    const { id: uid, rec } = await authUser(req);
    const admin = isAdmin(rec.name);
    const data = await load();
    const find = () => {
      const it = data.items.find((x) => x.id === b.id);
      if (!it) throw new HttpError(404, "글을 찾을 수 없어요. 이미 지워졌을 수 있어요.");
      return it;
    };
    const needAdmin = () => { if (!admin) throw new HttpError(403, "관리자만 할 수 있어요."); };

    switch (b.action) {
      case "add": {
        await assertNotBanned(uid);
        const key = String(b.key || "");
        if (!/^(general|guide:[\w-]+|unit:[\w-]+\/[\w.-]+)$/.test(key)) throw new HttpError(400, "잘못된 위치예요.");
        let parent = null;
        if (b.parent) {
          const p = data.items.find((x) => x.id === b.parent);
          if (!p || p.deleted) throw new HttpError(404, "답글을 달 글이 없어요.");
          parent = p.parent || p.id;               // 답글의 답글은 같은 글 아래로 (한 단계만)
        }
        const kind = parent ? "opinion" : b.kind;
        if (!KINDS.includes(kind)) throw new HttpError(400, "글 종류를 골라 주세요.");
        const text = String(b.text || "").replace(/\r\n/g, "\n").trim();
        if (text.length > 1000) throw new HttpError(400, "1000자 이하로 써 주세요.");
        // 이모티콘: 가진 묶음만, 최대 10개
        const emos = [...text.matchAll(EMO)];
        if (emos.length > 10) throw new HttpError(400, "이모티콘은 한 글에 10개까지 써요.");
        if (emos.length) {
          const owned = new Set((await loadPoints(uid)).owned);
          for (const m of emos) if (!owned.has(m[1])) throw new HttpError(403, "가지고 있지 않은 이모티콘이 있어요.");
        }
        if (!text.replace(EMO, "").trim() && !emos.length) throw new HttpError(400, "내용을 써 주세요.");
        const last = data.items.filter((x) => x.uid === uid).reduce((m, x) => Math.max(m, x.t), 0);
        if (Date.now() - last < 10_000) throw new HttpError(429, "조금 뒤에 다시 올려 주세요. (10초)");
        const it = { id: randomBytes(6).toString("base64url"), key, kind, parent, text, name: rec.name, uid, t: Date.now(), likes: [], reports: [], status: "" };
        data.items.push(it);
        if (data.items.length > MAX_ITEMS) data.items.splice(0, data.items.length - MAX_ITEMS);
        await writeJson(PATH, data);
        return json({ item: view(it, uid, admin) });
      }
      case "del": {
        const it = find();
        if (it.uid !== uid && !admin) throw new HttpError(403, "내가 쓴 글만 지울 수 있어요.");
        if (data.items.some((x) => x.parent === it.id)) { it.deleted = true; it.text = ""; }
        else {
          data.items = data.items.filter((x) => x !== it);
          // 이미 지워진 원글 밑에 답글이 하나도 안 남으면 원글 자리도 정리
          const par = it.parent && data.items.find((x) => x.id === it.parent);
          if (par && par.deleted && !data.items.some((x) => x.parent === par.id)) data.items = data.items.filter((x) => x !== par);
        }
        await writeJson(PATH, data);
        return json({ ok: true });
      }
      case "like": {
        const it = find();
        it.likes = it.likes || [];
        const i = it.likes.indexOf(uid);
        if (i >= 0) it.likes.splice(i, 1); else it.likes.push(uid);
        await writeJson(PATH, data);
        return json({ item: view(it, uid, admin) });
      }
      case "report": {
        const it = find();
        if (it.uid === uid) throw new HttpError(400, "내 글은 신고할 수 없어요.");
        it.reports = it.reports || [];
        if (!it.reports.includes(uid)) it.reports.push(uid);
        await writeJson(PATH, data);
        return json({ item: view(it, uid, admin) });
      }
      case "status": {
        needAdmin();
        if (!STATUS.includes(b.status)) throw new HttpError(400, "잘못된 상태예요.");
        const it = find();
        it.status = b.status;
        await writeJson(PATH, data);
        return json({ item: view(it, uid, admin) });
      }
      case "hide": {
        needAdmin();
        const it = find();
        it.adminHidden = !!b.hidden;
        if (!b.hidden) it.reports = [];
        await writeJson(PATH, data);
        return json({ item: view(it, uid, admin) });
      }
      case "ban": {
        needAdmin();
        const it = find();
        if (it.uid === uid) throw new HttpError(400, "나 자신은 정지할 수 없어요.");
        const bans = await loadBans();
        if (!bans.users.some((x) => x.uid === it.uid)) bans.users.push({ uid: it.uid, name: it.name, t: Date.now() });
        await saveBans(bans);
        return json({ bans: bans.users.map((x) => ({ name: x.name, t: x.t })) });
      }
      case "unban": {
        needAdmin();
        const bans = await loadBans();
        bans.users = bans.users.filter((x) => x.name !== b.name);
        await saveBans(bans);
        return json({ bans: bans.users.map((x) => ({ name: x.name, t: x.t })) });
      }
      case "bans": {
        needAdmin();
        return json({ bans: (await loadBans()).users.map((x) => ({ name: x.name, t: x.t })) });
      }
      default:
        throw new HttpError(400, "잘못된 요청이에요.");
    }
  });
}
