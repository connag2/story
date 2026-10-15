// 프로그래밍 집중 — 시험범위 정리표(리스트 · 딕셔너리 · 연산자 · 조건/반복 · 함수 · 재귀) + 서술형 실전(딕셔너리 + while)
//   코드 작성 문제(type: "code")는 앱 안에서 바로 실행하고 ✅ 채점해요 (js/pyrun.js).
(function () {
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const trim = (t) => {
    const lines = t.replace(/^\n|\n\s*$/g, "").split("\n");
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    return lines.map((l) => l.slice(ind)).join("\n");
  };
  const code = (t) => `<pre class="code">${esc(trim(t))}</pre>`;
  const ch = (choices, explain) => ({ type: "choice", choices, explain });
  const ex = (explain) => ({ explain });
  const out = "다음 코드의 실행 결과를 쓰시오. (공백은 신경 쓰지 않아도 돼요)";
  // 코드 작성 문제
  const task = (label, q, solution, tests, starter, explain) =>
    [label, q, code(solution), null, { type: "code", solution: trim(solution), starter: trim(starter), tests, explain }];

  STORY.addUnits("programming", [
    // ───────────────────────────── 5 리스트
    {
      id: "5",
      title: "리스트",
      sub: "인덱스 · 슬라이싱 · 추가(append/insert/extend) · 삭제(remove/pop/del) · 2차원",
      concept: `
<h3>리스트란?</h3>
<p>여러 값을 <b>순서대로</b> 한 변수에 담는 상자예요. <code>a = [10, 20, 30]</code></p>
<div class="formula">번호(인덱스)는 <b>0부터</b>: a[0]=10, a[1]=20, a[2]=30 · 뒤에서부터는 a[-1]=30<br>
슬라이싱 a[1:3] → 1번부터 <b>3번 앞까지</b> → [20, 30]</div>
<h3>추가하기</h3>
<table class="ctable"><tr><th>append(값)</th><td>맨 뒤에 1개 추가</td><td>[1,2] → append(3) → [1,2,3]</td></tr>
<tr><th>insert(위치, 값)</th><td>원하는 자리에 끼워 넣기 (뒤는 한 칸씩 밀림)</td><td>[1,2] → insert(0,9) → [9,1,2]</td></tr>
<tr><th>extend(리스트)</th><td>여러 개를 한 번에 이어 붙이기</td><td>[1,2] → extend([3,4]) → [1,2,3,4]</td></tr></table>
<h3>삭제하기</h3>
<table class="ctable"><tr><th>remove(값)</th><td><b>값</b>으로 찾아 지움 (같은 값이 여럿이면 <b>맨 앞 하나만</b>)</td></tr>
<tr><th>pop(위치)</th><td><b>위치</b>로 지우고 그 값을 <b>돌려줌</b>. 위치를 안 쓰면 맨 뒤</td></tr>
<tr><th>del a[위치]</th><td><b>위치</b>로 지움 (돌려주지 않음)</td></tr></table>
<h3>2차원 리스트</h3>
<p>리스트 안에 리스트: <code>a = [[1,2,3],[4,5,6]]</code> → <b>a[행][열]</b>. a[1][2] = 6 (1번 줄의 2번 칸)</p>
<div class="tip">💡 자주 틀리는 것: 번호는 0부터 · 슬라이싱 끝 번호는 포함 안 됨 · remove 는 값, pop/del 은 위치</div>`,
      groups: [
        {
          stars: 1, q: out,
          items: [
            ["(1)", code(`a = [10, 20, 30, 40]\nprint(a[1], a[-1])`), "20 40", "20 40", ex("번호는 0부터: a[1]=20, a[-1]은 맨 뒤 = 40")],
            ["(2)", code(`a = [10, 20, 30, 40]\nprint(a[1:3])`), "[20, 30]", ["[20, 30]", "20,30"], ex("a[1:3] 은 1번부터 3번 앞(2번)까지 → [20, 30]")],
            ["(3)", code(`a = [1, 2, 3]\na.append(4)\nprint(a)`), "[1, 2, 3, 4]", "[1, 2, 3, 4]", ex("append 는 맨 뒤에 하나 추가")],
            ["(4)", code(`a = [1, 2, 3]\na.insert(1, 9)\nprint(a)`), "[1, 9, 2, 3]", "[1, 9, 2, 3]", ex("insert(1, 9): 1번 자리에 9를 넣고 원래 1번부터는 뒤로 밀려요")],
            ["(5)", code(`a = [1, 2]\na.extend([3, 4])\nprint(len(a))`), "4", "4", ex("extend 는 리스트의 값들을 하나씩 이어 붙여요 → [1,2,3,4], 길이 4")],
            ["(6)", code(`a = [5, 3, 5, 1]\na.remove(5)\nprint(a)`), "[3, 5, 1]", "[3, 5, 1]", ex("remove 는 같은 값이 여러 개면 맨 앞의 것 하나만 지워요")],
          ],
        },
        {
          stars: 2, q: out,
          items: [
            ["(1)", code(`a = [5, 3, 1]\nx = a.pop()\nprint(x, a)`), "1 [5, 3]", "1 [5, 3]", ex("pop() 은 맨 뒤 값을 꺼내 돌려줘요 → x=1, a=[5,3]")],
            ["(2)", code(`a = [5, 3, 1]\na.pop(0)\nprint(a)`), "[3, 1]", "[3, 1]", ex("pop(0) 은 0번 자리를 꺼내요")],
            ["(3)", code(`a = [5, 3, 1]\ndel a[1]\nprint(a)`), "[5, 1]", "[5, 1]", ex("del a[1] 은 1번 자리(3)를 지워요")],
            ["(4)", code(`a = [[1, 2, 3], [4, 5, 6]]\nprint(a[1][2])`), "6", "6", ex("a[1] 은 [4,5,6], 그 중 2번 → 6")],
            ["(5)", code(`a = [[1, 2], [3, 4], [5, 6]]\nprint(len(a), len(a[0]))`), "3 2", "3 2", ex("바깥 리스트에 줄이 3개, 각 줄에 2개")],
            ["(6)", code(`a = [1, 2, 3]\nprint(4 in a, 2 in a)`), "False True", "False True", ex("in 은 리스트 안에 그 값이 있는지 True/False 로 알려 줘요")],
            ["(7)", code(`a = [1, 2, 3]\na.append([4, 5])\nprint(len(a))`), "4", "4", ex("append 는 [4,5] 를 통째로 하나의 값으로 넣어요 → [1,2,3,[4,5]], 길이 4 (extend 였다면 5)")],
            ["(8)", code(`a = [3, 1, 2]\ns = 0\nfor x in a:\n    s += x\nprint(s)`), "6", "6", ex("리스트의 값을 하나씩 꺼내 더해요: 3+1+2")],
          ],
        },
        {
          stars: 2, q: "알맞은 것을 고르시오.",
          items: [
            ["(1)", "리스트 <code>a</code> 의 <b>맨 뒤</b>에 값 하나를 추가하는 것은?", "a.append(값)", null, ch(["a.append(값)", "a.insert(0, 값)", "a.extend(값)", "a.remove(값)"], "insert(0, 값)은 맨 앞, extend 는 여러 개(리스트)를 이어 붙일 때")],
            ["(2)", "<b>값</b>으로 찾아서 지우는 것은?", "a.remove(값)", null, ch(["a.remove(값)", "a.pop(위치)", "del a[위치]", "a.append(값)"], "pop 과 del 은 위치(번호)로 지워요")],
            ["(3)", "지운 값을 <b>돌려받을 수 있는</b> 것은?", "pop", null, ch(["pop", "remove", "del", "extend"], "x = a.pop() 처럼 지운 값을 받을 수 있어요")],
            ["(4)", "<code>a = [[1,2],[3,4]]</code> 에서 4를 꺼내는 것은?", "a[1][1]", null, ch(["a[1][1]", "a[2][2]", "a[1][0]", "a[4]"], "1번 줄 [3,4] 의 1번 칸 → 4. 번호는 0부터")],
          ].map((x) => (x[3] = [x[2]], x)),
        },
      ],
    },

    // ───────────────────────────── 6 딕셔너리
    {
      id: "6",
      title: "딕셔너리",
      sub: "키:값 · 값 호출 · 추가/수정 · in · 반복",
      concept: `
<h3>딕셔너리란?</h3>
<p><b>키(key)</b>로 <b>값(value)</b>을 찾는 사전이에요. <code>morse = {"A": ".-", "B": "-..."}</code></p>
<div class="formula">값 호출: <b>딕셔너리[키]</b> → morse["A"] 는 ".-"<br>
추가·수정: <b>딕셔너리[키] = 값</b> (없는 키면 추가, 있는 키면 바뀜)<br>
있는지 확인: <b>키 in 딕셔너리</b> → True / False</div>
<ul><li><b>키는 중복될 수 없어요</b> (같은 키를 또 넣으면 값이 바뀜). 값은 중복돼도 돼요.</li>
<li>순서 번호가 아니라 <b>키로</b> 찾아요. morse[0] 은 오류!</li>
<li>없는 키를 꺼내면 <b>KeyError</b> → 먼저 <code>if 키 in 딕셔너리:</code> 로 확인</li>
<li><code>for k in d:</code> 는 <b>키</b>를 하나씩 꺼내요. 값은 d[k]</li>
<li>d.get(키, 기본값): 없으면 기본값</li></ul>
<div class="tip">💡 서술형 단골: 입력받은 키가 <code>not in</code> 딕셔너리면 "없음"을 출력하고 끝, 있으면 <code>딕셔너리[키]</code> 와 입력을 비교해요.</div>`,
      groups: [
        {
          stars: 1, q: out,
          items: [
            ["(1)", code(`d = {"a": 1, "b": 2}\nprint(d["b"])`), "2", "2", ex("키 \"b\" 의 값")],
            ["(2)", code(`d = {"a": 1}\nd["c"] = 3\nprint(len(d))`), "2", "2", ex("없는 키 \"c\" 에 넣으면 새로 추가돼요 → {\"a\":1, \"c\":3}")],
            ["(3)", code(`d = {"a": 1}\nd["a"] = 5\nprint(d["a"])`), "5", "5", ex("있는 키에 넣으면 값이 바뀌어요(키는 중복 안 됨)")],
            ["(4)", code(`d = {"a": 1}\nprint("b" in d, "a" in d)`), "False True", "False True", ex("in 은 키가 있는지 확인해요")],
            ["(5)", code(`d = {"사과": 3}\nd["사과"] = d["사과"] + 2\nprint(d["사과"])`), "5", "5", ex("원래 값 3 에 2 를 더해 다시 넣어요")],
          ],
        },
        {
          stars: 2, q: out,
          items: [
            ["(1)", code(`d = {"x": 10, "y": 20}\nfor k in d:\n    print(k, end="")`), "xy", "xy", ex("for k in d 는 키를 하나씩 꺼내요")],
            ["(2)", code(`d = {"x": 10, "y": 20}\ns = 0\nfor k in d:\n    s += d[k]\nprint(s)`), "30", "30", ex("키로 값을 꺼내 더해요: 10 + 20")],
            ["(3)", code(`d = {"x": 10}\nprint(d.get("z", 0))`), "0", "0", ex("get 은 없는 키면 뒤의 기본값을 돌려줘요")],
            ["(4)", code(`d = {"x": 10, "y": 20}\nprint(list(d.values()))`), "[10, 20]", "[10, 20]", ex("values() 는 값만 모아요")],
            ["(5)", code(`cmd = {"전진": "forward", "정지": "stop"}\na = "정지"\nif a in cmd:\n    print(cmd[a])\nelse:\n    print("없음")`), "stop", "stop", ex("\"정지\" 가 키로 있으니 그 값 stop")],
            ["(6)", code(`cmd = {"전진": "forward", "정지": "stop"}\na = "회전"\nif a not in cmd:\n    print("없음")\nelse:\n    print(cmd[a])`), "없음", "없음", ex("\"회전\" 은 키가 아니라 not in 이 True")],
          ],
        },
        {
          stars: 2, q: "알맞은 것을 고르시오.",
          items: [
            ["(1)", "딕셔너리에 대한 설명으로 옳은 것은?", "키는 중복될 수 없다", null, ch(["키는 중복될 수 없다", "값은 중복될 수 없다", "d[0] 으로 첫 번째 값을 꺼낸다", "대괄호 [ ] 로 만든다"], "딕셔너리는 중괄호 { 키: 값 } 로 만들고, 키로 값을 찾아요. 키만 중복 불가, 값은 중복 가능")],
            ["(2)", "<code>d = {\"a\": 1}</code> 일 때 <code>print(d[\"b\"])</code> 의 결과는?", "오류(KeyError)", null, ch(["오류(KeyError)", "None", "0", "b"], "없는 키를 꺼내면 KeyError. get 을 쓰거나 in 으로 먼저 확인")],
            ["(3)", "입력받은 <code>action</code> 이 딕셔너리 <code>commands</code> 에 <b>없을 때</b>의 조건은?", "action not in commands", null, ch(["action not in commands", "action in commands", "commands not in action", "action != commands"], "키가 없는지는 not in")],
            ["(4)", "딕셔너리 <code>morse</code> 에서 알파벳 <code>letter</code> 의 모스 부호를 꺼내는 것은?", "morse[letter]", null, ch(["morse[letter]", "morse(letter)", "letter[morse]", "morse.letter"], "값 호출은 딕셔너리[키]")],
          ].map((x) => (x[3] = [x[2]], x)),
        },
      ],
    },

    // ───────────────────────────── 7 반복문 집중
    {
      id: "7",
      title: "반복문 집중",
      sub: "for · range · while · break · continue",
      concept: `
<h3>for — 횟수가 정해진 반복</h3>
<table class="ctable"><tr><th>range(5)</th><td>0, 1, 2, 3, 4 (5개, 5는 안 들어감)</td></tr>
<tr><th>range(1, 5)</th><td>1, 2, 3, 4</td></tr>
<tr><th>range(2, 11, 2)</th><td>2, 4, 6, 8, 10 (2씩)</td></tr>
<tr><th>range(5, 0, -1)</th><td>5, 4, 3, 2, 1 (거꾸로)</td></tr></table>
<p><code>for x in 리스트:</code> 는 리스트 값을 하나씩 꺼내요.</p>
<h3>while — 조건이 참인 동안 반복</h3>
<p>조건에 쓰인 값이 반복 안에서 <b>반드시 바뀌어야</b> 해요. 안 바뀌면 <b>무한 반복</b>!</p>
<div class="formula">mistake = 0<br>while mistake &lt; 3:  ← 3번 틀리면 끝<br>&nbsp;&nbsp;&nbsp;&nbsp;… 틀리면 mistake += 1</div>
<h3>break · continue</h3>
<ul><li><b>break</b>: 반복문을 <b>즉시 끝냄</b> ("성공하면 반복을 즉시 종료")</li>
<li><b>continue</b>: 이번 회차의 남은 부분을 건너뛰고 <b>다음 회차로</b></li></ul>
<div class="tip">💡 for 는 "몇 번"이 정해졌을 때, while 은 "언제까지(조건)"일 때. 둘 다 if 와 함께 자주 써요.</div>`,
      groups: [
        {
          stars: 1, q: out,
          items: [
            ["(1)", code(`for i in range(5):\n    print(i, end="")`), "01234", "01234", ex("range(5) 는 0부터 4까지")],
            ["(2)", code(`for i in range(1, 5):\n    print(i, end="")`), "1234", "1234", ex("1부터 5 앞까지")],
            ["(3)", code(`s = 0\nfor i in range(2, 11, 2):\n    s += i\nprint(s)`), "30", "30", ex("2+4+6+8+10 = 30")],
            ["(4)", code(`for i in range(5, 0, -1):\n    print(i, end="")`), "54321", "54321", ex("-1 씩 줄며 0 앞(1)까지")],
            ["(5)", code(`n = 1\nwhile n < 20:\n    n *= 2\nprint(n)`), "32", "32", ex("1→2→4→8→16→32. 32 < 20 이 거짓이 되어 멈춤")],
          ],
        },
        {
          stars: 2, q: out,
          items: [
            ["(1)", code(`for i in range(10):\n    if i == 4:\n        break\n    print(i, end="")`), "0123", "0123", ex("i 가 4 가 되는 순간 반복을 즉시 끝내요(4는 출력 안 됨)")],
            ["(2)", code(`for i in range(6):\n    if i % 2 == 0:\n        continue\n    print(i, end="")`), "135", "135", ex("짝수면 continue 로 출력을 건너뛰어요")],
            ["(3)", code(`cnt = 0\nfor i in range(1, 21):\n    if i % 3 == 0:\n        cnt += 1\nprint(cnt)`), "6", "6", ex("3,6,9,12,15,18 → 6개")],
            ["(4)", code(`m = 0\nwhile m < 3:\n    m += 1\n    print(m, end="")`), "123", "123", ex("m 이 1,2,3 이 되며 출력, 3 < 3 이 거짓이 되어 끝")],
            ["(5)", code(`for i in range(2):\n    for j in range(3):\n        print(i * j, end="")`), "000012", "000012", ex("i=0: 0 0 0, i=1: 0 1 2")],
            ["(6)", code(`n = 10\ncnt = 0\nwhile True:\n    n -= 3\n    cnt += 1\n    if n < 0:\n        break\nprint(cnt, n)`), "4 -2", "4 -2", ex("10→7→4→1→-2 (4번), -2 < 0 이라 break")],
          ],
        },
        {
          stars: 2, q: "알맞은 것을 고르시오.",
          items: [
            ["(1)", "<code>range(1, 10)</code> 이 만드는 수의 개수는?", "9개", null, ch(["9개", "10개", "11개", "8개"], "1~9 → 끝 숫자 10은 들어가지 않아요")],
            ["(2)", "반복을 <b>즉시 끝내는</b> 명령은?", "break", null, ch(["break", "continue", "pass", "return"], "continue 는 이번 회차만 건너뛰고 다음 회차로 가요")],
            ["(3)", "while 문에서 <b>무한 반복</b>이 생기는 이유로 알맞은 것은?", "조건에 쓰인 변수가 반복 안에서 바뀌지 않아서", null, ch(["조건에 쓰인 변수가 반복 안에서 바뀌지 않아서", "들여쓰기를 4칸 해서", "break 를 썼기 때문에", "range 를 쓰지 않아서"], "while 조건이 언젠가는 거짓이 되도록 변수가 바뀌어야 해요")],
            ["(4)", "반복 횟수가 정해져 있을 때 주로 쓰는 것은?", "for", null, ch(["for", "while", "if", "def"], "for 는 횟수, while 은 조건")],
          ].map((x) => (x[3] = [x[2]], x)),
        },
      ],
    },

    // ───────────────────────────── 8 함수 심화
    {
      id: "8",
      title: "함수 · 재귀",
      sub: "정의·호출 · 매개변수/인자/반환값 · 장단점 · 재귀함수",
      concept: `
<h3>함수 정의 · 호출</h3>
<div class="formula">def 함수이름(매개변수):<br>&nbsp;&nbsp;&nbsp;&nbsp;할 일<br>&nbsp;&nbsp;&nbsp;&nbsp;return 돌려줄 값<br><br>결과 = 함수이름(인자)</div>
<ul><li><b>매개변수</b>: 함수를 <b>만들 때</b> 괄호 안에 쓰는 변수 (def add(<b>a, b</b>))</li>
<li><b>인자(인수)</b>: 함수를 <b>부를 때</b> 넘기는 값 (add(<b>3, 5</b>))</li>
<li><b>반환값</b>: return 으로 돌려주는 값. return 이 없으면 None</li>
<li>함수는 <b>호출해야</b> 실행돼요. 정의만 하면 아무 일도 안 일어나요.</li></ul>
<h3>함수의 장점 · 단점 (시험 단골)</h3>
<table class="ctable"><tr><th>장점</th><td>코드가 줄어든다 · 영역이 작아 오류를 찾기 쉽다 · 같은 내용을 다시 작성하지 않아도 된다(재사용)</td></tr>
<tr><th>단점</th><td>실행 속도가 대체로 느려진다 · 메모리 사용량이 늘어난다 · 매개변수/반환값이 많아지면 부담이 커진다</td></tr></table>
<h3>재귀함수</h3>
<p>함수 안에서 <b>자기 자신을 다시 호출</b>하는 함수. 큰 문제를 <b>더 작은 같은 문제</b>로 쪼개서 풀어요.</p>
<ul><li><b>종료 조건이 꼭 있어야</b> 해요 (더 이상 자신을 호출하지 않고 값을 바로 돌려주는 경우). 없으면 끝나지 않아요.</li>
<li>코드가 짧고 이해하기 쉬워지지만, 호출할 때마다 메모리가 쌓여 느리고 메모리를 많이 써요.</li></ul>
<div class="formula">def fact(n):<br>&nbsp;&nbsp;&nbsp;&nbsp;if n == 1: return 1  ← 종료 조건<br>&nbsp;&nbsp;&nbsp;&nbsp;return n * fact(n-1)  ← 자기 자신 호출</div>`,
      groups: [
        {
          stars: 1, q: out,
          items: [
            ["(1)", code(`def f(x):\n    return x * 2\n\nprint(f(3) + 1)`), "7", "7", ex("f(3) = 6, 6 + 1 = 7")],
            ["(2)", code(`def hello():\n    print("hi", end="")\n\nhello()\nhello()`), "hihi", "hihi", ex("호출할 때마다 실행돼요 (2번 호출)")],
            ["(3)", code(`def add(a, b):\n    return a + b\n\nr = add(add(1, 2), 3)\nprint(r)`), "6", "6", ex("안쪽부터: add(1,2)=3 → add(3,3)=6")],
            ["(4)", code(`def f():\n    x = 1\n\nprint(f())`), "None", "None", ex("return 이 없으면 함수는 None 을 돌려줘요")],
          ],
        },
        {
          stars: 3, q: out,
          items: [
            ["(1)", code(`def f(x):\n    print(x, end="")\n    return x + 1\n\ny = f(1)\nprint(y)`), "12", "12", ex("함수 안의 print 로 1, 돌려받은 2 를 print → 12")],
            ["(2)", code(`def s(n):\n    if n == 0:\n        return 0\n    return n + s(n - 1)\n\nprint(s(4))`), "10", "10", ex("s(4)=4+s(3)=4+3+s(2)=… = 4+3+2+1+0 = 10. 종료 조건은 n==0")],
            ["(3)", code(`def fib(n):\n    if n <= 2:\n        return 1\n    return fib(n - 1) + fib(n - 2)\n\nprint(fib(6))`), "8", "8", ex("1,1,2,3,5,8 → 6번째는 8")],
            ["(4)", code(`def down(n):\n    if n == 0:\n        return\n    print(n, end="")\n    down(n - 1)\n\ndown(3)`), "321", "321", ex("3 출력 → down(2) → 2 출력 → down(1) → 1 출력 → down(0) 에서 멈춤")],
            ["(5)", code(`def fact(n):\n    if n == 1:\n        return 1\n    return n * fact(n - 1)\n\nprint(fact(4))`), "24", "24", ex("4×3×2×1 = 24")],
          ],
        },
        {
          stars: 2, q: "알맞은 것을 고르시오.",
          items: [
            ["(1)", "<code>def add(a, b):</code> 에서 a, b 를 부르는 말은?", "매개변수", null, ch(["매개변수", "인자", "반환값", "지역 상수"], "만들 때 괄호 안 = 매개변수, 부를 때 넘기는 값 = 인자")],
            ["(2)", "<code>add(3, 5)</code> 에서 3, 5 를 부르는 말은?", "인자", null, ch(["인자", "매개변수", "반환값", "키"], "호출할 때 넘기는 값")],
            ["(3)", "함수의 <b>단점</b>으로 알맞은 것은?", "프로그램 실행 속도가 대체로 느려진다", null, ch(["프로그램 실행 속도가 대체로 느려진다", "코드가 길어진다", "오류를 찾기 어려워진다", "같은 코드를 여러 번 써야 한다"], "단점: 속도 느려짐 · 메모리 사용량 증가 · 매개변수/반환값이 많으면 부담. 나머지 셋은 오히려 장점의 반대")],
            ["(4)", "함수의 <b>장점</b>이 아닌 것은?", "메모리 사용량이 줄어든다", null, ch(["메모리 사용량이 줄어든다", "코드가 줄어든다", "오류가 났을 때 찾기 쉽다", "같은 내용을 다시 작성하지 않아도 된다"], "함수를 쓰면 메모리 사용량은 오히려 늘어나요(단점)")],
            ["(5)", "재귀함수에 대한 설명으로 옳지 <b>않은</b> 것은?", "종료 조건이 없어도 된다", null, ch(["종료 조건이 없어도 된다", "자기 자신을 다시 호출한다", "큰 문제를 같은 형태의 작은 문제로 쪼갠다", "호출할 때마다 메모리가 쌓인다"], "종료 조건이 없으면 끝없이 호출되다 오류가 나요")],
          ].map((x) => (x[3] = [x[2]], x)),
        },
      ],
    },

    // ───────────────────────────── 9 시험범위 총정리
    {
      id: "9",
      title: "시험범위 총정리",
      sub: "변수명 규칙 · 자료형 · 연산자 우선순위 · 비교/논리 · 조건문",
      concept: `
<h3>변수명 규칙</h3>
<ul><li>영문자·숫자·밑줄(_)로 만들고, <b>숫자로 시작할 수 없어요</b> (2num ✕)</li>
<li>공백·특수문자(-, @ 등) ✕ — 밑줄(_)만 가능 (my_name ○, my-name ✕)</li>
<li><b>예약어</b>(if, for, while, def, print 같은 파이썬 단어)는 안 돼요</li>
<li><b>대소문자를 구분</b>해요 (Score 와 score 는 다른 변수)</li></ul>
<h3>기본 자료형</h3>
<table class="ctable"><tr><th>int</th><td>정수 3, -7</td></tr><tr><th>float</th><td>실수 3.0, 2.5 (정수와 실수를 계산하면 실수)</td></tr>
<tr><th>str</th><td>문자열 "3", "A" — input() 은 항상 문자열 → 숫자는 int(input())</td></tr><tr><th>bool</th><td>True / False</td></tr></table>
<h3>연산자와 우선순위</h3>
<div class="formula">** (거듭제곱) → * / // % → + −<br>/ 나눗셈(항상 실수) · // 몫 · % 나머지</div>
<p>비교: &lt; &gt; &lt;= &gt;= == (같다) != (다르다) — <b>= 는 넣기(대입), == 는 비교</b></p>
<p>논리: and (모두 참일 때만 True) · or (하나라도 참이면 True) · not (반대로)</p>
<h3>조건문</h3>
<p>if → elif → else 순서로 <b>위에서부터</b> 검사하고, 처음 참인 곳 하나만 실행해요. 조건식 뒤에 <b>콜론(:)</b>, 실행 문장은 <b>4칸 들여쓰기</b>.</p>`,
      groups: [
        {
          stars: 1, q: "알맞은 것을 고르시오.",
          items: [
            ["(1)", "변수 이름으로 쓸 수 <b>있는</b> 것은?", "_score", null, ch(["_score", "2num", "my-name", "for"], "숫자로 시작 ✕, 하이픈 ✕, 예약어(for) ✕. 밑줄로 시작은 ○")],
            ["(2)", "변수 이름으로 쓸 수 <b>없는</b> 것은?", "my name", null, ch(["my name", "myName", "my_name", "name2"], "공백은 쓸 수 없어요")],
            ["(3)", "<code>type(3.0)</code> 의 자료형은?", "float", null, ch(["float", "int", "str", "bool"], "소수점이 있으면 실수(float)")],
            ["(4)", "<code>x = input()</code> 으로 7 을 입력했을 때 x 의 자료형은?", "str", null, ch(["str", "int", "float", "bool"], "input() 은 항상 문자열. 숫자로 쓰려면 int(input())")],
            ["(5)", "두 값이 <b>같은지</b> 비교하는 연산자는?", "==", null, ch(["==", "=", "!=", "=>"], "= 는 값을 넣는 대입, == 는 같은지 비교")],
          ].map((x) => (x[3] = [x[2]], x)),
        },
        {
          stars: 2, q: out,
          items: [
            ["(1)", code(`print(7 / 2, 7 // 2, 7 % 2)`), "3.5 3 1", "3.5 3 1", ex("/ 는 실수 나눗셈, // 몫, % 나머지")],
            ["(2)", code(`print(2 + 3 * 4 ** 2)`), "50", "50", ex("** 먼저: 4**2=16 → 3*16=48 → 2+48=50")],
            ["(3)", code(`print(int("7") + 1, 3 + 2.0)`), "8 5.0", "8 5.0", ex("int(\"7\")=7 → 8. 정수+실수는 실수 5.0")],
            ["(4)", code(`a = 5\nprint(a > 3 and a < 4, a > 3 or a < 4, not a > 3)`), "False True False", "False True False", ex("and 는 둘 다 참이어야, or 는 하나만 참이어도, not 은 반대")],
            ["(5)", code(`print(10 != 10, 3 >= 3)`), "False True", "False True", ex("10 != 10 은 \"다르다\"가 거짓, 3 >= 3 은 \"이상\"이라 참")],
            ["(6)", code(`score = 85\nif score >= 90:\n    print("A")\nelif score >= 80:\n    print("B")\nelse:\n    print("C")`), "B", "B", ex("위에서부터: 85>=90 거짓 → 85>=80 참 → B, 아래는 검사 안 함")],
            ["(7)", code(`x = 15\nif x % 3 == 0 and x % 5 == 0:\n    print("둘 다")\nelif x % 3 == 0:\n    print("3의 배수")\nelse:\n    print("아님")`), "둘 다", "둘 다", ex("15 는 3과 5로 모두 나누어떨어져요")],
            ["(8)", code(`a = "3"\nb = "4"\nprint(a + b, int(a) + int(b))`), "34 7", "34 7", ex("문자열끼리 + 는 이어 붙이기, int 로 바꾸면 덧셈")],
          ],
        },
      ],
    },

    // ───────────────────────────── 10 서술형 실전 (딕셔너리 + while + 횟수 세기)
    {
      id: "10",
      title: "서술형 실전 · 딕셔너리 + while",
      sub: "모스 부호 · 로봇 명령 (연습문제) · 비슷한 문제 · 빈칸 채우기 — 직접 코드 쓰고 자동 채점",
      concept: `
<h3>연습문제 공통 구조 (이것만 외우면 끝!)</h3>
<div class="formula">1. 딕셔너리 만들기 &nbsp;→ <code>morse = {"A": ".-", …}</code><br>
2. 키 입력받기 &nbsp;→ <code>letter = input()</code><br>
3. 없으면 메시지 출력 후 끝 &nbsp;→ <code>if letter not in morse:</code> → print / <b>else:</b><br>
4. 틀린 횟수 0 으로 &nbsp;→ <code>mistake = 0</code><br>
5. 3회 미만인 동안 반복 &nbsp;→ <code>while mistake &lt; 3:</code> (그 안에서 input)<br>
6. 같으면 성공 출력 + <b>break</b> &nbsp;→ <code>if sign == morse[letter]:</code><br>
7. 다르면 1 증가 + 횟수 출력 &nbsp;→ <code>mistake += 1</code> / <code>print(f"…({mistake}/3)")</code><br>
8. 반복이 끝난 뒤 3 이상이면 메시지 &nbsp;→ <code>if mistake &gt;= 3:</code> (while 과 같은 들여쓰기)</div>
<ul><li><b>횟수 출력</b>: 문자 mistake 가 아니라 숫자가 나와야 해요 → <code>f"잘못된 부호입니다.({mistake}/3)"</code> 또는 <code>"잘못된 부호입니다.(" + str(mistake) + "/3)"</code></li>
<li><b>"프로그램을 종료한다"</b>는 else 로 나머지를 감싸거나, 함수 안이면 return, 그 밖엔 <code>exit()</code>.</li>
<li>8번 if 는 while <b>밖</b>(같은 들여쓰기)! 안에 넣으면 매번 검사돼요.</li>
<li>출력 문구는 <b>마침표·느낌표·괄호까지</b> 문제와 똑같이.</li></ul>
<div class="tip">💡 아래 문제는 앱에서 바로 실행돼요. 코드를 쓰고 ▶ 실행으로 확인, ✅ 채점으로 여러 입력을 한꺼번에 검사해요.</div>`,
      groups: [
        {
          stars: 3, src: "2026 2학기 프로그래밍 연습문제",
          q: `<b>[문제]</b> 알파벳을 모스 부호로 바꿔 보내는 연습 프로그램을 만드시오.<br>
1. 알파벳을 key, 모스 부호를 value 로 하는 딕셔너리 morse: A ".-", B "-...", E ".", O "---", S "..."<br>
2. 보낼 알파벳을 입력받아 letter 에 저장한다.<br>
3. letter 가 morse 에 없으면 "등록되지 않은 글자입니다." 를 출력하고 종료한다.<br>
4. 있으면 잘못 보낸 횟수 mistake 를 0 으로 초기화한다.<br>
5. 잘못 보낸 횟수가 3회 미만인 동안 모스 부호를 반복해서 입력받는다.<br>
6. 해당 알파벳의 모스 부호와 같으면 "전송 성공!" 을 출력하고 반복을 즉시 종료한다.<br>
7. 다르면 mistake 를 1 증가시키고 "잘못된 부호입니다.(mistake/3)" 을 출력한다. (mistake 자리에는 횟수)<br>
8. 반복이 끝난 뒤 잘못 보낸 횟수가 3 이상이면 "부호표를 다시 확인하세요." 를 출력한다.`,
          items: [
            task("코드 작성", "", `
morse = {"A": ".-", "B": "-...", "E": ".", "O": "---", "S": "..."}
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
        print("부호표를 다시 확인하세요.")`, [
              { label: "한 번에 성공", input: "A\n.-", out: "전송 성공!" },
              { label: "없는 글자", input: "Z", out: "등록되지 않은 글자입니다." },
              { label: "한 번 틀리고 성공", input: "E\n..\n.", out: "잘못된 부호입니다.(1/3)\n전송 성공!" },
              { label: "세 번 모두 틀림", input: "B\n-\n--\n---", out: "잘못된 부호입니다.(1/3)\n잘못된 부호입니다.(2/3)\n잘못된 부호입니다.(3/3)\n부호표를 다시 확인하세요." },
              { label: "두 번 틀리고 성공", input: "S\n.\n..\n...", out: "잘못된 부호입니다.(1/3)\n잘못된 부호입니다.(2/3)\n전송 성공!" },
            ], `
# 1. 딕셔너리 morse 만들기
morse = {"A": ".-", }

# 2. 알파벳 입력받기
letter = input("보낼 알파벳: ")

# 3 ~ 8 을 이어서 써 보세요
`, "8단계를 그대로 코드로 옮기면 돼요. 3단계는 not in 과 else, 5단계는 while mistake < 3, 6단계는 break, 7단계는 f-문자열로 횟수 출력, 8단계 if 는 while 과 같은 들여쓰기(반복이 끝난 뒤)."),
          ],
        },
        {
          stars: 3, src: "2026 2학기 프로그래밍 연습문제",
          q: `<b>[문제]</b> 동작 이름에 맞는 영어 명령어를 입력해 로봇을 움직이는 프로그램을 만드시오.<br>
1. 동작 이름을 key, 영어 명령어를 value 로 하는 딕셔너리 commands: 전진 "forward", 후진 "back", 회전 "turn", 정지 "stop"<br>
2. 시킬 동작 이름을 입력받아 action 에 저장한다.<br>
3. action 이 commands 에 없으면 "지원하지 않는 동작입니다." 를 출력하고 종료한다.<br>
4. 있으면 잘못 입력한 횟수 error 를 0 으로 초기화한다.<br>
5. 잘못 입력한 횟수가 3회 미만인 동안 명령어를 반복해서 입력받는다.<br>
6. 해당 동작의 명령어와 같으면 "로봇이 움직입니다!" 를 출력하고 반복을 즉시 종료한다.<br>
7. 다르면 error 를 1 증가시키고 "명령어 오류(error/3)" 를 출력한다. (error 자리에는 횟수)<br>
8. 반복이 끝난 뒤 잘못 입력한 횟수가 3 이상이면 "대기 모드로 전환합니다." 를 출력한다.`,
          items: [
            task("코드 작성", "", `
commands = {"전진": "forward", "후진": "back", "회전": "turn", "정지": "stop"}
action = input("동작 이름: ")
if action not in commands:
    print("지원하지 않는 동작입니다.")
else:
    error = 0
    while error < 3:
        cmd = input("명령어: ")
        if cmd == commands[action]:
            print("로봇이 움직입니다!")
            break
        else:
            error += 1
            print(f"명령어 오류({error}/3)")
    if error >= 3:
        print("대기 모드로 전환합니다.")`, [
              { label: "한 번에 성공", input: "전진\nforward", out: "로봇이 움직입니다!" },
              { label: "없는 동작", input: "점프", out: "지원하지 않는 동작입니다." },
              { label: "한 번 틀리고 성공", input: "정지\nStop\nstop", out: "명령어 오류(1/3)\n로봇이 움직입니다!" },
              { label: "세 번 모두 틀림", input: "회전\nleft\nright\nspin", out: "명령어 오류(1/3)\n명령어 오류(2/3)\n명령어 오류(3/3)\n대기 모드로 전환합니다." },
            ], `
commands = {"전진": "forward", }
action = input("동작 이름: ")

# 3 ~ 8 을 이어서 써 보세요
`, "모스 부호 문제와 똑같은 구조예요: 딕셔너리 → 입력 → not in 이면 종료 → error = 0 → while error < 3 → 같으면 출력 후 break → 다르면 error += 1, 횟수 출력 → 반복 뒤 if error >= 3."),
          ],
        },
        {
          stars: 2, q: "모스 부호 프로그램의 빈칸을 채우시오.",
          items: [
            ["(1)", code(`letter = input()\nif letter ______ morse:\n    print("등록되지 않은 글자입니다.")`), "not in", ["not in", "notin"], ex("딕셔너리에 키가 없는지 → not in")],
            ["(2)", code(`mistake = 0\nwhile ______:\n    sign = input()`), "mistake < 3", ["mistake < 3", "mistake<3", "3 > mistake"], ex("잘못 보낸 횟수가 3회 미만인 동안")],
            ["(3)", code(`if sign == morse[______]:\n    print("전송 성공!")`), "letter", "letter", ex("입력받은 알파벳(키)으로 모스 부호(값)를 꺼내요")],
            ["(4)", code(`    print("전송 성공!")\n    ______`), "break", "break", ex("반복을 즉시 종료")],
            ["(5)", code(`else:\n    mistake ______ 1`), "+=", ["+=", "= mistake +"], ex("1 증가: mistake += 1 (= mistake = mistake + 1)")],
            ["(6)", code(`print(f"잘못된 부호입니다.({______}/3)")`), "mistake", "mistake", ex("f-문자열의 중괄호 안에 변수를 넣으면 그 값(횟수)이 나와요")],
            ["(7)", code(`# 반복이 끝난 뒤\nif mistake ______ 3:\n    print("부호표를 다시 확인하세요.")`), ">=", [">=", "== 3"], ex("3 이상이면 → >= (이 문제에선 == 3 도 같은 뜻)")],
            ["(8)", "7번 문장을 f-문자열 없이 쓰면 <code>print(\"잘못된 부호입니다.(\" + ______ + \"/3)\")</code>", "str(mistake)", ["str(mistake)"], ex("문자열과 숫자는 바로 + 할 수 없어서 str() 로 바꿔요")],
          ],
        },
        {
          stars: 2, q: "로봇 명령 프로그램에 다음과 같이 입력했을 때 출력을 고르시오.",
          items: [
            ["(1)", "입력: <code>후진</code> → <code>back</code>", "로봇이 움직입니다!", null, ch(["로봇이 움직입니다!", "명령어 오류(1/3)", "지원하지 않는 동작입니다.", "대기 모드로 전환합니다."], "한 번에 맞혔어요")],
            ["(2)", "입력: <code>점프</code>", "지원하지 않는 동작입니다.", null, ch(["지원하지 않는 동작입니다.", "명령어 오류(1/3)", "로봇이 움직입니다!", "아무것도 출력되지 않는다"], "점프는 키가 아니라 바로 종료")],
            ["(3)", "입력: <code>회전</code> → <code>Turn</code> → <code>turn</code> 일 때 출력되는 줄 수는?", "2줄", null, ch(["2줄", "1줄", "3줄", "4줄"], "Turn 은 대문자라 다름 → 명령어 오류(1/3), turn 이 맞아 → 로봇이 움직입니다! (2줄)")],
            ["(4)", "8단계의 <code>if error >= 3:</code> 를 while <b>안</b>에 넣으면 생기는 문제는?", "반복할 때마다 검사해서 흐름이 바뀐다", null, ch(["반복할 때마다 검사해서 흐름이 바뀐다", "아무 차이 없다", "문법 오류가 난다", "딕셔너리를 읽을 수 없다"], "반복이 끝난 뒤 한 번만 검사해야 하니 while 과 같은 들여쓰기에 둬요")],
          ].map((x) => (x[3] = [x[2]], x)),
        },
        {
          stars: 3, src: "비슷한 문제 (연습)",
          q: `<b>[문제]</b> 아이디와 비밀번호로 로그인하는 프로그램을 만드시오.<br>
1. 아이디를 key, 비밀번호를 value 로 하는 딕셔너리 accounts: "kim" "1234", "lee" "abcd", "park" "0000"<br>
2. 아이디를 입력받아 user 에 저장한다. accounts 에 없으면 "없는 아이디입니다." 를 출력하고 종료한다.<br>
3. 있으면 틀린 횟수 fail 을 0 으로 초기화하고, 3회 미만인 동안 비밀번호를 반복해서 입력받는다.<br>
4. 맞으면 "로그인 성공!" 을 출력하고 반복을 즉시 종료한다. 틀리면 fail 을 1 증가시키고 "비밀번호가 틀렸습니다.(fail/3)" 을 출력한다.<br>
5. 반복이 끝난 뒤 틀린 횟수가 3 이상이면 "계정이 잠겼습니다." 를 출력한다.`,
          items: [
            task("코드 작성", "", `
accounts = {"kim": "1234", "lee": "abcd", "park": "0000"}
user = input("아이디: ")
if user not in accounts:
    print("없는 아이디입니다.")
else:
    fail = 0
    while fail < 3:
        pw = input("비밀번호: ")
        if pw == accounts[user]:
            print("로그인 성공!")
            break
        else:
            fail += 1
            print(f"비밀번호가 틀렸습니다.({fail}/3)")
    if fail >= 3:
        print("계정이 잠겼습니다.")`, [
              { label: "성공", input: "lee\nabcd", out: "로그인 성공!" },
              { label: "없는 아이디", input: "choi", out: "없는 아이디입니다." },
              { label: "잠김", input: "kim\n1111\n2222\n3333", out: "비밀번호가 틀렸습니다.(1/3)\n비밀번호가 틀렸습니다.(2/3)\n비밀번호가 틀렸습니다.(3/3)\n계정이 잠겼습니다." },
              { label: "두 번째에 성공", input: "park\n000\n0000", out: "비밀번호가 틀렸습니다.(1/3)\n로그인 성공!" },
            ], `accounts = {"kim": "1234", "lee": "abcd", "park": "0000"}\n`, "연습문제와 같은 8단계 구조예요. 비밀번호는 문자열이라 \"1234\" 처럼 따옴표로 비교해요."),
          ],
        },
        {
          stars: 3, src: "비슷한 문제 (연습)",
          q: `<b>[문제]</b> 영어 단어 퀴즈 프로그램을 만드시오.<br>
1. 우리말을 key, 영어를 value 로 하는 딕셔너리 words: "사과" "apple", "책" "book", "학교" "school", "물" "water"<br>
2. 문제로 낼 우리말을 입력받아 q 에 저장한다. words 에 없으면 "단어장에 없는 단어입니다." 를 출력하고 종료한다.<br>
3. 있으면 기회 chance 를 3 으로 정하고, chance 가 0 보다 큰 동안 영어 답을 반복해서 입력받는다.<br>
4. 맞으면 "정답입니다!" 를 출력하고 반복을 즉시 종료한다. 틀리면 chance 를 1 줄이고 "틀렸습니다. 남은 기회 chance번" 을 출력한다.<br>
5. 반복이 끝난 뒤 chance 가 0 이면 "정답은 (영어 단어)입니다." 를 출력한다. (예: 정답은 apple입니다.)`,
          items: [
            task("코드 작성", "", `
words = {"사과": "apple", "책": "book", "학교": "school", "물": "water"}
q = input("우리말: ")
if q not in words:
    print("단어장에 없는 단어입니다.")
else:
    chance = 3
    while chance > 0:
        ans = input("영어: ")
        if ans == words[q]:
            print("정답입니다!")
            break
        else:
            chance -= 1
            print(f"틀렸습니다. 남은 기회 {chance}번")
    if chance == 0:
        print(f"정답은 {words[q]}입니다.")`, [
              { label: "정답", input: "책\nbook", out: "정답입니다!" },
              { label: "없는 단어", input: "연필", out: "단어장에 없는 단어입니다." },
              { label: "기회 다 씀", input: "물\nwatr\nwather\nwat", out: "틀렸습니다. 남은 기회 2번\n틀렸습니다. 남은 기회 1번\n틀렸습니다. 남은 기회 0번\n정답은 water입니다." },
            ], `words = {"사과": "apple", "책": "book", "학교": "school", "물": "water"}\n`, "이번엔 횟수를 늘리는 대신 줄여요(chance -= 1, while chance > 0). 마지막엔 딕셔너리 값 words[q] 를 f-문자열로 출력해요."),
          ],
        },
        {
          stars: 3, src: "비슷한 문제 (연습)",
          q: `<b>[문제]</b> 자판기 프로그램을 만드시오.<br>
1. 음료 이름을 key, 가격을 value 로 하는 딕셔너리 menu: "콜라" 1200, "사이다" 1000, "물" 700<br>
2. 음료 이름을 입력받아 drink 에 저장한다. menu 에 없으면 "없는 메뉴입니다." 를 출력하고 종료한다.<br>
3. 있으면 넣은 돈 total 을 0 으로, 넣은 횟수 count 를 0 으로 정한다.<br>
4. count 가 3 미만인 동안 돈을 정수로 입력받아 total 에 더하고 count 를 1 늘린다.<br>
5. total 이 가격 이상이면 "(음료) 나왔습니다. 거스름돈 (total-가격)원" 을 출력하고 반복을 즉시 종료한다. 모자라면 "금액이 부족합니다.(total/가격)" 을 출력한다.<br>
6. 반복이 끝난 뒤 total 이 가격보다 작으면 "total원을 돌려드립니다." 를 출력한다.`,
          items: [
            task("코드 작성", "", `
menu = {"콜라": 1200, "사이다": 1000, "물": 700}
drink = input("음료: ")
if drink not in menu:
    print("없는 메뉴입니다.")
else:
    price = menu[drink]
    total = 0
    count = 0
    while count < 3:
        total += int(input("돈: "))
        count += 1
        if total >= price:
            print(f"{drink} 나왔습니다. 거스름돈 {total - price}원")
            break
        else:
            print(f"금액이 부족합니다.({total}/{price})")
    if total < price:
        print(f"{total}원을 돌려드립니다.")`, [
              { label: "한 번에", input: "물\n1000", out: "물 나왔습니다. 거스름돈 300원" },
              { label: "없는 메뉴", input: "커피", out: "없는 메뉴입니다." },
              { label: "나눠서 넣기", input: "콜라\n500\n500\n500", out: "금액이 부족합니다.(500/1200)\n금액이 부족합니다.(1000/1200)\n콜라 나왔습니다. 거스름돈 300원" },
              { label: "끝까지 모자람", input: "사이다\n100\n200\n300", out: "금액이 부족합니다.(100/1000)\n금액이 부족합니다.(300/1000)\n금액이 부족합니다.(600/1000)\n600원을 돌려드립니다." },
            ], `menu = {"콜라": 1200, "사이다": 1000, "물": 700}\n`, "돈은 숫자라 int(input()). 가격은 menu[drink] 로 꺼내 price 에 두면 편해요. 반복 뒤 if 는 total < price."),
          ],
        },
        {
          stars: 2, src: "함수 · 리스트 연습",
          q: `<b>[문제]</b> 점수 리스트를 받아 평균(소수점 아래 버림, // 사용)을 돌려주는 함수 <code>avg(scores)</code> 를 만들고,
점수 3개를 한 줄씩 입력받아 리스트에 append 한 뒤 "평균: (값)" 을 출력하시오. 평균이 80 이상이면 다음 줄에 "합격" 을, 아니면 "불합격" 을 출력하시오.`,
          items: [
            task("코드 작성", "", `
def avg(scores):
    total = 0
    for s in scores:
        total += s
    return total // len(scores)

scores = []
for i in range(3):
    scores.append(int(input("점수: ")))
a = avg(scores)
print(f"평균: {a}")
if a >= 80:
    print("합격")
else:
    print("불합격")`, [
              { label: "합격", input: "90\n80\n75", out: "평균: 81\n합격" },
              { label: "불합격", input: "70\n60\n100", out: "평균: 76\n불합격" },
              { label: "딱 80", input: "80\n80\n80", out: "평균: 80\n합격" },
            ], `def avg(scores):\n    # 합을 구해서 개수로 나눠 돌려주기 (//)\n    \n\nscores = []\n`, "함수 안에서 for 로 합을 구하고 return total // len(scores). 함수 밖에서 range(3) 반복으로 append, 그다음 avg 를 호출해요."),
          ],
        },
      ],
    },
  ]);
})();
