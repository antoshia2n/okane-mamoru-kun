/**
 * 表の読み書き。すべて自分のアプリのサーバー（/api/db）を通す。
 * 画面は公開キーで Supabase に直接触らない（2026-07-30 の決定）。
 * 共通部品の supabase は VITE_DB_GATEWAY を見て自動でサーバー経由に切り替わる。
 *
 * 2026-08-27：mo_events（イベント）と mo_borrowings（追加で借りた記録）を足した。
 * 古い mo_cards / mo_debts はここから読まない。中身はイベントへ移してある。
 * 表そのものは 2026-08-27 に落とした（Supabase に無い）。備考と終わりの月は先に移してある。
 */
import { supabase } from "shia2n-core";
import {
  ACCOUNT_TABLE, PLAN_TABLE, BALANCE_TABLE, EVENT_TABLE, BORROWING_TABLE,
} from "../constants.js";

async function run(q) {
  const { data, error } = await q;
  if (error) throw new Error(error.message ?? "読み書きできませんでした");
  return data ?? [];
}

export const loadAll = async () => {
  const [accounts, plans, balances, events, borrowings] = await Promise.all([
    run(supabase.from(ACCOUNT_TABLE).select("*").order("id")),
    run(supabase.from(PLAN_TABLE).select("*").order("plan_date", { nullsFirst: false })),
    run(supabase.from(BALANCE_TABLE).select("*").order("balance_date", { ascending: false })),
    run(supabase.from(EVENT_TABLE).select("*").order("id")),
    run(supabase.from(BORROWING_TABLE).select("*").order("borrowed_on", { ascending: false })),
  ]);
  return { accounts, plans, balances, events, borrowings };
};

/* ── その回（mo_plans） ────────────────────────────────────────────── */

export const savePlan = async (row) => {
  if (row.id) {
    const { id, ...changes } = row;
    return run(supabase.from(PLAN_TABLE).update(changes).eq("id", id).select());
  }
  return run(supabase.from(PLAN_TABLE).insert(row).select());
};

/** 対で登録された予定は、片方を動かすともう片方も動かす */
export const movePair = async (pairKey, exceptId, changes) => {
  if (!pairKey) return [];
  return run(
    supabase.from(PLAN_TABLE).update(changes).eq("pair_key", pairKey).neq("id", exceptId).select()
  );
};

export const deletePlan = (id) => run(supabase.from(PLAN_TABLE).delete().eq("id", id).select());

/**
 * 繰り返しの決まりから作った回を入れる。
 * 同じ回を 2 度作らないよう、呼ぶ側（calc.js の missingOccurrences）で
 * すでにある日付と鍵を除いてある。0 件なら何もしない。
 */
export const addOccurrences = async (rows) => {
  if (!rows || rows.length === 0) return [];
  return run(supabase.from(PLAN_TABLE).insert(rows).select());
};

export const markDone = (accountId, fromDate, toDate) =>
  run(
    supabase.from(PLAN_TABLE).update({ status: "済" })
      .eq("account_id", accountId).eq("status", "未")
      .gte("plan_date", fromDate).lte("plan_date", toDate).select()
  );

/* ── 口座と実残高 ──────────────────────────────────────────────────── */

export const saveAccount = (row) => {
  const { id, ...changes } = row;
  return run(supabase.from(ACCOUNT_TABLE).update(changes).eq("id", id).select());
};

export const putBalance = (row) =>
  run(supabase.from(BALANCE_TABLE).upsert(row, { onConflict: "account_id,balance_date" }).select());

/* ── イベントと、追加で借りた記録 ──────────────────────────────────── */

const crud = (table) => ({
  save: (row) => {
    if (row.id) {
      const { id, ...changes } = row;
      return run(supabase.from(table).update(changes).eq("id", id).select());
    }
    return run(supabase.from(table).insert(row).select());
  },
  remove: (id) => run(supabase.from(table).delete().eq("id", id).select()),
});

export const eventApi     = crud(EVENT_TABLE);
export const borrowingApi = crud(BORROWING_TABLE);

/* ── 実績を入れる（確定の画面から呼ぶ） ──────────────────────────── */

/**
 * 動き 1 件に実額を入れて確定させる。
 *
 *   amount          いつも「いま使う額」。実績が入ればここが実額になる
 *   planned_amount  実績を入れる前の見込み額。最初に確定させたときだけ書く
 *   status          済
 *   certainty       確定
 *
 * この持ち方にしたのは、amount を読んでいる側（朝の報告を出す口・今日の画面）を
 * 1 行も直さずに、見込みと実績の両方を持てるようにするため。
 *
 * 対で登録されているもの（口座をまたぐ出と入り）は、もう片方も同じ額で確定させる。
 * 借入やカードのように返済残高を持つ登録なら、その額だけ残高を減らす。
 */
export const settlePlan = async ({ plan, actual, event, reduceBalance }) => {
  const saved = await savePlan({
    id: plan.id,
    amount: actual,
    planned_amount: plan.planned_amount ?? plan.amount,
    status: "済",
    certainty: "確定",
  });

  if (plan.pair_key) {
    await movePair(plan.pair_key, plan.id, {
      amount: actual,
      status: "済",
      certainty: "確定",
    });
  }

  if (reduceBalance && event && event.balance_remaining != null) {
    const left = Number(event.balance_remaining) - Number(actual);
    await eventApi.save({ id: event.id, balance_remaining: left < 0 ? 0 : left });
  }

  return saved;
};

/** 確定を取り消して見込みに戻す（入れ間違いの戻し方） */
export const unsettlePlan = (plan) =>
  savePlan({
    id: plan.id,
    amount: plan.planned_amount ?? plan.amount,
    planned_amount: null,
    status: "未",
    certainty: "見込み",
  });
