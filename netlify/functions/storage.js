const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const token = event.queryStringParameters?._token || '';
  const tipo = event.queryStringParameters?.tipo || '';

  if (!token || !['hist', 'hoteis'].includes(tipo)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid params' })
    };
  }

  const id = token.replace(/[^a-zA-Z0-9]/g, '').slice(-16) || 'default';
  const blobKey = `${tipo}_${id}`;
  const store = getStore('staysplit');

  if (event.httpMethod === 'GET') {
    try {
      const data = await store.get(blobKey, { type: 'json' });
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(data ?? null)
      };
    } catch {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(null) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      await store.setJSON(blobKey, body);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: String(err) })
      };
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};