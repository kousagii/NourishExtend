import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
Deno.serve(async req => {
  const secret=Deno.env.get('MAINTENANCE_SECRET');
  if(req.method!=='POST'||!secret||req.headers.get('x-maintenance-secret')!==secret) return new Response('Unauthorized',{status:401});
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {error}=await admin.rpc('purge_retained_data');
  if(error)return new Response('Retention cleanup failed',{status:503});
  // Storage API deletion removes the bytes as well as their metadata. SQL-only deletion does not.
  for(let offset=0;;offset+=100){
    const {data:folders,error:listError}=await admin.storage.from('food-photos').list('',{limit:100,offset,sortBy:{column:'name',order:'asc'}});
    if(listError)return new Response('Photo cleanup failed',{status:503});
    if(!folders?.length)break;
    for(const folder of folders){
      for(let innerOffset=0;;){
        const {data:files,error:fileError}=await admin.storage.from('food-photos').list(folder.name,{limit:100,offset:innerOffset,sortBy:{column:'name',order:'asc'}});
        if(fileError)return new Response('Photo cleanup failed',{status:503});
        if(!files?.length)break;
        let removed=0;
        for(const file of files){
          const photoPath=folder.name+'/'+file.name;
          if(!file.created_at || Date.parse(file.created_at)>Date.now()-86400000)continue;
          const {data:links,error:linkError}=await admin.from('donations').select('id').eq('photo_path',photoPath).limit(1);
          if(linkError)return new Response('Photo cleanup failed',{status:503});
          if(!links?.length){const {error:removeError}=await admin.storage.from('food-photos').remove([photoPath]);if(removeError)return new Response('Photo cleanup failed',{status:503});removed++;}
        }
        innerOffset+=files.length-removed;
        if(files.length<100)break;
      }
    }
    if(folders.length<100)break;
  }
  return new Response('Retention cleanup completed');
});
