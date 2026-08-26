import { useState, useEffect, useCallback } from "react";
import { T, card } from "shia2n-core";
import { APP_NAME, TABS } from "./constants.js";
import { loadAll } from "./lib/api.js";
import Today from "./screens/Today.jsx";
import Calendar from "./screens/Calendar.jsx";
import Entry from "./screens/Entry.jsx";
import DebtCards from "./screens/DebtCards.jsx";
import Setup from "./screens/Setup.jsx";

export default function App() {
  const [tab, setTab]   = useState("今日");
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  const [busy, setBusy] = useState(true);

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      setData(await loadAll());
      setErr(null);
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const shell = (children) => (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Noto Sans JP','Hiragino Sans',sans-serif", fontSize: 13, color: T.text }}>
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{APP_NAME}</div>
        <nav style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ background: tab === t ? T.text : "transparent", color: tab === t ? "#fff" : T.muted, border: "none", borderRadius: 6, padding: "5px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {t}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ padding: "14px 16px", maxWidth: 860, margin: "0 auto" }}>{children}</div>
    </div>
  );

  if (err && /OKANE_ALLOW_UID|使える人がまだ設定/.test(err)) return shell(<Setup message={err} onDone={reload} />);
  if (busy && !data) return shell(<div style={{ ...card, padding: 24, textAlign: "center", color: T.muted }}>読み込んでいます…</div>);
  if (err) return shell(
    <div style={{ ...card, padding: 20, borderColor: T.red }}>
      <div style={{ fontWeight: 700, color: T.red, marginBottom: 6 }}>読み込めませんでした</div>
      <div style={{ color: T.muted, fontSize: 12, whiteSpace: "pre-wrap" }}>{err}</div>
      <button onClick={reload} style={{ marginTop: 12, background: T.text, color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>もう一度</button>
    </div>
  );

  const p = { data, reload, busy };
  return shell(
    <>
      {tab === "今日"        && <Today {...p} />}
      {tab === "カレンダー"  && <Calendar {...p} />}
      {tab === "入力"        && <Entry {...p} />}
      {tab === "負債とカード" && <DebtCards {...p} />}
    </>
  );
}
