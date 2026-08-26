/**
 * データの出入り口（受け皿）。/api/db/ より下の呼び出しを全部ここで受ける。
 * 角括弧を使うファイル名は GitHub の画面からのアップロードが止まる実績があるため、
 * 同じことができる _middleware.js の形で置いている（次へ渡さずここで返しきる）。
 * 判断はすべて shia2n-core の db-gateway に集約されている。ここは一覧を渡すだけ。
 *
 * mo_ の表には利用者ごとの列を置いていない（使うのは Naoki 1 人だけのため）。
 * よって owner は null にし、代わりに OKANE_ALLOW_UID に挙げた人だけを通す。
 * この値が空のときは誰も通さない（開いたままにしないため、既定を閉じる側に置く）。
 *
 * 2026-08-27 の変更
 *   足した：mo_events（イベント）・mo_borrowings（追加で借りた記録）
 *   外した：mo_cards・mo_debts。中身はイベントへ移してあり、画面はもう読まない。
 *           表そのものは Supabase に残っている。消すかどうかは 2026-09-13 に決める。
 *           ここから外しておくと、移し忘れがあっても古い側から読めないので、
 *           同じ役割の器が 2 組ある状態にならない。
 */
import { createDbGateway } from "shia2n-core/server/db-gateway.js";

const TABLES = {
  mo_accounts:   { owner: null },
  mo_plans:      { owner: null },
  mo_balances:   { owner: null },
  mo_events:     { owner: null },
  mo_borrowings: { owner: null },
};

export async function onRequest(context) {
  const allowUids = (context.env.OKANE_ALLOW_UID ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);

  if (allowUids.length === 0) {
    return new Response(
      JSON.stringify({
        message: "この画面を使える人がまだ設定されていません。",
        hint: "Cloudflare の設定に OKANE_ALLOW_UID を入れてください。値は画面に出ている識別子です。",
        code: "GATEWAY_403",
      }),
      { status: 403, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }

  const handler = createDbGateway({ basePath: "/api/db", tables: TABLES, allowUids });
  return handler(context);
}
