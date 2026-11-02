const fs=require('node:fs');
const readline=require('node:readline/promises');
const path=require('node:path');
const input=readline.createInterface({input:process.stdin,output:process.stdout});
(async()=>{
  const filename=path.resolve(__dirname,'../.env');
  if(fs.existsSync(filename))throw new Error('.env already exists. Edit it directly to preserve your configuration.');
  const url=(await input.question('Supabase Project URL (https://...supabase.co): ')).trim();
  const key=(await input.question('Publishable key (sb_publishable_..., never a secret key): ')).trim();
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw new Error('Use the HTTPS project URL from the Supabase Connect panel.');
  if(!/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key))throw new Error('Use the publishable key, not a secret or service-role key.');
  fs.writeFileSync(filename,'EXPO_PUBLIC_SUPABASE_URL='+url+'\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY='+key+'\nEXPO_PUBLIC_WEB_URL=http://localhost:8081\nEXPO_PUBLIC_PRIVACY_OPERATOR=NourishExtend student project team\nEXPO_PUBLIC_PRIVACY_EMAIL=nourishextend@gmail.com\n',{flag:'wx'});
  console.log('Saved public app configuration to .env. No secret credentials were requested. Restart Expo.');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>input.close());
