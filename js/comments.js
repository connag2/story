/* 댓글 · 피드백 게시판
 *   STORY.commentBox(key, label)  → 공부법·개념 아래에 붙는 댓글 칸
 *   STORY.viewBoard(app)          → #/board 전체 게시판 (위치·종류·상태로 걸러 보기, 요청 복사)
 * 글 내용은 항상 textContent 로만 넣어요(HTML로 해석하지 않음).
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

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
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
  const get = (key) => S.api("comments" + (key ? "?key=" + encodeURIComponent(key) : ""));
  const post = (b) => S.api("comments", { method: "POST", body: JSON.stringify(b) });

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

  // ── 글 하나
  function itemEl(it, admin, onChange, showPlace) {
    const kind = KINDS[it.kind] || KINDS.opinion;
    const like = el("button", { class: "chip like" + (it.liked ? " on" : ""), type: "button", title: "도움돼요" }, `👍 ${it.likes}`);
    like.addEventListener("click", async () => {
      if (!S.isLoggedIn()) return S.openAccount();
      try { const r = await post({ action: "like", id: it.id }); Object.assign(it, r.item); onChange(); } catch (e) { alert(e.message); }
    });
    const tools = el("div", { class: "row cm-tools" }, like);
    if (it.canDelete) {
      tools.append(el("button", { class: "link", type: "button", onclick: async () => {
        if (!confirm("이 글을 지울까요?")) return;
        try { await post({ action: "del", id: it.id }); onChange(true); } catch (e) { alert(e.message); }
      } }, "지우기"));
    }
    if (admin && (it.kind === "request" || it.kind === "bug" || it.status)) {
      const sel = el("select", { class: "cm-status", "aria-label": "상태" },
        Object.entries(STATUS).map(([v, t]) => { const o = el("option", { value: v }, t || "상태 없음"); if (v === it.status) o.selected = true; return o; }));
      sel.addEventListener("change", async () => {
        try { const r = await post({ action: "status", id: it.id, status: sel.value }); Object.assign(it, r.item); onChange(); } catch (e) { alert(e.message); }
      });
      tools.append(sel);
    }
    const p = showPlace ? place(it.key) : null;
    return el("article", { class: "cm" + (it.mine ? " mine" : "") },
      el("div", { class: "cm-head" },
        el("span", { class: `cm-kind k-${it.kind}`, text: kind.label }),
        it.status ? el("span", { class: `cm-st s-${it.status}`, text: STATUS[it.status] }) : null,
        el("b", { text: it.name }),
        el("span", { class: "muted small", text: ago(it.t) }),
        p ? el("a", { class: "cm-place", href: p.href, text: p.name }) : null),
      el("p", { class: "cm-text", text: it.text }),
      tools);
  }

  // ── 글쓰기 칸
  function composer(key, onPosted) {
    let kind = "opinion";
    const ta = el("textarea", { class: "answer-note", rows: "3", maxlength: "1000", placeholder: KINDS.opinion.hint });
    const kinds = el("div", { class: "seg" }, Object.entries(KINDS).map(([k, v]) => {
      const b = el("button", { class: "chip" + (k === kind ? " on" : ""), type: "button" }, v.label);
      b.addEventListener("click", () => {
        kind = k; ta.placeholder = v.hint;
        kinds.querySelectorAll(".chip").forEach((c) => c.classList.remove("on")); b.classList.add("on");
      });
      return b;
    }));
    const msg = el("div", { class: "msg" });
    const btn = el("button", { class: "btn", type: "button" }, "남기기");
    btn.addEventListener("click", async () => {
      if (!S.isLoggedIn()) return S.openAccount();
      btn.disabled = true; msg.textContent = "";
      try {
        await post({ action: "add", key, kind, text: ta.value });
        ta.value = ""; msg.textContent = "올렸어요. 고마워요!"; msg.className = "msg ok";
        onPosted();
      } catch (e) { msg.textContent = e.message; msg.className = "msg err"; }
      finally { btn.disabled = false; }
    });
    const who = S.isLoggedIn() ? el("span", { class: "muted small", text: `${S.userName()} 님으로 남겨요` })
      : el("button", { class: "link", type: "button", onclick: () => S.openAccount() }, "로그인하면 글을 남길 수 있어요");
    return el("div", { class: "cm-compose" }, kinds, ta, el("div", { class: "row" }, btn, who), msg);
  }

  // ── 공부법·개념 아래 댓글 칸
  S.commentBox = function (key, label) {
    const listEl = el("div", { class: "cm-list" });
    const count = el("span", { class: "muted small" });
    const box = el("section", { class: "group comments" },
      el("div", { class: "cm-title" }, el("b", {}, "💬 ", label || "의견 · 나만의 공부법"), count,
        el("a", { class: "link", href: "#/board" }, "전체 게시판 →")),
      el("p", { class: "muted small", text: "이 페이지에 대한 의견, 나만의 공부법, 추가했으면 하는 내용을 남겨 주세요. 모두 함께 봐요." }));
    let loaded = false;
    async function load() {
      try {
        const r = await get(key);
        count.textContent = `${r.items.length}개`;
        listEl.replaceChildren(...(r.items.length ? r.items.map((it) => itemEl(it, r.admin, (gone) => (gone ? load() : load()))) :
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
        box.append(composer(key, load), listEl);
        if (!loaded) { loaded = true; load(); }
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
      const items = all.filter((it) => (!filter.kind || it.kind === filter.kind) &&
        (!filter.status || (filter.status === "open" ? it.status !== "done" : it.status === filter.status)));
      info.textContent = `${items.length}개`;
      listEl.replaceChildren(...(items.length ? items.map((it) => itemEl(it, admin, (gone) => (gone ? load() : paint()), true))
        : [el("p", { class: "muted", text: "해당하는 글이 없어요." })]));
    }
    async function load() {
      try { const r = await get(""); all = r.items; admin = r.admin; paint(); }
      catch (e) { listEl.replaceChildren(el("p", { class: "muted", text: e.message })); }
    }
    // 아직 반영 안 된 요청·오류를 한 번에 복사 → Claude 에게 붙여 넣기
    const copyBtn = el("button", { class: "btn ghost small", type: "button" }, "📋 반영할 요청 복사");
    copyBtn.addEventListener("click", async () => {
      const open = all.filter((it) => (it.kind === "request" || it.kind === "bug" || it.kind === "tip") && it.status !== "done");
      const text = "스토리 공부방 피드백 — 반영해 주세요\n\n" + open.map((it, i) =>
        `${i + 1}. [${KINDS[it.kind].label.replace(/^\S+\s/, "")}] ${place(it.key).name} — ${it.text.replace(/\n/g, " ")} (${it.name}, 👍${it.likes})`).join("\n");
      try { await navigator.clipboard.writeText(text); copyBtn.textContent = `복사했어요 (${open.length}개)`; }
      catch (e) { prompt("아래 내용을 복사하세요", text); }
    });

    app.append(el("section", { class: "group" },
      el("div", { class: "cm-title" }, el("b", {}, "공부방 전체에 글 남기기")),
      composer("general", load)));
    app.append(chips("종류", "kind", [["", "전체"], ...Object.entries(KINDS).map(([k, v]) => [k, v.label])]));
    app.append(chips("상태", "status", [["", "전체"], ["open", "아직 반영 전"], ["planned", "반영 예정"], ["done", "반영 완료"]]));
    app.append(el("div", { class: "row" }, info, copyBtn));
    app.append(listEl);
    load();
  };
})();
