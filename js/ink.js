/* ✏️ 필기 — 펜(애플펜슬 · S펜 · 와콤 같은 펜 태블릿) · 마우스 · 손가락
 *   STORY.inkButton(card, key)   → 문제 카드 위에 바로 쓰기 (체크 · 밑줄 · 풀이)
 *   STORY.openScratch(key, title)→ 문제 옆 연습장 (넓은 종이)
 *   STORY.viewNotes(app, sid)    → #/note/:sid 과목별 필기장 (여러 쪽 · 줄/모눈 · 그림으로 저장)
 * 펜을 한 번 쓰면 그다음부터 손가락은 화면 넘기기만 해요(손바닥이 닿아도 안 써져요).
 * 펜 뒤쪽 지우개나 옆 버튼을 누른 채 쓰면 지우개가 돼요.
 * 필기는 이 기기(브라우저)에만 저장돼요.
 */
(function () {
  "use strict";
  const S = window.STORY;

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
  const toast = (m) => (S.toast ? S.toast(m) : alert(m));

  // ── 저장 (점 좌표를 0.5px 단위 정수 차이값으로 줄여서)
  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; }
      catch (e) { toast("저장 공간이 꽉 찼어요. 안 쓰는 필기를 지워 주세요."); return false; }
    },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } },
  };
  function enc(s) {
    const d = []; let px = 0, py = 0, pp = 0;
    for (let i = 0; i < s.p.length; i += 3) {
      const x = Math.round(s.p[i] * 2), y = Math.round(s.p[i + 1] * 2), p = Math.round(s.p[i + 2] * 15);
      d.push(x - px, y - py, p - pp); px = x; py = y; pp = p;
    }
    return { t: s.t, c: s.c, w: s.w, d };
  }
  function dec(o) {
    const p = []; let x = 0, y = 0, q = 0;
    for (let i = 0; i < o.d.length; i += 3) { x += o.d[i]; y += o.d[i + 1]; q += o.d[i + 2]; p.push(x / 2, y / 2, q / 15); }
    return { t: o.t, c: o.c, w: o.w, p };
  }
  const loadInk = (key) => { const v = LS.get(key); return v && Array.isArray(v.s) ? v.s.map(dec) : []; };
  const saveInk = (key, strokes) => (strokes.length ? LS.set(key, { v: 1, s: strokes.map(enc) }) : (LS.del(key), true));

  // ── 도구 설정 (기기마다 기억)
  const PREFS = "ink-prefs-v1";
  const prefs = Object.assign({ tool: "pen", color: "#1b2433", size: 2, finger: "auto", penSeen: false }, LS.get(PREFS) || {});
  const savePrefs = () => LS.set(PREFS, prefs);
  const COLORS = [["#1b2433", "검정"], ["#f0443a", "빨강"], ["#2f6bff", "파랑"], ["#0f9d58", "초록"], ["#f59e0b", "주황"]];
  const SIZES = [[1.2, "가늘게"], [2, "보통"], [3.5, "굵게"]];
  // 손가락으로 쓸지: 켜기 / 끄기 / 자동(펜을 쓴 적 없으면 손가락으로 씀)
  const fingerDraws = () => prefs.finger === "on" || (prefs.finger === "auto" && !prefs.penSeen);

  // ───────────────────────── 필기 판 하나
  //   host 위에 canvas를 덮음. opts.logicalWidth 가 있으면 화면 너비가 달라도 같은 비율로 보여 줌(필기장)
  function Pad(host, key, opts = {}) {
    const cv = el("canvas", { class: "ink-cv" });
    host.append(cv);
    const ctx = cv.getContext("2d");
    const base = document.createElement("canvas");          // 다 쓴 획들을 미리 그려 둔 그림
    const bctx = base.getContext("2d");
    let strokes = loadInk(key);
    const undo = [], redo = [];
    let enabled = false, W = 0, H = 0, dpr = 1, k = 1;
    let cur = null, erasing = null, scrollY = null, frame = 0, saveTimer = 0;
    const touches = new Set();
    const listeners = [];

    function size() {
      W = host.clientWidth;
      H = opts.height ? opts.height() : host.clientHeight;
      k = opts.logicalWidth ? W / opts.logicalWidth : 1;
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      if (H * dpr > 16000) dpr = 16000 / H;
      for (const c of [cv, base]) { c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr)); }
      cv.style.width = W + "px"; cv.style.height = H + "px";
      rebuild();
    }

    function strokePath(c, s) {
      const p = s.p, n = p.length / 3;
      c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = s.c;
      if (s.t === "hl") {
        c.save(); c.globalAlpha = 0.35; c.lineWidth = s.w * 7;
        c.beginPath(); c.moveTo(p[0], p[1]);
        for (let i = 1; i < n; i++) c.lineTo(p[i * 3], p[i * 3 + 1]);
        if (n === 1) c.lineTo(p[0] + 0.1, p[1]);
        c.stroke(); c.restore();
        return;
      }
      if (n === 1) {
        c.beginPath(); c.fillStyle = s.c;
        c.arc(p[0], p[1], s.w * (0.35 + 1.3 * p[2]) / 2, 0, Math.PI * 2); c.fill();
        return;
      }
      // 점 사이를 부드러운 곡선으로, 펜 누르는 힘에 따라 굵기
      let mx = p[0], my = p[1];
      for (let i = 1; i < n; i++) {
        const x0 = p[(i - 1) * 3], y0 = p[(i - 1) * 3 + 1], x1 = p[i * 3], y1 = p[i * 3 + 1];
        const nx = i === n - 1 ? x1 : (x0 + x1) / 2, ny = i === n - 1 ? y1 : (y0 + y1) / 2;
        c.lineWidth = s.w * (0.35 + 1.3 * (p[(i - 1) * 3 + 2] + p[i * 3 + 2]) / 2);
        c.beginPath(); c.moveTo(mx, my); c.quadraticCurveTo(x0, y0, nx, ny); c.stroke();
        mx = nx; my = ny;
      }
    }
    function rebuild() {
      bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, base.width, base.height);
      bctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      // 형광펜을 먼저 깔고 그 위에 글씨
      strokes.forEach((s) => s.t === "hl" && strokePath(bctx, s));
      strokes.forEach((s) => s.t !== "hl" && strokePath(bctx, s));
      paint();
    }
    function paint() {
      frame = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(base, 0, 0);
      if (cur) { ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0); strokePath(ctx, cur); }
      if (erasing && erasing.at) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.beginPath(); ctx.strokeStyle = "#8a94a6"; ctx.lineWidth = 1;
        ctx.arc(erasing.at[0], erasing.at[1], ERASE_R, 0, Math.PI * 2); ctx.stroke();
      }
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const changed = () => {
      clearTimeout(saveTimer); saveTimer = setTimeout(save, 300);
      listeners.forEach((f) => f());
    };
    function save() { clearTimeout(saveTimer); saveTimer = 0; saveInk(key, strokes); }

    // ── 지우개: 닿은 획을 통째로 지움
    const ERASE_R = 12;
    function hit(s, x, y, r) {
      const p = s.p, rr = (r + s.w) * (r + s.w);
      if (!s.box) {
        let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
        for (let i = 0; i < p.length; i += 3) { a = Math.min(a, p[i]); b = Math.min(b, p[i + 1]); c = Math.max(c, p[i]); d = Math.max(d, p[i + 1]); }
        s.box = [a, b, c, d];
      }
      const [a, b, c, d] = s.box, pad = r + s.w * 4;
      if (x < a - pad || x > c + pad || y < b - pad || y > d + pad) return false;
      for (let i = 0; i < p.length; i += 3) {
        const x0 = p[i], y0 = p[i + 1];
        const x1 = i + 3 < p.length ? p[i + 3] : x0, y1 = i + 3 < p.length ? p[i + 4] : y0;
        const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
        const t = L ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L)) : 0;
        const ex = x0 + t * dx - x, ey = y0 + t * dy - y;
        if (ex * ex + ey * ey <= (s.t === "hl" ? rr * 9 : rr)) return true;
      }
      return false;
    }
    function eraseAt(x, y) {
      const gone = [];
      strokes = strokes.filter((s) => (hit(s, x, y, ERASE_R / k) ? (gone.push(s), false) : true));
      if (gone.length) { erasing.gone.push(...gone); rebuild(); }
    }

    // ── 입력
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const pressure = (e) => (e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5);
    const scroller = () => opts.scroller || window;

    function down(e) {
      if (!enabled) return;
      if (e.pointerType === "pen" && !prefs.penSeen) { prefs.penSeen = true; savePrefs(); bar.sync(); }
      if (e.pointerType === "touch") {
        touches.add(e.pointerId);
        // 두 손가락이거나 손가락 쓰기를 껐으면 → 화면 넘기기
        if (touches.size > 1 || !fingerDraws()) {
          if (cur && cur.touch) { cur = null; schedule(); }
          scrollY = { id: e.pointerId, y: e.clientY };
          e.preventDefault(); return;
        }
      }
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 5) return;
      if (cur || erasing) return;                                   // 이미 쓰는 중이면 다른 손은 무시
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      const [x, y] = pos(e);
      const rubber = prefs.tool === "eraser" || (e.buttons & 32) || e.button === 5 || (e.pointerType === "pen" && (e.buttons & 2));
      if (rubber) { erasing = { id: e.pointerId, gone: [], at: [x, y] }; eraseAt(x / k, y / k); schedule(); return; }
      cur = { id: e.pointerId, touch: e.pointerType === "touch", t: prefs.tool === "hl" ? "hl" : "pen", c: prefs.color, w: prefs.size, p: [x / k, y / k, pressure(e)] };
      schedule();
    }
    function move(e) {
      if (scrollY && e.pointerId === scrollY.id) {
        const dy = scrollY.y - e.clientY; scrollY.y = e.clientY;
        scroller().scrollBy(0, dy); e.preventDefault(); return;
      }
      if (erasing && e.pointerId === erasing.id) {
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of evs.length ? evs : [e]) { const [x, y] = pos(ev); eraseAt(x / k, y / k); erasing.at = [x, y]; }
        schedule(); e.preventDefault(); return;
      }
      if (!cur || e.pointerId !== cur.id) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) {
        const [x, y] = pos(ev), p = cur.p, n = p.length;
        const lx = p[n - 3], ly = p[n - 2];
        if ((x / k - lx) ** 2 + (y / k - ly) ** 2 < 0.6) continue;    // 너무 가까운 점은 건너뜀
        p.push(x / k, y / k, pressure(ev));
      }
      schedule();
    }
    function up(e) {
      touches.delete(e.pointerId);
      if (scrollY && e.pointerId === scrollY.id) { scrollY = null; return; }
      if (erasing && e.pointerId === erasing.id) {
        if (erasing.gone.length) { undo.push({ del: erasing.gone }); redo.length = 0; changed(); }
        erasing = null; schedule(); return;
      }
      if (!cur || e.pointerId !== cur.id) return;
      const s = cur; cur = null;
      if (e.type === "pointercancel" && s.p.length < 9) { schedule(); return; }
      delete s.id; delete s.touch;
      strokes.push(s); undo.push({ add: s }); redo.length = 0;
      strokePath(bctx, s); paint(); changed();
    }
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("contextmenu", (e) => enabled && e.preventDefault());

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth, h = opts.height ? opts.height() : host.clientHeight;
      if (w !== W || h !== H) size();
    });
    ro.observe(host);
    size();

    const pad = {
      key,
      get empty() { return !strokes.length; },
      get canUndo() { return undo.length > 0; },
      get canRedo() { return redo.length > 0; },
      onChange(f) { listeners.push(f); },
      setEnabled(on) { enabled = on; cv.classList.toggle("on", on); },
      undo() {
        const op = undo.pop(); if (!op) return;
        if (op.add) strokes = strokes.filter((s) => s !== op.add);
        else if (op.del) strokes.push(...op.del);
        else if (op.clear) strokes = op.clear.slice();
        redo.push(op); rebuild(); changed();
      },
      redo() {
        const op = redo.pop(); if (!op) return;
        if (op.add) strokes.push(op.add);
        else if (op.del) strokes = strokes.filter((s) => !op.del.includes(s));
        else if (op.clear) strokes = [];
        undo.push(op); rebuild(); changed();
      },
      clear() {
        if (!strokes.length) return;
        undo.push({ clear: strokes.slice() }); redo.length = 0; strokes = []; rebuild(); changed();
      },
      resize: size,
      save,
      // 그림으로 저장 (배경 함께)
      toPNG(bg) {
        const out = document.createElement("canvas");
        out.width = cv.width; out.height = cv.height;
        const o = out.getContext("2d");
        o.fillStyle = "#fff"; o.fillRect(0, 0, out.width, out.height);
        if (bg) bg(o, out.width, out.height, dpr * k);
        o.drawImage(base, 0, 0);
        return out.toDataURL("image/png");
      },
      destroy() { if (saveTimer) save(); ro.disconnect(); cv.remove(); },
    };
    const bar = { sync() {} };
    pad._bar = (b) => { bar.sync = b; };
    return pad;
  }

  // ───────────────────────── 도구 막대
  let activePad = null;
  function toolbar(getPad, { onClose, extra } = {}) {
    const wrap = el("div", { class: "ink-bar", role: "toolbar", "aria-label": "필기 도구" });
    const btn = (label, title, on) => el("button", { class: "ink-b", type: "button", title, "aria-label": title, onclick: on }, label);
    const tools = [["pen", "✒️", "펜 (P)"], ["hl", "🖍️", "형광펜 (H)"], ["eraser", "🧽", "지우개 (E)"]].map(([t, l, ti]) => {
      const b = btn(l, ti, () => { prefs.tool = t; savePrefs(); sync(); });
      b.dataset.tool = t; return b;
    });
    const colors = COLORS.map(([c, n]) => {
      const b = el("button", { class: "ink-c", type: "button", title: n, "aria-label": n, style: `--c:${c}`, onclick: () => { prefs.color = c; if (prefs.tool === "eraser") prefs.tool = "pen"; savePrefs(); sync(); } });
      b.dataset.color = c; return b;
    });
    const sizes = SIZES.map(([w, n]) => {
      const b = el("button", { class: "ink-s", type: "button", title: n, "aria-label": n, onclick: () => { prefs.size = w; savePrefs(); sync(); } }, el("i", { style: `width:${w * 3 + 2}px;height:${w * 3 + 2}px` }));
      b.dataset.size = w; return b;
    });
    const undoB = btn("↶", "되돌리기 (Ctrl+Z)", () => getPad() && getPad().undo());
    const redoB = btn("↷", "다시 하기 (Ctrl+Y)", () => getPad() && getPad().redo());
    const clearB = btn("🗑", "모두 지우기", () => { const p = getPad(); if (p && !p.empty && confirm("이 필기를 모두 지울까요? (↶로 되돌릴 수 있어요)")) p.clear(); });
    const finger = el("button", { class: "ink-b wide", type: "button", onclick: () => {
      prefs.finger = prefs.finger === "auto" ? (fingerDraws() ? "off" : "on") : prefs.finger === "on" ? "off" : "on";
      savePrefs(); sync();
    } });
    function sync() {
      tools.forEach((b) => b.classList.toggle("on", b.dataset.tool === prefs.tool));
      colors.forEach((b) => b.classList.toggle("on", b.dataset.color === prefs.color && prefs.tool !== "eraser"));
      sizes.forEach((b) => b.classList.toggle("on", Number(b.dataset.size) === prefs.size));
      const p = getPad();
      undoB.disabled = !p || !p.canUndo; redoB.disabled = !p || !p.canRedo;
      finger.textContent = fingerDraws() ? "☝️ 손가락 쓰기" : "☝️ 손가락 넘기기";
      finger.title = fingerDraws() ? "손가락으로도 써요 (누르면 손가락은 화면 넘기기만)" : "손가락은 화면 넘기기만 해요 (누르면 손가락으로도 쓰기)";
      finger.classList.toggle("on", fingerDraws());
    }
    wrap.append(...[el("div", { class: "ink-grp" }, tools), el("div", { class: "ink-grp" }, colors), el("div", { class: "ink-grp" }, sizes),
      el("div", { class: "ink-grp" }, undoB, redoB, clearB), finger, extra || null,
      onClose ? el("button", { class: "ink-b close", type: "button", title: "필기 끄기", "aria-label": "필기 끄기", onclick: onClose }, "✕") : null].filter(Boolean));
    wrap.sync = sync;
    sync();
    return wrap;
  }

  // 단축키: Ctrl+Z / Ctrl+Y / P · H · E
  document.addEventListener("keydown", (e) => {
    const p = activePad && activePad.pad;
    if (!p || !document.body.contains(activePad.bar)) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? p.redo() : p.undo(); }
    else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); p.redo(); }
    else if (!mod && !e.altKey && { p: "pen", h: "hl", e: "eraser" }[e.key.toLowerCase()]) {
      prefs.tool = { p: "pen", h: "hl", e: "eraser" }[e.key.toLowerCase()]; savePrefs(); activePad.bar.sync();
    }
  });
  window.addEventListener("pagehide", () => activePad && activePad.pad.save());

  function activate(pad, bar) {
    if (activePad && activePad.pad !== pad && activePad.off) activePad.off();
    activePad = { pad, bar };
    pad._bar(() => bar.sync());
    pad.onChange(() => bar.sync());
    bar.sync();
  }

  // 이름이 prefix 로 시작하는 필기를 모두 지움 (예: 새 시험을 시작할 때 "ink:t:")
  S.inkClear = function (prefix) {
    try { Object.keys(localStorage).filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* 무시 */ }
  };

  // ───────────────────────── 문제 위에 쓰기
  //   카드 머리에 「✏️ 필기」 버튼. 켜면 카드 전체가 종이가 되고, 끄면 쓴 것은 남은 채 문제를 풀 수 있어요.
  S.inkButton = function (card, key) {
    card.classList.add("ink-host");
    let pad = LS.get(key) ? Pad(card, key) : null;
    let bar = null;
    const b = el("button", { class: "ink-toggle", type: "button", title: "문제 위에 필기 (펜·마우스·손가락)" }, "✏️ 필기");
    const off = () => {
      if (!pad) return;
      pad.setEnabled(false); pad.save();
      if (bar) bar.remove();
      bar = null; b.classList.remove("on"); b.textContent = "✏️ 필기";
      card.classList.remove("inking");
      if (activePad && activePad.pad === pad) activePad = null;
    };
    b.addEventListener("click", () => {
      if (bar) return off();
      if (!pad) pad = Pad(card, key);
      bar = toolbar(() => pad, { onClose: off });
      bar.classList.add("floating");
      document.body.append(bar);
      pad.setEnabled(true);
      card.classList.add("inking");
      b.classList.add("on"); b.textContent = "✏️ 필기 끄기";
      activate(pad, bar);
      activePad.off = off;
      // 화면을 떠나면 저절로 끔
      const watch = setInterval(() => { if (!document.body.contains(card)) { clearInterval(watch); off(); } else if (!bar) clearInterval(watch); }, 500);
    });
    return b;
  };

  // ───────────────────────── 연습장 (문제마다 하나, 넓은 종이)
  const PAPER_W = 800;
  function paperBg(kind) {
    return (o, w, h, sc) => {
      o.strokeStyle = kind === "grid" ? "#dfe8f6" : "#d6e2f3"; o.lineWidth = 1;
      const step = (kind === "grid" ? 24 : 36) * sc;
      if (kind === "blank") return;
      for (let y = step; y < h; y += step) { o.beginPath(); o.moveTo(0, y); o.lineTo(w, y); o.stroke(); }
      if (kind === "grid") for (let x = step; x < w; x += step) { o.beginPath(); o.moveTo(x, 0); o.lineTo(x, h); o.stroke(); }
    };
  }
  S.openScratch = function (key, title) {
    const meta = LS.get(key + ":m") || { h: 1400 };
    const page = el("div", { class: "ink-page bg-grid" });
    const setH = () => { page.style.setProperty("--k", page.clientWidth / PAPER_W); page.style.height = (meta.h * page.clientWidth) / PAPER_W + "px"; };
    const body = el("div", { class: "mbd ink-sheet-body" }, page);
    let pad = null;
    const close = () => { if (pad) pad.destroy(); if (activePad && activePad.pad === pad) activePad = null; wrap.remove(); };
    const longer = el("button", { class: "ink-b wide", type: "button", title: "종이를 아래로 늘려요", onclick: () => { meta.h += 700; LS.set(key + ":m", meta); setH(); } }, "⬇ 늘리기");
    const bar = toolbar(() => pad, { extra: longer });
    const wrap = el("div", { class: "modal ink-modal" },
      el("div", { class: "mbox ink-sheet", role: "dialog", "aria-label": "연습장" },
        el("div", { class: "mhd" }, el("b", {}, "📓 연습장", title ? ` · ${title}` : ""),
          el("button", { class: "x", type: "button", "aria-label": "닫기", onclick: close }, "✕")),
        bar, body));
    document.body.append(wrap);
    setH();
    pad = Pad(page, key, { logicalWidth: PAPER_W, scroller: body, height: () => page.clientHeight });
    pad.setEnabled(true);
    activate(pad, bar);
    new ResizeObserver(setH).observe(body);
  };

  // ───────────────────────── 과목별 필기장  #/note/:sid
  //   쪽 목록: ink:nb:<sid> = { pages: [{ id, title, h, bg, t }] }, 쪽 내용: ink:nbp:<쪽id>
  const nbKey = (sid) => `ink:nb:${sid}`;
  const loadNb = (sid) => LS.get(nbKey(sid)) || { pages: [] };
  const newPage = (n) => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: `${n}쪽`, h: 1600, bg: "lines", t: Date.now() });

  S.viewNotes = function (app, sid) {
    const subs = S._check.subjects.filter((s) => !s.embed);
    const s = subs.find((x) => x.id === sid);
    if (!sid || (!s && sid !== "free")) {
      app.append(el("h1", { class: "page-title" }, "📓 필기장"));
      app.append(el("p", { class: "muted", text: "과목마다 필기장이 있어요. 펜(애플펜슬·S펜·펜 태블릿), 마우스, 손가락으로 써요. 이 기기에 저장돼요." }));
      app.append(el("div", { class: "hero" }, [...subs, { id: "free", name: "자유 필기장", icon: "📝" }].map((x) => {
        const n = loadNb(x.id).pages.length;
        return el("a", { class: "qtile", href: `#/note/${x.id}` }, el("b", {}, `${x.icon || ""} ${x.name}`), el("span", {}, n ? `${n}쪽` : "새로 시작"));
      })));
      return;
    }
    document.body.classList.add("wide-note");
    const nb = loadNb(sid);
    if (!nb.pages.length) { nb.pages.push(newPage(1)); LS.set(nbKey(sid), nb); }
    const saveNb = () => LS.set(nbKey(sid), nb);
    let idx = 0;
    try { idx = Math.min(nb.pages.length - 1, Number(sessionStorage.getItem("ink-nb-pos:" + sid)) || 0); } catch (e) { /* 무시 */ }
    let pad = null;

    app.append(el("nav", { class: "crumbs" }, el("a", { href: s ? `#/s/${s.id}` : "#/" }, s ? `← ${s.name}` : "← 처음"), " · ",
      el("a", { href: "#/note" }, "다른 필기장")));
    app.append(el("h1", { class: "page-title" }, `📓 ${s ? s.name : "자유"} 필기장`));
    const tabs = el("div", { class: "nb-tabs" });
    const page = el("div", { class: "ink-page" });
    const tools = el("div", { class: "row nb-tools" });
    const bgSel = el("select", { "aria-label": "종이 모양" },
      el("option", { value: "lines" }, "줄 노트"), el("option", { value: "grid" }, "모눈"), el("option", { value: "blank" }, "무지"));
    const bar = toolbar(() => pad, {
      extra: el("button", { class: "ink-b wide", type: "button", title: "종이를 아래로 늘려요", onclick: () => { cur().h += 800; saveNb(); setH(); } }, "⬇ 늘리기"),
    });
    bar.classList.add("sticky");
    const cur = () => nb.pages[idx];
    const setH = () => { page.style.setProperty("--k", page.clientWidth / PAPER_W); page.style.height = (cur().h * page.clientWidth) / PAPER_W + "px"; };

    function open(i) {
      if (pad) { pad.destroy(); pad = null; }
      idx = i;
      try { sessionStorage.setItem("ink-nb-pos:" + sid, i); } catch (e) { /* 무시 */ }
      page.className = "ink-page bg-" + cur().bg;
      bgSel.value = cur().bg;
      setH();
      pad = Pad(page, "ink:nbp:" + cur().id, { logicalWidth: PAPER_W, height: () => page.clientHeight });
      pad.setEnabled(true);
      activate(pad, bar);
      paintTabs();
      const top = document.querySelector(".top");
      bar.style.top = (top ? top.offsetHeight : 0) + 6 + "px";
    }
    function paintTabs() {
      tabs.replaceChildren(...nb.pages.map((p, i) => el("button", { class: "chip" + (i === idx ? " on" : ""), type: "button", onclick: () => open(i) }, p.title)),
        el("button", { class: "chip add", type: "button", onclick: () => { nb.pages.push(newPage(nb.pages.length + 1)); saveNb(); open(nb.pages.length - 1); } }, "＋ 새 쪽"));
    }
    bgSel.addEventListener("change", () => { cur().bg = bgSel.value; saveNb(); page.className = "ink-page bg-" + cur().bg; });
    tools.append(bgSel,
      el("button", { class: "btn ghost small", type: "button", onclick: () => {
        const t = prompt("쪽 이름", cur().title); if (t && t.trim()) { cur().title = t.trim().slice(0, 30); saveNb(); paintTabs(); }
      } }, "이름 바꾸기"),
      el("button", { class: "btn ghost small", type: "button", onclick: () => {
        const a = el("a", { href: pad.toPNG(paperBg(cur().bg)), download: `${s ? s.name : "필기장"}-${cur().title}.png` }); a.click();
      } }, "🖼 그림으로 저장"),
      el("button", { class: "btn ghost small", type: "button", onclick: () => {
        if (!confirm(`「${cur().title}」 쪽을 지울까요? 되돌릴 수 없어요.`)) return;
        pad.destroy(); pad = null; LS.del("ink:nbp:" + cur().id);
        nb.pages.splice(idx, 1); if (!nb.pages.length) nb.pages.push(newPage(1));
        saveNb(); open(Math.max(0, idx - 1));
      } }, "쪽 지우기"));
    app.append(tabs, tools, bar, page,
      el("p", { class: "muted small", text: "펜을 한 번 쓰면 손가락은 넘기기만 해요(손바닥 무시). 펜 지우개 끝이나 옆 버튼을 누르고 쓰면 지워져요. Ctrl+Z 되돌리기 · P 펜 · H 형광펜 · E 지우개" }));
    new ResizeObserver(() => setH()).observe(app);
    open(idx);
  };
})();
