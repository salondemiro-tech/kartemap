/* index.js
 * カルテマップ Cloud Functions
 *
 * extractKarteData:
 *   ブラウザから送られた手書きカルテ画像（base64）をClaude APIに渡してOCRし、
 *   氏名・氏名カナ・電話番号・住所をJSONで返す。
 *   - context.auth を必ず検証する（未ログインは拒否）
 *   - Geocodingはここでは行わない（保存時に確認済み住所で行う設計）
 *   - OCR生テキスト等の個人情報は返さない／保存しない
 *
 * Claude APIキーは Firebase Secret（ANTHROPIC_API_KEY）に保存し、
 * フロントには一切露出しない。
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');

// 全Functionを東京リージョンに
setGlobalOptions({ region: 'asia-northeast1' });

// Claude APIキー（デプロイ前に firebase functions:secrets:set で設定）
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// 使用モデル（固定せず差し替え可能にする方針だが、ここでは既定値を持つ）
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// OCR指示プロンプト
const OCR_PROMPT =
  'この画像はサロンの手書きカルテです。以下の情報をJSONで抽出してください。' +
  '読み取れない項目はnullにしてください。マークダウンや説明文は不要です。JSONのみ返してください。' +
  '{"name":"氏名","nameKana":"氏名カナ","phone":"電話番号",' +
  '"postalCode":"郵便番号","prefecture":"都道府県","city":"市区町村","address":"番地以降"}';

/* Claudeの返答テキストからJSONを安全に取り出す */
function parseClaudeJson(text) {
  if (!text) {
    return null;
  }
  // ```json ... ``` で囲まれていた場合に備えて除去
  var cleaned = String(text).replace(/```json/g, '').replace(/```/g, '').trim();
  // 最初の { から最後の } までを取り出す
  var start = cleaned.indexOf('{');
  var end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  var jsonStr = cleaned.substring(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

exports.extractKarteData = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    // GitHub Pagesからの呼び出しを許可
    cors: ['https://salondemiro-tech.github.io'],
    timeoutSeconds: 60,
    memory: '512MiB'
  },
  async (request) => {
    // 1. 認証チェック（必須）
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    // 2. 入力チェック
    var data = request.data || {};
    var imageBase64 = data.imageBase64;
    var mimeType = data.mimeType || 'image/jpeg';
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new HttpsError('invalid-argument', '画像データがありません。');
    }
    // 念のためdata URLのプレフィックスが付いていたら除去
    var commaIdx = imageBase64.indexOf('base64,');
    if (commaIdx !== -1) {
      imageBase64 = imageBase64.substring(commaIdx + 'base64,'.length);
    }

    // 3. Claude APIを呼ぶ
    var body = {
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: OCR_PROMPT
            }
          ]
        }
      ]
    };

    var resp;
    try {
      resp = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY.value(),
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new HttpsError('unavailable', 'OCRサービスに接続できませんでした。');
    }

    if (!resp.ok) {
      var errText = '';
      try {
        errText = await resp.text();
      } catch (e2) {
        errText = '';
      }
      console.error('Anthropic API error', resp.status, errText);
      throw new HttpsError('internal', 'OCR処理でエラーが発生しました。');
    }

    var json;
    try {
      json = await resp.json();
    } catch (e) {
      throw new HttpsError('internal', 'OCR結果の解析に失敗しました。');
    }

    // 4. Claudeの返答からテキストを取り出してJSON化
    var text = '';
    if (json && json.content && json.content.length > 0) {
      var i;
      for (i = 0; i < json.content.length; i++) {
        if (json.content[i].type === 'text') {
          text = text + json.content[i].text;
        }
      }
    }

    var parsed = parseClaudeJson(text);
    if (!parsed) {
      throw new HttpsError('internal', 'カルテを読み取れませんでした。手入力で登録してください。');
    }

    // 5. 必要な項目だけ返す（rawテキストは返さない）
    return {
      name: parsed.name || '',
      nameKana: parsed.nameKana || '',
      phone: parsed.phone || '',
      postalCode: parsed.postalCode || '',
      prefecture: parsed.prefecture || '',
      city: parsed.city || '',
      address: parsed.address || ''
    };
  }
);
