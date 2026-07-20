# Erfolg-Forge — 読書記録

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

執筆は専用の編集ページで行います。ローカル起動中のみ、次の入口が現れます。

| 入口 | 場所 | 行き先 |
|---|---|---|
| **＋ 記事を追加** | トップページ | `/edit/record` |
| **✎ 記事化** | `/tsundoku` の各行 | `/edit/record?from=<本>`（保存すると積読から消える） |
| **＋** | 左サイドバー NOTEBOOK | `/edit/note` |
| **✎ 編集** | 記事ページ・ノートページ | `/edit/record/<本>/<記事>` ・ `/edit/note/<カテゴリ>/<ノート>` |
| **下書き** | トップページ | 保存済みの下書き一覧（後述） |

編集ページはサイドバーを出したまま開くので、**BOOKS と NOTEBOOK を見ながら書けます**。
保存すると作成/更新したページへ移動します。

書いた内容はワーキングツリーに `.md` として保存されるだけです。
**commit して push すると公開されます。**

### エディタ

画面は左右に分かれます。**左が Markdown 編集、右がプレビューまたは参照**です。

| キー | 動作 |
|---|---|
| `Alt+P` | 右ペインを **プレビュー ⇄ 参照** で切り替え |
| `Alt+W` | 編集欄にフォーカス（カーソルは末尾） |

- **参照**タブでは、既に書いた記事やノートを選んで**書きながら読めます**。
  切り替えると選択欄にフォーカスが移るので、`Alt+P` → 本を選ぶ → `Alt+W` で執筆に戻る、
  という流れがキーボードだけで回ります。参照した内容は入力中も保持されます。
- Markdown ＋ GFM。数式は `$…$`（KaTeX）、図は ` ```mermaid ` ブロック。
- 生HTML も通ります（`<u>` や文字色など。書き手が自分だけなので許可しています）。
- `Ctrl+Z` / `Ctrl+Shift+Z` で取り消し・やり直し。ツールバー操作も履歴に入ります。
- 入力が止まると **下書きを自動保存**します。次に開くと「復元 / 破棄」を聞かれます。
  保存すると下書きは消え、キャンセルでは残ります。

`Alt+E` と `Alt+R` は避けています。前者は Chrome がメニューに使っており、
後者はこの環境では NVIDIA のオーバーレイが握っていて、どちらもページまで届きません。

### 下書き一覧

トップページの **「下書き」** から、保存済みの下書きを一覧できます。
左に「読書記録」「NOTEBOOK」別のタイトル、右に選んだ下書きのプレビュー。
そこから編集を再開したり、不要なものを破棄したりできます。
下書きはブラウザの localStorage にあり、14日で一覧から消えます。

#### 記号のホットキー

本文欄にフォーカスがある間だけ、`Alt+<グループキー>` → 文字キー で挿入できます。
`Esc` で取り消し、3秒で自動解除。日本語の変換中は無効です。

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

### タグ

記事・ノート・本に付けたタグは、そのままリンクになっています。
クリックすると `/tags/<タグ>` で、そのタグが付いた **本 / 記事 / ノート** が横断的に並びます。
`/tags` は全タグの一覧です。日本語のタグもそのまま使えます。

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
  edit/record/…  edit/note/…        編集ページ（dev限定・本番では404）
  edit/references.ts                参照ペインに出す一覧の組み立て
  api/records/route.ts              記事の作成・更新（dev限定）
  api/notes/route.ts                ノートの作成・更新（dev限定）
  api/content/route.ts              参照ペインが本文を取りに行く先（dev限定）
  icon.svg / opengraph-image.jpg    ファビコン・OGP
components/
  AppShell.tsx                      左右サイドバー・ホットキー
  MarkdownEditor.tsx                ツールバー・取り消し・左右分割
  EditSplit.tsx                     右ペイン（プレビュー / 参照）
  RecordForm / NoteForm             記事・ノートのフォーム
  DraftList / DraftBrowser          下書き一覧
  MarkdownView / Mermaid            表示側のレンダリング
  ActivityHeatmap / HeatmapTooltip  ヒートマップ
lib/
  books.ts                          本と記事の読み込み
  notes.ts                          ノートの読み込み
content/                            中身（ここに書く）
public/backgrounds/parchment.svg    羊皮紙テクスチャ（手書きSVG）
```

編集ページと書き込み系のAPIは `process.env.NODE_ENV !== "production"` でガードしてあり、
公開環境ではそれぞれ 404 / 403 を返します。

## デプロイ

GitHub の `main` に push すれば Vercel が自動でビルドします。
OGP の絶対URLは `VERCEL_PROJECT_PRODUCTION_URL` から組み立てるので、
ドメインを変えても追従します。

## TODO（今後）

- [ ] **グラフ・図の描画** — MATLAB や Python の Notebook のように、数式をその場で
      プロットして図として見せたい。いまの `$…$` は式を組版するだけで、
      `y = sin x` を書いても曲線は出ない。式から図が出るところまでを目指す。
- [ ] 本文への画像添付
- [ ] 「机の上の本 → クリックで開く」オープニング演出
