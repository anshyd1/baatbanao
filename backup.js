/* Local backup and restore. No file is uploaded. */
const BB_BACKUP_KEYS=['bb_khata','bb_history','bb_settings','bb_invoices_v1','bb_hisaab_v1'];
function bbExportBackup(){
  const data={app:'BaatBanao',version:1,exportedAt:new Date().toISOString(),data:{}};
  BB_BACKUP_KEYS.forEach(k=>{const raw=localStorage.getItem(k);if(raw!==null){try{data.data[k]=JSON.parse(raw)}catch(e){}}});
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`baatbanao-backup-${todayISO()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);try{localStorage.setItem('bb_last_backup',new Date().toISOString())}catch(e){}bbTrack('backup_export',{keys:Object.keys(data.data).length});showToast('Backup download ho gaya ✅');
}
function bbPickRestore(){const el=document.getElementById('bb-restore-file');if(el)el.click();}
async function bbRestoreBackup(input){
  const file=input.files&&input.files[0];input.value='';if(!file)return;
  try{const parsed=JSON.parse(await file.text());if(parsed.app!=='BaatBanao'||parsed.version!==1||!parsed.data||typeof parsed.data!=='object')throw new Error('format');
    const keys=Object.keys(parsed.data).filter(k=>BB_BACKUP_KEYS.includes(k));if(!keys.length)throw new Error('empty');
    if(!confirm(`Backup se ${keys.length} data sections restore honge. Current data replace karna hai?`))return;
    keys.forEach(k=>localStorage.setItem(k,JSON.stringify(parsed.data[k])));localStorage.setItem('bb_last_restore',new Date().toISOString());bbTrack('backup_restore',{keys:keys.length});alert('Restore successful. App reload hogi.');location.reload();
  }catch(e){showToast('Invalid ya damaged backup file');}
}
