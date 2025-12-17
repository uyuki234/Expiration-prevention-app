export type LineItem = {
  name: string;
  priceText?: string;
  category?: string;
  days?: number;
  expiryDate?: Date;
};

export function toHiragana(s: string): string {
  return s.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

export function normalizeJa(s: string): string {
  return toHiragana(s)
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => {
      return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
    })
    .toLowerCase();
}

// —— 購入日時抽出（西暦の代表的フォーマットを優先） ——
export function extractPurchaseDate(text: string): Date | null {
  const patterns = [
    /(?<y>\d{4})\/(?<m>\d{1,2})\/(?<d>\d{1,2})\s+(?<H>\d{1,2}):(?<M>\d{2})/,
    /(?<y>\d{4})年(?<m>\d{1,2})月(?<d>\d{1,2})日\s+(?<H>\d{1,2}):(?<M>\d{2})/,
    /(?<y>\d{4})\/(?<m>\d{1,2})\/(?<d>\d{1,2})/,
    /(?<y>\d{4})年(?<m>\d{1,2})月(?<d>\d{1,2})日/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m.groups) {
      const y = parseInt(m.groups["y"], 10);
      const mo = parseInt(m.groups["m"], 10);
      const d = parseInt(m.groups["d"], 10);
      const H = m.groups["H"] ? parseInt(m.groups["H"], 10) : 12;
      const M = m.groups["M"] ? parseInt(m.groups["M"], 10) : 0;
      return new Date(y, mo - 1, d, H, M, 0);
    }
  }
  return null;
}

// —— 商品行抽出：ヘッダ/フッタ除外＋価格らしい行を商品候補に ——
const EXCLUDE_WORDS = [
  "合計",
  "小計",
  "消費税",
  "内税",
  "外税",
  "値引",
  "割引",
  "ポイント",
  "現金",
  "クレジット",
  "お預り",
  "お預かり",
  "お釣り",
  "レジ",
  "担当",
  "会員",
  "バーコード",
  "問合せ",
  "返品",
  "再発行",
  "tel",
  "phone",
  "thank",
  "ご購入",
  "ご利用",
  "営業時間",
  "住所",
  "店舗",
  "加盟",
  "当店",
];

// 食品カテゴリに関連するキーワード
const FOOD_KEYWORDS = [
  "とり",
  "ちきん",
  "鶏",
  "ぎゅう",
  "牛",
  "ぶた",
  "豚",
  "ひき",
  "みんち",
  "挽肉",
  "さしみ",
  "鮮魚",
  "さーもん",
  "まぐろ",
  "たい",
  "いか",
  "えび",
  "ほたて",
  "さんま",
  "さば",
  "ぶり",
  "ぎゅうにゅう",
  "牛乳",
  "みるく",
  "よーぐると",
  "ヨーグルト",
  "ぱん",
  "パン",
  "食パン",
  "ろーる",
  "菓子パン",
  "そうざい",
  "惣菜",
  "弁当",
  "おかず",
  "サラダ",
  "ころっけ",
  "ふらい",
  "唐揚げ",
  "総菜",
  "れいとう",
  "冷凍",
  "ふろーずん",
  "やさい",
  "野菜",
  "れたす",
  "きゅうり",
  "にんじん",
  "だいこん",
  "たまねぎ",
  "じゃがいも",
  "ねぎ",
  "ほうれんそう",
  "とうふ",
  "豆腐",
  "たまご",
  "卵",
  "玉子",
  "うどん",
  "ラーメン",
  "そば",
  "スパゲッティ",
  "缶詰",
  "瓶詰",
  "チーズ",
  "バター",
  "ハム",
  "ソーセージ",
  "ベーコン",
  "ジャム",
];

export function isLikelyItemLine(line: string): boolean {
  const l = line.trim();
  if (!l) return false;
  if (EXCLUDE_WORDS.some((w) => l.includes(w))) return false;

  const priceLike =
    /(?:¥|￥)?\s*\d{2,6}(?:\.\d{2})?$/.test(l) || /税込|税抜/.test(l);
  const onlyDigits = /^[\s\d-]+$/.test(l);

  if (!priceLike || onlyDigits) return false;

  // 食品キーワードを含むかチェック
  const normalized = normalizeJa(l);
  const hasFoodKeyword = FOOD_KEYWORDS.some((k) => normalized.includes(k));

  return hasFoodKeyword;
}

export function extractItemLines(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.replace(/\s{2,}/g, " ").trim());
  const items: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const curr = lines[i];
    if (isLikelyItemLine(curr)) {
      const prev = i > 0 ? lines[i - 1] : "";
      const merged =
        !prev || EXCLUDE_WORDS.some((w) => prev.includes(w))
          ? curr
          : prev + " " + curr;
      items.push(merged);
    }
  }
  return items;
}

// —— カテゴリ判定ルール（初期版） ——
type Rule = { category: string; days: number; keywords: string[] };
const RULES: Rule[] = [
  { category: "鶏肉", days: 7, keywords: ["とり", "ちきん", "鶏", "鶏肉"] },
  { category: "牛肉", days: 7, keywords: ["ぎゅう", "牛", "牛肉", "びーふ"] },
  { category: "豚肉", days: 7, keywords: ["ぶた", "豚", "豚肉", "ぽーく"] },
  { category: "挽肉", days: 3, keywords: ["ひき", "みんち", "挽肉"] },
  {
    category: "魚介",
    days: 2,
    keywords: [
      "さしみ",
      "鮮魚",
      "さーもん",
      "まぐろ",
      "たい",
      "いか",
      "えび",
      "ほたて",
      "さんま",
      "さば",
      "ぶり",
    ],
  },
  { category: "牛乳", days: 7, keywords: ["ぎゅうにゅう", "牛乳", "みるく"] },
  { category: "ヨーグルト", days: 10, keywords: ["よーぐると", "ヨーグルト"] },
  {
    category: "パン",
    days: 4,
    keywords: ["ぱん", "パン", "食パン", "ろーる", "菓子パン"],
  },
  {
    category: "惣菜",
    days: 2,
    keywords: [
      "そうざい",
      "惣菜",
      "弁当",
      "おかず",
      "サラダ",
      "ころっけ",
      "ふらい",
      "唐揚げ",
      "総菜",
    ],
  },
  {
    category: "冷凍食品",
    days: 90,
    keywords: ["れいとう", "冷凍", "ふろーずん"],
  },
  {
    category: "野菜",
    days: 5,
    keywords: [
      "やさい",
      "野菜",
      "れたす",
      "きゅうり",
      "にんじん",
      "だいこん",
      "たまねぎ",
      "じゃがいも",
      "ねぎ",
      "ほうれんそう",
    ],
  },
  { category: "豆腐", days: 5, keywords: ["とうふ", "豆腐"] },
  { category: "卵", days: 14, keywords: ["たまご", "卵", "玉子"] },
];

export function categorize(line: string): { category: string; days: number } {
  const n = normalizeJa(line);
  for (const r of RULES) {
    if (r.keywords.some((k) => n.includes(k)))
      return { category: r.category, days: r.days };
  }
  return { category: "その他", days: 7 };
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
