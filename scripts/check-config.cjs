const fs=require('node:fs');
const path=require('node:path');
// Read only the explicitly public fields, never print values or parse arbitrary JS.
const values={...process.env};
for(const filename of ['.env','.env.local','.env.development','.env.development.local','.env.production','.env.production.local']){
  const envFile=path.resolve(__dirname,'..',filename);
  if(fs.existsSync(envFile)) for(const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)){
    const match=/^(EXPO_PUBLIC_[A-Z_]+)=(.*)$/.exec(line.trim());
    if(!match)continue;
    const value=match[2].replace(/^['"]|['"]$/g,'');
    if(match[1]==='EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' && value){
      let role='';try{role=JSON.parse(Buffer.from(value.split('.')[1]||'','base64url').toString()).role;}catch{}
      if(!value.startsWith('sb_publishable_')&&role!=='anon')throw new Error('Refusing to build: a secret or invalid key is in a public configuration field.');
    }
    if(!values[match[1]])values[match[1]]=value;
  }
}
const key=values.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
if(key){
  let role='';try{role=JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString()).role;}catch{}
  if(!key.startsWith('sb_publishable_') && role!=='anon')throw new Error('Refusing to build: use a public Supabase publishable/anon key. Never embed secret or service-role keys.');
}
if(Boolean(values.EXPO_PUBLIC_SUPABASE_URL)!==Boolean(key))throw new Error('Set both Supabase URL and publishable key.');
if(!key)console.log('No backend configured: exporting the connection/setup screen. Rebuild after configuration for a functional deployment.');
