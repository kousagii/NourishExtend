import React,{useRef} from 'react';
import {View,Platform} from 'react-native';
import {AppText,Field,Button} from './ui';
import {useTheme} from './theme';
import {Icon} from './brand';
import Avatar from './Avatar';
import {chatDay,chatTime} from './conversations.cjs';

// Follow the latest loaded message without pulling a reader away from older ones.
export function useChatScroll({startAtBottom=true}={}){
 const scrollRef=useRef(null),atBottom=useRef(startAtBottom),last=useRef('');
 function onScroll({nativeEvent:e}){atBottom.current=e.contentSize.height-e.layoutMeasurement.height-e.contentOffset.y<100;}
 function contentChanged(messages){const key=messages?.at(-1)?.id||'';if(key!==last.current){last.current=key;if(atBottom.current)scrollRef.current?.scrollToEnd({animated:false});}}
 return {scrollRef,onScroll,contentChanged};
}
export function MessageComposer({value,onChange,onSend,busy,error}){
 const {colors}=useTheme();
 return <View style={{gap:6}}>{!!error&&<AppText accessibilityRole="alert" style={{color:colors.danger}}>{error}</AppText>}<View style={{flexDirection:'row',alignItems:'flex-end',gap:10}}>
  <View style={{flex:1}}><Field label="Message" placeholder="Write a message..." value={value} onChangeText={onChange} multiline maxLength={1500} style={{maxHeight:112}}/></View>
  <Button title="Send" accessibilityLabel="Send message" icon={<Icon name="send" color={colors.onPrimary}/>} busy={busy} disabled={!value.trim()} onPress={onSend}/>
 </View></View>;
}
export function MessageBubbles({messages,userId,member}){
 const {colors,uiScale}=useTheme();
 return <View style={{gap:8}}>{messages.map((message,index)=>{
  const own=message.sender_id===userId,previous=messages[index-1],day=chatDay(message.created_at);
  const first=!previous||chatDay(previous.created_at)!==day;
  const name=own?'You':member?.display_name||'Member unavailable';
  return <React.Fragment key={message.id}>
   {first&&<AppText variant="muted" style={{textAlign:'center',fontSize:14,marginVertical:8}}>{day}</AppText>}
   <View style={{flexDirection:'row',alignItems:'flex-end',justifyContent:own?'flex-end':'flex-start',gap:8}}>
    {!own&&<Avatar path={member?.avatar_path} name={name} size={36}/>}
    <View style={{maxWidth:own?'86%':'82%',gap:4}}>
     <View style={{paddingHorizontal:14*uiScale,paddingVertical:10*uiScale,borderRadius:18,borderBottomRightRadius:own?5:18,borderBottomLeftRadius:own?18:5,backgroundColor:own?colors.primary:colors.surface,borderWidth:own?0:1,borderColor:colors.border}}>
      {!own&&(!previous||previous.sender_id!==message.sender_id||first)&&<AppText style={{fontWeight:'600',fontSize:14,marginBottom:4}}>{name}</AppText>}
      <AppText selectable style={{color:own?colors.onPrimary:colors.text,...(Platform.OS==='web'?{overflowWrap:'anywhere'}:{})}}>{message.body}</AppText>
     </View>
     <AppText variant="muted" style={{fontSize:12,textAlign:own?'right':'left'}}>{own?'You - ':''}{chatTime(message.created_at)}</AppText>
    </View>
   </View>
  </React.Fragment>;
 })}</View>;
}
