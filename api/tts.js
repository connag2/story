// 🎙 AI 성우 (자연스러운 음성) — 영어 본문 해설의 읽어 주기에서 씀
//   GET /api/tts                         → { enabled, provider, voices: [{ id, name, desc, tag }] }
//   GET /api/tts?v=성우&s=스타일&t=글     → audio/mpeg
//
// 켜는 법: Vercel 환경 변수에 OPENAI_API_KEY 를 넣고 다시 배포 (OpenAI 음성 모델 gpt-4o-mini-tts).
//   키가 없으면 enabled:false → 앱은 기기에 들어 있는 목소리로 읽어요(무료).
// 성우 바꾸기·늘리기: 아래 VOICES 목록을 고치거나, 환경 변수 TTS_VOICES 에 같은 모양의 JSON 을 넣으면 그걸 써요.
//   모델은 TTS_MODEL 로 바꿀 수 있어요. 다른 회사 음성을 쓰려면 PROVIDERS 에 함수 하나를 더하면 돼요.
//
// 비용·Blob 아끼기: 같은 글·성우·스타일 요청은 Vercel CDN 이 1년 동안 기억해서 두 번째부터는 돈이 안 들어요.
//   Blob 저장소는 쓰지 않아요. 아무 글이나 읽히지 못하게, 공부 자료(본문 · 해석 · 끊어 읽기 · 단어)에 있는 글만 허락해요.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { HttpError, handle, json } from "./_lib.js";

export const VOICES = [
  { id: "coral", name: "코랄", desc: "밝고 귀여운 목소리", tag: "🎀" },
  { id: "nova", name: "노바", desc: "상냥한 선생님", tag: "🌸" },
  { id: "shimmer", name: "시머", desc: "맑고 부드러운", tag: "✨" },
  { id: "marin", name: "마린", desc: "최신 · 아주 자연스러운", tag: "🌊" },
  { id: "ballad", name: "발라드", desc: "따뜻하고 감성적인", tag: "🎵" },
  { id: "sage", name: "세이지", desc: "차분한", tag: "🍃" },
  { id: "cedar", name: "시더", desc: "최신 · 자연스러운 남자 목소리", tag: "🌲" },
  { id: "ash", name: "애쉬", desc: "또렷한 남자 목소리", tag: "🎙" },
];
const STYLES = {
  cute: "Speak in a bright, cheerful, cute and friendly voice, like a kind older sister tutoring a high-school student. Pronounce every word clearly.",
  normal: "Speak naturally and clearly, like a friendly teacher reading a textbook passage aloud.",
  calm: "Speak in a calm, gentle and soothing voice at a relaxed pace. Pronounce every word clearly.",
};
// 앱의 「미리 듣기」 문장 (js/english.js 와 같게)
export const PREVIEW = ["Hi! Let's read this passage together.", "안녕! 같이 읽어 볼까요?"];

const voices = () => { try { const v = JSON.parse(process.env.TTS_VOICES || "null"); if (Array.isArray(v) && v.length) return v; } catch (e) { /* 무시 */ } return VOICES; };
const norm = (s) => String(s || "").normalize("NFC").replace(/\s+/g, " ").trim();

const PROVIDERS = {
  async openai(text, voice, style) {
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.TTS_MODEL || "gpt-4o-mini-tts", voice, input: text, instructions: STYLES[style] || STYLES.normal, response_format: "mp3" }),
    });
    if (!r.ok) { console.error("tts", r.status, await r.text().catch(() => "")); throw new HttpError(502, "AI 음성을 만들지 못했어요. 기기 목소리로 읽을게요."); }
    return new Uint8Array(await r.arrayBuffer());
  },
};
const provider = () => (process.env.OPENAI_API_KEY ? "openai" : null);

// ── 읽어도 되는 글 목록 (서버 인스턴스마다 한 번 만들어 둠)
let allowed = null;
async function allowList() {
  if (allowed) return allowed;
  const root = process.cwd();
  const set = new Set(PREVIEW.map(norm));
  const add = (s) => { const t = norm(s); if (t) set.add(t); };
  const packsDir = join(root, "공부", "packs");
  const idx = JSON.parse(await readFile(join(packsDir, "index.json"), "utf8"));
  for (const p of idx.packs) {
    const pack = JSON.parse(await readFile(join(root, "공부", p.file), "utf8"));
    for (const u of pack.units) for (const l of u.lines || []) {
      add(l.en.replace(/\{(\d+)\}/g, (_, i) => { const c = l.c && l.c[+i]; return c ? c.o[c.a] : ""; }));
      add(String(l.ko || "").replace(/^•\s*/, ""));
    }
  }
  try {
    const voc = JSON.parse(await readFile(join(packsDir, "vocab.json"), "utf8")).m || {};
    for (const [w, k] of Object.entries(voc)) { add(w); add(k); }
  } catch (e) { /* 단어장 없음 */ }
  const notes = {};
  const STORY = { addEnglishNotes(pid, m) { notes[pid] = Object.assign(notes[pid] || {}, m); } };
  for (const f of (await readdir(join(root, "data"))).filter((x) => x.startsWith("english-notes-"))) {
    new Function("STORY", await readFile(join(root, "data", f), "utf8"))(STORY);
  }
  for (const m of Object.values(notes)) for (const n of Object.values(m)) for (const ln of n.lines || []) {
    (ln.chunks || []).forEach(([en, ko]) => { add(en); add(ko); });
    (ln.words || []).forEach(([w, k]) => { add(w); add(k); });
  }
  allowed = set;
  return set;
}

export function GET(req) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const list = voices();
    if (!q.get("t")) {
      return json({ enabled: !!provider(), provider: provider(), voices: list.map(({ id, name, desc, tag }) => ({ id, name, desc, tag })) }, 200, "public, max-age=300");
    }
    if (!provider()) throw new HttpError(503, "AI 성우가 아직 켜져 있지 않아요.");
    const text = norm(q.get("t"));
    const voice = list.find((v) => v.id === q.get("v"));
    const style = STYLES[q.get("s")] ? q.get("s") : "normal";
    if (!voice) throw new HttpError(400, "없는 성우예요.");
    if (text.length > 800) throw new HttpError(413, "글이 너무 길어요.");
    if (!(await allowList()).has(text)) throw new HttpError(403, "공부 자료에 있는 글만 읽어 줄 수 있어요.");
    const audio = await PROVIDERS[provider()](text, voice.voice || voice.id, style);
    return new Response(audio, {
      status: 200,
      headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=604800, s-maxage=31536000, immutable" },
    });
  });
}
