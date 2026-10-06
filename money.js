/* Shared input/paise helpers. No storage access or historical-data migration. */
function bbRoundMoney(value){
  const n=Number(value);
  if(!Number.isFinite(n)) return NaN;
  // Decimal exponent shifting avoids 1.005 / 10.075 binary rounding surprises.
  const parts=String(Math.abs(n)).split('e');
  const shifted=Number(parts[0]+'e'+(Number(parts[1]||0)+2));
  const cents=Math.round(shifted);
  if(!Number.isSafeInteger(cents)) return NaN;
  return Math.sign(n)*Number(String(cents)+'e-2');
}
function bbValidMoney(value,allowZero=false){
  if(!['number','string'].includes(typeof value)) return false;
  if(value===null || value===undefined || String(value).trim()==='') return false;
  const n=Number(value),rounded=bbRoundMoney(n);
  return Number.isFinite(n) && (allowZero?n>=0:n>0) && Number.isFinite(rounded) && n===rounded;
}
