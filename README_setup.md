# カルテマップ Phase 1+2 セットアップ手順

このZIPは **Phase 1（認証・基本UI）** と **Phase 2（顧客CRUD手入力版）** のみ。
OCR・Google Maps・Geocoding・画像アップロードは未実装（設計通り、後のPhaseで追加）。

---

## 含まれるファイル

```
index.html              ログイン / 新規登録
dashboard.html          ダッシュボード（登録数・メニュー）
customers.html          顧客一覧（検索つき）
customer_detail.html    顧客の追加・表示・編集・削除
js/shared_db.js         Firebase初期化・Firestore CRUD
js/shared_auth.js       認証共通
js/shared_ui.js         ローディング・トースト・エスケープ
css/style.css           共通スタイル
firestore_rules.txt     Firestoreセキュリティルール
```

---

## セットアップ手順

### 1. Firebaseプロジェクトを新規作成
- Firebase Console で新しいプロジェクト「kartemap」を作成（TORITAとは別プロジェクト）
- リージョンは asia-northeast1 を選択

### 2. Authentication を有効化
- Authentication > Sign-in method
- 「メール/パスワード」を有効にする

### 3. Firestore を有効化
- Firestore Database を作成
- 本番モードで開始

### 4. Firestoreルールを設定
- `firestore_rules.txt` の内容を Firestore > ルール に貼り付けて公開

### 5. Webアプリ設定を取得して差し替え
- プロジェクトの設定 > マイアプリ > ウェブアプリを追加
- 表示される firebaseConfig の値を控える
- **`js/shared_db.js` の `KARTEMAP_FIREBASE_CONFIG`** の各プレースホルダーを実際の値に差し替える

```js
var KARTEMAP_FIREBASE_CONFIG = {
  apiKey: '実際のキー',
  authDomain: '実際の値.firebaseapp.com',
  projectId: '実際のプロジェクトID',
  storageBucket: '実際の値.appspot.com',
  messagingSenderId: '実際の値',
  appId: '実際の値'
};
```

### 6. GitHub Pages にアップロード
- リポジトリに全ファイルをアップロード（フォルダ構成そのまま）
- Settings > Pages で公開

### 7. Firebase 認証ドメインを追加
- Authentication > Settings > 承認済みドメイン
- GitHub Pages のドメイン（例：username.github.io）を追加

---

## 動作確認チェックリスト

- [ ] index.html で新規登録できる
- [ ] ログイン・ログアウトできる
- [ ] 未ログインで dashboard.html を開くと index.html に飛ばされる
- [ ] 顧客を追加できる
- [ ] 顧客一覧に表示される
- [ ] 検索で氏名・住所が絞り込める
- [ ] 顧客詳細を開ける
- [ ] 顧客を編集できる
- [ ] 顧客を削除できる（確認ダイアログが出る）
- [ ] ダッシュボードの登録数が正しい

---

## このPhaseで未実装（設計通り）

- カルテ写真のOCR読み取り（Claude API）
- Google Maps でのピン表示
- 住所のGeocoding
- カルテ画像のStorage保存
- CSVエクスポート（Phase 3）
- 利用規約・プライバシーポリシー・退会機能

これらは Phase 3 以降で順次追加します。
