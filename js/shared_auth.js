/* shared_auth.js
 * カルテマップ - 認証共通処理
 * ES5のみ（var/function/Promise.then）。const/let/アロー関数/async/await禁止。
 */

/* メール/パスワードでログイン
 * 戻り値: Promise
 */
function authSignIn(email, password) {
  return dbGetAuth().signInWithEmailAndPassword(email, password);
}

/* メール/パスワードで新規登録
 * 戻り値: Promise
 */
function authSignUp(email, password) {
  return dbGetAuth().createUserWithEmailAndPassword(email, password);
}

/* ログアウト
 * 戻り値: Promise
 */
function authSignOut() {
  return dbGetAuth().signOut();
}

/* 認証状態を監視する
 * callback(user): userがnullなら未ログイン
 */
function authOnStateChanged(callback) {
  dbGetAuth().onAuthStateChanged(function (user) {
    callback(user);
  });
}

/* ログイン必須ページのガード。
 * 未ログインならindex.htmlへリダイレクトする。
 * ログイン済みならonReady(user)を呼ぶ。
 */
function authRequireLogin(onReady) {
  authOnStateChanged(function (user) {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    onReady(user);
  });
}

/* Firebaseの認証エラーコードを日本語メッセージに変換 */
function authErrorMessage(error) {
  var code = '';
  if (error && error.code) {
    code = error.code;
  }
  if (code === 'auth/invalid-email') {
    return 'メールアドレスの形式が正しくありません。';
  }
  if (code === 'auth/user-disabled') {
    return 'このアカウントは無効化されています。';
  }
  if (code === 'auth/user-not-found') {
    return 'アカウントが見つかりません。';
  }
  if (code === 'auth/wrong-password') {
    return 'パスワードが正しくありません。';
  }
  if (code === 'auth/invalid-credential') {
    return 'メールアドレスまたはパスワードが正しくありません。';
  }
  if (code === 'auth/email-already-in-use') {
    return 'このメールアドレスは既に登録されています。';
  }
  if (code === 'auth/weak-password') {
    return 'パスワードは6文字以上にしてください。';
  }
  if (code === 'auth/too-many-requests') {
    return '試行回数が多すぎます。しばらく待ってから再度お試しください。';
  }
  return 'エラーが発生しました。もう一度お試しください。';
}
