# LapClip Visualizer — iPhone / iPad（Safari ショートカット・β）

iOS では拡張機能の配布が難しいため、**Safari の共有シートから実行する「ショートカット」**として提供します（β / 動作保証は限定）。公式 LapClip ページを Safari で開いた状態でショートカットを実行すると、そのページ上に F1 風オーバーレイを重ねます。**外部送信・保存・再配信はしません**（ページの DOM を読むだけ）。

> ⚠️ 非公式。LapClip / マトリックス社 / Tour of Japan / 大会運営とは無関係。公式結果は必ず LapClip で確認してください。

## 作り方（端末で1回だけ・手動作成）
`.shortcut` ファイルや iCloud リンクは配布できないため、各自で作成してください（数分）。

1. **ショートカット**アプリ → 右上 **＋** で新規作成。
2. **アクションを追加** → 検索で **「Web ページで JavaScript を実行」**（Run JavaScript on Web Page）を追加。
3. そのアクションのコード欄に、[`lapclip-visualizer-ios.js`](lapclip-visualizer-ios.js) の中身を**全文コピペ**。
4. 上部の名前を「**LapClip Visualizer**」などに設定。
5. ショートカットの詳細（ⓘ / 設定）→ **「共有シートに表示」をオン**。受け取るタイプは「Safari Web ページ」「URL」を許可。
6. （古い iOS の場合）**設定 → ショートカット → 詳細 → 「スクリプトの実行を許可」** をオン。

## 使い方
1. Safari で LapClip のリザルトページ（`https://matrix-sports.jp/lap/result.php?...`）を開く。
2. **共有ボタン** → 一覧から **LapClip Visualizer** を実行。
3. 初回は「このショートカットが matrix-sports.jp にアクセスすることを許可しますか？」→ **許可**。
4. ページ上に F1 風タイミング表示が重なります。**個人/チーム切替・更新・「元の表示に戻す」**が使えます。
5. 最新の結果に更新したい時は、公式ページを再読み込みしてから、もう一度ショートカットを実行。

## 制限（β）
- 「Web ページで JavaScript を実行」は**1回実行**型です。常駐の自動更新はできません（再実行で対応）。
- iOS / Safari のバージョン差で挙動が変わることがあります。
- スマホ向けの **Card / Focus** 専用表示は今後対応（現状は PC と同じテーブル表示）。
- 将来的に必要なら **Safari Web Extension** 化を検討。

## 更新（メンテナ向け）
オーバーレイのロジックは Web 側 `src/bookmarklet/` が実体です。更新したら：

```bash
npm run build:ios-shortcut   # bookmarklet をビルドし ios-shortcut/lapclip-visualizer-ios.js を再生成
```
