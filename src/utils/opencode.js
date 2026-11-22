const { logError, logInfo } = require('./logger');

const OPENCODE_URL = process.env.OPENCODE_SERVER_URL || 'http://127.0.0.1:4096';
const OPENCODE_USER = process.env.OPENCODE_SERVER_USERNAME || 'opencode';
const OPENCODE_PASS = process.env.OPENCODE_SERVER_PASSWORD || '';

const authHeader = () => {
  if (!OPENCODE_PASS) return {};
  const token = Buffer.from(`${OPENCODE_USER}:${OPENCODE_PASS}`).toString('base64');
  return { Authorization: `Basic ${token}` };
};

async function api(method, endpoint, body = null) {
  const url = `${OPENCODE_URL}${endpoint}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenCode API ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function healthCheck() {
  try {
    const data = await api('GET', '/global/health');
    return data.healthy === true;
  } catch { return false; }
}

async function createSession(title) {
  return api('POST', '/session', { title });
}

async function deleteSession(id) {
  return api('DELETE', `/session/${id}`);
}

async function sendMessageAsync(sessionId, text) {
  return api('POST', `/session/${sessionId}/prompt_async`, {
    parts: [{ type: 'text', text }],
  });
}

async function abortSession(sessionId) {
  return api('POST', `/session/${sessionId}/abort`);
}

async function getModels() {
  return api('GET', '/config/providers');
}

/**
 * Conecta al stream SSE de OpenCode y llama onEvent por cada evento.
 * Retorna una promesa que se resuelve cuando el SSE se cierra o el signal se aborta.
 * Filtra eventos por sessionId.
 */
function streamSession(sessionId, onEvent, signal) {
  return new Promise((resolve, reject) => {
    const url = `${OPENCODE_URL}/global/event`;
    const headers = { Accept: 'text/event-stream', ...authHeader() };

    fetch(url, { headers, signal }).then(res => {
      if (!res.ok) return reject(new Error(`SSE ${res.status}`));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const pump = () => {
        reader.read().then(({ done, value }) => {
          if (done) { resolve(); return; }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const raw = JSON.parse(line.slice(6));
              const evt = raw.payload || raw;
              // Filtrar por sessionId
              const evtSessionId = evt.properties?.sessionID ||
                evt.properties?.data?.sessionID ||
                evt.syncEvent?.aggregateID;
              if (evtSessionId !== sessionId) continue;
              onEvent(evt);
            } catch {}
          }
          pump();
        }).catch(reject);
      };
      pump();
    }).catch(reject);
  });
}

async function respondPermission(sessionId, permissionId, response, remember = false) {
  return api('POST', `/session/${sessionId}/permissions/${permissionId}`, {
    response,
    remember,
  });
}

async function getSessionStatus() {
  return api('GET', '/session/status');
}

module.exports = {
  healthCheck,
  createSession,
  deleteSession,
  sendMessageAsync,
  abortSession,
  getModels,
  respondPermission,
  getSessionStatus,
  streamSession,
};
