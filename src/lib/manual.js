// 共通の外枠（右上の ？）に渡すマニュアル（2026-10-31 開発部・全アプリの右上をそろえる）。
// 文の正本は「使い方」タブと同じ GUIDE（screens/Guide.jsx）。ここは区切って並べるだけで、文は書かない。
import { GUIDE } from "../screens/Guide.jsx";

/** **（太字の印）と、行をつないだときに入った句点のあとの空白を落とす */
const plain = (s) => String(s || "").replace(/\*\*/g, "").replace(/([。、])\s+/g, "$1").trim();

/** 1 つの文を「見出し＋説明」に分ける。「**今日**：…」は「今日」を見出しに、それ以外は最初の 1 文を見出しにする */
function itemOf(text) {
  const head = /^\*\*([^*]+)\*\*：/.exec(String(text || ""));
  if (head) return { t: head[1], d: plain(String(text).slice(head[0].length)) };
  const s = plain(text);
  const i = s.indexOf("。");
  if (i < 0 || i === s.length - 1) return { t: s };
  return { t: s.slice(0, i + 1), d: s.slice(i + 1) };
}

function itemsOf(blocks) {
  const out = [];
  for (const [kind, value] of blocks) {
    if (kind === "ol" || kind === "ul") value.forEach((v) => out.push(itemOf(v)));
    else if (kind === "table") value.forEach(([a, b]) => out.push({ t: plain(a), d: plain(b) }));
    else out.push(itemOf(value));
  }
  return out;
}

export const MANUAL = {
  intro: "口座ごとに、この日までにいくら足しておく必要があるかを出すアプリです。ふだん触るのは、週に 1 回の「確定」タブだけです。",
  sections: GUIDE.map((s) => ({ title: s.title, items: itemsOf(s.blocks) })).filter((s) => s.items.length),
};
