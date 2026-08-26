import { useState } from "react";
import { T, card, lb10, inp, solidBtn, ghostBtn, mono, fmt } from "shia2n-core";
import { cardApi, debtApi } from "../lib/api.js";

/**
 * 負債とカードの画面。
 *
 * 持たないもの（欄そのものを作っていない）：
 *   カード番号・暗証番号・パスワード・ログイン情報・口座番号
 * 管理サイトは住所だけを持つ。住所は公開されている情報で、
 * 入るための情報を持たないので、守りの水準は上がらない。
 */

const emptyCard = { name: "", limit_amount: "", used_amount: "", closing_day: "", payment_day: "", site_url: "", note: "" };
const emptyDebt = { name: "", balance: "", monthly_payment: "", ends_on: "", rate: "", note: "" };

export default function DebtCards({ data, reload }) {
  const { cards, debts } = data;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <DebtBlock debts={debts} reload={reload} />
      <CardBlock cards={cards} reload={reload} />
    </div>
  );
}

/* ── 負債 ──────────────────────────────────────────────────────────── */

function DebtBlock({ debts, reload }) {
  const [form, setForm] = useState(emptyDebt);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const total = debts.reduce((s, d) => s + Number(d.balance ?? 0), 0);
  const monthly = debts.reduce((s, d) => s + Number(d.monthly_payment ?? 0), 0);

  const submit = async () => {
    try {
      if (!form.name) throw new Error("呼び名を入れてください");
      await debtApi.save({
        ...(form.id ? { id: form.id } : {}),
        name: form.name,
        balance: form.balance === "" ? null : Number(form.balance),
        monthly_payment: form.monthly_payment === "" ? null : Number(form.monthly_payment),
        ends_on: form.ends_on || null,
        rate: form.rate === "" ? null : Number(form.rate),
        note: form.note || null,
      });
      setForm(emptyDebt); setMsg("入りました"); await reload();
    } catch (e) { setMsg(e.message ?? String(e)); }
  };

  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={lb10}>負債</div>
        <div style={{ fontSize: 12, color: T.muted }}>
          残り <b style={{ ...mono, color: T.text }}>{fmt(total)}</b>　毎月 <b style={{ ...mono, color: T.text }}>{fmt(monthly)}</b>
        </div>
      </div>

      {debts.length === 0 && <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>まだ 1 件も入っていません。</div>}

      {debts.map((d) => {
        const paid = Number(d.balance ?? 0);
        return (
          <div key={d.id} style={{ padding: "10px 0", borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{d.name}</div>
              <div>
                <button style={ghostBtn} onClick={() => setForm({ ...d, balance: String(d.balance ?? ""), monthly_payment: String(d.monthly_payment ?? ""), rate: String(d.rate ?? "") })}>直す</button>
                <button style={{ ...ghostBtn, marginLeft: 4, color: T.red }} onClick={async () => { await debtApi.remove(d.id); await reload(); }}>消す</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: T.muted, marginTop: 4, flexWrap: "wrap" }}>
              <span>残り <b style={{ ...mono, color: T.text }}>{fmt(paid)}</b></span>
              {d.monthly_payment != null && <span>毎月 <b style={{ ...mono, color: T.text }}>{fmt(Number(d.monthly_payment))}</b></span>}
              {d.ends_on && <span>終わり {d.ends_on}</span>}
              {d.rate != null && <span>利率 {d.rate}%</span>}
            </div>
            {d.note && <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>{d.note}</div>}
          </div>
        );
      })}

      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 10, paddingTop: 12 }}>
        <div style={{ ...lb10, marginBottom: 8 }}>{form.id ? "負債を直す" : "負債を足す"}</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
          <F label="呼び名"><input style={inp} value={form.name} onChange={set("name")} /></F>
          <F label="今の残高"><input style={inp} type="number" value={form.balance} onChange={set("balance")} /></F>
          <F label="毎月の返済額"><input style={inp} type="number" value={form.monthly_payment} onChange={set("monthly_payment")} /></F>
          <F label="終わる予定の月"><input style={inp} type="month" value={form.ends_on ?? ""} onChange={set("ends_on")} /></F>
          <F label="利率（％）"><input style={inp} type="number" step="0.01" value={form.rate} onChange={set("rate")} /></F>
          <F label="備考"><input style={inp} value={form.note ?? ""} onChange={set("note")} /></F>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
          <button style={solidBtn(T.text)} onClick={submit}>{form.id ? "直す" : "足す"}</button>
          {form.id && <button style={ghostBtn} onClick={() => setForm(emptyDebt)}>やめる</button>}
          {msg && <span style={{ fontSize: 11, color: T.muted }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

/* ── カード ────────────────────────────────────────────────────────── */

function CardBlock({ cards, reload }) {
  const [form, setForm] = useState(emptyCard);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    try {
      if (!form.name) throw new Error("呼び名を入れてください");
      await cardApi.save({
        ...(form.id ? { id: form.id } : {}),
        name: form.name,
        limit_amount: form.limit_amount === "" ? null : Number(form.limit_amount),
        used_amount: form.used_amount === "" ? null : Number(form.used_amount),
        closing_day: form.closing_day === "" ? null : Number(form.closing_day),
        payment_day: form.payment_day === "" ? null : Number(form.payment_day),
        site_url: form.site_url || null,
        note: form.note || null,
      });
      setForm(emptyCard); setMsg("入りました"); await reload();
    } catch (e) { setMsg(e.message ?? String(e)); }
  };

  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={lb10}>カード</div>
      <div style={{ fontSize: 11, color: T.muted, margin: "4px 0 10px" }}>
        カード番号・暗証番号・ログイン情報を入れる欄は作っていません。管理サイトは住所を開くだけです。
      </div>

      {cards.length === 0 && <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>まだ 1 件も入っていません。</div>}

      {cards.map((c) => {
        const limit = Number(c.limit_amount ?? 0);
        const used  = Number(c.used_amount ?? 0);
        const rate  = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;
        const hot   = rate != null && rate >= 80;
        return (
          <div key={c.id} style={{ padding: "10px 0", borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
              <div>
                {c.site_url && (
                  <a href={c.site_url} target="_blank" rel="noreferrer" style={{ ...ghostBtn, textDecoration: "none", display: "inline-flex" }}>管理サイト</a>
                )}
                <button style={{ ...ghostBtn, marginLeft: 4 }} onClick={() => setForm({ ...c, limit_amount: String(c.limit_amount ?? ""), used_amount: String(c.used_amount ?? ""), closing_day: String(c.closing_day ?? ""), payment_day: String(c.payment_day ?? "") })}>直す</button>
                <button style={{ ...ghostBtn, marginLeft: 4, color: T.red }} onClick={async () => { await cardApi.remove(c.id); await reload(); }}>消す</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: T.muted, marginTop: 4, flexWrap: "wrap" }}>
              {limit > 0 && <span>利用枠 <b style={{ ...mono, color: T.text }}>{fmt(limit)}</b></span>}
              {c.used_amount != null && <span>いま <b style={{ ...mono, color: hot ? T.red : T.text }}>{fmt(used)}</b></span>}
              {c.closing_day != null && <span>締め {c.closing_day} 日</span>}
              {c.payment_day != null && <span>引き落とし {c.payment_day} 日</span>}
            </div>
            {rate != null && (
              <div style={{ marginTop: 6, background: T.s2, borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div style={{ width: `${rate}%`, height: "100%", background: hot ? T.red : T.green }} />
              </div>
            )}
            {rate != null && <div style={{ fontSize: 11, color: hot ? T.red : T.muted, marginTop: 2 }}>枠の {rate}% を使っています</div>}
          </div>
        );
      })}

      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 10, paddingTop: 12 }}>
        <div style={{ ...lb10, marginBottom: 8 }}>{form.id ? "カードを直す" : "カードを足す"}</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
          <F label="呼び名"><input style={inp} value={form.name} onChange={set("name")} /></F>
          <F label="利用枠"><input style={inp} type="number" value={form.limit_amount} onChange={set("limit_amount")} /></F>
          <F label="いまの利用額"><input style={inp} type="number" value={form.used_amount} onChange={set("used_amount")} /></F>
          <F label="締め日"><input style={inp} type="number" min="1" max="31" value={form.closing_day} onChange={set("closing_day")} /></F>
          <F label="引き落とし日"><input style={inp} type="number" min="1" max="31" value={form.payment_day} onChange={set("payment_day")} /></F>
          <F label="管理サイトの住所"><input style={inp} value={form.site_url ?? ""} onChange={set("site_url")} placeholder="https://" /></F>
          <F label="備考"><input style={inp} value={form.note ?? ""} onChange={set("note")} /></F>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
          <button style={solidBtn(T.text)} onClick={submit}>{form.id ? "直す" : "足す"}</button>
          {form.id && <button style={ghostBtn} onClick={() => setForm(emptyCard)}>やめる</button>}
          {msg && <span style={{ fontSize: 11, color: T.muted }}>{msg}</span>}
        </div>
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
