/* 이모티콘 상점 (아카콘처럼) · 포인트
 *   #/shop          상점 · 내 이모티콘 · 만들기
 *   STORY.renderRich(text)   댓글 글자 + [[emo:묶음:번호]] → 이미지 (글자는 textContent 로만)
 *   STORY.emoPicker(onPick)  댓글 쓰기 칸의 이모티콘 고르기
 * 포인트: 문제를 처음 맞히면 1점(서버가 동기화 때 계산). 이모티콘을 팔면 산 사람의 포인트가 만든 사람에게.
 */
(function () {
  "use strict";
  const S = window.STORY;
  const EMO = /\[\[emo:([\w-]{1,20}):(\d{1,2})\]\]/g;

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
  const api = (path, opts) => S.api(path, opts);
  const post = (b) => api("emoticons", { method: "POST", body: JSON.stringify(b) });

  // ── 이모티콘 그림 캐시 (묶음 단위로 한 번만 받아 옴)
  const packCache = new Map();   // id → Promise<{ pack, images }>
  function getPack(id) {
    if (!packCache.has(id)) packCache.set(id, api("emoticons?id=" + encodeURIComponent(id)).catch((e) => { packCache.delete(id); throw e; }));
    return packCache.get(id);
  }
  let listCache = null;
  const getList = (fresh) => (!fresh && listCache) || (listCache = api("emoticons").catch((e) => { listCache = null; throw e; }));

  S.renderRich = function (text) {
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of text.matchAll(EMO)) {
      if (m.index > last) frag.append(document.createTextNode(text.slice(last, m.index)));
      const img = el("img", { class: "emo", alt: "이모티콘", loading: "lazy" });
      getPack(m[1]).then((r) => { const src = r.images[+m[2]]; if (src) img.src = src; else img.replaceWith("(없는 이모티콘)"); })
        .catch(() => img.replaceWith("(가려진 이모티콘)"));
      frag.append(img);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.append(document.createTextNode(text.slice(last)));
    return frag;
  };

  // ── 댓글 쓰기 칸에 붙는 고르기 창
  //   맨 위 「최근」 줄 · 묶음 탭(그림으로) · 가진 게 없으면 무료/싼 이모티콘을 바로 받기
  //   onPick(token, src, quick) — quick 이면 글이 비어 있을 때 바로 보냄
  const RECENT = "emo-recent-v1", QUICKSEND = "emo-quicksend-v1";
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 무시 */ } };
  S.emoPicker = function (onPick) {
    const wrap = el("div", { class: "emo-picker hidden" });
    const pick = (token, src) => {
      lsSet(RECENT, [token, ...lsGet(RECENT, []).filter((t) => t !== token)].slice(0, 16));
      onPick(token, src, lsGet(QUICKSEND, true));
      paintRecent();
    };
    const recent = el("div", { class: "emo-grid emo-recent" });
    function paintRecent() {
      const owned = new Set(((S.points && S.points()) || {}).owned || []);
      const list = lsGet(RECENT, []).filter((t) => owned.has(t.split(":")[1]));
      recent.replaceChildren(...(list.length ? [el("span", { class: "muted small emo-lbl" }, "최근")] : []), ...list.map((token) => {
        const [, id, i] = token.match(/\[\[emo:([^:]+):(\d+)\]\]/) || [];
        const img = el("img", { alt: "" });
        const b = el("button", { class: "emo-btn sm", type: "button", onclick: () => pick(token, img.src) }, img);
        getPack(id).then((r) => { img.src = r.images[+i] || ""; }).catch(() => b.remove());
        return b;
      }));
    }
    const quickBox = el("input", { type: "checkbox" });
    quickBox.checked = lsGet(QUICKSEND, true);
    quickBox.addEventListener("change", () => lsSet(QUICKSEND, quickBox.checked));
    const head = el("label", { class: "muted small emo-quick" }, quickBox, " 글이 비어 있으면 누르자마자 보내기");

    async function load() {
      const pts = S.points && S.points();
      const owned = (pts && pts.owned) || [];
      const list = await getList(true).catch(() => ({ packs: [] }));
      if (!owned.length) {
        // 가진 게 없으면: 무료·싼 것부터 바로 받기
        const cheap = list.packs.filter((p) => !p.hidden).sort((a, b) => a.price - b.price).slice(0, 8);
        wrap.replaceChildren(el("p", { class: "muted small" }, `가진 이모티콘이 없어요. 🪙 ${pts ? pts.points : 0}포인트로 바로 받아 보세요 (문제 1개 맞히면 1포인트).`),
          el("div", { class: "emo-offers" }, cheap.map((p) => {
            const b = el("button", { class: "btn small", type: "button" }, p.price ? `🪙 ${p.price}` : "무료 받기");
            b.addEventListener("click", async () => {
              b.disabled = true;
              try { const r = await post({ action: "buy", id: p.id }); S.setPoints(r.points); S.toast(`「${p.name}」을(를) 받았어요!`); wrap.dataset.loaded = ""; load(); }
              catch (e) { S.toast(e.message); b.disabled = false; }
            });
            return el("div", { class: "emo-offer" }, el("img", { src: p.thumb, alt: "" }), el("b", { text: p.name }), b);
          })),
          el("a", { class: "link", href: "#/shop" }, "상점 전체 보기 · 직접 만들기 →"));
        return;
      }
      const names = Object.fromEntries(list.packs.map((p) => [p.id, p]));
      const tabs = el("div", { class: "emo-tabs" });
      const grid = el("div", { class: "emo-grid" });
      wrap.replaceChildren(head, recent, tabs, grid);
      paintRecent();
      const show = async (id, btn) => {
        tabs.querySelectorAll("button").forEach((c) => c.classList.remove("on")); btn.classList.add("on");
        lsSet("emo-lasttab-v1", id);
        grid.replaceChildren(el("span", { class: "muted small" }, "불러오는 중…"));
        try {
          const r = await getPack(id);
          grid.replaceChildren(...r.images.map((src, i) => el("button", { class: "emo-btn", type: "button", title: `${r.pack.name} ${i + 1}`,
            onclick: () => pick(`[[emo:${id}:${i}]]`, src) }, el("img", { src, alt: "" }))));
        } catch (e) { grid.replaceChildren(el("span", { class: "muted small" }, e.message)); }
      };
      const last = lsGet("emo-lasttab-v1", null);
      let first = null;
      owned.forEach((id) => {
        const p = names[id];
        const b = el("button", { class: "emo-tab", type: "button", title: p ? p.name : "이모티콘" }, p ? el("img", { src: p.thumb, alt: "" }) : "😀");
        b.addEventListener("click", () => show(id, b));
        tabs.append(b);
        if (!first || id === last) first = [id, b];
      });
      tabs.append(el("a", { class: "emo-tab more", href: "#/shop", title: "더 받기" }, "＋"));
      show(...first);
    }
    const toggle = () => {
      wrap.classList.toggle("hidden");
      if (wrap.classList.contains("hidden") || wrap.dataset.loaded) return;
      wrap.dataset.loaded = "1";
      load();
    };
    const btn = el("button", { class: "btn ghost small", type: "button", title: "이모티콘" }, "😀 이모티콘");
    btn.addEventListener("click", () => { if (!S.isLoggedIn()) return S.openAccount(); toggle(); });
    return { button: btn, panel: wrap };
  };

  // ── 이미지 줄이기: 128px 안으로 (움직이는 GIF는 200KB 이하면 그대로)
  function readAsDataURL(file) {
    return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
  }
  async function shrink(file) {
    const src = await readAsDataURL(file);
    if (file.type === "image/gif" && file.size <= 200 * 1024) return src;
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(`${file.name}: 그림을 열 수 없어요`)); i.src = src; });
    const scale = Math.min(1, 128 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL("image/webp", 0.85);
    if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/png");
    return out;
  }

  // ── 상점 화면
  S.viewShop = function (app, tab) {
    tab = ["shop", "mine", "make"].includes(tab) ? tab : "shop";
    const pts = S.points && S.points();
    app.append(el("h1", { class: "page-title" }, "😀 이모티콘 상점"));
    app.append(el("div", { class: "pointbar" },
      el("div", {}, el("b", { class: "pt-big" }, S.isLoggedIn() ? `🪙 ${pts ? pts.points : "…"}` : "🪙 -"),
        el("span", { class: "muted small" }, S.isLoggedIn()
          ? ` 포인트 · 맞힌 문제 ${pts ? pts.solved : "…"}개 · 판매 수익 ${pts ? pts.bonus : "…"} · 쓴 것 ${pts ? pts.spent : "…"}`
          : " 로그인하면 문제를 맞힐 때마다 포인트가 쌓여요")),
      S.isLoggedIn() ? null : el("button", { class: "btn small", type: "button", onclick: () => S.openAccount() }, "로그인")));
    app.append(el("p", { class: "muted small" }, "문제를 처음 맞히면 1포인트. 모은 포인트로 이모티콘을 사서 댓글에 쓸 수 있어요. 직접 만든 이모티콘을 팔면 그 포인트는 만든 사람에게 가요."));
    app.append(el("nav", { class: "steps" }, [["shop", "상점"], ["mine", "내 이모티콘"], ["make", "만들어 팔기"]].map(([k, t], i) =>
      el("a", { class: "step" + (k === tab ? " on" : ""), href: `#/shop/${k}` }, el("span", { class: "n" }, String(i + 1)), t))));
    const body = el("div");
    app.append(body);
    if (tab === "make") return makeForm(body);
    body.append(el("p", { class: "muted" }, "불러오는 중…"));
    getList(true).then((r) => {
      const packs = tab === "mine" ? r.packs.filter((p) => p.owned || p.mine) : r.packs;
      if (!packs.length) {
        body.replaceChildren(el("div", { class: "empty" }, tab === "mine" ? "아직 가진 이모티콘이 없어요." : "아직 올라온 이모티콘이 없어요. 첫 번째로 만들어 보세요!",
          el("div", {}, el("a", { class: "btn", href: tab === "mine" ? "#/shop" : "#/shop/make" }, tab === "mine" ? "상점 둘러보기" : "만들기"))));
        return;
      }
      body.replaceChildren(el("div", { class: "ugrid" }, packs.map((p) => packTile(p, r.me && r.me.admin))));
    }).catch((e) => body.replaceChildren(el("div", { class: "empty" }, e.message)));
  };

  function packTile(p, admin) {
    return el("button", { class: "utile pack" + (p.owned ? " done" : ""), type: "button", onclick: () => openPack(p, admin) },
      el("img", { class: "pack-thumb", src: p.thumb, alt: "" }),
      el("div", { class: "no", text: p.name }),
      el("div", { class: "tp", text: `${p.author} · ${p.count}개 · 판매 ${p.sales}` }),
      el("div", { class: "price" }, p.owned ? "✅ 가지고 있어요" : p.price ? `🪙 ${p.price}` : "무료"),
      p.hidden ? el("div", { class: "muted small" }, "🚨 신고로 가려짐") : null);
  }

  function openPack(p, admin) {
    const close = () => wrap.remove();
    const grid = el("div", { class: "emo-grid big" }, el("span", { class: "muted small" }, "불러오는 중…"));
    const msg = el("div", { class: "msg" });
    const act = el("div", { class: "row" });
    const refresh = () => { listCache = null; packCache.delete(p.id); close(); S.reload ? S.reload() : location.reload(); };
    if (!p.owned) {
      const buy = el("button", { class: "btn", type: "button" }, p.price ? `🪙 ${p.price}에 사기` : "무료로 받기");
      buy.addEventListener("click", async () => {
        if (!S.isLoggedIn()) return S.openAccount();
        buy.disabled = true;
        try { const r = await post({ action: "buy", id: p.id }); S.setPoints(r.points); S.toast(`「${p.name}」을(를) 샀어요!`); refresh(); }
        catch (e) { msg.textContent = e.message; msg.className = "msg err"; buy.disabled = false; }
      });
      act.append(buy);
    } else act.append(el("span", { class: "muted" }, "✅ 댓글 쓰기 칸의 「😀 이모티콘」에서 쓸 수 있어요"));
    if (!p.mine && S.isLoggedIn()) act.append(el("button", { class: "link", type: "button", onclick: async () => {
      if (!confirm("이 이모티콘을 신고할까요? (부적절한 그림, 남의 그림 도용 등)")) return;
      try { await post({ action: "report", id: p.id }); msg.textContent = "신고했어요. 3명이 신고하면 가려지고 관리자가 확인해요."; msg.className = "msg ok"; }
      catch (e) { msg.textContent = e.message; msg.className = "msg err"; }
    } }, "🚨 신고"));
    if ((p.mine && !p.sales) || admin) act.append(el("button", { class: "link", type: "button", onclick: async () => {
      if (!confirm("정말 지울까요? 되돌릴 수 없어요.")) return;
      try { await post({ action: "delete", id: p.id }); refresh(); } catch (e) { msg.textContent = e.message; msg.className = "msg err"; }
    } }, "지우기"));
    if (admin) act.append(el("button", { class: "link", type: "button", onclick: async () => {
      try { await post({ action: "hide", id: p.id, hidden: !p.hidden }); refresh(); } catch (e) { msg.textContent = e.message; msg.className = "msg err"; }
    } }, p.hidden ? "가림 풀기" : "가리기"), el("span", { class: "muted small" }, `신고 ${p.reports || 0}`));
    const wrap = el("div", { class: "modal", onclick: (e) => { if (e.target === wrap) close(); } },
      el("div", { class: "mbox wide", role: "dialog", "aria-label": p.name },
        el("div", { class: "mhd" }, el("b", { text: p.name }), el("button", { class: "x", type: "button", "aria-label": "닫기", onclick: close }, "✕")),
        el("div", { class: "mbd" },
          el("div", { class: "muted small", text: `${p.author} 님 · ${p.count}개 · 판매 ${p.sales}${p.desc ? " · " + p.desc : ""}` }),
          grid, act, msg)));
    document.body.append(wrap);
    getPack(p.id).then((r) => grid.replaceChildren(...r.images.map((src) => el("img", { class: "emo-lg", src, alt: "" }))))
      .catch((e) => grid.replaceChildren(el("span", { class: "muted small" }, e.message)));
  }

  function makeForm(body) {
    if (!S.isLoggedIn()) {
      body.append(el("div", { class: "empty" }, "로그인하면 이모티콘을 만들어 팔 수 있어요. ", el("button", { class: "btn small", type: "button", onclick: () => S.openAccount() }, "로그인")));
      return;
    }
    const name = el("input", { class: "answer-input", placeholder: "이름 (예: 공부하는 곰돌이)", maxlength: "20" });
    const desc = el("input", { class: "answer-input", placeholder: "한 줄 설명 (선택)", maxlength: "100" });
    const price = el("input", { class: "answer-input", type: "number", min: "0", max: "1000", step: "1", value: "10", "aria-label": "가격" });
    const file = el("input", { type: "file", accept: "image/png,image/gif,image/webp,image/jpeg", multiple: true, class: "hidden" });
    const preview = el("div", { class: "emo-grid" });
    const msg = el("div", { class: "msg" });
    let images = [];
    const paint = () => preview.replaceChildren(...images.map((src, i) => el("div", { class: "emo-slot" },
      el("img", { src, alt: "" }), el("button", { class: "x", type: "button", "aria-label": "빼기", onclick: () => { images.splice(i, 1); paint(); } }, "✕"))),
      images.length < 24 ? el("button", { class: "emo-add", type: "button", onclick: () => file.click() }, "+ 그림 추가") : null);
    file.addEventListener("change", async () => { await addFiles(file.files); file.value = ""; });
    // 여러 방법으로 그림 넣기: 파일 고르기 · 끌어다 놓기 · 붙여넣기(Ctrl+V) · ✏️ 직접 그리기
    async function addFiles(files) {
      files = [...files].filter((f) => /^image\//.test(f.type)).slice(0, 24 - images.length);
      if (!files.length) return;
      msg.textContent = "그림 줄이는 중…"; msg.className = "msg";
      for (const f of files) {
        try { images.push(await shrink(f)); } catch (e) { msg.textContent = e.message; msg.className = "msg err"; }
        if (!name.value.trim() && f.name) name.value = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 20);
      }
      if (msg.textContent === "그림 줄이는 중…") msg.textContent = "";
      paint();
    }
    const onPaste = (e) => {
      if (!document.body.contains(preview)) return document.removeEventListener("paste", onPaste);
      const files = [...(e.clipboardData && e.clipboardData.files) || []];
      if (files.length) { e.preventDefault(); addFiles(files); }
    };
    document.addEventListener("paste", onPaste);
    const draw = el("button", { class: "btn ghost small", type: "button", onclick: async () => {
      if (!S.drawEmoticon) return;
      const src = await S.drawEmoticon();
      if (src && images.length < 24) { images.push(src); paint(); }
    } }, "✏️ 직접 그리기");
    const btn = el("button", { class: "btn", type: "button" }, "올리고 팔기");
    btn.addEventListener("click", async () => {
      btn.disabled = true; msg.textContent = "올리는 중…"; msg.className = "msg";
      try {
        const r = await post({ action: "create", name: name.value, desc: desc.value, price: Number(price.value), images });
        S.setPoints(r.points); listCache = null;
        S.toast(`「${r.pack.name}」을(를) 올렸어요!`);
        location.hash = "#/shop/mine";
      } catch (e) { msg.textContent = e.message; msg.className = "msg err"; }
      finally { btn.disabled = false; }
    });
    paint();
    const sec = el("section", { class: "group make" },
      el("p", { class: "muted small" }, "그림을 ① 「+ 그림 추가」로 고르거나 ② 여기로 끌어다 놓거나 ③ 복사해서 Ctrl+V 로 붙여넣거나 ④ 「✏️ 직접 그리기」로 펜으로 그려요. 1~24개, 128px로 줄여서 올라가요(움직이는 GIF는 200KB 이하면 그대로). 남이 만든 그림을 허락 없이 올리면 안 돼요 — 신고되면 가려져요."),
      el("div", { class: "row" }, draw),
      preview,
      el("div", { class: "form" }, name, desc, el("label", { class: "row" }, "가격 🪙", price,
        ...[0, 5, 10, 30].map((v) => el("button", { class: "chip", type: "button", onclick: () => { price.value = v; } }, v ? String(v) : "무료"))), file),
      msg, el("div", { class: "row" }, btn));
    sec.addEventListener("dragover", (e) => { e.preventDefault(); sec.classList.add("drop"); });
    sec.addEventListener("dragleave", () => sec.classList.remove("drop"));
    sec.addEventListener("drop", (e) => { e.preventDefault(); sec.classList.remove("drop"); addFiles(e.dataTransfer.files); });
    body.append(sec);
  }
})();
