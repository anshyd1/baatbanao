/* Metadata lookup is optional. Pinned download links remain usable on failure. */
(function(){
  'use strict';
  const fallback='Latest release check unavailable. Showing pinned v0.4.4 links; all releases are linked below.';
  const status=document.getElementById('status-toast');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  const names={arm64:'app-arm64-v8a-release.apk',armv7:'app-armeabi-v7a-release.apk',x64:'app-x86_64-release.apk'};
  status.textContent='Checking for a newer release… Pinned v0.4.4 downloads are available now.';
  fetch('https://api.github.com/repos/anshyd1/baatbanao/releases/latest',{headers:{Accept:'application/vnd.github+json'},signal:controller.signal})
    .then(r=>{if(!r.ok)throw new Error('metadata-unavailable');return r.json();})
    .then(release=>{
      if(release.draft||release.prerelease||!/^vault-v\d+\.\d+\.\d+$/.test(release.tag_name||''))throw new Error('not-stable-vault');
      const files={};
      for(const asset of release.assets||[])files[asset.name]=asset.browser_download_url;
      // Never label a mixed set of fallback/new-version builds as one release.
      for(const name of Object.values(names)){
        const expected='https://github.com/anshyd1/baatbanao/releases/download/'+release.tag_name+'/'+name;
        if(files[name]!==expected)throw new Error('incomplete-release');
      }
      for(const [id,name] of Object.entries(names))document.getElementById(id).href=files[name];
      const version=release.tag_name.replace(/^vault-/,'');
      document.getElementById('version-pill').textContent='Vault '+version+' · Latest stable release metadata';
      document.getElementById('release-version').textContent=version+' (latest stable metadata)';
      status.textContent='Release details loaded from GitHub. Select your Android build; installation compatibility depends on your device.';
    })
    .catch(()=>{status.textContent=fallback;})
    .finally(()=>clearTimeout(timeout));
})();
