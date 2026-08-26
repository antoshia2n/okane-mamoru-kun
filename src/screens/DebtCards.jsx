import { useState } from "react";
import { T, card, lb10, inp, solidBtn, ghostBtn, mono, fmt } from "shia2n-core";
import { eventApi, borrowingApi } from "../lib/api.js";
import { creditLeft, todayJst, recurrenceText } from "../lib/calc.js";

/**
 * 負債とカードの画面。
 *
 * 持たないもの（欄そのものを作っていない）：
 *   カード番号・暗証番号・パスワード・ログイン情報・口座番号
 * 管理サイトは住所だけを持つ。住所は公開されている情報で、
 * 入るための情報を持たないので、守りの水準は上がらない。
 *
 * 2026-08-27 の作り直し
 *   ・読む先を mo_cards / mo_debts から mo_events（イベント）へ移した。
 *     毎月の支払いと、その借入の残高が同じ 1 件になる。
 *   ・「残り」という言い方をやめ、数字を置く場所を 3 つに分けた。
 *       返済残高　　＝ あといくら返すか
 *       枠の総額　　＝ そのカードで使える上限
 *       いま使っている額
 *     画面に出す「利用できる枠」は、枠の総額 − いま使っている額 で出す。
 *     どちらの意味かが決まらない欄を作らないための分け方。
 *   ・追加で借りたときに 1 件足せるようにした。足した分は返済残高にも足せる
 *     （足すかどうかはその場で選ぶ。黙って足すと二重になるため）。
 *   ・「直す」は押した行のすぐ下で開く（2026-08-27 の直しと同じ形）。
 */

const emptyEvent = {
  name: "", balance_remaining: "", credit_limit: "", credit_used: "",
  closing_day: "", site_url: "", note: "",
};

const emptyBorrow = { borrowed_on: todayJst(), amount: "", note: "", addToBalance: true };

/** 負債かカードとして扱う行（どれか 1 つでも値が入っているもの） */
const isMoneyThing = (e) =>
  e.balance_remaining != null || e.credit_limit != null || e.credit_used != null || !!e.site_url;

export default function DebtCards({ data, reload }) {
  const { events, borrowings } = data;
  const [showAll, setShowAll] = useState(false);

  const shown = showAll ? events : events.filter(isMoneyThing);

  const totalDebt = events.reduce((s, e) => s + Number(e.balance_remaining ?? 0), 0);
  const totalLeft = events.reduce((s, e) => {
    const v = creditLeft(e);
    return v == null ? s : s + v;
  }, 0);
  const hasLimit = events.some((e) => e.credit_limit != null);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div style={lb10}>いまの合計</div>
          <div style={{ fontSize: 12, color: T.muted }}>
            返済残高 <b style={{ ...mono, color: T.text }}>{fmt(totalDebt)}</b>
            {hasLimit && <>　利用できる枠 <b style={{ ...mono, color: T.text }}>{fmt(totalLeft)}</b></>}
          </div>
        </div>
        {!hasLimit && (
          <div style={{ fontSize: 11, color: T.amber, marginTop: 6 }}>
            カードの枠がまだ 1 件も入っていません。枠を入れると「利用できる枠」が出ます。
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <button style={ghostBtn} onClick={() => setShowAll(!showAll)}>
            {showAll ? "負債とカードだけ出す" : "ほかのイベントも出す"}
          </button>
        </div>
      </div>

      {shown.length === 0 && (
        <div style={{ ...card, padding: "14px 16px", fontSize: 12, color: T.muted }}>
          まだ 1 件も入っていません。
        </div>
      )}

      {shown.map((e) => (
        <EventCard
          key={e.id}
          e={e}
          borrowings={borrowings.filter((b) => b.event_id === e.id)}
          reload={reload}
        />
      ))}
    </div>
  );
}

/* ── 1 件ぶん ──────────────────────────────────────────────────────── */

function EventCard({ e, borrowings, reload }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState(emptyEvent);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState(null);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [borrow, setBorrow]   = useState(emptyBorrow);

  const set  = (k) => (ev) => setForm({ ...form, [k]: ev.target.value });
  const setB = (k) => (ev) => setBorrow({ ...borrow, [k]: ev.target.value });

  const left = creditLeft(e);
  const rate =
    e.credit_limit != null && Number(e.credit_limit) > 0
      ? Math.min(100, Math.round((Number(e.credit_used ?? 0) / Number(e.credit_limit)) * 100))
      : null;
  const hot = rate != null && rate >= 80;

  const open = () => {
    setMsg(null);
    setBorrowOpen(false);
    setEditing(true);
    setForm({
      name: e.name ?? "",
      balance_remaining: String(e.balance_remaining ?? ""),
      credit_limit: String(e.credit_limit ?? ""),
      credit_used: String(e.credit_used ?? ""),
      closing_day: String(e.closing_day ?? ""),
      site_url: e.site_url ?? "",
      note: e.note ?? "",
    });
  };

  const close = () => { setEditing(false); setForm(emptyEvent); setMsg(null); };

  const save = async () => {
    setMsg(null);
    if (!form.name) { setMsg({ text: "呼び名を入れてください", ng: true }); return; }
    setSaving(true);
    try {
      await eventApi.save({
        id: e.id,
        name: form.name,
        balance_remaining: form.balance_remaining === "" ? null : Number(form.balance_remaining),
        credit_limit: form.credit_limit === "" ? null : Number(form.credit_limit),
        credit_used: form.credit_used === "" ? null : Number(form.credit_used),
        closing_day: form.closing_day === "" ? null : Number(form.closing_day),
        site_url: form.site_url || null,
        note: form.note || null,
      });
      await reload();
      close();
    } catch (err) {
      setMsg({ text: err.message ?? String(err), ng: true });
    } finally {
      setSaving(false);
    }
  };

  const addBorrow = async () => {
    setMsg(null);
    if (borrow.amount === "") { setMsg({ text: "金額を入れてください", ng: true }); return; }
    if (!borrow.borrowed_on)  { setMsg({ text: "借りた日を入れてください", ng: true }); return; }
    setSaving(true);
    try {
      await borrowingApi.save({
        event_id: e.id,
        borrowed_on: borrow.borrowed_on,
        amount: Number(borrow.amount),
        note: borrow.note || null,
      });
      if (borrow.addToBalance) {
        await eventApi.save({
          id: e.id,
          balance_remaining: Number(e.balance_remaining ?? 0) + Number(borrow.amount),
        });
      }
      setBorrow(emptyBorrow);
      setBorrowOpen(false);
      await reload();
    } catch (err) {
      setMsg({ text: err.message ?? String(err), ng: true });
    } finally {
      setSaving(false);
    }
  };

  const removeBorrow = async (b) => {
    setMsg(null);
    try {
      await borrowingApi.remove(b.id);
      await reload();
    } catch (err) {
      setMsg({ text: err.message ?? String(err), ng: true });
    }
  };

  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{e.name}</div>
          <div style={{ fontSize: 10, color: T.faint, marginTop: 2 }}>
            {e.direction === "out" ? "出ていく" : "入ってくる"}／{recurrenceText(e)}
            {e.amount != null && <>／毎回 {fmt(Number(e.amount))}</>}
            {e.amount_rule === "毎月変わる" && <span style={{ color: T.amber }}>／金額は毎月変わる</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {e.site_url && (
            <a href={e.site_url} target="_blank" rel="noreferrer" style={{ ...ghostBtn, textDecoration: "none", display: "inline-flex" }}>管理サイト</a>
          )}
          <button style={editing ? solidBtn(T.text) : ghostBtn} onClick={() => (editing ? close() : open())}>
            {editing ? "直しています" : "直す"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 12, color: T.muted, marginTop: 8, flexWrap: "wrap" }}>
        {e.balance_remaining != null && (
          <span>返済残高 <b style={{ ...mono, color: T.text }}>{fmt(Number(e.balance_remaining))}</b></span>
        )}
        {e.credit_limit != null && (
          <>
            <span>利用できる枠 <b style={{ ...mono, color: hot ? T.red : T.text }}>{fmt(left ?? 0)}</b></span>
            <span style={{ fontSize: 11 }}>（枠の総額 {fmt(Number(e.credit_limit))}／いま {fmt(Number(e.credit_used ?? 0))}）</span>
          </>
        )}
        {e.closing_day != null && <span>締め {e.closing_day} 日</span>}
      </div>

      {rate != null && (
        <>
          <div style={{ marginTop: 6, background: T.s2, borderRadius: 4, height: 6, overflow: "hidden" }}>
            <div style={{ width: `${rate}%`, height: "100%", background: hot ? T.red : T.green }} />
          </div>
          <div style={{ fontSize: 11, color: hot ? T.red : T.muted, marginTop: 2 }}>枠の {rate}% を使っています</div>
        </>
      )}

      {e.note && <div style={{ fontSize: 11, color: T.faint, marginTop: 6 }}>{e.note}</div>}

      {/* 直す */}
      {editing && (
        <div style={{ marginTop: 10, padding: "12px", background: T.s2, borderRadius: 6, border: `1px solid ${T.border}` }}>
          <div style={{ ...lb10, marginBottom: 8 }}>{e.name} を直す</div>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
            <F label="呼び名"><input style={inp} value={form.name} onChange={set("name")} /></F>
            <F label="返済残高（あといくら返すか）"><input style={inp} type="number" value={form.balance_remaining} onChange={set("balance_remaining")} /></F>
            <F label="枠の総額（上限）"><input style={inp} type="number" value={form.credit_limit} onChange={set("credit_limit")} /></F>
            <F label="いま使っている額"><input style={inp} type="number" value={form.credit_used} onChange={set("credit_used")} /></F>
            <F label="締め日"><input style={inp} type="number" min="1" max="31" value={form.closing_day} onChange={set("closing_day")} /></F>
            <F label="管理サイトの住所"><input style={inp} value={form.site_url} onChange={set("site_url")} placeholder="https://" /></F>
            <F label="備考"><input style={inp} value={form.note} onChange={set("note")} /></F>
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
            利用できる枠は入れません。枠の総額といま使っている額から出します。
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button style={solidBtn(T.text)} onClick={save} disabled={saving}>
              {saving ? "入れています" : "この内容にする"}
            </button>
            <button style={ghostBtn} onClick={close} disabled={saving}>やめる</button>
            {msg && <span style={{ fontSize: 11, color: msg.ng ? T.red : T.muted }}>{msg.text}</span>}
          </div>
        </div>
      )}

      {/* 追加で借りた記録 */}
      <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 12, paddingTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={lb10}>追加で借りた記録</div>
          <button style={ghostBtn} disabled={editing} onClick={() => { setBorrowOpen(!borrowOpen); setMsg(null); }}>
            {borrowOpen ? "やめる" : "1 件足す"}
          </button>
        </div>

        {borrowings.length === 0 && !borrowOpen && (
          <div style={{ fontSize: 11, color: T.faint, marginTop: 6 }}>まだ 1 件もありません。</div>
        )}

        {borrowings.map((b) => (
          <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "5px 0", borderTop: `1px solid ${T.border}` }}>
            <span>{b.borrowed_on}　{b.note ?? ""}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...mono, color: T.red }}>＋{fmt(Number(b.amount))}</span>
              <button style={{ ...ghostBtn, color: T.red }} onClick={() => removeBorrow(b)}>消す</button>
            </span>
          </div>
        ))}

        {borrowOpen && (
          <div style={{ marginTop: 10, padding: "12px", background: T.s2, borderRadius: 6, border: `1px solid ${T.border}` }}>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
              <F label="借りた日"><input style={inp} type="date" value={borrow.borrowed_on} onChange={setB("borrowed_on")} /></F>
              <F label="借りた額"><input style={inp} type="number" value={borrow.amount} onChange={setB("amount")} /></F>
              <F label="備考"><input style={inp} value={borrow.note} onChange={setB("note")} /></F>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={borrow.addToBalance}
                onChange={(ev) => setBorrow({ ...borrow, addToBalance: ev.target.checked })}
              />
              返済残高にもこの額を足す
            </label>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
              外すと、記録だけ残って返済残高は変わりません。すでに残高を手で直したときは外してください。
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button style={solidBtn(T.text)} onClick={addBorrow} disabled={saving}>
                {saving ? "入れています" : "足す"}
              </button>
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
