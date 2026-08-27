import { useMemo, useState } from "react";
import { T, card, lb10, mono, fmt, ghostBtn } from "shia2n-core";
import { buildForecast, todayJst, addDays, monthDays } from "../lib/calc.js";

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
export default function Calendar({ data }) {
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
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}

/* ── 押した日の中身（読むだけ） ────────────────────────────────────── */

function DayPanel({ date, rows, onClose }) {
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={lb10}>{date} の中身</div>
        <button style={ghostBtn} onClick={onClose}>閉じる</button>
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
        この画面は見るだけです。金額を直すのは「確定」、日付や繰り返しを直すのは「登録」です。
      </div>

      {rows.length === 0 && (
        <div style={{ fontSize: 12, color: T.muted }}>この日は出入りがありません。</div>
      )}

      {rows.map((p, i) => (
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
                {m.pair_key && <span style={{ marginLeft: 6, fontSize: 10, color: T.blue }}>対</span>}
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
      ))}
    </div>
  );
}
