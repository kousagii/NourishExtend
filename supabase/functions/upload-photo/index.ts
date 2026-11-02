import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { processImage } from '../_shared/process-image.ts';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const bearer = req.headers.get('Authorization') || '';
    const token = bearer.replace(/^Bearer\s+/i, '');
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user?.email_confirmed_at) return respond({ error: 'Sign in with a verified email.' }, 401);
    const actor = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: bearer } } });
    const { error: limitError } = await actor.rpc('guard_action');
    if (limitError) return respond({ error: 'Too many requests. Try again later.' }, 429);
    // Enforce a streamed body limit before parsing JSON, including chunked requests.
    const reader = req.body?.getReader();
    if (!reader) return respond({ error: 'Missing photo.' }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length; if (size > 4300000) { await reader.cancel(); return respond({ error: 'Photo is too large.' }, 413); }
      chunks.push(value);
    }
    const raw = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length; }
    const { imageBase64 } = JSON.parse(new TextDecoder().decode(raw));
    if (typeof imageBase64 !== 'string') return respond({ error: 'Missing photo.' }, 400);
    const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    // Decode and re-encode: reject corrupt files and remove metadata (including EXIF GPS).
    const clean = await processImage(bytes);
    const path = `${user.id}/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await admin.storage.from('food-photos').upload(path, clean, { contentType: 'image/png', upsert: false });
    if (uploadError) return respond({ error: 'Photo could not be stored.' }, 503);
    return respond({ path });
  } catch { return respond({ error: 'Choose a valid JPEG or PNG under 3 MB, up to 4096 pixels and 12 megapixels.' }, 400); }
});
