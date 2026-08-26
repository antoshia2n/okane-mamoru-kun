import { useMemo, useState } from "react";
import { T, card, lb10, inp, mono, fmt, ghostBtn, solidBtn } from "shia2n-core";
import { buildForecast, todayJst, addDays, monthDays } from "../lib/calc.js";
import { CERTAINTY, MOVABLE } from "../constants.js";
import { savePlan, movePair, deletePlan } from "../lib/api.js";

/**
 * 引き落とし日と入金日を、月の並びの上で見る画面。
 *
 * 2026-08-27 の直し
 *   ・日ごとのマスに、その日の予測残高と件数を出す
 *   ・日を押すと、その日の内訳が出て、**その場で入力が開く**
 *     （別の画面へ移らない。押した場所で直せる）
 *   ・その日に 1 件足すこともできる
 * 対で登録されている予定は、日付と金額を直すともう片方も同じだけ動く。
 */
export default function Calendar({ data, reload }) {
  const { accounts, plans } = data;
  const today = todayJst();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
  const [picked, setPicked] = useState(null);

  const { points } = useMemo(
    () => buildForecast(accounts, plans, addDays(today, 400), today),
    [accounts, plans, today]
  );

  const days = monthDays(cursor.y, cursor.m);
  const firstWeekday = new Date(`${days[0]}T00:00:00Z`).getUTCDay();

  const byDate = useMemo(() => {
    const m = new Map();
    for (const p of points) {
      if (!m.has(p.日付)) m.set(p.日付, []);
      m.get(p.日付).push(p);
    }
    return m;
  }, [points]);

  const move = (d) => {
    const nm = cursor.m + d;
    if (nm < 1) setCursor({ y: cursor.y - 1, m: 12 });
    else if (nm > 12) setCursor({ y: cursor.y + 1, m: 1 });
    else setCursor({ ...cursor, m: nm });
    setPicked(null);
  };

  const pickedRows = picked ? (byDate.get(picked) ?? []) : [];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...card, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button style={ghostBtn} onClick={() => move(-1)}>前の月</button>
          <div style={{ fontWeight: 700 }}>{cursor.y} 年 {cursor.m} 月</div>
          <button style={ghostBtn} onClick={() => move(1)}>次の月</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
          {["日", "月", "火", "水", "木", "金", "土"].map((w) => (
            <div key={w} style={{ ...lb10, textAlign: "center", padding: "2px 0" }}>{w}</div>
          ))}
          {Array.from({ length: firstWeekday }).map((_, i) => <div key={`b${i}`} />)}
          {days.map((d) => {
            const rows = byDate.get(d) ?? [];
            const short = rows.some((r) => r.不足額 > 0);
            const moves = rows.flatMap((r) => r.動き);
            const count = moves.length;
            // その日の予測残高（口座が複数あるときは合計）
            const total = rows.reduce((s, r) => s + r.予定残高, 0);
            const isToday = d === today;
            return (
              <button key={d} onClick={() => setPicked(d)}
                style={{
                  minHeight: 74, textAlign: "left", padding: "4px 5px", cursor: "pointer",
                  background: short ? "#FBF0EF" : picked === d ? T.s2 : T.surface,
                  border: `1px solid ${picked === d ? T.text : short ? T.red : isToday ? T.blue : T.border}`,
                  borderRadius: 6, fontFamily: "inherit", color: T.text,
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? T.blue : T.muted }}>
                    {Number(d.slice(8, 10))}
                  </span>
                  {count > 0 && (
                    <span style={{ fontSize: 9, color: T.muted }}>{count} 件</span>
                  )}
                </div>
                {count > 0 && (
                  <div style={{ fontSize: 9, ...mono, color: total < 0 ? T.red : T.faint }}>
                    {Math.round(total / 1000).toLocaleString("ja-JP")}K
                  </div>
                )}
                {moves.some((m) => m.direction === "out") && (
                  <div style={{ fontSize: 9, ...mono, color: T.red }}>
                    −{Math.round(moves.filter(m => m.direction === "out").reduce((s, m) => s + Number(m.amount), 0) / 1000)}K
                  </div>
                )}
                {moves.some((m) => m.direction === "in") && (
                  <div style={{ fontSize: 9, ...mono, color: T.green }}>
                    ＋{Math.round(moves.filter(m => m.direction === "in").reduce((s, m) => s + Number(m.amount), 0) / 1000)}K
                  </div>
                )}
                {short && <div style={{ fontSize: 9, fontWeight: 700, color: T.red }}>不足</div>}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: T.faint, marginTop: 8 }}>
          マスの数字は、上から「件数」「その日の予測残高（千円）」「出」「入り」です。日を押すと、その日の入力が開きます。
        </div>
      </div>

      {picked && (
        <DayPanel
          date={picked}
          rows={pickedRows}
          accounts={accounts}
          plans={plans}
          reload={reload}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}

/* ── 押した日の中身と、その場の入力 ────────────────────────────────── */

const emptyRow = {
  account_id: "", direction: "out", amount: "", name: "",
  certainty: "確定", movable: "動かせない", status: "未", note: "",
};

function DayPanel({ date, rows, accounts, plans, reload, onClose }) {
  const [editId, setEditId] = useState(null);
  const [form, setForm]     = useState(emptyRow);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ ...emptyRow, plan_date: date });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);

  const set    = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setAdd = (k) => (e) => setAddForm({ ...addForm, [k]: e.target.value });

  const openEdit = (m) => {
    setMsg(null);
    setAdding(false);
    setEditId(m.id);
    setForm({
      id: m.id,
      key: m.key,
      account_id: String(m.account_id ?? ""),
      plan_date: m.plan_date ?? date,
      direction: m.direction,
      amount: String(m.amount ?? ""),
      name: m.name ?? "",
      certainty: m.certainty ?? "確定",
      movable: m.movable ?? "動かせない",
      status: m.status ?? "未",
      pair_key: m.pair_key ?? "",
      note: m.note ?? "",
    });
  };

  const closeEdit = () => { setEditId(null); setForm(emptyRow); setMsg(null); };

  const toRow = (f) => ({
    account_id: Number(f.account_id),
    plan_date: f.plan_date || null,
    direction: f.direction,
    amount: Number(f.amount),
    name: f.name,
    certainty: f.certainty,
    movable: f.movable,
    status: f.status,
    note: f.note || null,
  });

  const saveEdit = async () => {
    setMsg(null);
    if (!form.account_id) { setMsg({ text: "口座を選んでください", ng: true }); return; }
    if (!form.name)       { setMsg({ text: "名前を入れてください", ng: true }); return; }
    if (form.amount === "") { setMsg({ text: "金額を入れてください", ng: true }); return; }
    setSaving(true);
    try {
      const row = toRow(form);
      await savePlan({ id: form.id, ...row });
      // 対で登録されているものは、もう片方も同じだけ動かす
      if (form.pair_key) {
        await movePair(form.pair_key, form.id, {
          plan_date: row.plan_date, amount: row.amount, status: row.status,
        });
      }
      await reload();
      closeEdit();
    } catch (e) {
      setMsg({ text: e.message ?? String(e), ng: true });
    } finally {
      setSaving(false);
    }
  };

  const submitAdd = async () => {
    setMsg(null);
    if (!addForm.account_id) { setMsg({ text: "口座を選んでください", ng: true }); return; }
    if (!addForm.name)       { setMsg({ text: "名前を入れてください", ng: true }); return; }
    if (addForm.amount === "") { setMsg({ text: "金額を入れてください", ng: true }); return; }
    setSaving(true);
    try {
      await savePlan({ key: `manual_${Date.now()}`, ...toRow({ ...addForm, plan_date: date }) });
      setAddForm({ ...emptyRow, plan_date: date });
      setAdding(false);
      await reload();
    } catch (e) {
      setMsg({ text: e.message ?? String(e), ng: true });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m) => {
    setMsg(null);
    try {
      await deletePlan(m.id);
      if (editId === m.id) closeEdit();
      await reload();
    } catch (e) {
      setMsg({ text: e.message ?? String(e), ng: true });
    }
  };

  const fields = (f, s, withDate) => (
    <>
      <F label="口座">
        <select style={inp} value={f.account_id} onChange={s("account_id")}>
          <option value="">選ぶ</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </F>
      {withDate && (
        <F label="日付"><input style={inp} type="date" value={f.plan_date ?? ""} onChange={s("plan_date")} /></F>
      )}
      <F label="名前"><input style={inp} value={f.name} onChange={s("name")} /></F>
      <F label="出か入りか">
        <select style={inp} value={f.direction} onChange={s("direction")}>
          <option value="out">出ていく</option>
          <option value="in">入ってくる</option>
        </select>
      </F>
      <F label="金額"><input style={inp} type="number" value={f.amount} onChange={s("amount")} /></F>
      <F label="確定か見込みか">
        <select style={inp} value={f.certainty} onChange={s("certainty")}>
          {CERTAINTY.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </F>
      <F label="動かせるか">
        <select style={inp} value={f.movable} onChange={s("movable")}>
          {MOVABLE.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </F>
      <F label="状態">
        <select style={inp} value={f.status} onChange={s("status")}>
          <option value="未">未</option>
          <option value="済">済</option>
        </select>
      </F>
      <F label="備考"><input style={inp} value={f.note ?? ""} onChange={s("note")} /></F>
    </>
  );

  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={lb10}>{date} の中身</div>
        <button style={ghostBtn} onClick={onClose}>閉じる</button>
      </div>

      {rows.length === 0 && (
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>この日は出入りがありません。</div>
      )}

      {rows.map((p, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
            <span>{p.口座}</span>
            <span style={{ ...mono, color: p.予定残高 < 0 ? T.red : T.text }}>
              予定残高 {fmt(p.予定残高)}
            </span>
          </div>

          {p.動き.map((m) => {
            const editing = editId === m.id;
            return (
              <div key={m.id} style={{ paddingLeft: 10, opacity: editId && !editing ? 0.45 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "5px 0" }}>
                  <span style={{ color: T.muted }}>
                    {m.name}
                    <span style={{ marginLeft: 6, fontSize: 10, color: m.certainty === "見込み" ? T.amber : T.faint }}>{m.certainty}</span>
                    {m.movable !== "動かせない" && <span style={{ marginLeft: 6, fontSize: 10, color: T.blue }}>{m.movable}</span>}
                    {m.pair_key && <span style={{ marginLeft: 6, fontSize: 10, color: T.blue }}>対</span>}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ ...mono, color: m.direction === "out" ? T.red : T.green }}>
                      {m.direction === "out" ? "−" : "＋"}{fmt(Number(m.amount))}
                    </span>
                    <button
                      style={editing ? solidBtn(T.text) : ghostBtn}
                      disabled={!!editId && !editing}
                      onClick={() => (editing ? closeEdit() : openEdit(m))}
                    >
                      {editing ? "直しています" : "直す"}
                    </button>
                    <button
                      style={{ ...ghostBtn, color: T.red }}
                      disabled={!!editId && !editing}
                      onClick={() => remove(m)}
                    >
                      消す
                    </button>
                  </span>
                </div>

                {editing && (
                  <div style={{ padding: "12px", background: T.s2, borderRadius: 6, border: `1px solid ${T.border}`, marginBottom: 8 }}>
                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
                      {fields(form, set, true)}
                    </div>
                    {form.pair_key && (
                      <div style={{ fontSize: 11, color: T.blue, marginTop: 8 }}>
                        対で登録されています。日付・金額・状態を直すと、もう片方も同じだけ動きます。
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <button style={solidBtn(T.text)} onClick={saveEdit} disabled={saving}>
                        {saving ? "入れています" : "この内容にする"}
                      </button>
                      <button style={ghostBtn} onClick={closeEdit} disabled={saving}>やめる</button>
                      {msg && <span style={{ fontSize: 11, color: msg.ng ? T.red : T.muted }}>{msg.text}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {p.不足額 > 0 && (
            <div style={{ fontSize: 12, color: T.red, fontWeight: 700, paddingLeft: 10 }}>
              不足 {fmt(p.不足額)}（{p.入れる期限} までに入れる）
            </div>
          )}
        </div>
      ))}

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
        {!adding ? (
          <button style={ghostBtn} disabled={!!editId} onClick={() => { setAdding(true); setMsg(null); }}>
            この日に 1 件足す
          </button>
        ) : (
          <div style={{ padding: "12px", background: T.s2, borderRadius: 6, border: `1px solid ${T.border}` }}>
            <div style={{ ...lb10, marginBottom: 8 }}>{date} に足す</div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
              {fields(addForm, setAdd, false)}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button style={solidBtn(T.text)} onClick={submitAdd} disabled={saving}>
                {saving ? "入れています" : "足す"}
              </button>
              <button style={ghostBtn} onClick={() => setAdding(false)} disabled={saving}>やめる</button>
              {msg && <span style={{ fontSize: 11, color: msg.ng ? T.red : T.muted }}>{msg.text}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function F({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ ...lb10, marginBottom: 3 }}>{label}</div>
      {children}
    </label>
  );
}
