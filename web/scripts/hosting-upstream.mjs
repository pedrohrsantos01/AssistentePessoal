// Private synthetic API for routing/error preservation, never a product backend.
import { createServer } from 'node:http';
createServer((req,res)=>{
  const status=(req.headers.cookie??'').length>8192?431:req.url==='/api/fixture/limited'?429:req.url==='/api/fixture/quarantine'?503:req.url==='/api/v1/health'?200:401;
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...(status===429?{'Retry-After':'60'}:{})});
  res.end(JSON.stringify({fixture:true,status,path:req.url,cookieBytes:(req.headers.cookie??'').length}));
}).listen(8080,'0.0.0.0');
