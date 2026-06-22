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
  var hasGeo = (typeof data.lat === 'number' && typeof data.lng === 'number');
  var record = {
    name: data.name || '',
    nameKana: data.nameKana || '',
    phone: data.phone || '',
    postalCode: data.postalCode || '',
    prefecture: data.prefecture || '',
    city: data.city || '',
    address: data.address || '',
    fullAddressInput: data.fullAddressInput || '',
    fullAddressNormalized: data.fullAddressInput || '',
    lat: hasGeo ? data.lat : null,
    lng: hasGeo ? data.lng : null,
    geocodeStatus: hasGeo ? 'success' : 'manual',
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
  // 座標が渡された場合のみ更新（地図ピンと連動）
  if (typeof data.lat === 'number' && typeof data.lng === 'number') {
    record.lat = data.lat;
    record.lng = data.lng;
    record.fullAddressNormalized = data.fullAddressInput || '';
    record.geocodeStatus = 'success';
    record.geocodeError = null;
  }
  return ref.doc(customerId).update(record);
}

/* 保存用データに郵便番号・緯度経度を補完してから保存する共通ヘルパー。
 * data: collectForm()等で作った顧客データ（fullAddressInput必須）
 * geoLookup（shared_geo.js）で住所→郵便番号・座標を取得し、
 * 郵便番号が未入力なら補完、座標は常にセットする。
 * mode: 'add' なら新規追加、'update' なら更新（customerId必須）
 * 戻り値: Promise
 */
function dbSaveWithGeo(data, mode, customerId) {
  // shared_geo.js が読み込まれていない場合はそのまま保存
  if (typeof geoLookup !== 'function') {
    if (mode === 'update') {
      return dbUpdateCustomer(customerId, data);
    }
    return dbAddCustomer(data);
  }
  return geoLookup(data.fullAddressInput).then(function (geo) {
    // 郵便番号が空のときだけ補完（ユーザー入力を優先）
    if (!data.postalCode && geo.postalCode) {
      data.postalCode = geo.postalCode;
    }
    // 座標は取得できたらセット
    if (geo.status === 'success') {
      data.lat = geo.lat;
      data.lng = geo.lng;
    }
    if (mode === 'update') {
      return dbUpdateCustomer(customerId, data);
    }
    return dbAddCustomer(data);
  });
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

/* CSVから顧客を一括インポートする
 * rows: [{name, postalCode, fullAddressInput, address2}] の配列
 *       （CSVパース後の行データ。address2は住所2列、空可）
 * Firestoreのbatch writeで最大500件ずつ保存。
 * geocodeStatusは'pending'で保存（マップ表示時に個別ジオコード）。
 * 戻り値: Promise（成功時は保存件数）
 */
function dbImportCustomers(rows) {
  var ref = dbGetCustomersRef();
  if (!ref) {
    return Promise.reject(new Error('not_logged_in'));
  }
  var db = dbGetFirestore();
  var now = firebase.firestore.FieldValue.serverTimestamp();
  var BATCH_SIZE = 500;
  var batches = [];
  var i;
  var batch = null;
  var countInBatch = 0;

  for (i = 0; i < rows.length; i++) {
    if (countInBatch === 0) {
      batch = db.batch();
    }
    var r = rows[i];
    var addrParts = [];
    if (r.fullAddressInput) { addrParts.push(r.fullAddressInput); }
    if (r.address2) { addrParts.push(r.address2); }
    var fullAddr = addrParts.join(' ').trim();
    var docRef = ref.doc();
    batch.set(docRef, {
      name: r.name || '',
      nameKana: '',
      phone: r.phone || '',
      postalCode: r.postalCode || '',
      prefecture: '',
      city: '',
      address: r.address2 || '',
      fullAddressInput: fullAddr,
      fullAddressNormalized: '',
      lat: null,
      lng: null,
      geocodeStatus: 'pending',
      geocodeError: null,
      ocrConfidence: null,
      sourceImagePath: null,
      memo: r.memo || '',
      createdAt: now,
      updatedAt: now
    });
    countInBatch++;
    if (countInBatch === BATCH_SIZE) {
      batches.push(batch);
      batch = null;
      countInBatch = 0;
    }
  }
  if (countInBatch > 0) {
    batches.push(batch);
  }

  /* バッチを順番にcommit */
  var total = rows.length;
  function commitNext(idx) {
    if (idx >= batches.length) {
      return Promise.resolve(total);
    }
    return batches[idx].commit().then(function () {
      return commitNext(idx + 1);
    });
  }
  return commitNext(0);
}
