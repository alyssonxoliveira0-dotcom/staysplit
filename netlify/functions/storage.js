const https = require('https');

const CF_ACCOUNT   = process.env.CF_ACCOUNT_ID;
const CF_NAMESPACE = process.env.CF_KV_NAMESPACE_ID;
const CF_TOKEN     = process.env.CF_KV_TOKEN;

function kvRequest(method, key, bodyStr) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('KV timeout')), 5000);
    const path = `/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CF_NAMESPACE}/values/${encodeURIComponent(key)}`;
    const opts = {
      hostname: 'api.cloudflare.com', port: 443, path, method,
      headers: { 'Authorization': `Bearer ${CF_TOKEN}` }
    };
    if (bodyStr !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    if (bodyStr !== undefined) req.write(bodyStr);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  if (!CF_ACCOUNT || !CF_NAMESPACE || !CF_TOKEN) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'storage_not_configured' }) };
  }

  const { _session: sessionToken, tipo } = event.queryStringParameters || {};

  if (!sessionToken || !['hist', 'hoteis', 'config'].includes(tipo)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid params' }) };
  }

  let email;
  try {
    const sessionRes = await kvRequest('GET', 'session:' + sessionToken);
    if (sessionRes.status !== 200) return { statusCode: 401, headers, body: JSON.stringify({ error: 'session_expired' }) };
    const session = JSON.parse(sessionRes.body);
    if (!session || session.expiresAt < Date.now()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'session_expired' }) };
    }
    email = session.email;
  } catch(e) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'session_expired' }) };
  }

  const emailId = email.replace(/[^a-zA-Z0-9]/g, '').slice(-20);
  const kvKey = `${tipo}_${emailId}`;

  if (event.httpMethod === 'GET') {
    try {
      const res = await kvRequest('GET', kvKey);
      if (res.status === 404) return { statusCode: 200, headers, body: JSON.stringify(null) };
      if (res.status !== 200) {
        console.error('[storage] KV GET error:', res.status);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'get_failed' }) };
      }
      return { statusCode: 200, headers, body: res.body };
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'get_failed', detail: e.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const bodyStr = event.body || 'null';
      const res = await kvRequest('PUT', kvKey, bodyStr);
      if (res.status < 200 || res.status > 299) {
        console.error('[storage] KV PUT error:', res.status);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'set_failed' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'set_failed', detail: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};