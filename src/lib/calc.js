/**
 * 不足額の計算。
 *
 * 考え方は 1 つだけ。
 *   起点（口座の基準残高とその日付）から、状態が「未」の予定を日付順に積み上げる。
 *   不足額 ＝ 最低残高 − 予定残高（マイナスにはしない）。
 *   入れる期限 ＝ 引き落とし日の 1 日前（同じ日では間に合わないため）。
 *
 * 日付が決まっていない予定は積み上げない。
 * 入る前提で計算すると、足りているように見えて落ちるため。
 */

export function addDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayJst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export function ym(ymd) {
  return ymd.slice(0, 7);
}

export function monthDays(year, month1to12) {
  const first = new Date(Date.UTC(year, month1to12 - 1, 1));
  const days = [];
  while (first.getUTCMonth() === month1to12 - 1) {
    days.push(first.toISOString().slice(0, 10));
    first.setUTCDate(first.getUTCDate() + 1);
  }
  return days;
}

const n = (v) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};

/**
 * @param accounts mo_accounts の行
 * @param plans    mo_plans の行（未・済のどちらも渡してよい。未だけを積む）
 * @param untilDate ここまで積む
 * @returns { points, undated, byAccount }
 */
export function buildForecast(accounts, plans, untilDate) {
  const points = [];
  const undated = plans.filter((p) => !p.plan_date && p.status === "未");

  for (const a of accounts) {
    const mine = plans
      .filter(
        (p) =>
          p.account_id === a.id &&
          p.status === "未" &&
          p.plan_date &&
          p.plan_date >= a.base_balance_date &&
          p.plan_date <= untilDate
      )
      .sort((x, y) => (x.plan_date < y.plan_date ? -1 : 1));

    const byDate = new Map();
    for (const p of mine) {
      if (!byDate.has(p.plan_date)) byDate.set(p.plan_date, []);
      byDate.get(p.plan_date).push(p);
    }

    let running = n(a.base_balance);
    for (const d of Array.from(byDate.keys()).sort()) {
      const rows = byDate.get(d);
      for (const p of rows) {
        running += p.direction === "out" ? -n(p.amount) : n(p.amount);
      }
      points.push({
        accountId: a.id,
        口座: a.name,
        区分: a.kind,
        日付: d,
        予定残高: running,
        最低残高: n(a.min_balance),
        不足額: Math.max(0, n(a.min_balance) - running),
        入れる期限: addDays(d, -1),
        動き: rows,
      });
    }
  }

  points.sort((x, y) => (x.日付 === y.日付 ? (x.口座 < y.口座 ? -1 : 1) : x.日付 < y.日付 ? -1 : 1));

  const byAccount = {};
  for (const a of accounts) {
    const mine = points.filter((p) => p.accountId === a.id);
    byAccount[a.id] = {
      口座: a,
      一覧: mine,
      最初の不足: mine.find((p) => p.不足額 > 0) ?? null,
      最後の予定残高: mine.length ? mine[mine.length - 1].予定残高 : n(a.base_balance),
    };
  }

  return { points, undated, byAccount };
}

/** その日に落ちる／入る予定を口座をまたいで集める */
export function movesOn(plans, ymd) {
  return plans.filter((p) => p.plan_date === ymd);
}

/** 実残高を入れたときの予測残高（その時点まで積んだ値） */
export function predictedAt(account, plans, ymd, reflectedToday) {
  const upto = plans.filter(
    (p) =>
      p.account_id === account.id &&
      p.status === "未" &&
      p.plan_date &&
      p.plan_date >= account.base_balance_date &&
      (reflectedToday ? p.plan_date <= ymd : p.plan_date < ymd)
  );
  let v = n(account.base_balance);
  for (const p of upto) v += p.direction === "out" ? -n(p.amount) : n(p.amount);
  return { predicted: v, target: upto };
}

/** 動かせるお金（不足が出ている口座で、印が「動かせない」以外の予定） */
export function movableOn(points, untilDate) {
  const out = [];
  for (const p of points) {
    if (p.日付 > untilDate) continue;
    for (const m of p.動き) {
      if (m.movable && m.movable !== "動かせない" && m.direction === "out") {
        out.push({ ...m, 口座: p.口座, 日付: p.日付 });
      }
    }
  }
  return out;
}
