const https = require('https');
const crypto = require('crypto');

const CF_ACCOUNT   = process.env.CF_ACCOUNT_ID;
const CF_NAMESPACE = process.env.CF_KV_NAMESPACE_ID;
const CF_TOKEN     = process.env.CF_KV_TOKEN;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const APP_URL      = process.env.APP_URL || 'https://staysplit.netlify.app';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function ok(data)         { return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data) }; }
function fail(code, msg)  { return { statusCode: code, headers: HEADERS, body: JSON.stringify({ error: msg }) }; }

// ─── Cloudflare KV ───────────────────────────────────────────────────────────

function kvReq(method, key, bodyStr) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('KV timeout')), 6000);
    const path = `/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CF_NAMESPACE}/values/${encodeURIComponent(key)}`;
    const opts = { hostname: 'api.cloudflare.com', port: 443, path, method,
      headers: { 'Authorization': `Bearer ${CF_TOKEN}` } };
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

async function kvGet(key) {
  const r = await kvReq('GET', key);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error('KV GET ' + r.status);
  try { return JSON.parse(r.body); } catch { return null; }
}

async function kvSet(key, val) {
  const r = await kvReq('PUT', key, JSON.stringify(val));
  if (r.status < 200 || r.status > 299) throw new Error('KV SET ' + r.status);
}

function kvDel(key) {
  return new Promise((resolve) => {
    const path = `/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CF_NAMESPACE}/values/${encodeURIComponent(key)}`;
    const req = https.request(
      { hostname: 'api.cloudflare.com', port: 443, path, method: 'DELETE',
        headers: { 'Authorization': `Bearer ${CF_TOKEN}` } },
      res => { res.resume(); res.on('end', resolve); }
    );
    req.on('error', resolve);
    req.end();
  });
}

// ─── Crypto ──────────────────────────────────────────────────────────────────

function hashPwd(password, salt) {
  if (!salt) salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPwd(password, hash, salt) {
  try {
    const { hash: computed } = hashPwd(password, salt);
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch { return false; }
}

function token() { return crypto.randomBytes(32).toString('hex'); }

// ─── E-mail via Resend ───────────────────────────────────────────────────────

function sendEmail(to, subject, html) {
  if (!RESEND_KEY) return Promise.resolve();
  return new Promise(resolve => {
    const body = JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html });
    const req = https.request(
      { hostname: 'api.resend.com', port: 443, path: '/emails', method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body) } },
      res => { res.resume(); res.on('end', resolve); }
    );
    req.on('error', resolve);
    req.write(body);
    req.end();
  });
}

function emailBrand(content) {
  return `<div style="font-family:'DM Sans',sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#F7F3EE;border-radius:16px">
    <div style="text-align:center;margin-bottom:24px">
      <span style="background:#C4622D;border-radius:10px;padding:8px 14px;font-size:18px">🏨</span>
      <h2 style="font-family:Georgia,serif;color:#2C2118;margin:12px 0 4px">StaySplit</h2>
    </div>
    ${content}
    <p style="font-size:11px;color:#8B7355;text-align:center;margin-top:24px">StaySplit · Reservas com comissionamento automático</p>
  </div>`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
  if (!CF_ACCOUNT || !CF_NAMESPACE || !CF_TOKEN) return fail(503, 'Armazenamento não configurado.');

  const action = (event.queryStringParameters || {}).action;
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  // ── REGISTER ──────────────────────────────────────────────────────────────
  if (action === 'register') {
    const { email, password } = body;
    if (!email || !password) return fail(400, 'E-mail e senha são obrigatórios.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, 'E-mail inválido.');
    if (password.length < 6) return fail(400, 'A senha deve ter pelo menos 6 caracteres.');

    const key = 'user:' + email.toLowerCase().trim();
    const existing = await kvGet(key).catch(() => null);
    if (existing) return fail(409, 'Este e-mail já está cadastrado.');

    const { hash, salt } = hashPwd(password);
    try {
      await kvSet(key, { email: email.toLowerCase().trim(), hash, salt, criadoEm: new Date().toISOString() });
    } catch (e) {
      return fail(500, 'Erro ao salvar conta. Verifique as variáveis CF_KV_* no Netlify.');
    }

    sendEmail(email, 'Bem-vindo ao StaySplit!', emailBrand(`
      <h3 style="color:#2C2118">Sua conta foi criada!</h3>
      <p style="color:#5C4A32">Olá! Sua conta StaySplit foi criada com sucesso para <strong>${email}</strong>.</p>
      <p style="color:#5C4A32">Acesse o painel e configure sua chave de API Asaas em <strong>Configurações</strong> para começar.</p>
      <div style="text-align:center;margin:20px 0">
        <a href="${APP_URL}" style="background:#C4622D;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Acessar StaySplit</a>
      </div>
    `)).catch(() => {});

    return ok({ ok: true });
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (action === 'login') {
    const { email, password } = body;
    if (!email || !password) return fail(400, 'E-mail e senha são obrigatórios.');

    const user = await kvGet('user:' + email.toLowerCase().trim()).catch(() => null);
    if (!user || !verifyPwd(password, user.hash, user.salt)) return fail(401, 'E-mail ou senha incorretos.');

    const tok = token();
    try {
      await kvSet('session:' + tok, { email: user.email, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    } catch (e) {
      return fail(500, 'Erro ao criar sessão. Tente novamente.');
    }

    const emailId = user.email.replace(/[^a-zA-Z0-9]/g, '').slice(-20);
    const config = await kvGet('config_' + emailId).catch(() => null);

    return ok({ token: tok, email: user.email, config: config || null });
  }

  // ── SESSION CHECK ─────────────────────────────────────────────────────────
  if (action === 'session') {
    const { token: tok } = body;
    if (!tok) return fail(401, 'Token ausente.');
    const session = await kvGet('session:' + tok).catch(() => null);
    if (!session || session.expiresAt < Date.now()) return fail(401, 'Sessão expirada.');
    return ok({ email: session.email });
  }

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  if (action === 'logout') {
    const { token: tok } = body;
    if (tok) kvDel('session:' + tok);
    return ok({ ok: true });
  }

  // ── FORGOT PASSWORD ───────────────────────────────────────────────────────
  if (action === 'forgot') {
    const { email } = body;
    if (!email) return fail(400, 'Informe o e-mail.');

    const user = await kvGet('user:' + email.toLowerCase().trim()).catch(() => null);
    if (!user) return ok({ ok: true });

    const tok = token();
    try {
      await kvSet('reset:' + tok, { email: user.email, expiresAt: Date.now() + 60 * 60 * 1000 });
    } catch (e) {
      return fail(500, 'Erro ao gerar link. Tente novamente.');
    }
    const resetUrl = `${APP_URL}?reset=${tok}`;

    sendEmail(email, 'Redefinir senha — StaySplit', emailBrand(`
      <h3 style="color:#2C2118">Redefinir sua senha</h3>
      <p style="color:#5C4A32">Recebemos uma solicitação para redefinir a senha da sua conta StaySplit.</p>
      <p style="color:#5C4A32">Clique no botão abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.</p>
      <div style="text-align:center;margin:20px 0">
        <a href="${resetUrl}" style="background:#C4622D;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Redefinir senha</a>
      </div>
      <p style="font-size:12px;color:#8B7355">Se você não solicitou isso, ignore este e-mail.</p>
      <p style="font-size:12px;color:#8B7355;word-break:break-all">Link direto: ${resetUrl}</p>
    `)).catch(() => {});

    return ok({ ok: true });
  }

  // ── RESET PASSWORD ────────────────────────────────────────────────────────
  if (action === 'reset') {
    const { token: tok, password } = body;
    if (!tok || !password) return fail(400, 'Dados incompletos.');
    if (password.length < 6) return fail(400, 'A senha deve ter pelo menos 6 caracteres.');

    const resetData = await kvGet('reset:' + tok).catch(() => null);
    if (!resetData || resetData.expiresAt < Date.now()) return fail(400, 'Link inválido ou expirado. Solicite um novo.');

    const user = await kvGet('user:' + resetData.email).catch(() => null);
    if (!user) return fail(400, 'Usuário não encontrado.');

    const { hash, salt } = hashPwd(password);
    user.hash = hash; user.salt = salt;
    try {
      await kvSet('user:' + resetData.email, user);
    } catch (e) {
      return fail(500, 'Erro ao salvar nova senha. Tente novamente.');
    }
    kvDel('reset:' + tok);

    return ok({ ok: true });
  }

  // ── CHANGE PASSWORD (com sessão ativa) ────────────────────────────────────
  if (action === 'change-password') {
    const { token: tok, password } = body;
    if (!tok || !password) return fail(400, 'Dados incompletos.');
    if (password.length < 6) return fail(400, 'A senha deve ter pelo menos 6 caracteres.');

    const session = await kvGet('session:' + tok).catch(() => null);
    if (!session || session.expiresAt < Date.now()) return fail(401, 'Sessão inválida.');

    const user = await kvGet('user:' + session.email).catch(() => null);
    if (!user) return fail(400, 'Usuário não encontrado.');

    const { hash, salt } = hashPwd(password);
    user.hash = hash; user.salt = salt;
    try {
      await kvSet('user:' + session.email, user);
    } catch (e) {
      return fail(500, 'Erro ao salvar nova senha. Tente novamente.');
    }

    return ok({ ok: true });
  }

  return fail(400, 'Ação desconhecida.');
};