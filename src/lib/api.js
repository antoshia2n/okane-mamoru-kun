/**
 * 表の読み書き。すべて自分のアプリのサーバー（/api/db）を通す。
 * 画面は公開キーで Supabase に直接触らない（2026-07-30 の決定）。
 * 共通部品の supabase は VITE_DB_GATEWAY を見て自動でサーバー経由に切り替わる。
 */
import { supabase } from "shia2n-core";
import {
  ACCOUNT_TABLE, PLAN_TABLE, BALANCE_TABLE, CARD_TABLE, DEBT_TABLE,
} from "../constants.js";

async function run(q) {
  const { data, error } = await q;
  if (error) throw new Error(error.message ?? "読み書きできませんでした");
  return data ?? [];
}

export const loadAll = async () => {
  const [accounts, plans, balances, cards, debts] = await Promise.all([
    run(supabase.from(ACCOUNT_TABLE).select("*").order("id")),
    run(supabase.from(PLAN_TABLE).select("*").order("plan_date", { nullsFirst: false })),
    run(supabase.from(BALANCE_TABLE).select("*").order("balance_date", { ascending: false })),
    run(supabase.from(CARD_TABLE).select("*").order("id")),
    run(supabase.from(DEBT_TABLE).select("*").order("id")),
  ]);
  return { accounts, plans, balances, cards, debts };
};

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

export const saveAccount = (row) => {
  const { id, ...changes } = row;
  return run(supabase.from(ACCOUNT_TABLE).update(changes).eq("id", id).select());
};

export const markDone = (accountId, fromDate, toDate) =>
  run(
    supabase.from(PLAN_TABLE).update({ status: "済" })
      .eq("account_id", accountId).eq("status", "未")
      .gte("plan_date", fromDate).lte("plan_date", toDate).select()
  );

export const putBalance = (row) =>
  run(supabase.from(BALANCE_TABLE).upsert(row, { onConflict: "account_id,balance_date" }).select());

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

export const cardApi = crud(CARD_TABLE);
export const debtApi = crud(DEBT_TABLE);
