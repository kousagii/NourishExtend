import React,{useEffect,useState} from 'react';
import {View,Image} from 'react-native';
import {supabase} from './backend';
import {AppText} from './ui';
import {useTheme} from './theme';
export default function Avatar({path,name='',uri,size=72}){
 const {colors,uiScale=0.8}=useTheme();const [signed,setSigned]=useState(''),[failed,setFailed]=useState(false);const diameter=Math.max(32,Math.round(size*uiScale));
 useEffect(()=>{let active=true;setSigned('');setFailed(false);if(path&&!uri)supabase.storage.from('profile-photos').createSignedUrl(path,600).then(({data,error})=>{if(active){if(error)setFailed(true);else setSigned(data?.signedUrl||'');}});return()=>{active=false;};},[path,uri]);
 return <View style={{width:diameter,height:diameter,borderRadius:diameter/2,overflow:'hidden',backgroundColor:colors.background,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'}}>{(uri||signed)&&!failed?<Image source={{uri:uri||signed}} accessibilityLabel="Profile photo" onError={()=>setFailed(true)} style={{width:'100%',height:'100%'}}/>:<AppText accessibilityLabel={name?'Profile for '+name:'Profile'} style={{fontSize:Math.max(20,diameter/3),lineHeight:Math.max(26,diameter/2)}}>{name.trim().slice(0,1).toUpperCase()||'•'}</AppText>}</View>;
}
