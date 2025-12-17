import React, { useState } from "react";
import Tesseract from "tesseract.js";
import { preprocessImage } from "../utils/image";
import {
  extractPurchaseDate,
  extractItemLines,
  categorize,
  addDays,
} from "../utils/parser";

type OCRState =
  | { status: "idle" }
  | { status: "preprocess" }
  | { status: "ocr"; progress: number; message?: string }
  | { status: "done" }
  | { status: "error"; error: string };

export default function ReceiptOCR() {
  const [fileUrl, setFileUrl] = useState<string>();
  const [status, setStatus] = useState<OCRState>({ status: "idle" });
  const [purchaseDate, setPurchaseDate] = useState<Date | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [rawText, setRawText] = useState<string>("");

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setFileUrl(objectUrl);
    setStatus({ status: "preprocess" });

    try {
      const blob = await preprocessImage(file);
      setStatus({ status: "ocr", progress: 0, message: "日本語OCRを実行中…" });

      const { data } = await Tesseract.recognize(blob, "jpn", {
        logger: (m) => {
          if ("progress" in m) {
            setStatus({
              status: "ocr",
              progress: Math.round((m.progress || 0) * 100),
              message: m.status,
            });
          }
        },
      });

      const text = data.text;
      setRawText(text);

      const dt = extractPurchaseDate(text) ?? new Date();
      setPurchaseDate(dt);

      const lines = extractItemLines(text);
      setItems(lines);

      setStatus({ status: "done" });
    } catch (err) {
      console.error(err);
      setStatus({
        status: "error",
        error:
          "OCRに失敗しました。明るい場所で斜めにせず撮影し、再試行してください。",
      });
    }
  };

  return (
    <div className="row">
      <div className="left">
        <input type="file" accept="image/*" onChange={onFileChange} />
        {fileUrl && <img className="preview" src={fileUrl} alt="preview" />}
        <div className="status">
          {status.status === "idle" && <>画像を選ぶとOCRが始まります。</>}
          {status.status === "preprocess" && <>前処理中…</>}
          {status.status === "ocr" && (
            <>
              {status.message} {status.progress}%
            </>
          )}
          {status.status === "done" && <>完了</>}
          {status.status === "error" && (
            <span className="danger">{status.error}</span>
          )}
        </div>
      </div>

      <div className="items">
        <div className="muted">
          購入日時：
          <span>{purchaseDate ? purchaseDate.toLocaleString() : "—"}</span>
        </div>

        <h2>抽出された商品</h2>
        <div id="itemsList">
          {items.length === 0 ? (
            <>
              <div className="danger">
                商品行を特定できませんでした。価格がはっきり写るように撮影してください。
              </div>
              {rawText && <div className="code">{rawText.slice(0, 2000)}</div>}
            </>
          ) : (
            items.map((line, idx) => {
              const { category, days } = categorize(line);
              const expiry = purchaseDate ? addDays(purchaseDate, days) : null;
              const displayName = line.replace(/\s+\d+(円|¥|￥)?$/, "").trim();
              return (
                <div className="item" key={idx}>
                  <div className="name">{displayName}</div>
                  <div>
                    <span className="pill">{category}</span>
                    <small>
                      {" "}
                      目安: {days}日後
                      {expiry && <> → {expiry.toLocaleDateString()}</>}
                    </small>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
