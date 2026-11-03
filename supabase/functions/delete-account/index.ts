import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return new Response('{}', { status: 405, headers });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return new Response('{"error":"Sign in again."}', { status: 401, headers });
  // Require a fresh authenticated session for this destructive operation.
  const signedInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
  if (!signedInAt || Date.now() - signedInAt > 600000) return new Response('{"error":"Sign out and sign in again before deleting your account."}', { status: 403, headers });
  for(const bucket of ['food-photos','profile-photos'])while (true) {
    const { data, error: listError } = await admin.storage.from(bucket).list(user.id, { limit: 100 });
    if (listError) return new Response('{"error":"Could not remove your photos. Please retry."}', { status: 503, headers });
    if (!data?.length) break;
    const { error: removeError } = await admin.storage.from(bucket).remove(data.map(file => `${user.id}/${file.name}`));
    if (removeError) return new Response('{"error":"Could not remove your photos. Please retry."}', { status: 503, headers });
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  return new Response(JSON.stringify(deleteError ? { error: 'Account deletion failed. Please retry.' } : { deleted: true }), { status: deleteError ? 503 : 200, headers });
});
