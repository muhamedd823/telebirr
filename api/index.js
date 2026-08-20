const SECRET = 'bingo_proxy_2025';

export default async function handler(req, res) {
  const { ref = '', secret = '' } = req.query;

  if (secret !== SECRET)             return res.status(403).json({ error: 'Forbidden' });
  if (!ref || !/^[A-Za-z0-9]+$/.test(ref)) return res.status(422).json({ error: 'Missing ref' });

  try {
    const response = await fetch(`https://transactioninfo.ethiotelecom.et/receipt/${ref}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    });

    if (response.status === 404) return res.json({ status: 'not_found' });
    if (!response.ok)            return res.status(502).json({ error: 'HTTP ' + response.status });

    const html = await response.text();
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    let amount = null, m;
    if ((m = text.match(/Settled Amount\s+\S+\s+[\d\-]+\s+[\d:]+\s+([\d.,]+)\s*Birr/i)))
      amount = parseFloat(m[1].replace(/,/g, ''));
    else if ((m = text.match(/Total Paid Amount\s*([\d.,]+)\s*Birr/i)))
      amount = parseFloat(m[1].replace(/,/g, ''));

    let payerName = null;
    if ((m = text.match(/Payer Name\s*(.*?)\s*Payer telebirr no\./i)))
      payerName = m[1].trim();

    let creditedAccount = null;
    if ((m = text.match(/Credited party account no\s*(.*?)\s*transaction status/i)))
      creditedAccount = m[1].trim();

    if (amount === null && payerName === null)
      return res.json({ status: 'not_found' });

    return res.json({ status: 'verified', amount, payer_name: payerName, credited_account: creditedAccount });

  } catch (e) {
    return res.status(502).json({ error: 'Fetch failed: ' + e.message });
  }
}
