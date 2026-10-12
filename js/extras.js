/* 편의 기능: ⚙️ 설정(화면 밝기 · 글자 크기 · 하루 목표) · ⏱ 공부 타이머(뽀모도로)
 *   STORY.openSettings()   설정 창
 *   STORY.applySettings()  저장된 설정을 화면에 적용 (app.js 가 그릴 때마다 부름)
 *   STORY.timerChip()      위쪽 막대에 붙는 ⏱ (타이머가 돌 때만 보임)
 *   STORY.studyMinutes(날짜) 그날 타이머로 공부한 분
 * 설정은 story-settings-v1 에 저장 → 로그인하면 다른 기기와 맞춰져요.
 */
(function () {
  "use strict";
  const S = window.STORY;
  const SKEY = "story-settings-v1", MKEY = "story-studymin-v1", TKEY = "timer-v1";

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    e.append(...kids.flat().filter((x) => x != null && x !== false));
    return e;
  }
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 무시 */ } };
  const settings = () => read(SKEY, {});
  const setSetting = (patch) => { write(SKEY, Object.assign(settings(), patch)); S.applySettings(); };
  const toast = (m) => (S.toast ? S.toast(m) : null);

  // ── 화면 적용
  const dark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  S.applySettings = function () {
    const s = settings();
    const theme = s.theme === "dark" || (s.theme === "auto" && dark && dark.matches) ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.fs = s.fs || "m";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0f1522" : "#2f6bff");
  };
  if (dark && dark.addEventListener) dark.addEventListener("change", () => S.applySettings());
  S.applySettings();
  S.dailyGoal = () => Number(settings().goal) || 0;

  // ── 공부 시간 (타이머로 집중한 분)
  const day = () => (S.today ? S.today() : new Date().toISOString().slice(0, 10));
  S.studyMinutes = (d) => read(MKEY, {})[d || day()] || 0;
  function addMinutes(m) {
    if (m < 1) return;
    const v = read(MKEY, {}); v[day()] = (v[day()] || 0) + Math.round(m); write(MKEY, v);
  }

  // ── ⏱ 타이머: 집중 → 쉬기 → 집중 … (페이지를 닫아도 끝나는 시각을 기억)
  //   { mode: "focus"|"break", end, left(멈췄을 때 남은 ms), started(집중 시작 시각) }
  const timer = () => read(TKEY, null);
  const lens = () => { const s = settings(); return { focus: (Number(s.focusMin) || 25) * 60000, rest: (Number(s.breakMin) || 5) * 60000 }; };
  function startTimer(mode = "focus") {
    const L = lens();
    write(TKEY, { mode, end: Date.now() + (mode === "focus" ? L.focus : L.rest), started: Date.now() });
    tick();
  }
  function stopTimer() {
    const t = timer();
    if (t && t.mode === "focus" && !t.left) addMinutes((Date.now() - t.started) / 60000);
    localStorage.removeItem(TKEY);
    tick();
  }
  function pauseTimer() {
    const t = timer(); if (!t) return;
    if (t.left) { t.end = Date.now() + t.left; t.started = Date.now(); delete t.left; }      // 계속
    else { if (t.mode === "focus") addMinutes((Date.now() - t.started) / 60000); t.left = t.end - Date.now(); }   // 멈춤
    write(TKEY, t); tick();
  }
  function ring(msg) {
    toast(msg);
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* 무시 */ }
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25, 0.5].forEach((d) => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(a.destination); o.start(a.currentTime + d); o.stop(a.currentTime + d + 0.15); });
    } catch (e) { /* 무시 */ }
    if (window.Notification && Notification.permission === "granted" && document.visibilityState !== "visible") {
      try { new Notification("스토리 공부방", { body: msg }); } catch (e) { /* 무시 */ }
    }
  }
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const chips = new Set();
  function tick() {
    let t = timer();
    if (t && !t.left && Date.now() >= t.end) {
      if (t.mode === "focus") {
        addMinutes((t.end - t.started) / 60000);
        ring(`집중 ${Math.round(lens().focus / 60000)}분 끝! ${Math.round(lens().rest / 60000)}분 쉬어요 ☕`);
        startTimer("break"); return;
      }
      ring("쉬는 시간 끝! 다시 집중해 볼까요? 📚");
      localStorage.removeItem(TKEY); t = null;
      if (S.render) S.render();
    }
    for (const c of chips) {
      if (!c.isConnected) { if (Date.now() - c._born > 3000) chips.delete(c); continue; }   // 막 만들어져 아직 안 붙은 것은 기다림
      c.classList.toggle("hidden", !t);
      if (t) {
        c.textContent = `${t.mode === "focus" ? "⏱" : "☕"} ${mmss(t.left || t.end - Date.now())}${t.left ? " ⏸" : ""}`;
        c.classList.toggle("rest", t.mode !== "focus");
      }
    }
  }
  setInterval(tick, 1000);
  S.timerChip = function () {
    const c = el("button", { class: "ib ghost timer hidden", type: "button", title: "공부 타이머 (누르면 멈춤/계속)", onclick: () => openTimer() });
    c._born = Date.now();
    chips.add(c); requestAnimationFrame(tick);
    return c;
  };

  function openTimer() {
    const close = () => wrap.remove();
    const body = el("div", { class: "mbd" });
    function paint() {
      const t = timer(), L = lens();
      body.replaceChildren(
        el("div", { class: "timer-big" }, t ? `${t.mode === "focus" ? "⏱ 집중" : "☕ 쉬기"} ${mmss(t.left || t.end - Date.now())}` : `⏱ ${L.focus / 60000}분 집중 · ${L.rest / 60000}분 쉬기`),
        el("div", { class: "row" },
          t ? el("button", { class: "btn", type: "button", onclick: () => { pauseTimer(); paint(); } }, t.left ? "▶ 계속" : "⏸ 멈춤")
            : el("button", { class: "btn", type: "button", onclick: () => { startTimer(); askNotify(); paint(); } }, "▶ 시작"),
          t ? el("button", { class: "btn ghost", type: "button", onclick: () => { stopTimer(); paint(); } }, "■ 끝내기") : null),
        seg("집중", "focusMin", [[25, "25분"], [40, "40분"], [50, "50분"]]),
        seg("쉬기", "breakMin", [[5, "5분"], [10, "10분"]]),
        el("p", { class: "muted small", text: `오늘 타이머로 공부한 시간: ${S.studyMinutes()}분. 끝나면 소리·진동으로 알려 줘요.` }));
    }
    function seg(label, key, vals) {
      const cur = Number(settings()[key]) || vals[0][0];
      return el("div", { class: "seg" }, el("b", {}, label), vals.map(([v, t]) =>
        el("button", { class: "chip" + (cur === v ? " on" : ""), type: "button", onclick: () => { setSetting({ [key]: v }); paint(); } }, t)));
    }
    const iv = setInterval(() => { if (!document.body.contains(wrap)) clearInterval(iv); else if (timer()) paint(); }, 1000);
    const wrap = el("div", { class: "modal", onclick: (e) => { if (e.target === wrap) close(); } },
      el("div", { class: "mbox", role: "dialog", "aria-label": "공부 타이머" },
        el("div", { class: "mhd" }, el("b", {}, "⏱ 공부 타이머"), el("button", { class: "x", type: "button", "aria-label": "닫기", onclick: close }, "✕")),
        body));
    paint();
    document.body.append(wrap);
  }
  S.openTimer = openTimer;
  function askNotify() {
    try { if (window.Notification && Notification.permission === "default") Notification.requestPermission(); } catch (e) { /* 무시 */ }
  }

  // ── ⚙️ 설정 창
  S.openSettings = function () {
    const close = () => wrap.remove();
    const body = el("div", { class: "mbd" });
    const seg = (label, key, vals, def) => {
      const cur = settings()[key] ?? def;
      return el("div", { class: "seg" }, el("b", {}, label), vals.map(([v, t]) =>
        el("button", { class: "chip" + (String(cur) === String(v) ? " on" : ""), type: "button", onclick: () => { setSetting({ [key]: v }); paint(); if (S.render) S.render(); } }, t)));
    };
    function paint() {
      body.replaceChildren(
        seg("화면", "theme", [["auto", "기기 따라"], ["light", "☀️ 밝게"], ["dark", "🌙 어둡게"]], "light"),
        seg("글자 크기", "fs", [["s", "작게"], ["m", "보통"], ["l", "크게"], ["xl", "아주 크게"]], "m"),
        seg("하루 목표", "goal", [[0, "없음"], [10, "10문제"], [20, "20문제"], [30, "30문제"], [50, "50문제"]], 0),
        el("div", { class: "row" },
          el("button", { class: "btn ghost small", type: "button", onclick: () => { close(); openTimer(); } }, "⏱ 공부 타이머"),
          el("a", { class: "btn ghost small", href: "#/star", onclick: close }, "⭐ 별표 문제"),
          el("a", { class: "btn ghost small", href: "#/search", onclick: close }, "🔍 검색"),
          el("a", { class: "btn ghost small", href: "#/note", onclick: close }, "📓 필기장")),
        el("details", { class: "acct-sec" }, el("summary", {}, "⌨️ 키보드 단축키"),
          el("ul", { class: "small" },
            el("li", {}, "← / → : 이전 · 다음 문제"),
            el("li", {}, "1 ~ 5 : 보기 고르기 · Enter : 채점 뒤 다음 문제"),
            el("li", {}, "S : ⭐ 별표 · W : ✏️ 필기 켜기/끄기 · / : 검색"),
            el("li", {}, "필기 중: P 펜 · H 형광펜 · E 지우개 · T 누르기 · Ctrl+Z 되돌리기 · Esc 끄기"),
            el("li", {}, "댓글: Ctrl+Enter 보내기"))),
        el("p", { class: "muted small", text: "설정은 로그인하면 다른 기기와도 맞춰져요. 필기는 이 기기에만 저장돼요." }));
    }
    const wrap = el("div", { class: "modal", onclick: (e) => { if (e.target === wrap) close(); } },
      el("div", { class: "mbox", role: "dialog", "aria-label": "설정" },
        el("div", { class: "mhd" }, el("b", {}, "⚙️ 설정"), el("button", { class: "x", type: "button", "aria-label": "닫기", onclick: close }, "✕")),
        body));
    paint();
    document.body.append(wrap);
  };
})();
