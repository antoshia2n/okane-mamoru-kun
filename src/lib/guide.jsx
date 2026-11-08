// 2026-11-08 ガイドの「？」（直す順 4・Naoki OK 18:38。ほかのアプリと同じ形・shia2n-core 1.17.0 の shell/guide.js）
// 右上の「ガイド」が「あり」のとき、上の帯の画面の切り替えの横に「？」を出す。押すと（マウスなら乗せると）いまの画面の説明。
// 各画面のまとまりには、もう説明の文が付いているので、「？」は画面ごとに 1 つだけ。文の正本はここ。
import React, { useSyncExternalStore } from "react";
import { guideOn, onGuide, ensureGuideCss } from "shia2n-core/shell/guide.js";

ensureGuideCss();
const useGuide = () => useSyncExternalStore(onGuide, guideOn, () => false);

export const TAB_GUIDE = {
  "今日": "開いて最初に見る画面です。口座ごとに、次にいくら足りなくなるか・いつまでに入れるかと、月別の収支予測が出ます。見るだけで触りません",
  "確定": "週に 1 回だけ触る画面です。お金の動きに実際の金額を入れ、いまの残高を入れます",
  "登録": "続いているもの（契約・借入・カード・入金元）を 1 件ずつ作る画面です。たまにしか触りません",
  "カレンダー": "引き落とし日と入金日を、月の並びで見ます。日を押すと、その日の内訳と入力が開きます",
  "推移": "月末時点の予定残高を口座ごとに並べ、実際の残高とのずれを見ます",
};

export function TabHelp({ tab }) {
  const on = useGuide();
  const d = TAB_GUIDE[tab];
  if (!on || !d) return null;
  return <button type="button" className="s2-qh" data-t={tab} data-d={d} aria-label={`${tab}の画面とは`} aria-expanded="false">?</button>;
}
