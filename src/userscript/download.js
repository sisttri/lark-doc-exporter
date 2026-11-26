export function downloadFile(view,blob,filename) {
  let url,link,event,scheduled=false;
  const observe=received=>{event=received;};
  const revoke=()=>{try {view.URL.revokeObjectURL(url);} catch {}};
  try {
    url=view.URL.createObjectURL(blob);
    link=view.document.createElement('a');
    link.href=url;link.download=filename;
    link.addEventListener('click',observe,{once:true});
    view.document.body.append(link);
    link.click();
    if(!event || event.defaultPrevented) {
      throw Object.assign(new Error('页面取消或阻止了下载，请检查文档权限或浏览器下载设置后重试。'),{code:'download_blocked'});
    }
    // This confirms a click handoff, not completion of the native save dialog.
    view.setTimeout(revoke,60000);
    scheduled=true;
  } finally {
    try {link?.removeEventListener('click',observe);} catch {}
    try {link?.remove();} catch {}
    if(url && !scheduled) revoke();
  }
}
