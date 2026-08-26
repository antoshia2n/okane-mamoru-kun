/**
 * ログインしている本人の識別子だけを返す。
 * これ以外の値は返さない（設定を 1 回入れるためだけの入口）。
 */
import { verifyIdToken } from "shia2n-core/server/db-gateway.js";

export async function onRequest(context) {
  const { request, env } = context;
  const projectId = env.FIREBASE_PROJECT_ID ?? env.VITE_FIREBASE_PROJECT_ID ?? "";
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  try {
    const uid = await verifyIdToken(token, projectId);
    const allow = (env.OKANE_ALLOW_UID ?? "").split(",").map(s => s.trim()).filter(Boolean);
    return new Response(
      JSON.stringify({ uid, 設定済み: allow.length > 0, 通る: allow.length === 0 ? false : allow.includes(uid) }),
      { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ message: e.message ?? "確認できませんでした" }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
