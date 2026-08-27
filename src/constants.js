export const APP_ID   = "okane-mamoru-kun";
export const APP_NAME = "お金を守るくん";

/**
 * 画面は「手ごと」に分ける（2026-08-27 Naoki 差し戻し）。
 *   今日・カレンダー・推移 ＝ 見るだけ。触らない
 *   確定 ＝ 週 1 回 30 分で触る唯一の画面。動きに実額を入れる
 *   登録 ＝ 続いているものを 1 件作る。たまにしか触らない
 *
 * 言葉（2026-08-27 Naoki 確定）
 *   登録   ＝ 続いているもの 1 件（契約・借入・カード・入金元）
 *   動き   ＝ お金が動く 1 回（日付・口座・金額を持つ）
 *   見込み／実績 ＝ 動きの金額の軸
 * 「予定」という言い方はもう使わない。
 */
export const TABS = ["今日", "確定", "登録", "カレンダー", "推移", "使い方"];

export const ACCOUNT_TABLE   = "mo_accounts";
export const PLAN_TABLE      = "mo_plans";      // 動き
export const BALANCE_TABLE   = "mo_balances";
export const EVENT_TABLE     = "mo_events";     // 登録
export const BORROWING_TABLE = "mo_borrowings";

export const MOVABLE     = ["動かせない", "期日をずらせる", "金額を変えられる"];
export const CERTAINTY   = ["確定", "見込み"];
export const KINDS       = ["法人", "個人"];
export const AMOUNT_RULE = ["毎回同じ", "毎月変わる"];

export const RECUR_KIND = [
  { value: "monthly_day", label: "毎月◯日" },
  { value: "month_end",   label: "毎月 月末" },
  { value: "weekly",      label: "毎週◯曜" },
  { value: "once",        label: "1 回だけ" },
];

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** 動きを先まで作っておく月数 */
export const MONTHS_AHEAD = 4;
/** 金額が毎月変わるものの見込みを、直近いくつの実績から出すか */
export const LOOKBACK = 6;
