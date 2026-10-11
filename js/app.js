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
  };

  // [라벨, 문제, 정답(표시용), 인정 답(문자열|배열|null), 옵션] → 객체
  function toItem(arr, id, math) {
    const [label, q, a, ok, opt = {}] = arr;
    const okList = ok == null ? null : Array.isArray(ok) ? ok : [ok];
    const type = opt.type || (okList ? "input" : "self");
    return { id, label, q, a, ok: okList, type, math: !!math, ...opt };
  }

  // ───────────────────────── 저장소
  const KEY = "story-progress-v1";
  let progress = {};
  try { progress = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { progress = {}; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* 저장 불가 환경 */ }
  }
  function setState(id, st) {
    if (st) progress[id] = st; else delete progress[id];
    save();
    updateWrongBadge();
  }

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
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
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
  function updateWrongBadge() {
    const n = Object.values(progress).filter((v) => v === "x").length;
    const a = $("#nav-wrong");
    if (a) a.textContent = n ? `오답노트 ${n}` : "오답노트";
  }

  // ───────────────────────── 화면: 홈
  function subjectCard(s) {
    const st = stats(s.units.flatMap(allItems));
    return h("a", { class: "subject-card", href: `#/s/${s.id}`, style: `--c:${s.color}` },
      h("div", { class: "subject-icon" }, s.icon),
      h("div", { class: "subject-name" }, s.name),
      h("div", { class: "subject-desc" }, s.desc),
      h("div", { class: "subject-meta" }, `${s.units.length}단원 · ${st.total}문제`),
      bar(st, s.color),
      h("div", { class: "subject-meta small" }, st.done ? `푼 문제 ${st.done} · 맞음 ${st.o}` : "아직 시작 전"));
  }
  function examBox(s) {
    return h("div", { class: "exam", style: `--c:${s.color}` },
      h("div", { class: "exam-count" }, "📋 ", s.exam.count),
      h("ul", {}, s.exam.range.map((r) => h("li", {}, r))));
  }

  function viewHome(app) {
    app.append(h("section", { class: "hero" },
      h("h1", {}, "오늘도 한 문제씩 🌱"),
      h("p", {}, "과목을 고르고 단원별로 풀어 보세요. 답을 입력하면 바로 채점돼요.")));

    const wrong = Object.values(progress).filter((v) => v === "x").length;
    if (wrong) {
      app.append(h("a", { class: "callout", href: "#/wrong" }, `📝 틀린 문제가 ${wrong}개 있어요. 오답노트에서 다시 풀어 볼까요?`));
    }

    const examSubjects = subjects.filter((s) => s.exam);
    const others = subjects.filter((s) => !s.exam);
    if (examSubjects.length) {
      app.append(h("h2", { class: "section-title" }, "2학년 2학기 1차 시험"));
      app.append(h("div", { class: "subject-grid" }, examSubjects.map(subjectCard)));
      const table = h("div", { class: "exam-table" }, examSubjects.map((s) =>
        h("a", { class: "exam-row", href: `#/s/${s.id}`, style: `--c:${s.color}` },
          h("div", { class: "exam-name" }, s.name), examBox(s))));
      app.append(h("details", { class: "scope" }, h("summary", {}, "📅 과목별 시험범위 보기"), table));
    }
    app.append(h("h2", { class: "section-title" }, "더 공부하기"));
    const grid = h("div", { class: "subject-grid" }, others.map(subjectCard));
    grid.append(h("div", { class: "subject-card soon" },
      h("div", { class: "subject-icon" }, "+"),
      h("div", { class: "subject-name" }, "새 과목"),
      h("div", { class: "subject-desc" }, "필요한 과목은 계속 추가할 수 있어요")));
    app.append(grid);
  }

  // ───────────────────────── 화면: 과목(단원 목록)
  function viewSubject(app, sid) {
    const s = subjects.find((x) => x.id === sid);
    if (!s) return viewNotFound(app);
    app.append(h("nav", { class: "crumbs" }, h("a", { href: "#/" }, "홈"), " / ", s.name));
    app.append(h("h1", { class: "page-title", style: `--c:${s.color}` }, h("span", { class: "dot" }, s.icon), s.name));
    app.append(h("p", { class: "muted" }, s.desc));
    if (s.exam) app.append(h("h2", { class: "section-title" }, "시험범위"), examBox(s));
    const list = h("div", { class: "unit-list" });
    s.units.forEach((u, i) => {
      const st = stats(allItems(u));
      list.append(h("a", { class: "unit-row", href: `#/s/${s.id}/${u.id}`, style: `--c:${s.color}` },
        h("div", { class: "unit-no" }, /^\d/.test(u.id) ? u.id : String(i + 1)),
        h("div", { class: "unit-body" },
          h("div", { class: "unit-title" }, u.title),
          h("div", { class: "unit-sub" }, `${u.sub || ""}${u.sub ? " · " : ""}${st.total}문제`),
          bar(st, s.color)),
        h("div", { class: "unit-score" }, st.done ? `${st.o}/${st.total}` : "")));
    });
    app.append(list);
  }

  // ───────────────────────── 화면: 단원(문제 풀이)
  let onlyWrong = false;
  function viewUnit(app, sid, uid) {
    const { s, u } = findUnit(sid, uid);
    if (!u) return viewNotFound(app);
    const items = allItems(u);
    const idx = s.units.indexOf(u);

    app.append(h("nav", { class: "crumbs" }, h("a", { href: "#/" }, "홈"), " / ", h("a", { href: `#/s/${s.id}` }, s.name), " / ", u.title));
    const head = h("div", { class: "unit-head", style: `--c:${s.color}` },
      h("h1", { class: "page-title" }, u.title),
      h("div", { class: "muted" }, u.sub || ""));
    const summary = h("div", { class: "summary" });
    const refreshSummary = () => {
      const st = stats(items);
      summary.replaceChildren(
        h("span", {}, `맞음 ${st.o}`), h("span", { class: "x" }, `틀림 ${st.x}`), h("span", { class: "muted" }, `남음 ${st.total - st.done}`),
        bar(st, s.color));
    };
    refreshSummary();

    const tools = h("div", { class: "tools" },
      h("label", { class: "toggle" },
        h("input", { type: "checkbox", checked: onlyWrong, onchange: (e) => { onlyWrong = e.target.checked; render(); } }),
        " 틀린 문제만 보기"),
      h("button", {
        class: "btn ghost", onclick: () => {
          if (!confirm("이 단원의 채점 기록을 모두 지울까요?")) return;
          items.forEach((it) => delete progress[it.id]); save(); updateWrongBadge(); render();
        },
      }, "기록 초기화"));
    head.append(summary, tools);
    app.append(head);

    let shown = 0;
    u.groups.forEach((g, gi) => {
      const its = onlyWrong ? g.items.filter((it) => progress[it.id] === "x") : g.items;
      if (!its.length) return;
      shown += its.length;
      app.append(groupCard(s, g, gi + 1, its, refreshSummary));
    });
    if (!shown) app.append(h("div", { class: "empty" }, onlyWrong ? "틀린 문제가 없어요 👏" : "문제가 없어요."));

    const nav = h("div", { class: "pager" });
    if (idx > 0) nav.append(h("a", { class: "btn ghost", href: `#/s/${s.id}/${s.units[idx - 1].id}` }, `← ${s.units[idx - 1].title}`));
    nav.append(h("span"));
    if (idx < s.units.length - 1) nav.append(h("a", { class: "btn ghost", href: `#/s/${s.id}/${s.units[idx + 1].id}` }, `${s.units[idx + 1].title} →`));
    app.append(nav);
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
      context ? h("span", { class: "src" }, context) : null));
    if (g.q) card.append(h("div", { class: "group-q", html: g.q }));
    const figs = images(s, g.img, g.imgLabels);
    if (figs) card.append(figs);
    const solo = g.items.length === 1 && !its[0].label && !its[0].q;
    const wrap = h("div", { class: "items" + (solo ? " solo" : "") });
    its.forEach((it) => wrap.append(itemCard(s, it, g, onChange)));
    card.append(wrap);
    typeset(card);
    return card;
  }

  function itemCard(s, it, g, onChange) {
    const el = h("div", { class: "item", "data-id": it.id });
    const draw = () => {
      el.replaceChildren();
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
  function viewWrong(app) {
    app.append(h("nav", { class: "crumbs" }, h("a", { href: "#/" }, "홈"), " / 오답노트"));
    app.append(h("h1", { class: "page-title" }, "📝 오답노트"));
    app.append(h("p", { class: "muted" }, "틀린 문제만 모았어요. 다시 풀어서 맞히면 목록에서 빠져요 (새로고침 시)."));
    let count = 0;
    subjects.forEach((s) => {
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
    if (parts[0] === "s" && parts[2]) viewUnit(app, parts[1], parts[2]);
    else if (parts[0] === "s" && parts[1]) viewSubject(app, parts[1]);
    else if (parts[0] === "wrong") viewWrong(app);
    else viewHome(app);
    updateWrongBadge();
    window.scrollTo(0, y);
    lastRoute = route;
  }

  window.addEventListener("hashchange", render);
  document.addEventListener("DOMContentLoaded", render);

  // 테스트용
  window.STORY._check = { norm, same, evalNum, subjects };
})();
