/**
 * SWA Managed Function: /api/chat
 *
 * Service Principal（クライアント資格情報フロー）で Entra ID トークンを取得し、
 * Azure AI Foundry Agent Service の Threads/Runs API を呼び出します。
 *
 * 必要な環境変数（SWA「環境変数」で設定）:
 *   FOUNDRY_ENDPOINT     - https://<account>.services.ai.azure.com/api/projects/<project>
 *   FOUNDRY_AGENT_ID     - エージェントID
 *   AZURE_TENANT_ID      - Entra ID テナント ID
 *   AZURE_CLIENT_ID      - アプリ登録のクライアント ID
 *   AZURE_CLIENT_SECRET  - アプリ登録のクライアントシークレット
 */

const API_VERSION = '2025-05-01';
const POLL_INTERVAL_MS = 800;
const POLL_TIMEOUT_MS = 60_000;
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

function buildHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function foundryFetch(url, options, context) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    context.log.error(`Foundry API ${res.status}: ${body}`);
    throw new Error(`Foundry API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
  const agentId = process.env.FOUNDRY_AGENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const userMessage = (req.body && req.body.message) || '';
  let threadId = (req.body && req.body.threadId) || null;

  if (!endpoint || !agentId || !tenantId || !clientId || !clientSecret) {
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
    const token = await getEntraToken(tenantId, clientId, clientSecret);
    const headers = buildHeaders(token);
    const v = `?api-version=${API_VERSION}`;

    if (!threadId) {
      const thread = await foundryFetch(
        `${endpoint}/threads${v}`,
        { method: 'POST', headers, body: '{}' },
        context
      );
      threadId = thread.id;
    }

    await foundryFetch(
      `${endpoint}/threads/${threadId}/messages${v}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ role: 'user', content: userMessage }),
      },
      context
    );

    let run = await foundryFetch(
      `${endpoint}/threads/${threadId}/runs${v}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ assistant_id: agentId }),
      },
      context
    );

    const startTime = Date.now();
    while (
      run.status === 'queued' ||
      run.status === 'in_progress' ||
      run.status === 'cancelling'
    ) {
      if (Date.now() - startTime > POLL_TIMEOUT_MS) {
        throw new Error('実行タイムアウト（60秒）');
      }
      await sleep(POLL_INTERVAL_MS);
      run = await foundryFetch(
        `${endpoint}/threads/${threadId}/runs/${run.id}${v}`,
        { method: 'GET', headers },
        context
      );
    }

    if (run.status !== 'completed') {
      throw new Error(
        `Run が完了しませんでした: status=${run.status}${
          run.last_error ? ` / ${run.last_error.message || ''}` : ''
        }`
      );
    }

    const list = await foundryFetch(
      `${endpoint}/threads/${threadId}/messages${v}&order=desc&limit=10`,
      { method: 'GET', headers },
      context
    );

    const latestAssistant = (list.data || []).find((m) => m.role === 'assistant');
    if (!latestAssistant) {
      throw new Error('アシスタントの応答が見つかりませんでした');
    }

    let replyText = '';
    const citations = [];
    for (const block of latestAssistant.content || []) {
      if (block.type === 'text' && block.text) {
        replyText += block.text.value || '';
        for (const ann of block.text.annotations || []) {
          if (ann.type === 'file_citation' && ann.file_citation) {
            citations.push({
              fileId: ann.file_citation.file_id,
              fileName: ann.file_citation.file_id,
              quote: ann.text || '',
            });
          } else if (ann.type === 'file_path' && ann.file_path) {
            citations.push({
              fileId: ann.file_path.file_id,
              fileName: ann.text || ann.file_path.file_id,
            });
          }
        }
      }
    }

    context.res = {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: {
        reply: replyText.trim(),
        citations,
        threadId,
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
