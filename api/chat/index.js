/**
 * SWA Managed Function: /api/chat
 *
 * Azure AI Foundry の Responses API を使ってホスト型エージェントを呼び出します。
 * 認証は Service Principal（クライアント資格情報フロー）で Entra ID トークンを取得。
 *
 * 必要な環境変数（SWA「環境変数」で設定）:
 *   FOUNDRY_ENDPOINT      - https://<account>.services.ai.azure.com/api/projects/<project>
 *   FOUNDRY_AGENT_ID      - エージェント名（例: agent-family-ai-202605）
 *   FOUNDRY_AGENT_VERSION - （任意）エージェントのバージョン番号（例: "2"）
 *   AZURE_TENANT_ID       - Entra ID テナント ID
 *   AZURE_CLIENT_ID       - アプリ登録のクライアント ID
 *   AZURE_CLIENT_SECRET   - アプリ登録のクライアントシークレット
 */

const TOKEN_SCOPE = 'https://ai.azure.com/.default';

// Function インスタンスのメモリ内でトークンキャッシュ
let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getEntraToken(tenantId, clientId, clientSecret) {
  const now = Date.now();
  if (cachedToken && cachedTokenExpiresAt - now > 60_000) {
    return cachedToken;
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: TOKEN_SCOPE,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Entra ID トークン取得失敗: ${res.status} ${text.slice(0, 300)}`
    );
  }

  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}

module.exports = async function (context, req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: cors };
    return;
  }

  const endpoint = (process.env.FOUNDRY_ENDPOINT || '').replace(/\/$/, '');
  const agentName = process.env.FOUNDRY_AGENT_ID;
  const agentVersion = process.env.FOUNDRY_AGENT_VERSION || null;
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const userMessage = (req.body && req.body.message) || '';
  const previousResponseId = (req.body && req.body.threadId) || null;

  if (!endpoint || !agentName || !tenantId || !clientId || !clientSecret) {
    context.res = {
      status: 500,
      headers: cors,
      body: {
        error:
          'サーバ側の環境変数が未設定です。FOUNDRY_ENDPOINT / FOUNDRY_AGENT_ID / AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET をSWAに設定してください。',
      },
    };
    return;
  }

  if (!userMessage.trim()) {
    context.res = {
      status: 400,
      headers: cors,
      body: { error: 'message が空です。' },
    };
    return;
  }

  try {
    // 1) Entra ID トークン取得
    const token = await getEntraToken(tenantId, clientId, clientSecret);

    // 2) Responses API を1回呼ぶ（threads/runs の代わり）
    const url = `${endpoint}/openai/v1/responses`;

    const agentReference = {
      name: agentName,
      type: 'agent_reference',
    };
    if (agentVersion) {
      agentReference.version = String(agentVersion);
    }

    const payload = {
      input: [{ role: 'user', content: userMessage }],
      agent_reference: agentReference,
    };
    if (previousResponseId) {
      payload.previous_response_id = previousResponseId;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      context.log.error(`Foundry Responses API ${res.status}: ${text}`);
      throw new Error(`Foundry API ${res.status}: ${text.slice(0, 500)}`);
    }

    const data = await res.json();

    // 3) output 配列からテキストと引用を抽出
    let replyText = '';
    const citations = [];

    for (const item of data.output || []) {
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.type === 'output_text') {
            replyText += block.text || '';
            for (const ann of block.annotations || []) {
              if (ann.type === 'file_citation') {
                citations.push({
                  fileId: ann.file_id,
                  fileName: ann.filename || ann.file_id,
                });
              } else if (ann.type === 'url_citation') {
                citations.push({
                  url: ann.url,
                  fileName: ann.title || ann.url,
                });
              } else if (ann.type === 'file_path') {
                citations.push({
                  fileId: ann.file_id,
                  fileName: ann.filename || ann.file_id,
                });
              }
            }
          }
        }
      }
    }

    // フォールバック：output_text フィールドが直接ある場合
    if (!replyText && data.output_text) {
      replyText = data.output_text;
    }

    context.res = {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: {
        reply: replyText.trim() || '（応答が空でした）',
        citations,
        threadId: data.id || previousResponseId, // 次回のpreviousとして使う
      },
    };
  } catch (err) {
    context.log.error('Chat handler error:', err);
    context.res = {
      status: 500,
      headers: cors,
      body: { error: err.message || String(err) },
    };
  }
};
