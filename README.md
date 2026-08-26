# お金を守るくん（okane-mamoru-kun）

口座ごとに「この日までにいくら足しておく必要があるか」を出す画面。

## 何を持って、何を持たないか

持つ：口座と残高 / 支払い・引き落とし・返済の予定 / 入金の日付 / カードの利用枠と利用額と管理サイトの住所 / 負債の残高と返済額

持たない：口座番号 / カード番号 / 暗証番号 / ログイン情報 / 入金の金額の正本（売上管理が持つ）/ 目標との比較（把握くん）/ 仕訳（会計ソフト）

## 表（Supabase）

mo_accounts（口座）／mo_plans（予定）／mo_balances（実残高）／mo_cards（カード）／mo_debts（負債）

## 決めごと

- 日付が決まっていない入金は、不足額の計算に入れない。入る前提で計算すると、足りているように見えて落ちる
- 見込みは足りなくなる側へ寄せる。出るお金は多めに、入るお金は少なめに
- 実残高を入れる前に、過ぎた予定を「済」にする。この順でないと先の不足額が 2 通りに割れる
- 対で登録した予定（口座をまたぐ出と入り）は、片方を動かすともう片方も動く
- 画面は公開キーで Supabase に直接触らない。読み書きは /api/db を通す

## Cloudflare に入れる設定

| 名前 | 種類 | 中身 |
|---|---|---|
| SUPABASE_URL | Secret | 他のアプリと同じ |
| SUPABASE_SERVICE_ROLE_KEY | Secret | 他のアプリと同じ |
| FIREBASE_PROJECT_ID | Secret | 他のアプリと同じ |
| VITE_SUPABASE_URL | Secret | 他のアプリと同じ |
| VITE_SUPABASE_ANON_KEY | Secret | 他のアプリと同じ |
| VITE_FIREBASE_* | Secret | 他のアプリと同じ |
| VITE_DB_GATEWAY | Secret | /api/db |
| OKANE_ALLOW_UID | Secret | この画面を使える人の識別子。空だと誰も通さない |

OKANE_ALLOW_UID が空のときは、画面が自分の識別子を出して入れ方を案内する。
