const crypto = require('crypto');

function expectedCode(phone, plan, secret) {
  return crypto.createHmac('sha256', secret)
    .update(`${phone}:${plan}`)
    .digest('base64url').slice(0, 10).toUpperCase();
}

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ valid:false, error:'Method not allowed' });
  const secret = process.env.BB_REDEEM_SECRET;
  if (!secret || secret.length < 32) return res.status(503).json({ valid:false, error:'Activation is not configured' });
  const { phone='', plan='', code='' } = req.body || {};
  if (!/^\d{10}$/.test(phone) || !/^[a-z0-9_-]{1,24}$/i.test(plan) || !/^[A-Z0-9_-]{10}$/.test(code))
    return res.status(400).json({ valid:false, error:'Invalid input' });
  const wanted = expectedCode(phone, plan, secret);
  const valid = crypto.timingSafeEqual(Buffer.from(wanted), Buffer.from(code));
  if (!valid) return res.status(401).json({ valid:false, error:'Invalid activation code' });
  const receipt = crypto.createHmac('sha256', secret).update(`receipt:${phone}:${plan}`).digest('base64url');
  return res.status(200).json({ valid:true, receipt });
};
