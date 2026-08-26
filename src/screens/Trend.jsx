import { useMemo } from "react";
import { T, card, lb10, mono, fmt } from "shia2n-core";
import { buildForecast, todayJst, addDays } from "../lib/calc.js";

/**
 * 月ごとの推移。渡されたシートの「1 日時点口座残高」の節と同じ見方をする。
 *   ・月末時点の予定残高を、口座ごとと合計で並べる
 *   ・実残高を入れた月は、予測とのずれとその割合を出す
 *   ・ずれの割合が 10% 以上のときは危ないものとして赤で出す（シートの線をそのまま使う）
 */
export default function Trend({ data }) {
  const { accounts, plans, balances } = data;
  const today = todayJst();

  const { points } = useMemo(
    () => buildForecast(accounts, plans, addDays(today, 500)),
    [accounts, plans, today]
  );

  // 月末時点の予定残高を口座ごとに拾う
  const rows = useMemo(() => {
    const months = new Set();
    for (const p of points) months.add(p.日付.slice(0, 7));
    for (const b of balances) months.add(String(b.balance_date).slice(0, 7));
    const list = Array.from(months).sort();

    return list.map((m) => {
      const perAccount = accounts.map((a) => {
        const upto = points.filter((p) => p.accountId === a.id && p.日付.slice(0, 7) <= m);
        const last = upto[upto.length - 1];
        const value = last ? last.予定残高 : Number(a.base_balance ?? 0);
        const shortDays = points.filter((p) => p.accountId === a.id && p.日付.slice(0, 7) === m && p.不足額 > 0);
        const actual = balances.find((b) => b.account_id === a.id && String(b.balance_date).slice(0, 7) === m) ?? null;
        return { account: a, value, shortDays, actual };
      });
      const total = perAccount.reduce((s, x) => s + x.value, 0);
      return { month: m, perAccount, total };
    });
  }, [points, balances, accounts]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={{ ...lb10, marginBottom: 4 }}>月末時点の予定残高</div>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>
          その月の終わりに、口座がいくらになっている見込みかを並べています。
          入る日が決まっていない入金は入れていないので、先の月ほど低く出ます。
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 520 }}>
            <thead>
              <tr style={{ color: T.muted, textAlign: "right" }}>
                <th style={{ ...th, textAlign: "left" }}>月</th>
                {accounts.map((a) => <th key={a.id} style={th}>{a.name}</th>)}
                <th style={th}>合計</th>
                <th style={{ ...th, textAlign: "left" }}>不足が出る日</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ ...td, fontWeight: 700 }}>{r.month}</td>
                  {r.perAccount.map((x) => (
                    <td key={x.account.id} style={{ ...td, textAlign: "right", ...mono, color: x.value < Number(x.account.min_balance ?? 0) ? T.red : T.text }}>
                      {fmt(x.value)}
                    </td>
                  ))}
                  <td style={{ ...td, textAlign: "right", ...mono, color: r.total < 0 ? T.red : T.text }}>{fmt(r.total)}</td>
                  <td style={{ ...td, color: T.red, fontSize: 11 }}>
                    {r.perAccount.flatMap((x) => x.shortDays.map((d) => d.日付.slice(8, 10))).join("・") || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...card, padding: "14px 16px" }}>
        <div style={{ ...lb10, marginBottom: 4 }}>予測と実際のずれ</div>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>
          実残高を入れた回だけ出ます。ずれるということは、登録していない出入りがあるということです。
          ずれの割合が 10% を超えたら赤で出します。
        </div>
        {balances.length === 0 ? (
          <div style={{ fontSize: 12, color: T.muted }}>
            まだ実残高を 1 回も入れていません。「入力」タブの「実残高」から入れてください。
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: T.muted, textAlign: "right" }}>
                <th style={{ ...th, textAlign: "left" }}>日付</th>
                <th style={{ ...th, textAlign: "left" }}>口座</th>
                <th style={th}>予測</th><th style={th}>実際</th><th style={th}>ずれ</th><th style={th}>割合</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => {
                const a = accounts.find((x) => x.id === b.account_id);
                const pred = Number(b.predicted_balance ?? 0);
                const act = Number(b.actual_balance ?? 0);
                const diff = Number(b.diff ?? 0);
                const rate = act !== 0 ? Math.abs(diff / act) * 100 : null;
                const danger = rate != null && rate >= 10;
                return (
                  <tr key={b.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={td}>{b.balance_date}</td>
                    <td style={td}>{a?.name ?? ""}</td>
                    <td style={{ ...td, textAlign: "right", ...mono }}>{fmt(pred)}</td>
                    <td style={{ ...td, textAlign: "right", ...mono }}>{fmt(act)}</td>
                    <td style={{ ...td, textAlign: "right", ...mono, color: diff === 0 ? T.green : T.text }}>{fmt(diff)}</td>
                    <td style={{ ...td, textAlign: "right", ...mono, color: danger ? T.red : T.muted }}>
                      {rate == null ? "" : `${rate.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const th = { padding: "4px 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.5px" };
const td = { padding: "6px" };
