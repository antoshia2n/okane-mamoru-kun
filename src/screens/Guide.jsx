import { T, card, lb10 } from "shia2n-core";

/**
 * 使い方。別のファイルにすると開かない日が来るので、画面の中に置く。
 */
export default function Guide() {
  return (
    <div style={{ display: "grid", gap: 12 }}>

      <Box title="毎月やることは 1 つだけ">
        <p style={p}>
          月に 1 回、みずほの画面を開いて、法人と個人の残高を「入力」タブに入れてください。
          それだけで、先の日付の不足額が全部引き直ります。
        </p>
        <p style={{ ...p, color: T.muted }}>
          残高を入れると、それが新しい起点になります。過ぎた予定は自動で「済」になるので、
          1 件ずつ消していく作業はありません。
        </p>
      </Box>

      <Box title="残高の入れ方">
        <ol style={ol}>
          <li>「入力」タブ → 「実残高」を押す</li>
          <li>口座を選ぶ</li>
          <li>見た日を選ぶ（今日でよければそのまま）</li>
          <li>みずほの画面に出ている数字をそのまま入れる</li>
          <li>その日に予定があると、色のついた箱が出ます。<b>「もう落ちた後」か「まだ落ちていない」かを選ぶ</b></li>
          <li>「入れる」を押す</li>
        </ol>
        <div style={note}>
          <b>5 番だけは必ず選んでください。</b>ここを取り違えると、先の不足額が 2 通りに割れます。
          実際に、役員報酬 200,720 円が落ちた後か前かで、8/27 の不足額が 90,012 円と 290,732 円に分かれました。
          入れたあとに「予測より◯◯円ずれています」と出たら、登録していない出入りがあるということです。
        </div>
      </Box>

      <Box title="予定の足し方">
        <p style={p}>
          「入力」タブ →「予定」。引き落とし・入金・返済をここに入れます。
        </p>
        <ul style={ul}>
          <li><b>日付を空にすると「日付未定」</b>になり、不足額の計算に入りません。
            入る日が分からない入金はここに置いてください。入る前提で計算すると、足りているように見えて落ちます。</li>
          <li><b>見込みの額は、足りなくなる側へ寄せて</b>ください。
            出ていくお金は多めに、入ってくるお金は少なめに。逆にすると、足りると思って足りません。</li>
          <li>実際の額が分かったら、その行を「直す」で書き換えてください。</li>
        </ul>
      </Box>

      <Box title="「動かせるか」の印">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            <Row a="動かせない" b="税金・社会保険料・家賃など。手を打てないもの" />
            <Row a="期日をずらせる" b="日をずらせるもの。役員報酬がこれ" />
            <Row a="金額を変えられる" b="生活費など、使う額を減らせるもの" />
          </tbody>
        </table>
        <div style={note}>
          不足が出たとき、「今日」の画面に<b>「動かせない」以外の予定だけ</b>が並びます。
          不足額と見比べて、どれを動かせば足りるかを判断してください。
          1 件も出てこないときは、外から入れるしかありません。
        </div>
      </Box>

      <Box title="「対の相手」（口座をまたぐお金）">
        <p style={p}>
          役員報酬のように、法人から出て個人に入るものは <b>2 行</b>で登録します。
          その 2 行の「対の相手」に同じ文字を入れておくと、
          <b>片方の日付や金額を直したとき、もう片方も同じだけ動きます。</b>
        </p>
        <p style={{ ...p, color: T.muted }}>
          こうしておかないと、法人だけをずらして「法人は楽になった」と見えるのに、
          個人がへこんでいることに気づけません。
        </p>
      </Box>

      <Box title="画面の見方">
        <ul style={ul}>
          <li><b>今日</b>：一番上の赤い箱が、いちばん近い不足です。「入れる期限」は引き落とし日の 1 日前です（同じ日では間に合わないため）。</li>
          <li><b>カレンダー</b>：日を押すと、その日の出入りと、その時点の予定残高が出ます。赤い日は不足が出る日です。</li>
          <li><b>負債とカード</b>：残債と毎月の返済、カードの枠と使用率。帯が赤くなったら枠の 8 割を超えています。</li>
        </ul>
      </Box>

      <Box title="この器が持たないもの">
        <p style={p}>
          口座番号・カード番号・暗証番号・ログイン情報を入れる欄は、1 つも作っていません。
          カードの管理サイトは、住所を開くだけです。
        </p>
        <p style={{ ...p, color: T.muted }}>
          入金の金額そのものは売上管理が正本、目標との比較は把握くん、仕訳は会計ソフトの持ち場です。
          この器は「いつまでにいくら足すか」だけを見ます。
        </p>
      </Box>

    </div>
  );
}

function Box({ title, children }) {
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ ...lb10, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ a, b }) {
  return (
    <tr style={{ borderTop: `1px solid ${T.border}` }}>
      <td style={{ padding: "6px", fontWeight: 700, whiteSpace: "nowrap" }}>{a}</td>
      <td style={{ padding: "6px", color: T.muted }}>{b}</td>
    </tr>
  );
}

const p  = { fontSize: 12.5, lineHeight: 1.85, marginBottom: 6 };
const ol = { fontSize: 12.5, lineHeight: 2, paddingLeft: 20 };
const ul = { fontSize: 12.5, lineHeight: 1.95, paddingLeft: 18 };
const note = {
  marginTop: 10, background: "#FAF4EA", border: `1px solid ${T.amber}`,
  borderRadius: 8, padding: "10px 12px", fontSize: 12, lineHeight: 1.8,
};
