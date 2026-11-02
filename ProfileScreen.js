import React,{useState} from 'react';
import {Page,Card,AppText,Field,Button} from './src/ui';
import {useSession} from './src/session';
import {rpc} from './src/backend';
export default function ProfileScreen({navigation}){
  const {profile,refreshProfile}=useSession();
  const [name,setName]=useState(profile.display_name),[type,setType]=useState(profile.account_type),[organisation,setOrganisation]=useState(profile.organisation_name),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function save(){
    setBusy(true);setError('');
    try{await rpc('save_profile',{p_name:name,p_type:type,p_organisation:organisation,p_notifications:profile.notifications_enabled});await refreshProfile();navigation.goBack();}
    catch(err){setError(err.message||'Could not save your profile.');}finally{setBusy(false);}
  }
  return <Page><AppText variant="title">How your community sees you</AppText><Card>
    <Field label="Display name" value={name} onChangeText={setName} maxLength={80} autoComplete="name"/>
    <AppText>Account type</AppText>
    <Button title="Individual" secondary={type!=='individual'} onPress={()=>setType('individual')}/>
    <Button title="Organisation" secondary={type!=='organisation'} onPress={()=>setType('organisation')}/>
    {type==='organisation'&&<><Field label="Organisation name" value={organisation} onChangeText={setOrganisation} maxLength={120}/><AppText variant="muted">Organisation accounts are unverified in this school pilot.</AppText></>}
    {!!error&&<AppText accessibilityRole="alert">{error}</AppText>}
    <Button title="Save changes" busy={busy} disabled={name.trim().length<2||(type==='organisation'&&organisation.trim().length<2)} onPress={save}/>
  </Card></Page>;
}

