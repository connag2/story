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
    if (r.status === 401 && data.code === "auth" && auth) { logout(); }  // 다른 기기에서 비밀번호를 바꾸는 등 토큰이 무효
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

  // ── 로그인 창 · 계정 창
  const inp = (ph, type = "text", ac = "off", extra = {}) =>
    el("input", { class: "answer-input", placeholder: ph, type, autocomplete: ac, ...extra });
  const msgEl = () => el("div", { class: "msg", role: "status" });
  const say = (m, text, kind = "") => { m.textContent = text; m.className = "msg" + (kind ? " " + kind : ""); };
  const authCall = (body) => api("auth", { method: "POST", body: JSON.stringify(body) });
  function signedIn(r) {
    auth = { token: r.token, name: r.name || (auth && auth.name) };
    LS.set(AUTH, JSON.stringify(auth));
  }
  // 버튼을 누르는 동안 두 번 누르지 않게
  function busyBtn(btn, fn) {
    return async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      try { await fn(); } finally { btn.disabled = false; }
    };
  }

  S.openAccount = function () {
    if (auth) return openAccountMenu();
    const m = modal("로그인");
    const body = m.wrap.querySelector(".mbd");
    const show = (view) => { body.replaceChildren(...view()); const f = body.querySelector("input"); if (f) f.focus(); };

    const tabs = (cur) => el("div", { class: "seg" },
      el("button", { class: "chip" + (cur === "login" ? " on" : ""), type: "button", onclick: () => show(loginView) }, "로그인"),
      el("button", { class: "chip" + (cur === "signup" ? " on" : ""), type: "button", onclick: () => show(signupView) }, "회원가입"));

    function loginView() {
      const name = inp("이름", "text", "username", { maxlength: "20" });
      const pw = inp("비밀번호", "password", "current-password");
      const msg = msgEl();
      const btn = el("button", { class: "btn", type: "button" }, "로그인");
      const go = busyBtn(btn, async () => {
        say(msg, "잠시만요…");
        try {
          signedIn(await authCall({ action: "login", name: name.value, password: pw.value }));
          m.close(); await sync(); paint();
        } catch (e) { say(msg, e.message, "err"); }
      });
      btn.addEventListener("click", go);
      pw.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
      return [tabs("login"),
        el("p", { class: "muted" }, "로그인하면 휴대폰·태블릿·컴퓨터에서 푼 기록(영어 공부장 포함)이 자동으로 맞춰져요."),
        el("form", { class: "form", onsubmit: (e) => { e.preventDefault(); go(); } }, name, pw),
        msg,
        el("div", { class: "row" }, btn,
          el("button", { class: "link", type: "button", onclick: () => show(resetView) }, "비밀번호를 잊었어요")),
        el("hr"), backupSection()];
    }

    function signupView() {
      const name = inp("이름 (2~20자, 한글·영문·숫자)", "text", "username", { maxlength: "20" });
      const pw = inp("비밀번호 (4자 이상)", "password", "new-password");
      const pw2 = inp("비밀번호 한 번 더", "password", "new-password");
      const msg = msgEl();
      const btn = el("button", { class: "btn", type: "button" }, "가입하기");
      const go = busyBtn(btn, async () => {
        if (pw.value !== pw2.value) return say(msg, "두 비밀번호가 달라요.", "err");
        say(msg, "잠시만요…");
        try {
          const r = await authCall({ action: "signup", name: name.value, password: pw.value });
          signedIn(r);
          await sync(); paint();
          show(() => recoveryView(r.recovery, "가입 완료!"));
        } catch (e) { say(msg, e.message, "err"); }
      });
      btn.addEventListener("click", go);
      pw2.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
      return [tabs("signup"),
        el("p", { class: "muted" }, "이름은 다른 사람과 겹치지 않게 정해 주세요. 지금 이 기기에서 푼 기록도 계정에 그대로 올라가요."),
        el("form", { class: "form", onsubmit: (e) => { e.preventDefault(); go(); } }, name, pw, pw2),
        msg, el("div", { class: "row" }, btn)];
    }

    function resetView() {
      const name = inp("이름", "text", "username", { maxlength: "20" });
      const code = inp("복구 코드 (예: ABCD-EFGH-JKLM)", "text", "off", { autocapitalize: "characters", spellcheck: "false" });
      const pw = inp("새 비밀번호 (4자 이상)", "password", "new-password");
      const pw2 = inp("새 비밀번호 한 번 더", "password", "new-password");
      const msg = msgEl();
      const btn = el("button", { class: "btn", type: "button" }, "비밀번호 다시 정하기");
      btn.addEventListener("click", busyBtn(btn, async () => {
        if (pw.value !== pw2.value) return say(msg, "두 비밀번호가 달라요.", "err");
        say(msg, "잠시만요…");
        try {
          const r = await authCall({ action: "reset", name: name.value, recovery: code.value, newPassword: pw.value });
          signedIn(r);
          await sync(); paint();
          show(() => recoveryView(r.recovery, "비밀번호를 바꿨어요"));
        } catch (e) { say(msg, e.message, "err"); }
      }));
      return [
        el("p", { class: "muted" }, "가입할 때 받은 복구 코드로 비밀번호를 다시 정해요. 다른 기기는 로그아웃돼요."),
        el("form", { class: "form", onsubmit: (e) => e.preventDefault() }, name, code, pw, pw2),
        msg,
        el("div", { class: "row" }, btn, el("button", { class: "link", type: "button", onclick: () => show(loginView) }, "← 로그인으로")),
        el("p", { class: "muted small" }, "복구 코드도 잃어버렸다면 계정을 되찾을 방법이 없어요. 새 이름으로 가입한 뒤, 이 기기의 기록은 그대로 올라가요.")];
    }

    function recoveryView(code, title) {
      const ok = el("input", { type: "checkbox" });
      const done = el("button", { class: "btn", type: "button", disabled: "" , onclick: () => m.close() }, "시작하기");
      ok.addEventListener("change", () => { done.disabled = !ok.checked; });
      const copyMsg = msgEl();
      return [
        el("b", { class: "big-ok" }, `✅ ${title}`),
        el("p", {}, "아래 ", el("b", {}, "복구 코드"), "는 비밀번호를 잊었을 때 필요해요. ", el("b", {}, "지금 한 번만"), " 보여 주니 꼭 적어 두거나 저장해 두세요."),
        el("div", { class: "rcode" }, code),
        el("div", { class: "row" },
          el("button", { class: "btn ghost", type: "button", onclick: async () => {
            try { await navigator.clipboard.writeText(code); say(copyMsg, "복사했어요.", "ok"); } catch (e) { say(copyMsg, "복사가 안 돼요. 직접 적어 주세요.", "err"); }
          } }, "복사"),
          el("button", { class: "btn ghost", type: "button", onclick: () => saveText(`스토리공부방-복구코드-${auth ? auth.name : ""}.txt`,
            `스토리 공부방 복구 코드\n이름: ${auth ? auth.name : ""}\n복구 코드: ${code}\n\n비밀번호를 잊었을 때 로그인 창의 '비밀번호를 잊었어요'에서 써요.\n`) }, "파일로 저장")),
        copyMsg,
        el("label", { class: "toggle" }, ok, " 안전한 곳에 적어 뒀어요"),
        el("div", { class: "row" }, done)];
    }

    show(loginView);
  };

  function saveText(filename, text) {
    const a = el("a", { href: URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })), download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function openAccountMenu() {
    const m = modal(`${auth.name} 님`);
    const body = m.wrap.querySelector(".mbd");
    const created = el("span", { class: "muted small" });
    authCall({ action: "me" }).then((r) => {
      if (r.created) created.textContent = `가입일 ${new Date(r.created).toLocaleDateString("ko-KR")}`;
    }).catch(() => {});

    // 접었다 펴는 칸 하나: 제목, 설명, 입력칸들, 실행
    function section(title, desc, fields, label, run, danger) {
      const msg = msgEl();
      const btn = el("button", { class: "btn" + (danger ? " no" : ""), type: "button" }, label);
      btn.addEventListener("click", busyBtn(btn, async () => {
        say(msg, "잠시만요…");
        try { await run(msg); } catch (e) { say(msg, e.message, "err"); }
      }));
      return el("details", { class: "acct-sec" },
        el("summary", {}, title),
        el("p", { class: "muted small" }, desc),
        fields.length ? el("form", { class: "form", onsubmit: (e) => e.preventDefault() }, ...fields) : null,
        msg, el("div", { class: "row" }, btn));
    }

    const cur = inp("지금 비밀번호", "password", "current-password");
    const nw = inp("새 비밀번호 (4자 이상)", "password", "new-password");
    const nw2 = inp("새 비밀번호 한 번 더", "password", "new-password");
    const rpw = inp("비밀번호", "password", "current-password");
    const dpw = inp("비밀번호", "password", "current-password");
    const dname = inp(`확인을 위해 이름(${auth.name})을 그대로 입력`);

    body.replaceChildren(
      el("div", { class: "row" }, el("span", { id: "acct-status", class: "muted" }), created),
      el("div", { class: "row" },
        el("button", { class: "btn", type: "button", onclick: () => sync() }, "지금 동기화"),
        el("button", { class: "btn ghost", type: "button", onclick: () => { logout(); m.close(); } }, "로그아웃")),
      el("p", { class: "muted small" }, "로그아웃해도 이 기기의 기록은 지워지지 않아요."),
      el("hr"),
      section("🔑 비밀번호 바꾸기", "바꾸면 다른 기기는 로그아웃돼요. 이 기기는 그대로예요.", [cur, nw, nw2], "바꾸기", async (msg) => {
        if (nw.value !== nw2.value) return say(msg, "두 새 비밀번호가 달라요.", "err");
        signedIn(await authCall({ action: "change", password: cur.value, newPassword: nw.value }));
        cur.value = nw.value = nw2.value = "";
        say(msg, "비밀번호를 바꿨어요.", "ok");
      }),
      section("🧾 복구 코드 새로 받기", "예전 복구 코드는 더 이상 쓸 수 없게 돼요.", [rpw], "새 코드 받기", async (msg) => {
        const r = await authCall({ action: "recovery", password: rpw.value });
        rpw.value = "";
        say(msg, "");
        msg.replaceChildren(el("div", { class: "rcode" }, r.recovery),
          el("button", { class: "btn ghost small", type: "button", onclick: () => saveText(`스토리공부방-복구코드-${auth.name}.txt`,
            `스토리 공부방 복구 코드\n이름: ${auth.name}\n복구 코드: ${r.recovery}\n`) }, "파일로 저장"));
      }),
      section("📱 다른 기기 모두 로그아웃", "잃어버린 휴대폰이나 학교 컴퓨터에 로그인돼 있다면 써요.", [], "모두 로그아웃", async (msg) => {
        signedIn(await authCall({ action: "logoutAll" }));
        say(msg, "다른 기기를 모두 로그아웃했어요.", "ok");
      }),
      section("🗑 계정 삭제", "계정과 서버에 저장된 기록이 모두 지워지고 되돌릴 수 없어요. 이 기기에 있는 기록은 남아요.", [dpw, dname], "계정 삭제", async (msg) => {
        if (dname.value.trim() !== auth.name) return say(msg, "이름이 정확히 맞아야 지워져요.", "err");
        await authCall({ action: "delete", password: dpw.value });
        logout();
        say(msg, "계정을 지웠어요.", "ok");
        setTimeout(() => m.close(), 1200);
      }, true),
      el("hr"),
      backupSection());
    paint();
  }

  // 서버(로그인 기능)가 있는 주소인지 한 번만 확인 — 정적 호스팅이면 홈의 로그인 안내를 숨김
  let probe = null;
  S.serverReady = () => probe || (probe = fetch("/api/auth", { method: "GET" })
    .then((r) => r.status !== 404).catch(() => false));
  S.isLoggedIn = () => !!auth;

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
  // 공부방 안에 띄운 영어 공부장(같은 사이트)이 기록을 바꾸면 여기로 알림이 옴
  window.addEventListener("storage", (e) => { if (e.key && SYNCABLE(e.key)) later(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sync(); else later(300); });
  window.addEventListener("online", () => later(300));
  setInterval(() => { if (document.visibilityState === "visible") sync(); }, 120000);
  document.addEventListener("DOMContentLoaded", () => { paint(); later(200); });

  S._sync = { merge, snapshot, fp, get noServer() { return noServer; } };
})();
