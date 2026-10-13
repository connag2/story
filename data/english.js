// 영어Ⅱ — 기존 "고2 영어 공부장"(공부/ 폴더)을 공부방 안에 그대로 띄움
// 비상(홍민표) 영어Ⅱ 1·2과, 2025·2026 9월 고2 모의고사 자료는 그 앱의 packs/ 에 들어 있어요.
STORY.addSubject({
  id: "english",
  name: "영어Ⅱ",
  icon: "Aa",
  color: "#e0742b",
  desc: "고2 영어 공부장 · 비상(홍민표) 1·2과 · 9월 모의고사",
  embed: "공부/고2 영어 공부장.html",
  embedNote: "수업 · 읽기 · 고르기 · 쓰기 · 배열 · 실전 · 영작",
  exam: {
    count: "선다형 22문항 (90점) + 서답형 2문항 (10점)",
    range: ["Unit 1-2 (p.10-59) → 공부장의 '비상 1·2과'", "교과서 연계 심화 자료"],
  },
  units: [],
});

// 영어 본문 해설 (data/english-notes-*.js) — 화면은 js/english.js (#/eng)
//   STORY.addEnglishNotes(팩id, { 단원id: { topic?, gist, flow: [], tips: [], lines: [{ role, chunks: [[영어, 뜻]], words: [[단어, 뜻]], tip }] } })
STORY.engNotes = {};
STORY.addEnglishNotes = function (pid, map) { STORY.engNotes[pid] = Object.assign(STORY.engNotes[pid] || {}, map); };
