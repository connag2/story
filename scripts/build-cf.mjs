// Cloudflare Pages 빌드: 공개할 파일만 dist/ 로 복사 + AI 성우 허용 글 목록을 미리 만들어 둠
//   사용: node scripts/build-cf.mjs   (Cloudflare 대시보드의 빌드 명령)
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
process.chdir(ROOT);
const OUT = "dist";
const PUBLIC = ["index.html", "sw.js", "manifest.webmanifest", "_headers", "assets", "css", "data", "js", "vendor", "공부"];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);
for (const p of PUBLIC) await cp(p, `${OUT}/${p}`, { recursive: true });

// Cloudflare 에서는 문자열 코드 실행(new Function)이 막혀 있어서 여기서 미리 계산해요 (api/tts.js)
const { buildAllowList } = await import("../api/tts.js");
const list = [...(await buildAllowList())];
await writeFile(`${OUT}/_tts-allow.json`, JSON.stringify(list));
console.log(`dist/ 준비 완료 · AI 성우 허용 글 ${list.length}개`);
