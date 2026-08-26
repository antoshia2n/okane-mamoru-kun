import { useMemo } from "react";
import { T, card, lb10, mono, fmt } from "shia2n-core";
import { buildForecast, todayJst, addDays, movableOn, monthlyFlow } from "../lib/calc.js";

/**
 * 開いて最初に出る画面。
 *   1. 口座ごとに、次にいくら足りなくなるか・いつまでに入れるか
 *   2. 月別の収支予測（2026-08-27 追加）
 *   3. 30 日ぶんの不足の並び
 *   4. 不足の原因（未入金・動かせる予定）
 *   5. 日付が決まっていないもの
 *
 * 未入金は積み上げに入れない。日付を過ぎたのにまだ入っていないお金を
 * 入る前提で計算すると、足りているように見えて落ちるため。
 * 代わりに「不足の原因」として並べる。
 */
export default function Today({ data }) {
  const { accounts, plans, balances } = data;
  const today = todayJst();

  const { points, undated, unpaid, byAccount } = useMemo(
    () => buildForecast(accounts, plans, addDays(today, 180), today),
    [accounts, plans, today]
  );

  const months = useMemo(
    () => monthlyFlow(accounts, plans, today, 6),
    [accounts, plans, today]
  );

  const soon = points.filter((p) => p.不足額 > 0 && p.日付 <= addDays(today, 30));
  const drift = balances.filter((b) => Number(b.diff ?? 0) !== 0)[0] ?? null;
  const movable = movableOn(points, addDays(today, 30));
  const nameOf = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const unpaidSum = unpaid.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* 一番上：警告 */}
      {soon.length > 0 && (
        <div style={{ ...card, borderColor: T.red, background: "#FBF0EF", padding: "14px 16px" }}>
          <div style={{ ...lb10, color: T.red, marginBottom: 6 }}>30 日以内に足りなくなります</div>
          <div style={{ fontSize: 20, ...mono, color: T.red }}>
            {soon[0].口座}　{fmt(soon[0].不足額)}
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
            {soon[0].日付} に不足。<b style={{ color: T.text }}>{soon[0].入れる期限} までに入れる</b>
          </div>
        </div>
      )}
      {soon.length === 0 && (
        <div style={{ ...card, borderColor: T.green, background: "#EFF5F1", padding: "14px 16px" }}>
          <div style={{ ...lb10, color: T.green, marginBottom: 4 }}>30 日以内の不足</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.green }}>ありません</div>
        </div>
      )}

      {drift && (
        <div style={{ ...card, borderColor: T.amber, background: "#FAF4EA", padding: "12px 16px" }}>
          <div style={{ ...lb10, color: T.amber, marginBottom: 4 }}>登録していない出入りがあります</div>
          <div style={{ fontSize: 12 }}>
            {drift.balance_date} に入れた実残高が、予測と {fmt(Math.abs(Number(drift.diff)))} ずれています。
          </div>
        </div>
      )}

      {/* 口座ごと */}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        {accounts.map((a) => {
          const s = byAccount[a.id];
          const first = s?.最初の不足 ?? null;
          return (
            <div key={a.id} style={{ ...card, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>{a.name}</div>
                <div style={{ ...lb10 }}>{a.kind}</div>
              </div>
              <div style={{ ...lb10, marginBottom: 2 }}>いまの残高（{a.base_balance_date}）</div>
              <div style={{ fontSize: 18, ...mono }}>{fmt(Number(a.base_balance ?? 0))}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                最低残高 {fmt(Number(a.min_balance ?? 0))}
              </div>
              <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 10, paddingTop: 10 }}>
                {first ? (
                  <>
                    <div style={{ ...lb10, color: T.red, marginBottom: 2 }}>次に足りなくなる</div>
                    <div style={{ fontSize: 15, ...mono, color: T.red }}>{fmt(first.不足額)}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>
                      {first.日付}／{first.入れる期限} までに入れる
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ ...lb10, color: T.green, marginBottom: 2 }}>半年先まで</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.green }}>足ります</div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 月別の収支予測 */}
      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={{ ...lb10, marginBottom: 4 }}>月別の収支予測</div>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
          日付が決まっていないものと、日付を過ぎた未入金は入れていません。
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: T.muted, textAlign: "left" }}>
              <th style={th}>月</th>
              <th style={{ ...th, textAlign: "right" }}>入り</th>
              <th style={{ ...th, textAlign: "right" }}>出</th>
              <th style={{ ...th, textAlign: "right" }}>差引</th>
              {accounts.map((a) => (
                <th key={a.id} style={{ ...th, textAlign: "right" }}>{a.name} 月末</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.月} style={{ borderTop: `1px solid ${T.border}` }}>
                <td style={td}>{m.月}</td>
                <td style={{ ...td, textAlign: "right", ...mono, color: T.green }}>{fmt(m.入り)}</td>
                <td style={{ ...td, textAlign: "right", ...mono, color: T.red }}>{fmt(m.出)}</td>
                <td style={{ ...td, textAlign: "right", ...mono, fontWeight: 700, color: m.差引 < 0 ? T.red : T.text }}>
                  {m.差引 < 0 ? "−" : "＋"}{fmt(Math.abs(m.差引))}
                </td>
                {accounts.map((a) => {
                  const v = m.月末残高[a.id] ?? 0;
                  const low = v < Number(a.min_balance ?? 0);
                  return (
                    <td key={a.id} style={{ ...td, textAlign: "right", ...mono, color: low ? T.red : T.text }}>
                      {fmt(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 30 日ぶんの不足 */}
      {soon.length > 0 && (
        <div style={{ ...card, padding: "14px 16px" }}>
          <div style={{ ...lb10, marginBottom: 10 }}>30 日以内に不足が出る日</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: T.muted, textAlign: "left" }}>
                <th style={th}>日付</th><th style={th}>口座</th>
                <th style={{ ...th, textAlign: "right" }}>予定残高</th>
                <th style={{ ...th, textAlign: "right" }}>不足額</th>
                <th style={th}>入れる期限</th>
              </tr>
            </thead>
            <tbody>
              {soon.map((p, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={td}>{p.日付}</td>
                  <td style={td}>{p.口座}</td>
                  <td style={{ ...td, textAlign: "right", ...mono, color: p.予定残高 < 0 ? T.red : T.text }}>{fmt(p.予定残高)}</td>
                  <td style={{ ...td, textAlign: "right", ...mono, color: T.red }}>{fmt(p.不足額)}</td>
                  <td style={{ ...td, color: T.muted }}>{p.入れる期限}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 不足の原因：未入金 */}
      {unpaid.length > 0 && (
        <div style={{ ...card, padding: "14px 16px", borderColor: T.amber }}>
          <div style={{ ...lb10, color: T.amber, marginBottom: 4 }}>
            不足の原因：入る日を過ぎたのに、まだ入っていないお金が {unpaid.length} 件・{fmt(unpaidSum)}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
            上の計算には入れていません。入る前提で数えると、足りているように見えて落ちるためです。
            入ったら、その回を「済」にしてください。
          </div>
          {unpaid.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderTop: `1px solid ${T.border}` }}>
              <span>
                <span style={{ color: T.amber, fontWeight: 700, marginRight: 6 }}>{p.plan_date}</span>
                {nameOf[p.account_id]}　{p.name}
              </span>
              <span style={{ ...mono, color: T.amber }}>＋{fmt(Number(p.amount))}</span>
            </div>
          ))}
        </div>
      )}

      {/* 不足の原因：動かせるもの */}
      {soon.length > 0 && (
        <div style={{ ...card, padding: "14px 16px" }}>
          <div style={{ ...lb10, marginBottom: 4 }}>動かせる予定</div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
            不足が出たときに手を打てるのはこれだけです。印が「動かせない」のものは出していません。
          </div>
          {movable.length === 0 ? (
            <div style={{ fontSize: 12, color: T.red }}>1 件もありません。外から入れる必要があります。</div>
          ) : (
            movable.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: i ? `1px solid ${T.border}` : "none", fontSize: 12 }}>
                <span>{m.日付}　{m.口座}　{m.name}</span>
                <span style={{ ...mono }}>{fmt(Number(m.amount))}　<span style={{ color: T.amber, fontWeight: 600 }}>{m.movable}</span></span>
              </div>
            ))
          )}
        </div>
      )}

      {/* 日付未定 */}
      {undated.length > 0 && (
        <div style={{ ...card, padding: "14px 16px" }}>
          <div style={{ ...lb10, marginBottom: 4 }}>日付が決まっていないもの</div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
            上の計算には入れていません。入る前提で計算すると、足りているように見えて落ちるためです。
          </div>
          {undated.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
              <span>{p.name}</span>
              <span style={mono}>{p.direction === "out" ? "−" : "＋"}{fmt(Number(p.amount))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const th = { padding: "4px 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.5px" };
const td = { padding: "6px" };
