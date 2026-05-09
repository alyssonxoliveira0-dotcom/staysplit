# HANDOFF.md — Estado Detalhado da Sessão

## Última Sessão
- **Data:** 2026-05-09
- **Branch ativa:** main
- **Último commit main:** `df304f787c4f2f7cb8e673c827209486a8c609ce`

---

## Histórico de Correções (sessão 2026-05-09)

### 1. Proteção contra duplo clique no botão "Gerar link de pagamento"
- **Problema:** Clicar rapidamente duas vezes criava duas cobranças no Asaas (duplicata de cobrança)
- **Causa raiz:** `gerarCobranca` é async — o segundo clique disparava a função antes do `await` da primeira execução bloquear o botão
- **Fix:** flag `cobrancaEmAndamento` (module-level boolean) definida como `true` **sincronicamente** antes do primeiro `await`, com `return` imediato se já `true`. Botão `btnGerar.disabled = true` aplicado junto.

### 2. Botão voltava a ficar ativo após ~5 segundos (bug crítico)
- **Problema:** Após gerar cobrança com sucesso, o botão se reabilitava sozinho após ~5s, permitindo nova cobrança sem clicar em "+ Nova cobrança"
- **Causa raiz (precisa):** `storageGet` usa `AbortController` com timeout de 5 segundos. Quando o KV demora ou falha, o `abort()` lança exceção que escapava para o `catch(e)` externo — que tinha `btnGerar.disabled = false`. Adicionalmente, se `localGet('hist')` retornasse dado não-array, `.unshift()` lançava `TypeError`, também escapando para o `catch` externo.
- **Fix:** Bloco de salvamento do histórico isolado em `try/catch` próprio (inner try-catch), com verificação `Array.isArray(rawHist)`. Qualquer exceção no histórico só loga no console — nunca chega ao `catch` externo que reabilita o botão.
- **Invariante mantida:** `btnGerar.disabled = false` ocorre APENAS em: (1) `catch(e)` externo — retry após erro de API; (2) `novaCobranca()` — nova cobrança explícita pelo usuário.

### Estado das funções críticas após a sessão

#### `gerarCobranca` — versão definitiva aplicada
```javascript
async function gerarCobranca() {
  const nome = document.getElementById('h-nome').value.trim();
  const cpf = document.getElementById('h-cpf').value.replace(/\D/g,'');
  const email = document.getElementById('h-email').value.trim();
  const fone = document.getElementById('h-fone').value.replace(/\D/g,'');
  const hotel = document.getElementById('r-hotel').value.trim();
  const quarto = document.getElementById('r-quarto').value.trim();
  const checkin = document.getElementById('r-checkin').value;
  const checkout = document.getElementById('r-checkout').value;
  const valor = parseFloat(document.getElementById('r-valor').value);
  const wallet = document.getElementById('r-wallet').value.trim();
  const pct = parseFloat(document.getElementById('r-comissao').value);
  const parcelas = parseInt(document.getElementById('r-parcelas').value) || 1;

  const errEl = document.getElementById('nova-error');
  const infoEl = document.getElementById('nova-info');
  errEl.classList.remove('show');
  infoEl.classList.remove('show');

  if (!nome) { mostrarAlerta(errEl,'Informe o nome do hóspede.'); return; }
  if (!cpf || cpf.length < 11) { mostrarAlerta(errEl,'CPF inválido — informe 11 dígitos.'); return; }
  if (email && !email.includes('@')) { mostrarAlerta(errEl,'E-mail inválido.'); return; }
  if (!hotel) { mostrarAlerta(errEl,'Informe o nome do hotel.'); return; }
  if (!checkin || !checkout) { mostrarAlerta(errEl,'Informe as datas.'); return; }
  if (!valor || valor < 10) { mostrarAlerta(errEl,'Valor mínimo R$ 10,00.'); return; }
  if (!wallet) { mostrarAlerta(errEl,'Informe o WalletId do parceiro.'); return; }
  if (!pct || pct <= 0 || pct >= 100) { mostrarAlerta(errEl,'Percentual inválido (1 a 99).'); return; }

  if (cobrancaEmAndamento) return;
  cobrancaEmAndamento = true;

  const loading = document.getElementById('loading-nova');
  const btnGerar = document.getElementById('btn-gerar');
  loading.classList.add('show');
  btnGerar.disabled = true;

  try {
    mostrarAlerta(infoEl, 'Criando cadastro do hóspede...');
    const clienteBody = { name: nome, cpfCnpj: cpf, notificationDisabled: true };
    if (email) clienteBody.email = email;
    if (fone && fone.length >= 10) clienteBody.mobilePhone = fone;
    const cliente = await asaasAPI('POST', '/customers', clienteBody);

    mostrarAlerta(infoEl, 'Gerando cobrança com split...');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const cobBody = {
      customer: cliente.id,
      billingType: pagamentoSelecionado,
      value: valor,
      dueDate: dueDateStr,
      description: `Reserva ${hotel}${quarto?' — '+quarto:''} | ${checkin} → ${checkout}`,
      splits: [{ walletId: wallet, percentualValue: pct }]
    };

    if (pagamentoSelecionado === 'CREDIT_CARD' && parcelas > 1) {
      cobBody.installmentCount = parcelas;
      cobBody.installmentValue = parseFloat((valor/parcelas).toFixed(2));
    }

    const cob = await asaasAPI('POST', '/lean/payments', cobBody);

    infoEl.classList.remove('show');
    loading.classList.remove('show');

    const invoiceUrl = cob.invoiceUrl || cob.bankSlipUrl || '';
    document.getElementById('result-url').textContent = invoiceUrl;
    document.getElementById('result-valor').textContent = fmt(valor);
    document.getElementById('result-tipo').textContent = labelPagamento(pagamentoSelecionado);
    document.getElementById('result-comissao').textContent = pct + '% → parceiro';
    document.getElementById('result-id').textContent = cob.id;
    document.getElementById('result-box').classList.add('show');

    const wfone = fone.replace(/\D/g,'');
    const msg = encodeURIComponent(`Olá! Segue o link para pagamento da sua reserva em *${hotel}*:\n\n${invoiceUrl}\n\nCheck-in: ${checkin} | Check-out: ${checkout}\nValor: ${fmt(valor)}`);
    document.getElementById('whatsapp-btn').href = `https://wa.me/55${wfone}?text=${msg}`;

    const novoItem = {
      id: cob.id, hotel, quarto, checkin, checkout,
      hospede: nome, valor, pct, wallet,
      tipo: pagamentoSelecionado, url: invoiceUrl,
      criadoEm: new Date().toLocaleString('pt-BR')
    };
    try {
      const rawHist = (await storageGet('hist', sessao.apiKey)) || localGet('hist', sessao.apiKey);
      const histAtual = Array.isArray(rawHist) ? rawHist : [];
      histAtual.unshift(novoItem);
      await storageSet('hist', histAtual.slice(0, 50));
    } catch(histErr) {
      console.error('Histórico:', histErr.message);
    }

    document.getElementById('result-box').scrollIntoView({ behavior: 'smooth' });
    cobrancaEmAndamento = false;

  } catch(e) {
    loading.classList.remove('show');
    btnGerar.disabled = false;
    cobrancaEmAndamento = false;
    infoEl.classList.remove('show');
    mostrarAlerta(errEl, 'Erro: ' + e.message);
  }
}