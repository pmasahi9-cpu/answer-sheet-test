// Windows에서 변호사시험 CBT 답안지 조건(맑은 고딕 16px, 줄 높이 24px, 너비 784px, word-break: break-all,
// white-space: normal)으로 시험용 글을 그려, 줄마다 들어간 글자를 잰다. 브라우저(크롬·엣지) × 화면 배율(1, 1.25, 1.5).
import { chromium } from "playwright";
import fs from "node:fs";
const texts = ["answer8.txt", "stress.txt", "sample.txt"];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
// contenteditable처럼 연속 공백은 공백+nbsp로(사라지지 않게)
const line = (l) => (l ? esc(l).replace(/ {2,}/g, (m) => " " + "\u00a0".repeat(m.length - 1)).replace(/^ /, "\u00a0") : "<br>");
const html = (T) => `<!doctype html><meta charset="utf-8"><style>body{margin:0}
#ed{font-family:"Malgun Gothic";font-size:16px;line-height:24px;width:784px;word-break:break-all;white-space:normal;overflow-wrap:break-word}</style>
<div id="ed">${T.split("\n").map((l) => "<div>" + line(l) + "</div>").join("")}</div>`;
const out = { os: process.platform, when: new Date().toISOString(), runs: [] };
for (const channel of ["chrome", "msedge", null]) {
  let b;
  try { b = await chromium.launch(channel ? { channel } : {}); } catch (e) { out.runs.push({ channel, error: String(e).slice(0, 200) }); continue; }
  for (const dsf of [1, 1.25, 1.5]) {
    const ctx = await b.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: dsf }); const p = await ctx.newPage();
    for (const f of texts) {
      await p.setContent(html(fs.readFileSync(f, "utf8"))); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
      const r = await p.evaluate(() => {
        const ed = document.getElementById("ed"), w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let n, L = {};
        while ((n = w.nextNode())) for (let i = 0; i < n.data.length; i++) { const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1); const bx = rg.getClientRects()[0]; if (!bx) continue; const k = Math.round(bx.top * 4) / 4; (L[k] = L[k] || []).push(n.data[i]); }
        const tops = Object.keys(L).map(Number).sort((a, b) => a - b);
        const c = document.createElement("canvas").getContext("2d"); c.font = '16px "Malgun Gothic"'; const mg = c.measureText("가나다라마바사").width; c.font = '16px "NoSuchFontX"'; const fb = c.measureText("가나다라마바사").width;
        const wid = {}; c.font = '16px "Malgun Gothic"'; for (const ch of ["가", "A", "a", "1", " ", ".", "(", ")", "甲"]) wid[ch] = c.measureText(ch).width;
        return { height: ed.getBoundingClientRect().height, lines: tops.map((k) => L[k].join("")), malgunInstalled: Math.abs(mg - fb) > 0.01, widths: wid, ua: navigator.userAgent };
      });
      out.runs.push({ channel: channel || "playwright-chromium", dsf, text: f, ...r });
      if (f === "sample.txt") await p.screenshot({ path: `results/sample_${channel || "pw"}_${dsf}.png` });
    }
    await ctx.close();
  }
  await b.close();
}
fs.writeFileSync("results/windows.json", JSON.stringify(out));
for (const r of out.runs) console.log(r.channel, r.dsf, r.text, r.error || `줄 ${r.lines.length} 맑은고딕 ${r.malgunInstalled}`);

// 윈도 맑은 고딕 글자 폭 표 — 캔버스 값은 영문·숫자가 화면 글꼴과 달라서(측정 #4: 한 줄 실제 폭 < 글자 합) 화면 글자(DOM)로 잰다.
// 같은 글자 20개 폭/20, 그리고 실제 답안 줄마다 DOM 폭과 표 합을 비교해 커닝 여부를 본다.
{
  const b = await chromium.launch({ channel: "chrome" }); const p = await b.newPage();
  await p.setContent('<meta charset="utf-8"><span id="s" style="font:16px/24px \'Malgun Gothic\';white-space:pre"></span>'); await p.evaluate(() => document.fonts.ready);
  const R = [[0x20, 0x7e], [0xa0, 0x24f], [0x2000, 0x2bff], [0x3000, 0x33ff], [0xac00, 0xd7a3], [0x4e00, 0x9fff], [0xf900, 0xfaff], [0xff00, 0xffef]];
  const tab = await p.evaluate((R) => {
    const s = document.getElementById("s"), out = [];
    const w1 = (ch) => { s.textContent = ch.repeat(20); return Math.round(s.getBoundingClientRect().width / 20 * 4096) / 4096; };
    for (const [a, z] of R) { let st = a, w0 = null; for (let u = a; u <= z + 1; u++) { const w = u <= z ? w1(String.fromCharCode(u)) : NaN; if (w !== w0) { if (w0 !== null) out.push([st, u - 1, w0]); st = u; w0 = w; } } }
    return out;
  }, R);
  const lines = out.runs.find((r) => r.text === "answer8.txt" && r.lines).lines.slice(0, 80);
  const kern = await p.evaluate((T) => { const s = document.getElementById("s"); return T.map((t) => { t = t.replace(/\n/g, ""); s.textContent = t; const W = s.getBoundingClientRect().width; let sum = 0; for (const ch of t) { s.textContent = ch.repeat(20); sum += s.getBoundingClientRect().width / 20; } return [t, W, sum]; }); }, lines);
  fs.writeFileSync("results/widths.json", JSON.stringify({ ranges: tab, kern }));
  console.log("폭 표 구간", tab.length); await b.close();
}
// 작업 흐름의 '결과 커밋' 단계가 바뀐 파일이 있는 채로 pull --rebase를 하다 멈춰서(측정 #2), 여기서 먼저 커밋해 둔다.
if (process.env.GITHUB_ACTIONS) {
  const { execSync } = await import("node:child_process");
  const sh = (c) => execSync(c, { stdio: "inherit" });
  sh('git config user.name "measure-bot"'); sh('git config user.email "measure-bot@users.noreply.github.com"');
  sh("git add results"); try { sh('git commit -m "Windows 측정 결과"'); } catch { console.log("바뀐 것 없음"); }
}
