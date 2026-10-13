"use strict";
/*
 * 日本語の強調が効かない書き方を見つける。
 *
 * CommonMarkでは、**開きの `**` の直後が記号**で、かつ直前が文字だと強調が
 * 始まらない。`**` がそのまま文字として表示される。閉じ側も対称の規則がある。
 *
 *   NG   公開している**「セグメンター」の出力を読めます**
 *   OK   公開している「セグメンター」の出力を**読めます**
 *   OK   **「セグメンター」の出力を読めます**          ← 行頭なら開ける
 *   OK   **残す範囲**(複数可)                          ← 閉じの直後が記号なのは問題ない
 *
 * **開きと閉じを区別しないと使い物にならない。** 同じ「文字 ** 記号」の並びでも、
 * 開きなら壊れていて、閉じなら正しい。そこで `**` を順に数えて役割を決める。
 *
 * CLAUDE.mdに規則として書いてあるのに繰り返し踏んでいる(リリース文で3か所、
 * READMEで2か所)。目で見て気づけないので機械に見させる。
 */
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

const isSpace = (c) => c === undefined || /\s/.test(c);
const isPunct = (c) => c !== undefined && /[\p{P}\p{S}]/u.test(c);

/* 強調として成立しない `**` を拾う。戻りは [{index, role}] */
function brokenEmphasis(text) {
  const out = [];
  let open = true;                 // 次に現れる `**` の役割
  for (let i = 0; i + 1 < text.length; i++) {
    if (text[i] !== "*" || text[i + 1] !== "*") continue;
    const before = text[i - 1];
    const after = text[i + 2];
    if (open) {
      // 開き: 直後が空白なら開けない。直後が記号なら、直前が空白か記号でないと開けない
      if (isSpace(after) || (isPunct(after) && !(isSpace(before) || isPunct(before)))) {
        out.push({ index: i, role: "開き" });
      }
    } else {
      // 閉じ: 直前が空白なら閉じられない。直前が記号なら、直後が空白か記号でないと閉じられない
      if (isSpace(before) || (isPunct(before) && !(isSpace(after) || isPunct(after)))) {
        out.push({ index: i, role: "閉じ" });
      }
    }
    open = !open;
    i++;                           // `**` の2文字目を読み飛ばす
  }
  return out;
}

/* コードは Markdown として解釈されないので外す。

   **インライン コードは空白で潰さない。** 強調の直後にコードが来ることがあり
   (例: `**`date` が対象から漏れていた**`)、空白にすると「直後が空白だから
   開けない」と誤って判定する。同じ長さの文字に置き換えて前後関係を保つ。
   ブロックは行ごと落として構わないので空白にする */
function stripCode(text) {
  const blankBlock = (m) => m.replace(/[^\n]/g, " ");
  const asWord = (m) => "x".repeat(m.length);
  return text
    .replace(/^(\s*)(```|~~~)[\s\S]*?^\s*\2[^\n]*$/gm, blankBlock)
    .replace(/`[^`\n]*`/g, asWord);
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/* ---------- 検出そのものを先に確かめる(見逃す検査は無いのと同じ) ---------- */
{
  const bad = (s) => brokenEmphasis(s).length > 0;
  ok(bad("公開している**「セグメンター」を読めます**"), "効かない開きを見つける");
  ok(!bad("公開している「セグメンター」を**読めます**"), "正しい書き方は拾わない");
  ok(!bad("**「セグメンター」を読めます**"), "行頭の開きは効くので拾わない");
  ok(!bad("任意の属性に**残す範囲**(複数可)を決める"), "**閉じの直後が記号なのは問題ない**");
  ok(!bad("- **フィルタ** — 説明"), "よくある箇条書きを誤検出しない");
  // 記号の直後の `**` は、直後が文字なら**開き**として成立する
  ok(!bad("「セグメンター」**を読めます**"), "記号の直後でも、直後が文字なら開ける");
  ok(bad("これは**「かぎ括弧で終わる強調」**です"), "記号で閉じると効かない");
  ok(!bad("**強調**と**強調**が2つ"), "1行に2組あっても数え方がずれない");
  ok(!bad("コードは `a**b**c` のように無視する".replace(/`[^`]*`/g, " ")), "コードの中は見ない");
  ok(brokenEmphasis("公開している**「あ」です**")[0].role === "開き", "壊れている側を言える");
}

/* ---------- 実際のファイルを見る ---------- */
/* 失敗にするのは、これから書き足していく2つ。
   CHANGELOG.md と SPECIFICATION.md には**過去に書いた分の積み残し**がある。
   直すのは歴史的な文面の書き換えになるので、件数だけ出して別に片付ける */
const FILES = ["README.md", "CLAUDE.md"];
const BACKLOG = ["CHANGELOG.md", "SPECIFICATION.md"];
const root = path.join(__dirname, "..");

for (const name of FILES) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) { ok(false, name + " が見つからない"); continue; }
  const raw = fs.readFileSync(p, "utf8");
  const text = stripCode(raw);
  const hits = brokenEmphasis(text).map((h) => {
    const ln = lineOf(text, h.index);
    return "  " + ln + "行目(" + h.role + "): " + raw.split("\n")[ln - 1].trim().slice(0, 56);
  });
  ok(hits.length === 0, name + " に効かない強調が無い",
     hits.length ? "\n    " + hits.join("\n    ") : raw.split("\n").length + "行を検査");
}

/* ---------- 積み残しは件数だけ見える形にする ---------- */
for (const name of BACKLOG) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) continue;
  const n = brokenEmphasis(stripCode(fs.readFileSync(p, "utf8"))).length;
  console.log("  --: " + name + " の積み残し " + n + "件(ここでは失敗にしない)");
}

/* ---------- 閉じ忘れ ---------- */
for (const name of FILES.concat(BACKLOG)) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) continue;
  const n = (stripCode(fs.readFileSync(p, "utf8")).match(/\*\*/g) || []).length;
  ok(n % 2 === 0, name + " の ** が偶数(閉じ忘れが無い)", n + "個");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
