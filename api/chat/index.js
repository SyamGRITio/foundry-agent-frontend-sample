/**
 * SWA Managed Function: /api/chat
 *
 * Proxies a single user message to Azure AI Foundry Agent Service
 * using the Threads/Runs REST API, then returns the assistant's reply.
 *
 * Required environment variables (set in SWA > 環境変数):
 *   FOUNDRY_ENDPOINT  - e.g. https://<account>.services.ai.azure.com/api/projects/<project>
 *   FOUNDRY_AGENT_ID  - the agent's ID (e.g. asst_xxx) or name
 *   FOUNDRY_API_KEY   - project API key (or Entra ID bearer token)
 *
 * Request body:
 *   { "message": "...", "threadId": "thread_xxx" | null }
 *
 * Response body:
 *   { "reply": "...", "citations": [...], "threadId": "thread_xxx" }
 */

const API_VERSION = '2025-05-01';
const POLL_INTERVAL_MS = 800;
const POLL_TIMEOUT_MS = 60_000;

function buildHeaders(apiKey) {
  // Send both headers so either auth scheme works
  return {
    'Content-Type': 'application/json',
    'api-key': apiKey,
    Authorization: `Bearer ${apiKey}`,
  };
}

async function foundryFetch(url, options, context) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    context.log.error(`Foundry API ${res.status} ${res.statusText}: ${body}`);
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
  const apiKey = process.env.FOUNDRY_API_KEY;
  const userMessage = (req.body && req.body.message) || '';
  let threadId = (req.body && req.body.threadId) || null;

  if (!endpoint || !agentId || !apiKey) {
    context.res = {
      status: 500,
      headers: cors,
      body: {
        error:
          'サーバ側の環境変数が未設定です。FOUNDRY_ENDPOINT / FOUNDRY_AGENT_ID / FOUNDRY_API_KEY をSWAに設定してください。',
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

  const headers = buildHeaders(apiKey);
  const v = `?api-version=${API_VERSION}`;

  try {
    // 1) Create thread if none exists
    if (!threadId) {
      const thread = await foundryFetch(
        `${endpoint}/threads${v}`,
        { method: 'POST', headers, body: '{}' },
        context
      );
      threadId = thread.id;
    }

    // 2) Add user message to thread
    await foundryFetch(
      `${endpoint}/threads/${threadId}/messages${v}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ role: 'user', content: userMessage }),
      },
      context
    );

    // 3) Create run
    let run = await foundryFetch(
      `${endpoint}/threads/${threadId}/runs${v}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ assistant_id: agentId }),
      },
      context
    );

    // 4) Poll until terminal state
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

    // 5) Fetch latest assistant message
    const list = await foundryFetch(
      `${endpoint}/threads/${threadId}/messages${v}&order=desc&limit=10`,
      { method: 'GET', headers },
      context
    );

    const latestAssistant = (list.data || []).find((m) => m.role === 'assistant');
    if (!latestAssistant) {
      throw new Error('アシスタントの応答が見つかりませんでした');
    }

    // 6) Extract text + citations from message content
    let replyText = '';
    const citations = [];
    for (const block of latestAssistant.content || []) {
      if (block.type === 'text' && block.text) {
        replyText += block.text.value || '';
        for (const ann of block.text.annotations || []) {
          if (ann.type === 'file_citation' && ann.file_citation) {
            citations.push({
              fileId: ann.file_citation.file_id,
              fileName: ann.file_citation.file_id, // file name not always returned
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
