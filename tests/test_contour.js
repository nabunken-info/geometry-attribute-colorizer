"use strict";
/*
 * 読み戻した台紙GLBを「輪郭モデル」と見分けられるか。
 *
 * SVG立面図は**頂点の並びをそのまま輪郭として**使う。DXFから読んだときは
 * 印(isContour)が付くが、GLBや点検データ(ZIP)から開くと付かず、
 * 「SVG書き出しはDXFから読み込んだモデルでのみ利用できます」で止まっていた。
 * 運用は「初回だけDXF、以後はZIP」を勧めているのに、報告書用の図を出すには
 * DXFを読み直すしかない——という食い違いになっていた(v1.32.0で解消)。
 *
 * 書き出し側に印を入れたが、**それ以前に作った台紙GLBには印が無い**。
 * 作り直させるとDXFの読み直しでIDが振り直され、記録との対応が切れる。
 * そこで形からも見分ける。ここではその見分け方を検証する。
 */
const { looksLikeContour } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

/* n角形を扇状に分割したインデックスを作る(耳切りと同じ三角形数 n-2) */
const fan = (n) => {
  const out = [];
  for (let i = 1; i + 1 < n; i++) out.push(0, i, i + 1);
  return out;
};

/* ---------- 輪郭と見なすもの ---------- */
ok(looksLikeContour(3, [0, 1, 2]), "三角形(3頂点1枚)は輪郭");
ok(looksLikeContour(4, fan(4)), "四角形(4頂点2枚)は輪郭");
ok(looksLikeContour(8, fan(8)), "八角形(8頂点6枚)は輪郭");
ok(looksLikeContour(40, fan(40)), "石らしい40頂点の輪郭");
{
  // 扇でなく耳切りでも、三角形の数と使う頂点は同じ
  const ear = [0,1,2, 2,3,4, 4,5,0, 0,2,4];   // 6頂点4枚
  ok(looksLikeContour(6, ear), "**扇状でなくても判定できる**(耳切りの並び)");
}

/* ---------- 輪郭でないもの ---------- */
{
  // 立方体: 8頂点12枚。n-2=6 とは合わない
  ok(!looksLikeContour(8, new Array(36).fill(0).map((_, i) => i % 8)),
     "立方体(8頂点12枚)は輪郭ではない");
}
ok(!looksLikeContour(100, fan(50)), "三角形の数が足りないものは輪郭ではない");
ok(!looksLikeContour(4, [0, 1, 2, 0, 2, 3, 0, 1, 3]), "三角形が多すぎるものは輪郭ではない");
{
  // 頂点が余る形。輪郭なら全ての頂点が辺に使われる
  const idx = fan(5);            // 5頂点3枚ぶん
  ok(!looksLikeContour(6, idx.concat([0, 1, 2])),
     "使われない頂点が残る形は輪郭ではない");
}

/* ---------- 壊れた入力 ---------- */
ok(!looksLikeContour(5, null), "インデックスが無ければ輪郭と見なさない");
ok(!looksLikeContour(0, []), "頂点が無ければ輪郭ではない");
ok(!looksLikeContour(2, [0, 1, 0]), "2頂点では輪郭にならない");
ok(!looksLikeContour(4, [0, 1, 9, 0, 2, 3]), "範囲外のインデックスがあれば断る");
ok(!looksLikeContour(4, [0, 1, -1, 0, 2, 3]), "負のインデックスがあれば断る");
{
  // 型付き配列でも動く(GLBから読むとこちらになる)
  ok(looksLikeContour(6, Uint16Array.from(fan(6))), "Uint16Arrayでも判定できる");
  ok(looksLikeContour(6, Uint32Array.from(fan(6))), "Uint32Arrayでも判定できる");
}

/* ---------- 取り違えの代償を確かめる ---------- */
{
  // 四角い板は「輪郭」と見なされる。これは誤判定ではなく、実際に輪郭である。
  // 一般のメッシュを誤って拾わないことのほうが大事
  ok(looksLikeContour(4, fan(4)), "四角い板は輪郭として扱ってよい(実際に多角形)");
  // 典型的な3Dメッシュは拾わない
  ok(!looksLikeContour(20, fan(10).concat(fan(10).map((v) => v + 10))),
     "2つの面を持つメッシュは拾わない");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
