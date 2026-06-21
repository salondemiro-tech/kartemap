/* shared_db.js
 * カルテマップ - Firebase初期化とFirestore共通処理
 * ES5のみ（var/function/Promise.then）。const/let/アロー関数/async/await禁止。
 *
 * 【重要】下記firebaseConfigは新規Firebaseプロジェクト「kartemap」の値に差し替えること。
 * 現状はプレースホルダー。Firebase Console > プロジェクトの設定 > マイアプリ から取得する。
 */

var KARTEMAP_FIREBASE_CONFIG = {
  apiKey: '[YOUR_FIREBASE_API_KEY]',
  authDomain: '[YOUR_PROJECT_ID].firebaseapp.com',
  projectId: '[YOUR_PROJECT_ID]',
  storageBucket: '[YOUR_PROJECT_ID].appspot.com',
  messagingSenderId: '[YOUR_SENDER_ID]',
  appId: '[YOUR_APP_ID]'
};

/* Firebaseアプリを初期化（多重初期化を防ぐ） */
function dbInitFirebase() {
  if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(KARTEMAP_FIREBASE_CONFIG);
  }
}

/* Firestoreインスタンスを取得 */
function dbGetFirestore() {
  dbInitFirebase();
  return firebase.firestore();
}

/* Authインスタンスを取得 */
function dbGetAuth() {
  dbInitFirebase();
  return firebase.auth();
}

/* 現在ログイン中ユーザーのUIDを返す（未ログインならnull） */
function dbGetCurrentUid() {
  var user = dbGetAuth().currentUser;
  if (user) {
    return user.uid;
  }
  return null;
}

/* 自分の顧客コレクションへの参照を返す
 * users/{uid}/customers
 */
function dbGetCustomersRef() {
  var uid = dbGetCurrentUid();
  if (!uid) {
    return null;
  }
  return dbGetFirestore().collection('users').doc(uid).collection('customers');
}

/* 顧客を新規追加する
 * data: 顧客フィールドのオブジェクト
 * 戻り値: Promise（成功時はdocRef）
 */
function dbAddCustomer(data) {
  var ref = dbGetCustomersRef();
  if (!ref) {
    return Promise.reject(new Error('not_logged_in'));
  }
  var now = firebase.firestore.FieldValue.serverTimestamp();
  var record = {
    name: data.name || '',
    nameKana: data.nameKana || '',
    phone: data.phone || '',
    postalCode: data.postalCode || '',
    prefecture: data.prefecture || '',
    city: data.city || '',
    address: data.address || '',
    fullAddressInput: data.fullAddressInput || '',
    fullAddressNormalized: '',
    lat: null,
    lng: null,
    geocodeStatus: 'manual',
    geocodeError: null,
    ocrConfidence: null,
    sourceImagePath: null,
    memo: data.memo || '',
    createdAt: now,
    updatedAt: now
  };
  return ref.add(record);
}

/* 顧客を1件取得する
 * customerId: ドキュメントID
 * 戻り値: Promise（成功時はdocSnapshot）
 */
function dbGetCustomer(customerId) {
  var ref = dbGetCustomersRef();
  if (!ref) {
    return Promise.reject(new Error('not_logged_in'));
  }
  return ref.doc(customerId).get();
}

/* 顧客一覧を取得する（新しい登録順）
 * 戻り値: Promise（成功時はquerySnapshot）
 */
function dbListCustomers() {
  var ref = dbGetCustomersRef();
  if (!ref) {
    return Promise.reject(new Error('not_logged_in'));
  }
  return ref.orderBy('createdAt', 'desc').get();
}

/* 顧客を更新する
 * customerId: ドキュメントID
 * data: 更新するフィールド
 * 戻り値: Promise
 */
function dbUpdateCustomer(customerId, data) {
  var ref = dbGetCustomersRef();
  if (!ref) {
    return Promise.reject(new Error('not_logged_in'));
  }
  var record = {
    name: data.name || '',
    nameKana: data.nameKana || '',
    phone: data.phone || '',
    postalCode: data.postalCode || '',
    prefecture: data.prefecture || '',
    city: data.city || '',
    address: data.address || '',
    fullAddressInput: data.fullAddressInput || '',
    memo: data.memo || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  return ref.doc(customerId).update(record);
}

/* 顧客を削除する（Phase 2では画像なしのためFirestoreのみ削除）
 * customerId: ドキュメントID
 * 戻り値: Promise
 */
function dbDeleteCustomer(customerId) {
  var ref = dbGetCustomersRef();
  if (!ref) {
    return Promise.reject(new Error('not_logged_in'));
  }
  return ref.doc(customerId).delete();
}
