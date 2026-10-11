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
    renderTop(currentSid);
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
  const subjectHref = (s) => s.href ? encodeURI(s.href) : `#/s/${s.id}`;

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
          h("div", { class: "hts" }, `${s ? s.units.length + "단원 · " : ""}${st.done}/${st.total} 문항 풂`)),
        h("a", { class: "ib", id: "nav-wrong", href: s ? `#/wrong/${s.id}` : "#/wrong" }, "오답")),
      h("nav", { class: "packsel" },
        h("a", { class: "chip" + (!s ? " on" : ""), href: "#/" }, "홈"),
        subjects.map((x) => h("a", { class: "chip" + (x === s ? " on" : ""), href: subjectHref(x) }, x.name + (x.href ? " ↗" : "")))));
    updateWrongBadge();
  }

  // ───────────────────────── 화면: 홈
  function examBox(s) {
    return h("div", { class: "exam" },
      h("div", { class: "exam-count" }, s.exam.count),
      h("ul", {}, s.exam.range.map((r) => h("li", {}, r))));
  }
  function subjectTile(s) {
    if (s.href) {
      return h("a", { class: "utile", href: subjectHref(s) },
        h("div", { class: "no" }, s.name, " ↗"),
        h("div", { class: "tp" }, s.desc),
        h("div", { class: "tp small" }, "따로 만든 영어 앱으로 이동"));
    }
    const st = stats(s.units.flatMap(allItems));
    return h("a", { class: "utile" + (st.done === st.total && st.total ? " done" : ""), href: subjectHref(s) },
      h("div", { class: "no" }, s.name),
      h("div", { class: "tp" }, s.desc),
      h("div", { class: "tp small" }, `${s.units.length}단원 · ${st.done}/${st.total} 풂`),
      dots(s.units.map(allItems)));
  }

  function viewHome(app) {
    const last = getLast();
    const lu = last && findUnit(last[0], last[1]);
    const hero = h("div", { class: "hero" });
    if (lu && lu.u) {
      hero.append(h("a", { class: "qtile pri", href: `#/s/${lu.s.id}/${lu.u.id}` }, h("b", {}, "이어서 풀기"), h("span", {}, `${lu.s.name} · ${lu.u.title}`)));
    } else {
      const s0 = subjects.find((x) => !x.href);
      if (s0) hero.append(h("a", { class: "qtile pri", href: `#/s/${s0.id}/${s0.units[0].id}` }, h("b", {}, "처음부터 시작"), h("span", {}, `${s0.name} · ${s0.units[0].title}`)));
    }
    const examSubjects = subjects.filter((s) => s.exam);
    const scope = h("div", { class: "scope hidden" }, examSubjects.map((s) =>
      h("a", { class: "scope-row", href: subjectHref(s) }, h("b", {}, s.name), examBox(s))));
    hero.append(
      h("button", { class: "qtile exam-tile", onclick: () => scope.classList.toggle("hidden") }, h("b", {}, "시험범위"), h("span", {}, "2학년 2학기 1차 · 과목별 범위")),
      h("a", { class: "qtile" + (wrongCount() ? " warn" : ""), href: "#/wrong" }, h("b", {}, "오답노트"), h("span", {}, `${wrongCount()}문항`)));
    app.append(hero, scope);

    app.append(h("div", { class: "secthd" }, h("b", {}, "시험 과목"), legend()));
    app.append(h("div", { class: "ugrid" }, examSubjects.map(subjectTile)));
    const others = subjects.filter((s) => !s.exam);
    if (others.length) {
      app.append(h("div", { class: "secthd" }, h("b", {}, "더 공부하기")));
      app.append(h("div", { class: "ugrid" }, others.map(subjectTile)));
    }
  }

  // ───────────────────────── 화면: 과목(단원 고르기)
  function viewSubject(app, sid) {
    const s = subjects.find((x) => x.id === sid);
    if (!s || s.href) return viewNotFound(app);
    const next = firstOpenUnit(s);
    const items = s.units.flatMap(allItems);
    const started = stats(items).done > 0;
    const hero = h("div", { class: "hero" },
      h("a", { class: "qtile pri", href: `#/s/${s.id}/${next.id}` },
        h("b", {}, started ? "이어서 풀기" : "처음부터 시작"), h("span", {}, next.title)),
      h("a", { class: "qtile" + (wrongCount(items) ? " warn" : ""), href: `#/wrong/${s.id}` },
        h("b", {}, "오답노트"), h("span", {}, `${wrongCount(items)}문항`)));
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
  let onlyWrong = false;
  function viewUnit(app, sid, uid) {
    const { s, u } = findUnit(sid, uid);
    if (!u) return viewNotFound(app);
    const items = allItems(u);
    const idx = s.units.indexOf(u);
    setLast(s.id, u.id);

    app.append(h("nav", { class: "crumbs" }, h("a", { href: `#/s/${s.id}` }, `← ${s.name} 단원 목록`)));
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
    renderTop(parts[0] === "s" || parts[0] === "wrong" ? parts[1] : null);
    if (parts[0] === "s" && parts[2]) viewUnit(app, parts[1], parts[2]);
    else if (parts[0] === "s" && parts[1]) viewSubject(app, parts[1]);
    else if (parts[0] === "wrong") viewWrong(app, parts[1]);
    else viewHome(app);
    window.scrollTo(0, y);
    lastRoute = route;
  }

  window.addEventListener("hashchange", render);
  document.addEventListener("DOMContentLoaded", render);

  // 테스트용
  window.STORY._check = { norm, same, evalNum, subjects };
})();
