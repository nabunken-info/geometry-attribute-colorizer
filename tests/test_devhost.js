"use strict";
/*
 * 「開発版」の印を出すかどうか。
 *
 * 個人リポジトリの公開ページを開発版、奈文研の公開ページを安定版として
 * 両方生かす運用にする。アプリは版の数字(v1.36.0)しか出しておらず、
 * **それが安定版かどうかは画面から分からない**。
 * 現場の人が古いブックマークで開発版を開いたときに気づけるよう、印を出す。
 *
 * 間違えて出すのも、出し損ねるのも困る。
 * - 出し損ね → 現場で試験中の版が使われる
 * - 誤って表示 → 安定版を使っている人を不安にさせる
 */
const { isDevHost } = require("./extracted.js");

let pass = 0, fail = 0;
const ok = (c, n, extra) => { c ? pass++ : fail++; console.log("  " + (c ? "OK" : "NG!!") + ": " + n + (extra ? "  " + extra : "")); };

const S = "https://nabunken.github.io/geometry-attribute-colorizer/";

/* ---------- 安定版の公開先が決まっていないうちは、何も出さない ---------- */
ok(!isDevHost("reisyu.github.io", "https:", ""),
   "**安定版のURLが空なら出さない**(いまはここが唯一の公開先。出すほうが嘘になる)");
ok(!isDevHost("reisyu.github.io", "https:", null), "nullでも出さない");
ok(!isDevHost("reisyu.github.io", "https:", undefined), "undefinedでも出さない");

/* ---------- 決まったあと ---------- */
ok(isDevHost("reisyu.github.io", "https:", S), "個人の公開ページでは出す");
ok(!isDevHost("nabunken.github.io", "https:", S), "**安定版では出さない**");
ok(isDevHost("example.github.io", "https:", S), "知らないホストでは出す");

/* ---------- 開発中の手元 ---------- */
ok(isDevHost("localhost", "http:", S), "localhostでは出す(実際に開発版なので正しい)");
ok(isDevHost("127.0.0.1", "http:", S), "127.0.0.1でも出す");

/* ---------- オフライン配布版 ---------- */
ok(!isDevHost("", "file:", S),
   "**オフライン配布版では出さない**(リリース版から作るものなので開発版ではない)");
ok(!isDevHost("localhost", "file:", S), "file: なら他の条件によらず出さない");

/* ---------- 壊れた設定で落ちない ---------- */
ok(!isDevHost("reisyu.github.io", "https:", "これはURLではない"),
   "URLとして読めない値なら出さない(設定ミスで全員に出さないほうが安全)");
ok(!isDevHost("reisyu.github.io", "https:", "   "), "空白だけでも出さない");

/* ---------- 同じホストなら、パスが違っても安定版 ---------- */
ok(!isDevHost("nabunken.github.io", "https:", "https://nabunken.github.io/別のパス/"),
   "判定はホストだけで行う(パスは見ない)");

/* ---------- 独自ドメインに移っても効く ---------- */
{
  const custom = "https://ishigaki.nabunken.go.jp/";
  ok(!isDevHost("ishigaki.nabunken.go.jp", "https:", custom), "独自ドメインでも安定版と分かる");
  ok(isDevHost("nabunken.github.io", "https:", custom),
     "**移転後は、前の公開先が開発版扱いになる**(定数を替えれば追従する)");
}

console.log("");
console.log("===== " + pass + "成功 / " + fail + "失敗 =====");
process.exit(fail ? 1 : 0);
