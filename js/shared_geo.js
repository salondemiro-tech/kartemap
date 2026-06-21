/* shared_geo.js
 * カルテマップ - 住所から郵便番号・緯度経度を取得する共通処理
 * ES5のみ（var/function/Promise.then）。const/let/アロー関数/async/await禁止。
 *
 * Google Maps JavaScript APIのGeocoderを使う。
 * このファイルを使うページは、Maps APIを読み込んでおく必要がある。
 */

var GEO_GEOCODER = null;

/* Geocoderインスタンスを取得（遅延生成） */
function geoGetGeocoder() {
  if (GEO_GEOCODER) {
    return GEO_GEOCODER;
  }
  if (typeof google === 'undefined' || !google.maps || !google.maps.Geocoder) {
    return null;
  }
  GEO_GEOCODER = new google.maps.Geocoder();
  return GEO_GEOCODER;
}

/* address_componentsから郵便番号を取り出す（例：700-0825） */
function geoExtractPostalCode(components) {
  if (!components) {
    return '';
  }
  var i, j;
  for (i = 0; i < components.length; i++) {
    var types = components[i].types || [];
    for (j = 0; j < types.length; j++) {
      if (types[j] === 'postal_code') {
        return components[i].long_name || '';
      }
    }
  }
  return '';
}

/* 住所から郵便番号・緯度経度を取得する。
 * address: 住所文字列
 * 戻り値: Promise（成功時は {postalCode, lat, lng, status}）
 *   - 取得できなかった項目は空文字またはnull
 *   - Geocoder自体が使えない場合も resolve（保存をブロックしないため）
 */
function geoLookup(address) {
  return new Promise(function (resolve) {
    var empty = { postalCode: '', lat: null, lng: null, status: 'unavailable' };
    if (!address) {
      resolve(empty);
      return;
    }
    var geocoder = geoGetGeocoder();
    if (!geocoder) {
      resolve(empty);
      return;
    }
    geocoder.geocode({ address: address, region: 'jp' }, function (results, status) {
      if (status === 'OK' && results && results[0]) {
        var r = results[0];
        var loc = r.geometry.location;
        resolve({
          postalCode: geoExtractPostalCode(r.address_components),
          lat: loc.lat(),
          lng: loc.lng(),
          status: 'success'
        });
      } else {
        resolve({ postalCode: '', lat: null, lng: null, status: 'failed' });
      }
    });
  });
}
