const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
test('export guard refuses a server secret in a public client variable without printing it',()=>{
  const fake='sb_secret_TEST_ONLY_NEVER_A_REAL_KEY';
  const result=spawnSync(process.execPath,[path.join(__dirname,'../scripts/check-config.cjs')],{encoding:'utf8',env:{...process.env,EXPO_PUBLIC_SUPABASE_URL:'https://test-only.supabase.co',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:fake}});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Refusing to build/);
  assert.equal((result.stdout+result.stderr).includes(fake),false);
});
