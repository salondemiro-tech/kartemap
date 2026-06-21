/* shared_csv.js
 * カルテマップ - CSVエクスポート処理
 * ES5のみ（var/function/Promise.then）。const/let/アロー関数/async/await禁止。
 *
 * 筆まめ用（Shift_JIS / BOMなし）とiPad確認用（UTF-8 / BOM付き）の2種を出力する。
 * Shift_JIS変換には encoding.js（CDN: window.Encoding）を使用する。
 */

/* CSV列順（設計書準拠）
 * 氏名,氏名カナ,郵便番号,都道府県,市区町村,番地,電話番号
 */
var CSV_HEADERS = ['氏名', '氏名カナ', '郵便番号', '都道府県', '市区町村', '番地', '電話番号'];

/* 1セルをCSV仕様に従ってエスケープする。
 * カンマ・改行・ダブルクォートを含む場合は全体を"で囲み、
 * 内部の"は""に置換する（RFC 4180準拠）。
 */
function csvEscapeCell(value) {
  var s;
  if (value === null || value === undefined) {
    s = '';
  } else {
    s = String(value);
  }
  var needsQuote =
    s.indexOf(',') !== -1 ||
    s.indexOf('"') !== -1 ||
    s.indexOf('\n') !== -1 ||
    s.indexOf('\r') !== -1;
  if (needsQuote) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/* 顧客配列からCSV文字列を組み立てる（改行はCRLF）。 */
function csvBuild(customers) {
  var lines = [];
  // ヘッダー行
  var headerCells = [];
  var h;
  for (h = 0; h < CSV_HEADERS.length; h++) {
    headerCells.push(csvEscapeCell(CSV_HEADERS[h]));
  }
  lines.push(headerCells.join(','));

  // データ行
  var i;
  for (i = 0; i < customers.length; i++) {
    var c = customers[i];
    var row = [
      csvEscapeCell(c.name),
      csvEscapeCell(c.nameKana),
      csvEscapeCell(c.postalCode),
      csvEscapeCell(c.prefecture),
      csvEscapeCell(c.city),
      csvEscapeCell(c.address),
      csvEscapeCell(c.phone)
    ];
    lines.push(row.join(','));
  }
  return lines.join('\r\n');
}

/* Blobを指定ファイル名でダウンロードさせる。 */
function csvTriggerDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 後始末（少し遅延させて確実に解放）
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}

/* 筆まめ用CSVをダウンロード（Shift_JIS / BOMなし）。
 * encoding.js が読み込まれていない場合はエラーを投げる。
 */
function csvDownloadFudemame(customers) {
  if (typeof Encoding === 'undefined') {
    throw new Error('encoding_lib_missing');
  }
  var csvStr = csvBuild(customers);
  // 文字列 → Unicode配列 → Shift_JIS(SJIS)バイト配列
  var unicodeArray = Encoding.stringToCode(csvStr);
  var sjisArray = Encoding.convert(unicodeArray, {
    to: 'SJIS',
    from: 'UNICODE'
  });
  var uint8 = new Uint8Array(sjisArray);
  var blob = new Blob([uint8], { type: 'text/csv' });
  csvTriggerDownload(blob, 'kartemap_customers_fudemame.csv');
}

/* iPad確認用CSVをダウンロード（UTF-8 / BOM付き）。 */
function csvDownloadUtf8(customers) {
  var csvStr = csvBuild(customers);
  // UTF-8 BOM（0xEF,0xBB,0xBF）を先頭に付与
  var bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  var blob = new Blob([bom, csvStr], { type: 'text/csv;charset=utf-8' });
  csvTriggerDownload(blob, 'kartemap_customers_utf8.csv');
}
