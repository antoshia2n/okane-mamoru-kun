export const APP_ID   = "okane-mamoru-kun";
export const APP_NAME = "お金を守るくん";
export const TABS = ["今日", "カレンダー", "推移", "入力", "負債とカード", "使い方"];

export const ACCOUNT_TABLE   = "mo_accounts";
export const PLAN_TABLE      = "mo_plans";
export const BALANCE_TABLE   = "mo_balances";
export const EVENT_TABLE     = "mo_events";
export const BORROWING_TABLE = "mo_borrowings";

/**
 * 2026-08-27：持ち方を 2 段にした。
 *   mo_events   ＝ 続きもの（イベント）。名前・口座・出入り・繰り返し・返済残高・カードの枠
 *   mo_plans    ＝ その回。日付ごとの 1 件。event_id でイベントにぶら下がる
 * カードと負債は mo_events が持つ。古い mo_cards / mo_debts はもう読まない
 * （表は残っている。消すかどうかは 2026-09-13 に決める）。
 */

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

/** その回を先まで作っておく月数 */
export const MONTHS_AHEAD = 4;
/** 金額が毎月変わるものの見込みを、直近いくつの確定から出すか */
export const LOOKBACK = 6;
