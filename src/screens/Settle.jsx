import { useMemo, useState } from "react";
import { T, card, lb10, inp, mono, fmt, solidBtn, ghostBtn } from "shia2n-core";
import { toSettle, todayJst, predictedAt, ym } from "../lib/calc.js";
import { settlePlan, unsettlePlan, putBalance, saveAccount, markDone } from "../lib/api.js";

/**
 * 確定の画面。
 *
 * **週 1 回 30 分で Naoki が触る、唯一の画面。**
 * ここでやることは 2 つだけ。
 *   1. 今月の動きに実額を入れて確定させる（見込み → 実績）
 *   2. 口座の実残高を入れる
 *
 * 登録（続いているもの）はここでは作らない。作るのは登録の画面。
 * 見る 3 つ（今日・カレンダー・推移）はここでは触らない。
 *
 * 並べるのは「今月ぶん」と「日付を過ぎてまだ済んでいないもの」だけ。
 * 先の月まで出すと、まだ起きていないものに手を入れることになる。
 */
export default function Settle({ data, reload }) {
  const { accounts, plans, events } = data;
  const today = todayJst();
  const [msg, setMsg] = useState(null);

  const rows = useMemo(() => toSettle(plans, today), [plans, today]);
  const eventById = useMemo(
    () => Object.fromEntries(events.map((e) => [e.id, e])),
    [events]
  );
  const nameOf = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  const done = plans.filter(
    (p) => p.status === "済" && p.plan_date && ym(p.plan_date) === ym(today)
  );

  const overdue = rows.filter((p) => p.plan_date < today);
  const coming  = rows.filter((p) => p.plan_date >= today);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={lb10}>確定</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
          起きたものに実額を入れて確定させます。<b style={{ color: T.text }}>入れるのは金額だけ</b>で、
          日付・口座・繰り返しは登録の側が持っています。
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, marginTop: 10, flexWrap: "wrap" }}>
          <span>日付を過ぎてまだのもの <b style={{ ...mono, color: overdue.length ? T.red : T.text }}>{overdue.length}</b> 件</span>
          <span>今月これから <b style={{ ...mono }}>{coming.length}</b> 件</span>
          <span>今月もう確定した <b style={{ ...mono, color: T.green }}>{done.length}</b> 件</span>
        </div>
        {msg && <div style={{ fontSize: 11, color: msg.ng ? T.red : T.green, marginTop: 8 }}>{msg.text}</div>}
      </div>

      {overdue.length > 0 && (
        <Block
          title="日付を過ぎたのに、まだ確定していないもの"
          note="ここが残っていると、今日の画面の不足額がずれます。落ちた／入ったなら実額を入れてください。まだなら、そのままで結構です（入金は不足の原因として別に並びます）。"
          rows={overdue} nameOf={nameOf} eventById={eventById} reload={reload} setMsg={setMsg} warn
        />
      )}

      <Block
        title="今月これから起きるもの"
        note="起きた日に実額を入れます。まだ起きていないものは触らなくて結構です。"
        rows={coming} nameOf={nameOf} eventById={eventById} reload={reload} setMsg={setMsg}
      />

      <BalanceBlock accounts={accounts} plans={plans} reload={reload} setMsg={setMsg} />

      {done.length > 0 && (
        <div style={{ ...card, padding: "14px 16px" }}>
          <div style={{ ...lb10, marginBottom: 4 }}>今月もう確定したもの</div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
            入れ間違えたら「見込みに戻す」で元の見込み額へ戻ります。
          </div>
          {done.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "6px 0", borderTop: `1px solid ${T.border}` }}>
              <span style={{ color: T.muted }}>
                {p.plan_date}　{nameOf[p.account_id]}　{p.name}
                {p.planned_amount != null && Number(p.planned_amount) !== Number(p.amount) && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: T.amber }}>
                    見込みは {fmt(Number(p.planned_amount))} だった
                  </span>
                )}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ ...mono, color: p.direction === "out" ? T.red : T.green }}>
                  {p.direction === "out" ? "−" : "＋"}{fmt(Number(p.amount))}
                </span>
                <button style={ghostBtn} onClick={async () => {
                  try { await unsettlePlan(p); await reload(); setMsg({ text: "見込みに戻しました" }); }
                  catch (e) { setMsg({ text: e.message ?? String(e), ng: true }); }
                }}>見込みに戻す</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 動きの一並び ──────────────────────────────────────────────────── */

function Block({ title, note, rows, nameOf, eventById, reload, setMsg, warn }) {
  return (
    <div style={{ ...card, padding: "14px 16px", borderColor: warn ? T.amber : T.border }}>
      <div style={{ ...lb10, color: warn ? T.amber : T.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>{note}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: T.muted }}>1 件もありません。</div>
      ) : (
        rows.map((p) => (
          <Row key={p.id} p={p} nameOf={nameOf} event={eventById[p.event_id]} reload={reload} setMsg={setMsg} />
        ))
      )}
    </div>
  );
}

function Row({ p, nameOf, event, reload, setMsg }) {
  const [value, setValue] = useState(String(p.amount ?? ""));
  const [busy, setBusy]   = useState(false);
  const hasBalance = !!event && event.balance_remaining != null && p.direction === "out";
  const [reduce, setReduce] = useState(hasBalance);
  const changed = String(p.amount ?? "") !== value;

  const go = async () => {
    if (value === "") { setMsg({ text: "金額を入れてください", ng: true }); return; }
    setBusy(true);
    try {
      await settlePlan({ plan: p, actual: Number(value), event, reduceBalance: reduce });
      await reload();
      setMsg({ text: `${p.name} を確定しました` });
    } catch (e) {
      setMsg({ text: e.message ?? String(e), ng: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12 }}>
          <b style={{ ...mono, color: T.muted, marginRight: 8 }}>{p.plan_date}</b>
          {nameOf[p.account_id]}　<b>{p.name}</b>
          <span style={{ marginLeft: 6, fontSize: 10, color: p.certainty === "見込み" ? T.amber : T.faint }}>{p.certainty}</span>
          {p.pair_key && <span style={{ marginLeft: 6, fontSize: 10, color: T.blue }}>対</span>}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: T.muted }}>{p.direction === "out" ? "出" : "入"}</span>
          <input
            style={{ ...inp, width: 120, textAlign: "right" }}
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button style={solidBtn(changed ? T.text : T.muted)} onClick={go} disabled={busy}>
            {busy ? "入れています" : "この額で確定"}
          </button>
        </span>
      </div>
      {hasBalance && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted, marginTop: 4, paddingLeft: 2 }}>
          <input type="checkbox" checked={reduce} onChange={(e) => setReduce(e.target.checked)} />
          返済残高（いま {fmt(Number(event.balance_remaining))}）をこの額だけ減らす
        </label>
      )}
      {p.pair_key && (
        <div style={{ fontSize: 11, color: T.blue, marginTop: 4, paddingLeft: 2 }}>
          対で登録されています。確定するともう片方も同じ額で確定します。
        </div>
      )}
    </div>
  );
}

/* ── 実残高 ────────────────────────────────────────────────────────── */

function BalanceBlock({ accounts, plans, reload, setMsg }) {
  const today = todayJst();
  const [date, setDate] = useState(today);
  const [vals, setVals] = useState({});
  const [reflected, setReflected] = useState(true);
  const [busy, setBusy] = useState(false);

  const go = async (a) => {
    const v = vals[a.id];
    if (v === undefined || v === "") { setMsg({ text: "残高を入れてください", ng: true }); return; }
    setBusy(true);
    try {
      const { predicted } = predictedAt(a, plans, date, reflected);
      const diff = predicted - Number(v);
      await markDone(a.id, a.base_balance_date, reflected ? date : date);
      await putBalance({
        account_id: a.id, balance_date: date,
        actual_balance: Number(v), predicted_balance: predicted, diff,
      });
      await saveAccount({ id: a.id, base_balance: Number(v), base_balance_date: date });
      await reload();
      setVals({ ...vals, [a.id]: "" });
      setMsg({
        text: diff === 0
          ? `${a.name}：予測とぴったり合いました`
          : `${a.name}：予測と ${fmt(Math.abs(diff))} ずれています（登録していない出入りがあります）`,
        ng: diff !== 0,
      });
    } catch (e) {
      setMsg({ text: e.message ?? String(e), ng: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ ...lb10, marginBottom: 4 }}>いまの残高を入れる</div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
        銀行の画面に出ている数字をそのまま入れます。予測とずれていれば、登録していない出入りがあるということです。
        <b style={{ color: T.text }}>先に上の確定を済ませてから入れてください。</b>順番が逆だと、同じ残高から先の不足額が 2 通りに割れます。
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontSize: 12 }}>
          見た日　<input style={{ ...inp, width: 150 }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <input type="checkbox" checked={reflected} onChange={(e) => setReflected(e.target.checked)} />
          その日の引き落としは、もう落ちたあと
        </label>
      </div>
      {accounts.map((a) => (
        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `1px solid ${T.border}`, gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12 }}>
            <b>{a.name}</b>
            <span style={{ marginLeft: 8, color: T.muted, fontSize: 11 }}>
              いま {fmt(Number(a.base_balance ?? 0))}（{a.base_balance_date}）
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              style={{ ...inp, width: 140, textAlign: "right" }}
              type="number"
              value={vals[a.id] ?? ""}
              onChange={(e) => setVals({ ...vals, [a.id]: e.target.value })}
              placeholder="画面の残高"
            />
            <button style={solidBtn(T.text)} onClick={() => go(a)} disabled={busy}>入れる</button>
          </span>
        </div>
      ))}
    </div>
  );
}
