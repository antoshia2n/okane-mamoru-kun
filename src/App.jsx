import { useState, useEffect, useCallback, useRef } from "react";
import { T, card } from "shia2n-core";
import { APP_NAME, TABS } from "./constants.js";
import { loadAll, addOccurrences } from "./lib/api.js";
import { missingOccurrences, todayJst } from "./lib/calc.js";
import Today from "./screens/Today.jsx";
import Calendar from "./screens/Calendar.jsx";
import Entry from "./screens/Entry.jsx";
import DebtCards from "./screens/DebtCards.jsx";
import Trend from "./screens/Trend.jsx";
import Guide from "./screens/Guide.jsx";
import Setup from "./screens/Setup.jsx";

export default function App() {
  const [tab, setTab]   = useState("今日");
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  const [busy, setBusy] = useState(true);
  const [made, setMade] = useState(0);      // この回に作った回の数
  const filling = useRef(false);            // 作りに行っている最中か

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const d = await loadAll();

      /**
       * 繰り返しの決まりから、まだ無い回を作る。
       * 新しく毎晩動くものを増やさず、画面を開いたときに 1 回だけ通す。
       * 同じ回は鍵で弾くので、何回開いても増えない。
       */
      if (!filling.current) {
        const rows = missingOccurrences(d.events, d.plans, todayJst());
        if (rows.length > 0) {
          filling.current = true;
          try {
            await addOccurrences(rows);
            const d2 = await loadAll();
            setData(d2);
            setMade(rows.length);
            setErr(null);
            return;
          } finally {
            filling.current = false;
          }
        }
      }

      setData(d);
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
      {made > 0 && (
        <div style={{ ...card, padding: "8px 14px", marginBottom: 12, borderColor: T.blue, background: "#EEF2F8", fontSize: 12 }}>
          繰り返しの決まりから、先の月の予定を {made} 件作りました。金額は見込みです。
        </div>
      )}
      {tab === "今日"        && <Today {...p} />}
      {tab === "カレンダー"  && <Calendar {...p} />}
      {tab === "推移"        && <Trend {...p} />}
      {tab === "入力"        && <Entry {...p} />}
      {tab === "負債とカード" && <DebtCards {...p} />}
      {tab === "使い方"      && <Guide />}
    </>
  );
}
