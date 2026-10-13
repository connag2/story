/* 댓글 · 피드백 게시판
 *   STORY.commentBox(key, label)  → 공부법·개념 아래에 붙는 댓글 칸
 *   STORY.viewBoard(app)          → #/board 전체 게시판 (위치·종류·상태로 걸러 보기, 요청 복사)
 * 답글(한 단계) · 👍 · 🚨 신고 · 🚫 차단(내 화면에서 숨김, 기기 간 동기화) · 😀 이모티콘
 * 관리자: 상태 달기 · 가리기/풀기 · 글쓰기 정지
 * 글 내용은 항상 글자(textContent)로만 넣어요(HTML로 해석하지 않음).
 */
(function () {
  "use strict";
  const S = window.STORY;
  const KINDS = {
    opinion: { label: "💬 의견", hint: "좋았던 점, 불편한 점, 바라는 점" },
    tip: { label: "💡 나만의 공부법", hint: "이렇게 외우니까 잘 됐어요, 이 순서로 푸니 좋았어요…" },
    request: { label: "🙋 추가 요청", hint: "이런 문제·개념·자료를 넣어 주세요" },
    bug: { label: "🐞 오류 신고", hint: "정답이 틀렸어요, 화면이 이상해요 (몇 번 문제인지 함께)" },
  };
  const STATUS = { "": "", checking: "확인 중", planned: "반영 예정", done: "반영 완료" };

  // ── 차단 목록 (이름) — story-* 키라서 로그인하면 기기 간 동기화
  const BLOCK = "story-blocked-v1";
  const blocked = () => { try { return JSON.parse(localStorage.getItem(BLOCK)) || []; } catch (e) { return []; } };
  const setBlocked = (a) => { try { localStorage.setItem(BLOCK, JSON.stringify(a)); } catch (e) { /* 무시 */ } };
  S.blocked = blocked;

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
  const ago = (t) => {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return "방금";
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)}일 전`;
    return new Date(t).toLocaleDateString("ko-KR");
  };
  // 목록은 로그인 정보 없이 받아서(CDN 이 30초 기억 → 저장소 아끼기) 내 글·👍·신고 여부는 여기서 계산.
  //   fresh: 내가 방금 글을 쓰거나 고친 뒤 → 기억된 것 말고 새로 받기. 관리자는 신고 수 때문에 로그인해서 받음.
  const REPORTED = "cm-reported-v1";
  const myReports = () => { try { return JSON.parse(localStorage.getItem(REPORTED)) || []; } catch (e) { return []; } };
  const addReport = (id) => { try { localStorage.setItem(REPORTED, JSON.stringify([...new Set([...myReports(), id])].slice(-500))); } catch (e) { /* 무시 */ } };
  const get = async (key, fresh) => {
    const admin = S.isAdmin && S.isAdmin();
    const q = [key ? "key=" + encodeURIComponent(key) : "", fresh ? "_=" + Date.now() : ""].filter(Boolean).join("&");
    const r = await S.api("comments" + (q ? "?" + q : ""), { public: !admin });
    if (!admin) {
      const me = S.myUid && S.myUid(), rep = new Set(myReports());
      r.items = r.items.map((it) => ({ ...it, mine: !!me && it.u === me, liked: !!me && (it.likers || []).includes(me),
        canDelete: !it.deleted && !!me && it.u === me, reported: rep.has(it.id) }));
    }
    return r;
  };
  const post = (b) => S.api("comments", { method: "POST", body: JSON.stringify(b) });
  const rich = (text) => (S.renderRich ? S.renderRich(text) : document.createTextNode(text));

  // 위치 키 → 사람이 읽을 이름과 링크
  function place(key) {
    const subs = S._check.subjects;
    let m = key.match(/^guide:(.+)$/);
    if (m) { const s = subs.find((x) => x.id === m[1]); return { name: `${s ? s.name : m[1]} 공부법`, href: `#/guide/${m[1]}` }; }
    m = key.match(/^unit:([^/]+)\/(.+)$/);
    if (m) {
      const s = subs.find((x) => x.id === m[1]); const u = s && s.units.find((x) => x.id === m[2]);
      return { name: `${s ? s.name : m[1]} · ${u ? u.title : m[2]}`, href: `#/s/${m[1]}/${m[2]}/concept` };
    }
    return { name: "공부방 전체", href: "#/board" };
  }

  // ── 글 하나 (+ 답글들)
  //   ctx = { admin, key, reload, showPlace, replies: [..] }
  function itemEl(it, ctx) {
    const kind = KINDS[it.kind] || KINDS.opinion;
    const blockedNames = blocked();
    const isBlocked = !it.mine && it.name && blockedNames.includes(it.name);
    const act = async (b, done) => { try { const r = await post(b); done ? done(r) : ctx.reload(); } catch (e) { alert(e.message); } };
    const needLogin = () => { if (!S.isLoggedIn()) { S.openAccount(); return true; } return false; };

    const head = el("div", { class: "cm-head" },
      it.parent ? null : el("span", { class: `cm-kind k-${it.kind}`, text: kind.label }),
      it.status ? el("span", { class: `cm-st s-${it.status}`, text: STATUS[it.status] }) : null,
      it.deleted ? null : el("b", { text: it.name }),
      el("span", { class: "muted small", text: ago(it.t) }),
      ctx.admin && it.reports ? el("span", { class: "cm-st s-rep", text: `신고 ${it.reports}` }) : null,
      ctx.showPlace && !it.parent ? el("a", { class: "cm-place", href: place(it.key).href, text: place(it.key).name }) : null);

    let body;
    if (it.deleted) body = el("p", { class: "cm-text muted", text: "삭제된 댓글이에요." });
    else if (isBlocked) {
      body = el("p", { class: "cm-text muted" }, "🚫 차단한 사람의 글이에요. ",
        el("button", { class: "link", type: "button", onclick: () => { setBlocked(blocked().filter((n) => n !== it.name)); ctx.reload(); } }, "차단 풀기"));
    } else if (it.hidden && !it.text) body = el("p", { class: "cm-text muted", text: "🚨 신고가 많아 가려진 글이에요." });
    else body = el("p", { class: "cm-text" + (it.hidden ? " hidden-note" : "") }, rich(it.text));

    const tools = el("div", { class: "row cm-tools" });
    const replyBox = el("div", { class: "cm-reply hidden" });
    if (!it.deleted && !isBlocked) {
      tools.append(el("button", { class: "chip like" + (it.liked ? " on" : ""), type: "button", title: "도움돼요",
        onclick: () => { if (!needLogin()) act({ action: "like", id: it.id }); } }, `👍 ${it.likes}`));
      if (!it.parent) tools.append(el("button", { class: "link", type: "button", onclick: () => {
        if (needLogin()) return;
        replyBox.classList.toggle("hidden");
        if (!replyBox.firstChild) replyBox.append(composer(ctx.key || it.key, ctx.reload, it.id));
      } }, "답글"));
      if (it.canDelete) tools.append(el("button", { class: "link", type: "button", onclick: () => {
        if (confirm("이 글을 지울까요?")) act({ action: "del", id: it.id });
      } }, "지우기"));
      if (!it.mine && S.isLoggedIn()) {
        tools.append(el("button", { class: "link", type: "button", disabled: it.reported, onclick: () => {
          if (confirm("이 글을 신고할까요? (욕설·도배·광고·개인정보 등) 3명이 신고하면 가려져요.")) act({ action: "report", id: it.id }, () => { addReport(it.id); ctx.reload(); });
        } }, it.reported ? "신고함" : "🚨 신고"));
        tools.append(el("button", { class: "link", type: "button", onclick: () => {
          if (!confirm(`${it.name} 님을 차단할까요? 이 사람의 글이 내 화면에서 가려져요.`)) return;
          setBlocked([...new Set([...blocked(), it.name])]); ctx.reload();
        } }, "🚫 차단"));
      }
    }
    if (ctx.admin && !it.deleted) {
      if (!it.parent && (it.kind === "request" || it.kind === "bug" || it.status)) {
        const sel = el("select", { class: "cm-status", "aria-label": "상태" },
          Object.entries(STATUS).map(([v, t]) => { const o = el("option", { value: v }, t || "상태 없음"); if (v === it.status) o.selected = true; return o; }));
        sel.addEventListener("change", () => act({ action: "status", id: it.id, status: sel.value }));
        tools.append(sel);
      }
      tools.append(el("button", { class: "link adm", type: "button", onclick: () => act({ action: "hide", id: it.id, hidden: !it.hidden }) }, it.hidden ? "가림 풀기" : "가리기"));
      if (!it.mine) tools.append(el("button", { class: "link adm", type: "button", onclick: () => {
        if (confirm(`${it.name} 님의 글쓰기를 막을까요? (게시판에서 풀 수 있어요)`)) act({ action: "ban", id: it.id }, () => { alert("글쓰기를 막았어요."); ctx.reload(); });
      } }, "글쓰기 정지"));
    }

    const node = el("article", { class: "cm" + (it.mine ? " mine" : "") + (it.parent ? " reply" : "") }, head, body, tools, replyBox);
    if (ctx.replies && ctx.replies.length) {
      node.append(el("div", { class: "cm-replies" }, ctx.replies.map((r) => itemEl(r, { ...ctx, replies: null }))));
    }
    return node;
  }

  // 목록 → 원글 + 답글 묶음 (답글은 오래된 순)
  function threads(items) {
    const kids = new Map();
    items.filter((x) => x.parent).forEach((x) => { if (!kids.has(x.parent)) kids.set(x.parent, []); kids.get(x.parent).push(x); });
    kids.forEach((a) => a.sort((x, y) => x.t - y.t));
    return items.filter((x) => !x.parent).map((x) => ({ it: x, replies: kids.get(x.id) || [] }))
      .filter((x) => !x.it.deleted || x.replies.length);
  }

  // ── 글쓰기 칸 (parent 가 있으면 답글)
  function composer(key, onPosted, parent) {
    let kind = "opinion";
    const emos = [];
    const ta = el("textarea", { class: "answer-note", rows: parent ? "2" : "3", maxlength: "1000", placeholder: parent ? "답글을 써 주세요" : KINDS.opinion.hint });
    const kinds = parent ? null : el("div", { class: "seg" }, Object.entries(KINDS).map(([k, v]) => {
      const b = el("button", { class: "chip" + (k === kind ? " on" : ""), type: "button" }, v.label);
      b.addEventListener("click", () => {
        kind = k; ta.placeholder = v.hint;
        kinds.querySelectorAll(".chip").forEach((c) => c.classList.remove("on")); b.classList.add("on");
      });
      return b;
    }));
    const chosen = el("div", { class: "emo-chosen" });
    const paintChosen = () => chosen.replaceChildren(...emos.map((e, i) => el("span", { class: "emo-slot" },
      el("img", { src: e.src, alt: "" }), el("button", { class: "x", type: "button", "aria-label": "빼기", onclick: () => { emos.splice(i, 1); paintChosen(); } }, "✕"))));
    // 이모티콘: 글이 비어 있을 때 누르면 바로 보내기(아카콘처럼), 글을 쓰는 중이면 글에 붙이기
    const picker = S.emoPicker ? S.emoPicker((token, src, quick) => {
      if (quick && !ta.value.trim() && !emos.length) return send([token]);
      if (emos.length < 10) { emos.push({ token, src }); paintChosen(); }
    }) : null;
    // 기본 이모지: 누르면 글자 넣는 자리에 바로 들어감 (로그인·포인트 필요 없음)
    const QUICK = ["😀", "😂", "🥹", "😭", "😍", "🤔", "😮", "😢", "👍", "👏", "🙏", "🔥", "💯", "🎉", "❤️", "✨", "✅", "❓"];
    const quick = el("div", { class: "quick-emo" }, QUICK.map((e) => el("button", { type: "button", tabindex: "-1", "aria-label": e,
      onmousedown: (ev) => ev.preventDefault(),
      onclick: () => {
        const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
        ta.value = ta.value.slice(0, a) + e + ta.value.slice(b);
        ta.focus(); ta.setSelectionRange(a + e.length, a + e.length);
      } }, e)));
    const msg = el("div", { class: "msg" });
    const btn = el("button", { class: "btn" + (parent ? " small" : ""), type: "button" }, parent ? "답글 달기" : "남기기");
    // Ctrl+Enter 로 보내기
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
    btn.addEventListener("click", () => send());
    async function send(only) {
      if (!S.isLoggedIn()) return S.openAccount();
      if (btn.disabled) return;
      btn.disabled = true; msg.textContent = "";
      try {
        const text = only ? only.join("") : [ta.value.trim(), emos.map((e) => e.token).join("")].filter(Boolean).join(" ");
        await post({ action: "add", key, kind, text, parent });
        ta.value = ""; emos.length = 0; paintChosen();
        msg.textContent = "올렸어요. 고마워요!"; msg.className = "msg ok";
        onPosted();
      } catch (e) { msg.textContent = e.message; msg.className = "msg err"; }
      finally { btn.disabled = false; }
    }
    const who = S.isLoggedIn() ? el("span", { class: "muted small", text: `${S.userName()} 님으로 남겨요` })
      : el("button", { class: "link", type: "button", onclick: () => S.openAccount() }, "로그인하면 글을 남길 수 있어요");
    return el("div", { class: "cm-compose" + (parent ? " small" : "") }, kinds, ta, quick, chosen, picker ? picker.panel : null,
      el("div", { class: "row" }, btn, picker ? picker.button : null, parent ? null : who), msg);
  }

  // ── 새 글 알림: 목록이 화면에 있는 동안 1분마다 확인 → "새 댓글 N개 · 새로고침" 버튼
  //   shown() = 지금 보이는 글 id 들, reload() = 다시 불러오기
  function watchNew(anchor, key, shown, reload) {
    const btn = el("button", { class: "btn small cm-new hidden", type: "button" });
    btn.addEventListener("click", () => { btn.classList.add("hidden"); reload(); });
    let timer = 0;
    const check = async () => {
      if (!document.body.contains(anchor)) { clearInterval(timer); document.removeEventListener("visibilitychange", onVis); return; }
      if (document.visibilityState !== "visible") return;
      try {
        const have = shown();
        const r = await get(key);
        const fresh = r.items.filter((it) => !have.has(it.id) && !it.mine && !it.deleted);
        if (fresh.length) {
          btn.textContent = `🔔 새 댓글 ${fresh.length}개 · 새로고침`;
          btn.classList.remove("hidden");
        }
      } catch (e) { /* 다음에 다시 */ }
    };
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    timer = setInterval(check, 60000);   // 1분마다 (Blob 연산 아끼기 · 서버도 15초 기억)
    document.addEventListener("visibilitychange", onVis);
    btn.hide = () => btn.classList.add("hidden");
    return btn;
  }

  // ── 공부법·개념 아래 댓글 칸
  S.commentBox = function (key, label) {
    const listEl = el("div", { class: "cm-list" });
    const count = el("span", { class: "muted small" });
    const box = el("section", { class: "group comments" },
      el("div", { class: "cm-title" }, el("b", {}, "💬 ", label || "의견 · 나만의 공부법"), count,
        el("a", { class: "link", href: "#/board" }, "전체 게시판 →")),
      el("p", { class: "muted small", text: "이 페이지에 대한 의견, 나만의 공부법, 추가했으면 하는 내용을 남겨 주세요. 모두 함께 봐요." }));
    let ids = new Set(), fresh = null;
    async function load(force) {
      try {
        const r = await get(key, force);
        ids = new Set(r.items.map((x) => x.id));
        if (fresh) fresh.hide();
        const th = threads(r.items);
        count.textContent = `${th.length}개`;
        const ctx = { admin: r.admin, key, reload: () => load(true) };
        listEl.replaceChildren(...(th.length ? th.map((t) => itemEl(t.it, { ...ctx, replies: t.replies })) :
          [el("p", { class: "muted small", text: "아직 글이 없어요. 첫 글을 남겨 보세요!" })]));
      } catch (e) {
        listEl.replaceChildren(el("p", { class: "muted small", text: e.message }));
      }
    }
    // 서버가 있는 곳(배포 주소)에서만 보여 줌
    if (S.serverReady) {
      box.classList.add("hidden");
      S.serverReady().then((ok) => {
        if (!ok) return;
        box.classList.remove("hidden");
        fresh = watchNew(listEl, key, () => ids, () => load(true));
        box.append(composer(key, () => load(true)), fresh, listEl);
        // 화면에 보일 때 처음 불러옴 (아래까지 안 내리면 서버에 묻지 않음)
        listEl.replaceChildren(el("p", { class: "muted small", text: "댓글 불러오는 중…" }));
        if ("IntersectionObserver" in window) {
          const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: "200px" });
          io.observe(box);
        } else load();
      });
    }
    return box;
  };

  // ── 전체 게시판
  S.viewBoard = function (app) {
    app.append(el("h1", { class: "page-title" }, "💬 피드백 게시판"));
    app.append(el("p", { class: "muted", text: "공부방 전체에 대한 의견·나만의 공부법·추가 요청·오류 신고를 모아 봐요. 요청은 확인해서 반영할게요." }));
    const filter = { kind: "", status: "" };
    const listEl = el("div", { class: "cm-list" });
    const info = el("div", { class: "muted small" });
    const adminBox = el("div");
    let all = [], admin = false;

    const chips = (label, field, options) => el("div", { class: "seg" }, el("b", {}, label), options.map(([v, t]) => {
      const b = el("button", { class: "chip" + (filter[field] === v ? " on" : ""), type: "button" }, t);
      b.addEventListener("click", () => {
        filter[field] = v;
        b.parentNode.querySelectorAll(".chip").forEach((c) => c.classList.remove("on")); b.classList.add("on");
        paint();
      });
      return b;
    }));
    function paint() {
      const th = threads(all).filter(({ it }) => (!filter.kind || it.kind === filter.kind) &&
        (!filter.status || (filter.status === "open" ? it.status !== "done" : filter.status === "reported" ? (it.reports || it.hidden) : it.status === filter.status)));
      info.textContent = `${th.length}개`;
      listEl.replaceChildren(...(th.length ? th.map((t) => itemEl(t.it, { admin, reload: () => load(true), showPlace: true, replies: t.replies }))
        : [el("p", { class: "muted", text: "해당하는 글이 없어요." })]));
    }
    async function load(force) {
      try {
        const r = await get("", force); all = r.items; admin = r.admin; fresh.hide(); paint();
        if (admin && !adminBox.firstChild) adminPanel();
      } catch (e) { listEl.replaceChildren(el("p", { class: "muted", text: e.message })); }
    }
    // 관리자: 정지 목록
    async function adminPanel() {
      const list = el("div", { class: "row" });
      const paintBans = (bans) => list.replaceChildren(...(bans.length ? bans.map((b) => el("span", { class: "chip" }, b.name, " ",
        el("button", { class: "link", type: "button", onclick: async () => paintBans((await post({ action: "unban", name: b.name })).bans) }, "풀기")))
        : [el("span", { class: "muted small" }, "글쓰기 정지된 사람이 없어요.")]));
      // 저장소를 Blob → Upstash Redis 로 바꾼 뒤, Blob 이 다시 열리면 예전 계정·기록을 가져오기
      const mig = el("button", { class: "btn ghost small", type: "button" }, "📦 예전 Blob 기록 가져오기");
      const migMsg = el("span", { class: "muted small" });
      mig.addEventListener("click", async () => {
        if (!confirm("예전 Blob 저장소의 계정·기록을 지금 저장소로 가져올까요? (이미 있는 것은 그대로 둬요)")) return;
        mig.disabled = true; migMsg.textContent = "가져오는 중…";
        try { const r = await S.api("migrate", { method: "POST", body: "{}" }); migMsg.textContent = `가져옴 ${r.copied}개 · 이미 있어서 건너뜀 ${r.skipped}개`; }
        catch (e) { migMsg.textContent = e.message; }
        finally { mig.disabled = false; }
      });
      adminBox.replaceChildren(el("details", { class: "acct-sec" }, el("summary", {}, "🛡 관리자: 글쓰기 정지 목록 · 저장소"), list,
        el("div", { class: "row" }, mig, migMsg)));
      try { paintBans((await post({ action: "bans" })).bans); } catch (e) { list.textContent = e.message; }
    }
    // 아직 반영 안 된 요청·오류를 한 번에 복사 → Claude 에게 붙여 넣기
    const copyBtn = el("button", { class: "btn ghost small", type: "button" }, "📋 반영할 요청 복사");
    copyBtn.addEventListener("click", async () => {
      const open = all.filter((it) => !it.parent && !it.deleted && !it.hidden && (it.kind === "request" || it.kind === "bug" || it.kind === "tip") && it.status !== "done");
      const text = "스토리 공부방 피드백 — 반영해 주세요\n\n" + open.map((it, i) =>
        `${i + 1}. [${KINDS[it.kind].label.replace(/^\S+\s/, "")}] ${place(it.key).name} — ${it.text.replace(/\[\[emo:[^\]]+\]\]/g, "(이모티콘)").replace(/\n/g, " ")} (${it.name}, 👍${it.likes})`).join("\n");
      try { await navigator.clipboard.writeText(text); copyBtn.textContent = `복사했어요 (${open.length}개)`; }
      catch (e) { prompt("아래 내용을 복사하세요", text); }
    });

    app.append(el("section", { class: "group" },
      el("div", { class: "cm-title" }, el("b", {}, "공부방 전체에 글 남기기")),
      composer("general", () => load(true))));
    app.append(chips("종류", "kind", [["", "전체"], ...Object.entries(KINDS).map(([k, v]) => [k, v.label])]));
    app.append(chips("상태", "status", [["", "전체"], ["open", "아직 반영 전"], ["planned", "반영 예정"], ["done", "반영 완료"], ["reported", "🚨 신고됨"]]));
    app.append(adminBox);
    app.append(el("div", { class: "row" }, info, copyBtn,
      blocked().length ? el("span", { class: "muted small" }, `🚫 차단 ${blocked().length}명`) : null));
    const fresh = watchNew(listEl, "", () => new Set(all.map((x) => x.id)), () => load(true));
    app.append(fresh, listEl);
    load();
  };
})();
