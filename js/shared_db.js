/* shared_db.js
 * カルテマップ - Firebase初期化とFirestore共通処理
 * ES5のみ（var/function/Promise.then）。const/let/アロー関数/async/await禁止。
 *
 * 【重要】下記firebaseConfigは新規Firebaseプロジェクト「kartemap」の値に差し替えること。
 * 現状はプレースホルダー。Firebase Console > プロジェクトの設定 > マイアプリ から取得する。
 */

var KARTEMAP_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCmPdkLJBZGWrPFD0e21AV78Vu0G_VEYYo',
  authDomain: 'kartemap-371bc.firebaseapp.com',
  projectId: 'kartemap-371bc',
  storageBucket: 'kartemap-371bc.firebasestorage.app',
  messagingSenderId: '684742259483',
  appId: '1:684742259483:web:22116b3d134164c0cbd9be'
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

/* Functionsインスタンスを取得（東京リージョン） */
function dbGetFunctions() {
  dbInitFirebase();
  return firebase.app().functions('asia-northeast1');
}

/* カルテ画像をOCRする（Cloud Functionsのextract KarteDataを呼ぶ）
 * imageBase64: base64文字列（data URLプレフィックスなし）
 * mimeType: 'image/jpeg' など
 * 戻り値: Promise（成功時は {name, nameKana, phone, postalCode, prefecture, city, address}）
 */
function dbExtractKarteData(imageBase64, mimeType) {
  var fn = dbGetFunctions().httpsCallable('extractKarteData');
  return fn({ imageBase64: imageBase64, mimeType: mimeType }).then(function (result) {
    return result.data;
  });
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

/* Geocoding結果（緯度経度）を顧客に保存する。
 * 一度変換した座標を再利用し、無駄なGeocodingを避けるため。
 * customerId: ドキュメントID
 * lat, lng: 緯度経度
 * 戻り値: Promise
 */
function dbSaveGeocode(customerId, lat, lng) {
  var ref = dbGetCustomersRef();
  if (!ref) {
    return Promise.reject(new Error('not_logged_in'));
  }
  return ref.doc(customerId).update({
    lat: lat,
    lng: lng,
    geocodeStatus: 'success',
    geocodeError: null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}
