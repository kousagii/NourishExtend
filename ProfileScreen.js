import React,{useState} from 'react';
import {Page,Card,AppText,Field,Button} from './src/ui';
import {useSession} from './src/session';
import {rpc} from './src/backend';
import {supabase} from './src/backend';
import * as ImagePicker from 'expo-image-picker';
import Avatar from './src/Avatar';
import {Select} from './src/controls';
export default function ProfileScreen({navigation}){
  const {profile,refreshProfile}=useSession();
  const [name,setName]=useState(profile.display_name),[type,setType]=useState(profile.account_type),[organisation,setOrganisation]=useState(profile.organisation_name),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [bio,setBio]=useState(profile.bio||''),[avatar,setAvatar]=useState(profile.avatar_path||null),[photo,setPhoto]=useState(null);
  async function choosePhoto(){setError('');try{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:0.7,base64:true,allowsEditing:true,aspect:[1,1]});if(!result.canceled&&result.assets?.[0]){if(!result.assets[0].base64||result.assets[0].base64.length>4194304)throw new Error('Choose a profile photo under 3 MB.');setPhoto(result.assets[0]);}}catch(e){setError(e.message||'Could not open your photos.');}}
  async function save(){
    setBusy(true);setError('');
    try{
      let path=avatar;
      if(photo){const {data,error:uploadError}=await supabase.functions.invoke('upload-avatar',{body:{imageBase64:photo.base64}});if(uploadError||!data?.path)throw new Error(data?.error||'Your photo could not be uploaded. Please try again.');path=data.path;}
      await rpc('save_profile_details',{p_name:name,p_type:type,p_organisation:organisation,p_bio:bio,p_avatar:path});await refreshProfile();navigation.navigate('Settings');
    }
    catch(err){setError(err.message||'Could not save your profile.');}finally{setBusy(false);}
  }
  return <Page><AppText variant="title">How your community sees you</AppText><Card>
    <Avatar path={avatar} uri={photo?.uri} name={name} size={104}/>
    <Button title="Choose profile photo" secondary disabled={busy} onPress={choosePhoto}/>
    {(avatar||photo)&&<Button title="Remove profile photo" secondary disabled={busy} onPress={()=>{setAvatar(null);setPhoto(null);}}/>}
    <Field label="Display name" value={name} onChangeText={setName} maxLength={80} autoComplete="name"/>
    <Field label="Short bio (optional)" value={bio} onChangeText={setBio} maxLength={240} multiline/>
    <AppText variant="muted">Your photo, display name and bio are visible to signed-in members. Avoid addresses or contact details. Display names can repeat.</AppText>
    <Select label="Account type" value={type} onChange={setType} options={[{value:'individual',label:'Individual'},{value:'organisation',label:'Organisation'}]}/>
    {type==='organisation'&&<><Field label="Organisation name" value={organisation} onChangeText={setOrganisation} maxLength={120}/><AppText variant="muted">Organisation accounts are unverified in this school pilot.</AppText></>}
    {!!error&&<AppText accessibilityRole="alert">{error}</AppText>}
    <Button title="Save changes" busy={busy} disabled={name.trim().length<2||(type==='organisation'&&organisation.trim().length<2)} onPress={save}/>
  </Card></Page>;
}

