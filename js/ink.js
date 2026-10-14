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
    return { t: s.t, c: s.c, w: s.w, ...(s.a ? { a: s.a } : {}), d };
  }
  function dec(o) {
    const p = []; let x = 0, y = 0, q = 0;
    for (let i = 0; i < o.d.length; i += 3) { x += o.d[i]; y += o.d[i + 1]; q += o.d[i + 2]; p.push(x / 2, y / 2, q / 15); }
    // 예전 형광펜은 굵기를 펜처럼 저장했어요 → 7배로 보던 것과 같게
    return { t: o.t, c: o.c, w: o.t === "hl" && !o.a ? o.w * 7 : o.w, a: o.a || (o.t === "hl" ? 0.35 : undefined), p };
  }
  const loadInk = (key) => { const v = LS.get(key); return v && Array.isArray(v.s) ? v.s.map(dec) : []; };
  const saveInk = (key, strokes) => (strokes.length ? LS.set(key, { v: 2, s: strokes.map(enc) }) : (LS.del(key), true));

  // ── 도구 설정 (기기마다 기억) — 펜·형광펜은 색·굵기를 따로 기억해요
  const PREFS = "ink-prefs-v1";
  const prefs = Object.assign({ tool: "pen", finger: "auto", penSeen: false, eraser: "stroke", eraserSize: 14, recent: [], barPos: "bottom" }, LS.get(PREFS) || {});
  if (!prefs.pen) prefs.pen = { c: prefs.color || "#1b2433", w: prefs.size || 2 };
  if (!prefs.hl) prefs.hl = { c: "#ffd43b", w: 16, a: 0.4 };
  const savePrefs = () => LS.set(PREFS, prefs);
  const PALETTE = ["#1b2433", "#6b7280", "#f0443a", "#ff7a00", "#f5b700", "#16a34a", "#0ea5a4", "#2f6bff", "#7c3aed", "#ec4899", "#8b5a2b", "#ffffff"];
  const HL_PALETTE = ["#ffd43b", "#a9e34b", "#66d9e8", "#74c0fc", "#b197fc", "#faa2c1", "#ffa94d", "#ff8787"];
  const toolPrefs = () => (prefs.tool === "hl" ? prefs.hl : prefs.pen);
  // 손가락으로 쓸지: 켜기 / 끄기 / 자동(펜을 쓴 적 없으면 손가락으로 씀)
  const fingerDraws = () => prefs.finger === "on" || (prefs.finger === "auto" && !prefs.penSeen);
  // 손가락 모드: draw(손가락으로 씀) · scroll(브라우저가 그대로 넘김 — 관성·확대 그대로) · block(손바닥 막기, 두 손가락으로만 넘김)
  const fingerMode = () => (prefs.finger === "block" ? "block" : fingerDraws() ? "draw" : "scroll");

  // ───────────────────────── 필기 판 하나
  //   두 장의 canvas: 아래(다 쓴 획) + 위(지금 쓰는 획). 쓰는 동안은 위 장만 다시 그려서 빠르고 부드러워요.
  //   opts.viewport (화면 전체 필기): 다 쓴 획은 페이지에 붙은 조각 종이(1024px 높이씩, 획이 있는 곳만 만듦)에 그려서
  //     손으로 스크롤해도 글씨와 정확히 같이 움직여요. 지금 쓰는 획만 창 크기의 위 장에 그려요.
  //   opts.logicalWidth: 화면 너비가 달라도 같은 비율로 보여 줌(필기장) · opts.center: 가운데 기준 좌표
  function Pad(host, key, opts = {}) {
    const vp = !!opts.viewport;
    const cv = el("canvas", { class: "ink-cv" + (vp ? " hidden" : "") });
    const live = el("canvas", { class: "ink-cv live" + (vp ? " vp" : "") });
    const tilesEl = vp ? el("div", { class: "ink-tiles" }) : null;
    host.append(...[tilesEl, cv, live].filter(Boolean));
    const ctx = cv.getContext("2d");
    const TILE = 1024;
    let tiles = [];                                   // { cv, ctx, y0, on }
    const lctx = live.getContext("2d", { desynchronized: true }) || live.getContext("2d");
    let strokes = loadInk(key);
    const undo = [], redo = [];
    let enabled = false, W = 0, H = 0, dpr = 1, k = 1, ox = 0;
    let cur = null, erasing = null, scrollY = null, saveTimer = 0, liveFrame = 0, baseFrame = 0, predicted = [];
    const touches = new Set();
    const listeners = [];
    const sx = () => (vp ? window.scrollX : 0), sy = () => (vp ? window.scrollY : 0);

    function size() {
      if (vp) { tiles.forEach((t) => t.cv.remove()); tiles = []; }
      W = host.clientWidth;
      H = vp ? window.innerHeight : (opts.height ? opts.height() : host.clientHeight);
      k = opts.logicalWidth ? W / opts.logicalWidth : 1;
      ox = opts.center ? W / 2 : 0;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = vp ? window.innerWidth : W;
      if (H * dpr > 16000) dpr = 16000 / H;
      for (const c of vp ? [live] : [cv, live]) { c.width = Math.max(1, Math.round(cw * dpr)); c.height = Math.max(1, Math.round(H * dpr)); c.style.width = cw + "px"; c.style.height = H + "px"; }
      rebuild();
    }
    // 조각 종이: i 번째(위에서 i*1024px)를 필요할 때 만듦
    function tile(i) {
      if (!tiles[i]) {
        const c = el("canvas", { class: "ink-tile" });
        c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.round(TILE * dpr);
        c.style.width = W + "px"; c.style.height = TILE + "px"; c.style.top = i * TILE + "px";
        tilesEl.append(c);
        tiles[i] = { cv: c, ctx: c.getContext("2d"), y0: i * TILE };
      }
      return tiles[i];
    }
    // 다 쓴 획 하나를 아래 장(조각 종이)에 얹기
    function commit(s) {
      if (!vp) { view(ctx); strokePath(ctx, s); return; }
      const b = boxOf(s), pad = s.w;
      const i0 = Math.max(0, Math.floor(((b[1] - pad) * k) / TILE)), i1 = Math.floor(((b[3] + pad) * k) / TILE);
      for (let i = i0; i <= i1; i++) {
        const t = tile(i);
        t.ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, -dpr * t.y0);
        strokePath(t.ctx, s);
      }
    }
    const view = (c) => c.setTransform(dpr * k, 0, 0, dpr * k, dpr * (ox - sx()), -dpr * sy());

    // ── 획 그리기: 펜은 누르는 힘에 따라 굵기, 점 사이를 곡선으로 / 형광펜은 반투명 + 곱하기(글씨가 가려지지 않게)
    function strokePath(c, s, extra) {
      const p = extra && extra.length ? s.p.concat(extra) : s.p, n = p.length / 3;
      c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = s.c; c.fillStyle = s.c;
      if (s.t === "hl") {
        c.save(); c.globalAlpha = s.a || 0.4; c.globalCompositeOperation = "multiply"; c.lineWidth = s.w;
        c.beginPath(); c.moveTo(p[0], p[1]);
        for (let i = 1; i < n; i++) { const mx = (p[(i - 1) * 3] + p[i * 3]) / 2, my = (p[(i - 1) * 3 + 1] + p[i * 3 + 1]) / 2; c.quadraticCurveTo(p[(i - 1) * 3], p[(i - 1) * 3 + 1], mx, my); }
        c.lineTo(p[(n - 1) * 3] + (n === 1 ? 0.1 : 0), p[(n - 1) * 3 + 1]);
        c.stroke(); c.restore();
        return;
      }
      const wid = (q) => Math.max(0.5, s.w * (0.4 + 1.2 * q));
      if (n === 1) { c.beginPath(); c.arc(p[0], p[1], wid(p[2]) / 2, 0, Math.PI * 2); c.fill(); return; }
      let mx = p[0], my = p[1];
      for (let i = 1; i < n; i++) {
        const x0 = p[(i - 1) * 3], y0 = p[(i - 1) * 3 + 1], x1 = p[i * 3], y1 = p[i * 3 + 1];
        const nx = i === n - 1 ? x1 : (x0 + x1) / 2, ny = i === n - 1 ? y1 : (y0 + y1) / 2;
        c.lineWidth = wid((p[(i - 1) * 3 + 2] + p[i * 3 + 2]) / 2);
        c.beginPath(); c.moveTo(mx, my); c.quadraticCurveTo(x0, y0, nx, ny); c.stroke();
        mx = nx; my = ny;
      }
    }
    const boxOf = (s) => {
      if (!s.box) {
        let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
        for (let i = 0; i < s.p.length; i += 3) { a = Math.min(a, s.p[i]); b = Math.min(b, s.p[i + 1]); c = Math.max(c, s.p[i]); d = Math.max(d, s.p[i + 1]); }
        s.box = [a, b, c, d];
      }
      return s.box;
    };
    // 아래 장 전체 다시 그리기 (지우기·되돌리기·스크롤 때). 화면 전체 필기는 보이는 획만.
    function rebuild() {
      baseFrame = 0;
      if (vp) tiles.forEach((t) => { if (t) { t.ctx.setTransform(1, 0, 0, 1, 0, 0); t.ctx.clearRect(0, 0, t.cv.width, t.cv.height); } });
      else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
      strokes.forEach((s) => s.t === "hl" && commit(s));
      strokes.forEach((s) => s.t !== "hl" && commit(s));
      paintLive();
    }
    // 위 장: 지금 쓰는 획 + 미리 짐작한 점(더 빨리 따라오게) + 지우개 동그라미
    function paintLive() {
      liveFrame = 0;
      lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, live.width, live.height);
      if (cur) { view(lctx); strokePath(lctx, cur, predicted); }
      if (erasing && erasing.at) {
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lctx.beginPath(); lctx.strokeStyle = "#8a94a6"; lctx.lineWidth = 1.5; lctx.setLineDash([4, 3]);
        lctx.arc(erasing.at[0], erasing.at[1], prefs.eraserSize, 0, Math.PI * 2); lctx.stroke(); lctx.setLineDash([]);
      }
    }
    const scheduleLive = () => { if (!liveFrame) liveFrame = requestAnimationFrame(paintLive); };
    const scheduleBase = () => { if (!baseFrame) baseFrame = requestAnimationFrame(rebuild); };
    const changed = () => {
      clearTimeout(saveTimer); saveTimer = setTimeout(save, 400);
      listeners.forEach((f) => f());
    };
    function save() { clearTimeout(saveTimer); saveTimer = 0; saveInk(key, strokes); }

    // ── 지우개: 획 통째로 / 닿은 부분만
    function nearSeg(s, x, y, r) {
      const p = s.p, rr = r * r;
      for (let i = 0; i < p.length; i += 3) {
        const x0 = p[i], y0 = p[i + 1];
        const x1 = i + 3 < p.length ? p[i + 3] : x0, y1 = i + 3 < p.length ? p[i + 4] : y0;
        const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
        const t = L ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L)) : 0;
        const ex = x0 + t * dx - x, ey = y0 + t * dy - y;
        if (ex * ex + ey * ey <= rr) return true;
      }
      return false;
    }
    function eraseAt(x, y) {
      const r0 = prefs.eraserSize / k;
      let hit = false;
      const out = [];
      for (const s of strokes) {
        const r = r0 + s.w / 2, b = boxOf(s);
        if (x < b[0] - r || x > b[2] + r || y < b[1] - r || y > b[3] + r || !nearSeg(s, x, y, r)) { out.push(s); continue; }
        hit = true;
        if (erasing.added.has(s)) erasing.added.delete(s); else erasing.removed.push(s);
        if (prefs.eraser !== "part") continue;
        // 닿은 점만 빼고 남은 부분들을 새 획으로
        let run = [];
        const flush = () => { if (run.length >= 6) { const ns = { t: s.t, c: s.c, w: s.w, a: s.a, p: run }; out.push(ns); erasing.added.add(ns); } run = []; };
        for (let i = 0; i < s.p.length; i += 3) {
          const dx = s.p[i] - x, dy = s.p[i + 1] - y;
          if (dx * dx + dy * dy <= r * r) flush(); else run.push(s.p[i], s.p[i + 1], s.p[i + 2]);
        }
        flush();
      }
      if (hit) { strokes = out; scheduleBase(); }
    }

    // ── 입력
    const pos = (e) => {
      if (vp) return [e.clientX, e.clientY];
      const r = live.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top];
    };
    const lg = (x, y) => [(x + sx() - ox) / k, (y + sy()) / k];
    let lastP = 0.5;
    const pressure = (e) => {
      if (e.pointerType !== "pen" || !(e.pressure > 0)) return 0.5;
      lastP = lastP * 0.55 + e.pressure * 0.45;          // 굵기가 덜컥거리지 않게 부드럽게
      return lastP;
    };
    const scroller = () => opts.scroller || window;

    let lastPenAt = -1e9, tapStart = null;
    function down(e) {
      if (!enabled || prefs.tool === "tap") return;
      if (e.pointerType === "pen") { lastPenAt = performance.now(); if (!prefs.penSeen) { prefs.penSeen = true; savePrefs(); bar.sync(); } }
      if (e.pointerType === "touch") {
        touches.add(e.pointerId);
        const mode = fingerMode();
        // 손가락 넘기기: 브라우저가 그대로 스크롤(관성·확대 그대로). 톡 누르면 밑의 버튼을 누른 것으로.
        if (mode === "scroll" && !cur && !erasing) { tapStart = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() }; return; }
        // 쓰는 중에 닿은 손(손바닥)은 무시
        if (cur || erasing) return;
        // 두 손가락 → 넘기기, 손바닥 막기 모드의 한 손가락 → 무시(톡은 누르기)
        if (touches.size > 1 || mode === "block") {
          if (cur && cur.touch) { cur = null; scheduleLive(); }
          if (touches.size > 1) scrollY = { id: e.pointerId, y: e.clientY, x: e.clientX };
          else tapStart = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
          return;
        }
      }
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 5) return;
      if (cur || erasing) return;                                   // 이미 쓰는 중이면 다른 손은 무시
      e.preventDefault();
      try { live.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      const [x, y] = pos(e);
      const rubber = prefs.tool === "eraser" || (e.buttons & 32) || e.button === 5 || (e.pointerType === "pen" && (e.buttons & 2));
      if (rubber) { erasing = { id: e.pointerId, removed: [], added: new Set(), at: [x, y] }; eraseAt(...lg(x, y)); scheduleLive(); return; }
      lastP = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
      const tp = toolPrefs();
      cur = { id: e.pointerId, touch: e.pointerType === "touch", t: prefs.tool === "hl" ? "hl" : "pen", c: tp.c, w: tp.w, a: prefs.tool === "hl" ? tp.a : undefined, p: [...lg(x, y), pressure(e)] };
      predicted = [];
      scheduleLive();
    }
    function move(e) {
      if (scrollY && e.pointerId === scrollY.id) {
        const dy = scrollY.y - e.clientY, dx = scrollY.x - e.clientX; scrollY.y = e.clientY; scrollY.x = e.clientX;
        scroller().scrollBy(dx, dy); e.preventDefault(); return;
      }
      if (erasing && e.pointerId === erasing.id) {
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of evs.length ? evs : [e]) { const [x, y] = pos(ev); eraseAt(...lg(x, y)); erasing.at = [x, y]; }
        scheduleLive(); e.preventDefault(); return;
      }
      if (!cur || e.pointerId !== cur.id) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) {
        const [x, y] = lg(...pos(ev)), p = cur.p, n = p.length;
        if ((x - p[n - 3]) ** 2 + (y - p[n - 2]) ** 2 < 0.36 / (k * k)) continue;    // 너무 가까운 점은 건너뜀
        p.push(x, y, pressure(ev));
      }
      // 손이 갈 곳을 미리 그려서 펜 끝을 바짝 따라오게 (위 장에만, 손을 떼면 버림)
      predicted = [];
      if (e.getPredictedEvents) for (const ev of e.getPredictedEvents().slice(0, 2)) { const [x, y] = lg(...pos(ev)); predicted.push(x, y, lastP); }
      scheduleLive();
    }
    function up(e) {
      touches.delete(e.pointerId);
      if (scrollY && e.pointerId === scrollY.id) { scrollY = null; return; }
      if (tapStart && e.pointerId === tapStart.id) {
        // 살짝 톡 누른 것이면 → 밑에 있는 버튼·입력칸을 누른 것으로 (필기 중에도 손가락으로 답 고르기)
        const tap = opts.passTap && e.type === "pointerup" && Date.now() - tapStart.t < 450 &&
          Math.abs(e.clientX - tapStart.x) < 10 && Math.abs(e.clientY - tapStart.y) < 10;
        tapStart = null;
        if (tap) passTap(e.clientX, e.clientY);
        return;
      }
      if (erasing && e.pointerId === erasing.id) {
        if (erasing.removed.length || erasing.added.size) { undo.push({ rep: { old: erasing.removed, neu: [...erasing.added] } }); redo.length = 0; changed(); }
        erasing = null; scheduleLive(); return;
      }
      if (!cur || e.pointerId !== cur.id) return;
      const s = cur; cur = null; predicted = [];
      if (e.type === "pointercancel" && s.p.length < 9) { scheduleLive(); return; }
      delete s.id; delete s.touch;
      strokes.push(s); undo.push({ add: s }); redo.length = 0;
      commit(s);                                       // 아래 장에 바로 얹기 (전체 다시 그리지 않음)
      paintLive(); changed();
    }
    function passTap(x, y) {
      live.style.pointerEvents = "none";
      const t = document.elementFromPoint(x, y);
      live.style.pointerEvents = "";
      if (!t) return;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) t.focus();
      t.click();
    }
    live.addEventListener("pointerdown", down);
    live.addEventListener("pointermove", move);
    live.addEventListener("pointerup", up);
    live.addEventListener("pointercancel", up);
    live.addEventListener("contextmenu", (e) => enabled && e.preventDefault());
    // 스크롤을 막을지는 touchstart 에서 정해요: 펜·쓰는 중의 손바닥·손가락 쓰기/손바닥 막기 모드면 막고, 아니면 브라우저가 넘김
    live.addEventListener("touchstart", (e) => {
      if (!enabled || prefs.tool === "tap") return;
      const stylus = [...e.changedTouches].some((t) => t.touchType === "stylus") || performance.now() - lastPenAt < 150;
      const mode = fingerMode();
      if ((stylus || cur || erasing || mode !== "scroll") && e.cancelable) e.preventDefault();
    }, { passive: false });

    // 크기·스크롤 따라가기
    let ro = null;
    const onScroll = () => { if (cur || erasing) scheduleLive(); };   // 다 쓴 획은 페이지와 같이 움직여요
    const onResize = () => size();
    // 창 크기: 너비가 바뀌면 다시 그리고, 높이만 바뀌면(주소창 숨김 등) 위 장만 맞춤
    const onWinResize = () => {
      if (host.clientWidth !== W) return size();
      H = window.innerHeight;
      live.width = Math.round(window.innerWidth * dpr); live.height = Math.round(H * dpr);
      live.style.width = window.innerWidth + "px"; live.style.height = H + "px"; paintLive();
    };
    if (vp) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onWinResize);
    }
    else {
      ro = new ResizeObserver(() => {
        const w = host.clientWidth, h = opts.height ? opts.height() : host.clientHeight;
        if (w !== W || h !== H) size();
      });
      ro.observe(host);
    }
    size();

    const pad = {
      key,
      get empty() { return !strokes.length; },
      get canUndo() { return undo.length > 0; },
      get canRedo() { return redo.length > 0; },
      onChange(f) { listeners.push(f); },
      setEnabled(on) { enabled = on; live.classList.toggle("on", on && prefs.tool !== "tap"); live.dataset.tool = prefs.tool; },
      refresh() { pad.setEnabled(enabled); },
      undo() {
        const op = undo.pop(); if (!op) return;
        if (op.add) strokes = strokes.filter((s) => s !== op.add);
        else if (op.rep) { const neu = new Set(op.rep.neu); strokes = strokes.filter((s) => !neu.has(s)).concat(op.rep.old); }
        else if (op.clear) strokes = op.clear.slice();
        redo.push(op); rebuild(); changed();
      },
      redo() {
        const op = redo.pop(); if (!op) return;
        if (op.add) strokes.push(op.add);
        else if (op.rep) { const old = new Set(op.rep.old); strokes = strokes.filter((s) => !old.has(s)).concat(op.rep.neu); }
        else if (op.clear) strokes = [];
        undo.push(op); rebuild(); changed();
      },
      clear() {
        if (!strokes.length) return;
        undo.push({ clear: strokes.slice() }); redo.length = 0; strokes = []; rebuild(); changed();
      },
      resize: size,
      save,
      // 그림으로 저장 (배경 함께, clear=true 면 투명 배경)
      toPNG(bg, clear) {
        const out = document.createElement("canvas");
        out.width = cv.width; out.height = cv.height;
        const o = out.getContext("2d");
        if (!clear) { o.fillStyle = "#fff"; o.fillRect(0, 0, out.width, out.height); }
        if (bg) bg(o, out.width, out.height, dpr * k);
        o.drawImage(cv, 0, 0);
        return out.toDataURL("image/png");
      },
      destroy(noSave) {
        if (saveTimer) noSave ? clearTimeout(saveTimer) : save();
        if (ro) ro.disconnect();
        if (vp) { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onWinResize); tilesEl.remove(); }
        cv.remove(); live.remove();
      },
    };
    const bar = { sync() {} };
    pad._bar = (b) => { bar.sync = b; };
    return pad;
  }

  // ───────────────────────── 도구 막대
  //   [펜 형광펜 지우개 누르기] [● 색·굵기] [↶ ↷ 🗑] [⋯] [✕]
  //   ● 를 누르면 색 고르기(색판 · 🎨 아무 색이나 · 최근 색) + 굵기 · 투명도 · 지우개 크기
  let activePad = null;
  function toolbar(getPad, { onClose, extra } = {}) {
    const wrap = el("div", { class: "ink-bar", role: "toolbar", "aria-label": "필기 도구" });
    const btn = (label, title, on) => el("button", { class: "ink-b", type: "button", title, "aria-label": title, onclick: on }, label);
    const tools = [["pen", "✒️", "펜 (P)"], ["hl", "🖍️", "형광펜 (H)"], ["eraser", "🧽", "지우개 (E)"], ["tap", "👆", "누르기 — 필기를 잠깐 멈추고 버튼·답 누르기 (T)"]].map(([t, l, ti]) => {
      const b = btn(l, ti, () => {
        if (prefs.tool === t && t !== "tap") { togglePanel(); return; }   // 같은 도구를 한 번 더 누르면 설정 열기
        prefs.tool = t; savePrefs(); sync(); if (panel.classList.contains("open")) paintPanel();
      });
      b.dataset.tool = t; return b;
    });
    const swatch = el("button", { class: "ink-swatch", type: "button", title: "색 · 굵기 고르기", "aria-label": "색과 굵기", onclick: () => togglePanel() }, el("i"));
    const undoB = btn("↶", "되돌리기 (Ctrl+Z)", () => getPad() && getPad().undo());
    const redoB = btn("↷", "다시 하기 (Ctrl+Y)", () => getPad() && getPad().redo());
    const clearB = btn("🗑", "모두 지우기", () => { const p = getPad(); if (p && !p.empty && confirm("이 필기를 모두 지울까요? (↶로 되돌릴 수 있어요)")) p.clear(); });
    const moreB = btn("⋯", "더 보기 (손가락 · 막대 위치)", () => togglePanel("more"));
    const panel = el("div", { class: "ink-panel" });
    let panelMode = "style";

    function togglePanel(mode = "style") {
      const open = panel.classList.contains("open") && panelMode === mode;
      panelMode = mode;
      panel.classList.toggle("open", !open);
      if (!open) paintPanel();
    }
    function pickColor(c) {
      const tp = toolPrefs();
      if (prefs.tool === "eraser" || prefs.tool === "tap") prefs.tool = "pen";
      toolPrefs().c = c;
      if (!PALETTE.includes(c) && !HL_PALETTE.includes(c)) prefs.recent = [c, ...prefs.recent.filter((x) => x !== c)].slice(0, 6);
      savePrefs(); sync(); paintPanel();
      void tp;
    }
    function slider(label, min, max, step, val, on, fmt) {
      const out = el("span", { class: "muted small" }, fmt(val));
      const r = el("input", { type: "range", min, max, step, value: val, "aria-label": label });
      r.addEventListener("input", () => { on(Number(r.value)); out.textContent = fmt(Number(r.value)); });
      return el("label", { class: "ink-slider" }, el("b", {}, label), r, out);
    }
    function paintPanel() {
      if (panelMode === "more") {
        const seg = (label, vals, cur, on) => el("div", { class: "seg" }, el("b", {}, label), vals.map(([v, t]) =>
          el("button", { class: "chip" + (cur === v ? " on" : ""), type: "button", onclick: () => { on(v); savePrefs(); sync(); paintPanel(); } }, t)));
        panel.replaceChildren(...[
          seg("손가락", [["auto", "자동 (펜을 쓰면 손가락은 넘기기)"], ["on", "손가락으로 쓰기"], ["off", "손가락은 넘기기"], ["block", "손바닥 막기 (두 손가락으로 넘기기)"]], prefs.finger, (v) => { prefs.finger = v; }),
          wrap.classList.contains("floating") ? seg("막대", [["bottom", "아래"], ["top", "위"]], prefs.barPos, (v) => { prefs.barPos = v; wrap.classList.toggle("at-top", v === "top"); }) : null,
          el("p", { class: "muted small", text: "펜을 한 번 쓰면 손가락·손바닥은 넘기기만 해요. 펜 지우개 끝이나 옆 버튼을 누르고 쓰면 지우개. 단축키 P 펜 · H 형광펜 · E 지우개 · T 누르기 · Ctrl+Z" })].filter(Boolean));
        return;
      }
      if (prefs.tool === "eraser") {
        const seg = el("div", { class: "seg" }, el("b", {}, "지우개"), [["stroke", "획 통째로"], ["part", "닿은 부분만"]].map(([v, t]) =>
          el("button", { class: "chip" + (prefs.eraser === v ? " on" : ""), type: "button", onclick: () => { prefs.eraser = v; savePrefs(); paintPanel(); } }, t)));
        panel.replaceChildren(seg, slider("크기", 4, 40, 1, prefs.eraserSize, (v) => { prefs.eraserSize = v; savePrefs(); }, (v) => `${v}px`));
        return;
      }
      const hl = prefs.tool === "hl", tp = toolPrefs();
      const dot = (c) => el("button", { class: "ink-dot" + (tp.c.toLowerCase() === c.toLowerCase() ? " on" : ""), type: "button", style: `--c:${c}`, title: c, "aria-label": c, onclick: () => pickColor(c) });
      const custom = el("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(tp.c) ? tp.c : "#1b2433", "aria-label": "아무 색이나 고르기" });
      custom.addEventListener("change", () => pickColor(custom.value));
      const preview = el("canvas", { class: "ink-preview", width: "220", height: "44" });
      const drawPreview = () => {
        const c = preview.getContext("2d"); c.clearRect(0, 0, 220, 44);
        const st = { t: hl ? "hl" : "pen", c: tp.c, w: tp.w, a: tp.a, p: [] };
        for (let i = 0; i <= 40; i++) { const x = 14 + i * 4.8, y = 22 + Math.sin(i / 6) * 9; st.p.push(x, y, 0.3 + 0.5 * Math.sin((i / 40) * Math.PI)); }
        strokePathStatic(c, st);
      };
      panel.replaceChildren(
        el("div", { class: "ink-colors" }, (hl ? HL_PALETTE : PALETTE).map(dot),
          el("label", { class: "ink-dot custom", title: "아무 색이나 고르기" }, "🎨", custom)),
        prefs.recent.length ? el("div", { class: "ink-colors recent" }, el("span", { class: "muted small" }, "최근"), prefs.recent.map(dot)) : "",
        slider("굵기", hl ? 6 : 0.6, hl ? 40 : 10, hl ? 1 : 0.2, tp.w, (v) => { tp.w = v; savePrefs(); sync(); drawPreview(); }, (v) => `${(+v).toFixed(hl ? 0 : 1)}`),
        hl ? slider("진하기", 0.15, 0.7, 0.05, tp.a, (v) => { tp.a = v; savePrefs(); drawPreview(); }, (v) => `${Math.round(v * 100)}%`) : "",
        preview);
      drawPreview();
    }
    function sync() {
      const pd = getPad(); if (pd) pd.refresh();
      tools.forEach((b) => b.classList.toggle("on", b.dataset.tool === prefs.tool));
      const tp = toolPrefs();
      swatch.style.setProperty("--c", prefs.tool === "eraser" ? "transparent" : tp.c);
      swatch.style.setProperty("--w", Math.max(6, Math.min(24, prefs.tool === "hl" ? tp.w * 0.8 : tp.w * 3 + 4)) + "px");
      swatch.classList.toggle("eraser", prefs.tool === "eraser");
      const p = getPad();
      undoB.disabled = !p || !p.canUndo; redoB.disabled = !p || !p.canRedo;
    }
    wrap.append(...[el("div", { class: "ink-grp" }, tools), swatch,
      el("div", { class: "ink-grp" }, undoB, redoB, clearB), moreB, extra || null,
      onClose ? el("button", { class: "ink-b close", type: "button", title: "필기 끄기 (Esc)", "aria-label": "필기 끄기", onclick: onClose }, "✕") : null, panel].filter(Boolean));
    wrap.sync = sync;
    // 막대 바깥을 누르면 설정 닫기
    document.addEventListener("pointerdown", (e) => { if (panel.classList.contains("open") && !wrap.contains(e.target)) panel.classList.remove("open"); }, true);
    requestAnimationFrame(() => wrap.classList.toggle("at-top", wrap.classList.contains("floating") && prefs.barPos === "top"));
    sync();
    return wrap;
  }
  // 미리보기용 (Pad 밖에서도 같은 모양으로 그리기)
  function strokePathStatic(c, s) {
    const tmp = { p: s.p }; void tmp;
    const p = s.p, n = p.length / 3;
    c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = s.c;
    if (s.t === "hl") {
      c.save(); c.globalAlpha = s.a || 0.4; c.lineWidth = s.w; c.beginPath(); c.moveTo(p[0], p[1]);
      for (let i = 1; i < n; i++) c.lineTo(p[i * 3], p[i * 3 + 1]);
      c.stroke(); c.restore(); return;
    }
    for (let i = 1; i < n; i++) {
      c.lineWidth = Math.max(0.5, s.w * (0.4 + 1.2 * p[i * 3 + 2]));
      c.beginPath(); c.moveTo(p[(i - 1) * 3], p[(i - 1) * 3 + 1]); c.lineTo(p[i * 3], p[i * 3 + 1]); c.stroke();
    }
  }

  // 단축키: Ctrl+Z / Ctrl+Y / P · H · E
  document.addEventListener("keydown", (e) => {
    const p = activePad && activePad.pad;
    if (!p || !document.body.contains(activePad.bar)) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? p.redo() : p.undo(); }
    else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); p.redo(); }
    else if (!mod && !e.altKey && { p: "pen", h: "hl", e: "eraser", t: "tap" }[e.key.toLowerCase()]) {
      prefs.tool = { p: "pen", h: "hl", e: "eraser", t: "tap" }[e.key.toLowerCase()]; savePrefs(); activePad.bar.sync();
    } else if (e.key === "Escape" && activePad.off) activePad.off();
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
    // 지금 화면의 필기도 지울 대상이면 새로 엶
    if (page.key && page.key.startsWith(prefix) && page.pad) {
      if (activePad && activePad.pad === page.pad) activePad = null;
      page.pad.destroy(true); page.pad = null;
      const k = page.key.slice("ink:p:".length); page.key = null;
      S.inkPage.setKey(k);
    }
  };

  // ───────────────────────── 화면 전체에 쓰기
  //   ✏️ 를 켜면 문제·지문·옆 창까지 화면 전체가 종이가 돼요.
  //   필기는 화면(문제)마다 따로 저절로 저장되고, 다음 문제로 넘기면 그 문제의 필기로 바뀌어요(필기 모드는 그대로).
  //   app.js 가 화면이 바뀔 때마다 STORY.inkPage.setKey(이름) 을 불러 줌. 이름이 null 이면 필기 없는 화면.
  const page = { host: null, pad: null, key: null, on: false, bar: null, fab: null };
  const appEl = () => document.getElementById("app");
  function pageHeight() {
    const a = appEl();
    const bottom = a ? a.getBoundingClientRect().bottom + window.scrollY : 0;
    return Math.max(Math.ceil(bottom + 120), window.innerHeight);
  }
  function ensureHost() {
    if (page.host) return;
    page.host = el("div", { class: "ink-layer" });
    document.body.append(page.host);
    const fit = () => { page.host.style.height = pageHeight() + "px"; };
    fit();
    new ResizeObserver(fit).observe(appEl() || document.body);
    window.addEventListener("resize", fit);
  }
  function makePagePad() {
    ensureHost();
    page.host.style.height = pageHeight() + "px";
    page.pad = Pad(page.host, page.key, { center: true, passTap: true, viewport: true });
    page.pad.setEnabled(page.on);
    if (page.on) { activate(page.pad, page.bar); activePad.off = () => setOn(false); }
  }
  function dropPagePad() {
    if (!page.pad) return;
    if (activePad && activePad.pad === page.pad) activePad = null;
    page.pad.destroy(); page.pad = null;
  }
  function paintFab() {
    if (!page.fab) {
      page.fab = el("button", { class: "ink-fab", type: "button", title: "화면에 필기하기 (펜·마우스·손가락)", "aria-label": "필기", onclick: () => setOn(true) }, "✏️");
      document.body.append(page.fab);
    }
    page.fab.classList.toggle("hidden", !page.key || page.on);
    document.querySelectorAll(".ink-toggle.page").forEach((b) => { b.classList.toggle("on", page.on); b.textContent = page.on ? "✏️ 필기 끄기" : "✏️ 필기"; });
  }
  function setOn(on) {
    if (on === page.on) return;
    page.on = on;
    if (on) {
      if (prefs.tool === "tap") { prefs.tool = "pen"; savePrefs(); }
      page.bar = toolbar(() => page.pad, { onClose: () => setOn(false) });
      page.bar.classList.add("floating");
      document.body.append(page.bar);
      document.body.classList.add("inking-page");
      if (!page.pad && page.key) makePagePad();
      else if (page.pad) { page.pad.setEnabled(true); activate(page.pad, page.bar); activePad.off = () => setOn(false); }
    } else {
      if (page.pad) { page.pad.setEnabled(false); page.pad.save(); if (page.pad.empty) dropPagePad(); }
      if (page.bar) page.bar.remove();
      page.bar = null;
      document.body.classList.remove("inking-page");
      if (activePad && activePad.bar && !document.body.contains(activePad.bar)) activePad = null;
    }
    paintFab();
  }
  S.inkPage = {
    setKey(key) {
      key = key ? "ink:p:" + key : null;
      if (key === page.key) return;
      dropPagePad();
      page.key = key;
      if (!key) { if (page.on) setOn(false); paintFab(); return; }
      // 새 화면이 그려진 다음 크기를 재서 그 화면의 필기를 불러옴
      requestAnimationFrame(() => {
        if (page.key !== key || page.pad) return;
        if (page.on || LS.get(key)) makePagePad();
      });
      paintFab();
    },
    get on() { return page.on; },
    toggle() { setOn(!page.on); },
  };
  // 카드 머리에 붙는 「✏️ 필기」 버튼 — 화면 전체 필기를 켜고 끔
  S.inkButton = function () {
    const b = el("button", { class: "ink-toggle page" + (page.on ? " on" : ""), type: "button", title: "화면 전체에 필기 (펜·마우스·손가락)", onclick: () => setOn(!page.on) },
      page.on ? "✏️ 필기 끄기" : "✏️ 필기");
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

  // ───────────────────────── 이모티콘 직접 그리기 → 128px 그림 (배경 투명)
  S.drawEmoticon = function () {
    return new Promise((done) => {
      const KEY = "ink:emo:draft";
      const box = el("div", { class: "ink-page emo-draw bg-grid" });
      let pad = null;
      const finish = (src) => { if (pad) pad.destroy(true); if (activePad && activePad.pad === pad) activePad = null; wrap.remove(); done(src); };
      const add = el("button", { class: "btn", type: "button", onclick: () => {
        if (!pad || pad.empty) return toast("먼저 그려 주세요.");
        const big = new Image();
        big.onload = () => {
          const c = document.createElement("canvas"); c.width = c.height = 128;
          c.getContext("2d").drawImage(big, 0, 0, 128, 128);
          let out = c.toDataURL("image/webp", 0.9);
          if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/png");
          LS.del(KEY);
          finish(out);
        };
        big.src = pad.toPNG(null, true);
      } }, "이 그림 넣기");
      const bar = toolbar(() => pad);
      const wrap = el("div", { class: "modal ink-modal" },
        el("div", { class: "mbox", role: "dialog", "aria-label": "이모티콘 그리기" },
          el("div", { class: "mhd" }, el("b", {}, "✏️ 이모티콘 그리기"), el("button", { class: "x", type: "button", "aria-label": "닫기", onclick: () => finish(null) }, "✕")),
          el("div", { class: "mbd" }, bar, box,
            el("p", { class: "muted small", text: "네모 칸 안에 크게 그려요. 굵은 펜이 잘 보여요. 배경은 투명하게 들어가요." }),
            el("div", { class: "row" }, add))));
      document.body.append(wrap);
      pad = Pad(box, KEY, { logicalWidth: 320, height: () => box.clientHeight });
      pad.setEnabled(true);
      if (prefs.pen.w < 3.5) { prefs.pen.w = 3.5; savePrefs(); }
      activate(pad, bar);
    });
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
