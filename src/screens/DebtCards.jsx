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
 *
 * 2026-08-27 の直し（「直す」を押しても何も起きない件）
 * ---------------------------------------------------------------
 * 前の形：「直す」を押すと、一覧の一番下にある入力欄に値が入るだけだった。
 *   一覧の下は画面の外にあるため、押した場所では何も変わらず、
 *   何も起きていないように見える。
 * 直した形：押した行のすぐ下が入力欄に変わる。押した場所で開くので、
 *   画面を動かさなくても変わったことが見える。
 *   閉じるまで他の行の「直す」は押せない（どの行を直しているかを 1 つに保つ）。
 *
 * あわせて直したところ
 *  - 終わる予定の月：保存されている値が「2027-08-01」のような日付でも
 *    月の欄に出るようにした（前は空に見えていた）。
 *    月を選び直したときだけ「その月の 1 日」として送る。
 *    触らなかった行は、保存されている値をそのまま送る（形を変えない）。
 *  - 保存に失敗したときの文を、その行のところに出す。
 *    前は一覧の下にしか出ず、失敗したことに気づけなかった。
 */

const emptyCard = { name: "", limit_amount: "", used_amount: "", closing_day: "", payment_day: "", site_url: "", note: "" };
const emptyDebt = { name: "", balance: "", monthly_payment: "", ends_on: "", rate: "", note: "" };

/** 保存されている値から、月の入力欄に出す文字（YYYY-MM）を作る */
const toMonthInput = (v) => String(v ?? "").slice(0, 7);
/** 月の入力欄で選ばれた値を、保存する形（その月の 1 日）にする */
const fromMonthInput = (v) => (v ? `${v}-01` : "");

export default function DebtCards({ data, reload }) {
  const { cards, debts } = data;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <DebtBlock debts={debts} reload={reload} />
      <CardBlock cards={cards} reload={reload} />
    </div>
  );
}

/* ── 部品 ─────────────────────────────────────────────────────────── */

function F({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ ...lb10, marginBottom: 3 }}>{label}</div>
      {children}
    </label>
  );
}

/** 押した行の下に開く入力欄の外枠 */
function EditBox({ title, onSave, onCancel, saving, msg, children }) {
  return (
    <div
      style={{
        marginTop: 10,
        padding: "12px 12px 14px",
        background: T.s2,
        borderRadius: 6,
        border: `1px solid ${T.border}`,
      }}
    >
      <div style={{ ...lb10, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
        {children}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button style={solidBtn(T.text)} onClick={onSave} disabled={saving}>
          {saving ? "入れています" : "この内容にする"}
        </button>
        <button style={ghostBtn} onClick={onCancel} disabled={saving}>やめる</button>
        {msg && <span style={{ fontSize: 11, color: msg.ng ? T.red : T.muted }}>{msg.text}</span>}
      </div>
    </div>
  );
}

/* ── 負債 ──────────────────────────────────────────────────────────── */

function DebtBlock({ debts, reload }) {
  const [editId, setEditId] = useState(null);   // 直している行。null なら直していない
  const [form, setForm]     = useState(emptyDebt);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);   // { text, ng }
  const [addForm, setAddForm] = useState(emptyDebt);
  const [addMsg, setAddMsg]   = useState(null);
  const [adding, setAdding]   = useState(false);

  const set    = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setAdd = (k) => (e) => setAddForm({ ...addForm, [k]: e.target.value });

  const total   = debts.reduce((s, d) => s + Number(d.balance ?? 0), 0);
  const monthly = debts.reduce((s, d) => s + Number(d.monthly_payment ?? 0), 0);

  const openEdit = (d) => {
    setMsg(null);
    setEditId(d.id);
    setForm({
      id: d.id,
      name: d.name ?? "",
      balance: String(d.balance ?? ""),
      monthly_payment: String(d.monthly_payment ?? ""),
      ends_on: d.ends_on ?? "",
      rate: String(d.rate ?? ""),
      note: d.note ?? "",
    });
  };

  const closeEdit = () => { setEditId(null); setForm(emptyDebt); setMsg(null); };

  const toRow = (f) => ({
    name: f.name,
    balance: f.balance === "" ? null : Number(f.balance),
    monthly_payment: f.monthly_payment === "" ? null : Number(f.monthly_payment),
    ends_on: f.ends_on || null,
    rate: f.rate === "" ? null : Number(f.rate),
    note: f.note || null,
  });

  const saveEdit = async () => {
    setMsg(null);
    if (!form.name) { setMsg({ text: "呼び名を入れてください", ng: true }); return; }
    setSaving(true);
    try {
      await debtApi.save({ id: form.id, ...toRow(form) });
      await reload();
      closeEdit();
    } catch (e) {
      setMsg({ text: e.message ?? String(e), ng: true });
    } finally {
      setSaving(false);
    }
  };

  const submitAdd = async () => {
    setAddMsg(null);
    if (!addForm.name) { setAddMsg({ text: "呼び名を入れてください", ng: true }); return; }
    setAdding(true);
    try {
      await debtApi.save(toRow(addForm));
      setAddForm(emptyDebt);
      setAddMsg({ text: "入りました", ng: false });
      await reload();
    } catch (e) {
      setAddMsg({ text: e.message ?? String(e), ng: true });
    } finally {
      setAdding(false);
    }
  };

  const remove = async (d) => {
    setMsg(null);
    try {
      await debtApi.remove(d.id);
      if (editId === d.id) closeEdit();
      await reload();
    } catch (e) {
      setMsg({ text: e.message ?? String(e), ng: true });
    }
  };

  const fields = (f, s) => (
    <>
      <F label="呼び名"><input style={inp} value={f.name} onChange={s("name")} /></F>
      <F label="今の残高"><input style={inp} type="number" value={f.balance} onChange={s("balance")} /></F>
      <F label="毎月の返済額"><input style={inp} type="number" value={f.monthly_payment} onChange={s("monthly_payment")} /></F>
      <F label="終わる予定の月">
        <input
          style={inp}
          type="month"
          value={toMonthInput(f.ends_on)}
          onChange={(e) => s("ends_on")({ target: { value: fromMonthInput(e.target.value) } })}
        />
      </F>
      <F label="利率（％）"><input style={inp} type="number" step="0.01" value={f.rate} onChange={s("rate")} /></F>
      <F label="備考"><input style={inp} value={f.note ?? ""} onChange={s("note")} /></F>
    </>
  );

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
        const editing = editId === d.id;
        const paid = Number(d.balance ?? 0);
        return (
          <div
            key={d.id}
            style={{
              padding: "10px 0",
              borderTop: `1px solid ${T.border}`,
              opacity: editId && !editing ? 0.45 : 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{d.name}</div>
              <div>
                <button
                  style={editing ? solidBtn(T.text) : ghostBtn}
                  disabled={!!editId && !editing}
                  onClick={() => (editing ? closeEdit() : openEdit(d))}
                >
                  {editing ? "直しています" : "直す"}
                </button>
                <button
                  style={{ ...ghostBtn, marginLeft: 4, color: T.red }}
                  disabled={!!editId && !editing}
                  onClick={() => remove(d)}
                >
                  消す
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, fontSize: 12, color: T.muted, marginTop: 4, flexWrap: "wrap" }}>
              <span>残り <b style={{ ...mono, color: T.text }}>{fmt(paid)}</b></span>
              {d.monthly_payment != null && <span>毎月 <b style={{ ...mono, color: T.text }}>{fmt(Number(d.monthly_payment))}</b></span>}
              {d.ends_on && <span>終わり {toMonthInput(d.ends_on)}</span>}
              {d.rate != null && <span>利率 {d.rate}%</span>}
            </div>
            {d.note && <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>{d.note}</div>}

            {editing && (
              <EditBox
                title={`${d.name} を直す`}
                onSave={saveEdit}
                onCancel={closeEdit}
                saving={saving}
                msg={msg}
              >
                {fields(form, set)}
              </EditBox>
            )}
          </div>
        );
      })}

      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 10, paddingTop: 12 }}>
        <div style={{ ...lb10, marginBottom: 8 }}>負債を足す</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
          {fields(addForm, setAdd)}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={solidBtn(T.text)} onClick={submitAdd} disabled={adding}>
            {adding ? "入れています" : "足す"}
          </button>
          {addMsg && <span style={{ fontSize: 11, color: addMsg.ng ? T.red : T.muted }}>{addMsg.text}</span>}
        </div>
      </div>
    </div>
  );
}

/* ── カード ────────────────────────────────────────────────────────── */

function CardBlock({ cards, reload }) {
  const [editId, setEditId] = useState(null);
  const [form, setForm]     = useState(emptyCard);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);
  const [addForm, setAddForm] = useState(emptyCard);
  const [addMsg, setAddMsg]   = useState(null);
  const [adding, setAdding]   = useState(false);

  const set    = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setAdd = (k) => (e) => setAddForm({ ...addForm, [k]: e.target.value });

  const openEdit = (c) => {
    setMsg(null);
    setEditId(c.id);
    setForm({
      id: c.id,
      name: c.name ?? "",
      limit_amount: String(c.limit_amount ?? ""),
      used_amount: String(c.used_amount ?? ""),
      closing_day: String(c.closing_day ?? ""),
      payment_day: String(c.payment_day ?? ""),
      site_url: c.site_url ?? "",
      note: c.note ?? "",
    });
  };

  const closeEdit = () => { setEditId(null); setForm(emptyCard); setMsg(null); };

  const toRow = (f) => ({
    name: f.name,
    limit_amount: f.limit_amount === "" ? null : Number(f.limit_amount),
    used_amount: f.used_amount === "" ? null : Number(f.used_amount),
    closing_day: f.closing_day === "" ? null : Number(f.closing_day),
    payment_day: f.payment_day === "" ? null : Number(f.payment_day),
    site_url: f.site_url || null,
    note: f.note || null,
  });

  const saveEdit = async () => {
    setMsg(null);
    if (!form.name) { setMsg({ text: "呼び名を入れてください", ng: true }); return; }
    setSaving(true);
    try {
      await cardApi.save({ id: form.id, ...toRow(form) });
      await reload();
      closeEdit();
    } catch (e) {
      setMsg({ text: e.message ?? String(e), ng: true });
    } finally {
      setSaving(false);
    }
  };

  const submitAdd = async () => {
    setAddMsg(null);
    if (!addForm.name) { setAddMsg({ text: "呼び名を入れてください", ng: true }); return; }
    setAdding(true);
    try {
      await cardApi.save(toRow(addForm));
      setAddForm(emptyCard);
      setAddMsg({ text: "入りました", ng: false });
      await reload();
    } catch (e) {
      setAddMsg({ text: e.message ?? String(e), ng: true });
    } finally {
      setAdding(false);
    }
  };

  const remove = async (c) => {
    setMsg(null);
    try {
      await cardApi.remove(c.id);
      if (editId === c.id) closeEdit();
      await reload();
    } catch (e) {
      setMsg({ text: e.message ?? String(e), ng: true });
    }
  };

  const fields = (f, s) => (
    <>
      <F label="呼び名"><input style={inp} value={f.name} onChange={s("name")} /></F>
      <F label="利用枠"><input style={inp} type="number" value={f.limit_amount} onChange={s("limit_amount")} /></F>
      <F label="いまの利用額"><input style={inp} type="number" value={f.used_amount} onChange={s("used_amount")} /></F>
      <F label="締め日"><input style={inp} type="number" min="1" max="31" value={f.closing_day} onChange={s("closing_day")} /></F>
      <F label="引き落とし日"><input style={inp} type="number" min="1" max="31" value={f.payment_day} onChange={s("payment_day")} /></F>
      <F label="管理サイトの住所"><input style={inp} value={f.site_url ?? ""} onChange={s("site_url")} placeholder="https://" /></F>
      <F label="備考"><input style={inp} value={f.note ?? ""} onChange={s("note")} /></F>
    </>
  );

  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={lb10}>カード</div>
      <div style={{ fontSize: 11, color: T.muted, margin: "4px 0 10px" }}>
        カード番号・暗証番号・ログイン情報を入れる欄は作っていません。管理サイトは住所を開くだけです。
      </div>

      {cards.length === 0 && <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>まだ 1 件も入っていません。</div>}

      {cards.map((c) => {
        const editing = editId === c.id;
        const limit = Number(c.limit_amount ?? 0);
        const used  = Number(c.used_amount ?? 0);
        const rate  = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;
        const hot   = rate != null && rate >= 80;
        return (
          <div
            key={c.id}
            style={{
              padding: "10px 0",
              borderTop: `1px solid ${T.border}`,
              opacity: editId && !editing ? 0.45 : 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
              <div>
                {c.site_url && (
                  <a href={c.site_url} target="_blank" rel="noreferrer" style={{ ...ghostBtn, textDecoration: "none", display: "inline-flex" }}>管理サイト</a>
                )}
                <button
                  style={{ ...(editing ? solidBtn(T.text) : ghostBtn), marginLeft: 4 }}
                  disabled={!!editId && !editing}
                  onClick={() => (editing ? closeEdit() : openEdit(c))}
                >
                  {editing ? "直しています" : "直す"}
                </button>
                <button
                  style={{ ...ghostBtn, marginLeft: 4, color: T.red }}
                  disabled={!!editId && !editing}
                  onClick={() => remove(c)}
                >
                  消す
                </button>
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

            {editing && (
              <EditBox
                title={`${c.name} を直す`}
                onSave={saveEdit}
                onCancel={closeEdit}
                saving={saving}
                msg={msg}
              >
                {fields(form, set)}
              </EditBox>
            )}
          </div>
        );
      })}

      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 10, paddingTop: 12 }}>
        <div style={{ ...lb10, marginBottom: 8 }}>カードを足す</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
          {fields(addForm, setAdd)}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={solidBtn(T.text)} onClick={submitAdd} disabled={adding}>
            {adding ? "入れています" : "足す"}
          </button>
          {addMsg && <span style={{ fontSize: 11, color: addMsg.ng ? T.red : T.muted }}>{addMsg.text}</span>}
        </div>
      </div>
    </div>
  );
}
