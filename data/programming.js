// 프로그래밍 (파이썬) — Ⅰ. 프로그래밍의 개요 ~ Ⅱ. 프로그래밍의 기초 4. 함수
(function () {
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // 코드 블록: 첫 줄/마지막 줄의 빈 줄과 공통 들여쓰기를 지운다
  const code = (t) => {
    const lines = t.replace(/^\n|\n\s*$/g, "").split("\n");
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    return `<pre class="code">${esc(lines.map((l) => l.slice(ind)).join("\n"))}</pre>`;
  };
  const ch = (choices, explain) => ({ type: "choice", choices, explain });
  const out = "다음 코드의 실행 결과를 쓰시오. (공백은 신경 쓰지 않아도 돼요)";

  STORY.addSubject({
    id: "programming",
    name: "프로그래밍",
    icon: "</>",
    color: "#7a52d1",
    desc: "파이썬 · 변수와 연산 · 조건문 · 반복문 · 리스트 · 딕셔너리 · 함수 · 재귀 · 서술형 실전(코드 실행·자동 채점) · 실전 모의고사 · 디버깅",
    // 단원 고르기 화면 묶음 (js/app.js viewParts)
    parts: [
      { title: "교과서 기본", sub: "Ⅰ. 프로그래밍의 개요 ~ Ⅱ. 4. 함수", units: [
        ["1", "개념", "프로그래밍의 개요"],
        ["2", "개념", "변수 · 자료형 · 연산자"],
        ["3", "개념", "조건문과 반복문"],
        ["4", "개념", "함수"],
      ] },
      { title: "집중 연습", sub: "시험범위 정리표 순서", units: [
        ["5", "실전 연습", "리스트"],
        ["6", "실전 연습", "딕셔너리"],
        ["7", "실전 연습", "반복문 집중"],
        ["8", "실전 연습", "함수 · 재귀"],
        ["9", "정리", "시험범위 총정리"],
      ] },
      { title: "서답형 · 실전", sub: "코드 직접 쓰고 자동 채점", units: [
        ["10", "서답형", "서술형 실전 · 딕셔너리 + while"],
        ["13", "디버깅", "오류 찾기 · 고쳐 쓰기"],
        ["11", "모의고사", "실전 모의고사 1회 (14 + 4)"],
        ["12", "모의고사", "실전 모의고사 2회 (14 + 4)"],
      ] },
    ],
    exam: {
      count: "선다형 14문항 (60점) + 서답형 4문항 (40점)",
      range: ["Ⅰ. 프로그래밍의 개요 ~ Ⅱ. 프로그래밍의 기초 4. 함수 (p.12-147)"],
    },
    units: [
      {
        id: "1",
        title: "프로그래밍의 개요",
        sub: "프로그래밍 언어 · 알고리즘 · 순서도",
        groups: [
          {
            stars: 1,
            q: "알맞은 것을 고르시오.",
            items: [
              ["(1)", "고급 언어로 작성한 프로그램 전체를 기계어로 한꺼번에 번역하는 프로그램은?", "컴파일러", "컴파일러", ch(["컴파일러", "인터프리터", "운영 체제", "편집기"])],
              ["(2)", "소스 코드를 한 줄씩 해석하면서 바로 실행하는 방식은? (파이썬이 이 방식)", "인터프리터", "인터프리터", ch(["컴파일러", "인터프리터", "어셈블러", "링커"])],
              ["(3)", "다음 중 고급 언어가 아닌 것은?", "기계어", "기계어", ch(["파이썬", "C", "자바", "기계어"], "기계어·어셈블리어는 저급 언어이다.")],
              ["(4)", "알고리즘이 갖추어야 할 조건이 아닌 것은?", "무한성", "무한성", ch(["입력과 출력", "명확성", "유한성", "효과성", "무한성"], "알고리즘은 유한한 단계 뒤에 반드시 끝나야 한다(유한성).")],
              ["(5)", "순서도에서 조건에 따라 흐름이 나뉘는 '판단'을 나타내는 기호는?", "마름모", "마름모", ch(["마름모", "평행사변형", "직사각형", "타원(둥근 사각형)"])],
              ["(6)", "순서도에서 데이터의 '입력·출력'을 나타내는 기호는?", "평행사변형", "평행사변형", ch(["마름모", "평행사변형", "직사각형", "타원(둥근 사각형)"])],
              ["(7)", "복잡한 문제를 해결하기 쉬운 작은 문제로 나누는 컴퓨팅 사고 요소는?", "분해", "분해", ch(["분해", "추상화", "패턴 인식", "자동화"])],
              ["(8)", "문제에서 핵심 요소만 남기고 불필요한 세부 사항을 제거하는 것은?", "추상화", "추상화", ch(["분해", "추상화", "패턴 인식", "자동화"])],
            ],
          },
          {
            stars: 1,
            q: "빈칸에 알맞은 말을 쓰시오.",
            items: [
              ["(1)", "프로그램의 오류(버그)를 찾아 고치는 과정을 ____ (이)라고 한다.", "디버깅", ["디버깅", "debugging"]],
              ["(2)", "문제를 해결하기 위한 명확한 절차나 방법을 ____ (이)라고 한다.", "알고리즘", ["알고리즘", "algorithm"]],
            ],
          },
        ],
      },
      {
        id: "2",
        title: "변수 · 자료형 · 연산자",
        sub: "입출력 · 산술/비교/논리 연산",
        groups: [
          {
            stars: 1,
            q: out,
            items: [
              ["(1)", code(`print(7 // 2)`), "3", "3", { explain: "// 는 몫" }],
              ["(2)", code(`print(7 % 2)`), "1", "1", { explain: "% 는 나머지" }],
              ["(3)", code(`print(2 ** 3)`), "8", "8", { explain: "** 는 거듭제곱" }],
              ["(4)", code(`print(7 / 2)`), "3.5", "3.5"],
              ["(5)", code(`print("3" + "4")`), "34", "34", { explain: "문자열끼리 + 는 이어 붙이기" }],
              ["(6)", code(`print("ab" * 3)`), "ababab", "ababab"],
              ["(7)", code(`print(int("12") + 3)`), "15", "15"],
              ["(8)", code(`print(10 > 3 and 2 > 5)`), "False", "False"],
            ],
          },
          {
            stars: 2,
            q: out,
            items: [
              ["(1)", code(`
                x = 5
                x += 3
                x *= 2
                print(x)`), "16", "16"],
              ["(2)", code(`
                a, b = 3, 7
                a, b = b, a
                print(a, b)`), "7 3", "7 3"],
              ["(3)", code(`
                name = "python"
                print(len(name), name[0], name[-1])`), "6 p n", "6 p n"],
            ],
          },
          {
            stars: 1,
            q: "알맞은 것을 고르시오.",
            items: [
              ["(1)", "변수 이름으로 사용할 수 없는 것은?", "2nd", "2nd", ch(["my_score", "_count", "2nd", "total2"], "변수 이름은 숫자로 시작할 수 없다.")],
              ["(2)", "input() 함수가 돌려주는 값의 자료형은?", "str", "str", ch(["int", "float", "str", "bool"], "숫자로 쓰려면 int(input()) 처럼 변환해야 한다.")],
              ["(3)", "<code>type(3.0)</code> 의 자료형은?", "float", "float", ch(["int", "float", "str", "bool"])],
              ["(4)", "변수 이름으로 사용할 수 없는 것은?", "if", "if", ch(["score", "If_value", "if", "num_1"], "if 는 예약어(키워드)이다.")],
            ],
          },
        ],
      },
      {
        id: "3",
        title: "조건문과 반복문",
        sub: "if · for · while · break · continue",
        groups: [
          {
            stars: 1,
            q: out,
            items: [
              ["(1)", code(`
                score = 75
                if score >= 90:
                    print("A")
                elif score >= 80:
                    print("B")
                elif score >= 70:
                    print("C")
                else:
                    print("D")`), "C", "C"],
              ["(2)", code(`
                x = 15
                if x % 3 == 0 and x % 5 == 0:
                    print("FizzBuzz")
                elif x % 3 == 0:
                    print("Fizz")
                else:
                    print(x)`), "FizzBuzz", "FizzBuzz"],
              ["(3)", code(`
                s = 0
                for i in range(1, 6):
                    s += i
                print(s)`), "15", "15"],
              ["(4)", code(`print(list(range(2, 10, 3)))`), "[2, 5, 8]", "[2, 5, 8]"],
            ],
          },
          {
            stars: 2,
            q: out,
            items: [
              ["(1)", code(`
                n = 0
                while n < 10:
                    n += 3
                print(n)`), "12", "12"],
              ["(2)", code(`
                for i in range(5):
                    if i == 3:
                        break
                    print(i, end="")`), "012", "012"],
              ["(3)", code(`
                for i in range(5):
                    if i % 2 == 0:
                        continue
                    print(i, end=" ")`), "1 3", "1 3"],
              ["(4)", code(`
                count = 0
                for i in range(3):
                    for j in range(4):
                        count += 1
                print(count)`), "12", "12"],
            ],
          },
          {
            stars: 2,
            q: "1부터 100까지의 짝수의 합을 출력하도록 빈칸을 채우시오.",
            items: [["", code(`
              total = 0
              for i in range(2, 101, ____):
                  total += i
              print(total)`), "2", "2"]],
          },
        ],
      },
      {
        id: "4",
        title: "함수",
        sub: "def · 매개변수 · return · 지역 변수",
        groups: [
          {
            stars: 1,
            q: out,
            items: [
              ["(1)", code(`
                def add(a, b):
                    return a + b
                print(add(2, 3))`), "5", "5"],
              ["(2)", code(`
                def f(x):
                    return x * 2 + 1
                print(f(f(1)))`), "7", "7", { explain: "f(1)=3, f(3)=7" }],
              ["(3)", code(`
                def greet(name="친구"):
                    return "안녕, " + name
                print(greet())`), "안녕, 친구", "안녕, 친구", { explain: "인자를 주지 않으면 기본값이 쓰인다." }],
              ["(4)", code(`print(max([3, 9, 2]), min([3, 9, 2]))`), "9 2", "9 2"],
            ],
          },
          {
            stars: 2,
            q: out,
            items: [
              ["(1)", code(`
                def square(n):
                    return n ** 2
                total = 0
                for i in range(1, 4):
                    total += square(i)
                print(total)`), "14", "14"],
              ["(2)", code(`
                x = 10
                def change():
                    x = 5
                change()
                print(x)`), "10", "10", { explain: "함수 안의 x 는 지역 변수라 바깥 x 에 영향을 주지 않는다." }],
              ["(3)", code(`
                def hello():
                    print("hi")
                r = hello()
                print(r)`), "hi None", "hi None", { explain: "return 이 없는 함수는 None 을 돌려준다." }],
              ["(4)", code(`
                def fact(n):
                    if n <= 1:
                        return 1
                    return n * fact(n - 1)
                print(fact(4))`), "24", "24"],
            ],
          },
          {
            stars: 1,
            q: "알맞은 것을 고르시오.",
            items: [
              ["(1)", "파이썬에서 함수를 정의할 때 쓰는 키워드는?", "def", "def", ch(["def", "function", "func", "define"])],
              ["(2)", "함수를 호출할 때 괄호 안에 넣어 전달하는 실제 값은?", "인자(인수)", "인자(인수)", ch(["매개변수", "인자(인수)", "반환값", "지역 변수"])],
              ["(3)", "함수 정의에서 전달받은 값을 저장하는 변수는?", "매개변수", "매개변수", ch(["매개변수", "인자(인수)", "반환값", "전역 변수"])],
              ["(4)", "함수의 실행 결과를 호출한 곳으로 돌려주는 명령은?", "return", "return", ch(["print", "return", "break", "input"])],
            ],
          },
        ],
      },
    ],
  });
})();
