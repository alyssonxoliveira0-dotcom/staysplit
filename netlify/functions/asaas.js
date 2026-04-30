const https = require('https');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, access_token, x-env',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const asaasPath = event.path.replace('/.netlify/functions/asaas', '');
  const apiKey = event.headers['access_token'] || '';
  const env = event.headers['x-env'] || 'sandbox';
  const host = env === 'production' ? 'api.asaas.com' : 'sandbox.asaas.com';

  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port: 443,
      path: '/api/v3' + asaasPath,
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
        resolve({ statusCode: res.statusCode, headers, body });
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
