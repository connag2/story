/* 🐍 파이썬 실행기 — 브라우저 안에서 바로 실행 (Skulpt, vendor/skulpt · 인터넷 없어도 됨)
 *   STORY.pyRunner({ starter, tests, solution, onPass, compact })  → 코드 칸 · 입력 칸 · ▶ 실행 · ✅ 채점
 *     tests: [{ input: "A\n.-", out: "전송 성공!" }, ...]  (input 한 줄 = input() 한 번, out = print 로 나온 줄들)
 *   STORY.viewPy(app)  → #/py 파이썬 연습장 (시험 범위 예제)
 * 채점은 print 로 나온 줄만 비교해요(input 의 안내 문구는 빼고). 줄 끝 공백·빈 줄은 신경 쓰지 않아요.
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

  // ── Skulpt 는 처음 쓸 때만 불러와요 (약 1MB)
  let loading = null;
  function loadSkulpt() {
    if (window.Sk && Sk.builtinFiles) return Promise.resolve();
    if (loading) return loading;
    const add = (src) => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("파이썬 실행기를 불러오지 못했어요.")); document.head.append(s); });
    loading = add("vendor/skulpt/skulpt.min.js").then(() => add("vendor/skulpt/skulpt-stdlib.js")).catch((e) => { loading = null; throw e; });
    return loading;
  }

  // ── 실행: { out(채점용 print 출력), screen(화면용: 입력 안내+입력값 포함), error }
  async function run(code, inputText) {
    await loadSkulpt();
    const inputs = String(inputText || "").replace(/\r/g, "").split("\n");
    if (inputs.length && inputs[inputs.length - 1] === "") inputs.pop();
    let out = "", screen = "", error = null, asked = 0;
    Sk.execLimit = 4000;            // 무한 반복이면 4초 뒤 멈춤
    Sk.yieldLimit = 100;
    Sk.configure({
      output: (t) => { out += t; screen += t; },
      read: (x) => { if (!Sk.builtinFiles || !Sk.builtinFiles.files[x]) throw new Error("File not found: '" + x + "'"); return Sk.builtinFiles.files[x]; },
      inputfun: (prompt) => {
        asked++;
        const v = inputs.length ? inputs.shift() : null;
        if (v == null) { screen += (prompt || "") + "⟨입력 없음⟩\n"; throw new Sk.builtin.EOFError("입력값이 모자라요. 아래 「입력」 칸에 한 줄씩 더 넣어 주세요."); }
        screen += (prompt || "") + v + "\n";
        return v;
      },
      inputfunTakesPrompt: true,
      __future__: Sk.python3,
    });
    try {
      await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<stdin>", false, code, true));
    } catch (e) {
      error = explain(e);
    }
    return { out, screen, error, asked };
  }

  // ── 오류를 쉬운 말로
  function explain(e) {
    const raw = e && e.toString ? e.toString() : String(e);
    let line = null;
    try { if (e.traceback && e.traceback.length) line = e.traceback[0].lineno; } catch (x) { /* 무시 */ }
    const tips = [
      [/TimeLimitError|time limit/i, "⏱ 4초가 지나도 안 끝났어요. 반복이 끝나지 않는(무한 반복) 건 아닌지 확인해 보세요. while 조건이 언젠가 거짓이 되나요?"],
      [/IndentationError|indent/i, "들여쓰기가 맞지 않아요. if · while · for · def 다음 줄은 똑같이 4칸 들여 써요."],
      [/SyntaxError|bad input/i, "문법 오류예요. if · while · for · def · else 줄 끝의 콜론(:), 괄호·따옴표 짝, = 와 == 를 확인해 보세요."],
      [/NameError/i, "이름을 못 찾았어요. 변수·함수 이름의 오타, 따옴표 빠짐(\"A\" 대신 A), 아직 만들지 않은 변수를 썼는지 확인해 보세요."],
      [/KeyError/i, "딕셔너리에 없는 키를 꺼냈어요. 먼저 `if 키 in 딕셔너리:` 로 있는지 확인하거나 .get() 을 써 보세요."],
      [/IndexError/i, "리스트의 범위를 벗어난 번호를 썼어요. 번호는 0부터 len(리스트)-1 까지예요."],
      [/TypeError.*(concatenate|unsupported operand|must be str)/i, "문자열과 숫자를 바로 더할 수 없어요. str(숫자) 로 바꾸거나 f\"{변수}\" 를 써 보세요. input() 은 항상 문자열이라 숫자는 int(input()) 이에요."],
      [/TypeError/i, "자료형이 맞지 않아요. 숫자·문자열·리스트 중 무엇인지 확인해 보세요 (input() 은 항상 문자열)."],
      [/ValueError/i, "값을 바꿀 수 없어요. 예: int(\"abc\") 처럼 숫자가 아닌 글자를 숫자로 바꾸려 했어요."],
      [/ZeroDivisionError/i, "0 으로 나눴어요."],
      [/EOFError/i, "입력값이 모자라요. 아래 「입력」 칸에 input() 개수만큼 한 줄씩 넣어 주세요."],
      [/RecursionError|maximum recursion/i, "재귀 함수가 끝나지 않았어요. 멈추는 조건(종료 조건)이 있는지 확인해 보세요."],
    ];
    const tip = (tips.find(([re]) => re.test(raw)) || [null, ""])[1];
    return { raw: raw.replace(/ on line \d+/, ""), line, tip };
  }

  const norm = (t) => String(t).replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l !== "").join("\n");

  // ── 코드 칸: Tab 은 4칸, Enter 는 들여쓰기 유지(콜론 뒤는 4칸 더), Shift+Tab 은 4칸 빼기
  function editor(value, rows) {
    const ta = el("textarea", { class: "py-code", spellcheck: "false", autocapitalize: "off", autocomplete: "off", rows: String(rows || 10), "aria-label": "파이썬 코드" });
    ta.value = value || "";
    ta.addEventListener("keydown", (e) => {
      const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
      if (e.key === "Tab") {
        e.preventDefault();
        const ls = v.lastIndexOf("\n", a - 1) + 1;
        if (e.shiftKey) {
          const n = v.slice(ls, ls + 4).match(/^ */)[0].length;
          ta.value = v.slice(0, ls) + v.slice(ls + n); ta.selectionStart = ta.selectionEnd = Math.max(ls, a - n);
        } else { ta.value = v.slice(0, a) + "    " + v.slice(b); ta.selectionStart = ta.selectionEnd = a + 4; }
      } else if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        const ls = v.lastIndexOf("\n", a - 1) + 1, line = v.slice(ls, a);
        let ind = line.match(/^ */)[0];
        if (/:\s*$/.test(line)) ind += "    ";
        ta.value = v.slice(0, a) + "\n" + ind + v.slice(b);
        ta.selectionStart = ta.selectionEnd = a + 1 + ind.length;
      }
      ta.dispatchEvent(new Event("input"));
    });
    // 내용에 맞춰 높이 늘리기
    const fit = () => { ta.style.height = "auto"; ta.style.height = Math.max(ta.scrollHeight, 120) + "px"; };
    ta.addEventListener("input", fit);
    requestAnimationFrame(fit);
    return ta;
  }

  // ── 실행기 한 벌
  S.pyRunner = function ({ starter = "", tests = null, solution = "", onPass, saveKey, inputs = "" } = {}) {
    let saved = null;
    try { saved = saveKey ? localStorage.getItem("py:" + saveKey) : null; } catch (e) { /* 무시 */ }
    const code = editor(saved != null ? saved : starter, 10);
    const inp = el("textarea", { class: "py-input", rows: "2", placeholder: "입력값 (한 줄에 하나씩 — input() 한 번에 한 줄)", spellcheck: "false", "aria-label": "입력값" });
    inp.value = inputs || (tests && tests[0] ? tests[0].input : "");
    const screen = el("pre", { class: "py-out", "aria-live": "polite" });
    const result = el("div", { class: "py-result" });
    let saveT = 0;
    code.addEventListener("input", () => { clearTimeout(saveT); saveT = setTimeout(() => { try { if (saveKey) localStorage.setItem("py:" + saveKey, code.value); } catch (e) { /* 무시 */ } }, 500); });

    const busy = (b, btn, label) => { btn.disabled = b; btn.textContent = b ? "⏳ 실행 중…" : label; };
    const showError = (err) => el("div", { class: "py-err" },
      el("b", {}, `❗ 오류${err.line ? ` (${err.line}번째 줄)` : ""}`), el("code", { text: err.raw }), err.tip ? el("div", {}, "💡 ", err.tip) : null);

    const runBtn = el("button", { class: "btn small", type: "button" }, "▶ 실행");
    runBtn.addEventListener("click", async () => {
      busy(true, runBtn, "▶ 실행"); result.replaceChildren();
      try {
        const r = await run(code.value, inp.value);
        screen.textContent = r.screen || "(출력 없음)";
        if (r.error) result.replaceChildren(showError(r.error));
      } catch (e) { screen.textContent = e.message; }
      busy(false, runBtn, "▶ 실행");
    });

    let checkBtn = null;
    if (tests && tests.length) {
      checkBtn = el("button", { class: "btn small ok", type: "button" }, "✅ 채점");
      checkBtn.addEventListener("click", async () => {
        busy(true, checkBtn, "✅ 채점"); result.replaceChildren();
        const rows = [];
        let pass = 0;
        for (const [i, t] of tests.entries()) {
          const r = await run(code.value, t.input);
          const ok = !r.error && norm(r.out) === norm(t.out);
          if (ok) pass++;
          rows.push(el("details", { class: "py-case" + (ok ? " ok" : " no"), ...(ok ? {} : { open: true }) },
            el("summary", {}, `${ok ? "⭕" : "❌"} 테스트 ${i + 1}${t.label ? " · " + t.label : ""}`),
            el("div", { class: "py-case-body" },
              el("div", {}, el("b", {}, "입력 "), el("code", { text: t.input ? t.input.split("\n").join(" ⏎ ") : "(없음)" })),
              el("div", { class: "py-cols" },
                el("div", {}, el("b", {}, "나와야 할 출력"), el("pre", { text: norm(t.out) || "(없음)" })),
                el("div", {}, el("b", {}, "내 코드 출력"), el("pre", { text: norm(r.out) || "(없음)" }))),
              r.error ? showError(r.error) : null)));
        }
        const all = pass === tests.length;
        result.replaceChildren(el("div", { class: "py-score" + (all ? " ok" : "") }, all ? `🎉 테스트 ${pass}개 모두 통과!` : `테스트 ${tests.length}개 중 ${pass}개 통과 — ❌ 를 눌러 차이를 비교해 보세요.`), ...rows);
        busy(false, checkBtn, "✅ 채점");
        if (all && onPass) onPass();
      });
    }
    const resetBtn = el("button", { class: "link", type: "button", onclick: () => { if (confirm("처음 코드로 되돌릴까요?")) { code.value = starter; code.dispatchEvent(new Event("input")); } } }, "처음으로");
    const solBtn = solution ? el("button", { class: "link", type: "button", onclick: () => {
      if (!confirm("모범 답안을 볼까요? (먼저 스스로 해 보는 게 실력이 늘어요)")) return;
      solBox.classList.toggle("hidden");
    } }, "모범 답안 보기") : null;
    const solBox = solution ? el("div", { class: "hidden" },
      el("pre", { class: "code", text: solution }),
      el("button", { class: "btn ghost small", type: "button", onclick: () => { code.value = solution; code.dispatchEvent(new Event("input")); } }, "답안을 코드 칸에 넣기")) : null;

    return el("div", { class: "py-runner" },
      code,
      el("div", { class: "py-inrow" }, el("span", { class: "muted small" }, "입력"), inp),
      el("div", { class: "row" }, runBtn, checkBtn, resetBtn, solBtn),
      screen, result, solBox);
  };
  S.pyRun = run;

  // ───────────────────────── 🐍 파이썬 연습장 #/py
  const EXAMPLES = [
    ["모스 부호 (딕셔너리 + while)", `morse = {"A": ".-", "B": "-...", "E": ".", "O": "---", "S": "..."}
letter = input("보낼 알파벳: ")
if letter not in morse:
    print("등록되지 않은 글자입니다.")
else:
    mistake = 0
    while mistake < 3:
        sign = input("모스 부호: ")
        if sign == morse[letter]:
            print("전송 성공!")
            break
        else:
            mistake += 1
            print(f"잘못된 부호입니다.({mistake}/3)")
    if mistake >= 3:
        print("부호표를 다시 확인하세요.")`, "A\n..\n.-"],
    ["리스트 추가·삭제", `a = [10, 20, 30]
a.append(40)        # 맨 뒤에 추가
a.insert(1, 15)     # 1번 자리에 끼워 넣기
a.extend([50, 60])  # 여러 개 이어 붙이기
print(a)
a.remove(20)        # 값 20 을 찾아 지우기
x = a.pop()         # 맨 뒤를 꺼내며 지우기
del a[0]            # 0번 자리 지우기
print(a, x)`, ""],
    ["2차원 리스트", `score = [[90, 80], [70, 60], [100, 95]]
print(score[1][0])
for row in score:
    print(row[0] + row[1])`, ""],
    ["딕셔너리", `price = {"사과": 1000, "배": 2000}
price["감"] = 500          # 추가
price["사과"] = 1200       # 수정
print(price["배"])
print("포도" in price)
for k in price:
    print(k, price[k])`, ""],
    ["연산자", `print(7 / 2, 7 // 2, 7 % 2, 2 ** 3)
print(3 + 4 * 2 ** 2)
print(5 > 3 and 2 > 4, 5 > 3 or 2 > 4, not 5 > 3)`, ""],
    ["for · range · break · continue", `for i in range(1, 11):
    if i % 2 == 0:
        continue
    if i > 7:
        break
    print(i, end=" ")`, ""],
    ["함수 · 반환값", `def add(a, b):      # a, b: 매개변수
    return a + b

result = add(3, 5)  # 3, 5: 인자
print(result)`, ""],
    ["재귀 함수 (팩토리얼)", `def fact(n):
    if n == 1:          # 멈추는 조건
        return 1
    return n * fact(n - 1)

print(fact(5))`, ""],
  ];
  S.viewPy = function (app) {
    app.append(el("nav", { class: "crumbs" }, el("a", { href: "#/s/programming" }, "← 프로그래밍")));
    app.append(el("h1", { class: "page-title" }, "🐍 파이썬 연습장"));
    app.append(el("p", { class: "muted", text: "코드를 쓰고 ▶ 실행을 누르면 바로 결과가 나와요. input() 이 있으면 「입력」 칸에 한 줄씩 넣어요. 예제를 골라 고쳐 보면서 연습해 보세요. (코드는 이 기기에 저장돼요)" }));
    const box = el("div");
    const pick = el("select", { class: "py-pick", "aria-label": "예제" }, el("option", { value: "" }, "예제 고르기…"), EXAMPLES.map(([t], i) => el("option", { value: String(i) }, t)));
    pick.addEventListener("change", () => {
      if (pick.value === "") return;
      const [, c, i] = EXAMPLES[+pick.value];
      box.replaceChildren(S.pyRunner({ starter: c, inputs: i, saveKey: "free-" + pick.value }));
    });
    app.append(el("div", { class: "row" }, pick), box);
    box.append(S.pyRunner({ starter: EXAMPLES[0][1], inputs: EXAMPLES[0][2], saveKey: "free" }));
  };
})();
