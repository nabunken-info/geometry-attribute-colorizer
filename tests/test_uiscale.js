"use strict";
/*
 * 文字の大きさが画面全体で揃うか。
 *
 * 現地で年配の方に「読みづらい」と言われた(2026-10)。ブラウザのピンチで
 * 拡大され、そのままビューをズームしたため「画面は拡大されたまま、ビューだけ
 * 縮む」という分からない状態になった。拡大の手段がブラウザしか無かったのが
 * 原因なので、アプリの中で変えられるようにした。
 *
 * 仕組みは「すべての font-size を calc(Npx * var(--ui-scale)) で書く」だけ。
 * **1つでも直書きが残ると、そこだけ小さいまま取り残される**。
 * 入力欄の型を書き足し忘れて日付欄だけ白くなった件(v1.29.1)と同じ型なので、
 * ここで検査する。
 */
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const styles = html.match(/<style>[\s\S]*?<\/style>/g) || [];
ok(styles.length === 1, "<style> は1つ", styles.length + "個");
const css = styles.join("\n");

/* ---------- 倍率そのもの ---------- */
ok(/--ui-scale:\s*1\s*;/.test(css), "既定の倍率は 1(何もしなければ今までどおり)");
ok(css.indexOf("--ui-scale") < css.indexOf("var(--ui-scale)"),
   "変数は使う前に :root で定義されている");

/* ---------- 直書きが残っていないか ---------- */
{
  // calc(...) の中の px は対象外。素の "font-size: 12px" だけを探す
  const bare = [];
  const re = /font-size:\s*([0-9.]+)px/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const tail = css.slice(Math.max(0, m.index - 6), m.index);
    if (!tail.includes("calc(")) bare.push(m[0]);
  }
  ok(bare.length === 0,
     "**倍率の付かない font-size が無い**(1つでも残るとそこだけ取り残される)",
     bare.length ? bare.join(" / ") : "0件");
}
{
  const scaled = (css.match(/font-size:\s*calc\([0-9.]+px \* var\(--ui-scale\)\)/g) || []).length;
  ok(scaled >= 50, "倍率付きの font-size が揃っている", scaled + "件");
}

/* ---------- 切り替えの中身 ---------- */
{
  const m = html.match(/const UI_SCALES = \[([^\]]+)\]/);
  ok(!!m, "倍率の一覧がある");
  if (m) {
    const v = m[1].split(",").map((x) => parseFloat(x.trim()));
    ok(v[0] === 1, "最初は等倍(既定で見た目が変わらない)", String(v[0]));
    ok(v.every((x, i) => i === 0 || x > v[i - 1]), "だんだん大きくなる", v.join(" < "));
    const names = html.match(/const UI_SCALE_NAMES = \[([^\]]+)\]/);
    ok(!!names && names[1].split(",").length === v.length,
       "倍率と呼び名の数が合っている(ずれると表示が噛み合わない)");
  }
}
ok(/id="text-size"/.test(html), "切り替えるボタンが画面にある");
ok(/applyUIScale\(typeof data\.uiScale/.test(html),
   "**次に開いたときも覚えている**(毎回やり直させない)");
ok(/layoutOverlays\(\);/.test(html.slice(html.indexOf("function applyUIScale"))),
   "大きさを変えたら四隅の配置を取り直す(部品の高さが変わるため)");

/* ---------- ピンチ拡大の案内 ---------- */
ok(/visualViewport/.test(html), "ブラウザのピンチ拡大を見ている");
ok(/アプリからは戻せません/.test(html),
   "**こちらから戻せないことを書いている**(できない約束をしない)");

/* ---------- 起動できないときの画面は対象外 ---------- */
{
  // 設定を読む前に出る画面なので、倍率を掛けると逆に読めなくなる場面がある
  const outside = html.replace(/<style>[\s\S]*?<\/style>/g, "");
  const n = (outside.match(/font-size:\s*[0-9.]+px/g) || []).length;
  ok(n === 2, "起動失敗画面の文字は倍率を掛けない(設定が読めない場面のため)", n + "件");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
