import { useState, useMemo } from "react";
import { T, card, lb10, inp, solidBtn, ghostBtn, mono, fmt } from "shia2n-core";
import { MOVABLE, CERTAINTY } from "../constants.js";
import { savePlan, movePair, deletePlan, saveAccount, markDone, putBalance } from "../lib/api.js";
import { todayJst, predictedAt } from "../lib/calc.js";

const emptyPlan = {
  key: "", account_id: "", plan_date: "", direction: "out", amount: "",
  name: "", recurrence: "", certainty: "確定", movable: "動かせない",
  status: "未", pair_key: "", note: "",
};

export default function Entry({ data, reload }) {
  const { accounts, plans } = data;
  const [sub, setSub] = useState("予定");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {["予定", "実残高", "口座"].map((s) => (
          <button key={s} onClick={() => setSub(s)}
            style={{ ...(sub === s ? solidBtn(T.text) : ghostBtn) }}>{s}</button>
        ))}
      </div>
      {sub === "予定"   && <PlanEditor accounts={accounts} plans={plans} reload={reload} />}
      {sub === "実残高" && <BalanceEditor accounts={accounts} plans={plans} reload={reload} />}
      {sub === "口座"   && <AccountEditor accounts={accounts} reload={reload} />}
    </div>
  );
}

/* ── 予定 ──────────────────────────────────────────────────────────── */

function PlanEditor({ accounts, plans, reload }) {
  const [form, setForm] = useState(emptyPlan);
  const [msg, setMsg]   = useState(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("未");

  const nameOf = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a.name])),
    [accounts]
  );

  const shown = plans
    .filter((p) => (filter === "全部" ? true : p.status === filter))
    .slice(0, 200);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      if (!form.account_id) throw new Error("口座を選んでください");
      if (!form.name)       throw new Error("名前を入れてください");
      if (form.amount === "") throw new Error("金額を入れてください");

      const row = {
        ...(form.id ? { id: form.id } : {}),
        key: form.key || `manual_${Date.now()}`,
        account_id: Number(form.account_id),
        plan_date: form.plan_date || null,
        direction: form.direction,
        amount: Number(form.amount),
        name: form.name,
        recurrence: form.recurrence || null,
        certainty: form.certainty,
        movable: form.movable,
        status: form.status,
        pair_key: form.pair_key || null,
        note: form.note || null,
      };
      await savePlan(row);

      // 対で登録した予定は、片方を動かすともう片方も動かす
      if (form.id && row.pair_key) {
        await movePair(row.pair_key, form.id, {
          plan_date: row.plan_date, amount: row.amount, status: row.status,
        });
      }
      setForm(emptyPlan);
      setMsg("入りました");
      await reload();
    } catch (e) { setMsg(e.message ?? String(e)); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    setBusy(true);
    try { await deletePlan(id); await reload(); setMsg("消しました"); }
    catch (e) { setMsg(e.message ?? String(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={{ ...lb10, marginBottom: 10 }}>{form.id ? "予定を直す" : "予定を足す"}</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
          <Field label="口座">
            <select style={inp} value={form.account_id} onChange={set("account_id")}>
              <option value="">選んでください</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="名前"><input style={inp} value={form.name} onChange={set("name")} placeholder="例：社会保険料" /></Field>
          <Field label="日付（空なら未定）"><input style={inp} type="date" value={form.plan_date ?? ""} onChange={set("plan_date")} /></Field>
          <Field label="出か入か">
            <select style={inp} value={form.direction} onChange={set("direction")}>
              <option value="out">出ていく</option>
              <option value="in">入ってくる</option>
            </select>
          </Field>
          <Field label="金額"><input style={inp} type="number" value={form.amount} onChange={set("amount")} /></Field>
          <Field label="確定か見込みか">
            <select style={inp} value={form.certainty} onChange={set("certainty")}>
              {CERTAINTY.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="動かせるか">
            <select style={inp} value={form.movable} onChange={set("movable")}>
              {MOVABLE.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="繰り返し"><input style={inp} value={form.recurrence ?? ""} onChange={set("recurrence")} placeholder="例：毎月 27 日" /></Field>
          <Field label="状態">
            <select style={inp} value={form.status} onChange={set("status")}>
              <option value="未">未</option><option value="済">済</option>
            </select>
          </Field>
          <Field label="対の相手">
            <input style={inp} value={form.pair_key ?? ""} onChange={set("pair_key")} placeholder="口座をまたぐ出と入りに同じ文字を入れる" />
          </Field>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
          見込みは、足りなくなる側へ寄せた額を入れてください。出るお金は多めに、入るお金は少なめに。
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "center" }}>
          <button disabled={busy} onClick={submit} style={solidBtn(T.text)}>{form.id ? "直す" : "足す"}</button>
          {form.id && <button onClick={() => setForm(emptyPlan)} style={ghostBtn}>やめる</button>}
          {msg && <span style={{ fontSize: 11, color: T.muted }}>{msg}</span>}
        </div>
      </div>

      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={lb10}>登録してある予定</div>
          <select style={{ ...inp, width: 100 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="未">未</option><option value="済">済</option><option value="全部">全部</option>
          </select>
        </div>
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {shown.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${T.border}`, fontSize: 12 }}>
              <span style={{ flex: 1 }}>
                <span style={{ color: T.muted, marginRight: 8 }}>{p.plan_date ?? "日付未定"}</span>
                {nameOf[p.account_id]}　{p.name}
                {p.pair_key && <span style={{ marginLeft: 6, fontSize: 10, color: T.blue }}>対</span>}
              </span>
              <span style={{ ...mono, color: p.direction === "out" ? T.red : T.green, marginRight: 10 }}>
                {p.direction === "out" ? "−" : "＋"}{fmt(Number(p.amount))}
              </span>
              <button style={ghostBtn} onClick={() => setForm({ ...p, amount: String(p.amount), account_id: String(p.account_id) })}>直す</button>
              <button style={{ ...ghostBtn, marginLeft: 4, color: T.red }} onClick={() => remove(p.id)}>消す</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── 実残高 ────────────────────────────────────────────────────────── */

function BalanceEditor({ accounts, plans, reload }) {
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayJst());
  const [amount, setAmount] = useState("");
  const [reflected, setReflected] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const account = accounts.find((a) => String(a.id) === String(accountId)) ?? null;
  const sameDay = account
    ? plans.filter((p) => p.account_id === account.id && p.status === "未" && p.plan_date === date)
    : [];

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      if (!account) throw new Error("口座を選んでください");
      if (amount === "") throw new Error("残高を入れてください");
      if (sameDay.length > 0 && reflected === null) {
        throw new Error("その日の予定が反映済みかを選んでください");
      }
      const useReflected = sameDay.length > 0 ? reflected : false;
      const { predicted, target } = predictedAt(account, plans, date, useReflected);
      const diff = predicted - Number(amount);

      if (target.length > 0) {
        await markDone(account.id, account.base_balance_date, useReflected ? date : shiftBack(date));
      }
      await putBalance({
        account_id: account.id, balance_date: date,
        actual_balance: Number(amount), predicted_balance: predicted, diff,
      });
      await saveAccount({ id: account.id, base_balance: Number(amount), base_balance_date: date });

      setMsg(
        diff === 0
          ? "入りました。予測とのずれはありません。"
          : diff > 0
            ? `入りました。予測より ${fmt(diff)} 少ないです。登録していない出があります。`
            : `入りました。予測より ${fmt(-diff)} 多いです。登録していない入りがあります。`
      );
      setAmount(""); setReflected(null);
      await reload();
    } catch (e) { setMsg(e.message ?? String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ ...lb10, marginBottom: 4 }}>実際の残高を入れる</div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>
        入れた残高が、そこから先の計算の起点になります。過ぎた予定は自動で「済」になります。
      </div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
        <Field label="口座">
          <select style={inp} value={accountId} onChange={(e) => { setAccountId(e.target.value); setReflected(null); }}>
            <option value="">選んでください</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="見た日"><input style={inp} type="date" value={date} onChange={(e) => { setDate(e.target.value); setReflected(null); }} /></Field>
        <Field label="画面に出ている残高"><input style={inp} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      </div>

      {sameDay.length > 0 && (
        <div style={{ marginTop: 14, background: "#FAF4EA", border: `1px solid ${T.amber}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.amber, marginBottom: 6 }}>
            この日には予定が {sameDay.length} 件あります
          </div>
          {sameDay.map((p) => (
            <div key={p.id} style={{ fontSize: 12, color: T.muted }}>
              ・{p.name}　{p.direction === "out" ? "−" : "＋"}{fmt(Number(p.amount))}
            </div>
          ))}
          <div style={{ fontSize: 11, color: T.muted, margin: "8px 0 6px" }}>
            これが落ちた後の残高ですか。ここを取り違えると、先の不足額が変わります。
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setReflected(true)}  style={reflected === true  ? solidBtn(T.text) : ghostBtn}>もう落ちた後</button>
            <button onClick={() => setReflected(false)} style={reflected === false ? solidBtn(T.text) : ghostBtn}>まだ落ちていない</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
        <button disabled={busy} onClick={submit} style={solidBtn(T.text)}>入れる</button>
        {msg && <span style={{ fontSize: 12, color: T.text }}>{msg}</span>}
      </div>
    </div>
  );
}

function shiftBack(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* ── 口座 ──────────────────────────────────────────────────────────── */

function AccountEditor({ accounts, reload }) {
  const [msg, setMsg] = useState(null);
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(accounts.map((a) => [a.id, { min_balance: String(a.min_balance ?? 0) }]))
  );

  const save = async (a) => {
    try {
      await saveAccount({ id: a.id, min_balance: Number(draft[a.id].min_balance) });
      setMsg(`${a.name} を直しました`);
      await reload();
    } catch (e) { setMsg(e.message ?? String(e)); }
  };

  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ ...lb10, marginBottom: 4 }}>口座の最低残高</div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>
        ここを 0 にすると、残高 0 円を正常と判定します。割ってはいけない額を入れてください。
      </div>
      {accounts.map((a) => (
        <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{a.name}</div>
            <div style={{ fontSize: 11, color: T.muted }}>
              {a.kind}／いまの残高 {fmt(Number(a.base_balance ?? 0))}（{a.base_balance_date}）
            </div>
          </div>
          <div style={{ width: 140 }}>
            <input style={inp} type="number" value={draft[a.id]?.min_balance ?? ""} onChange={(e) => setDraft({ ...draft, [a.id]: { min_balance: e.target.value } })} />
          </div>
          <button style={solidBtn(T.text)} onClick={() => save(a)}>直す</button>
        </div>
      ))}
      {msg && <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>{msg}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ ...lb10, marginBottom: 3 }}>{label}</div>
      {children}
    </label>
  );
}
