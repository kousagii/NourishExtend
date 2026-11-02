import React,{useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Card,AppText,Button} from './src/ui';
import {supabase,rpc,query} from './src/backend';
import {useRemote,dateLabel} from './src/data';
import {RemoteState} from './src/DonationScreens';
export default function NotificationsScreen({navigation}){
  const state=useRemote(()=>query(supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(50)),[]);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  useFocusEffect(React.useCallback(()=>{state.refresh();},[state.refresh]));
  async function read(){setBusy(true);setError('');try{await rpc('mark_notifications_read');await state.refresh();}catch{setError('Could not mark updates as read.');}finally{setBusy(false);}}
  return <Page><AppText variant="title">Your updates</AppText><RemoteState {...state} retry={state.refresh}/>
    {!!state.data?.some(item=>!item.read_at)&&<Button title="Mark all as read" busy={busy} onPress={read}/>}
    {!state.loading&&!state.error&&!state.data?.length&&<Card><AppText>No updates yet.</AppText><AppText variant="muted">New reservation and pickup updates will appear here.</AppText></Card>}
    {state.data?.map(item=><Card key={item.id}><AppText variant="muted">{item.read_at?'Read':'New'} · {dateLabel(item.created_at)}</AppText><AppText>{item.body}</AppText>{item.donation_id&&<Button title="View activity" secondary onPress={()=>navigation.navigate('Activity')}/>}</Card>)}
    {!!error&&<AppText accessibilityRole="alert">{error}</AppText>}
  </Page>;
}

