import { useEffect, useState } from "react";
import { auth, T, card, solidBtn } from "shia2n-core";

/**
 * 使える人がまだ設定されていないときだけ出る画面。
 * 自分の識別子をここに出して、そのまま Cloudflare の設定に入れられるようにする。
 */
export default function Setup({ message, onDone }) {
  const [uid, setUid] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch("/api/whoami", { headers: { Authorization: `Bearer ${token}` } });
        const j = await res.json();
        if (!res.ok) throw new Error(j.message ?? "確認できませんでした");
        setUid(j.uid);
      } catch (e) { setErr(e.message ?? String(e)); }
    })();
  }, []);

  return (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>最初に 1 回だけ設定が要ります</div>
      <div style={{ color: T.muted, fontSize: 12, marginBottom: 14 }}>{message}</div>
      <div style={{ fontSize: 12, marginBottom: 6 }}>あなたの識別子</div>
      <div style={{ background: T.s2, borderRadius: 6, padding: "10px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12, wordBreak: "break-all", marginBottom: 14 }}>
        {uid ?? (err ? `取れませんでした：${err}` : "取得しています…")}
      </div>
      <ol style={{ fontSize: 12, color: T.muted, paddingLeft: 18, lineHeight: 1.9 }}>
        <li>上の文字をコピーする</li>
        <li>Cloudflare の Workers &amp; Pages を開く</li>
        <li>okane-mamoru-kun を選ぶ</li>
        <li>Settings タブ → Variables and Secrets</li>
        <li>Add で、名前に OKANE_ALLOW_UID、値に上の文字を入れる（種類は Secret）</li>
        <li>Save して、Deployments タブで Retry deployment を押す</li>
        <li>できたら下のボタン</li>
      </ol>
      <button onClick={onDone} style={{ ...solidBtn(T.text), marginTop: 14 }}>入れたので、もう一度読み込む</button>
    </div>
  );
}
