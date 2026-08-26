import { useMemo, useState } from "react";
import { T, card, lb10, mono, fmt, ghostBtn } from "shia2n-core";
import { buildForecast, todayJst, addDays, monthDays } from "../lib/calc.js";

/**
 * 引き落とし日と入金日を、月の並びの上で見る画面。
 * 日を押すと、その日の内訳と、その日の予定残高が出る。
 */
export default function Calendar({ data }) {
  const { accounts, plans } = data;
  const today = todayJst();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
  const [picked, setPicked] = useState(null);

  const { points } = useMemo(
    () => buildForecast(accounts, plans, addDays(today, 400)),
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
            const outSum = rows.flatMap(r => r.動き).filter(m => m.direction === "out").reduce((s, m) => s + Number(m.amount), 0);
            const inSum  = rows.flatMap(r => r.動き).filter(m => m.direction === "in").reduce((s, m) => s + Number(m.amount), 0);
            const isToday = d === today;
            return (
              <button key={d} onClick={() => setPicked(d)}
                style={{
                  minHeight: 62, textAlign: "left", padding: "4px 5px", cursor: "pointer",
                  background: short ? "#FBF0EF" : picked === d ? T.s2 : T.surface,
                  border: `1px solid ${picked === d ? T.text : short ? T.red : isToday ? T.blue : T.border}`,
                  borderRadius: 6, fontFamily: "inherit", color: T.text,
                }}>
                <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? T.blue : T.muted }}>
                  {Number(d.slice(8, 10))}
                </div>
                {outSum > 0 && <div style={{ fontSize: 9, ...mono, color: T.red }}>−{Math.round(outSum / 1000)}K</div>}
                {inSum > 0 && <div style={{ fontSize: 9, ...mono, color: T.green }}>＋{Math.round(inSum / 1000)}K</div>}
                {short && <div style={{ fontSize: 9, fontWeight: 700, color: T.red }}>不足</div>}
              </button>
            );
          })}
        </div>
      </div>

      {picked && (
        <div style={{ ...card, padding: "14px 16px" }}>
          <div style={{ ...lb10, marginBottom: 10 }}>{picked} の中身</div>
          {pickedRows.length === 0 ? (
            <div style={{ fontSize: 12, color: T.muted }}>この日は出入りがありません。</div>
          ) : (
            pickedRows.map((p, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                  <span>{p.口座}</span>
                  <span style={{ ...mono, color: p.予定残高 < 0 ? T.red : T.text }}>
                    予定残高 {fmt(p.予定残高)}
                  </span>
                </div>
                {p.動き.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0 4px 10px", color: T.muted }}>
                    <span>
                      {m.name}
                      <span style={{ marginLeft: 6, fontSize: 10, color: m.certainty === "見込み" ? T.amber : T.faint }}>{m.certainty}</span>
                      {m.movable !== "動かせない" && <span style={{ marginLeft: 6, fontSize: 10, color: T.blue }}>{m.movable}</span>}
                    </span>
                    <span style={{ ...mono, color: m.direction === "out" ? T.red : T.green }}>
                      {m.direction === "out" ? "−" : "＋"}{fmt(Number(m.amount))}
                    </span>
                  </div>
                ))}
                {p.不足額 > 0 && (
                  <div style={{ fontSize: 12, color: T.red, fontWeight: 700, paddingLeft: 10 }}>
                    不足 {fmt(p.不足額)}（{p.入れる期限} までに入れる）
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
