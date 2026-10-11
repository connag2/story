// 영어 — 고2 필수 어휘 · 어법 · 구문 해석
(function () {
  // [단어, 뜻]
  const WORDS1 = [
    ["abandon", "버리다, 포기하다"],
    ["acquire", "얻다, 습득하다"],
    ["adapt", "적응하다, 각색하다"],
    ["alternative", "대안; 대안이 되는"],
    ["anticipate", "예상하다, 기대하다"],
    ["appropriate", "적절한"],
    ["assess", "평가하다"],
    ["attribute", "~의 탓으로 돌리다; 속성"],
    ["cognitive", "인지의"],
    ["comprehensive", "포괄적인, 종합적인"],
    ["consequence", "결과, 영향"],
    ["contradict", "반박하다, 모순되다"],
    ["crucial", "결정적인, 중대한"],
    ["deficiency", "결핍, 부족"],
  ];
  const WORDS2 = [
    ["diminish", "줄어들다, 감소시키다"],
    ["distinguish", "구별하다"],
    ["enhance", "향상시키다, 높이다"],
    ["evident", "분명한, 명백한"],
    ["inevitable", "피할 수 없는, 불가피한"],
    ["inherent", "내재된, 고유의"],
    ["interpret", "해석하다, 통역하다"],
    ["perceive", "인지하다, 지각하다"],
    ["persist", "지속되다, 고집하다"],
    ["prominent", "두드러진, 저명한"],
    ["reluctant", "꺼리는, 마지못한"],
    ["substitute", "대체하다; 대체물"],
    ["sustain", "유지하다, 지탱하다"],
    ["vulnerable", "취약한, 연약한"],
  ];

  // 같은 목록의 다른 뜻 3개를 오답 보기로 사용
  function meaningQuiz(list) {
    return list.map(([w, m], i) => {
      const others = list.filter((_, j) => j !== i).map((x) => x[1]);
      const pick = [1, 4, 8].map((k) => others[(i * 3 + k) % others.length]);
      const choices = [m, ...new Set(pick)];
      return ["", `<span class="word">${w}</span>`, m, m, { type: "choice", choices, shuffle: true }];
    });
  }
  function spellQuiz(list) {
    return list.map(([w, m]) => [
      "",
      `${m} <span class="hint">(${w[0]}${"_".repeat(w.length - 1)})</span>`,
      w,
      w,
    ]);
  }

  STORY.addSubject({
    id: "english",
    name: "영어Ⅱ",
    icon: "Aa",
    color: "#e0742b",
    desc: "고2 필수 어휘 · 어법 · 구문 해석 (교과서 Unit 본문은 추가 예정)",
    exam: {
      count: "선다형 22문항 (90점) + 서답형 2문항 (10점)",
      range: ["Unit 1-2 (p.10-59)", "교과서 연계 심화 자료"],
    },
    units: [
      {
        id: "voca1",
        title: "필수 어휘 Day 1",
        sub: "뜻 고르기 · 철자 쓰기",
        groups: [
          { stars: 1, q: "다음 단어의 뜻으로 알맞은 것을 고르시오.", items: meaningQuiz(WORDS1) },
          { stars: 2, q: "다음 뜻에 해당하는 영어 단어를 쓰시오.", items: spellQuiz(WORDS1) },
        ],
      },
      {
        id: "voca2",
        title: "필수 어휘 Day 2",
        sub: "뜻 고르기 · 철자 쓰기",
        groups: [
          { stars: 1, q: "다음 단어의 뜻으로 알맞은 것을 고르시오.", items: meaningQuiz(WORDS2) },
          { stars: 2, q: "다음 뜻에 해당하는 영어 단어를 쓰시오.", items: spellQuiz(WORDS2) },
        ],
      },
      {
        id: "grammar1",
        title: "어법 기본기",
        sub: "수일치 · 관계사 · 가정법 · 분사",
        groups: [
          {
            stars: 1,
            q: "빈칸에 들어갈 말로 어법상 알맞은 것을 고르시오.",
            items: [
              ["(1)", "The number of tourists visiting the city ____ increased every year.", "has", "has",
                { type: "choice", choices: ["has", "have"], explain: "The number of + 복수명사 → 주어는 'number'(단수) → 단수 동사" }],
              ["(2)", "A number of people ____ waiting outside the gate.", "are", "are",
                { type: "choice", choices: ["is", "are"], explain: "A number of + 복수명사 = '많은 ~' → 복수 동사" }],
              ["(3)", "This is the house ____ I lived in when I was young.", "which", "which",
                { type: "choice", choices: ["which", "where"], explain: "전치사 in의 목적어가 빠진 불완전한 절 → 관계대명사" }],
              ["(4)", "This is the house ____ I lived when I was young.", "where", "where",
                { type: "choice", choices: ["which", "where"], explain: "뒤에 완전한 절(I lived) → 관계부사" }],
              ["(5)", "If I ____ you, I would accept the offer.", "were", "were",
                { type: "choice", choices: ["am", "were"], explain: "가정법 과거: If + 주어 + 과거동사(be는 were), 주어 + would + 동사원형" }],
              ["(6)", "She had her car ____ at the shop yesterday.", "repaired", "repaired",
                { type: "choice", choices: ["repair", "repaired"], explain: "사역동사 have + 목적어 + p.p. (차가 '수리되는' 수동 관계)" }],
              ["(7)", "____ from the hill, the town looks beautiful.", "Seen", "Seen",
                { type: "choice", choices: ["Seeing", "Seen"], explain: "주어 the town이 '보여지는' 것 → 수동의 분사구문" }],
              ["(8)", "I remember ____ the door, but now it is open.", "locking", "locking",
                { type: "choice", choices: ["to lock", "locking"], explain: "remember + -ing: (과거에) ~한 것을 기억하다" }],
              ["(9)", "He made me ____ the report again.", "write", "write",
                { type: "choice", choices: ["write", "to write"], explain: "사역동사 make + 목적어 + 동사원형" }],
              ["(10)", "What surprised me most ____ his calm attitude.", "was", "was",
                { type: "choice", choices: ["was", "were"], explain: "명사절(What ~) 주어는 단수 취급" }],
              ["(11)", "Never ____ such a beautiful sunset.", "have I seen", "have I seen",
                { type: "choice", choices: ["I have seen", "have I seen"], explain: "부정어(Never)가 문두 → 주어·조동사 도치" }],
              ["(12)", "The book was so interesting ____ I couldn't put it down.", "that", "that",
                { type: "choice", choices: ["that", "which"], explain: "so + 형용사 + that ~: 너무 ~해서 …하다" }],
            ],
          },
        ],
      },
      {
        id: "reading1",
        title: "구문 해석 연습",
        sub: "강조 · 도치 · 비교 구문",
        groups: [
          {
            stars: 2,
            q: "다음 문장을 해석해 보세요. 해석을 쓴 뒤 모범 해석과 비교해 스스로 채점하세요.",
            items: [
              ["(1)", "It is not until you lose your health that you realize its value.", "건강을 잃고 나서야 비로소 그 가치를 깨닫는다.", null,
                { explain: "It is not until A that B: A하고 나서야 비로소 B하다" }],
              ["(2)", "The more you practice, the more confident you will become.", "더 많이 연습할수록 더 자신감이 생길 것이다.", null,
                { explain: "the 비교급 ~, the 비교급 …: ~할수록 더 …하다" }],
              ["(3)", "No sooner had he arrived than it began to rain.", "그가 도착하자마자 비가 내리기 시작했다.", null,
                { explain: "No sooner had + 주어 + p.p. ~ than …: ~하자마자 …했다 (도치)" }],
              ["(4)", "What matters is not how much you know but how you use it.", "중요한 것은 얼마나 많이 아느냐가 아니라 그것을 어떻게 사용하느냐이다.", null,
                { explain: "not A but B: A가 아니라 B" }],
              ["(5)", "Only when we listen carefully can we understand others.", "주의 깊게 들을 때에만 우리는 다른 사람을 이해할 수 있다.", null,
                { explain: "Only + 부사절이 문두 → 주절 도치 (can we)" }],
              ["(6)", "She is the last person to tell a lie.", "그녀는 결코 거짓말을 할 사람이 아니다.", null,
                { explain: "the last person to ~: 결코 ~하지 않을 사람" }],
            ],
          },
        ],
      },
    ],
  });
})();
