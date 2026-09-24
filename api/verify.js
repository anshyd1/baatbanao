const crypto = require('crypto');

// Re-checks a Pro receipt issued by /api/redeem so a hand-edited localStorage flag is not enough.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ valid:false, error:'Method not allowed' });
  const secret = process.env.BB_REDEEM_SECRET;
  if (!secret || secret.length < 32) return res.status(503).json({ valid:false, error:'Activation is not configured' });
  const { phone='', plan='', receipt='' } = req.body || {};
  if (!/^\d{10}$/.test(phone) || !/^[a-z0-9_-]{1,24}$/i.test(plan) || !/^[A-Za-z0-9_-]{43}$/.test(receipt))
    return res.status(400).json({ valid:false, error:'Invalid input' });
  const wanted = crypto.createHmac('sha256', secret).update(`receipt:${phone}:${plan}`).digest('base64url');
  const valid = crypto.timingSafeEqual(Buffer.from(wanted), Buffer.from(receipt));
  return res.status(valid ? 200 : 401).json({ valid });
};
