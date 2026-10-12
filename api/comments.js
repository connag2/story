// 댓글 · 피드백 게시판 (모든 사람이 함께 봄)
//   GET  /api/comments?key=unit:math/2   → { items, admin }   key 없으면 전체(최신순)
//   POST /api/comments  (로그인 필요)
//     { action: "add", key, kind, text }   kind: opinion | tip | request | bug
//     { action: "del", id }                글쓴이 또는 관리자
//     { action: "like", id }               👍 누르기/취소
//     { action: "status", id, status }     관리자만: "" | checking | planned | done
// 관리자: Vercel 환경 변수 ADMIN_NAMES 에 이름을 쉼표로 (예: 수아,민수)
import { randomBytes } from "node:crypto";
import { HttpError, authUser, body, handle, json, readJson, readToken, writeJson } from "./_lib.js";

const PATH = "comments/all.json";
const KINDS = ["opinion", "tip", "request", "bug"];
const STATUS = ["", "checking", "planned", "done"];
const MAX_ITEMS = 3000;

const admins = () => (process.env.ADMIN_NAMES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const isAdmin = (name) => admins().includes(String(name || "").toLowerCase());

async function load() { return (await readJson(PATH)) || { items: [] }; }

// 보내는 모양: 누가 눌렀는지 목록 대신 개수와 "내가 눌렀는지"만
function view(it, uid, admin) {
  return {
    id: it.id, key: it.key, kind: it.kind, text: it.text, name: it.name, t: it.t, status: it.status || "",
    likes: (it.likes || []).length, liked: !!uid && (it.likes || []).includes(uid),
    mine: !!uid && it.uid === uid, canDelete: !!uid && (it.uid === uid || admin),
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
    const { items } = await load();
    const list = (key ? items.filter((it) => it.key === key) : items)
      .slice().sort((a, b) => b.t - a.t).slice(0, 300)
      .map((it) => view(it, me && me.u, admin));
    return json({ items: list, admin });
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

    if (b.action === "add") {
      const key = String(b.key || "");
      if (!/^(general|guide:[\w-]+|unit:[\w-]+\/[\w-]+)$/.test(key)) throw new HttpError(400, "잘못된 위치예요.");
      if (!KINDS.includes(b.kind)) throw new HttpError(400, "글 종류를 골라 주세요.");
      const text = String(b.text || "").replace(/\r\n/g, "\n").trim();
      if (text.length < 2) throw new HttpError(400, "두 글자 이상 써 주세요.");
      if (text.length > 1000) throw new HttpError(400, "1000자 이하로 써 주세요.");
      const last = data.items.filter((x) => x.uid === uid).reduce((m, x) => Math.max(m, x.t), 0);
      if (Date.now() - last < 10_000) throw new HttpError(429, "조금 뒤에 다시 올려 주세요. (10초)");
      const it = { id: randomBytes(6).toString("base64url"), key, kind: b.kind, text, name: rec.name, uid, t: Date.now(), likes: [], status: "" };
      data.items.push(it);
      if (data.items.length > MAX_ITEMS) data.items.splice(0, data.items.length - MAX_ITEMS);
      await writeJson(PATH, data);
      return json({ item: view(it, uid, admin) });
    }

    if (b.action === "del") {
      const it = find();
      if (it.uid !== uid && !admin) throw new HttpError(403, "내가 쓴 글만 지울 수 있어요.");
      data.items = data.items.filter((x) => x !== it);
      await writeJson(PATH, data);
      return json({ ok: true });
    }

    if (b.action === "like") {
      const it = find();
      it.likes = it.likes || [];
      const i = it.likes.indexOf(uid);
      if (i >= 0) it.likes.splice(i, 1); else it.likes.push(uid);
      await writeJson(PATH, data);
      return json({ item: view(it, uid, admin) });
    }

    if (b.action === "status") {
      if (!admin) throw new HttpError(403, "관리자만 바꿀 수 있어요.");
      if (!STATUS.includes(b.status)) throw new HttpError(400, "잘못된 상태예요.");
      const it = find();
      it.status = b.status;
      await writeJson(PATH, data);
      return json({ item: view(it, uid, admin) });
    }

    throw new HttpError(400, "잘못된 요청이에요.");
  });
}
