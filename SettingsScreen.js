import React,{useState} from 'react';
import {Switch,View} from 'react-native';
import {Page,Card,AppText,Field,Button} from './src/ui';
import {useTheme} from './src/theme';
import {useSession} from './src/session';
import {supabase,rpc,query} from './src/backend';
import {useRemote} from './src/data';
export default function SettingsScreen({navigation}){
  const {preference,setAppearance,storageError,colors}=useTheme();
  const {profile,session,refreshProfile}=useSession();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[deleting,setDeleting]=useState(false),[password,setPassword]=useState('');
  const blocks=useRemote(()=>query(supabase.from('blocks').select('blocked_id')) ,[]);
  async function notifications(value){
    setBusy(true);setError('');
    try{await rpc('save_profile',{p_name:profile.display_name,p_type:profile.account_type,p_organisation:profile.organisation_name,p_notifications:value});await refreshProfile();}
    catch{setError('Could not save notification preferences.');}finally{setBusy(false);}
  }
  async function signout(){
    setBusy(true);setError('');
    try{const {error}=await supabase.auth.signOut({scope:'global'});if(error)throw error;}
    catch{setError('Sign-out failed. Check your connection and try again.');}finally{setBusy(false);}
  }
  async function remove(){
    setBusy(true);setError('');
    try{
      const {error:authError}=await supabase.auth.signInWithPassword({email:session.user.email,password});
      if(authError)throw new Error('Please check your current password.');
      const {data,error:deleteError}=await supabase.functions.invoke('delete-account',{body:{}});
      if(deleteError||!data?.deleted)throw new Error(data?.error||'Account deletion failed. Check that the delete-account function is deployed.');
      await supabase.auth.signOut({scope:'local'});
    }catch(err){setError(err.message||'Could not delete your account.');}finally{setPassword('');setBusy(false);}
  }
  return <Page><AppText variant="title">Make yourself at home</AppText>
    <Card><AppText variant="heading">{profile.display_name||'Your profile'}</AppText><AppText variant="muted">{profile.account_type==='organisation'?profile.organisation_name+' · Unverified organisation':'Individual member'}</AppText><Button title="Edit profile" secondary onPress={()=>navigation.navigate('ProfileScreen')}/></Card>
    <Card><AppText variant="heading">Appearance</AppText><AppText variant="muted">System follows your device. Your choice is saved on this device.</AppText>
      {['light','dark','system'].map(mode=><Button key={mode} title={mode[0].toUpperCase()+mode.slice(1)+(preference===mode?' · Selected':'')} secondary={preference!==mode} accessibilityState={{selected:preference===mode}} onPress={()=>setAppearance(mode)}/>)}
      {!!storageError&&<AppText accessibilityRole="alert">{storageError}</AppText>}
    </Card>
    <Card><AppText variant="heading">In-app updates</AppText><AppText variant="muted">Receive reservation and pickup updates inside NourishExtend. Device push notifications are outside this pilot.</AppText>
      <Switch accessibilityLabel="Receive in-app updates" value={profile.notifications_enabled} disabled={busy} onValueChange={notifications} trackColor={{false:colors.border,true:colors.primary}} thumbColor={colors.surface}/>
      <Button title="View notifications" secondary onPress={()=>navigation.navigate('Notifications')}/>
    </Card>
    <Card><AppText variant="heading">Blocked members</AppText>
      {blocks.loading&&<AppText>Loading…</AppText>}
      {!!blocks.error&&<><AppText>{blocks.error}</AppText><Button title="Try again" secondary onPress={blocks.refresh}/></>}
      {!blocks.loading&&!blocks.error&&!blocks.data?.length&&<AppText variant="muted">You have not blocked anyone.</AppText>}
      {blocks.data?.map((block,index)=><Button key={block.blocked_id} title={'Unblock member '+(index+1)} secondary disabled={busy} onPress={async()=>{setBusy(true);setError('');try{await rpc('set_block',{p_user:block.blocked_id,p_blocked:false});await blocks.refresh();}catch{setError('Could not unblock this member.');}finally{setBusy(false);}}}/>)}
    </Card>
    <Card><Button title="Privacy and data use" secondary onPress={()=>navigation.navigate('Privacy')}/><Button title="Sign out on all devices" secondary busy={busy&&!deleting} onPress={signout}/></Card>
    <Card><AppText variant="heading">Delete your account</AppText><AppText variant="muted">Permanently remove your profile, donations, community posts, messages and photos. Associated exchange records will also be removed. This cannot be undone.</AppText>
      {!deleting?<Button title="Delete account…" secondary disabled={busy} onPress={()=>setDeleting(true)}/>:<>
        <Field label="Current password to confirm deletion" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"/>
        <Button title="Permanently delete my account" busy={busy} disabled={!password} onPress={remove}/>
        <Button title="Keep my account" secondary disabled={busy} onPress={()=>{setDeleting(false);setPassword('');}}/>
      </>}
    </Card>
    {!!error&&<AppText accessibilityRole="alert" style={{color:colors.danger}}>{error}</AppText>}
  </Page>;
}

