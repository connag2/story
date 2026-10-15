# 사용법: python3 scripts/gen-programming-3.py data/programming-3.js
# data/programming-3.js 생성기 — 모든 코드를 실제로 실행해서 정답을 뽑는다
import io, json, contextlib, html, textwrap, sys

C = "①②③④⑤"
J = lambda v: json.dumps(v, ensure_ascii=False)


def run(code, inp=""):
    lines = iter(inp.split("\n")) if inp else iter([])
    buf = io.StringIO()
    g = {"input": lambda prompt="": next(lines)}
    with contextlib.redirect_stdout(buf):
        exec(textwrap.dedent(code).strip("\n"), g)
    return buf.getvalue()


def norm(t):
    return "\n".join(l.rstrip() for l in t.replace("\r", "").split("\n") if l.rstrip() != "")


def pre(code):
    return '<pre class="code">' + html.escape(textwrap.dedent(code).strip("\n"), quote=False) + "</pre>"


def flat(out):
    return " ".join(norm(out).split("\n"))


# ── 문항 만들기 ──
def mc(no, q, choices, a, explain, code=None, steps=None):
    """5지 선다. a: 정답 번호(0~4) 또는 None(코드 실행 결과와 같은 선택지를 정답으로)"""
    if code is not None:
        got = flat(run(code))
        idx = [i for i, c in enumerate(choices) if c == got]
        assert len(idx) == 1, (no, got, choices)
        if a is not None:
            assert a == idx[0], (no, a, idx)
        a = idx[0]
        q = q + pre(code)
    assert a is not None
    cs = [f"{C[i]} {c}" for i, c in enumerate(choices)]
    opt = {"type": "choice", "choices": cs, "explain": explain}
    if steps:
        opt["steps"] = steps
    return [f"{no}.", q, cs[a], [cs[a]], opt]


def trace(label, code, explain, inp=""):
    got = flat(run(code, inp))
    q = pre(code) + (f'<div class="muted small">입력: {html.escape(inp.replace(chr(10), " ⏎ "))}</div>' if inp else "")
    return [label, q, got, [got], {"explain": explain}]


def task(label, q, solution, tests, starter, explain):
    sol = textwrap.dedent(solution).strip("\n")
    for t in tests:
        got = norm(run(sol, t["input"]))
        if "out" in t:
            assert got == norm(t["out"]), (label, t, got)
        t["out"] = got
    return [label, q, pre(sol), None, {"type": "code", "solution": sol, "starter": textwrap.dedent(starter).strip("\n"), "tests": tests, "explain": explain}]


# ═════════════════════════ 실전 모의고사 1회
M1_MC = [
    mc(1, "프로그래밍 언어에 대한 설명으로 옳지 <u>않은</u> 것은?", [
        "컴퓨터가 직접 이해할 수 있는 언어는 0과 1로 이루어진 기계어이다.",
        "파이썬은 사람이 이해하기 쉬운 고급 언어에 속한다.",
        "파이썬은 코드를 한 줄씩 번역하며 실행하는 인터프리터 방식을 쓴다.",
        "고급 언어로 작성한 코드도 실행하려면 기계어로 번역되어야 한다.",
        "파이썬은 들여쓰기를 해도 되고 안 해도 되며, 실행 결과에 영향을 주지 않는다.",
    ], 4, "파이썬에서 들여쓰기는 코드 블록(if, for, def 안쪽)을 나타내는 문법이에요. 들여쓰기가 틀리면 오류가 나거나 결과가 달라져요."),
    mc(2, "변수 이름으로 사용할 수 <u>없는</u> 것은?", ["total_sum", "_count", "score2", "2score", "Name"], 3,
       "변수 이름은 숫자로 시작할 수 없어요. 밑줄(_)로 시작하거나 대문자를 쓰는 건 가능해요."),
    mc(3, "다음 코드의 실행 결과는?", ["<class 'str'>", "<class 'int'>", "<class 'float'>", "<class 'bool'>", "<class 'list'>"], None,
       "\"3.5\"는 따옴표로 감싼 문자열이에요. 숫자처럼 보여도 str.", code='x = "3.5"\nprint(type(x))'),
    mc(4, "다음 코드의 실행 결과는?", ["8", "6", "4.4", "10", "7"], None,
       "// 와 * 는 우선순위가 같아 왼쪽부터: 17//5=3 → 3*2=6, 17%5=2 → 6+2=8", code="print(17 // 5 * 2 + 17 % 5)"),
    mc(5, "다음 코드의 실행 결과는?", ["abababc", "ab3c", "abcabcabc", "ababab c", "오류"], None,
       "문자열 * 정수 → 반복, 문자열 + 문자열 → 이어 붙이기. 띄어쓰기는 생기지 않아요.", code='print("ab" * 3 + "c")'),
    mc(6, "다음 코드의 실행 결과는?", ["True False True", "True True False", "False False True", "False True True", "True False False"], None,
       "a < b < c → 3<5<7 → True / a == 5 or b < a → False or False → False / not (a > b) → not False → True",
       code="a, b, c = 3, 5, 7\nprint(a < b < c, a == 5 or b < a, not (a > b))"),
    mc(7, "다음 코드의 실행 결과는?", ["보통", "좋음", "나쁨", "좋음 보통", "출력 없음"], None,
       "위에서부터 검사: 65>=80 거짓 → 65>=60 참 → '보통' 출력 후 나머지 elif/else 는 건너뜀",
       code='dust = 65\nif dust >= 80:\n    print("나쁨")\nelif dust >= 60:\n    print("보통")\nelse:\n    print("좋음")'),
    mc(8, "다음 코드의 실행 결과는?", ["12", "22", "15", "10", "1 4 7"], None,
       "range(1, 10, 3) → 1, 4, 7 (10은 포함 안 함) → 합 12", code="total = 0\nfor i in range(1, 10, 3):\n    total += i\nprint(total)"),
    mc(9, "다음 코드의 실행 결과는?", ["4", "3", "5", "16", "무한 반복"], None,
       "n: 1→2→4→8→16, count: 1→2→3→4. n=16 이 되면 16<10 이 거짓이라 멈춤 → 4",
       code="n = 1\ncount = 0\nwhile n < 10:\n    n *= 2\n    count += 1\nprint(count)"),
    mc(10, "다음 코드의 실행 결과는?", ["[20, 30, 40] 50", "[20, 30] 50", "[10, 20, 30] 40", "[20, 30, 40] 10", "[20, 30, 40, 50] 50"], None,
       "a[1:4] → 1·2·3번 → [20, 30, 40] (4번 앞까지), a[-1] → 맨 뒤 50",
       code="a = [10, 20, 30, 40, 50]\nprint(a[1:4], a[-1])"),
    mc(11, "다음 코드의 실행 결과는?", ["['가', '마', '다'] 3", "['가', '마', '나', '다'] 4", "['마', '가', '다'] 3", "['가', '다', '마'] 3", "['가', '마', '다', '라'] 4"], None,
       "append('라') → [가,나,다,라] / insert(1,'마') → [가,마,나,다,라] / remove('나') → [가,마,다,라] / pop() → 맨 뒤 '라' 빼기 → [가,마,다], 길이 3",
       code='a = ["가", "나", "다"]\na.append("라")\na.insert(1, "마")\na.remove("나")\na.pop()\nprint(a, len(a))'),
    mc(12, "다음 코드의 실행 결과는?", ["True 0 3", "False 0 3", "True None 3", "True 0 2", "오류"], None,
       "'사과' in d → 키에 있으므로 True / d.get('배', 0) → 키 '배'가 없어 기본값 0 / 키 3개 → len 3",
       code='d = {"사과": 1000, "귤": 500}\nd["포도"] = 3000\nprint("사과" in d, d.get("배", 0), len(d))'),
    mc(13, "다음 코드의 실행 결과는?", ["13", "10", "7", "None", "16"], None,
       "f(2,3) → 2*2+3 = 7 / f(3, 7) → 3*2+7 = 13 (안쪽 함수부터 계산)",
       code="def f(a, b):\n    return a * 2 + b\n\nprint(f(3, f(2, 3)))"),
    mc(14, "다음 코드의 실행 결과는?", ["15", "10", "120", "5", "무한 반복"], None,
       "s(5)=5+s(4)=5+4+s(3)=…=5+4+3+2+1+s(0)=15. n==0 일 때 0을 돌려주며 멈춰요(종료 조건).",
       code="def s(n):\n    if n == 0:\n        return 0\n    return n + s(n - 1)\n\nprint(s(5))"),
]

M1_TASK = [
    task("서답형 1", "정수 n을 입력받아 <b>1부터 n까지의 짝수의 합</b>을 출력하는 프로그램을 작성하시오. (예: 10 → 30)", """
n = int(input("n: "))
total = 0
for i in range(1, n + 1):
    if i % 2 == 0:
        total += i
print(total)""", [
        {"label": "n=10", "input": "10", "out": "30"},
        {"label": "n=1 (짝수 없음)", "input": "1", "out": "0"},
        {"label": "n=7", "input": "7"},
        {"label": "n=100", "input": "100"},
    ], """
n = int(input("n: "))
total = 0
# 1부터 n까지 반복하면서 짝수만 더하기
""", "range(1, n + 1) 로 n까지 포함! 짝수 판별은 i % 2 == 0. (range(2, n + 1, 2) 로 짝수만 돌아도 정답)"),
    task("서답형 2", "공백으로 구분된 점수들을 한 줄로 입력받아 <b>평균(소수 첫째 자리까지)</b>과 <b>최고점</b>을 출력하시오.<br>출력 형식: <code>평균: 80.0</code> / <code>최고점: 90</code>", """
scores = list(map(int, input("점수: ").split()))
avg = sum(scores) / len(scores)
print(f"평균: {avg:.1f}")
print(f"최고점: {max(scores)}")""", [
        {"label": "80 90 70", "input": "80 90 70", "out": "평균: 80.0\n최고점: 90"},
        {"label": "점수 1개", "input": "55", "out": "평균: 55.0\n최고점: 55"},
        {"label": "나누어떨어지지 않음", "input": "100 95 90 81"},
    ], """
scores = list(map(int, input("점수: ").split()))
# 평균과 최고점 출력
""", "split() 으로 나누고 map(int, …) 으로 숫자로 바꿔요. 평균 = sum/len, 소수 첫째 자리는 f\"{avg:.1f}\". 최고점은 max(). 반복문으로 직접 구해도 정답이에요."),
    task("서답형 3", "점수를 매개변수로 받아 학점을 <b>반환</b>하는 함수 <code>grade(score)</code> 를 만들고, 점수를 입력받아 학점을 출력하시오.<br>90 이상 A, 80 이상 B, 70 이상 C, 그 밖에는 F", """
def grade(score):
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    else:
        return "F"

s = int(input("점수: "))
print(grade(s))""", [
        {"label": "95", "input": "95", "out": "A"},
        {"label": "경계 80", "input": "80", "out": "B"},
        {"label": "경계 70", "input": "70", "out": "C"},
        {"label": "69", "input": "69", "out": "F"},
        {"label": "경계 90", "input": "90", "out": "A"},
    ], """
def grade(score):
    # 학점을 return 하기


s = int(input("점수: "))
print(grade(s))
""", "함수 안에서는 print 가 아니라 return 으로 돌려줘야 바깥의 print(grade(s)) 가 학점을 출력해요. 위에서부터 큰 점수 순서로 검사!"),
    task("서답형 4", """과일 가격표 딕셔너리 <code>price = {"사과": 1000, "배": 2000, "귤": 500}</code> 를 만들고,
과일 이름을 반복해서 입력받는다. "끝"을 입력하면 반복을 멈추고 <code>합계: 금액</code>을 출력한다.<br>
가격표에 있으면 금액을 합계에 더하고, 없으면 <code>없는 상품입니다.</code>를 출력한다.""", """
price = {"사과": 1000, "배": 2000, "귤": 500}
total = 0
while True:
    name = input("과일: ")
    if name == "끝":
        break
    if name in price:
        total += price[name]
    else:
        print("없는 상품입니다.")
print(f"합계: {total}")""", [
        {"label": "사과 귤 끝", "input": "사과\n귤\n끝", "out": "합계: 1500"},
        {"label": "없는 과일 섞임", "input": "배\n포도\n배\n끝", "out": "없는 상품입니다.\n합계: 4000"},
        {"label": "바로 끝", "input": "끝", "out": "합계: 0"},
    ], """
price = {"사과": 1000, "배": 2000, "귤": 500}
total = 0
while True:
    name = input("과일: ")
    # "끝"이면 멈추고, 있으면 더하고, 없으면 메시지

print(f"합계: {total}")
""", "while True + break 패턴. '끝' 검사를 가장 먼저 해야 '끝'이 '없는 상품'으로 처리되지 않아요. 있는지는 in, 가격은 price[name]."),
]

# ═════════════════════════ 실전 모의고사 2회
M2_MC = [
    mc(1, "알고리즘에 대한 설명으로 옳은 것은?", [
        "알고리즘은 반드시 프로그래밍 언어로만 표현해야 한다.",
        "알고리즘은 문제를 해결하는 방법과 절차를 순서대로 나타낸 것이다.",
        "알고리즘은 끝나지 않고 계속 실행되어도 상관없다.",
        "같은 문제를 해결하는 알고리즘은 오직 하나뿐이다.",
        "순서도는 알고리즘을 표현하는 방법이 될 수 없다.",
    ], 1, "알고리즘 = 문제 해결 절차. 자연어·순서도·의사코드·프로그래밍 언어로 표현할 수 있고, 유한한 단계 안에 끝나야 해요. 같은 문제도 여러 알고리즘이 있을 수 있어요."),
    mc(2, "다음 코드의 실행 결과는?", ["10 3", "3 10", "10 10", "3 3", "오류"], None,
       "a, b = b, a 는 두 값을 맞바꿔요(동시에 대입).", code="a = 3\nb = 10\na, b = b, a\nprint(a, b)"),
    mc(3, "다음 코드의 실행 결과는?", ["9 2.25 1", "8 2.0 1", "9 2 1", "6 2.25 0", "9 2.25 2"], None,
       "3**2=9 / 9/4=2.25 (나눗셈은 항상 실수) / 9%4=1", code="x = 3 ** 2\nprint(x, x / 4, x % 4)"),
    mc(4, "사용자에게 나이를 입력받아 1년 뒤 나이를 출력하려 한다. 빈칸에 들어갈 코드로 알맞은 것은?" + pre('age = ______\nprint(age + 1)'), [
        "input()", "int(input())", "str(input())", "print(input())", "input(int())",
    ], 1, "input() 은 항상 문자열이라 age + 1 에서 오류(TypeError)가 나요. int(input()) 으로 정수로 바꿔야 해요."),
    mc(5, "다음 코드의 실행 결과는?", ["PYTHON 6 y", "python 6 y", "PYTHON 5 p", "PYTHON 6 p", "Python 6 y"], None,
       "upper() 대문자로, len 글자 수 6, s[1] 은 두 번째 글자 'y'", code='s = "python"\nprint(s.upper(), len(s), s[1])'),
    mc(6, "다음 코드의 실행 결과는?", ["홀수 양수", "짝수 양수", "홀수", "양수", "짝수"], None,
       "if 두 개는 각각 따로 검사해요(elif 아님). 7%2==1 → '홀수', 7>0 → '양수'. end=' ' 로 한 줄에 이어서 출력",
       code='n = 7\nif n % 2 == 0:\n    print("짝수", end=" ")\nelse:\n    print("홀수", end=" ")\nif n > 0:\n    print("양수")'),
    mc(7, "다음 코드의 실행 결과는?", ["5 4 3 2 1", "5 4 3 2 1 0", "4 3 2 1 0", "1 2 3 4 5", "5 3 1"], None,
       "range(5, 0, -1) → 5부터 1씩 줄여서 0 앞까지 → 5 4 3 2 1", code='for i in range(5, 0, -1):\n    print(i, end=" ")'),
    mc(8, "다음 코드의 실행 결과는?", ["1 2 4", "1 2 4 5", "1 2", "1 2 3 4 5", "3"], None,
       "i==3 이면 continue → 출력 건너뛰고 다음 반복. i==5 이면 break → 출력 전에 반복 종료",
       code='for i in range(1, 7):\n    if i == 3:\n        continue\n    if i == 5:\n        break\n    print(i, end=" ")'),
    mc(9, "다음 코드의 실행 결과는?", ["6", "9", "3", "5", "8"], None,
       "중첩 반복: i=0 → j=1,2 (2번), i=1 → j=2 (1번), i=2 → range(3, 3) 은 비어 있어 0번. cnt=3 → 마지막에 cnt * 2 = 6",
       code="cnt = 0\nfor i in range(3):\n    for j in range(i + 1, 3):\n        cnt += 1\nprint(cnt * 2)"),
    mc(10, "다음 코드의 실행 결과는?", ["[2, 4, 6] 12", "[1, 2, 3] 6", "[2, 4, 6] 6", "[1, 4, 9] 14", "[2, 4, 6, 8] 20"], None,
       "for x in a: b.append(x * 2) → [2, 4, 6], sum → 12",
       code="a = [1, 2, 3]\nb = []\nfor x in a:\n    b.append(x * 2)\nprint(b, sum(b))"),
    mc(11, "다음 코드의 실행 결과는?", ["[1, 99, 3] [1, 99, 3]", "[1, 2, 3] [1, 99, 3]", "[1, 99, 3] [1, 2, 3]", "[1, 2, 3] [1, 2, 3]", "오류"], None,
       "b = a 는 리스트를 복사하는 게 아니라 같은 리스트에 이름을 하나 더 붙인 것이에요. b를 바꾸면 a도 바뀜. (복사하려면 a[:] 또는 a.copy())",
       code="a = [1, 2, 3]\nb = a\nb[1] = 99\nprint(a, b)"),
    mc(12, "다음 코드의 실행 결과는?", ["철수 90 영희 85", "90 85", "철수 영희", "철수 85 영희 90", "('철수', 90) ('영희', 85)"], None,
       "for k in d: 는 키를 하나씩 꺼내요. d[k] 로 값. end=' ' 로 이어서 출력",
       code='d = {"철수": 90, "영희": 85}\nfor k in d:\n    print(k, d[k], end=" ")'),
    mc(13, "다음 코드의 실행 결과는?", ["None", "5", "8", "3", "오류"], None,
       "함수 안에서 print 도 return 도 하지 않았어요. return 이 없는 함수는 None 을 돌려줘요.",
       code="def add(a, b):\n    c = a + b\n\nprint(add(3, 5))"),
    mc(14, "다음 코드의 실행 결과는?", ["24", "10", "4", "1", "12"], None,
       "fact(4) = 4*fact(3) = 4*3*fact(2) = 4*3*2*fact(1) = 24 (n<=1 이면 1)",
       code="def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\n\nprint(fact(4))"),
]

M2_TASK = [
    task("서답형 1", "정수를 입력받아 <b>구구단</b>을 출력하시오. (예: 3 → <code>3 x 1 = 3</code> 부터 <code>3 x 9 = 27</code> 까지 9줄)", """
dan = int(input("단: "))
for i in range(1, 10):
    print(f"{dan} x {i} = {dan * i}")""", [
        {"label": "3단", "input": "3"},
        {"label": "9단", "input": "9"},
    ], """
dan = int(input("단: "))
""", "range(1, 10) 은 1부터 9까지. 출력 형식(띄어쓰기 포함)을 정확히 맞추세요: f\"{dan} x {i} = {dan * i}\""),
    task("서답형 2", "0을 입력할 때까지 정수를 반복해서 입력받아, 입력한 수들 중 <b>양수의 개수</b>와 <b>음수의 개수</b>를 출력하시오.<br>출력 형식: <code>양수: 2</code> / <code>음수: 1</code>", """
pos = 0
neg = 0
while True:
    n = int(input("수: "))
    if n == 0:
        break
    if n > 0:
        pos += 1
    else:
        neg += 1
print(f"양수: {pos}")
print(f"음수: {neg}")""", [
        {"label": "3 -1 5 0", "input": "3\n-1\n5\n0", "out": "양수: 2\n음수: 1"},
        {"label": "바로 0", "input": "0", "out": "양수: 0\n음수: 0"},
        {"label": "음수만", "input": "-2\n-7\n0"},
    ], """
pos = 0
neg = 0
while True:
    n = int(input("수: "))
    # 0이면 멈추기, 양수/음수 세기

print(f"양수: {pos}")
print(f"음수: {neg}")
""", "while True 안에서 0 검사 → break 를 먼저. 그다음 n > 0 이면 pos, 아니면 neg."),
    task("서답형 3", "리스트를 매개변수로 받아 <b>최솟값과 최댓값의 차이</b>를 반환하는 함수 <code>diff(nums)</code> 를 만드시오. 단, <b>min, max 함수를 쓰지 말고</b> 반복문으로 구하시오.<br>입력한 수들(공백 구분)로 리스트를 만들어 diff 의 결과를 출력한다.", """
def diff(nums):
    small = nums[0]
    big = nums[0]
    for x in nums:
        if x < small:
            small = x
        if x > big:
            big = x
    return big - small

nums = list(map(int, input("수: ").split()))
print(diff(nums))""", [
        {"label": "3 9 1 7", "input": "3 9 1 7", "out": "8"},
        {"label": "수 1개", "input": "5", "out": "0"},
        {"label": "음수 포함", "input": "-4 10 2"},
    ], """
def diff(nums):
    small = nums[0]
    big = nums[0]
    # 반복문으로 가장 작은 값, 가장 큰 값 찾기

    return big - small

nums = list(map(int, input("수: ").split()))
print(diff(nums))
""", "처음 값(nums[0])을 기준으로 시작해서, 더 작은 값/더 큰 값이 나오면 바꿔 넣어요. 0으로 시작하면 음수만 있을 때 틀려요!"),
    task("서답형 4", """단어를 공백으로 구분해 한 줄로 입력받아, 딕셔너리로 <b>각 단어가 나온 횟수</b>를 세어 입력된 순서대로 <code>단어:횟수</code> 형태로 한 줄씩 출력하시오.""", """
words = input("문장: ").split()
count = {}
for w in words:
    if w in count:
        count[w] += 1
    else:
        count[w] = 1
for w in count:
    print(f"{w}:{count[w]}")""", [
        {"label": "a b a c b a", "input": "a b a c b a", "out": "a:3\nb:2\nc:1"},
        {"label": "한 단어", "input": "hi", "out": "hi:1"},
        {"label": "한글", "input": "나 너 나 우리"},
    ], """
words = input("문장: ").split()
count = {}
for w in words:
    # 처음 나온 단어면 1, 이미 있으면 1 증가

for w in count:
    print(f"{w}:{count[w]}")
""", "딕셔너리 세기 패턴: 있으면 count[w] += 1, 없으면 count[w] = 1. (count[w] = count.get(w, 0) + 1 한 줄로도 가능)"),
]

# ═════════════════════════ 오류 찾기 (디버깅)
ERR = ["SyntaxError (문법 오류)", "IndentationError (들여쓰기 오류)", "TypeError (자료형 오류)", "IndexError (인덱스 범위 오류)", "KeyError (없는 키)", "NameError (정의되지 않은 이름)"]


def err(no, code, name, explain):
    cs = [f"{C[i] if i < 5 else '⑥'} {c}" for i, c in enumerate(ERR)]
    # 실제로 그 오류가 나는지 확인
    try:
        run(code)
        raise AssertionError(("no error", no))
    except AssertionError:
        raise
    except BaseException as e:
        assert type(e).__name__ == name.split()[0], (no, type(e).__name__, name)
    a = [i for i, c in enumerate(ERR) if c.startswith(name.split()[0])][0]
    return [f"({no})", "다음 코드를 실행했을 때 나는 오류는?" + pre(code), cs[a], [cs[a]], {"type": "choice", "choices": cs, "explain": explain}]


ERR_MC = [
    err(1, 'score = 85\nif score >= 80\n    print("합격")', "SyntaxError", "if 조건식 끝에 콜론(:)이 빠졌어요. if / elif / else / for / while / def 줄 끝에는 항상 콜론!"),
    err(2, 'for i in range(3):\nprint(i)', "IndentationError", "for 아래 실행할 문장은 4칸 들여써야 해요."),
    err(3, 'age = "17"\nprint(age + 1)', "TypeError", "문자열 + 정수는 더할 수 없어요. int(age) + 1 로 바꿔야 해요. (input() 으로 받은 값도 문자열이라 똑같은 오류!)"),
    err(4, 'a = [10, 20, 30]\nprint(a[3])', "IndexError", "길이 3인 리스트의 인덱스는 0, 1, 2 까지. a[3] 은 없어요. 마지막은 a[2] 또는 a[-1]."),
    err(5, 'd = {"사과": 1000}\nprint(d["배"])', "KeyError", "없는 키 '배'를 꺼내려 했어요. 먼저 '배' in d 로 확인하거나 d.get('배', 0) 을 써요."),
    err(6, 'total = 0\nfor i in range(3):\n    totla += i', "NameError", "오타! totla 라는 변수는 만든 적이 없어요. 변수 이름은 정확히 똑같이."),
    err(7, 'def hello()\n    print("안녕")', "SyntaxError", "def 줄 끝에도 콜론(:)이 필요해요."),
    err(8, 'print("합계는 " + 100)', "TypeError", "문자열과 숫자는 + 로 이을 수 없어요. str(100) 으로 바꾸거나 print(\"합계는\", 100) / f-문자열을 써요."),
]


def fixmc(no, q, choices, a, explain):
    cs = [f"{C[i]} {c}" for i, c in enumerate(choices)]
    return [f"({no})", q, cs[a], [cs[a]], {"type": "choice", "choices": cs, "explain": explain}]


# 오류는 안 나지만 결과가 틀린 코드 (논리 오류)
LOGIC = [
    fixmc(1, "1부터 10까지의 합을 구하려 했는데 45가 나왔다. 어디를 고쳐야 할까?" + pre("total = 0\nfor i in range(1, 10):\n    total += i\nprint(total)"),
          ["range(1, 10) → range(1, 11)", "total = 0 → total = 1", "total += i → total = i", "print(total) → print(i)", "range(1, 10) → range(0, 10)"], 0,
          "range 의 끝 값은 포함되지 않아요. 10까지 더하려면 range(1, 11)."),
    fixmc(2, "아래 코드는 끝나지 않는다(무한 반복). 무엇을 추가해야 할까?" + pre("i = 1\nwhile i <= 5:\n    print(i)"),
          ["while 안에 i += 1 추가", "while 앞에 i = 0 추가", "print(i) 를 while 밖으로", "while i <= 5 → while i < 5", "break 를 맨 앞에 추가"], 0,
          "i 가 바뀌지 않아 조건이 계속 참이에요. 반복할 때마다 i += 1 로 바꿔 줘야 해요."),
    fixmc(3, "점수가 90점 이상이면 A, 80점 이상이면 B를 출력하려 했는데, 95점을 넣어도 B가 나온다. 원인은?" + pre('score = 95\nif score >= 80:\n    print("B")\nelif score >= 90:\n    print("A")'),
          ["조건의 순서가 바뀌어 95가 먼저 score >= 80 에 걸린다", "elif 대신 else 를 써야 한다", "print 의 따옴표가 잘못되었다", ">= 대신 > 를 써야 한다", "score 가 문자열이다"], 0,
          "if-elif 는 위에서부터 처음 참인 곳 하나만 실행해요. 더 좁은 조건(>= 90)을 먼저 써야 해요."),
    fixmc(4, "두 수의 평균을 돌려주는 함수인데, 출력이 None 이다. 어떻게 고쳐야 할까?" + pre("def avg(a, b):\n    result = (a + b) / 2\n\nprint(avg(4, 6))"),
          ["함수 마지막에 return result 추가", "result 를 print 로 바꾸기만 하면 된다", "def 를 function 으로", "(a + b) / 2 → a + b / 2", "print(avg) 로 바꾸기"], 0,
          "return 이 없으면 함수는 None 을 돌려줘요. 값을 밖에서 쓰려면 return result."),
    fixmc(5, "평균을 구하려 했는데 결과가 이상하다. (입력: 80, 90) 원인은?" + pre("a = 80\nb = 90\nprint(a + b / 2)"),
          ["/ 가 + 보다 먼저 계산되어 80 + 45 = 125 가 된다", "/ 는 몫만 구한다", "a 와 b 가 문자열이다", "print 안에서는 계산을 할 수 없다", "/ 대신 % 를 써야 한다"], 0,
          "곱셈·나눗셈이 덧셈보다 먼저예요. (a + b) / 2 처럼 괄호를 써야 해요."),
    fixmc(6, "리스트에서 짝수만 새 리스트에 담으려 했는데 결과가 [] 이다. 원인은?" + pre("nums = [1, 2, 3, 4]\nevens = []\nfor n in nums:\n    if n % 2 == 1:\n        evens.append(n)\n    evens = []\nprint(evens)"),
          ["반복할 때마다 evens = [] 로 다시 비워진다", "% 대신 // 를 써야 한다", "append 대신 insert 를 써야 한다", "for n in nums 가 잘못되었다", "print 가 들여써져야 한다"], 0,
          "for 안에서 evens = [] 를 하면 매번 빈 리스트가 돼요. 또 짝수는 n % 2 == 0 이어야 해요(조건도 틀림) — 두 군데를 고쳐야 정답이 나와요."),
]

# 고쳐 쓰기 (코드 작성)
FIX_TASK = [
    task("고쳐 쓰기 1", "다음 코드는 정수 n을 입력받아 <b>n부터 1까지 거꾸로</b> 출력하려는 코드인데 잘못된 곳이 4군데 있다. 고쳐서 완성하시오. (한 줄에 하나씩 출력)", """
n = int(input("n: "))
while n >= 1:
    print(n)
    n -= 1""", [
        {"label": "n=3", "input": "3", "out": "3\n2\n1"},
        {"label": "n=1", "input": "1", "out": "1"},
        {"label": "n=6", "input": "6"},
    ], """
n = input("n: ")
while n >= 1
print(n)
    n += 1
""", "① input 은 문자열 → int(input()) ② while 줄 끝 콜론 ③ print 들여쓰기 ④ 거꾸로 세려면 n -= 1 (n += 1 이면 무한 반복). 하나라도 놓치면 채점에서 걸려요."),
    task("고쳐 쓰기 2", "다음 코드는 딕셔너리에서 학생 이름을 입력받아 점수를 출력하고, 없는 이름이면 <code>등록되지 않은 학생</code>을 출력하려는 코드이다. 오류를 고쳐 완성하시오.", """
scores = {"민수": 88, "지은": 95}
name = input("이름: ")
if name in scores:
    print(scores[name])
else:
    print("등록되지 않은 학생")""", [
        {"label": "민수", "input": "민수", "out": "88"},
        {"label": "지은", "input": "지은", "out": "95"},
        {"label": "없는 이름", "input": "철수", "out": "등록되지 않은 학생"},
    ], """
scores = {"민수": 88, "지은": 95}
name = input("이름: ")
if name = scores:
    print(scores(name))
else:
    print("등록되지 않은 학생")
""", "① 키가 있는지 검사는 in ( = 는 대입이라 문법 오류) ② 딕셔너리 값 꺼내기는 대괄호 scores[name] (소괄호는 함수 호출)."),
]


def unit(uid, title, sub, concept, groups):
    return {"id": uid, "title": title, "sub": sub, "concept": concept, "groups": groups}


CON_MOCK = """
<h3>실제 시험처럼 풀어 보세요</h3>
<p>시험 구성: <b>선다형 14문항 (60점) + 서답형 4문항 (40점)</b>. 이 단원도 똑같이 14 + 4 로 되어 있어요.</p>
<ol><li>「한 문제씩」으로 선다형 14개를 시간 재고 풀기 (목표 20분)</li>
<li>코드 실행 결과 문제는 <b>변수 표</b>를 그려서 한 줄씩 값을 따라가기</li>
<li>서답형은 앱에서 바로 코드를 쓰고 ▶ 실행 → ✅ 채점. 채점에서 빨간 줄이 나오면 <b>나와야 할 출력 ↔ 내 출력</b>을 비교</li>
<li>틀린 건 「틀린 문제」로 다시</li></ol>
<div class="tip">💡 시험 직전 체크: 콜론(:) · 들여쓰기 · int(input()) · range 끝 값 미포함 · return · 딕셔너리 in 검사</div>"""

CON_ERR = """
<h3>오류 메시지 읽는 법</h3>
<table class="ctable">
<tr><th>오류</th><th>뜻</th><th>단골 원인</th></tr>
<tr><td><b>SyntaxError</b></td><td>문법이 틀림</td><td>콜론(:) 빠짐, 괄호·따옴표 짝 안 맞음, if 안에서 = 사용</td></tr>
<tr><td><b>IndentationError</b></td><td>들여쓰기가 틀림</td><td>if/for/while/def 아래를 안 들여씀, 칸 수가 들쭉날쭉</td></tr>
<tr><td><b>TypeError</b></td><td>자료형이 안 맞음</td><td>문자열 + 숫자, input() 결과로 바로 계산</td></tr>
<tr><td><b>IndexError</b></td><td>없는 번호</td><td>길이 3인 리스트에 a[3]</td></tr>
<tr><td><b>KeyError</b></td><td>없는 키</td><td>딕셔너리에 없는 키를 d[키] 로 꺼냄</td></tr>
<tr><td><b>NameError</b></td><td>없는 이름</td><td>변수 이름 오타, 만들기 전에 사용</td></tr>
</table>
<h3>오류는 안 나는데 답이 틀릴 때 (논리 오류)</h3>
<ul><li><b>range 끝 값</b>은 포함 안 됨 → 1~10 은 range(1, 11)</li>
<li><b>while 변수</b>를 안 바꾸면 무한 반복</li>
<li><b>if-elif 순서</b>: 좁은 조건(90 이상)을 먼저</li>
<li><b>return 없음</b> → None</li>
<li><b>연산 우선순위</b>: a + b / 2 ≠ (a + b) / 2</li>
<li>반복문 <b>안에서 초기화</b>하면 매번 처음으로 돌아감</li></ul>"""

units = [
    unit("11", "실전 모의고사 1회", "선다형 14 + 서답형 4 · 시험과 같은 구성", CON_MOCK, [
        {"stars": 2, "q": "[선다형 1~14] 물음에 알맞은 답을 고르시오.", "items": M1_MC},
        {"stars": 3, "q": "[서답형 1~4] 조건에 맞게 코드를 작성하시오. (앱에서 바로 실행·채점)", "items": M1_TASK},
    ]),
    unit("12", "실전 모의고사 2회", "선다형 14 + 서답형 4 · 시험과 같은 구성", CON_MOCK, [
        {"stars": 2, "q": "[선다형 1~14] 물음에 알맞은 답을 고르시오.", "items": M2_MC},
        {"stars": 3, "q": "[서답형 1~4] 조건에 맞게 코드를 작성하시오. (앱에서 바로 실행·채점)", "items": M2_TASK},
    ]),
    unit("13", "오류 찾기 · 디버깅", "오류 이름 맞히기 · 논리 오류 · 틀린 코드 고쳐 쓰기", CON_ERR, [
        {"stars": 1, "q": "코드를 실행했을 때 나는 오류를 고르시오.", "items": ERR_MC},
        {"stars": 2, "q": "오류는 안 나지만 결과가 틀린 코드이다. 물음에 답하시오.", "items": LOGIC},
        {"stars": 3, "q": "틀린 코드를 고쳐 쓰시오. (처음 코드에 오류가 들어 있어요)", "items": FIX_TASK},
    ]),
]

js = """// 프로그래밍 실전 — 모의고사 2회(선다형 14 + 서답형 4) · 오류 찾기(디버깅)
//   ⚠ 이 파일은 생성기로 만들었어요: 모든 코드를 실제 파이썬으로 실행해서 정답·채점 출력을 뽑았어요.
(function () {
  STORY.addUnits("programming", %s);
})();
""" % json.dumps(units, ensure_ascii=False, indent=1)
open(sys.argv[1], "w").write(js)
print("ok", sum(len(g["items"]) for u in units for g in u["groups"]))
