/* 스토리 공부방 — 과목 데이터(data/*.js)를 읽어 문제 풀이 화면을 만든다. */
(function () {
  "use strict";

  // ───────────────────────── 과목 등록
  const subjects = [];
  window.STORY = {
    addSubject(s) {
      s.units.forEach((u) => {
        u.groups.forEach((g, gi) => {
          g.items = g.items.map((it, ii) => toItem(it, `${s.id}/${u.id}/${gi}-${ii}`, s.mathInput));
        });
      });
      subjects.push(s);
    },
    // 과목 공부법 + 단원별 개념 설명 (data/guides.js)
    //   { how: "과목 공부법 html", units: { 단원id: "개념 html" } }
    addGuide(sid, g) {
      const s = subjects.find((x) => x.id === sid);
      if (!s) throw new Error(`과목 ${sid} 이 먼저 등록되어야 해요`);
      s.guide = g.how;
      Object.entries(g.units || {}).forEach(([uid, html]) => {
        const u = s.units.find((x) => x.id === uid);
        if (u) u.concept = html;
      });
    },
    // 풀이 과정 (data/solutions-*.js)
    //   { "단원id/묶음번호-문제번호": ["1단계 html", "2단계 html", ...] }   번호는 0부터
    addSolutions(sid, map) {
      const s = subjects.find((x) => x.id === sid);
      if (!s) throw new Error(`과목 ${sid} 이 먼저 등록되어야 해요`);
      const byId = new Map();
      s.units.forEach((u) => u.groups.forEach((g) => g.items.forEach((it) => byId.set(it.id, it))));
      Object.entries(map).forEach(([k, steps]) => {
        const it = byId.get(`${sid}/${k}`);
        if (!it) { (STORY._orphanSolutions = STORY._orphanSolutions || []).push(`${sid}/${k}`); return; }
        it.steps = Array.isArray(steps) ? steps : [steps];
      });
    },
    // 다른 파일에서 과목에 단원을 덧붙일 때 (예: data/reading-mock-2026-09.js)
    addUnits(sid, units) {
      const s = subjects.find((x) => x.id === sid);
      if (!s) throw new Error(`과목 ${sid} 이 먼저 등록되어야 해요`);
      units.forEach((u) => {
        u.groups.forEach((g, gi) => {
          g.items = g.items.map((it, ii) => toItem(it, `${s.id}/${u.id}/${gi}-${ii}`, s.mathInput));
        });
        s.units.push(u);
      });
    },
  };

  // [라벨, 문제, 정답(표시용), 인정 답(문자열|배열|null), 옵션] → 객체
  function toItem(arr, id, math) {
    const [label, q, a, ok, opt = {}] = arr;
    const okList = ok == null ? null : Array.isArray(ok) ? ok : [ok];
    const type = opt.type || (okList ? "input" : "self");
    return { id, label, q, a, ok: okList, type, math: !!math, ...opt };
  }

  // ───────────────────────── 저장소
  // progress: { 문제id: "o" | "x" },  times: { 문제id: 마지막으로 바꾼 시각 } — 기기 간 동기화 때 최신 것을 고르는 데 씀
  const KEY = "story-progress-v1", TKEY = "story-progress-t-v1", DKEY = "story-daily-v1";
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } };
  let progress = load(KEY), times = load(TKEY);
  const listeners = [];
  function save() {
    store(KEY, progress); store(TKEY, times);
    listeners.forEach((f) => f());
  }
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  function setStates(ids, st) {
    const now = Date.now();
    ids.forEach((id) => { if (st) progress[id] = st; else delete progress[id]; times[id] = now; });
    if (st) { const d = load(DKEY); d[today()] = (d[today()] || 0) + ids.length; store(DKEY, d); }
    save();
    renderTop(currentSid);
  }
  const setState = (id, st) => setStates([id], st);

  // ───────────────────────── 채점
  function norm(s, math) {
    let t = String(s).normalize("NFC").toLowerCase();
    t = t.replace(/\s+/g, "")
      .replace(/[−–—]/g, "-")
      .replace(/[′’`]/g, "'")
      .replace(/또는/g, ",")
      .replace(/[.。]+$/, "")
      .replace(/(개|이다|입니다)$/, "")
      .replace(/^\[(.*)\]$/, "$1");
    if (!math) return t;
    t = t.replace(/×/g, "*").replace(/÷/g, "/")
      .replace(/sqrt|루트/g, "√")
      .replace(/²/g, "^2").replace(/³/g, "^3")
      .replace(/음의무한대/g, "-∞").replace(/양의무한대|무한대|infinity|inf/g, "∞")
      .replace(/\+∞/g, "∞")
      .replace(/(△|δ|d)x/g, "δx")
      .replace(/∪/g, ",")
      .replace(/\*\*/g, "^");
    return t.split(",").map(stripPrefix).join(",");
  }
  // "y'=2x" → "2x", "f(1)=8" → "8", "a=3" → "3" (단, "y=3x-5" 처럼 식이면 그대로)
  function stripPrefix(p) {
    const d = p.match(/^[a-z]'(\([^)]*\))?=(.*)$/);
    if (d) return d[2];
    const m = p.match(/^[a-z](\([^)]*\))?=(.*)$/);
    if (m && !/[a-z]/.test(m[2])) return m[2];
    return p.replace(/^\+/, "");
  }
  // 아주 작은 수식 계산기: 숫자, + - * / ^ ( ) √
  function evalNum(src) {
    if (!/^[0-9.+\-*/^()√]+$/.test(src)) return NaN;
    let i = 0;
    const peek = () => src[i];
    const startsAtom = (c) => c != null && /[0-9.(√]/.test(c);
    function expr() {
      let v = term();
      while (peek() === "+" || peek() === "-") { const op = src[i++]; const r = term(); v = op === "+" ? v + r : v - r; }
      return v;
    }
    function term() {
      let v = unary();
      for (;;) {
        if (peek() === "*" || peek() === "/") { const op = src[i++]; const r = unary(); v = op === "*" ? v * r : v / r; }
        else if (startsAtom(peek())) v *= unary();
        else return v;
      }
    }
    function unary() {
      if (peek() === "-") { i++; return -unary(); }
      if (peek() === "+") { i++; return unary(); }
      return power();
    }
    function power() {
      const b = atom();
      if (peek() === "^") { i++; return Math.pow(b, unary()); }
      return b;
    }
    function atom() {
      const c = peek();
      if (c === "(") { i++; const v = expr(); if (src[i++] !== ")") throw 0; return v; }
      if (c === "√") { i++; return Math.sqrt(power()); }
      const m = src.slice(i).match(/^\d+(\.\d+)?|^\.\d+/);
      if (!m) throw 0;
      i += m[0].length;
      return parseFloat(m[0]);
    }
    try { const v = expr(); return i === src.length ? v : NaN; } catch (e) { return NaN; }
  }
  function same(a, b, any, math) {
    let x = norm(a, math), y = norm(b, math);
    if (any) { x = x.split(",").sort().join(","); y = y.split(",").sort().join(","); }
    if (x === y) return true;
    const xs = x.split(","), ys = y.split(",");
    if (!math || xs.length !== ys.length) return false;
    return xs.every((p, k) => {
      const u = evalNum(p), v = evalNum(ys[k]);
      return isFinite(u) && isFinite(v) && Math.abs(u - v) < 1e-9;
    });
  }
  function checkInput(item, value) {
    return item.ok.some((o) => same(value, o, item.any, item.math));
  }

  // ───────────────────────── 유틸
  const $ = (sel, el = document) => el.querySelector(sel);
  // 수식 속 "<" (예: $-3<x<3$, $0<a<2$) 가 HTML 태그로 읽혀 글이 사라지지 않게, 진짜 태그가 아닌 "<" 는 &lt; 로 바꿔요
  const TAG = /^<\/?(b|i|u|s|em|strong|br|div|span|p|ul|ol|li|code|pre|sub|sup|small|table|tr|td|th|thead|tbody|caption|img|hr|mark|h[1-6]|a|blockquote|details|summary|figure|figcaption)(?=[\s>/])/i;
  const safeHtml = (v) => String(v).replace(/<(?=[A-Za-z/!?])/g, (m, i, str) => (TAG.test(str.slice(i)) ? "<" : "&lt;"));

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = safeHtml(v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(kid));
    }
    return el;
  }
  function typeset(el) {
    if (window.renderMathInElement) {
      window.renderMathInElement(el, {
        delimiters: [{ left: "$", right: "$", display: false }],
        throwOnError: false,
      });
    }
  }
  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }
  function stars(n) { return n ? "★".repeat(n) : ""; }
  function allItems(unit) { return unit.groups.flatMap((g) => g.items); }
  function stats(items) {
    let o = 0, x = 0;
    items.forEach((it) => { if (progress[it.id] === "o") o++; else if (progress[it.id] === "x") x++; });
    return { total: items.length, o, x, done: o + x };
  }
  function bar(st, color) {
    const pct = st.total ? Math.round((st.o / st.total) * 100) : 0;
    const xpct = st.total ? Math.round((st.x / st.total) * 100) : 0;
    return h("div", { class: "bar", title: `맞음 ${st.o} · 틀림 ${st.x} · 전체 ${st.total}` },
      h("span", { class: "bar-o", style: `width:${pct}%;background:${color}` }),
      h("span", { class: "bar-x", style: `width:${xpct}%` }));
  }
  function findUnit(sid, uid) {
    const s = subjects.find((x) => x.id === sid);
    return s ? { s, u: s.units.find((x) => x.id === uid) } : {};
  }
  const wrongCount = (items) => items ? items.filter((it) => progress[it.id] === "x").length
    : Object.values(progress).filter((v) => v === "x").length;
  function updateWrongBadge() {
    const a = $("#nav-wrong");
    if (a) a.textContent = `오답 ${wrongCount()}`;
  }
  // 진행 점: 회색(시작 전) · 파랑(진행 중) · 초록(완료, 80% 이상) · 빨강(완료, 80% 미만)
  function dotClass(st) {
    if (!st.done) return "dot";
    if (st.done < st.total) return "dot part";
    return st.o / st.total >= 0.8 ? "dot done" : "dot weak";
  }
  const dots = (list) => h("div", { class: "dots" }, list.map((items) => h("i", { class: dotClass(stats(items)) })));
  const legend = () => h("div", { class: "legend" },
    h("span", {}, h("i", { style: "background:var(--green)" }), "완료"),
    h("span", {}, h("i", { style: "background:var(--blue)" }), "진행 중"),
    h("span", {}, h("i", { style: "background:var(--red)" }), "80% 미만"));
  const subjectHref = (s) => `#/s/${s.id}`;

  // 마지막으로 연 단원 (이어서 풀기)
  const LAST = "story-last-v1";
  const getLast = () => { try { return JSON.parse(localStorage.getItem(LAST)); } catch (e) { return null; } };
  const setLast = (sid, uid) => { try { localStorage.setItem(LAST, JSON.stringify([sid, uid])); } catch (e) { /* 무시 */ } };
  function firstOpenUnit(s) {
    return s.units.find((u) => { const st = stats(allItems(u)); return st.done < st.total; }) || s.units[0];
  }

  // ───────────────────────── 상단바: 제목 + 과목 칩
  let currentSid = null;
  function renderTop(sid) {
    currentSid = sid;
    const top = $("#top");
    const s = subjects.find((x) => x.id === sid);
    const all = stats(subjects.flatMap((x) => x.units.flatMap(allItems)));
    const st = s ? stats(s.units.flatMap(allItems)) : all;
    top.replaceChildren(
      h("div", { class: "toprow" },
        h("a", { class: "ttl", href: s ? `#/s/${s.id}` : "#/" },
          h("div", { class: "htt" }, s ? s.name : "📚 스토리 공부방"),
          h("div", { class: "hts" }, s && s.embed ? s.desc : `${s ? s.units.length + "단원 · " : ""}${st.done}/${st.total} 문항 풂`)),
        h("div", { class: "topbtns" },
          window.STORY.timerChip ? window.STORY.timerChip() : null,
          h("a", { class: "ib ghost icon", href: "#/search", title: "검색 ( / )", "aria-label": "검색" }, "🔍"),
          window.STORY.openSettings ? h("button", { class: "ib ghost icon", type: "button", title: "설정", "aria-label": "설정", onclick: () => window.STORY.openSettings() }, "⚙️") : null,
          (() => { const p = window.STORY.points && window.STORY.points(); return p ? h("a", { class: "ib ghost pts", href: "#/shop", title: "포인트 · 이모티콘 상점" }, `🪙 ${p.points}`) : null; })(),
          h("button", { class: "ib ghost", id: "acct", type: "button", onclick: () => window.STORY.openAccount && window.STORY.openAccount() },
            (window.STORY.accountLabel && window.STORY.accountLabel()) || "로그인"),
          h("a", { class: "ib", id: "nav-wrong", href: s ? `#/wrong/${s.id}` : "#/wrong" }, "오답"))),
      h("nav", { class: "packsel" },
        h("a", { class: "chip" + (!s ? " on" : ""), href: "#/" }, "홈"),
        subjects.map((x) => h("a", { class: "chip" + (x === s ? " on" : ""), href: subjectHref(x) }, x.name))));
    top.classList.toggle("compact", !!(s && s.embed));
    updateWrongBadge();
  }

  // ───────────────────────── 화면: 홈
  function examBox(s) {
    return h("div", { class: "exam" },
      h("div", { class: "exam-count" }, s.exam.count),
      h("ul", {}, s.exam.range.map((r) => h("li", {}, r))));
  }
  function subjectTile(s) {
    if (s.embed) {
      return h("a", { class: "utile", href: subjectHref(s) },
        h("div", { class: "no" }, s.name),
        h("div", { class: "tp" }, s.desc),
        h("div", { class: "tp small" }, s.embedNote || ""));
    }
    const st = stats(s.units.flatMap(allItems));
    return h("a", { class: "utile" + (st.done === st.total && st.total ? " done" : ""), href: subjectHref(s) },
      h("div", { class: "no" }, s.name),
      h("div", { class: "tp" }, s.desc),
      h("div", { class: "tp small" }, `${s.units.length}단원 · ${st.done}/${st.total} 풂`),
      dots(s.units.map(allItems)));
  }

  // ───────────────────────── 오늘 · 연속 학습 · 시험 D-day
  const SKEY = "story-settings-v1";
  function todayCard() {
    const daily = load(DKEY), set = load(SKEY);
    const n = daily[today()] || 0;
    let streak = 0;
    const d = new Date();
    if (!n) d.setDate(d.getDate() - 1);            // 오늘 아직 안 풀었으면 어제까지 이어진 날 수
    for (;;) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!daily[k]) break;
      streak++; d.setDate(d.getDate() - 1);
    }
    let dday = null;
    if (set.examDate) {
      const diff = Math.round((new Date(set.examDate + "T00:00:00") - new Date(today() + "T00:00:00")) / 864e5);
      dday = diff > 0 ? `D-${diff}` : diff === 0 ? "D-DAY" : `D+${-diff}`;
    }
    const input = h("input", {
      type: "date", class: "date-in", value: set.examDate || "", "aria-label": "시험 날짜",
      onchange: (e) => { const v = load(SKEY); v.examDate = e.target.value || undefined; store(SKEY, v); save(); render(); },
    });
    const S = window.STORY;
    const goal = S.dailyGoal ? S.dailyGoal() : 0;
    const mins = S.studyMinutes ? S.studyMinutes() : 0;
    return h("div", { class: "today" },
      h("label", { class: "tcell dday" }, h("b", {}, dday || "D-?"), h("span", {}, dday ? "시험까지" : "시험 날짜 정하기"), input),
      h("div", { class: "tcell" + (goal && n >= goal ? " goal-done" : "") },
        h("b", {}, goal ? `${n}/${goal}` : String(n)), h("span", {}, goal ? (n >= goal ? "🎉 오늘 목표 달성!" : "오늘 목표") : "오늘 푼 문제"),
        goal ? h("div", { class: "bar" }, h("span", { class: "bar-o", style: `width:${Math.min(100, Math.round((n / goal) * 100))}%` })) : null),
      h("div", { class: "tcell" }, h("b", {}, `${streak}일`), h("span", {}, "연속 공부")),
      h("button", { class: "tcell", type: "button", title: "공부 타이머", onclick: () => S.openTimer && S.openTimer() },
        h("b", {}, `${mins}분`), h("span", {}, "⏱ 오늘 집중")));
  }

  // 로그인 안 했을 때 홈에 한 번 보여 주는 안내 (서버가 있는 주소에서만, 닫으면 다시 안 뜸)
  const NUDGE = "story-nudge-off";
  function loginNudge() {
    const S = window.STORY;
    if (!S.isLoggedIn || S.isLoggedIn() || localStorage.getItem(NUDGE)) return null;
    const box = h("div", { class: "nudge hidden" },
      h("div", {}, h("b", {}, "🔒 로그인하면 기록이 안전하게 저장돼요"),
        h("span", {}, "휴대폰·컴퓨터 어디서든 이어서 풀 수 있고, 영어 공부장 기록도 같이 맞춰져요.")),
      h("div", { class: "row" },
        h("button", { class: "btn", type: "button", onclick: () => S.openAccount() }, "로그인 · 가입"),
        h("button", { class: "link", type: "button", onclick: () => { try { localStorage.setItem(NUDGE, "1"); } catch (e) { /* 무시 */ } box.remove(); } }, "괜찮아요")));
    if (S.serverReady) S.serverReady().then((ok) => { if (ok) box.classList.remove("hidden"); });
    return box;
  }

  function viewHome(app) {
    const nudge = loginNudge();
    if (nudge) app.append(nudge);
    app.append(todayCard());
    const last = getLast();
    const lu = last && findUnit(last[0], last[1]);
    const hero = h("div", { class: "hero" });
    if (lu && lu.u) {
      hero.append(h("a", { class: "qtile pri", href: `#/s/${lu.s.id}/${lu.u.id}` }, h("b", {}, "이어서 풀기"), h("span", {}, `${lu.s.name} · ${lu.u.title}`)));
    } else {
      const s0 = subjects.find((x) => !x.embed);
      if (s0) hero.append(h("a", { class: "qtile pri", href: `#/s/${s0.id}/${s0.units[0].id}` }, h("b", {}, "처음부터 시작"), h("span", {}, `${s0.name} · ${s0.units[0].title}`)));
    }
    const examSubjects = subjects.filter((s) => s.exam);
    const scope = h("div", { class: "scope hidden" }, examSubjects.map((s) =>
      h("a", { class: "scope-row", href: subjectHref(s) }, h("b", {}, s.name), examBox(s))));
    hero.append(
      h("button", { class: "qtile exam-tile", onclick: () => scope.classList.toggle("hidden") }, h("b", {}, "시험범위"), h("span", {}, "2학년 2학기 1차 · 과목별 범위")),
      h("a", { class: "qtile" + (wrongCount() ? " warn" : ""), href: "#/wrong" }, h("b", {}, "오답노트"), h("span", {}, `${wrongCount()}문항`)),
      h("a", { class: "qtile board-tile", href: "#/board" }, h("b", {}, "💬 피드백 게시판"), h("span", {}, "의견 · 나만의 공부법 · 추가 요청")),
      h("a", { class: "qtile shop-tile", href: "#/shop" }, h("b", {}, "😀 이모티콘 상점"), h("span", {}, "한 문제 맞히면 🪙1 · 모아서 사고팔기")),
      h("a", { class: "qtile note-tile", href: "#/note" }, h("b", {}, "📓 필기장"), h("span", {}, "펜 · 태블릿 · 마우스로 필기")),
      h("a", { class: "qtile eng-tile", href: "#/eng" }, h("b", {}, "📖 영어 본문 해설"), h("span", {}, "요지 · 끊어 읽기 · 해석 · 단어")),
      h("a", { class: "qtile star-tile", href: "#/star" }, h("b", {}, "⭐ 별표 문제"), h("span", {}, `${Object.keys(load(STAR)).length}문항 · 나중에 다시 볼 것`)));
    app.append(hero, scope);

    const guided = subjects.filter((x) => x.guide);
    if (guided.length) {
      app.append(h("div", { class: "secthd" }, h("b", {}, "📘 과목별 공부법")));
      app.append(h("div", { class: "picks" }, guided.map((x) => h("a", { class: "chip", href: `#/guide/${x.id}` }, x.name))));
    }
    app.append(h("div", { class: "secthd" }, h("b", {}, "시험 과목"), legend()));
    app.append(h("div", { class: "ugrid" }, examSubjects.map(subjectTile)));
    const others = subjects.filter((s) => !s.exam);
    if (others.length) {
      app.append(h("div", { class: "secthd" }, h("b", {}, "더 공부하기")));
      app.append(h("div", { class: "ugrid" }, others.map(subjectTile)));
    }
  }

  // ───────────────────────── 화면: 다른 앱을 그대로 품기 (영어 공부장)
  let embedFrame = null;
  function viewEmbed(app, s) {
    document.body.classList.add("embedded");
    // 이미 띄워 둔 영어 앱이 있으면 다시 쓰기 (진행 화면 유지)
    if (!embedFrame) {
      embedFrame = h("iframe", { class: "embed-frame", src: encodeURI(s.embed), title: s.name, allow: "clipboard-write; autoplay" });
    }
    app.append(embedFrame);
    if (window.STORY.viewEnglish && s.id === "english") app.append(h("a", { class: "eng-fab", href: "#/eng", title: "지문 해석 · 끊어 읽기 · 요지" }, "📖 본문 해설"));
    const fit = () => {
      const t = $("#top");
      if (!t || !embedFrame) return;
      const top = t.getBoundingClientRect().height;
      embedFrame.style.top = top + "px";
      embedFrame.style.height = (window.innerHeight - top) + "px";
    };
    fit(); requestAnimationFrame(fit);
    window.addEventListener("resize", fit);
  }

  // ───────────────────────── 화면: 과목(단원 고르기)
  function viewSubject(app, sid) {
    const s = subjects.find((x) => x.id === sid);
    if (!s) return viewNotFound(app);
    if (s.embed) return viewEmbed(app, s);
    const next = firstOpenUnit(s);
    const items = s.units.flatMap(allItems);
    const started = stats(items).done > 0;
    const hero = h("div", { class: "hero" },
      h("a", { class: "qtile pri", href: `#/s/${s.id}/${next.id}` },
        h("b", {}, started ? "이어서 풀기" : "처음부터 시작"), h("span", {}, next.title)),
      s.guide ? h("a", { class: "qtile guide-tile", href: `#/guide/${s.id}` },
        h("b", {}, "📘 공부법 · 개념"), h("span", {}, "무엇을 어떻게 공부할지 먼저")) : null,
      h("a", { class: "qtile exam-tile", href: `#/test/${s.id}` },
        h("b", {}, "시험 보기"), h("span", {}, "단원 골라 실전처럼 · 시간 제한")),
      h("a", { class: "qtile" + (wrongCount(items) ? " warn" : ""), href: `#/wrong/${s.id}` },
        h("b", {}, "오답노트"), h("span", {}, `${wrongCount(items)}문항`)),
      h("a", { class: "qtile note-tile", href: `#/note/${s.id}` },
        h("b", {}, "📓 필기장"), h("span", {}, "펜으로 정리 · 풀이 연습")));
    app.append(hero);
    if (s.exam) app.append(h("div", { class: "scope" }, h("div", { class: "scope-row" }, h("b", {}, "시험범위"), examBox(s))));

    app.append(h("div", { class: "secthd" }, h("b", {}, "단원 고르기"), legend()));
    app.append(h("div", { class: "ugrid" }, s.units.map((u) => {
      const st = stats(allItems(u));
      const done = st.total && st.done === st.total && st.o / st.total >= 0.8;
      return h("a", { class: "utile" + (done ? " done" : ""), href: `#/s/${s.id}/${u.id}` },
        h("div", { class: "no" }, /^\d/.test(u.id) ? `${u.id}단원` : u.title),
        h("div", { class: "tp" }, /^\d/.test(u.id) ? u.title : (u.sub || "")),
        h("div", { class: "tp small" }, `${u.sub && /^\d/.test(u.id) ? u.sub + " · " : ""}${st.done}/${st.total}`),
        dots(u.groups.map((g) => g.items)));
    })));
  }

  // ───────────────────────── 화면: 단원(문제 풀이)
  // 영어 공부장처럼: 단계 탭 + 한 문제씩 카드 + 아래 고정 막대(이전 · 진행 점 · 다음)
  //   read : 지문 읽기 (지문이 있는 단원만)   one : 한 문제씩   all : 전체 보기   wrong : 틀린 문제
  const POS = "story-pos-v1";
  const getPos = (key) => { try { return (JSON.parse(sessionStorage.getItem(POS)) || {})[key] || 0; } catch (e) { return 0; } };
  const setPos = (key, i) => { try { const m = JSON.parse(sessionStorage.getItem(POS)) || {}; m[key] = i; sessionStorage.setItem(POS, JSON.stringify(m)); } catch (e) { /* 무시 */ } };
  let keyHandler = null;

  function openPassage(g) {
    const close = () => wrap.remove();
    const body = h("div", { class: "mbd", html: g.passage });
    const wrap = h("div", { class: "modal", onclick: (e) => { if (e.target === wrap) close(); } },
      h("div", { class: "mbox wide", role: "dialog", "aria-label": "지문" },
        h("div", { class: "mhd" }, h("b", {}, "📖 지문", g.ptitle ? ` · ${g.ptitle}` : ""), h("button", { class: "x", type: "button", "aria-label": "닫기", onclick: close }, "✕")),
        body));
    document.body.append(wrap);
    typeset(body);
  }

  function viewUnit(app, sid, uid, stepArg) {
    const { s, u } = findUnit(sid, uid);
    if (!u) return viewNotFound(app);
    const items = allItems(u);
    const idx = s.units.indexOf(u);
    const hasPassage = u.groups.some((g) => g.passage);
    const fresh = !stats(items).done;
    const step = ["concept", "read", "one", "all", "wrong"].includes(stepArg) ? stepArg
      : fresh && u.concept ? "concept" : fresh && hasPassage ? "read" : "one";
    setLast(s.id, u.id);
    const base = `#/s/${s.id}/${u.id}`;

    // ── 머리: ← · 제목 · 단계 탭
    const st0 = stats(items);
    const steps = [
      u.concept ? ["concept", "개념"] : null,
      hasPassage ? ["read", "지문 읽기"] : null,
      ["one", "한 문제씩"], ["all", "전체 보기"], ["wrong", `틀린 문제${st0.x ? " " + st0.x : ""}`],
    ].filter(Boolean);
    const summary = h("span", { class: "usum" });
    const refreshSummary = () => { const st = stats(items); summary.textContent = `맞음 ${st.o} · 틀림 ${st.x} · 남음 ${st.total - st.done}`; };
    refreshSummary();
    app.append(h("div", { class: "uhead" },
      h("div", { class: "uhrow" },
        h("a", { class: "ib ghost back", href: `#/s/${s.id}`, "aria-label": "단원 목록" }, "←"),
        h("div", { class: "uht" }, h("b", {}, /^\d/.test(u.id) ? `${u.id}. ${u.title}` : u.title), h("span", {}, u.sub || "")),
        h("button", { class: "ib ghost", type: "button", title: "기록 초기화", onclick: () => {
          if (!confirm("이 단원의 채점 기록을 모두 지울까요?")) return;
          setStates(items.map((it) => it.id), null); setPos(base, 0); render();
        } }, "↺")),
      h("nav", { class: "steps" }, steps.map(([k, t], i) =>
        h("a", { class: "step" + (k === step ? " on" : ""), href: `${base}/${k}` }, h("span", { class: "n" }, i + 1), t))),
      summary));

    if (step === "concept") return viewConcept(app, s, u, base, hasPassage);
    if (step === "read") return viewRead(app, s, u, base);
    if (step === "one") return viewOne(app, s, u, base, refreshSummary);

    // 전체 보기 / 틀린 문제
    let shown = 0;
    u.groups.forEach((g, gi) => {
      const its = step === "wrong" ? g.items.filter((it) => progress[it.id] === "x") : g.items;
      if (!its.length) return;
      shown += its.length;
      app.append(groupCard(s, g, gi + 1, its, refreshSummary));
    });
    if (!shown) app.append(h("div", { class: "empty" }, step === "wrong" ? "틀린 문제가 없어요 👏" : "문제가 없어요."));
    const nav = h("div", { class: "pager" });
    if (idx > 0) nav.append(h("a", { class: "btn ghost", href: `#/s/${s.id}/${s.units[idx - 1].id}` }, `← ${s.units[idx - 1].title}`));
    nav.append(h("span"));
    if (idx < s.units.length - 1) nav.append(h("a", { class: "btn ghost", href: `#/s/${s.id}/${s.units[idx + 1].id}` }, `${s.units[idx + 1].title} →`));
    app.append(nav);
  }

  // ── 개념: 문제 풀기 전에 핵심 정리부터
  function viewConcept(app, s, u, base, hasPassage) {
    const card = h("section", { class: "group concept", html: u.concept });
    typeset(card);
    app.append(card);
    if (window.STORY.commentBox) app.append(window.STORY.commentBox(`unit:${s.id}/${u.id}`, "이 단원 의견 · 나만의 공부법"));
    app.append(h("div", { class: "bottombar" },
      h("a", { class: "btn ghost", href: `#/guide/${s.id}` }, "📘 과목 공부법"),
      h("a", { class: "btn big", href: `${base}/${hasPassage ? "read" : "one"}` }, hasPassage ? "개념 다 봤어요 · 지문 읽기 →" : "개념 다 봤어요 · 문제 풀기 →")));
  }

  // ── 과목 공부법 + 단원별 개념 한눈에
  function viewGuide(app, sid) {
    const s = subjects.find((x) => x.id === sid);
    if (!s || !s.guide) return viewNotFound(app);
    app.append(h("nav", { class: "crumbs" }, h("a", { href: s.embed ? "#/" : `#/s/${s.id}` }, s.embed ? "← 홈" : `← ${s.name} 단원 목록`)));
    app.append(h("h1", { class: "page-title" }, `📘 ${s.name} 공부법`));
    const how = h("section", { class: "group concept", html: s.guide });
    typeset(how);
    app.append(how);
    const withConcept = s.units.filter((u) => u.concept);
    if (withConcept.length) {
      app.append(h("div", { class: "secthd" }, h("b", {}, "단원별 핵심 개념"), h("span", { class: "muted small" }, "눌러서 펼치기")));
      withConcept.forEach((u) => {
        const body = h("div", { class: "concept", html: u.concept });
        let done = false;
        app.append(h("details", { class: "cdet", ontoggle: (e) => { if (e.target.open && !done) { typeset(body); done = true; } } },
          h("summary", {}, /^\d/.test(u.id) ? `${u.id}. ${u.title}` : u.title),
          body,
          h("a", { class: "btn small", href: `#/s/${s.id}/${u.id}/one` }, "이 단원 문제 풀기 →")));
      });
    }
    if (s.embed) app.append(h("div", { class: "pager" }, h("span"), h("a", { class: "btn", href: `#/s/${s.id}` }, `${s.name} 공부 시작 →`)));
    if (window.STORY.commentBox) app.append(window.STORY.commentBox(`guide:${s.id}`, `${s.name} 공부법 의견 · 나만의 공부법`));
  }

  // ── 지문 읽기: 지문만 쭉 읽고 문제로
  function viewRead(app, s, u, base) {
    u.groups.forEach((g, gi) => {
      if (!g.passage) return;
      const card = h("section", { class: "group read" },
        h("div", { class: "group-head" }, h("span", { class: "group-no" }, gi + 1), g.src ? h("span", { class: "src" }, g.src) : null),
        g.ptitle ? h("div", { class: "topic" }, h("span", { class: "muted small" }, "주제"), h("b", {}, g.ptitle)) : null,
        h("div", { class: "group-q", html: g.q }),
        h("div", { class: "full", html: g.passage }));
      typeset(card);
      app.append(card);
    });
    app.append(h("div", { class: "bottombar" },
      h("span", { class: "muted small" }, "지문 전체를 먼저 읽어 보세요. 밑줄·기호는 문제에 나와요."),
      h("a", { class: "btn big", href: `${base}/one` }, "다 읽었어요 · 문제 풀기 →")));
  }

  // ── 한 문제씩
  function viewOne(app, s, u, base, refreshSummary) {
    const list = [];
    u.groups.forEach((g, gi) => g.items.forEach((it) => list.push({ it, g, gi })));
    if (!list.length) return app.append(h("div", { class: "empty" }, "문제가 없어요."));
    let i = Math.min(getPos(base), list.length - 1);
    const idx = s.units.indexOf(u);
    const stage = h("div", { class: "focus" });
    const bar = h("div", { class: "bottombar" });
    app.append(stage, bar);

    const go = (k) => { i = Math.max(0, Math.min(list.length - 1, k)); setPos(base, i); draw(); window.scrollTo(0, 0); };
    const paintBar = () => {
      const cur = list[i];
      const done = progress[cur.it.id];
      const last = i === list.length - 1;
      const next = last && idx < s.units.length - 1
        ? h("a", { class: "btn" + (done ? " pulse" : ""), href: `#/s/${s.id}/${s.units[idx + 1].id}` }, "다음 단원 →")
        : h("button", { class: "btn" + (done ? " pulse" : ""), type: "button", disabled: last, onclick: () => go(i + 1) }, "다음 →");
      const dotsEl = list.length <= 60 ? h("div", { class: "pdots" }, list.map((x, k) =>
        h("button", { type: "button", "aria-label": `${k + 1}번째 문제`, onclick: () => go(k),
          class: "pdot" + (k === i ? " cur" : "") + (progress[x.it.id] === "o" ? " o" : progress[x.it.id] === "x" ? " x" : "") }))) : null;
      bar.replaceChildren(
        h("button", { class: "btn ghost", type: "button", disabled: i === 0, onclick: () => go(i - 1) }, "← 이전"),
        h("div", { class: "pmid" }, h("b", {}, `${i + 1} / ${list.length}`), dotsEl),
        next);
    };
    const draw = () => {
      const { it, g, gi } = list[i];
      const card = h("section", { class: "group fcard" });
      card.append(h("div", { class: "group-head" },
        h("span", { class: "group-no" }, gi + 1),
        g.stars ? h("span", { class: "stars", title: "난이도" }, stars(g.stars)) : null,
        g.src ? h("span", { class: "src" }, g.src) : null,
        inkTools(card, `ink:q:${it.id}`, { key: `ink:s:${it.id}`, title: `${u.title} ${gi + 1}번${it.label ? " " + it.label : ""}` })));
      if (g.q) card.append(h("div", { class: "group-q", html: g.q }));
      if (g.passage) card.append(h("button", { class: "btn ghost small passbtn", type: "button", onclick: () => openPassage(g) }, "📖 지문 보기"));
      const figs = images(s, g.img, g.imgLabels); if (figs) card.append(figs);
      card.append(itemCard(s, it, g, () => { refreshSummary(); paintBar(); }));
      typeset(card);
      // 넓은 화면에서는 지문을 왼쪽에 붙여 둠
      if (window.STORY.inkPage) window.STORY.inkPage.setKey("q:" + it.id);   // 문제마다 필기가 따로 (저절로 저장)
      if (g.passage) {
        const side = h("aside", { class: "pside", html: g.passage });
        typeset(side);
        stage.className = "focus has-passage";
        stage.replaceChildren(side, card);
      } else {
        stage.className = "focus";
        stage.replaceChildren(card);
      }
      paintBar();
      const inp = card.querySelector(".answer-input");
      if (inp && window.matchMedia("(pointer:fine)").matches) inp.focus({ preventScroll: true });
    };
    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    keyHandler = (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;   // 답 입력 중 Enter 는 채점만
      if (!document.body.contains(stage)) { document.removeEventListener("keydown", keyHandler); keyHandler = null; return; }
      if (/INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName) || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
      // 1~5: 보기 고르기 · Enter: 채점한 뒤 다음 · S: 별표 · W: 필기
      if (/^[1-9]$/.test(e.key)) { const c = stage.querySelectorAll(".fcard .choice")[+e.key - 1]; if (c) c.click(); }
      if (e.key === "Enter" && stage.querySelector(".fcard .result")) go(i + 1);
      if (e.key.toLowerCase() === "s") { const b = stage.querySelector(".fcard .star-btn"); if (b) b.click(); }
      if (e.key.toLowerCase() === "w" && window.STORY.inkPage) window.STORY.inkPage.toggle();
    };
    document.addEventListener("keydown", keyHandler);
    draw();
  }

  function images(s, files, labels) {
    if (!files || !files.length) return null;
    return h("div", { class: labels ? "figs grid" : "figs" }, files.map((f, i) =>
      h("figure", { class: "fig" },
        h("img", { src: `assets/${s.id}/${f}`, alt: labels ? `보기 ${labels[i]} 그래프` : "문제 그림", loading: "lazy" }),
        labels ? h("figcaption", {}, labels[i]) : null)));
  }

  function groupCard(s, g, no, its, onChange, context) {
    const card = h("section", { class: "group", style: `--c:${s.color}` });
    card.append(h("div", { class: "group-head" },
      h("span", { class: "group-no" }, no),
      g.stars ? h("span", { class: "stars", title: "난이도" }, stars(g.stars)) : null,
      g.src ? h("span", { class: "src" }, g.src) : null,
      context ? h("span", { class: "src" }, context) : null,
      inkTools(card, `ink:g:${its[0].id.replace(/-\d+$/, "")}:${context ? "w" : "a"}`, { key: `ink:s:${its[0].id}`, title: `${no}번` })));
    if (g.q) card.append(h("div", { class: "group-q", html: g.q }));
    if (g.passage) card.append(h("details", { class: "pdet", open: !context }, h("summary", {}, "📖 지문"), h("div", { html: g.passage })));
    const figs = images(s, g.img, g.imgLabels);
    if (figs) card.append(figs);
    const solo = g.wide || (g.items.length === 1 && !its[0].label && !its[0].q);
    const wrap = h("div", { class: "items" + (solo ? " solo" : "") });
    its.forEach((it) => wrap.append(itemCard(s, it, g, onChange)));
    card.append(wrap);
    typeset(card);
    return card;
  }

  // ⭐ 별표 (나중에 다시 볼 문제) — story-star-v1 { 문제id: 시각 }, 로그인하면 동기화
  const STAR = "story-star-v1";
  function toggleStar(id) {
    const m = load(STAR);
    if (m[id]) delete m[id]; else m[id] = Date.now();
    store(STAR, m);
    return !!m[id];
  }
  function starBtn(it) {
    const on = !!load(STAR)[it.id];
    const b = h("button", { class: "star-btn" + (on ? " on" : ""), type: "button", title: "별표 — 나중에 다시 보기 (S)", "aria-label": "별표", "aria-pressed": String(on) }, on ? "★" : "☆");
    b.addEventListener("click", () => {
      const now = toggleStar(it.id);
      b.classList.toggle("on", now); b.textContent = now ? "★" : "☆"; b.setAttribute("aria-pressed", String(now));
      if (window.STORY.toast) window.STORY.toast(now ? "⭐ 별표했어요" : "별표를 뺐어요");
    });
    return b;
  }
  function viewStar(app, sid) {
    const only = subjects.find((x) => x.id === sid);
    const stars = load(STAR);
    app.append(h("h1", { class: "page-title" }, "⭐ 별표 문제", only ? ` · ${only.name}` : ""));
    app.append(h("p", { class: "muted" }, "문제 오른쪽 위 ☆ 를 누르면 여기에 모여요. 헷갈리는 문제, 시험 전에 다시 볼 문제를 별표해 두세요."));
    let count = 0;
    (only ? [only] : subjects).forEach((s) => s.units.forEach((u) => u.groups.forEach((g, gi) => {
      const its = g.items.filter((it) => stars[it.id]);
      if (!its.length) return;
      count += its.length;
      app.append(groupCard(s, g, gi + 1, its, null, `${s.name} · ${u.title}`));
    })));
    if (!count) app.append(h("div", { class: "empty" }, "아직 별표한 문제가 없어요."));
  }

  // ── 🔍 검색: 문제 · 지문 · 개념 · 공부법
  const strip = (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/\$|\\[a-z]+|[{}]/gi, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
  function viewSearch(app, q0) {
    app.append(h("h1", { class: "page-title" }, "🔍 검색"));
    const input = h("input", { class: "answer-input search-in", type: "search", placeholder: "문제 · 지문 · 개념 · 공부법에서 찾기 (예: 도함수, 기본권, print)", value: q0 || "", "aria-label": "검색어" });
    const out = h("div", { class: "search-out" });
    app.append(input, out);
    const run = () => {
      const q = input.value.trim().toLowerCase();
      history.replaceState(null, "", "#/search/" + encodeURIComponent(input.value.trim()));
      if (q.length < 1) { out.replaceChildren(h("p", { class: "muted small" }, "두 글자 이상 쓰면 더 잘 찾아져요.")); return; }
      const res = [];
      const hit = (text) => { const t = strip(text); const i = t.toLowerCase().indexOf(q); return i < 0 ? null : (i > 30 ? "…" : "") + t.slice(Math.max(0, i - 30), i + q.length + 50) + "…"; };
      subjects.forEach((s) => {
        if (s.guide) { const m = hit(s.guide); if (m) res.push({ kind: "📘 공부법", title: s.name, href: `#/guide/${s.id}`, m }); }
        s.units.forEach((u) => {
          if (u.concept) { const m = hit(u.concept); if (m) res.push({ kind: "💡 개념", title: `${s.name} · ${u.title}`, href: `#/s/${s.id}/${u.id}/concept`, m }); }
          let k = 0;
          u.groups.forEach((g, gi) => g.items.forEach((it) => {
            const idx = k++;
            const m = hit([g.q, g.ptitle, it.label, it.q, it.a, (it.choices || []).join(" "), it.explain, (it.steps || []).join(" ")].join(" ")) || hit(g.passage);
            if (m) res.push({ kind: "✏️ 문제", title: `${s.name} · ${u.title} ${gi + 1}번 ${it.label || ""}`, m, go: () => { setPos(`#/s/${s.id}/${u.id}`, idx); location.hash = `#/s/${s.id}/${u.id}/one`; }, st: progress[it.id] });
          }));
        });
      });
      out.replaceChildren(h("p", { class: "muted small" }, `${res.length}개 찾았어요${res.length > 80 ? " (앞의 80개만 보여요)" : ""}`),
        ...res.slice(0, 80).map((r) => {
          const box = h(r.href ? "a" : "button", { class: "search-hit", ...(r.href ? { href: r.href } : { type: "button", onclick: r.go }) },
            h("div", {}, h("span", { class: "chip" }, r.kind), " ", h("b", {}, r.title), r.st ? h("span", { class: r.st === "o" ? "ok-dot" : "x-dot" }, r.st === "o" ? " ⭕" : " ❌") : null),
            h("div", { class: "muted small" }, r.m));
          return box;
        }));
    };
    let t = 0;
    input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 200); });
    run();
    setTimeout(() => input.focus(), 50);
  }

  // ✏️ 필기 버튼들 (js/ink.js) — 카드 머리 오른쪽에 붙음
  function inkTools(card, key, scratch) {
    const S = window.STORY;
    if (!S.inkButton) return null;
    return h("span", { class: "ink-tools" }, S.inkButton(),
      scratch ? h("button", { class: "ink-toggle", type: "button", title: "넓은 연습장에 풀기", onclick: () => S.openScratch(scratch.key, scratch.title) }, "📓 연습장") : null);
  }

  // 풀이 과정: 틀렸을 때는 펼쳐서, 맞았을 때는 접어서 보여 줌
  function stepsEl(it, open) {
    if (!it.steps || !it.steps.length) return null;
    return h("details", { class: "steps-sol", open: !!open },
      h("summary", {}, "📝 풀이 과정"),
      h("ol", {}, it.steps.map((t) => h("li", { html: t }))));
  }

  function itemCard(s, it, g, onChange) {
    const el = h("div", { class: "item", "data-id": it.id });
    const draw = () => {
      el.replaceChildren(starBtn(it));
      const st = progress[it.id];
      el.className = "item" + (st === "o" ? " is-o" : st === "x" ? " is-x" : "") + (it.type === "self" ? " is-self" : "");
      if (it.label || it.q) {
        el.append(h("div", { class: "item-q" },
          it.label ? h("span", { class: "label" }, it.label) : null,
          it.q ? h("span", { html: it.q }) : null));
      }
      const figs = images(s, it.img);
      if (figs) el.append(figs);

      if (st) el.append(result(st));
      else el.append(answerArea());
      typeset(el);
    };
    const mark = (st) => { setState(it.id, st); draw(); onChange && onChange(); };

    function result(st) {
      const box = h("div", { class: "result" },
        h("div", { class: "verdict" }, st === "o" ? "⭕ 정답!" : "❌ 다시 확인해 봐요"),
        h("div", { class: "answer" }, h("span", { class: "muted" }, "정답 "), h("span", { html: it.a })));
      const explain = it.explain || g.explain;
      if (explain) box.append(h("div", { class: "explain", html: "💡 " + explain }));
      const sol = stepsEl(it, st === "x");
      if (sol) box.append(sol);
      const row = h("div", { class: "row" });
      if (st === "x" && it.type === "input") {
        row.append(h("button", { class: "btn ghost small", onclick: () => mark("o") }, "내 답도 맞아요"));
      }
      row.append(h("button", { class: "btn ghost small", onclick: () => mark(null) }, "다시 풀기"));
      box.append(row);
      return box;
    }

    function answerArea() {
      if (it.type === "choice" || it.type === "multi") return choiceArea();
      if (it.type === "self") return selfArea();
      return inputArea();
    }

    function inputArea() {
      const input = h("input", {
        class: "answer-input", type: "text", inputmode: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
        placeholder: "답 입력", "aria-label": `${it.label || ""} 답 입력`,
      });
      const go = () => { if (input.value.trim()) mark(checkInput(it, input.value) ? "o" : "x"); else input.focus(); };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
      const area = h("div", { class: "answer-area" },
        h("div", { class: "row" }, input, h("button", { class: "btn", onclick: go }, "채점")));
      if (s.mathInput) {
        const keys = ["√", "∞", "-", "/", "^", "Δx", "(", ")", ","];
        area.append(h("div", { class: "keys" }, keys.map((k) => h("button", {
          class: "key", type: "button", tabindex: "-1",
          onmousedown: (e) => e.preventDefault(),
          onclick: () => {
            const a = input.selectionStart ?? input.value.length, b = input.selectionEnd ?? a;
            input.value = input.value.slice(0, a) + k + input.value.slice(b);
            input.focus(); input.setSelectionRange(a + k.length, a + k.length);
          },
        }, k))));
      }
      area.append(h("button", { class: "link", onclick: () => mark("x") }, "모르겠어요 · 정답 보기"));
      return area;
    }

    function choiceArea() {
      const choices = it.shuffle ? shuffle(it.choices) : it.choices;
      const area = h("div", { class: "answer-area" });
      const cls = "choices" + (choices.some((c) => c.length > 14) ? " long" : "");
      if (it.type === "choice") {
        area.append(h("div", { class: cls }, choices.map((c) =>
          h("button", { class: "choice", html: c, onclick: () => mark(c === it.ok[0] ? "o" : "x") }))));
        return area;
      }
      const picked = new Set();
      area.append(h("div", { class: cls }, choices.map((c) => {
        const b = h("button", {
          class: "choice", html: c, "aria-pressed": "false",
          onclick: () => {
            picked.has(c) ? picked.delete(c) : picked.add(c);
            b.classList.toggle("on", picked.has(c));
            b.setAttribute("aria-pressed", picked.has(c));
          },
        });
        return b;
      })));
      area.append(h("div", { class: "row" },
        h("span", { class: "muted small" }, "있는 대로 모두 고르세요"),
        h("button", {
          class: "btn", onclick: () => {
            const ok = new Set(it.ok);
            mark(picked.size === ok.size && [...picked].every((c) => ok.has(c)) ? "o" : "x");
          },
        }, "채점")));
      return area;
    }

    function selfArea() {
      const area = h("div", { class: "answer-area" });
      area.append(h("textarea", { class: "answer-note", rows: "2", placeholder: "여기에 답이나 풀이를 적어 보세요 (선택)" }));
      const reveal = h("div", { class: "reveal hidden" },
        h("div", { class: "answer" }, h("span", { class: "muted" }, "정답 "), h("span", { html: it.a })),
        (it.explain ? h("div", { class: "explain", html: "💡 " + it.explain }) : null),
        stepsEl(it, true),
        h("div", { class: "row" },
          h("span", { class: "muted small" }, "스스로 채점"),
          h("button", { class: "btn ok", onclick: () => mark("o") }, "⭕ 맞았어요"),
          h("button", { class: "btn no", onclick: () => mark("x") }, "❌ 틀렸어요")));
      const btn = h("button", {
        class: "btn ghost", onclick: () => { reveal.classList.remove("hidden"); btn.remove(); typeset(reveal); },
      }, "정답 보기");
      area.append(btn, reveal);
      return area;
    }

    draw();
    return el;
  }

  // ───────────────────────── 화면: 오답노트
  function viewWrong(app, sid) {
    const only = subjects.find((x) => x.id === sid);
    app.append(h("h1", { class: "page-title" }, "오답노트", only ? ` · ${only.name}` : ""));
    app.append(h("p", { class: "muted" }, "틀린 문제만 모았어요. 다시 풀어서 맞히면 다음에 열 때 목록에서 빠져요."));
    let count = 0;
    (only ? [only] : subjects).forEach((s) => {
      s.units.forEach((u) => {
        u.groups.forEach((g, gi) => {
          const its = g.items.filter((it) => progress[it.id] === "x");
          if (!its.length) return;
          count += its.length;
          app.append(groupCard(s, g, gi + 1, its, null, `${s.name} · ${u.title}`));
        });
      });
    });
    if (!count) app.append(h("div", { class: "empty" }, "틀린 문제가 없어요. 멋져요! 🎉"));
  }

  // ───────────────────────── 화면: 시험 보기
  // 채점 가능한 문제(입력·선택)만 골라 한 번에 풀고 제출하면 점수와 해설을 보여 줌
  let testRun = null;
  function testPool(s, unitIds) {
    const out = [];
    s.units.forEach((u) => {
      if (!unitIds.has(u.id)) return;
      u.groups.forEach((g, gi) => g.items.forEach((it) => { if (it.type !== "self") out.push({ it, g, u, gi }); }));
    });
    return out;
  }
  function viewTest(app, sid) {
    const s = subjects.find((x) => x.id === sid);
    if (!s || s.embed) return viewNotFound(app);
    if (testRun && testRun.sid === sid) return testRun.done ? viewTestResult(app, s) : viewTestRun(app, s);

    app.append(h("nav", { class: "crumbs" }, h("a", { href: `#/s/${s.id}` }, `← ${s.name} 단원 목록`)));
    app.append(h("h1", { class: "page-title" }, "시험 보기"));
    app.append(h("p", { class: "muted" }, "채점 없이 끝까지 풀고 한 번에 제출해요. 틀린 문제는 오답노트에 들어가요."));
    const picked = new Set(s.units.map((u) => u.id));
    const opts = { count: 20, limit: 0, wrongOnly: false };
    const info = h("div", { class: "muted small" });
    const refresh = () => {
      let pool = testPool(s, picked);
      if (opts.wrongOnly) pool = pool.filter((x) => progress[x.it.id] === "x");
      info.textContent = `고른 범위의 문제 ${pool.length}개 중 ${Math.min(opts.count || pool.length, pool.length)}개를 무작위로 내요.`;
      return pool;
    };
    const unitBox = h("div", { class: "picks" }, s.units.map((u) => {
      const b = h("button", { class: "chip on", type: "button", onclick: () => {
        picked.has(u.id) ? picked.delete(u.id) : picked.add(u.id);
        b.classList.toggle("on", picked.has(u.id)); refresh();
      } }, /^\d/.test(u.id) ? `${u.id}. ${u.title}` : u.title);
      return b;
    }));
    const seg = (label, key, values) => h("div", { class: "seg" }, h("b", {}, label), values.map(([v, t]) => {
      const b = h("button", { class: "chip" + (opts[key] === v ? " on" : ""), type: "button", onclick: () => {
        opts[key] = v; b.parentNode.querySelectorAll(".chip").forEach((c) => c.classList.remove("on")); b.classList.add("on"); refresh();
      } }, t);
      return b;
    }));
    app.append(h("div", { class: "group" },
      h("div", { class: "seg" }, h("b", {}, "범위"),
        h("button", { class: "link", type: "button", onclick: () => { s.units.forEach((u) => picked.add(u.id)); unitBox.querySelectorAll(".chip").forEach((c) => c.classList.add("on")); refresh(); } }, "전체"),
        h("button", { class: "link", type: "button", onclick: () => { picked.clear(); unitBox.querySelectorAll(".chip").forEach((c) => c.classList.remove("on")); refresh(); } }, "모두 빼기")),
      unitBox,
      seg("문제 수", "count", [[10, "10"], [20, "20"], [30, "30"], [0, "전부"]]),
      seg("시간", "limit", [[0, "제한 없음"], [10, "10분"], [20, "20분"], [30, "30분"], [50, "50분"]]),
      h("label", { class: "toggle" }, h("input", { type: "checkbox", onchange: (e) => { opts.wrongOnly = e.target.checked; refresh(); } }), " 전에 틀린 문제만"),
      info,
      h("button", { class: "btn big", type: "button", onclick: () => {
        const pool = shuffle(refresh());
        if (!pool.length) { info.textContent = "고른 범위에 문제가 없어요."; return; }
        const qs = opts.count ? pool.slice(0, opts.count) : pool;
        if (window.STORY.inkClear) window.STORY.inkClear("ink:p:test/");   // 지난 시험의 필기는 지움
        testRun = { sid, qs, ans: {}, start: Date.now(), limit: opts.limit * 60000, done: false };
        render();
      } }, "시작하기")));
    refresh();
  }

  let tick = 0;
  function viewTestRun(app, s) {
    const run = testRun;
    const bar = h("div", { class: "testbar" });
    const paintBar = () => {
      const answered = run.qs.filter((q) => run.ans[q.it.id] != null && run.ans[q.it.id] !== "").length;
      const el = Date.now() - run.start;
      const left = run.limit ? Math.max(0, run.limit - el) : null;
      const mm = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
      bar.replaceChildren(
        h("span", {}, `${answered}/${run.qs.length} 답함`),
        h("span", { class: left !== null && left < 60000 ? "warn" : "" }, left !== null ? `남은 시간 ${mm(left)}` : `${mm(el)} 지남`),
        h("button", { class: "btn", type: "button", onclick: () => finish(false) }, "제출"));
      if (left === 0) finish(true);
    };
    const finish = (timeout) => {
      if (run.done) return;
      const left = run.qs.filter((q) => run.ans[q.it.id] == null || run.ans[q.it.id] === "").length;
      if (!timeout && left && !confirm(`아직 ${left}문제를 안 풀었어요. 제출할까요?`)) return;
      clearInterval(tick);
      run.done = true; run.end = Date.now(); run.timeout = timeout;
      const right = [], wrong = [];
      run.qs.forEach((q) => {
        const a = run.ans[q.it.id];
        let ok = false;
        if (q.it.type === "input") ok = a != null && a !== "" && checkInput(q.it, a);
        else if (q.it.type === "choice") ok = a === q.it.ok[0];
        else if (q.it.type === "multi") { const set = new Set(a || []); ok = set.size === q.it.ok.length && q.it.ok.every((c) => set.has(c)); }
        q.ok = ok; (ok ? right : wrong).push(q.it.id);
      });
      if (right.length) setStates(right, "o");
      if (wrong.length) setStates(wrong, "x");
      window.scrollTo(0, 0); render();
    };
    clearInterval(tick); tick = setInterval(() => { if (!document.body.contains(bar)) clearInterval(tick); else paintBar(); }, 1000);
    paintBar();
    app.append(bar);

    run.qs.forEach((q, k) => {
      const card = h("section", { class: "group" });
      card.append(h("div", { class: "group-head" }, h("span", { class: "group-no" }, k + 1),
        q.g.stars ? h("span", { class: "stars" }, stars(q.g.stars)) : null, h("span", { class: "src" }, q.u.title),
        inkTools(card, `ink:t:${q.it.id}`, { key: `ink:t:s:${q.it.id}`, title: `시험 ${k + 1}번` })));
      if (q.g.q) card.append(h("div", { class: "group-q", html: q.g.q }));
      if (q.g.passage) card.append(h("button", { class: "btn ghost small passbtn", type: "button", onclick: () => openPassage(q.g) }, "📖 지문 보기"));
      const figs = images(s, q.g.img, q.g.imgLabels); if (figs) card.append(figs);
      const item = h("div", { class: "item" });
      if (q.it.label || q.it.q) item.append(h("div", { class: "item-q" }, q.it.label ? h("span", { class: "label" }, q.it.label) : null, q.it.q ? h("span", { html: q.it.q }) : null));
      const f2 = images(s, q.it.img); if (f2) item.append(f2);
      if (q.it.type === "input") {
        item.append(h("input", { class: "answer-input", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
          placeholder: "답 입력", value: run.ans[q.it.id] || "", oninput: (e) => { run.ans[q.it.id] = e.target.value; } }));
      } else {
        const choices = q.choices || (q.choices = q.it.shuffle ? shuffle(q.it.choices) : q.it.choices);
        const multi = q.it.type === "multi";
        const box = h("div", { class: "choices" + (choices.some((c) => c.length > 14) ? " long" : "") });
        choices.forEach((c) => {
          const cur = run.ans[q.it.id];
          const on = multi ? (cur || []).includes(c) : cur === c;
          const b = h("button", { class: "choice" + (on ? " on" : ""), type: "button", html: c, onclick: () => {
            if (multi) {
              const set = new Set(run.ans[q.it.id] || []); set.has(c) ? set.delete(c) : set.add(c);
              run.ans[q.it.id] = [...set]; b.classList.toggle("on", set.has(c));
            } else {
              run.ans[q.it.id] = c; box.querySelectorAll(".choice").forEach((x) => x.classList.remove("on")); b.classList.add("on");
            }
          } });
          box.append(b);
        });
        if (multi) item.append(h("div", { class: "muted small" }, "있는 대로 모두 고르세요"));
        item.append(box);
      }
      card.append(item);
      typeset(card);
      app.append(card);
    });
    app.append(h("div", { class: "pager" }, h("span"), h("button", { class: "btn big", type: "button", onclick: () => finish(false) }, "제출하기")));
  }

  function viewTestResult(app, s) {
    const run = testRun;
    const right = run.qs.filter((q) => q.ok).length;
    const pct = Math.round((right / run.qs.length) * 100);
    const mins = Math.max(1, Math.round((run.end - run.start) / 60000));
    app.append(h("div", { class: "score" },
      h("div", { class: "big" }, `${pct}점`),
      h("div", {}, `${run.qs.length}문제 중 ${right}개 맞음 · ${mins}분${run.timeout ? " · 시간 종료" : ""}`)));
    // 단원별 정답률
    const byUnit = new Map();
    run.qs.forEach((q) => { const r = byUnit.get(q.u) || { n: 0, o: 0 }; r.n++; if (q.ok) r.o++; byUnit.set(q.u, r); });
    app.append(h("div", { class: "group" }, h("b", {}, "단원별 정답률"),
      [...byUnit].map(([u, r]) => h("div", { class: "hrow" },
        h("span", {}, u.title), h("span", { class: "muted" }, `${r.o}/${r.n}`),
        h("div", { class: "bar" }, h("span", { class: "bar-o", style: `width:${Math.round((r.o / r.n) * 100)}%` }))))));
    const wrong = run.qs.filter((q) => !q.ok);
    app.append(h("div", { class: "row" },
      wrong.length ? h("button", { class: "btn", type: "button", onclick: () => {
        if (window.STORY.inkClear) window.STORY.inkClear("ink:p:test/");   // 지난 시험의 필기는 지움
        testRun = { sid: run.sid, qs: shuffle(wrong.map((q) => ({ it: q.it, g: q.g, u: q.u, gi: q.gi }))), ans: {}, start: Date.now(), limit: run.limit, done: false };
        render();
      } }, "틀린 것만 다시 시험") : null,
      h("button", { class: "btn ghost", type: "button", onclick: () => { testRun = null; render(); } }, "새 시험"),
      h("a", { class: "btn ghost", href: `#/s/${s.id}` }, "단원 목록")));
    if (wrong.length) app.append(h("div", { class: "secthd" }, h("b", {}, `틀린 문제 ${wrong.length}개`)));
    wrong.forEach((q) => {
      const a = run.ans[q.it.id];
      const mine = a == null || a === "" || (Array.isArray(a) && !a.length) ? "(안 품)" : Array.isArray(a) ? a.join(", ") : a;
      const card = h("section", { class: "group" },
        h("div", { class: "group-head" }, h("span", { class: "src" }, q.u.title)),
        q.g.q ? h("div", { class: "group-q", html: q.g.q }) : null,
        q.g.passage ? h("button", { class: "btn ghost small passbtn", type: "button", onclick: () => openPassage(q.g) }, "📖 지문 보기") : null,
        images(s, q.g.img, q.g.imgLabels),
        h("div", { class: "item is-x" },
          q.it.label || q.it.q ? h("div", { class: "item-q" }, q.it.label ? h("span", { class: "label" }, q.it.label) : null, q.it.q ? h("span", { html: q.it.q }) : null) : null,
          images(s, q.it.img),
          h("div", { class: "answer" }, h("span", { class: "muted" }, "내 답 "), h("span", { html: mine })),
          h("div", { class: "answer" }, h("span", { class: "muted" }, "정답 "), h("span", { html: q.it.a })),
          q.it.explain || q.g.explain ? h("div", { class: "explain", html: "💡 " + (q.it.explain || q.g.explain) }) : null,
          stepsEl(q.it, true),
          q.it.type === "input" ? h("button", { class: "btn ghost small", type: "button", onclick: (e) => { setState(q.it.id, "o"); q.ok = true; e.target.closest(".group").remove(); } }, "내 답도 맞아요") : null));
      typeset(card);
      app.append(card);
    });
  }

  function viewNotFound(app) {
    app.append(h("div", { class: "empty" }, "페이지를 찾을 수 없어요. ", h("a", { href: "#/" }, "홈으로")));
  }

  // ───────────────────────── 라우터
  let lastRoute = "";
  function render() {
    const app = $("#app");
    const route = location.hash.replace(/^#\/?/, "");
    const parts = route.split("/").filter(Boolean).map(decodeURIComponent);
    const y = route === lastRoute ? window.scrollY : 0;
    app.replaceChildren();
    document.body.classList.remove("embedded", "wide-note");
    if (window.STORY.applySettings) window.STORY.applySettings();
    // 화면 전체 필기: 문제·오답·시험·공부법 화면에서만, 화면마다 따로 저장
    if (window.STORY.inkPage) window.STORY.inkPage.setKey(["s", "wrong", "test", "guide", "eng"].includes(parts[0]) && parts[1] ? route : null);
    renderTop(["s", "wrong", "test", "guide", "note", "star"].includes(parts[0]) ? parts[1] : null);
    if (parts[0] === "s" && parts[2]) viewUnit(app, parts[1], parts[2], parts[3]);
    else if (parts[0] === "s" && parts[1]) viewSubject(app, parts[1]);
    else if (parts[0] === "wrong") viewWrong(app, parts[1]);
    else if (parts[0] === "test" && parts[1]) viewTest(app, parts[1]);
    else if (parts[0] === "guide" && parts[1]) viewGuide(app, parts[1]);
    else if (parts[0] === "board" && window.STORY.viewBoard) window.STORY.viewBoard(app);
    else if (parts[0] === "shop" && window.STORY.viewShop) window.STORY.viewShop(app, parts[1]);
    else if (parts[0] === "note" && window.STORY.viewNotes) window.STORY.viewNotes(app, parts[1]);
    else if (parts[0] === "star") viewStar(app, parts[1]);
    else if (parts[0] === "eng" && window.STORY.viewEnglish) window.STORY.viewEnglish(app, parts[1], parts[2]);
    else if (parts[0] === "search") viewSearch(app, parts.slice(1).join("/"));
    else viewHome(app);
    window.scrollTo(0, y);
    lastRoute = route;
  }

  window.addEventListener("hashchange", render);
  // 어디서든 / 를 누르면 검색
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
    e.preventDefault(); location.hash = "#/search";
  });
  document.addEventListener("DOMContentLoaded", () => {
    render();
    // 포인트가 바뀌면 위쪽 🪙 와 상점 화면을 새로 그림
    if (window.STORY.onPoints) window.STORY.onPoints(() => { renderTop(currentSid); if (/^#\/shop/.test(location.hash)) render(); });
  });

  // 다른 스크립트(js/sync.js 등)와 주고받는 통로
  Object.assign(window.STORY, {
    onChange: (f) => listeners.push(f),
    reload() { progress = load(KEY); times = load(TKEY); render(); },
    today, load, render,
  });
  // 테스트용
  window.STORY._check = { norm, same, evalNum, subjects, safeHtml };
})();
