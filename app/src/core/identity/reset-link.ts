export function resetTokenFromLink(value:string,expectedOrigin:string):string {
  try {
    const url=new URL(value),origin=new URL(expectedOrigin);
    const token=/^#token=([A-Za-z0-9_-]{43})$/.exec(url.hash)?.[1];
    if(value!==value.trim()||origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||
      url.protocol!=='https:'||url.origin!==origin.origin||url.username||url.password||url.pathname!=='/password-reset'||url.search||!token)
      throw new Error('invalid_reset_link');
    return token;
  } catch {throw new Error('invalid_reset_link');}
}