# Erfolg — 読書記録

羊皮紙のテクスチャに綴る、Markdown ベースの読書記録サイト。
Next.js (App Router) で作られ、`content/books/` の Markdown ファイルを
そのまま記事として表示します。DB 不要・Git 管理・Vercel に自動デプロイ。

## 記録の書き方

1. `content/books/` に新しい `.md` ファイルを作る（ファイル名が URL の slug になる）。
   例: `content/books/atomic-habits.md` → `/books/atomic-habits`
2. 先頭に frontmatter を書き、その下に本文を Markdown で書く。
3. Git に commit & push すれば Vercel が自動でビルドして反映。

`content/books/_TEMPLATE.md` を雛形として複製すると楽です
（`_` 始まりのファイルは一覧に出ません）。

### frontmatter の項目

```yaml
---
title: 本のタイトル
author: 著者名
category: 技術書 # カテゴリ（トップページの絞り込みに使う）
rating: 4 # 0〜5 の整数（★の数）
dateRead: 2026-06-30 # 読了日 YYYY-MM-DD
tags: [設計, 習慣] # 自由なキーワード
---
本文を Markdown で……
```

同じ `category` の本は、トップページのカテゴリチップで自動的にまとまります。

## 開発

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 本番ビルド
```

## Vercel へのデプロイ

1. このリポジトリを GitHub に push する。
2. [vercel.com](https://vercel.com) で New Project → 該当リポジトリを import。
3. フレームワークは Next.js が自動検出される。設定はデフォルトのまま Deploy。

以降は `main` に push するたびに自動デプロイされます。

## 構成

```
app/
  layout.tsx            フォント・全体レイアウト
  page.tsx              トップpage（カテゴリ絞り込み + 一覧）
  books/[slug]/page.tsx 個別の読書記録
components/             BookList / Stars
lib/books.ts            Markdown 読み込み・frontmatter パース
content/books/*.md      読書記録の本体（ここに書く）
public/backgrounds/     羊皮紙テクスチャ
```

## TODO（今後）

- [ ] 「机の上の本 → クリックで開く」オープニング演出
- [ ] タグ単位の絞り込みページ
