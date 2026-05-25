# LapClip Visualizer — Android (WebView アプリ)

公式 LapClip ページを WebView で開き、読み込み完了後に**オーバーレイJS（`app/src/main/assets/lapclip-overlay.js`＝PC版ブックマークレットと同じバニラバンドル）を注入**して、F1風タイミングUIを重ねる**非公式の表示補助アプリ**です。

> - **LapClip / マトリックス社 / Tour of Japan / 大会運営とは無関係**です。公式結果は必ず LapClip で確認してください。
> - アプリは独自のネットワーク取得を行いません。WebView が公式ページを直接開く（端末がブラウザとして閲覧するのと同じ）だけで、オーバーレイは**読み込み済みのDOMを読むだけ**。保存・外部送信・再配信はしません。
> - 注入は `evaluateJavascript`（アプリ側）で行うため、ページの CSP に妨げられません。

## 動作の仕組み
1. 起動時に既定の result.php URL を WebView で開く（上部のURL欄で変更可。例: `ctg=004` = 大鹿チームTT）。
2. `onPageFinished` で `matrix-sports.jp` のページに限り `lapclip-overlay.js` を注入。
3. オーバーレイが DOM を解析し、個人/チーム表示・ギャップ帯・「元の表示に戻す」等を提供。

## ビルド手順（Android Studio 推奨）
このリポジトリには Android のビルドツールチェーン（JDK / SDK / Gradle）は含まれません。**Android Studio**（JDK17・Android SDK・Gradle を同梱）を使ってください。

1. Android Studio で **`android/` フォルダを開く**（Open）。初回 Gradle Sync で wrapper/依存を自動取得します。
   - もし Gradle wrapper が無いと言われたら、Android Studio が生成します（または `gradle wrapper` 実行）。
2. デバッグ実行：実機（USBデバッグ）またはエミュレータを選んで Run ▶。
3. デバッグAPK：**Build → Build Bundle(s)/APK(s) → Build APK(s)**。`app/build/outputs/apk/debug/app-debug.apk` が出力されます。

## 署名APK（友人配布用）
1. **Build → Generate Signed Bundle / APK → APK**。
2. キーストアを新規作成（`keytool` 相当。Studioが案内）。**キーストアとパスワードは大切に保管**（紛失すると更新APKを出せません）。
3. release（署名済み）APK を生成。
4. 配布：GitHub Releases 等に APK を置き、友人は「提供元不明のアプリ」を許可してサイドロード。
   - ※ Google Play 配布は初期段階では想定しません。仲間内配布に限定してください。

## オーバーレイを更新するには
オーバーレイ（解析＋描画ロジック）は Web 側の `src/bookmarklet/` が実体です。更新したら：

```bash
# リポジトリのルートで
npm run build:android-asset   # bookmarklet をビルドして assets/lapclip-overlay.js に反映
```

その後 Android を再ビルドしてください。

## 既知の制限 / TODO
- 現状の注入UIは PC版と同じ**テーブル表示**です。スマホ向けの **Card / Focus / Big Number モード**は今後の対応（フェーズ2）。
- 自動更新はオーバーレイ内の任意設定（`location.reload` ＝公式ページ再読込→再注入）で対応。アプリ側の定期リロードUIは未実装（TODO）。
- ランチャーアイコンは未設定（システム既定）。必要なら `res/mipmap` に追加。
- **チームTT（大鹿）の実描画はレース当日に実データで要確認。**
