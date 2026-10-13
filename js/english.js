/* 📖 영어 본문 해설 — 영어 공부장의 지문을 쉽게 읽기
 *   #/eng                  자료(교과서·모의고사)와 지문 목록
 *   #/eng/<팩id>/<단원id>  한눈에 보기(주제·요지·흐름·시험 포인트) + 문장별 끊어 읽기·해석·단어·어법
 * 본문과 해석은 공부/packs/*.json (영어 공부장과 같은 자료), 해설은 data/english-notes-*.js,
 * 단어 뜻은 공부/packs/vocab.json 에서 가져와요. 단어를 누르면 뜻, 🔊 를 누르면 읽어 줘요.
 */
(function () {
  "use strict";
  const S = window.STORY;
  const BASE = "공부/packs/";
  const READ = "story-engread-v1";            // 다 읽은 지문 { "팩/단원": 시각 } — 동기화됨
  const PREF = "eng-view-v1";                 // 보기 설정 (이 기기)

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    e.append(...kids.flat().filter((x) => x != null && x !== false));
    return e;
  }
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 무시 */ } };

  // ── 자료 불러오기 (한 번 받으면 기억)
  const cache = new Map();
  const getJSON = (path) => {
    if (!cache.has(path)) cache.set(path, fetch(encodeURI(BASE + path)).then((r) => { if (!r.ok) throw new Error("자료를 불러오지 못했어요."); return r.json(); })
      .catch((e) => { cache.delete(path); throw e; }));
    return cache.get(path);
  };
  const packList = () => getJSON("index.json").then((x) => x.packs);
  const getPack = (id) => packList().then((ps) => { const p = ps.find((x) => x.id === id); if (!p) throw new Error("없는 자료예요."); return getJSON(p.file.replace(/^packs\//, "")); });
  const vocab = () => getJSON("vocab.json").then((v) => v.m || {}).catch(() => ({}));

  const fill = (l) => l.en.replace(/\{(\d+)\}/g, (_, i) => { const c = l.c && l.c[+i]; return c ? c.o[c.a] : ""; });
  const notesOf = (pid, uid) => ((S.engNotes || {})[pid] || {})[uid] || null;
  const cleanKo = (t) => String(t || "").replace(/^•\s*/, "");

  // ── 단어 뜻 찾기: 그대로 → 소문자 → -s/-es/-ed/-ing/-ly 떼기
  function lookup(m, w) {
    const x = w.toLowerCase().replace(/[’']s$/, "");
    const tries = [x, x.replace(/ies$/, "y"), x.replace(/es$/, ""), x.replace(/s$/, ""), x.replace(/ied$/, "y"), x.replace(/ed$/, ""), x.replace(/ed$/, "e"),
      x.replace(/d$/, ""), x.replace(/ing$/, ""), x.replace(/ing$/, "e"), x.replace(/(.)\1ing$/, "$1"), x.replace(/(.)\1ed$/, "$1"), x.replace(/ly$/, ""), x.replace(/ily$/, "y")];
    for (const [i, t] of tries.entries()) if (t && (i === 0 || t.length >= 3) && m[t]) return [t, m[t]];   // 짧은 단어(is→i)는 떼지 않음
    return null;
  }

  // ── 🔊 읽어 주기 (브라우저 음성)
  function speak(text, rate) {
    if (!window.speechSynthesis) { if (S.toast) S.toast("이 브라우저는 읽어 주기를 지원하지 않아요."); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = rate || read(PREF, {}).rate || 0.9;
    const v = speechSynthesis.getVoices().find((x) => /^en(-|_)US/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  // ── 단어 뜻 말풍선
  let pop = null;
  function showWord(target, word, m) {
    if (pop) pop.remove();
    const hit = lookup(m, word);
    pop = el("div", { class: "eng-pop", role: "dialog" },
      el("b", { text: hit ? hit[0] : word }), " ",
      el("button", { class: "link", type: "button", "aria-label": "읽어 주기", onclick: () => speak(hit ? hit[0] : word, 0.8) }, "🔊"),
      el("div", { text: hit ? hit[1] : "단어장에 없어요. 끊어 읽기의 뜻을 참고하세요." }));
    document.body.append(pop);
    const r = target.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left + window.scrollX - 10)) + "px";
    pop.style.top = r.bottom + window.scrollY + 6 + "px";
  }
  document.addEventListener("click", (e) => { if (pop && !pop.contains(e.target) && !e.target.classList.contains("w")) { pop.remove(); pop = null; } });
  // 영어 문장 → 단어마다 누를 수 있게
  function wordy(text, m) {
    const frag = document.createDocumentFragment();
    text.split(/([A-Za-z][A-Za-z'’-]*)/).forEach((part, i) => {
      if (i % 2) frag.append(el("span", { class: "w", onclick: (e) => { e.stopPropagation(); showWord(e.target, part, m); } }, part));
      else if (part) frag.append(document.createTextNode(part));
    });
    return frag;
  }

  // ───────────────────────── 목록
  S.viewEnglish = function (app, pid, uid) {
    if (pid && uid) return viewPassage(app, pid, uid);
    app.append(el("nav", { class: "crumbs" }, el("a", { href: "#/s/english" }, "← 영어 공부장")));
    app.append(el("h1", { class: "page-title" }, "📖 영어 본문 해설"));
    app.append(el("p", { class: "muted", text: "지문마다 한눈에 보기(주제 · 요지 · 글의 흐름 · 시험 포인트)와 문장별 끊어 읽기 · 해석 · 단어 · 어법이 있어요. 단어를 누르면 뜻이 나오고 🔊 로 읽어 줘요." }));
    const box = el("div", {}, el("p", { class: "muted" }, "불러오는 중…"));
    app.append(box);
    const done = read(READ, {});
    packList().then(async (packs) => {
      const parts = [];
      for (const pk of packs) {
        const p = await getPack(pk.id).catch(() => null);
        if (!p) continue;
        const units = p.units.filter((u) => (u.lines || []).length);
        const nDone = units.filter((u) => done[`${p.id}/${u.id}`]).length;
        parts.push(el("div", { class: "secthd" }, el("b", {}, pk.title), el("span", { class: "muted small" }, `${pk.scope || ""} · 다 읽음 ${nDone}/${units.length}`)));
        parts.push(el("div", { class: "ugrid" }, units.map((u) => {
          const n = notesOf(p.id, u.id);
          return el("a", { class: "utile" + (done[`${p.id}/${u.id}`] ? " done" : ""), href: `#/eng/${encodeURIComponent(p.id)}/${encodeURIComponent(u.id)}` },
            el("div", { class: "no", text: u.title }),
            el("div", { class: "tp", text: u.topicKo || (n && n.topic) || "" }),
            el("div", { class: "tp small", text: `${u.lines.length}문장${n ? " · 해설 ✓" : ""}${done[`${p.id}/${u.id}`] ? " · ✅ 읽음" : ""}` }));
        })));
      }
      box.replaceChildren(...parts);
    }).catch((e) => box.replaceChildren(el("div", { class: "empty", text: e.message })));
  };

  // ───────────────────────── 지문 하나
  function viewPassage(app, pid, uid) {
    const pref = Object.assign({ ko: "show", chunk: true, words: true, gram: true, rate: 0.9 }, read(PREF, {}));
    const savePref = () => write(PREF, pref);
    app.append(el("nav", { class: "crumbs" }, el("a", { href: "#/eng" }, "← 본문 해설 목록"), " · ", el("a", { href: "#/s/english" }, "영어 공부장")));
    const box = el("div", {}, el("p", { class: "muted" }, "불러오는 중…"));
    app.append(box);
    Promise.all([getPack(pid), vocab()]).then(([p, m]) => {
      const ui = p.units.findIndex((u) => u.id === uid);
      const u = p.units[ui];
      if (!u) throw new Error("없는 지문이에요.");
      const n = notesOf(pid, uid) || {};
      const lines = u.lines || [];
      const full = lines.map(fill);
      const out = [];
      out.push(el("h1", { class: "page-title" }, u.title));
      const topic = u.topicKo || n.topic;
      if (topic) out.push(el("p", { class: "eng-topic" }, el("span", { class: "chip" }, "주제"), " ", topic));

      // 한눈에 보기
      if (n.gist) {
        out.push(el("section", { class: "group eng-glance" },
          el("div", { class: "cm-title" }, el("b", {}, "🧭 한눈에 보기")),
          el("p", { class: "eng-gist" }, el("b", {}, "요지 "), n.gist),
          n.flow && n.flow.length ? el("ol", { class: "eng-flow" }, n.flow.map((f) => el("li", { text: f }))) : null,
          n.tips && n.tips.length ? el("div", { class: "eng-tips" }, el("b", {}, "🎯 시험 포인트"), el("ul", {}, n.tips.map((t) => el("li", { text: t })))) : null));
      } else {
        out.push(el("p", { class: "muted small", text: "이 지문은 아직 해설(요지 · 끊어 읽기)이 없어요. 문장별 해석과 어법은 볼 수 있어요." }));
      }

      // 보기 설정
      const listEl = el("div", { class: "eng-lines" });
      const toggle = (label, key, vals) => el("div", { class: "seg" }, el("b", {}, label), vals.map(([v, t]) =>
        el("button", { class: "chip" + (pref[key] === v ? " on" : ""), type: "button", onclick: (e) => {
          pref[key] = v; savePref();
          e.target.parentNode.querySelectorAll(".chip").forEach((c) => c.classList.remove("on")); e.target.classList.add("on");
          paintLines();
        } }, t)));
      out.push(el("div", { class: "eng-ctrl" },
        toggle("해석", "ko", [["show", "보이기"], ["tap", "눌러서 보기"], ["hide", "가리기"]]),
        toggle("끊어 읽기", "chunk", [[true, "켜기"], [false, "끄기"]]),
        toggle("어법", "gram", [[true, "보이기"], [false, "숨기기"]]),
        el("div", { class: "row" },
          el("button", { class: "btn small", type: "button", onclick: () => speak(full.join(" "), pref.rate) }, "🔊 전체 듣기"),
          el("button", { class: "btn ghost small", type: "button", onclick: () => window.speechSynthesis && speechSynthesis.cancel() }, "■ 멈춤"),
          toggle("빠르기", "rate", [[0.7, "느리게"], [0.9, "보통"], [1.05, "빠르게"]]))));

      // 본문 전체 (단어 누르기)
      out.push(el("details", { class: "group eng-full" }, el("summary", {}, el("b", {}, "📄 본문 전체 보기")),
        el("p", { class: "eng-en" }, ...full.map((t, i) => el("span", { class: "eng-s", onclick: (e) => { if (!e.target.classList.contains("w")) document.getElementById(`ln-${i}`).scrollIntoView({ behavior: "smooth", block: "center" }); } }, wordy(t, m), " ")))));

      function lineCard(l, i) {
        const ln = (n.lines || [])[i] || {};
        const ko = cleanKo(l.ko);
        const koEl = el("p", { class: "eng-ko" + (pref.ko === "tap" ? " veil" : ""), title: pref.ko === "tap" ? "눌러서 해석 보기" : null,
          onclick: (e) => e.currentTarget.classList.remove("veil") }, ko);
        const gram = [];
        (l.c || []).forEach((c) => gram.push(el("li", {}, el("span", { class: "chip" }, c.tag || "어법"), " ",
          el("b", { text: c.o[c.a] }), c.o.length > 1 ? el("span", { class: "muted", text: ` (← ${c.o.filter((_, k) => k !== c.a).join(" / ")} ✕)` }) : null, " ", c.why || "")));
        (l.notes || []).forEach((x) => gram.push(el("li", {}, el("span", { class: "chip" }, x.t), " ", x.p ? el("b", { text: x.p }) : null, x.b ? el("div", { class: "muted small", text: x.b }) : null)));
        return el("section", { class: "group eng-line", id: `ln-${i}` },
          el("div", { class: "group-head" }, el("span", { class: "group-no" }, String(i + 1)),
            ln.role ? el("span", { class: "src" }, ln.role) : null,
            el("button", { class: "ink-toggle", type: "button", title: "이 문장 읽어 주기", onclick: () => speak(full[i], pref.rate) }, "🔊")),
          el("p", { class: "eng-en" }, wordy(full[i], m)),
          pref.chunk && ln.chunks ? el("div", { class: "eng-chunks" }, ln.chunks.map(([en, k]) => el("span", { class: "eng-chunk" }, el("span", { class: "c-en", text: en }), el("span", { class: "c-ko", text: k })))) : null,
          pref.ko !== "hide" ? koEl : null,
          ln.tip ? el("p", { class: "eng-tip" }, "💡 ", ln.tip) : null,
          ln.words && ln.words.length ? el("div", { class: "eng-words" }, ln.words.map(([w, k]) => el("span", { class: "eng-word" }, el("b", { text: w }), " ", k))) : null,
          pref.gram && gram.length ? el("details", { class: "eng-gram" }, el("summary", {}, `✏️ 어법 포인트 ${gram.length}개`), el("ul", {}, gram)) : null);
      }
      function paintLines() { listEl.replaceChildren(...lines.map(lineCard)); }
      out.push(listEl);
      paintLines();

      // 다 읽음 · 이전/다음
      const key = `${pid}/${uid}`;
      const doneBtn = el("button", { class: "btn" + (read(READ, {})[key] ? " ghost" : ""), type: "button", onclick: () => {
        const d = read(READ, {}); if (d[key]) delete d[key]; else d[key] = Date.now(); write(READ, d);
        doneBtn.textContent = d[key] ? "✅ 다 읽었어요" : "다 읽음 표시"; doneBtn.classList.toggle("ghost", !!d[key]);
        if (S.onChange) { /* story-* 키라서 다음 동기화 때 같이 올라감 */ }
      } }, read(READ, {})[key] ? "✅ 다 읽었어요" : "다 읽음 표시");
      const units = p.units.filter((x) => (x.lines || []).length);
      const k = units.indexOf(u);
      const link = (x, t) => x ? el("a", { class: "btn ghost", href: `#/eng/${encodeURIComponent(pid)}/${encodeURIComponent(x.id)}` }, t) : el("span");
      out.push(el("div", { class: "row eng-nav" }, link(units[k - 1], "← 이전 지문"), doneBtn, link(units[k + 1], "다음 지문 →")));
      if (S.commentBox) out.push(S.commentBox(`unit:english/${String(uid).replace(/[^\w.-]/g, "_")}`, "이 지문 질문 · 의견"));
      box.replaceChildren(...out);
    }).catch((e) => box.replaceChildren(el("div", { class: "empty", text: e.message })));
  }
})();
