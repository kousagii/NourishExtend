const fs=require('node:fs');
const path=require('node:path');
const destination=path.resolve(__dirname,'../dist');
if(!fs.existsSync(path.join(destination,'index.html')))throw new Error('Run the Expo web export first.');
fs.mkdirSync(path.join(destination,'licenses'),{recursive:true});
for(const file of ['LICENSE','LICENSE_FONT'])fs.copyFileSync(path.resolve(__dirname,'../node_modules/@expo-google-fonts/libre-franklin',file),path.join(destination,'licenses','libre-franklin-'+file+'.txt'));
const headers=`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
`;
fs.writeFileSync(path.join(destination,'_headers'),headers);
fs.writeFileSync(path.join(destination,'_redirects'),'/* /index.html 200\n');
const html=path.join(destination,'index.html');
fs.writeFileSync(html,fs.readFileSync(html,'utf8').replace(/<title>.*?<\/title>/,'<title>NourishExtend</title>').replace('<head>','<head>\n    <script src="/theme-init.js"></script>'));
fs.copyFileSync(path.resolve(__dirname,'../public/theme-init.js'),path.join(destination,'theme-init.js'));
console.log('Added Cloudflare security headers, SPA fallback and Libre Franklin licences.');
