# カルテマップ Phase 5 — Cloud Functions デプロイ手順

このZIPには、カルテOCRをサーバー側で行う Cloud Functions と、
GitHub Actionsで自動デプロイするための設定が入っています。

## 含まれるファイル

```
functions/index.js          OCR処理本体（extractKarteData）
functions/package.json      依存定義
firebase.json               Firebase設定
.firebaserc                 プロジェクト紐付け（kartemap-371bc）
.github/workflows/deploy-functions.yml   自動デプロイ設定
```

---

## やること（順番に）

### 1. ファイルをGitHubにアップロード
解凍した中身を、これまでと同じ salondemiro-tech/kartemap リポジトリにアップロードする。
- `functions` フォルダ（index.js と package.json）
- `firebase.json`
- `.firebaserc`
- `.github/workflows/deploy-functions.yml`

※ `.github` や `.firebaserc` は先頭がドット（隠しファイル）。
　GitHubのWeb UIでアップロードするときは、ファイル名にパスを含めて作成すると確実：
　例）新規ファイル作成で `.github/workflows/deploy-functions.yml` と打つ。

### 2. GitHub Secrets を2つ登録する
リポジトリの「Settings」→「Secrets and variables」→「Actions」→「New repository secret」

**(A) ANTHROPIC_API_KEY**
- Name: `ANTHROPIC_API_KEY`
- Secret: 取得した Claude APIキー（sk-ant-... で始まる文字列）

**(B) FIREBASE_SERVICE_ACCOUNT**
- Name: `FIREBASE_SERVICE_ACCOUNT`
- Secret: Firebaseサービスアカウントの秘密鍵JSON（下記3で取得）

### 3. Firebaseサービスアカウントの秘密鍵を取得
1. Firebase Console → プロジェクト kartemap → 設定（⚙️）→「プロジェクトの設定」
2. 「サービス アカウント」タブ
3. 「新しい秘密鍵の生成」→ JSONファイルがダウンロードされる
4. そのJSONの中身を全部コピーして、上記(B)のSecretに貼り付ける

### 4. コミットして自動デプロイ
ファイルをアップロード（コミット）すると、GitHub Actionsが自動で動いてデプロイされる。
- リポジトリの「Actions」タブで進行状況が見られる
- 緑のチェックが付けば成功
- 初回は5〜10分かかることがある

---

## デプロイ成功の確認
Firebase Console → 「Functions」(または「ビルド > Functions」) に
`extractKarteData` が asia-northeast1 で表示されればOK。

---

## 補足
- Claude APIキーは Secret Manager に安全に保存され、フロントには一切出ない
- このFunctionは認証済みユーザーのみ呼べる（context.auth検証あり）
- OCR生テキストは保存せず、必要な項目だけ返す
