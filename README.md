# Erfolg — 読書記録

羊皮紙のテクスチャに綴る、Markdown ベースの読書記録サイト。
Next.js (App Router) 製。DB は使わず `content/` の Markdown がそのまま中身になり、
`main` に push すると Vercel が自動でデプロイします。

- **本が親、記事が子。** 1冊の本に何本でも記事を書けます（初読・再読・章ごとのメモなど）。
- **ノート。** 本に紐づかない書きものは NOTEBOOK に、任意のカテゴリで置けます。
- **執筆はブラウザで。** ローカル起動中だけ編集UIが出ます。公開版には出ません。

## 起動

```
erfolg              起動してブラウザを開く（デスクトップのショートカットも同じ）
erfolg -Stop        停止
erfolg -Port 3001   ポート指定
```

`C:\Users\hakuu\erfolg.ps1` が本体です。すでに起動していれば開くだけ、
ポートを掴んだまま応答しないプロセスがあれば掃除してから起動し直します。

素の npm でも動きます:

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 本番ビルド
```

> **`npm run build` は dev サーバを止めてから。**
> 同時に走らせると `.next` が壊れ、原因の分かりにくいサーバエラーになります。
> 型チェックだけなら `npx tsc --noEmit` を dev と並行して実行して構いません。

## 書き方（ブラウザ）

ローカル起動中のみ、次の入口が現れます。

| 入口 | 場所 | 何ができるか |
|---|---|---|
| **＋ 記事を追加** | トップページ | 本を選ぶ/新規作成して記事を書く |
| **✎ 記事化** | `/tsundoku` の各行 | 積読の本から記事を作る（作成後その本は積読から消える） |
| **✎ 編集** | 記事ページ・ノートページ | 既存の記事/ノートを直す。slug を変えればリネーム、親を変えれば移動 |
| **＋** | 左サイドバー NOTEBOOK | 本に紐づかないノートを書く |

書いた内容はワーキングツリーに `.md` として保存されるだけです。
**commit して push すると公開されます。**

### エディタ

- Markdown ＋ GFM。数式は `$…$`（KaTeX）、図は ` ```mermaid ` ブロック。
- 生HTML も通ります（`<u>` や文字色など。書き手が自分だけなので許可しています）。
- `Ctrl+Z` / `Ctrl+Shift+Z` で取り消し・やり直し。ツールバー操作も履歴に入ります。
- 入力が止まると **下書きを自動保存**します。次に開くと「復元 / 破棄」を聞かれます。
  保存すると下書きは消え、キャンセルでは残ります。

#### 記号のホットキー

本文欄にフォーカスがある間だけ、`Alt+<グループキー>` → 文字キー で挿入できます。
`Esc` で取り消し、3秒で自動解除。日本語入力中は無効です。

| グループ | 接頭 | 2打目 |
|---|---|---|
| 演算 | `Alt+O` | `i`∫ `f`分数 `r`√ `s`∑ `v`ベクトル `u`上付き `d`下付き |
| 関数 | `Alt+K` | `l`log `s`sin `c`cos `t`tan |
| 集合 | `Alt+S` | `n`ℕ `z`ℤ `q`ℚ `r`ℝ `c`ℂ `u`∪ `i`∩ `e`∅ `m`∈ `b`⊂ `x`∃ `a`∀ |
| ギリシャ文字 | `Alt+G` | `a`α `b`β `g`γ `d`δ `e`ε `z`ζ `h`η `q`θ `i`ι `k`κ `l`λ `m`μ `n`ν `x`ξ `p`π `r`ρ `s`σ `t`τ `u`υ `f`φ `c`χ `y`ψ `w`ω ／ Shift で大文字 |
| 組合せ | `Alt+C` | `c`nCr `h`nHr `p`nΠr |
| 書式 | `Alt+T` | `b`太字 `i`イタリック `u`下線 `s`取消線 `m`小文字 `c`文字色 |

関数だけ `Alt+F` ではなく `Alt+K` です。`Alt+F` は Chrome がメニューに使っており、
ページまで届きません（`Alt+E` `Alt+D` も同様）。

### サイドバー

`[` で左（CATEGORY / BOOKS / NOTEBOOK）、`]` で右（積読）を開閉します。
閉じても場所は保持されるので、本文が横に動くことはありません。
右サイドバーと `]` は**ローカル限定**です。

## 書き方（ファイルを直接置く）

ブラウザを使わず手で置くこともできます。**ディレクトリ構造が意味を持ちます。**

```
content/
  books/
    <本のslug>/
      _book.md          本そのもの（タイトル・著者・カテゴリ）
      <記事のslug>.md   その本についての記事。何本でも置ける
  notes/
    <カテゴリ>/
      <ノートのslug>.md 本に紐づかない書きもの
```

ディレクトリ名・ファイル名がそのまま URL になります。

```
content/books/kokoro/_book.md          →  /books/kokoro
content/books/kokoro/first.md          →  /books/kokoro/first
content/notes/数学/線形代数のメモ.md    →  /notes/数学/線形代数のメモ
```

日本語のディレクトリ名・ファイル名も使えます。
`_` で始まる名前は一覧に出ません（`_book.md` だけは本の情報として読まれます）。

### frontmatter

`_book.md`（本の情報。本文は本そのものについての任意のメモ）

```yaml
---
title: こころ
author: 夏目漱石
category: 小説 # トップと左サイドバーの絞り込みに使う
tags: [近代文学]
---
```

記事（`<記事のslug>.md`）

```yaml
---
title: 初読の記録
dateRead: 2026-05-11 # 読了日 YYYY-MM-DD。ACTIVITY ヒートマップの元になる
rating: 4 # 0〜5 の整数（★の数）
tags: [人間関係]
---
```

ノート（`content/notes/<カテゴリ>/*.md`）

```yaml
---
title: 線形代数のメモ
date: 2026-07-19
tags: [固有値]
---
```

雛形は `content/books/_TEMPLATE.md` にあります。

## 非公開のデータ

`content/tsundoku.md`（積読）と `content/kindle.md` は **gitignore 済み**で、
公開されません。積読は右サイドバーと `/tsundoku` に出ますが、どちらもローカル限定で、
本番ビルドではデータ自体がページに含まれません。

```
- タイトル / 著者 / カテゴリ
- タイトル / 著者            ← カテゴリ省略可（未分類になる）
- タイトル
```

区切りは前後に空白のある `/`（`｜` `|` も可）です。
`Fate/stay night` のようにタイトル内の `/` はそのまま残ります。

> このファイルは git 管理外でバックアップがありません。
> 記事化すると該当行が消えるので、扱いには注意してください。

## 構成

```
app/
  layout.tsx                        フォント・メタデータ・サイドバーの外枠
  page.tsx                          トップ（ACTIVITY ヒートマップ）
  books/[book]/page.tsx             本のページ（記事一覧）
  books/[book]/[article]/page.tsx   記事
  notes/[category]/[slug]/page.tsx  ノート
  tsundoku/page.tsx                 積読の全件（ローカル限定の記事化つき）
  api/records/route.ts              記事の作成・更新（dev限定）
  api/notes/route.ts                ノートの作成・更新（dev限定）
  icon.svg / opengraph-image.jpg    ファビコン・OGP
components/
  AppShell.tsx                      左右サイドバー・ホットキー
  MarkdownEditor.tsx                ツールバー・取り消し・プレビュー
  RecordForm / NoteForm             記事・ノートのフォーム
  MarkdownView / Mermaid            表示側のレンダリング
  ActivityHeatmap / HeatmapTooltip  ヒートマップ
lib/
  books.ts                          本と記事の読み込み
  notes.ts                          ノートの読み込み
content/                            中身（ここに書く）
public/backgrounds/parchment.svg    羊皮紙テクスチャ（手書きSVG）
```

書き込み系のAPIは `process.env.NODE_ENV !== "production"` でガードしてあり、
公開環境では 403 を返します。

## デプロイ

GitHub の `main` に push すれば Vercel が自動でビルドします。
OGP の絶対URLは `VERCEL_PROJECT_PRODUCTION_URL` から組み立てるので、
ドメインを変えても追従します。

## TODO（今後）

- [ ] 「机の上の本 → クリックで開く」オープニング演出
- [ ] タグ単位の絞り込みページ
- [ ] 本文への画像添付
