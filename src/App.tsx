import ReceiptOCR from "./components/ReceiptOCR";

export default function App() {
  return (
    <div
      style={{
        padding: 24,
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      }}
    >
      <h1 style={{ fontSize: "1.2rem" }}>
        レシートOCR → 日付・商品抽出（React + TS）
      </h1>
      <p style={{ color: "#555", marginTop: 8 }}>
        画像を選ぶと、ブラウザ内で日本語OCRを実行し、購入日時・商品候補・カテゴリ・目安期限を表示します。
      </p>
      <ReceiptOCR />
    </div>
  );
}
