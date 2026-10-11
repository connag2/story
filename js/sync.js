/* 로그인 · 기기 간 동기화 · 백업
 *
 * 같은 사이트에서 저장하는 학습 기록을 모두 맞춰요.
 *  - story-*  : 이 공부방 (문제별 시각으로 하나하나 병합)
 *  - sp:*, ws_state : 고2 영어 공부장 (키마다 더 최근에 바뀐 쪽을 사용)
 * 서버(/api)는 Vercel에 배포했을 때만 동작해요. 다른 곳에서는 백업 파일로 옮길 수 있어요.
 */
(function () {
  "use strict";
  const S = window.STORY;
  const AUTH = "story-auth", META = "story-sync-meta";
  const PROG = "story-progress-v1", PTIME = "story-progress-t-v1";
  const SYNCABLE = (k) => /^(story-|sp:)|^ws_state$/.test(k) && k !== AUTH && k !== META;

  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 불가 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 저장 불가 */ } },
    keys() { try { return Object.keys(localStorage); } catch (e) { return []; } },
  };
  const parse = (v, d) => { try { return v == null ? d : JSON.parse(v) ?? d; } catch (e) { return d; } };
  // 값이 바뀌었는지 알아보는 짧은 지문 (FNV-1a)
  function fp(v) {
    if (v == null) return null;
    let x = 0x811c9dc5;
    for (let i = 0; i < v.length; i++) { x ^= v.charCodeAt(i); x = Math.imul(x, 0x01000193); }
    return (x >>> 0).toString(36) + ":" + v.length;
  }

  let auth = parse(LS.get(AUTH), null); // { token, name }
  let status = "", busy = false, again = false, lastOk = 0, noServer = false;

  async function api(path, opts = {}) {
    const r = await fetch("/api/" + path, {
      ...opts,
      headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer " + auth.token } : {}), ...(opts.headers || {}) },
    });
    if (r.status === 404 && !(r.headers.get("content-type") || "").includes("json")) {
      noServer = true;
      throw new Error("로그인은 Vercel에 배포한 주소에서만 쓸 수 있어요. 지금은 '백업 파일'로 옮겨 주세요.");
    }
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && auth) { logout(); }
    if (!r.ok) throw new Error(data.error || `오류 (${r.status})`);
    return data;
  }

  // ── 로컬 상태 → { 키: { v, t } }
  function snapshot() {
    const meta = parse(LS.get(META), {});
    const now = Date.now(), out = {};
    for (const k of LS.keys()) {
      if (!SYNCABLE(k)) continue;
      const v = LS.get(k), m = meta[k];
      out[k] = { v, t: m && m.h === fp(v) ? m.t : now };
      if (!m) out[k].fresh = true; // 이 기기에서 아직 한 번도 맞춘 적 없는 키
    }
    for (const [k, m] of Object.entries(meta)) {          // 이 기기에서 지운 키
      if (!(k in out) && SYNCABLE(k)) out[k] = { v: null, t: m.h === null ? m.t : now };
    }
    return out;
  }

  // 값 안에 스스로 기록한 수정 시각(영어 공부장의 prog.t)이 있으면 그걸 믿음
  const innerT = (v) => { const o = parse(v, null); return o && typeof o === "object" && typeof o.t === "number" ? o.t : null; };
  const isObj = (o) => o && typeof o === "object" && !Array.isArray(o);
  // 처음 맞추는 키: 버리지 말고 합치기 (배열은 합집합, 객체는 두 단계까지 합침)
  function combine(lv, rv) {
    const a = parse(lv, undefined), b = parse(rv, undefined);
    if (Array.isArray(a) && Array.isArray(b)) {
      const seen = new Set(), out = [];
      for (const x of [...b, ...a]) { const key = JSON.stringify(x); if (!seen.has(key)) { seen.add(key); out.push(x); } }
      return JSON.stringify(out);
    }
    if (isObj(a) && isObj(b)) {
      const out = { ...b };
      for (const [k, v] of Object.entries(a)) out[k] = isObj(v) && isObj(b[k]) ? { ...b[k], ...v } : v;
      return JSON.stringify(out);
    }
    return rv ?? lv;
  }
  function pick(a, b) {
    if (!b) return a;
    if (!a) return b;
    const ai = innerT(a.v), bi = innerT(b.v);
    if (ai !== null && bi !== null) return bi > ai ? b : a;
    if (a.fresh) return { v: combine(a.v, b.v), t: Date.now() };
    return b.t > a.t ? b : a;
  }

  // ── 병합: 키 단위로 최신, 이 공부방 기록은 문제 단위로 최신
  function merge(local, remote) {
    const out = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      if (k === PROG || k === PTIME) continue;
      const e = pick(local[k], remote[k]);
      out[k] = { v: e.v, t: e.t };
    }
    const lp = parse(local[PROG]?.v, {}), lt = parse(local[PTIME]?.v, {});
    const rp = parse(remote[PROG]?.v, {}), rt = parse(remote[PTIME]?.v, {});
    const mp = {}, mt = {};
    for (const id of new Set([...Object.keys(lp), ...Object.keys(lt), ...Object.keys(rp), ...Object.keys(rt)])) {
      const useRemote = (rt[id] || 0) > (lt[id] || 0);
      const st = useRemote ? rp[id] : lp[id];
      mt[id] = Math.max(rt[id] || 0, lt[id] || 0);
      if (st) mp[id] = st;
    }
    const now = Date.now();
    out[PROG] = { v: JSON.stringify(mp), t: now };
    out[PTIME] = { v: JSON.stringify(mt), t: now };
    return out;
  }

  function apply(merged) {
    let changed = false;
    const meta = {};
    for (const [k, e] of Object.entries(merged)) {
      const cur = LS.get(k);
      if (e.v == null) { if (cur != null) { LS.del(k); changed = true; } }
      else if (cur !== e.v) { LS.set(k, e.v); changed = true; }
      meta[k] = { h: fp(e.v), t: e.t };
    }
    LS.set(META, JSON.stringify(meta));
    return changed;
  }

  async function sync() {
    if (!auth) return;
    if (busy) { again = true; return; }
    busy = true; setStatus("동기화 중…");
    try {
      const remote = await api("sync");
      const merged = merge(snapshot(), remote.keys || {});
      const changed = apply(merged);
      await api("sync", { method: "PUT", body: JSON.stringify({ keys: merged }) });
      lastOk = Date.now();
      setStatus("");
      if (changed) S.reload();
    } catch (e) {
      setStatus(navigator.onLine === false ? "오프라인 — 연결되면 다시 맞출게요" : e.message);
    } finally {
      busy = false;
      if (again) { again = false; setTimeout(sync, 500); }
    }
  }

  let timer = 0;
  const later = (ms = 4000) => { if (!auth) return; clearTimeout(timer); timer = setTimeout(sync, ms); };

  function logout() {
    auth = null; LS.del(AUTH); LS.del(META);
    setStatus(""); paint();
  }

  // ── 화면
  function setStatus(s) { status = s; paint(); }
  const hhmm = (t) => { const d = new Date(t); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
  S.accountLabel = () => auth ? (busy ? "⟳ " : "") + auth.name : "로그인";
  function paint() {
    const b = document.getElementById("acct");
    if (b) b.textContent = S.accountLabel();
    const st = document.getElementById("acct-status");
    if (st) st.textContent = status || (auth && lastOk ? `마지막 동기화 ${hhmm(lastOk)}` : "");
  }

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    e.append(...kids.flat().filter((x) => x != null));
    return e;
  }

  function modal(title, ...body) {
    const close = () => wrap.remove();
    const wrap = el("div", { class: "modal", onclick: (e) => { if (e.target === wrap) close(); } },
      el("div", { class: "mbox", role: "dialog", "aria-label": title },
        el("div", { class: "mhd" }, el("b", {}, title), el("button", { class: "x", type: "button", "aria-label": "닫기", onclick: close }, "✕")),
        el("div", { class: "mbd" }, ...body)));
    document.body.append(wrap);
    return { wrap, close };
  }

  S.openAccount = function () {
    if (auth) return openAccountMenu();
    const name = el("input", { class: "answer-input", placeholder: "이름 (2~20자)", autocomplete: "username", maxlength: "20" });
    const pw = el("input", { class: "answer-input", type: "password", placeholder: "비밀번호 (4자 이상)", autocomplete: "current-password" });
    const msg = el("div", { class: "msg" });
    const go = async (action) => {
      msg.textContent = "잠시만요…"; msg.className = "msg";
      try {
        const r = await api("auth", { method: "POST", body: JSON.stringify({ action, name: name.value, password: pw.value }) });
        auth = { token: r.token, name: r.name };
        LS.set(AUTH, JSON.stringify(auth));
        m.close();
        await sync();
        paint();
      } catch (e) { msg.textContent = e.message; msg.className = "msg err"; }
    };
    pw.addEventListener("keydown", (e) => { if (e.key === "Enter") go("login"); });
    const m = modal("로그인",
      el("p", { class: "muted" }, "로그인하면 휴대폰·태블릿·컴퓨터에서 푼 기록(영어 공부장 포함)이 자동으로 맞춰져요."),
      el("div", { class: "form" }, name, pw),
      msg,
      el("div", { class: "row" },
        el("button", { class: "btn", type: "button", onclick: () => go("login") }, "로그인"),
        el("button", { class: "btn ghost", type: "button", onclick: () => go("signup") }, "회원가입")),
      el("p", { class: "muted small" }, "비밀번호는 암호화해서 저장돼요. 잊어버리면 찾을 수 없으니 꼭 기억해 두세요."),
      el("hr"),
      backupSection());
    name.focus();
  };

  function openAccountMenu() {
    modal(`${auth.name} 님`,
      el("div", { class: "row" },
        el("span", { id: "acct-status", class: "muted" }),
      ),
      el("div", { class: "row" },
        el("button", { class: "btn", type: "button", onclick: () => sync() }, "지금 동기화"),
        el("button", { class: "btn ghost", type: "button", onclick: () => { logout(); document.querySelector(".modal")?.remove(); } }, "로그아웃")),
      el("p", { class: "muted small" }, "로그아웃해도 이 기기의 기록은 지워지지 않아요."),
      el("hr"),
      backupSection());
    paint();
  }

  // ── 백업 파일 (로그인 없이 기기 옮기기)
  function backupSection() {
    const file = el("input", { type: "file", accept: "application/json,.json", class: "hidden" });
    const msg = el("div", { class: "msg" });
    file.addEventListener("change", async () => {
      const f = file.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (data.app !== "story" || !data.keys) throw new Error("스토리 공부방 백업 파일이 아니에요.");
        apply(merge(snapshot(), data.keys));
        msg.textContent = "가져왔어요. 기존 기록과 합쳤어요."; msg.className = "msg ok";
        S.reload(); later(500);
      } catch (e) { msg.textContent = e.message; msg.className = "msg err"; }
    });
    return el("div", {},
      el("b", {}, "백업 파일"),
      el("p", { class: "muted small" }, "로그인 없이도 기록을 파일로 저장했다가 다른 기기에서 불러올 수 있어요."),
      el("div", { class: "row" },
        el("button", { class: "btn ghost", type: "button", onclick: exportBackup }, "내보내기"),
        el("button", { class: "btn ghost", type: "button", onclick: () => file.click() }, "가져오기")),
      file, msg);
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify({ app: "story", v: 1, at: Date.now(), keys: snapshot() })], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `스토리공부방-백업-${S.today()}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ── 자동 동기화: 처음 열 때, 문제를 풀 때(4초 뒤), 화면을 떠날 때, 2분마다
  S.onChange(() => later());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sync(); else later(300); });
  window.addEventListener("online", () => later(300));
  setInterval(() => { if (document.visibilityState === "visible") sync(); }, 120000);
  document.addEventListener("DOMContentLoaded", () => { paint(); later(200); });

  S._sync = { merge, snapshot, fp, get noServer() { return noServer; } };
})();
