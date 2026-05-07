const { getStore } = require('@netlify/blobs');

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

  const { _token: token, tipo } = event.queryStringParameters || {};

  if (!token || !['hist', 'hoteis'].includes(tipo)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid params' }) };
  }

  const id = token.replace(/[^a-zA-Z0-9]/g, '').slice(-16) || 'default';
  const blobKey = `${tipo}_${id}`;

  let store;
  try {
    store = getStore('staysplit');
  } catch (e) {
    console.error('[storage] getStore failed:', e.message, e.stack);
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'store_init_failed', detail: e.message }) };
  }

  if (event.httpMethod === 'GET') {
    try {
      const data = await store.get(blobKey, { type: 'json' });
      return { statusCode: 200, headers, body: JSON.stringify(data != null ? data : null) };
    } catch (e) {
      console.error('[storage] GET failed — key:', blobKey, '| error:', e.message, e.stack);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'get_failed', detail: e.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || 'null');
      await store.setJSON(blobKey, body);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      console.error('[storage] POST failed — key:', blobKey, '| error:', e.message, e.stack);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'set_failed', detail: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};