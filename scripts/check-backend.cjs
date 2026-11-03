const fs=require('node:fs');
const path=require('node:path');
const {createClient}=require('@supabase/supabase-js');
const env={...process.env};
const filename=path.resolve(__dirname,'../.env');
if(fs.existsSync(filename))for(const line of fs.readFileSync(filename,'utf8').split(/\r?\n/)){
  const i=line.indexOf('=');if(i>0&&line.startsWith('EXPO_PUBLIC_'))env[line.slice(0,i)]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,'');
}
(async()=>{
  const url=env.EXPO_PUBLIC_SUPABASE_URL,key=env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new Error('Configure the public Supabase URL/key first.');
  const health=await fetch(url+'/auth/v1/health',{headers:{apikey:key}});
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await client.from('donations').select('id').limit(1);
  const newTableChecks=Object.fromEntries(await Promise.all(['locations','inquiries','inquiry_messages','community_comments','community_likes'].map(async table=>{
    const {error,status}=await client.from(table).select('*').limit(1);
    return [table,{status,code:error?.code||null,anonymousReadDenied:error?.code==='42501'}];
  })));
  const rpcChecks=Object.fromEntries(await Promise.all([['community_post_activity',{p_posts:[]}],['set_post_like',{p_post:'00000000-0000-4000-8000-000000000000',p_liked:true}]].map(async ([name,params])=>{const {error,status}=await client.rpc(name,params);return [name,{status,code:error?.code||null,anonymousExecuteDenied:error?.code==='42501'}];})));
  const functionChecks={};
  for(const name of ['upload-photo','upload-avatar','delete-account','maintenance']){
    const response=await fetch(url+'/functions/v1/'+name,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)});
    const body=await response.text();
    const expected=['upload-photo','upload-avatar'].includes(name)?'Sign in with a verified email.':name==='delete-account'?'Sign in again.':'Unauthorized';
    functionChecks[name]={status:response.status,unauthenticatedRequestRejected:response.status===401&&body.includes(expected)};
  }
  console.log(JSON.stringify({authHealthStatus:health.status,databaseCode:error?.code||null,anonymousReadDenied:error?.code==='42501',migrationRequired:error?.code==='PGRST205',newTableChecks,rpcChecks,functionChecks}));
})().catch(()=>{console.error('Backend connection check failed. Check the URL/key and network. Configuration values were not logged.');process.exitCode=1;});
