import React from 'react';
import {View,Pressable} from 'react-native';
import Avatar from './Avatar';
import {AppText} from './ui';
export default function ConversationMember({member,navigation}){
 const name=member?.display_name||'Member unavailable';
 return <Pressable accessibilityRole={member?.id?'button':undefined} accessibilityLabel={member?.id?'View profile: '+name:name} disabled={!member?.id} onPress={()=>navigation.navigate('Member',{id:member.id})} style={{minHeight:44,flexDirection:'row',alignItems:'center',gap:12}}>
  <Avatar path={member?.avatar_path} name={name} size={52}/><View style={{flex:1}}><AppText style={{fontWeight:'600'}}>{name}</AppText></View>
 </Pressable>;
}
