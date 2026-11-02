const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const port=Number(process.env.PORT||8081);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
http.createServer((request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
  let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400);response.end();return;}
  let filename=path.resolve(root,'.'+pathname);
  if(filename!==root&&!filename.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
  if(!fs.existsSync(filename)||fs.statSync(filename).isDirectory())filename=path.join(root,'index.html');
  if(!fs.existsSync(filename)){response.writeHead(503);response.end('Run npm run export:web first.');return;}
  const headers={'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'};
  const headerFile=path.join(root,'_headers');
  if(fs.existsSync(headerFile))for(const line of fs.readFileSync(headerFile,'utf8').split(/\r?\n/)){
    const match=/^\s+([^:]+):\s*(.+)$/.exec(line);if(match)headers[match[1]]=match[2];
  }
  response.writeHead(200,headers);
  if(request.method==='HEAD')response.end();else fs.createReadStream(filename).pipe(response);
}).listen(port,'127.0.0.1',()=>console.log('NourishExtend preview: http://127.0.0.1:'+port));
