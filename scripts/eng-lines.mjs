// 영어 공부장 팩의 본문을 문장별로 보기 (해설 쓰기용)
//   node scripts/eng-lines.mjs <팩id> [단원id...]
// 고르기 자리 {0} 은 정답으로 채워서 보여 줘요.
import { readFileSync } from "node:fs";
export const loadPack = (id) => JSON.parse(readFileSync(new URL(`../공부/packs/${id}.json`, import.meta.url), "utf8"));
export const fill = (l) => l.en.replace(/\{(\d+)\}/g, (_, i) => { const c = l.c && l.c[+i]; return c ? c.o[c.a] : ""; });
if (import.meta.url === `file://${process.argv[1]}`) {
  const [id, ...uids] = process.argv.slice(2);
  const p = loadPack(id);
  for (const u of p.units) {
    if (uids.length && !uids.includes(u.id)) continue;
    console.log(`\n### ${u.id} · ${u.title}${u.topicKo ? " · " + u.topicKo : ""}`);
    (u.lines || []).forEach((l, i) => console.log(`[${i}] ${fill(l)}\n    ↳ ${l.ko}`));
  }
}
