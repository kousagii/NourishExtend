import React,{useState} from 'react';
import {Page,Card,Field,AppText,Button} from './ui';
import {supabase} from './backend';
import {useSession} from './session';
import {changePassword} from './passwords.cjs';
export default function PasswordScreen(){
 const {session}=useSession();const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function save(){setBusy(true);setError('');setNotice('');try{await changePassword(supabase.auth,session.user.email,current,next,confirm);setCurrent('');setNext('');setConfirm('');setNotice('Your password has been updated. Use your new password the next time you sign in.');}catch(e){setError(e.message||'Could not change your password.');}finally{setBusy(false);}}
 return <Page><AppText variant="title">Change password</AppText><Card>
  <Field label="Current password" secureTextEntry autoComplete="current-password" value={current} onChangeText={setCurrent} editable={!busy}/>
  <Field label="New password" secureTextEntry autoComplete="new-password" value={next} onChangeText={setNext} editable={!busy}/>
  <Field label="Confirm new password" secureTextEntry autoComplete="new-password" value={confirm} onChangeText={setConfirm} editable={!busy}/>
  <AppText variant="muted">Use at least 12 characters. Choose a password you do not use elsewhere.</AppText>
  {!!error&&<AppText accessibilityRole="alert">{error}</AppText>}{!!notice&&<AppText accessibilityLiveRegion="polite">{notice}</AppText>}
  <Button title="Save new password" busy={busy} disabled={!current||!next||!confirm} onPress={save}/>
 </Card></Page>;
}
