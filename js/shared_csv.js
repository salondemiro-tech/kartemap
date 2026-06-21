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

/* === 筆まめクラウド住所録 標準形式 === */

/* 筆まめ標準形式のヘッダー（公式フォーマットの列名をそのまま使用） */
var FUDEMAME_HEADER =
  '姓,名,敬称,セイ,メイ,タグ,誕生日,性別,顧客コード,メモ,' +
  '勤務先名,勤務先カナ,部署名1,部署名2,役職,' +
  '住所1-分類,住所1-郵便番号,住所1-都道府県,住所1-市区町村,住所1-地名番地,住所1-ビル名,住所1-最寄り駅,' +
  '住所2-分類,住所2-郵便番号,住所2-都道府県,住所2-市区町村,住所2-地名番地,住所2-ビル名,住所2-最寄り駅,' +
  '住所3-分類,住所3-郵便番号,住所3-都道府県,住所3-市区町村,住所3-地名番地,住所3-ビル名,住所3-最寄り駅,' +
  'TEL1-分類,TEL1-番号,TEL2-分類,TEL2-番号,TEL3-分類,TEL3-番号,TEL4-分類,TEL4-番号,TEL5-分類,TEL5-番号,' +
  'EMAIL1-分類,EMAIL1-アドレス,EMAIL2-分類,EMAIL2-アドレス,EMAIL3-分類,EMAIL3-アドレス,EMAIL4-分類,EMAIL4-アドレス,EMAIL5-分類,EMAIL5-アドレス,' +
  'WEB1-分類,WEB1-URL,WEB2-分類,WEB2-URL,WEB3-分類,WEB3-URL,WEB4-分類,WEB4-URL,WEB5-分類,WEB5-URL,' +
  '連名1-姓,連名1-名,連名1-敬称,連名1-セイ,連名1-メイ,連名1-誕生日,連名1-性別,' +
  '連名2-姓,連名2-名,連名2-敬称,連名2-セイ,連名2-メイ,連名2-誕生日,連名2-性別,' +
  '連名3-姓,連名3-名,連名3-敬称,連名3-セイ,連名3-メイ,連名3-誕生日,連名3-性別,' +
  '連名4-姓,連名4-名,連名4-敬称,連名4-セイ,連名4-メイ,連名4-誕生日,連名4-性別,' +
  '連名5-姓,連名5-名,連名5-敬称,連名5-セイ,連名5-メイ,連名5-誕生日,連名5-性別';

/* 氏名（"山田 花子"）を 姓・名 に分割する。
 * 全角/半角スペースで分割。スペースが無ければ全部を姓に入れる。
 */
function fudemameSplitName(fullName) {
  var s = (fullName || '').replace('\u3000', ' ').trim();
  if (!s) {
    return { sei: '', mei: '' };
  }
  var idx = s.indexOf(' ');
  if (idx === -1) {
    return { sei: s, mei: '' };
  }
  return {
    sei: s.substring(0, idx).trim(),
    mei: s.substring(idx + 1).trim()
  };
}

/* 顧客1件を筆まめ標準形式の1行（列数=ヘッダーと一致）に変換 */
function fudemameBuildRow(c) {
  // ヘッダーの列数だけ空セルを用意
  var headerCols = FUDEMAME_HEADER.split(',');
  var row = [];
  var i;
  for (i = 0; i < headerCols.length; i++) {
    row.push('');
  }
  // 列インデックス（FUDEMAME_HEADERの並びに対応）
  // 0:姓 1:名 3:セイ 4:メイ
  // 16:住所1-郵便番号 17:住所1-都道府県 18:住所1-市区町村 19:住所1-地名番地
  // 37:TEL1-番号
  var name = fudemameSplitName(c.name);
  var kana = fudemameSplitName(c.nameKana);
  row[0] = name.sei;
  row[1] = name.mei;
  row[3] = kana.sei;
  row[4] = kana.mei;
  row[16] = c.postalCode || '';
  row[17] = c.prefecture || '';
  row[18] = c.city || '';
  row[19] = c.address || '';
  row[37] = c.phone || '';

  // 各セルをエスケープ
  var out = [];
  for (i = 0; i < row.length; i++) {
    out.push(csvEscapeCell(row[i]));
  }
  return out.join(',');
}

/* 顧客配列から筆まめ標準形式のCSV文字列を組み立てる（CRLF） */
function fudemameBuild(customers) {
  var lines = [];
  lines.push(FUDEMAME_HEADER);
  var i;
  for (i = 0; i < customers.length; i++) {
    lines.push(fudemameBuildRow(customers[i]));
  }
  return lines.join('\r\n');
}

/* 筆まめ用CSVをダウンロード（筆まめクラウド標準形式 / Shift_JIS / BOMなし）。
 * encoding.js が読み込まれていない場合はエラーを投げる。
 */
function csvDownloadFudemame(customers) {
  if (typeof Encoding === 'undefined') {
    throw new Error('encoding_lib_missing');
  }
  var csvStr = fudemameBuild(customers);
  var unicodeArray = Encoding.stringToCode(csvStr);
  var sjisArray = Encoding.convert(unicodeArray, {
    to: 'SJIS',
    from: 'UNICODE'
  });
  var uint8 = new Uint8Array(sjisArray);
  var blob = new Blob([uint8], { type: 'text/csv' });
  csvTriggerDownload(blob, 'kartemap_customers_fudemame.csv');
}

/* iPad確認用CSVをダウンロード（シンプルな列構成 / UTF-8 / BOM付き）。 */
function csvDownloadUtf8(customers) {
  var csvStr = csvBuild(customers);
  // UTF-8 BOM（0xEF,0xBB,0xBF）を先頭に付与
  var bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  var blob = new Blob([bom, csvStr], { type: 'text/csv;charset=utf-8' });
  csvTriggerDownload(blob, 'kartemap_customers_utf8.csv');
}
