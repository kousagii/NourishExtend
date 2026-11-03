import React,{useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Card,AppText,Button} from './src/ui';
import {supabase,rpc,query} from './src/backend';
import {useRemote,dateLabel} from './src/data';
import {RemoteState} from './src/DonationScreens';
import {View} from 'react-native';
import {Icon} from './src/brand';
import {useTheme} from './src/theme';
import {notificationDestination} from './src/notification-links.cjs';
export default function NotificationsScreen({navigation}){
  const {colors}=useTheme();
  const state=useRemote(()=>query(supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(50)),[]);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  useFocusEffect(React.useCallback(()=>{state.refresh();const timer=setInterval(state.refresh,5000);return()=>clearInterval(timer);},[state.refresh]));
  async function open(item){
    const target=notificationDestination(item);if(!target)return;
    setBusy(true);setError('');
    try{await rpc('mark_notification_read',{p_notification:item.id});navigation.navigate(target.screen,target.params);}
    catch{setError('Could not open this update. Check your connection and try again.');}finally{setBusy(false);}
  }
  async function read(){setBusy(true);setError('');try{await rpc('mark_notifications_read');await state.refresh();}catch{setError('Could not mark updates as read.');}finally{setBusy(false);}}
  return <Page><AppText variant="title">Notifications</AppText><RemoteState loading={state.loading&&!state.data} error={state.error} retry={state.refresh}/>
    {!!state.data?.some(item=>!item.read_at)&&<Button title="Mark all as read" busy={busy} onPress={read}/>}
    {!state.loading&&!state.error&&!state.data?.length&&<Card><AppText>No updates yet.</AppText><AppText variant="muted">New inquiries, reservations and pickup updates will appear here.</AppText></Card>}
    {state.data?.map(item=>{
      const target=notificationDestination(item),action=target?.screen==='Pickup'?'Open pickup':target?.screen==='Inquiry'?'Open conversation':target?.screen==='CommunityPost'?'Open community post':'Open donation';
      return <Card key={item.id} style={{borderLeftWidth:item.read_at?1:4,borderLeftColor:item.read_at?colors.border:colors.primary}}>
        <View style={{flexDirection:'row',gap:10,alignItems:'center'}}><Icon name={item.kind?.includes('message')?'messages':item.kind==='community_comment'?'community':'bell'}/><AppText variant="heading" style={{flex:1}}>{item.title||'Donation update'}</AppText></View>
        <AppText>{item.body}</AppText><AppText variant="muted">{item.read_at?'Read':'New'} · {dateLabel(item.created_at)}</AppText>
        {target?<Button title={action} secondary disabled={busy} accessibilityLabel={action+': '+(item.title||'Update')} onPress={()=>open(item)}/>:<AppText variant="muted">This is an information-only update.</AppText>}
      </Card>;
    })}
    {!!error&&<AppText accessibilityRole="alert">{error}</AppText>}
  </Page>;
}

