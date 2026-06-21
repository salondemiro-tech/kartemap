# カルテマップ DESIGN.md v1.2

## 1. プロダクト概要

### アプリ名
カルテマップ（KarteMap）

### コンセプト
手書きカルテを写真で撮るだけで顧客住所録を作成し、地図でエリア分析できるWebアプリ。

### ターゲットユーザー
- 一人サロン・小規模サロンのオーナー
- 紙カルテで運用してきた美容室・エステ・ネイル・整体など
- チラシ配布やDM送付のエリア分析をしたいサロン

### 解決する課題
- 手書きカルテのデジタル化が手間で進まない
- 顧客がどのエリアから来ているか把握できていない
- チラシをどこに配ればいいかわからない
- 年賀状・DM用の住所録を別途管理している

---

## 2. 技術スタック

| 項目 | 採用技術 | 備考 |
|------|----------|------|
| フロントエンド | HTML + Vanilla ES5 JavaScript | iPadのChrome対応。const/let/アロー関数/async/await禁止 |
| ホスティング | GitHub Pages | 無料、デプロイ簡単 |
| 認証 | Firebase Authentication（メール/パスワード） | |
| データベース | Cloud Firestore | リージョン：asia-northeast1 |
| バックエンド | Cloud Functions for Firebase | リージョン：asia-northeast1 |
| OCR | Claude API | モデル名は環境変数で管理（固定しない） |
| 地図表示 | Google Maps JavaScript API | クライアント用キー（リファラー制限） |
| ジオコーディング | Google Geocoding API | saveCustomer内（Cloud Functions側）でのみ実行。確認済み住所を使う。サーバー専用キー |
| Firebaseプロジェクト | 新規（カルテマップ専用） | TORITAと完全分離 |

---

## 3. Firebase構成

### Firestoreコレクション設計

```
users/{userId}/
  customers/{customerId}
    - name: string                  // 氏名
    - nameKana: string              // 氏名カナ（任意）
    - phone: string                 // 電話番号
    - postalCode: string            // 郵便番号（例：700-0000）
    - prefecture: string            // 都道府県
    - city: string                  // 市区町村
    - address: string               // 番地以降
    - fullAddressInput: string      // ユーザーが確認・修正した住所（フル）
    - fullAddressNormalized: string // Geocodingに投げた住所
    - lat: number                   // 緯度（Geocoding後）
    - lng: number                   // 経度（Geocoding後）
    - geocodeStatus: string         // "success" | "failed" | "manual"
    - geocodeError: string/null     // エラー内容（failedの場合）
    - ocrConfidence: object/null    // OCR信頼度情報
    - sourceImagePath: string/null  // Storageのpath（URLではない）
    - memo: string                  // メモ（任意）
    - createdAt: timestamp
    - updatedAt: timestamp
```

**rawOcrText（OCR生テキスト）について：**
OCR生テキストは氏名・住所・電話番号など個人情報をそのまま含むため、原則としてFirestoreには保存しない。デバッグが必要な場合のみ、開発環境（開発用Firebaseプロジェクト）に限り一時的に保存し、本番環境では保存しない。

### Firebase Storage
```
users/{userId}/kartes/{customerId}.jpg
```
※カルテ画像はユーザーが確認・保存ボタンを押した後に初めて保存する。OCR前には保存しない。

### Firestoreセキュリティルール
- 認証済みユーザーは自分の users/{userId} 配下のみ読み書き可能
- 他ユーザーのデータには一切アクセス不可

---

## 4. 画面構成

| 画面ID | 画面名 | 説明 |
|--------|--------|------|
| S-01 | ログイン画面 | メール/パスワード認証 |
| S-02 | ダッシュボード | 登録件数・最近の登録・メニュー |
| S-03 | カルテ読み取り画面 | 写真撮影→AI読み取り→確認・修正→保存 |
| S-04 | 顧客一覧画面 | 検索・ソート・CSV出力 |
| S-05 | 顧客詳細・編集画面 | 個別データ確認・編集・削除 |
| S-06 | マップ画面 | 顧客住所の地図表示 |
| S-07 | 設定・アカウント画面 | 画像保存設定・退会・全データ削除 |
| S-08 | 利用規約画面 | |
| S-09 | プライバシーポリシー画面 | |

---

## 5. 機能詳細

### S-03 カルテ読み取り画面

**フロー：**
```
1. 画像選択（撮影 or ファイル選択）
2. ブラウザ内でbase64変換（この時点でStorageには保存しない）
3. extractKarteData callable を呼び出す
      └ Cloud Functions内で処理：
            - context.auth.uid 検証
            - Claude API（OCR）実行
            - OCR結果（氏名・住所等）をJSONで返す
            ※この段階ではGeocodingしない（OCRの誤読をそのまま座標化しないため）
4. 読み取り結果をフォームに自動入力（プレビュー表示）
5. ユーザーが内容を確認・修正（住所の修正もここで行う）
6. 保存ボタン押下
7. saveCustomer callable を呼び出す
      └ Cloud Functions内で処理：
            - context.auth.uid 検証
            - ユーザーが確認・修正した住所を使ってGoogle Geocoding API実行（住所→緯度経度）
            - 画像をStorageに保存（ここで初めて保存）
            - sourceImagePathにStorage pathを記録（URLは記録しない）
            - Firestoreに顧客データ保存
```

**重要原則：**
- **OCR確認前に画像・データを一切保存しない**
- **GeocodingはOCR結果ではなく、ユーザーが確認・修正した住所に対して行う**（誤った座標を保存しないため）

### S-04 顧客一覧画面

- 氏名・住所・電話番号の一覧表示
- 氏名・住所での検索
- 登録日ソート
- CSVダウンロード（押下時に確認ダイアログを表示）

**CSVフォーマット（筆まめ対応）：**
```
氏名,氏名カナ,郵便番号,都道府県,市区町村,番地,電話番号
山田 花子,ヤマダ ハナコ,700-0000,岡山県,岡山市北区,丸の内1-1-1,090-1234-5678
```

### S-05 顧客詳細・編集画面

- 顧客削除時は確認ダイアログを表示
- 削除処理は deleteCustomer callable を呼び出す
  - Firestoreの顧客データ削除
  - sourceImagePathが存在する場合、Storageの画像も削除
  - 両方削除してから完了とする

### S-06 マップ画面

- Google Maps上に顧客住所をピン表示（geocodeStatus が "success" のもののみ）
- ピンをタップで顧客名・住所を表示
- geocodeStatus が "failed" の顧客は一覧に警告表示

### S-07 設定・アカウント画面

- カルテ画像を保存する/しない の設定
- 退会機能：全顧客データ（Firestore）＋全カルテ画像（Storage）を削除してからアカウント削除
- 利用規約・プライバシーポリシーへのリンク

---

## 6. Cloud Functions設計

### 認証チェック（全callable共通・必須）

全てのcallable関数で最初に必ず以下を実行する：

```javascript
if (!context.auth) {
  throw new functions.https.HttpsError('unauthenticated', 'Login required');
}
var uid = context.auth.uid;
```

### extractKarteData（callable）

引数：`{ imageBase64: string, mimeType: string }`

処理：
1. context.auth.uid 検証
2. Claude APIにbase64画像を送信してOCR実行
3. OCR結果をJSONで返す（Firestore・Storageには何も保存しない）
   ※Geocodingはここでは行わない。OCRの誤読をそのまま座標化しないため、saveCustomer側で確認済み住所に対して実行する。

返却値：
```json
{
  "name": "山田 花子",
  "nameKana": "ヤマダ ハナコ",
  "phone": "090-1234-5678",
  "postalCode": "700-0000",
  "prefecture": "岡山県",
  "city": "岡山市北区",
  "address": "丸の内1-1-1"
}
```
※rawOcrText（OCR生テキスト）は個人情報を含むため返却値に含めない。デバッグ時は開発環境のログでのみ確認する。

### saveCustomer（callable）

引数：`{ customerData: object, imageBase64: string/null }`
※customerDataにはユーザーが確認・修正した住所（fullAddressInput）が含まれる。

処理：
1. context.auth.uid 検証
2. customerDataの確認済み住所（fullAddressInput）を使ってGoogle Geocoding API実行（緯度経度取得）
   - 成功：lat/lng/geocodeStatus="success" をセット
   - 失敗：geocodeStatus="failed"、geocodeErrorをセット（保存は継続）
3. imageBase64が存在する場合、Storageに保存して sourceImagePath を取得
4. customerData（lat/lng/geocodeStatus含む）をFirestoreに保存

### deleteCustomer（callable）

引数：`{ customerId: string }`

処理：
1. context.auth.uid 検証
2. Firestoreから顧客データを取得
3. sourceImagePathが存在する場合、Storageから画像を削除
4. FirestoreからcustomerデータをdeleteCustomer
5. 両方完了後にsuccessを返す

### deleteAllData（callable）

全顧客データの削除のみを行う。Authアカウント削除は行わない。

引数：なし

処理：
1. context.auth.uid 検証
2. users/{uid}/customers の全件を取得
3. 各顧客のsourceImagePathのStorageファイルを削除
4. Firestoreの全顧客データを削除
5. successを返す

### deleteAccount（callable）

Authアカウントの削除を行う。データ削除とは別関数に分離する。

引数：なし

処理：
1. context.auth.uid 検証
2. （UI側で）事前に deleteAllData が完了していることを前提とする
3. Firebase Authアカウントを削除

**退会フロー（S-07）：**
```
1. ユーザーが退会ボタンを押す
2. 確認ダイアログ（全データが消える旨を明示）
3. deleteAllData callable を実行（全顧客データ＋画像削除）
4. 完了後、deleteAccount callable を実行（アカウント削除）
```
データ削除とアカウント削除を分けることで、途中失敗時にデータだけ残る/アカウントだけ残るといった不整合を切り分けやすくする。

---

## 7. 環境変数（Cloud Functions）

```
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6     // モデル名は固定せず環境変数で管理
GOOGLE_GEOCODING_API_KEY=...          // サーバー専用キー（クライアント用と分離）
```

---

## 8. Google Maps APIキー管理

| キー種別 | 用途 | 管理場所 | 制限 |
|----------|------|----------|------|
| クライアント用 | 地図表示（Maps JavaScript API）のみ | HTMLに記載 | リファラー制限：GitHub PagesのURLのみ。Maps JavaScript APIのみ有効化 |
| サーバー用 | Geocoding APIのみ | Cloud Functions環境変数 | Geocoding APIのみ有効化 |

---

## 9. ファイル構成

```
/
├── index.html              // ログイン画面
├── dashboard.html          // ダッシュボード
├── scan.html               // カルテ読み取り画面
├── customers.html          // 顧客一覧
├── customer_detail.html    // 顧客詳細・編集
├── map.html                // マップ画面
├── settings.html           // 設定・アカウント
├── terms.html              // 利用規約
├── privacy.html            // プライバシーポリシー
├── js/
│   ├── shared_auth.js      // 認証共通
│   ├── shared_db.js        // Firestore共通
│   ├── shared_ui.js        // UI共通（ローディング等）
│   └── shared_maps.js      // Maps共通
├── css/
│   └── style.css
└── functions/
    └── index.js            // Cloud Functions
```

---

## 10. 個人情報・プライバシー対応

氏名・住所・電話番号・カルテ画像を扱うため以下を全て実装する：

| 対応項目 | 実装場所 |
|----------|----------|
| カルテ画像を保存する/しない設定 | S-07 |
| 顧客削除時にStorage画像も削除 | deleteCustomer callable |
| CSV出力時の確認ダイアログ | S-04 |
| 退会時に全データ（Firestore＋Storage）削除 | deleteAllData callable（データ削除）→ deleteAccount callable（アカウント削除）の2段階 + S-07 |
| OCR生テキストを本番で保存しない | extractKarteData（返却値に含めない） |
| 利用規約 | terms.html |
| プライバシーポリシー | privacy.html |

---

## 11. 開発フェーズ

OCRは最後に実装する。まず手入力で動くものを作り、バグを切り分けやすくする。

| フェーズ | 内容 |
|----------|------|
| Phase 1 | Firebaseプロジェクト新規作成・Authentication・基本UI・共通JS |
| Phase 2 | 顧客CRUD（手入力版）・顧客一覧・詳細・削除 |
| Phase 3 | CSVエクスポート（筆まめ対応フォーマット） |
| Phase 4 | Google Maps連携・Geocoding・ピン表示 |
| Phase 5 | Claude OCR連携（カルテ読み取り・extractKarteData） |
| Phase 6 | Salon de Miroで実運用・フィードバック改善 |
| Phase 7 | マルチユーザー化・課金対応（Stripe） |

---

## 12. 将来拡張（Phase 7以降）

- マルチユーザー対応（サロンごとにアカウント）
- Stripeによる月額課金
- TOIRTAとの顧客データ連携
- エリア別来店数ヒートマップ
- チラシ配布推奨エリアのAI提案

---

*DESIGN.md v1.2 更新日：2026-06-21*
*v1.1→v1.2変更点：*
*- extractKarteDataではGeocodingしない（OCR結果のみ返す）*
*- saveCustomerで確認・修正済み住所を使ってGeocodingする*
*- rawOcrTextは個人情報を含むため本番では保存しない（開発環境のみ）*
*- 退会処理をdeleteAllData（データ削除）とdeleteAccount（アカウント削除）の2関数に分離*

*v1.0→v1.1変更点：*
*- 画像はOCR確認前にStorageへ保存しない*
*- GeocodingをCloud Functions側に移動（クライアント実行廃止）*
*- sourceImageをURLからpathに変更*
*- 全callable関数にcontext.auth.uid検証を明記*
*- deleteCustomer callableでStorage画像削除を明記*
*- 退会時全削除を追加*
*- 利用規約・プライバシーポリシー・退会機能を設計に追加*
*- Claudeモデル名を環境変数化*
*- 開発フェーズをOCR最後に変更（Phase 2を手入力CRUD版に）*
