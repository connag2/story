// 이모티콘 상점 (아카콘처럼: 누구나 올리고 포인트로 사고팜)
//   GET  /api/emoticons            → { packs: [목록], me }        (로그인 없어도 목록 볼 수 있음)
//   GET  /api/emoticons?id=PACK    → { pack, images: [dataURL...] }
//   POST /api/emoticons (로그인 필요)
//     { action: "create", name, desc, price, images: [dataURL] }  올리기 (최대 24개, 각 200KB)
//     { action: "buy", id }       사기 → 판 사람에게 포인트
//     { action: "report", id }    신고 (3명이면 자동 가림)
//     { action: "hide", id, hidden }  관리자만
//     { action: "delete", id }    만든 사람(판매 0개일 때) 또는 관리자
import { randomBytes } from "node:crypto";
import { HttpError, authUser, body, handle, json, readJson, readToken, removeJson, writeJson } from "./_lib.js";
import { REPORT_HIDE, assertNotBanned, balance, isAdmin, loadPoints, pointsView, savePoints } from "./_points.js";

const INDEX = "emoticons/index.json";
const packPath = (id) => `emoticons/p/${id}.json`;
const IMG = /^data:image\/(png|gif|webp|jpeg);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGES = 24, MAX_IMG_BYTES = 200 * 1024, MAX_PACKS_PER_USER = 20, MAX_PRICE = 1000;

const loadIndex = async (ttl = 0) => (await readJson(INDEX, ttl)) || { packs: [] };
const whoMaybe = (req) => { try { return readToken(req); } catch (e) { return null; } };
const isHidden = (p) => p.adminHidden === true || (p.adminHidden !== false && (p.reports || []).length >= REPORT_HIDE);

function meta(p, me, owned, admin) {
  return {
    id: p.id, name: p.name, desc: p.desc, price: p.price, author: p.author, count: p.count, sales: p.sales || 0,
    t: p.t, thumb: p.thumb, hidden: isHidden(p),
    owned: owned.includes(p.id), mine: !!me && p.authorUid === me,
    ...(admin ? { reports: (p.reports || []).length } : {}),
  };
}

export function GET(req) {
  return handle(async () => {
    const id = new URL(req.url).searchParams.get("id");
    const tok = whoMaybe(req);
    const me = tok && tok.u;
    const admin = !!tok && isAdmin(tok.n);
    const owned = me ? (await loadPoints(me, 30_000)).owned : [];
    const idx = await loadIndex(30_000);
    if (id) {
      const p = idx.packs.find((x) => x.id === id);
      if (!p) throw new HttpError(404, "없는 이모티콘이에요.");
      // 가려진 묶음도 이미 산 사람·만든 사람·관리자는 계속 볼 수 있음
      if (isHidden(p) && !owned.includes(id) && p.authorUid !== me && !admin) throw new HttpError(404, "신고로 가려진 이모티콘이에요.");
      // 그림 묶음은 한 번 올리면 바뀌지 않아요 → 서버도 브라우저도 오래 기억
      const data = await readJson(packPath(id), 86_400_000, { immutable: true });
      return json({ pack: meta(p, me, owned, admin), images: (data && data.images) || [] }, 200, "private, max-age=604800");
    }
    const packs = idx.packs
      .filter((p) => !isHidden(p) || admin || p.authorUid === me || owned.includes(p.id))
      .sort((a, b) => (b.sales || 0) - (a.sales || 0) || b.t - a.t)
      .map((p) => meta(p, me, owned, admin));
    return json({ packs, me: me ? { admin } : null });
  });
}

export function POST(req) {
  return handle(async () => {
    const b = await body(req, 6_000_000);
    const { id: uid, rec } = await authUser(req);
    const admin = isAdmin(rec.name);
    const idx = await loadIndex();
    const find = () => {
      const p = idx.packs.find((x) => x.id === b.id);
      if (!p) throw new HttpError(404, "없는 이모티콘이에요.");
      return p;
    };

    if (b.action === "create") {
      await assertNotBanned(uid);
      const name = String(b.name || "").trim();
      const desc = String(b.desc || "").trim().slice(0, 100);
      const price = Number(b.price);
      if (name.length < 1 || name.length > 20) throw new HttpError(400, "이름은 1~20자로 해 주세요.");
      if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE) throw new HttpError(400, `가격은 0~${MAX_PRICE} 포인트 사이 정수로 해 주세요.`);
      const images = Array.isArray(b.images) ? b.images : [];
      if (images.length < 1 || images.length > MAX_IMAGES) throw new HttpError(400, `이미지는 1~${MAX_IMAGES}개 올릴 수 있어요.`);
      for (const im of images) {
        if (typeof im !== "string" || !IMG.test(im)) throw new HttpError(400, "png · gif · webp · jpg 이미지만 올릴 수 있어요.");
        if ((im.length - im.indexOf(",") - 1) * 0.75 > MAX_IMG_BYTES) throw new HttpError(413, "이미지 하나가 200KB를 넘어요.");
      }
      if (images.reduce((n, im) => n + im.length, 0) > 3_800_000) throw new HttpError(413, "이미지가 너무 커요. 개수를 줄이거나 작은 그림을 올려 주세요.");
      if (idx.packs.filter((p) => p.authorUid === uid).length >= MAX_PACKS_PER_USER) throw new HttpError(400, `한 사람당 ${MAX_PACKS_PER_USER}개까지 올릴 수 있어요.`);
      const id = randomBytes(6).toString("base64url");
      const p = { id, name, desc, price, author: rec.name, authorUid: uid, count: images.length, sales: 0, t: Date.now(), thumb: images[0], reports: [] };
      await writeJson(packPath(id), { id, images });
      idx.packs.push(p);
      await writeJson(INDEX, idx);
      const pts = await loadPoints(uid);           // 만든 사람은 바로 사용 가능
      pts.owned.push(id);
      await savePoints(uid, pts);
      return json({ pack: meta(p, uid, pts.owned, admin), points: pointsView(pts) });
    }

    if (b.action === "buy") {
      const p = find();
      if (isHidden(p)) throw new HttpError(400, "신고로 가려진 이모티콘은 살 수 없어요.");
      const pts = await loadPoints(uid);
      if (pts.owned.includes(p.id)) throw new HttpError(400, "이미 가지고 있어요.");
      if (balance(pts) < p.price) throw new HttpError(400, `포인트가 모자라요. (필요 ${p.price}, 가진 것 ${balance(pts)}) 문제를 풀어 모아 보세요!`);
      pts.spent += p.price;
      pts.owned.push(p.id);
      await savePoints(uid, pts);
      if (p.authorUid !== uid && p.price > 0) {
        const seller = await loadPoints(p.authorUid);
        seller.bonus += p.price;
        await savePoints(p.authorUid, seller);
      }
      p.sales = (p.sales || 0) + 1;
      await writeJson(INDEX, idx);
      return json({ pack: meta(p, uid, pts.owned, admin), points: pointsView(pts) });
    }

    if (b.action === "report") {
      const p = find();
      if (p.authorUid === uid) throw new HttpError(400, "내 이모티콘은 신고할 수 없어요.");
      p.reports = p.reports || [];
      if (!p.reports.includes(uid)) p.reports.push(uid);
      await writeJson(INDEX, idx);
      return json({ ok: true });
    }

    if (b.action === "hide") {
      if (!admin) throw new HttpError(403, "관리자만 할 수 있어요.");
      const p = find();
      p.adminHidden = !!b.hidden;
      if (!b.hidden) p.reports = [];
      await writeJson(INDEX, idx);
      return json({ ok: true });
    }

    if (b.action === "delete") {
      const p = find();
      if (!admin && p.authorUid !== uid) throw new HttpError(403, "내가 만든 이모티콘만 지울 수 있어요.");
      if (!admin && (p.sales || 0) > 0) throw new HttpError(400, "이미 산 사람이 있어서 지울 수 없어요. 관리자에게 요청해 주세요.");
      idx.packs = idx.packs.filter((x) => x !== p);
      await writeJson(INDEX, idx);
      await removeJson([packPath(p.id)]);
      return json({ ok: true });
    }

    throw new HttpError(400, "잘못된 요청이에요.");
  });
}
