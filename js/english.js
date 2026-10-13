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

  // ── 🔊 목소리
  //   성우: 🎙 AI 성우(자연스러운 최신 음성, 서버 /api/tts — 관리자가 켜 두면) 또는 📱 기기 목소리(무료, 기기에 들어 있는 것)
  //   스타일: 🎀 귀엽게 / 보통 / 차분하게,  읽기: 영어만 / 영어 → 한국어 / 한국어만
  //   성우 목록은 서버(api/tts.js 의 VOICES)에서 받아 와요 → 나중에 성우를 바꾸거나 늘려도 앱은 그대로.
  const VOICE = "eng-voice-v1";
  const vpref = () => Object.assign({ style: "cute", read: "en-ko", en: "", ko: "", actor: "auto" }, read(VOICE, {}));
  const setV = (patch) => write(VOICE, Object.assign(vpref(), patch));
  // 톤은 아주 조금만 바꿔요 (기계 음성은 톤을 많이 올리면 무섭게 들려요). 자연스러운 음성에만 적용.
  const STYLES = { cute: { pitch: 1.1, rate: 1.0 }, normal: { pitch: 1, rate: 1 }, calm: { pitch: 0.96, rate: 0.92 } };
  const PREVIEW = ["Hi! Let's read this passage together.", "안녕! 같이 읽어 볼까요?"];   // api/tts.js 와 같게

  // AI 성우 목록 (서버에 한 번 물어봄)
  let cloud = { enabled: false, voices: [] };
  const cloudReady = fetch("/api/tts").then((r) => (r.ok ? r.json() : null)).then((x) => { if (x) cloud = x; return cloud; }).catch(() => cloud);
  // 지금 쓸 성우: "device" 또는 AI 성우 id (auto = AI 성우가 켜져 있으면 첫 번째 성우)
  function actor() {
    const a = vpref().actor;
    if (a === "device") return "device";
    if (!cloud.enabled) return "device";
    return cloud.voices.some((v) => v.id === a) ? a : (cloud.voices[0] || {}).id || "device";
  }

  // 기기 목소리: 아이폰·맥(Samantha, Junior, Yuna), 윈도우·엣지(Ana=어린이, Jenny, Aria, SunHi · "Natural" 은 최신 음성), 안드로이드·크롬(Google …)
  const CUTE = {
    en: ["Ava", "Jenny", "Aria", "Ana", "Emma", "Samantha", "Allison", "Google US English", "Karen", "Tessa", "Zira"],
    ko: ["SunHi", "Yuna", "Sora", "Seoyeon", "Jimin", "Google 한국", "Heami"],
  };
  const nameRe = (n) => new RegExp(`(^|[^A-Za-z])${n}(?![A-Za-z])`, "i");   // "Ana" 는 맞지만 "Diana" 는 아님
  const isCute = (lang, name) => CUTE[lang].some((n) => nameRe(n).test(name));
  const isNatural = (v) => /Natural|Neural|Online|Enhanced|Premium|Google|Samantha|Yuna/i.test(v.name);   // 기기 안의 자연스러운 음성
  // 맥·아이폰의 효과음 목소리(속삭임·로봇·노래 등)는 무섭게 들려서 아예 빼요
  const NOVELTY = /Junior|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Ralph|Kathy|Princess|Agnes|Bruce|Vicki|Victoria|Pipe Organ|eSpeak|espeak/i;
  let voices = [];
  const loadVoices = () => { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; return voices; };
  if (window.speechSynthesis) { loadVoices(); try { speechSynthesis.addEventListener("voiceschanged", loadVoices); } catch (e) { speechSynthesis.onvoiceschanged = loadVoices; } }
  const voicesOf = (lang) => loadVoices().filter((v) => (lang === "en" ? /^en/i : /^ko/i).test(v.lang) && !NOVELTY.test(v.name));
  function voiceFor(lang) {
    const vp = vpref(), list = voicesOf(lang);
    if (vp[lang]) { const v = list.find((x) => x.name === vp[lang]); if (v) return v; }
    // 최신 음성(Natural 등) 먼저, 그다음 귀여운 이름
    const nat = list.filter(isNatural);
    for (const pool of [nat, list]) {
      if (vp.style === "cute") for (const n of CUTE[lang]) { const v = pool.find((x) => nameRe(n).test(x.name)); if (v) return v; }
      if (pool.length && pool === nat) return (lang === "en" && nat.find((x) => /^en(-|_)US/i.test(x.lang))) || nat[0];
    }
    return (lang === "en" && list.find((x) => /^en(-|_)US/i.test(x.lang))) || list[0] || null;
  }

  // 소리 하나만 나게: 기기 음성·AI 음성 모두 멈춤
  const player = typeof Audio !== "undefined" ? new Audio() : null;
  let playToken = 0;
  function hush() {
    playToken++;
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (player) { player.pause(); player.onended = player.onerror = player.ontimeupdate = null; }
  }
  const ttsUrl = (text, voice) => `/api/tts?v=${encodeURIComponent(voice)}&s=${vpref().style}&t=${encodeURIComponent(text)}`;
  // 다음 문장을 미리 받아 두기 (AI 성우일 때)
  function prefetch(text) { const a = actor(); if (a !== "device" && text) fetch(ttsUrl(text, a)).catch(() => {}); }

  // 한 마디 읽기 → 끝나면 Promise 가 풀려요.  onboundary({ charIndex }) 로 읽는 위치를 알려 줌
  function say(text, lang, { rate, onboundary } = {}) {
    const a = actor();
    if (a !== "device" && player) return sayCloud(text, lang, a, { rate, onboundary });
    return sayDevice(text, lang, { rate, onboundary });
  }
  function sayDevice(text, lang, { rate, onboundary } = {}) {
    return new Promise((done) => {
      if (!window.speechSynthesis || !text) return done();
      const st = STYLES[vpref().style] || STYLES.normal;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "ko" ? "ko-KR" : "en-US";
      const v = voiceFor(lang); if (v) u.voice = v;
      u.pitch = v && isNatural(v) ? st.pitch : 1;
      u.rate = Math.min(2, (rate || read(PREF, {}).rate || 0.9) * st.rate * (lang === "ko" ? 1.08 : 1));
      if (onboundary) u.onboundary = onboundary;
      u.onend = u.onerror = () => done();
      speechSynthesis.speak(u);
    });
  }
  function sayCloud(text, lang, voice, { rate, onboundary } = {}) {
    return new Promise((done) => {
      if (!text) return done();
      const my = ++playToken;
      let started = false;
      player.onended = () => { if (my === playToken) done(); };
      player.onerror = () => {
        if (my !== playToken) return;
        // AI 음성이 안 되면(꺼짐·인터넷 끊김) 기기 목소리로
        if (!started) sayDevice(text, lang, { rate, onboundary }).then(done); else done();
      };
      // AI 음성은 단어 위치를 안 알려 줘서, 재생한 비율로 읽는 곳을 짐작해요
      player.ontimeupdate = () => {
        if (my !== playToken || !onboundary || !player.duration) return;
        onboundary({ charIndex: Math.floor(text.length * (player.currentTime / player.duration)) });
      };
      player.src = ttsUrl(text, voice);
      player.playbackRate = Math.min(2, Math.max(0.5, rate || read(PREF, {}).rate || 0.9));
      try { player.preservesPitch = true; } catch (e) { /* 무시 */ }
      player.play().then(() => { started = true; }).catch(() => { if (my === playToken) sayDevice(text, lang, { rate, onboundary }).then(done); });
    });
  }
  function speak(text, rate, lang = "en") {
    if (!window.speechSynthesis && !player) { if (S.toast) S.toast("이 브라우저는 읽어 주기를 지원하지 않아요."); return Promise.resolve(); }
    hush();
    return say(text, lang, { rate });
  }
  // 영어 + 뜻 이어서
  async function speakPair(en, ko, rate) { await speak(en, rate, "en"); if (ko && vpref().read !== "en") await say(ko, "ko", { rate }); }

  // 성우 · 목소리 설정 칸 (본문 해설 화면의 ⚙️ 보기 설정 안)
  function voicePanel() {
    const wrap = el("div", { class: "eng-voice" });
    const paint = () => {
      const vp = vpref(), cur = actor();
      const seg = (label, key, vals) => el("div", { class: "seg" }, el("b", {}, label), vals.map(([v, t]) =>
        el("button", { class: "chip" + (vp[key] === v ? " on" : ""), type: "button", onclick: () => { setV({ [key]: v }); paint(); if (key === "style") preview(); } }, t)));
      const card = (id, tag, name, desc) => el("button", { class: "actor" + (cur === id ? " on" : ""), type: "button", disabled: id !== "device" && !cloud.enabled, onclick: () => { setV({ actor: id }); paint(); preview(); } },
        el("span", { class: "a-tag" }, tag), el("b", {}, name), el("span", { class: "muted small" }, desc));
      const pick = (lang, label) => {
        const list = voicesOf(lang);
        const sel = el("select", { "aria-label": label, onchange: () => { setV({ [lang]: sel.value }); preview(lang); } },
          el("option", { value: "" }, "자동 (최신 음성 · 귀여운 목소리 먼저)"),
          list.map((v) => el("option", { value: v.name, ...(vp[lang] === v.name ? { selected: true } : {}) }, `${v.name}${isNatural(v) ? " ✨" : ""}${isCute(lang, v.name) ? " 🎀" : ""}`)));
        return el("label", { class: "row small" }, el("b", {}, label), sel, list.length ? null : el("span", { class: "muted small" }, lang === "ko" ? "이 기기에 한국어 목소리가 없어요" : "목소리를 불러오는 중…"));
      };
      wrap.replaceChildren(
        el("div", { class: "seg" }, el("b", {}, "성우")),
        el("div", { class: "actors" },
          cloud.voices.map((v) => card(v.id, v.tag || "🎙", v.name, cloud.enabled ? v.desc : "AI 성우 — 아직 꺼져 있어요")),
          card("device", "📱", "기기 목소리", "무료 · 인터넷 없이도")),
        cloud.enabled ? null : el("p", { class: "muted small", text: "🎙 AI 성우(자연스러운 최신 음성)는 관리자가 Vercel 환경 변수에 OPENAI_API_KEY 를 넣으면 켜져요. 그 전에는 기기 목소리로 읽어요." }),
        seg("말투", "style", [["cute", "🎀 귀엽게"], ["normal", "보통"], ["calm", "차분하게"]]),
        seg("읽기", "read", [["en", "영어만"], ["en-ko", "영어 → 한국어"], ["ko", "한국어만"]]),
        cur === "device" ? pick("en", "영어 목소리") : null, cur === "device" ? pick("ko", "한국어 목소리") : null,
        el("div", { class: "row" }, el("button", { class: "btn ghost small", type: "button", onclick: () => preview() }, "🔊 미리 듣기")));
    };
    const preview = async (lang) => {
      const vp = vpref();
      hush();
      if (lang !== "ko" && vp.read !== "ko") await say(PREVIEW[0], "en", { rate: 0.95 });
      if (lang !== "en" && vp.read !== "en") await say(PREVIEW[1], "ko", { rate: 0.95 });
    };
    paint();
    cloudReady.then(paint);
    if (window.speechSynthesis && !voicesOf("en").length) setTimeout(paint, 800);
    return wrap;
  }

  // ── 단어 뜻 말풍선
  let pop = null;
  function showWord(target, word, m) {
    if (pop) pop.remove();
    const hit = lookup(m, word);
    pop = el("div", { class: "eng-pop", role: "dialog" },
      el("b", { text: hit ? hit[0] : word }), " ",
      el("button", { class: "link", type: "button", "aria-label": "단어 읽어 주기", onclick: () => speak(hit ? hit[0] : word, 0.8) }, "🔊"),
      hit ? el("button", { class: "link", type: "button", "aria-label": "뜻 읽어 주기", onclick: () => speak(hit[1], 0.95, "ko") }, "🔊뜻") : null,
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

  // ───────────────────────── 주의 문장 찾기
  // 문장 역할(해설) · 연결어 · 어법 고르기 · 길이로 "꼭 봐야 할 문장"을 표시
  const SIGNALS = {
    "however": "그러나 — 앞과 반대 내용이 나와요 (주제문이 자주 와요)", "but": "그러나 — 흐름이 바뀌어요", "yet": "그러나 — 흐름이 바뀌어요",
    "instead": "대신에 — 앞을 부정하고 진짜 내용이 나와요", "rather": "오히려 — 진짜 하고 싶은 말이 나와요", "still": "그래도 — 앞과 반대로 이어져요",
    "nevertheless": "그럼에도 불구하고 — 반대 흐름", "nonetheless": "그럼에도 불구하고 — 반대 흐름", "on the other hand": "반면에 — 대조",
    "in contrast": "대조적으로 — 앞과 비교", "unlike": "~와 달리 — 대조", "although": "비록 ~지만 — 뒤쪽이 핵심", "even though": "비록 ~지만 — 뒤쪽이 핵심",
    "therefore": "그러므로 — 결론이 나와요", "thus": "따라서 — 결론", "hence": "그래서 — 결론", "as a result": "그 결과 — 결과·결론",
    "consequently": "결과적으로 — 결론", "in short": "요컨대 — 요약(주제)", "in other words": "다시 말해 — 앞 내용을 쉽게 다시 말함", "that is": "즉 — 다시 말함",
    "in fact": "사실은 — 강조나 반전", "indeed": "실제로 — 강조", "for example": "예를 들어 — 예시 시작", "for instance": "예를 들어 — 예시 시작",
    "similarly": "마찬가지로 — 비슷한 예", "likewise": "마찬가지로 — 비슷한 예", "moreover": "게다가 — 근거 추가", "furthermore": "게다가 — 근거 추가",
    "in addition": "게다가 — 근거 추가", "ultimately": "궁극적으로 — 결론", "finally": "마지막으로 — 마무리",
  };
  const SIG_RE = new RegExp("\\b(" + Object.keys(SIGNALS).sort((a, b) => b.length - a.length).map((k) => k.replace(/ /g, "\\s+")).join("|") + ")\\b", "gi");
  function flagsOf(l, ln, en) {
    const f = [];
    const role = (ln && ln.role) || "";
    if (/주제|요지|주장|결론|요약|핵심|해결책/.test(role)) f.push({ k: "key", t: "⭐ 핵심 문장", why: `${role} — 글쓴이가 하고 싶은 말이에요. 요지·제목·빈칸 문제의 답이 여기서 나와요.` });
    const sig = [...en.matchAll(SIG_RE)].map((m) => m[1].toLowerCase().replace(/\s+/g, " "));
    if (/전환|반전|대조|양보|반론|통념|반박/.test(role) || sig.some((x) => /however|but|yet|instead|rather|still|nevertheless|nonetheless|on the other hand|in contrast|although|even though|in fact/.test(x))) {
      f.push({ k: "turn", t: "↪ 흐름이 바뀌어요", why: `${sig.length ? sig.join(", ") + " — " : ""}앞뒤 내용이 달라지는 곳이에요. 순서·삽입 문제의 단서가 돼요.` });
    }
    const nC = (l.c || []).length;
    if (nC >= 2) f.push({ k: "gram", t: `✏️ 어법 ${nC}곳`, why: "고르기 문제가 여러 개 나온 문장이에요. 밑줄 친 단어를 꼭 확인하세요." });
    else if (nC === 1) f.push({ k: "gram1", t: "✏️ 어법 1곳", why: "밑줄 친 단어가 시험에 나왔던 자리예요." });
    if (en.split(/\s+/).length >= 28) f.push({ k: "long", t: "🧩 긴 문장", why: "끊어 읽기로 주어·동사부터 찾아보세요." });
    return f;
  }
  const isWatch = (f) => f.some((x) => x.k === "key" || x.k === "turn" || x.k === "gram" || x.k === "long");

  // 문장을 화면에: 고르기 정답 자리는 밑줄, 연결어는 색, 단어는 누르면 뜻. 단어마다 원문 위치(o)를 기억 → 읽어 줄 때 따라가기
  function sentenceEl(l, m) {
    const frag = document.createDocumentFragment();
    let off = 0;
    const addText = (text, wrapCls, title) => {
      const host = wrapCls ? el("span", { class: wrapCls, title }) : frag;
      // 연결어 표시
      let last = 0;
      const parts = [];
      if (!wrapCls) for (const mm of text.matchAll(SIG_RE)) { parts.push([text.slice(last, mm.index), null]); parts.push([mm[0], SIGNALS[mm[1].toLowerCase().replace(/\s+/g, " ")]]); last = mm.index + mm[0].length; }
      parts.push([text.slice(last), null]);
      for (const [t, sigWhy] of parts) {
        if (!t) continue;
        const target = sigWhy ? el("span", { class: "sig", title: sigWhy }) : host;
        t.split(/([A-Za-z][A-Za-z'’-]*)/).forEach((part, i) => {
          if (i % 2) target.append(el("span", { class: "w", "data-o": String(off), onclick: (e) => { e.stopPropagation(); showWord(e.target, part, m); } }, part));
          else if (part) target.append(document.createTextNode(part));
          off += part.length;
        });
        if (sigWhy) host.append(target);
      }
      if (wrapCls) frag.append(host);
    };
    l.en.split(/\{(\d+)\}/).forEach((part, i) => {
      if (i % 2 === 0) { if (part) addText(part); return; }
      const c = l.c && l.c[+part];
      if (!c) return;
      addText(c.o[c.a], "ans", `${c.tag || "어법"}: ${c.o[c.a]} (✕ ${c.o.filter((_, k) => k !== c.a).join(" / ")}) — ${c.why || ""}`);
    });
    return frag;
  }

  // ───────────────────────── 지문 하나
  let stopReading = null;   // 화면을 떠나면 자동 읽기 멈춤
  window.addEventListener("hashchange", () => { if (stopReading) stopReading(); });
  function viewPassage(app, pid, uid) {
    const pref = Object.assign({ ko: "show", chunk: true, gram: true, rate: 0.9, sound: true, focus: true, watch: false }, read(PREF, {}));
    const savePref = () => write(PREF, pref);
    app.append(el("nav", { class: "crumbs" }, el("a", { href: "#/eng" }, "← 본문 해설 목록"), " · ", el("a", { href: "#/s/english" }, "영어 공부장")));
    const box = el("div", {}, el("p", { class: "muted" }, "불러오는 중…"));
    app.append(box);
    Promise.all([getPack(pid), vocab()]).then(([p, m]) => {
      const u = p.units.find((x) => x.id === uid);
      if (!u) throw new Error("없는 지문이에요.");
      const n = notesOf(pid, uid) || {};
      const lines = u.lines || [];
      const full = lines.map(fill);
      const flags = lines.map((l, i) => flagsOf(l, (n.lines || [])[i], full[i]));
      const out = [];
      out.push(el("h1", { class: "page-title" }, u.title));
      const topic = u.topicKo || n.topic;
      if (topic) out.push(el("p", { class: "eng-topic" }, el("span", { class: "chip" }, "주제"), " ", topic));

      // ── 한눈에 보기 + 주의할 문장
      const watchList = flags.map((f, i) => [i, f]).filter(([, f]) => isWatch(f));
      out.push(el("section", { class: "group eng-glance" },
        el("div", { class: "cm-title" }, el("b", {}, "🧭 한눈에 보기")),
        n.gist ? el("p", { class: "eng-gist" }, el("b", {}, "요지 "), n.gist) : el("p", { class: "muted small", text: "이 지문은 아직 요지 해설이 없어요." }),
        n.flow && n.flow.length ? el("ol", { class: "eng-flow" }, n.flow.map((f) => el("li", { text: f }))) : null,
        watchList.length ? el("div", { class: "eng-watch" }, el("b", {}, "⚠️ 꼭 볼 문장"),
          el("div", { class: "row" }, watchList.map(([i, f]) => el("button", { class: "chip watch k-" + f[0].k, type: "button", onclick: () => focus(i, true) },
            `${i + 1}번 ${f.map((x) => x.t.split(" ")[0]).join("")}`)))) : null,
        n.tips && n.tips.length ? el("div", { class: "eng-tips" }, el("b", {}, "🎯 시험 포인트"), el("ul", {}, n.tips.map((t) => el("li", { text: t })))) : null,
        el("div", { class: "eng-legend muted small" },
          el("span", { class: "ans" }, "밑줄"), " 시험에 나온 어법 자리 · ", el("span", { class: "sig" }, "색 글씨"), " 흐름을 바꾸는 연결어 · 단어를 누르면 뜻")));

      // ── 보기 설정
      const toggle = (label, key, vals, after) => el("div", { class: "seg" }, el("b", {}, label), vals.map(([v, t]) =>
        el("button", { class: "chip" + (pref[key] === v ? " on" : ""), type: "button", onclick: (e) => {
          pref[key] = v; savePref();
          e.target.parentNode.querySelectorAll(".chip").forEach((c) => c.classList.remove("on")); e.target.classList.add("on");
          (after || paintLines)();
        } }, t)));
      out.push(el("details", { class: "eng-ctrl" }, el("summary", {}, "⚙️ 보기 설정"),
        toggle("해석", "ko", [["show", "보이기"], ["tap", "눌러서 보기"], ["hide", "가리기"]]),
        toggle("끊어 읽기", "chunk", [[true, "켜기"], [false, "끄기"]]),
        toggle("어법 설명", "gram", [[true, "보이기"], [false, "숨기기"]]),
        toggle("집중", "focus", [[true, "지금 문장만 또렷하게"], [false, "모두 같게"]], () => listEl.classList.toggle("focus-mode", pref.focus)),
        toggle("문장", "watch", [[false, "전부"], [true, "⚠️ 꼭 볼 문장만"]]),
        voicePanel()));

      // ── 위에 붙는 읽기 막대: 몇 번째 문장 · 이전/다음 · 자동 읽기
      const pos = el("b", { class: "eng-pos" });
      const autoBtn = el("button", { class: "btn small", type: "button", onclick: () => (auto ? stop() : start()) });
      const soundBtn = el("button", { class: "chip", type: "button", onclick: () => { pref.sound = !pref.sound; savePref(); paintBar(); if (auto) { stop(); start(); } } });
      const koBtn = el("button", { class: "chip", type: "button", onclick: () => { const r = vpref().read; setV({ read: r === "en" ? "en-ko" : "en" }); paintBar(); } });
      const speedSel = el("select", { "aria-label": "빠르기", onchange: () => { pref.rate = Number(speedSel.value); savePref(); } },
        [[0.7, "느리게"], [0.9, "보통"], [1.05, "빠르게"], [1.2, "아주 빠르게"]].map(([v, t]) => el("option", { value: String(v), ...(pref.rate === v ? { selected: true } : {}) }, t)));
      const bar = el("div", { class: "eng-bar" },
        el("button", { class: "ib ghost icon", type: "button", title: "이전 문장 (↑)", onclick: () => focus(cur - 1, true) }, "▲"),
        pos,
        el("button", { class: "ib ghost icon", type: "button", title: "다음 문장 (↓)", onclick: () => focus(cur + 1, true) }, "▼"),
        autoBtn, soundBtn, koBtn, speedSel);
      function paintBar() {
        pos.textContent = `${cur + 1} / ${lines.length}`;
        autoBtn.textContent = auto ? "⏸ 멈춤" : "▶ 자동 읽기";
        autoBtn.title = "스페이스바로도 켜고 꺼요. 한 문장씩 읽고 알아서 다음 문장으로 내려가요.";
        soundBtn.textContent = pref.sound ? "🔊 소리" : "🔇 조용히";
        const r = vpref().read;
        koBtn.textContent = r === "en" ? "🇺🇸" : r === "ko" ? "🇰🇷" : "🇺🇸→🇰🇷";
        koBtn.title = r === "en" ? "영어만 읽어요 (누르면 한국어 해석도)" : r === "ko" ? "한국어만 읽어요" : "영어 다음에 한국어 해석도 읽어요 (누르면 영어만)";
        koBtn.classList.toggle("on", r !== "en");
        soundBtn.title = pref.sound ? "소리 내어 읽어 줘요" : "소리 없이 읽는 속도에 맞춰 내려가요";
      }
      out.push(bar);

      // ── 본문 전체
      out.push(el("details", { class: "group eng-full" }, el("summary", {}, el("b", {}, "📄 본문 전체 한 번에 보기")),
        el("p", { class: "eng-en" }, ...lines.map((l, i) => el("span", { class: "eng-s" + (isWatch(flags[i]) ? " watch" : ""), onclick: (e) => { if (!e.target.classList.contains("w")) focus(i, true); } }, sentenceEl(l, m), " ")))));

      // ── 문장 카드
      const listEl = el("div", { class: "eng-lines" + (pref.focus ? " focus-mode" : "") });
      let cards = [];
      function lineCard(l, i) {
        const ln = (n.lines || [])[i] || {};
        const f = flags[i];
        const ko = cleanKo(l.ko);
        const koEl = el("p", { class: "eng-ko" + (pref.ko === "tap" ? " veil" : ""), onclick: (e) => e.currentTarget.classList.remove("veil") }, ko,
          el("button", { class: "ko-say", type: "button", title: "해석 읽어 주기", onclick: (e) => { e.stopPropagation(); stop(); koEl.classList.remove("veil"); speak(ko, pref.rate, "ko"); } }, "🔊"));
        const gram = [];
        (l.c || []).forEach((c) => gram.push(el("li", {}, el("span", { class: "chip" }, c.tag || "어법"), " ",
          el("b", { text: c.o[c.a] }), c.o.length > 1 ? el("span", { class: "muted", text: ` (✕ ${c.o.filter((_, k) => k !== c.a).join(" / ")})` }) : null, " ", c.why || "")));
        (l.notes || []).forEach((x) => gram.push(el("li", {}, el("span", { class: "chip" }, x.t), " ", x.p ? el("b", { text: x.p }) : null, x.b ? el("div", { class: "muted small", text: x.b }) : null)));
        const kind = f.find((x) => x.k === "key") ? "key" : f.find((x) => x.k === "turn") ? "turn" : /예시|사례|일화/.test(ln.role || "") ? "ex" : "";
        const card = el("section", { class: `group eng-line${kind ? " r-" + kind : ""}${isWatch(f) ? " watch" : ""}`, id: `ln-${i}`, onclick: (e) => { if (e.target.closest("button,summary,.w,.eng-ko,a")) return; if (!auto) focus(i, false); } },
          el("div", { class: "group-head" }, el("span", { class: "group-no" }, String(i + 1)),
            ln.role ? el("span", { class: "role" }, ln.role) : null,
            f.map((x) => el("span", { class: "flag k-" + x.k, title: x.why }, x.t)),
            el("button", { class: "ink-toggle", type: "button", title: "이 문장 읽어 주기", onclick: () => { stop(); focus(i, false); speakLine(i); } }, "🔊")),
          f.length ? el("p", { class: "eng-why" }, f.filter((x) => x.k !== "gram1").map((x) => x.why).join(" ")) : null,
          el("p", { class: "eng-en big" }, sentenceEl(l, m)),
          pref.chunk && ln.chunks ? el("div", { class: "eng-chunks" }, ln.chunks.map(([en, k], j) => [j ? el("span", { class: "slash" }, "/") : null, el("span", { class: "eng-chunk", title: "누르면 영어와 뜻을 읽어 줘요", onclick: () => { stop(); speakPair(en, k, pref.rate); } }, el("span", { class: "c-en", text: en }), el("span", { class: "c-ko", text: k }))]).flat()) : null,
          pref.ko !== "hide" ? koEl : null,
          ln.tip ? el("p", { class: "eng-tip" }, "💡 ", ln.tip) : null,
          ln.words && ln.words.length ? el("div", { class: "eng-words" }, ln.words.map(([w, k]) => el("span", { class: "eng-word" }, el("b", { text: w }), " ", k))) : null,
          pref.gram && gram.length ? el("details", { class: "eng-gram", ...(f.some((x) => x.k === "gram") && window.innerWidth > 700 ? { open: true } : {}) }, el("summary", {}, `✏️ 어법 포인트 ${gram.length}개`), el("ul", {}, gram)) : null,
          el("div", { class: "eng-timer" }));
        if (pref.watch && !isWatch(f)) card.classList.add("hidden");
        return card;
      }
      function paintLines() {
        cards = lines.map(lineCard);
        listEl.replaceChildren(...cards);
        focus(Math.min(cur, lines.length - 1), false, true);
      }
      out.push(listEl);

      // ── 지금 문장 · 자동 읽기
      let cur = 0, auto = false, timer = 0, token = 0;
      function focus(i, scroll, quiet) {
        if (i < 0 || i >= lines.length) return;
        if (pref.watch && cards[i] && cards[i].classList.contains("hidden")) { pref.watch = false; savePref(); cards.forEach((c) => c.classList.remove("hidden")); }
        cur = i;
        cards.forEach((c, k) => c.classList.toggle("cur", k === i));
        paintBar();
        if (scroll && cards[i]) cards[i].scrollIntoView({ behavior: quiet ? "auto" : "smooth", block: "center" });
      }
      // 한 문장: 영어(읽는 단어를 따라 노란색) → 한국어 해석(초록 칸이 반짝)
      async function speakLine(i, done) {
        hush();
        const my = token, vp = vpref();
        const ws = [...cards[i].querySelectorAll(".eng-en.big .w")];
        if (vp.read !== "ko") {
          await say(full[i], "en", { rate: pref.rate, onboundary: (e) => {
            let hit = null;
            for (const w of ws) { if (+w.dataset.o <= e.charIndex) hit = w; else break; }
            ws.forEach((w) => w.classList.toggle("speaking", w === hit));
          } });
          ws.forEach((w) => w.classList.remove("speaking"));
        }
        if (my !== token) return;
        if (vp.read !== "en") {
          const koEl = cards[i].querySelector(".eng-ko");
          if (koEl) { koEl.classList.remove("veil"); koEl.classList.add("speaking-ko"); }
          await say(cleanKo(lines[i].ko), "ko", { rate: pref.rate });
          if (koEl) koEl.classList.remove("speaking-ko");
        }
        if (my === token && done) done();
      }
      function step() {
        if (!auto) return;
        focus(cur, true);
        const next = () => {
          if (!auto) return;
          if (cur >= lines.length - 1) { stop(); finished(); return; }
          let k = cur + 1;
          if (pref.watch) while (k < lines.length - 1 && !isWatch(flags[k])) k++;
          cur = k; timer = setTimeout(step, 700);
        };
        const tm = cards[cur].querySelector(".eng-timer");
        if (pref.sound && (window.speechSynthesis || player)) {
          tm.style.animation = "none";
          if (cur + 1 < lines.length) { const vp = vpref(); if (vp.read !== "ko") prefetch(full[cur + 1]); if (vp.read !== "en") prefetch(cleanKo(lines[cur + 1].ko)); }
          speakLine(cur, next);
        }
        else {
          // 조용히: 단어 수에 맞춰 (보통 1분에 130단어) 기다렸다가 내려감
          const words = full[cur].split(/\s+/).length;
          const ms = Math.max(2500, (words / (130 * pref.rate)) * 60000 + (pref.chunk ? 1500 : 800));
          tm.style.animation = "none"; void tm.offsetWidth; tm.style.animation = `eng-fill ${ms}ms linear forwards`;
          timer = setTimeout(next, ms);
        }
      }
      function start() { auto = true; token++; paintBar(); step(); }
      function stop() {
        auto = false; token++; clearTimeout(timer);
        hush();
        cards.forEach((c) => { const t = c.querySelector(".eng-timer"); if (t) t.style.animation = "none"; c.querySelectorAll(".speaking").forEach((w) => w.classList.remove("speaking")); });
        paintBar();
      }
      stopReading = stop;
      function finished() {
        const d = read(READ, {}); d[`${pid}/${uid}`] = Date.now(); write(READ, d);
        doneBtn.textContent = "✅ 다 읽었어요"; doneBtn.classList.add("ghost");
        if (S.toast) S.toast("끝까지 읽었어요! ✅ 다 읽음으로 표시했어요");
      }

      // 손으로 내릴 때: 화면 가운데 있는 문장을 "지금 문장"으로
      let scrollT = 0;
      const onScroll = () => {
        if (!document.body.contains(listEl)) return window.removeEventListener("scroll", onScroll);
        if (auto) return;
        clearTimeout(scrollT);
        scrollT = setTimeout(() => {
          const mid = window.innerHeight / 2;
          let best = -1, bd = Infinity;
          cards.forEach((c, k) => { if (c.classList.contains("hidden")) return; const r = c.getBoundingClientRect(); const d = Math.abs((r.top + r.bottom) / 2 - mid); if (d < bd) { bd = d; best = k; } });
          if (best >= 0 && best !== cur && bd < window.innerHeight / 2) focus(best, false);
        }, 120);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      // 키보드: 스페이스 자동 읽기, ↑↓ 문장 이동
      const onKey = (e) => {
        if (!document.body.contains(listEl)) return document.removeEventListener("keydown", onKey);
        if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === " ") { e.preventDefault(); auto ? stop() : start(); }
        else if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); stop(); focus(cur + 1, true); }
        else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); stop(); focus(cur - 1, true); }
      };
      document.addEventListener("keydown", onKey);

      // ── 다 읽음 · 이전/다음 지문
      const key = `${pid}/${uid}`;
      const doneBtn = el("button", { class: "btn" + (read(READ, {})[key] ? " ghost" : ""), type: "button", onclick: () => {
        const d = read(READ, {}); if (d[key]) delete d[key]; else d[key] = Date.now(); write(READ, d);
        doneBtn.textContent = d[key] ? "✅ 다 읽었어요" : "다 읽음 표시"; doneBtn.classList.toggle("ghost", !!d[key]);
      } }, read(READ, {})[key] ? "✅ 다 읽었어요" : "다 읽음 표시");
      const units = p.units.filter((x) => (x.lines || []).length);
      const k = units.indexOf(u);
      const link = (x, t) => x ? el("a", { class: "btn ghost", href: `#/eng/${encodeURIComponent(pid)}/${encodeURIComponent(x.id)}` }, t) : el("span");
      out.push(el("div", { class: "row eng-nav" }, link(units[k - 1], "← 이전 지문"), doneBtn, link(units[k + 1], "다음 지문 →")));
      if (S.commentBox) out.push(S.commentBox(`unit:english/${String(uid).replace(/[^\w.-]/g, "_")}`, "이 지문 질문 · 의견"));
      box.replaceChildren(...out);
      const top = document.querySelector(".top");
      bar.style.top = (top ? top.offsetHeight : 0) + "px";
      paintLines();
      paintBar();
    }).catch((e) => box.replaceChildren(el("div", { class: "empty", text: e.message })));
  }
})();
