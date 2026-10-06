#!/usr/bin/env node
const crypto = require('crypto');
const [phone, plan='pro'] = process.argv.slice(2);
const secret = process.env.BB_REDEEM_SECRET;
if (!/^\d{10}$/.test(phone || '') || !secret || secret.length < 32) {
  console.error('Usage: BB_REDEEM_SECRET="32+ char secret" node tools/generate-redeem-code.js 9876543210 pro');
  process.exit(1);
}
console.log(crypto.createHmac('sha256', secret).update(`${phone}:${plan}`).digest('base64url').slice(0,10).toUpperCase());
