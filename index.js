// Cloudflare Worker — Telebirr receipt proxy
// Deploy at: https://workers.cloudflare.com (free tier: 100k req/day)
// Set your secret in Worker environment variables: PROXY_SECRET=your_secret_here

const SECRET = 'bingo_proxy_2025'; // or use env variable

export default {
  async fetch(request, env) {
    const secret = env.PROXY_SECRET || SECRET;
    const url    = new URL(request.url);
    const ref    = (url.searchParams.get('ref') || '').replace(/[^A-Za-z0-9]/g, '');
    const key    = url.searchParams.get('secret') || '';

    if (key !== secret)  return json({ error: 'Forbidden' }, 403);
    if (ref === '')      return json({ error: 'Missing ref' }, 422);

    const receiptUrl = `https://transactioninfo.ethiotelecom.et/receipt/${ref}`;

    let resp;
    try {
      resp = await fetch(receiptUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'follow',
      });
    } catch (e) {
      return json({ error: 'Fetch failed: ' + e.message }, 502);
    }

    if (resp.status === 404) return json({ status: 'not_found' });
    if (!resp.ok)            return json({ error: 'HTTP ' + resp.status }, 502);

    const html = await resp.text();

    // Strip tags and collapse whitespace
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Extract amount
    let amount = null;
    let m;
    if ((m = text.match(/Settled Amount\s+\S+\s+[\d\-]+\s+[\d:]+\s+([\d.,]+)\s*Birr/i)))
      amount = parseFloat(m[1].replace(/,/g, ''));
    else if ((m = text.match(/Total Paid Amount\s*([\d.,]+)\s*Birr/i)))
      amount = parseFloat(m[1].replace(/,/g, ''));

    // Extract payer name
    let payerName = null;
    if ((m = text.match(/Payer Name\s*(.*?)\s*Payer telebirr no\./i)))
      payerName = m[1].trim();

    // Extract credited account
    let creditedAccount = null;
    if ((m = text.match(/Credited party account no\s*(.*?)\s*transaction status/i)))
      creditedAccount = m[1].trim();

    if (amount === null && payerName === null)
      return json({ status: 'not_found' });

    return json({
      status:           'verified',
      amount:           amount,
      payer_name:       payerName,
      credited_account: creditedAccount,
    });
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
