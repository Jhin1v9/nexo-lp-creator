async function pushCashEntry(entry) {
  if (
    !entry ||
    (!entry.externalId && !entry.paymentId) ||
    entry.totalAmount?.value == null ||
    !entry.totalAmount?.currency
  ) {
    throw new Error('Missing required payment fields: externalId/paymentId, totalAmount.value, totalAmount.currency');
  }

  const baseUrl = process.env.NEXO_DASHBOARD_URL || 'http://localhost:3456';
  const endpoint = `${baseUrl}/api/payments`;

  if (!process.env.NEXO_DASHBOARD_FINANCE_TOKEN) {
    console.warn('[NexoDashboardFinance] NEXO_DASHBOARD_FINANCE_TOKEN not set; attempting request without Bearer token');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(entry.externalId || entry.paymentId
          ? { 'Idempotency-Key': entry.externalId || entry.paymentId }
          : {}),
        ...(process.env.NEXO_DASHBOARD_FINANCE_TOKEN
          ? { Authorization: `Bearer ${process.env.NEXO_DASHBOARD_FINANCE_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(entry),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[NexoDashboardFinance] HTTP error response:', body);
      throw new Error(`NEXO Dashboard returned ${response.status}: ${body}`);
    }

    return await response.json();
  } catch (err) {
    console.error('[NexoDashboardFinance] push failed:', err.message);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function recordTemplatePurchase(purchase, template) {
  const currencies = [
    { key: 'stars', amount: purchase.price_stars },
    { key: 'suns', amount: purchase.price_suns },
    { key: 'moons', amount: purchase.price_moons },
  ];

  const now = new Date().toISOString();

  const entries = currencies
    .filter(({ amount }) => amount > 0)
    .map(({ key: currency, amount }) => {
      const paymentId = `${purchase.id}-${currency}`;
      return {
        paymentId,
        id: paymentId,
        clientId: purchase.user_id,
        clientName: purchase.user_id,
        description: `Venda template ${template.name || template.id} - ${currency}`,
        totalAmount: { value: amount, currency },
        status: 'pending',
        methodAccepted: ['transfer', 'card', 'cash', 'bizum'],
        links: {
          source: 'nexo-lp',
          templateId: template.id,
          userId: purchase.user_id,
          purchaseId: purchase.id,
        },
        createdAt: now,
        updatedAt: now,
      };
    });

  if (entries.length === 0) {
    return [];
  }

  return Promise.all(entries.map((entry) => pushCashEntry(entry)));
}

module.exports = { pushCashEntry, recordTemplatePurchase };
