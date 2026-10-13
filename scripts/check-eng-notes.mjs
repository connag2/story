// 영어 본문 해설(data/english-notes-*.js) 점검: node scripts/check-eng-notes.mjs [파일...]
//  - 단원 id 가 팩에 있는지, 문장 수가 같은지
//  - 끊어 읽기 조각을 이어 붙이면 원문(정답으로 채운 문장)과 같은지
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { loadPack, fill } from "./eng-lines.mjs";
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(new URL("../data/", import.meta.url)).filter((f) => f.startsWith("english-notes-")).map((f) => "data/" + f);
const notes = {};
globalThis.STORY = { addEnglishNotes(pid, m) { notes[pid] = Object.assign(notes[pid] || {}, m); } };
for (const f of files) new Function(readFileSync(f, "utf8"))();
const norm = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
let units = 0, lines = 0;
for (const [pid, m] of Object.entries(notes)) {
  const p = loadPack(pid);
  for (const [uid, n] of Object.entries(m)) {
    const u = p.units.find((x) => x.id === uid);
    assert.ok(u, `${pid}/${uid}: 팩에 없는 단원`);
    assert.ok(n.gist && Array.isArray(n.flow) && n.flow.length, `${pid}/${uid}: gist/flow 없음`);
    assert.equal(n.lines.length, u.lines.length, `${pid}/${uid}: 문장 수 다름 (${n.lines.length} vs ${u.lines.length})`);
    n.lines.forEach((ln, i) => {
      assert.ok(Array.isArray(ln.chunks) && ln.chunks.length, `${pid}/${uid}[${i}]: chunks 없음`);
      ln.chunks.forEach((c) => assert.ok(Array.isArray(c) && c.length === 2 && c[0] && c[1], `${pid}/${uid}[${i}]: 조각 모양 [영어, 뜻]`));
      assert.equal(norm(ln.chunks.map((c) => c[0]).join(" ")), norm(fill(u.lines[i])), `${pid}/${uid}[${i}]: 끊어 읽기를 이으면 원문과 달라요`);
      lines++;
    });
    units++;
  }
}
console.log(`ok — 영어 본문 해설 ${units}개 지문 · ${lines}문장 (끊어 읽기 = 원문)`);
