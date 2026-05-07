const https = require('https');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const params = event.queryStringParameters || {};
  const apiKey = params._token || '';
  const env = params._env || 'sandbox';

  const asaasPath = event.path.replace('/.netlify/functions/asaas', '') || '/';
  const qs = new URLSearchParams(params);
  qs.delete('_token');
  qs.delete('_env');
  const qsStr = qs.toString();

  const host = env === 'production' ? 'api.asaas.com' : 'sandbox.asaas.com';
  const targetPath = '/api/v3' + asaasPath + (qsStr ? '?' + qsStr : '');

  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port: 443,
      path: targetPath,
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey,
        'User-Agent': 'StaySplit/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers, body: body || '{}' });
      });
    });

    req.on('error', (e) => {
      resolve({
        statusCode: 500,
        headers,
        body: JSON.stringify({ errors: [{ code: 'proxy_error', description: e.message }] })
      });
    });

    if (event.body) req.write(event.body);
    req.end();
  });
};