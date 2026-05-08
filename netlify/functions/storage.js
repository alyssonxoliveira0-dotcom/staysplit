const https = require('https');

const CF_ACCOUNT = process.env.CF_ACCOUNT_ID;
const CF_NAMESPACE = process.env.CF_KV_NAMESPACE_ID;
const CF_TOKEN = process.env.CF_KV_TOKEN;

function kvRequest(method, key, bodyStr) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('KV timeout after 5s')), 5000);
    const path = `/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CF_NAMESPACE}/values/${encodeURIComponent(key)}`;
    const opts = {
      hostname: 'api.cloudflare.com',
      port: 443,
      path,
      method,
      headers: { 'Authorization': `Bearer ${CF_TOKEN}` }
    };
    if (bodyStr !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', (e) => { clearTimeout(timer); reject(e); });
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

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (!CF_ACCOUNT || !CF_NAMESPACE || !CF_TOKEN) {
    console.error('[storage] Env vars ausentes: CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_KV_TOKEN');
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'storage_not_configured' }) };
  }

  const { _token: token, tipo } = event.queryStringParameters || {};
  if (!token || !['hist', 'hoteis'].includes(tipo)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid params' }) };
  }

  const id = token.replace(/[^a-zA-Z0-9]/g, '').slice(-16) || 'default';
  const kvKey = `${tipo}_${id}`;

<<<<<<< HEAD
=======
  let store;
  try {
    store = getStore('staysplit');
  } catch (e) {
    console.error('[storage] getStore failed:', e.message);
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'store_init_failed', detail: e.message }) };
  }

>>>>>>> cb309faf669e441673e87bb18141b0bc74fda84f
  if (event.httpMethod === 'GET') {
    try {
<<<<<<< HEAD
      const res = await kvRequest('GET', kvKey);
      if (res.status === 404) {
        return { statusCode: 200, headers, body: JSON.stringify(null) };
      }
      if (res.status !== 200) {
        console.error('[storage] KV GET error:', res.status, res.body.slice(0, 200));
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'get_failed', detail: res.body }) };
      }
      return { statusCode: 200, headers, body: res.body };
=======
      const data = await Promise.race([
        store.get(blobKey, { type: 'json' }),
        blobTimeout(8000)
      ]);
      return { statusCode: 200, headers, body: JSON.stringify(data != null ? data : null) };
>>>>>>> cb309faf669e441673e87bb18141b0bc74fda84f
    } catch (e) {
<<<<<<< HEAD
      console.error('[storage] GET exception:', e.message);
=======
      console.error('[storage] GET failed — key:', blobKey, '| error:', e.message);
>>>>>>> cb309faf669e441673e87bb18141b0bc74fda84f
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'get_failed', detail: e.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
<<<<<<< HEAD
      const bodyStr = event.body || 'null';
      const res = await kvRequest('PUT', kvKey, bodyStr);
      if (res.status < 200 || res.status > 299) {
        console.error('[storage] KV PUT error:', res.status, res.body.slice(0, 200));
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'set_failed', detail: res.body }) };
      }
=======
      const body = JSON.parse(event.body || 'null');
      await Promise.race([
        store.setJSON(blobKey, body),
        blobTimeout(8000)
      ]);
>>>>>>> cb309faf669e441673e87bb18141b0bc74fda84f
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (e) {
<<<<<<< HEAD
      console.error('[storage] POST exception:', e.message);
=======
      console.error('[storage] POST failed — key:', blobKey, '| error:', e.message);
>>>>>>> cb309faf669e441673e87bb18141b0bc74fda84f
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'set_failed', detail: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};