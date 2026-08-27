import { useState } from "react";
import { T, card, lb10, inp, mono, fmt, solidBtn, ghostBtn } from "shia2n-core";
import { RECUR_KIND, WEEKDAYS, CERTAINTY, MOVABLE, AMOUNT_RULE, KINDS } from "../constants.js";
import { eventApi, borrowingApi, saveAccount, deletePlan } from "../lib/api.js";
import { recurrenceText, creditLeft, todayJst, amountRange } from "../lib/calc.js";

/**
 * 登録の画面。
 *
 * **続いているものを 1 件作る場所。**たまにしか触らない。
 * ここで作った 1 件から、毎月の動きが自動で生まれる。
 *
 * 入ってくるものと出ていくもので、持つ情報が違うのでフォームを分けた。
 *   入ってくる：相手・入るはずの日・金額が毎月変わるか
 *   出ていく　：どの口座から・動かせるか・（借入やカードなら）返済残高と枠
 *
 * 負債とカードという分け方はやめた（2026-08-27 Naoki 差し戻し）。
 * 借入もカードも「続いているもの」の 1 つの形で、毎月の返済とその残高が
 * 同じ 1 件の中で繋がっている。別の画面に置くと繋がりが切れる。
 *
 * 数字を置く場所は 3 つに分けてある。「残り」という言い方はしない。
 *   返済残高　　　＝ あといくら返すか
 *   枠の総額　　　＝ そのカードで使える上限
 *   いま使っている額
 * 画面に出る「使える枠」は、枠の総額 − いま使っている額 で出す。
 */

const emptyEvent = {
  name: "", account_id: "", direction: "out",
  recur_kind: "monthly_day", recur_day: "", recur_weekday: "1", ends_on: "",
  amount: "", amount_high: "", amount_rule: "毎回同じ", certainty: "確定", movable: "動かせない",
  expected_by: "", balance_remaining: "", credit_limit: "", credit_used: "",
  closing_day: "", site_url: "", note: "", active: true,
};

const emptyBorrow = { borrowed_on: todayJst(), amount: "", note: "", addToBalance: true };

export default function Register({ data, reload }) {
  const { events, accounts, borrowings, plans } = data;
  const [adding, setAdding] = useState(null);   // "in" | "out" | null
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showAccounts, setShowAccounts] = useState(false);

  const ins  = events.filter((e) => e.direction === "in");
  const outs = events.filter((e) => e.direction === "out");

  const close = () => { setAdding(null); setEditId(null); setMsg(null); };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={lb10}>登録</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
          続いているもの（契約・借入・カード・入金元）を 1 件ずつ入れる場所です。
          ここで入れた 1 件から、毎月の動きが自動で生まれます。<b style={{ color: T.text }}>毎月入れ直す必要はありません。</b>
        </div>
        {msg && <div style={{ fontSize: 11, color: msg.ng ? T.red : T.green, marginTop: 8 }}>{msg.text}</div>}
      </div>

      <Group
        title="入ってくるもの" color={T.green} dir="in"
        list={ins} accounts={accounts} borrowings={borrowings} plans={plans}
        adding={adding} setAdding={setAdding} editId={editId} setEditId={setEditId}
        reload={reload} setMsg={setMsg} close={close}
      />

      <Group
        title="出ていくもの" color={T.red} dir="out"
        list={outs} accounts={accounts} borrowings={borrowings} plans={plans}
        adding={adding} setAdding={setAdding} editId={editId} setEditId={setEditId}
        reload={reload} setMsg={setMsg} close={close}
      />

      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={lb10}>口座</div>
          <button style={ghostBtn} onClick={() => setShowAccounts(!showAccounts)}>
            {showAccounts ? "閉じる" : "開く"}
          </button>
        </div>
        {showAccounts && <AccountBlock accounts={accounts} reload={reload} setMsg={setMsg} />}
      </div>
    </div>
  );
}

/* ── 入り／出 のまとまり ──────────────────────────────────────────── */

function Group({ title, color, dir, list, accounts, borrowings, plans, adding, setAdding, editId, setEditId, reload, setMsg, close }) {
  const busyElsewhere = (adding && adding !== dir) || !!editId;

  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ ...lb10, color }}>{title}（{list.length}）</div>
        <button
          style={adding === dir ? solidBtn(T.text) : ghostBtn}
          disabled={busyElsewhere}
          onClick={() => (adding === dir ? close() : (setEditId(null), setAdding(dir)))}
        >
          {adding === dir ? "やめる" : "1 件足す"}
        </button>
      </div>

      {adding === dir && (
        <Form
          initial={{ ...emptyEvent, direction: dir }}
          accounts={accounts} dir={dir}
          onDone={async () => { close(); await reload(); setMsg({ text: "入りました" }); }}
          onError={(t) => setMsg({ text: t, ng: true })}
          onCancel={close}
        />
      )}

      {list.length === 0 && adding !== dir && (
        <div style={{ fontSize: 12, color: T.muted }}>まだ 1 件もありません。</div>
      )}

      {list.map((e) => (
        <Card
          key={e.id} e={e} accounts={accounts} dir={dir} plans={plans}
          borrowings={borrowings.filter((b) => b.event_id === e.id)}
          editing={editId === e.id}
          disabled={(!!editId && editId !== e.id) || !!adding}
          onOpen={() => { setAdding(null); setEditId(e.id); setMsg(null); }}
          onClose={close}
          reload={reload} setMsg={setMsg}
        />
      ))}
    </div>
  );
}

/* ── 1 件ぶんの表示 ────────────────────────────────────────────────── */

function Card({ e, accounts, dir, plans, borrowings, editing, disabled, onOpen, onClose, reload, setMsg }) {
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [borrow, setBorrow] = useState(emptyBorrow);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);

  const accountName = accounts.find((a) => a.id === e.account_id)?.name ?? "口座が未設定";
  const mine = plans.filter((p) => p.event_id === e.id);
  const range = amountRange(e, mine);
  const left = creditLeft(e);
  const rate = e.credit_limit != null && Number(e.credit_limit) > 0
    ? Math.min(100, Math.round((Number(e.credit_used ?? 0) / Number(e.credit_limit)) * 100)) : null;
  const hot = rate != null && rate >= 80;
  const nextOne = plans
    .filter((p) => p.event_id === e.id && p.status === "未" && p.plan_date && p.plan_date >= todayJst())
    .sort((x, y) => (x.plan_date < y.plan_date ? -1 : 1))[0] ?? null;

  const setB = (k) => (ev) => setBorrow({ ...borrow, [k]: ev.target.value });

  const addBorrow = async () => {
    if (borrow.amount === "") { setMsg({ text: "金額を入れてください", ng: true }); return; }
    setBusy(true);
    try {
      await borrowingApi.save({
        event_id: e.id, borrowed_on: borrow.borrowed_on,
        amount: Number(borrow.amount), note: borrow.note || null,
      });
      if (borrow.addToBalance) {
        await eventApi.save({
          id: e.id,
          balance_remaining: Number(e.balance_remaining ?? 0) + Number(borrow.amount),
        });
      }
      setBorrow(emptyBorrow); setBorrowOpen(false);
      await reload(); setMsg({ text: "借りた分を入れました" });
    } catch (err) {
      setMsg({ text: err.message ?? String(err), ng: true });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ padding: "10px 0", borderTop: `1px solid ${T.border}`, opacity: disabled ? 0.45 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {e.name}
            {!e.active && <span style={{ marginLeft: 6, fontSize: 10, color: T.muted }}>使っていない</span>}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 22, fontWeight: 700, ...mono, color: dir === "in" ? T.green : T.red }}>
              {range
                ? `${fmt(range.low)} 〜 ${fmt(range.high)}`
                : e.amount != null ? fmt(Number(e.amount)) : "額が未入力"}
            </span>
            <span style={{ fontSize: 11, color: T.muted }}>
              {recurrenceText(e)}
              {e.ends_on && <>・{String(e.ends_on).slice(0, 7)} まで</>}
            </span>
          </div>
          <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>
            {accountName}
            {e.amount_rule === "毎月変わる" && <span style={{ color: T.amber }}>・毎月変わる</span>}
            {range && <span style={{ color: T.amber }}>・幅の出どころは{range.出どころ}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {e.site_url && (
            <a href={e.site_url} target="_blank" rel="noreferrer" style={{ ...ghostBtn, textDecoration: "none", display: "inline-flex" }}>管理サイト</a>
          )}
          <button style={editing ? solidBtn(T.text) : ghostBtn} disabled={disabled} onClick={() => (editing ? onClose() : onOpen())}>
            {editing ? "編集中" : "編集"}
          </button>
          <button style={{ ...ghostBtn, color: T.red }} disabled={disabled} onClick={() => setAsk(true)}>
            削除
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, fontSize: 12, color: T.muted, marginTop: 6, flexWrap: "wrap" }}>
        {nextOne && <span>次は {nextOne.plan_date}</span>}
        {e.expected_by && <span>入るはずの日 {String(e.expected_by).slice(0, 10)}</span>}
        {e.balance_remaining != null && (
          <span>返済残高 <b style={{ ...mono, color: T.text }}>{fmt(Number(e.balance_remaining))}</b></span>
        )}
        {e.credit_limit != null && (
          <span>使える枠 <b style={{ ...mono, color: hot ? T.red : T.text }}>{fmt(left ?? 0)}</b>
            <span style={{ fontSize: 11 }}>（枠 {fmt(Number(e.credit_limit))}／いま {fmt(Number(e.credit_used ?? 0))}）</span>
          </span>
        )}
        {e.closing_day != null && <span>締め {e.closing_day} 日</span>}
      </div>

      {rate != null && (
        <div style={{ marginTop: 6, background: T.s2, borderRadius: 4, height: 6, overflow: "hidden" }}>
          <div style={{ width: `${rate}%`, height: "100%", background: hot ? T.red : T.green }} />
        </div>
      )}

      {e.note && <div style={{ fontSize: 11, color: T.faint, marginTop: 4 }}>{e.note}</div>}

      {ask && (
        <DeleteAsk
          e={e}
          mine={mine}
          onCancel={() => setAsk(false)}
          onDone={async (alsoPlans) => {
            setBusy(true);
            try {
              if (alsoPlans) {
                for (const p of mine.filter((x) => x.status === "未")) await deletePlan(p.id);
              }
              await eventApi.remove(e.id);
              setAsk(false);
              await reload();
              setMsg({ text: `${e.name} を削除しました` });
            } catch (err) {
              setMsg({ text: err.message ?? String(err), ng: true });
            } finally { setBusy(false); }
          }}
          busy={busy}
        />
      )}

      {editing && (
        <Form
          initial={toForm(e)} accounts={accounts} dir={dir} id={e.id}
          onDone={async () => { onClose(); await reload(); setMsg({ text: "入りました" }); }}
          onError={(t) => setMsg({ text: t, ng: true })}
          onCancel={onClose}
        />
      )}

      {/* 借入だけ：追加で借りた記録 */}
      {dir === "out" && e.balance_remaining != null && !editing && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ ...lb10 }}>追加で借りた記録（{borrowings.length}）</div>
            <button style={ghostBtn} disabled={disabled} onClick={() => setBorrowOpen(!borrowOpen)}>
              {borrowOpen ? "やめる" : "1 件足す"}
            </button>
          </div>
          {borrowings.map((b) => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0" }}>
              <span style={{ color: T.muted }}>{b.borrowed_on}　{b.note ?? ""}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ ...mono, color: T.red }}>＋{fmt(Number(b.amount))}</span>
                <button style={{ ...ghostBtn, color: T.red }} onClick={async () => {
                  try { await borrowingApi.remove(b.id); await reload(); } catch (err) { setMsg({ text: err.message ?? String(err), ng: true }); }
                }}>消す</button>
              </span>
            </div>
          ))}
          {borrowOpen && (
            <div style={{ marginTop: 8, padding: 12, background: T.s2, borderRadius: 6, border: `1px solid ${T.border}` }}>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
                <F label="借りた日"><input style={inp} type="date" value={borrow.borrowed_on} onChange={setB("borrowed_on")} /></F>
                <F label="借りた額"><input style={inp} type="number" value={borrow.amount} onChange={setB("amount")} /></F>
                <F label="備考"><input style={inp} value={borrow.note} onChange={setB("note")} /></F>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 8 }}>
                <input type="checkbox" checked={borrow.addToBalance} onChange={(ev) => setBorrow({ ...borrow, addToBalance: ev.target.checked })} />
                返済残高にもこの額を足す
              </label>
              <div style={{ marginTop: 10 }}>
                <button style={solidBtn(T.text)} onClick={addBorrow} disabled={busy}>足す</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 入力のかたち ──────────────────────────────────────────────────── */

const toForm = (e) => ({
  name: e.name ?? "", account_id: String(e.account_id ?? ""), direction: e.direction,
  recur_kind: e.recur_kind ?? "once",
  recur_day: String(e.recur_day ?? ""), recur_weekday: String(e.recur_weekday ?? "1"),
  ends_on: e.ends_on ? String(e.ends_on).slice(0, 7) : "",
  amount: String(e.amount ?? ""), amount_high: String(e.amount_high ?? ""), amount_rule: e.amount_rule ?? "毎回同じ",
  certainty: e.certainty ?? "確定", movable: e.movable ?? "動かせない",
  expected_by: e.expected_by ? String(e.expected_by).slice(0, 10) : "",
  balance_remaining: String(e.balance_remaining ?? ""),
  credit_limit: String(e.credit_limit ?? ""), credit_used: String(e.credit_used ?? ""),
  closing_day: String(e.closing_day ?? ""), site_url: e.site_url ?? "",
  note: e.note ?? "", active: e.active !== false,
});

function Form({ initial, accounts, dir, id, onDone, onError, onCancel }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [money, setMoney] = useState(
    initial.balance_remaining !== "" || initial.credit_limit !== ""
  );

  const save = async () => {
    if (!f.name) { onError("呼び名を入れてください"); return; }
    if (!f.account_id) { onError("口座を選んでください"); return; }
    if (f.recur_kind === "monthly_day" && f.recur_day === "") { onError("何日かを入れてください"); return; }
    setBusy(true);
    try {
      await eventApi.save({
        ...(id ? { id } : { key: `ev_manual_${Date.now()}` }),
        name: f.name,
        account_id: Number(f.account_id),
        direction: dir,
        recur_kind: f.recur_kind,
        recur_day: f.recur_kind === "monthly_day" && f.recur_day !== "" ? Number(f.recur_day) : null,
        recur_weekday: f.recur_kind === "weekly" ? Number(f.recur_weekday) : null,
        ends_on: f.ends_on ? `${f.ends_on}-01` : null,
        amount: f.amount === "" ? null : Number(f.amount),
        amount_high: f.amount_high === "" ? null : Number(f.amount_high),
        amount_rule: f.amount_rule,
        certainty: f.certainty,
        movable: f.movable,
        expected_by: dir === "in" && f.expected_by ? f.expected_by : null,
        balance_remaining: money && f.balance_remaining !== "" ? Number(f.balance_remaining) : null,
        credit_limit: money && f.credit_limit !== "" ? Number(f.credit_limit) : null,
        credit_used: money && f.credit_used !== "" ? Number(f.credit_used) : null,
        closing_day: money && f.closing_day !== "" ? Number(f.closing_day) : null,
        site_url: f.site_url || null,
        note: f.note || null,
        active: !!f.active,
      });
      await onDone();
    } catch (e) {
      onError(e.message ?? String(e));
    } finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 10, padding: 12, background: T.s2, borderRadius: 6, border: `1px solid ${T.border}` }}>
      <div style={{ ...lb10, marginBottom: 8 }}>
        {id ? "編集" : dir === "in" ? "入ってくるものを 1 件足す" : "出ていくものを 1 件足す"}
      </div>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
        <F label={dir === "in" ? "誰から／何の入金か" : "呼び名"}>
          <input style={inp} value={f.name} onChange={set("name")} />
        </F>
        <F label={dir === "in" ? "どの口座へ入るか" : "どの口座から落ちるか"}>
          <select style={inp} value={f.account_id} onChange={set("account_id")}>
            <option value="">選ぶ</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </F>
        <F label="繰り返し">
          <select style={inp} value={f.recur_kind} onChange={set("recur_kind")}>
            {RECUR_KIND.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </F>
        {f.recur_kind === "monthly_day" && (
          <F label="何日か"><input style={inp} type="number" min="1" max="31" value={f.recur_day} onChange={set("recur_day")} /></F>
        )}
        {f.recur_kind === "weekly" && (
          <F label="何曜か">
            <select style={inp} value={f.recur_weekday} onChange={set("recur_weekday")}>
              {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w} 曜</option>)}
            </select>
          </F>
        )}
        <F label="終わりの月（空なら終わりなし）">
          <input style={inp} type="month" value={f.ends_on} onChange={set("ends_on")} />
        </F>
        <F label={dir === "in" ? "いくら入る見込みか" : "いくら落ちる見込みか"}>
          <input style={inp} type="number" value={f.amount} onChange={set("amount")} />
        </F>
        {f.amount_rule === "毎月変わる" && (
          <F label="多めに見たときの額（空でも可）">
            <input style={inp} type="number" value={f.amount_high} onChange={set("amount_high")} />
          </F>
        )}
        <F label="金額の決まり方">
          <select style={inp} value={f.amount_rule} onChange={set("amount_rule")}>
            {AMOUNT_RULE.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </F>
        <F label="確定か見込みか">
          <select style={inp} value={f.certainty} onChange={set("certainty")}>
            {CERTAINTY.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </F>
        {dir === "in" ? (
          <F label="入るはずの日（相手との約束）">
            <input style={inp} type="date" value={f.expected_by} onChange={set("expected_by")} />
          </F>
        ) : (
          <F label="動かせるか">
            <select style={inp} value={f.movable} onChange={set("movable")}>
              {MOVABLE.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </F>
        )}
        <F label="備考"><input style={inp} value={f.note} onChange={set("note")} /></F>
      </div>

      {f.amount_rule === "毎月変わる" && (
        <div style={{ fontSize: 11, color: T.amber, marginTop: 8 }}>
          少なめの額を不足額の計算に使い、多めの額は幅の上側として画面に出します。
          実績が 3 回たまったら、手で入れた幅より実績の最小と最大を使います。
          {dir === "in" ? "入りは少なめに寄せます（多めに見て外れると落ちるため）。" : "出は多めに寄せます。"}
        </div>
      )}

      {dir === "out" && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={money} onChange={(e) => setMoney(e.target.checked)} />
            借入かカード（返済残高や枠を持つ）
          </label>
          {money && (
            <>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginTop: 8 }}>
                <F label="返済残高（あといくら返すか）"><input style={inp} type="number" value={f.balance_remaining} onChange={set("balance_remaining")} /></F>
                <F label="枠の総額（上限）"><input style={inp} type="number" value={f.credit_limit} onChange={set("credit_limit")} /></F>
                <F label="いま使っている額"><input style={inp} type="number" value={f.credit_used} onChange={set("credit_used")} /></F>
                <F label="締め日"><input style={inp} type="number" min="1" max="31" value={f.closing_day} onChange={set("closing_day")} /></F>
                <F label="管理サイトの住所"><input style={inp} value={f.site_url} onChange={set("site_url")} placeholder="https://" /></F>
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>
                使える枠は入れません。枠の総額といま使っている額から出します。
                返済残高を入れておくと、確定の画面で返済を確定させたときに、その額だけ減らせます。
              </div>
            </>
          )}
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 10 }}>
        <input type="checkbox" checked={!!f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        いま使っている（外すと、これから先の動きが作られなくなります）
      </label>

      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <button style={solidBtn(T.text)} onClick={save} disabled={busy}>
          {busy ? "入れています" : id ? "この内容にする" : "登録する"}
        </button>
        <button style={ghostBtn} onClick={onCancel} disabled={busy}>やめる</button>
      </div>
    </div>
  );
}

/* ── 口座 ──────────────────────────────────────────────────────────── */

function AccountBlock({ accounts, reload, setMsg }) {
  const [draft, setDraft] = useState(
    Object.fromEntries(accounts.map((a) => [a.id, String(a.min_balance ?? 0)]))
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      for (const a of accounts) {
        await saveAccount({ id: a.id, min_balance: Number(draft[a.id]) });
      }
      await reload(); setMsg({ text: "最低残高を入れました" });
    } catch (e) {
      setMsg({ text: e.message ?? String(e), ng: true });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
        最低残高は「ここを割ったら足りないとみなす額」です。0 にすると、残高 0 円を正常と判定します。
      </div>
      {accounts.map((a) => (
        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `1px solid ${T.border}`, gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12 }}>
            <b>{a.name}</b>
            <span style={{ marginLeft: 8, color: T.muted, fontSize: 11 }}>
              {a.kind}／いま {fmt(Number(a.base_balance ?? 0))}（{a.base_balance_date}）
            </span>
          </span>
          <label style={{ fontSize: 11, color: T.muted }}>
            最低残高　
            <input style={{ ...inp, width: 140, textAlign: "right" }} type="number"
              value={draft[a.id] ?? ""} onChange={(e) => setDraft({ ...draft, [a.id]: e.target.value })} />
          </label>
        </div>
      ))}
      <div style={{ marginTop: 10 }}>
        <button style={solidBtn(T.text)} onClick={save} disabled={busy}>入れる</button>
      </div>
    </div>
  );
}

function DeleteAsk({ e, mine, onCancel, onDone, busy }) {
  const [alsoPlans, setAlsoPlans] = useState(true);
  const notYet = mine.filter((p) => p.status === "未").length;
  const done   = mine.filter((p) => p.status === "済").length;

  return (
    <div style={{ marginTop: 10, padding: 12, background: "#FBF0EF", borderRadius: 6, border: `1px solid ${T.red}` }}>
      <div style={{ ...lb10, color: T.red, marginBottom: 6 }}>{e.name} を削除しますか</div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        この登録にぶら下がっている動きは、まだのものが <b style={{ ...mono }}>{notYet}</b> 件、
        確定済みのものが <b style={{ ...mono }}>{done}</b> 件あります。
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <input type="checkbox" checked={alsoPlans} onChange={(ev) => setAlsoPlans(ev.target.checked)} />
        まだの動き {notYet} 件も一緒に消す
      </label>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
        外すと、動きだけが登録から切り離されて残ります。確定済みの {done} 件は消しません
        （過去に起きたことなので、消すと実残高との差が合わなくなります）。
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button style={solidBtn(T.red)} onClick={() => onDone(alsoPlans)} disabled={busy}>
          {busy ? "消しています" : "削除する"}
        </button>
        <button style={ghostBtn} onClick={onCancel} disabled={busy}>やめる</button>
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
