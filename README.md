# LapClip Timing Visualizer

LapClip 公式ページのリザルト表示を、**F1予選風のタイミングUI**に変換する**非公式の表示補助ツール**です。順位の一覧を眺める代わりに、トップ差・順位・更新・接戦・お気に入りを一目で把握できます。

**Tour of Japan の全ステージ**に対応します。レースのデータ構造（タイム精度・フェーズ表記）から種別を自動判定し、個人タイムトライアル・マススタート（ロード/クリテリウム）・チームTTのそれぞれに最適な表示へ切り替えます。マススタートでは着順（公式の「位」）・トップ差・周回遅れ・スプリント通過に加え、**逃げ／メイン集団／遅れの集団状況やトップとの差をライブ表示**します。

> ## 重要（必ずお読みください）
> - 本ツールは **LapClip、マトリックス社、Tour of Japan、大会運営とは無関係**です。
> - **公式結果は必ず LapClip および大会公式情報を確認**してください。
> - 本ツールは個人観戦用の表示補助です。公式結果として引用・再配布しないでください。

## 本ツールが行うこと
- あなたが開いている **LapClip 公式ページ上で**動作します。
- ページ内の情報を **あなたの端末内（ブラウザ内）で読み取り**ます。
- 同じページ上に見やすいUIをオーバーレイ表示します（元のLapClip表示へワンクリックで戻せます）。

## 本ツールが行わないこと
- LapClip データの**再配信 / ミラー**
- LapClip データの**保存・蓄積**
- LapClip データの**外部送信**（fetch / XHR / sendBeacon / WebSocket は一切なし）
- 独自リザルトサービスの提供・公式結果の代替

---

## 対応プラットフォーム

| 環境 | 方式 | 状態 |
|---|---|---|
| **PC（Chrome / Edge / Firefox）** | **Tampermonkey ユーザースクリプト** | ✅ 利用可 |
| PC | ブックマークレット（軽量版・拡張不要） | ✅ 利用可 |
| Android | 専用 WebView アプリ（debug APK） | ✅ 暫定版 (β) |
| iPhone / iPad | Safari ショートカット | ✅ β（手動作成） |

> まずは **PC + ユーザースクリプト**。他プラットフォームは順次対応します。

---

## インストール（PC / ユーザースクリプト）

1. ブラウザに **Tampermonkey** を入れる（Chrome / Edge / Firefox の拡張機能）。
2. ユーザースクリプトをインストール：
   - **方法A（配布・推奨）**：GitHub Releases の `lapclip-visualizer.user.js` を開く → Tampermonkey がインストール確認を表示 → **Install**（更新も追従）。
   - **方法B（自分でビルド）**：下記「開発」でビルドし、`dist/lapclip-visualizer.user.js` を Tampermonkey ダッシュボードにドラッグ＆ドロップ。
3. LapClip のリザルトページ（`https://matrix-sports.jp/lap/result.php?...`）を開くと、自動で F1 風オーバーレイが表示されます。

> ※ 方法A用の配布 Release は準備中です。当面は方法B（ビルド）でお試しください。

## 使い方
- リザルトページを開くと、F1風タイミングUIが**自動で重なって**表示されます。
- 右上「**元のLapClip表示に戻す**」で、いつでも公式表示へ戻せます（折りたたみのみ・公式ページは消しません）。
- **個人 / チーム** トグルでモード切替（URLのカテゴリから自動判定）。
- ⭐で注目選手 / 注目チームを登録（端末内の localStorage のみ）。
- 更新：公式ページがリロードされると自動で再読み取り。任意で自動リロード（最短30秒）も設定可。

---

## インストール（PC / ブックマークレット・拡張不要）

Tampermonkey なしで使える軽量版（約20KB / gzip 7KB）。マススタートの集団状況ライブ表示にも対応。

```bash
npm run build:bookmarklet   # → dist/lapclip-bookmarklet.js と dist/bookmarklet.txt
```

- **インライン版（推奨・ホスト不要）**：`dist/bookmarklet.txt` の「方法B」の `javascript:…` 文字列を、ブラウザの**新規ブックマークのURL欄に貼り付けて保存**します（※アドレスバーに直接入力は不可。必ずブックマークとして保存）。
- **ローダー版**：`dist/lapclip-bookmarklet.js` を GitHub Pages / Release 等にホストし、「方法A」の `javascript:…`（`YOUR_HOST` を置換）をブックマーク化。更新の反映が楽。

使い方：LapClip のリザルトページを開き、保存したブックマークをクリック → F1風表示が重なります。もう一度クリック（または「更新」）で再読み取り、「**元の表示に戻す**」で閉じます。外部通信は行いません。

---

## インストール（Android / WebView アプリ・**未検証の暫定版**）

拡張不要の専用アプリ。公式ページをアプリ内 WebView で開き、オーバーレイを注入します。

1. Releases の **`lapclip-visualizer-debug.apk`**（デバッグ署名）を端末にダウンロード。
2. 「提供元不明のアプリ」のインストールを許可してサイドロード。
3. アプリを開く → 既定で LapClip の `result.php` を表示（上部URL欄で変更可）→ オーバーレイが自動表示。

> ⚠️ **未検証の暫定版（β）**：CIでビルドした debug APK です。実機動作は要確認。ソース・ビルド/署名手順は [`android/README.md`](android/README.md) を参照。

---

## インストール（iPhone / iPad / Safari ショートカット・β）

Safari の共有シートから実行する「ショートカット」として動かします（手動作成・β）。

1. ショートカットアプリで新規作成 → アクション **「Web ページで JavaScript を実行」** を追加。
2. [`ios-shortcut/lapclip-visualizer-ios.js`](ios-shortcut/lapclip-visualizer-ios.js) の中身を**全文コピペ**。
3. 詳細で **「共有シートに表示」をオン**（Safari Web ページ / URL を許可）。
4. Safari で `result.php` を開く → 共有 → 作成したショートカットを実行 → オーバーレイ表示。

> 詳細・制限（1回実行型など β 事項）は [`ios-shortcut/README.md`](ios-shortcut/README.md)。

---

## 仕組み（ブラウザ内で完結）
1. あなたが LapClip 公式ページを直接開く。
2. ユーザースクリプトが **そのページの DOM を読み取る**（`src/userscript/parseDom.ts`、ネットワーク取得なし）。
3. 表示中のタイムから順位・トップ差を算出（`src/utils/normalizeRiders.ts` ほか）。
4. **Shadow DOM** 内に React で F1風UIを描画（公式ページのCSSと相互干渉しない）。
5. 解析に失敗しても何もせず、公式ページをそのまま残します（元ページ保護）。

外部サーバーは一切介在しません。GitHub / Cloudflare は **配布・説明用途のみ**に使います（LapClip データの取得・配信には使いません）。

## 対応するレース種別（自動判定）

URL ではなく**ページの内容**（タイム精度・フェーズ表記・ギャップ書式）から種別を判定するため、TOJ の全ステージ、さらに将来の大会・年度でも動作します。上部の **個人 / チーム** トグルで手動上書きも可能です。

| 種別 | 例 | 判定の手がかり | 表示 |
|---|---|---|---|
| **個人TT** | 堺ステージ | 1/100秒精度・`中間点`/`FINISH` | F1予選風タイミングタワー（中間点＋Finish＋トップ差） |
| **マススタート** | 京都・いなべ等のロード、堺クリテリウム | `N周`/`X/Y周`・秒精度・集団同タイム | 着順（公式の「位」）＋トップ差＋周回遅れ（`-N周`）＋スプリント通過（`SPn`）。加えて **逃げ／メイン集団／遅れ** の集団状況をライブ表示 |
| **チームTT** | 大鹿ステージ（`ctg=004`） | カテゴリ（URLヒント） | チーム別に 順位 / Lap / Finish / トップ差 |

- マススタートの**着順はタイムでは決まらない**（集団は同タイム）ため、公式リザルトの「位」をそのまま尊重します。推定順位は作りません。
- リタイア／周回遅れは公式表記（`-N周` など）のまま表示し、勝手にDNF扱いしません。
- **チームTT（大鹿）**：周回タイムが公式ページに無い場合は「FINISH only」と表示し、推定Lap・仮想Sector・AI予測は一切出しません。実HTML構造はレース当日に確認してパーサーを校正します。

データ書式の詳細は [`docs/lapclip-data-formats.md`](docs/lapclip-data-formats.md) を参照。

---

## 開発

```bash
npm install
npm run typecheck     # 型チェック
npm test              # パーサ／判定／集団化のユニットテスト（vitest）
npm run build         # ユーザースクリプト → dist/lapclip-visualizer.user.js
npm run build:spa     # （任意）デザイン確認用 SPA ビルド
```

SPA プレビューでは `?mock=criterium` / `?mock=road` / `?mock=live` で各マススタート表示を確認できます（合成データ）。

- ユーザースクリプトのビルド設定は `vite.config.userscript.ts`（vite-plugin-monkey）。
- メタ: `@match https://matrix-sports.jp/lap/*`、`@grant none`（特権API不使用・`@connect` なし＝外部接続しない）。
- UIコンポーネント（`src/components/`）と純ロジック（`src/utils/`）は SPA と共有。

## データの取り扱い
端末内に保存するのは**設定のみ**です：

```
lapclip_us_mode_v1            表示モード（個人 / チーム / 自動）
lapclip_us_favorites_v1       注目選手
lapclip_us_favorite_teams_v1  注目チーム
lapclip_us_autoreload_v1      自動リロードON/OFF
lapclip_us_interval_v1        更新間隔（秒）
```

LapClip のリザルト本体・長期タイム履歴・選手/チームDB・外部送信用ログは保存しません。

## 出典
データ出典: [LAP CLIP](https://matrix-sports.jp/)（matrix-sports.jp）。本ツールは非公式の個人観戦用の表示補助であり、公式サービスを代替・再配信するものではありません。
