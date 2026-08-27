/**
 * 不足額の計算。
 *
 * 考え方は 1 つだけ。
 *   起点（口座の基準残高とその日付）から、状態が「未」の予定を日付順に積み上げる。
 *   不足額 ＝ 最低残高 − 予定残高（マイナスにはしない）。
 *   入れる期限 ＝ 引き落とし日の 1 日前（同じ日では間に合わないため）。
 *
 * 積み上げに入れないもの（どちらも「入る前提で計算すると、
 * 足りているように見えて落ちる」ため）
 *   1. 日付が決まっていない予定
 *   2. 日付を過ぎたのに「済」になっていない入金（＝未入金）
 *      これは別枠で「不足の原因」として返す。
 *
 * 2026-08-27 追加
 *   ・繰り返しの決まりから、その回を先の月まで作る（missingOccurrences）
 *   ・金額が毎月変わるものは、直近で確定した回のうち一番少ない額を見込みに使う
 *     （見込みは、足りなくなる側へ寄せる。出は多め・入は少なめ）
 *   ・月ごとの収支（monthlyFlow）
 */

import { LOOKBACK, MONTHS_AHEAD, WEEKDAYS } from "../constants.js";

/* ── 日付の道具 ────────────────────────────────────────────────────── */

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
  return String(ymd).slice(0, 7);
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

/** その月の日数 */
export function daysInMonth(y, m1to12) {
  return new Date(Date.UTC(y, m1to12, 0)).getUTCDate();
}

/** 「2026-08」に n か月足す */
export function addMonthsYm(ymStr, n) {
  let y = Number(ymStr.slice(0, 4));
  let m = Number(ymStr.slice(5, 7)) + n;
  y += Math.floor((m - 1) / 12);
  m = ((m - 1) % 12 + 12) % 12 + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

const n = (v) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};

/* ── 積み上げ ──────────────────────────────────────────────────────── */

/** その予定を積み上げに入れてよいか */
function counted(p, today) {
  if (p.status !== "未") return false;
  if (!p.plan_date) return false;
  // 日付を過ぎた未入金は入れない（まだ入っていないため）
  if (p.direction === "in" && p.plan_date < today) return false;
  return true;
}

/** 日付を過ぎたのに済になっていない入金 */
export function unpaidIncome(plans, today) {
  return plans.filter(
    (p) => p.status === "未" && p.direction === "in" && p.plan_date && p.plan_date < today
  );
}

/**
 * @param accounts  mo_accounts の行
 * @param plans     mo_plans の行（未・済のどちらも渡してよい）
 * @param untilDate ここまで積む
 * @param today     省略時は日本時間の今日
 * @returns { points, undated, unpaid, byAccount }
 */
export function buildForecast(accounts, plans, untilDate, today = todayJst()) {
  const points = [];
  const undated = plans.filter((p) => !p.plan_date && p.status === "未");
  const unpaid = unpaidIncome(plans, today);

  for (const a of accounts) {
    const mine = plans
      .filter(
        (p) =>
          p.account_id === a.id &&
          counted(p, today) &&
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
      未入金: unpaid.filter((p) => p.account_id === a.id),
    };
  }

  return { points, undated, unpaid, byAccount };
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

/* ── 月ごとの収支 ──────────────────────────────────────────────────── */

/**
 * 月ごとの入り・出・差引と、その月の終わりの予定残高。
 * 未入金は入りに数えない（まだ入っていないため）。
 */
export function monthlyFlow(accounts, plans, today = todayJst(), months = 6) {
  const start = ym(today);
  const list = [];
  const until = (() => {
    const last = addMonthsYm(start, months - 1);
    const y = Number(last.slice(0, 4));
    const m = Number(last.slice(5, 7));
    return `${last}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
  })();

  const { points } = buildForecast(accounts, plans, until, today);

  for (let i = 0; i < months; i++) {
    const mm = addMonthsYm(start, i);
    const rows = plans.filter((p) => p.plan_date && ym(p.plan_date) === mm && counted(p, today));
    const 入り = rows.filter((p) => p.direction === "in").reduce((s, p) => s + n(p.amount), 0);
    const 出 = rows.filter((p) => p.direction === "out").reduce((s, p) => s + n(p.amount), 0);

    const 月末残高 = {};
    for (const a of accounts) {
      const upto = points.filter((p) => p.accountId === a.id && ym(p.日付) <= mm);
      月末残高[a.id] = upto.length ? upto[upto.length - 1].予定残高 : n(a.base_balance);
    }

    list.push({ 月: mm, 入り, 出, 差引: 入り - 出, 件数: rows.length, 月末残高 });
  }
  return list;
}

/* ── 繰り返しから、その回を作る ────────────────────────────────────── */

/** イベントの繰り返しを、画面と予定の行に出す文字にする */
export function recurrenceText(e) {
  if (e.recur_kind === "monthly_day") return `毎月 ${e.recur_day} 日`;
  if (e.recur_kind === "month_end") return "毎月 月末";
  if (e.recur_kind === "weekly") return `毎週 ${WEEKDAYS[e.recur_weekday ?? 0]} 曜`;
  return "単発";
}

/**
 * その登録が、いつ落ちる／入るか（今日から monthsAhead か月ぶん）。
 * 終わりの日（ends_on）を過ぎた回は作らない。空なら終わりなし。
 */
export function occurrenceDates(e, today = todayJst(), monthsAhead = MONTHS_AHEAD) {
  const out = [];
  const startYm = ym(today);
  const stop = e.ends_on ? String(e.ends_on).slice(0, 10) : null;
  const ok = (d) => d >= today && (!stop || d <= stop);

  if (e.recur_kind === "monthly_day" || e.recur_kind === "month_end") {
    for (let i = 0; i <= monthsAhead; i++) {
      const mm = addMonthsYm(startYm, i);
      const y = Number(mm.slice(0, 4));
      const m = Number(mm.slice(5, 7));
      const last = daysInMonth(y, m);
      const day =
        e.recur_kind === "month_end" ? last : Math.min(Number(e.recur_day ?? 1), last);
      const d = `${mm}-${String(day).padStart(2, "0")}`;
      if (ok(d)) out.push(d);
    }
    return out;
  }

  if (e.recur_kind === "weekly") {
    const endYm = addMonthsYm(startYm, monthsAhead);
    const endY = Number(endYm.slice(0, 4));
    const endM = Number(endYm.slice(5, 7));
    const end = `${endYm}-${String(daysInMonth(endY, endM)).padStart(2, "0")}`;
    let d = today;
    while (d <= end) {
      if (ok(d) && new Date(`${d}T00:00:00Z`).getUTCDay() === Number(e.recur_weekday ?? 0)) out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }

  return out; // once は作らない（1 件だけ実体があるため）
}

/**
 * そのイベントの、まだ決まっていない回に入れる金額。
 * 毎月変わるものは「直近で確定した回のうち、一番少なかった額」。
 * 平均を採らないのは、平均は半分の確率で上に外れ、外れた月に落ちるため。
 */
export function defaultAmount(e, mine) {
  if (e.amount_rule !== "毎月変わる") return e.amount == null ? null : n(e.amount);

  const fixed = mine
    .filter((p) => p.amount != null && p.status === "済")
    .sort((x, y) => (String(x.plan_date) < String(y.plan_date) ? 1 : -1))
    .slice(0, LOOKBACK)
    .map((p) => n(p.amount));

  if (fixed.length === 0) return e.amount == null ? null : n(e.amount);
  return Math.min(...fixed);
}

/**
 * まだ作られていない回を返す（入れる前の形のまま）。
 * key は「ev{イベントの番号}_{日付}」で、同じ回を 2 度作らない。
 */
export function missingOccurrences(events, plans, today = todayJst(), monthsAhead = MONTHS_AHEAD) {
  const out = [];
  const haveKeys = new Set(plans.map((p) => p.key).filter(Boolean));

  const byEvent = new Map();
  for (const p of plans) {
    if (p.event_id == null) continue;
    if (!byEvent.has(p.event_id)) byEvent.set(p.event_id, []);
    byEvent.get(p.event_id).push(p);
  }

  for (const e of events) {
    if (!e.active) continue;
    if (e.account_id == null) continue;
    if (e.recur_kind === "once") continue;

    const mine = byEvent.get(e.id) ?? [];
    const haveDates = new Set(mine.map((p) => p.plan_date).filter(Boolean));
    const amount = defaultAmount(e, mine);
    if (amount == null) continue;

    for (const d of occurrenceDates(e, today, monthsAhead)) {
      const key = `ev${e.id}_${d}`;
      if (haveDates.has(d) || haveKeys.has(key)) continue;
      haveKeys.add(key);
      out.push({
        key,
        event_id: e.id,
        account_id: e.account_id,
        plan_date: d,
        direction: e.direction,
        amount,
        name: e.name,
        recurrence: recurrenceText(e),
        certainty: e.certainty,
        movable: e.movable,
        status: "未",
        pair_key: e.pair_key ? `${e.pair_key}@${d}` : null,
        note: null,
      });
    }
  }
  return out;
}

/** カードの「利用できる枠」＝ 枠の総額 − いま使っている額 */
export function creditLeft(e) {
  if (e.credit_limit == null) return null;
  return n(e.credit_limit) - n(e.credit_used);
}

/* ── どこまで確定した数字か ────────────────────────────────────────── */

/**
 * 見込みのまま残っている動きを集める。
 *
 * 「週 1 回 30 分で分からないまま残るものが 0 件」から引くと、
 * 数字そのものだけでは足りない。**その数字がどこまで確定しているか**が
 * 一緒に出ていないと、把握したつもりで外れる。
 * 見込みのままの額が多い月は、不足額もその幅で動く。
 */
export function stillEstimated(plans, today = todayJst(), untilDate) {
  const rows = plans.filter(
    (p) =>
      p.status === "未" &&
      p.plan_date &&
      p.plan_date >= today &&
      (!untilDate || p.plan_date <= untilDate) &&
      p.certainty === "見込み"
  );
  const 出 = rows.filter((p) => p.direction === "out").reduce((s, p) => s + n(p.amount), 0);
  const 入り = rows.filter((p) => p.direction === "in").reduce((s, p) => s + n(p.amount), 0);
  return { 件数: rows.length, 出, 入り, 一覧: rows };
}

/** 確定の画面に並べるもの：今月ぶんと、日付を過ぎてまだ済んでいないもの */
export function toSettle(plans, today = todayJst()) {
  const thisMonth = ym(today);
  return plans
    .filter((p) => p.status === "未" && p.plan_date)
    .filter((p) => ym(p.plan_date) === thisMonth || p.plan_date < today)
    .sort((x, y) => (x.plan_date < y.plan_date ? -1 : 1));
}
