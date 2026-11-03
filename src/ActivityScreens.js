import {PICKUP_SELECT} from './queries.cjs';
import React, { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Page, Card, AppText, Field, Button } from './ui';
import { useSession } from './session';
import { useTheme } from './theme';
import { supabase, rpc, query } from './backend';
import { useRemote, dateLabel } from './data';
import { RemoteState } from './DonationScreens';
import {View} from 'react-native';
import {Icon} from './brand';
import {Select} from './controls';
import ConversationMember from './ConversationMember';
import {pickupMember} from './conversations.cjs';
import {MessageBubbles,MessageComposer,useChatScroll} from './Chat';

export function ActivityScreen({navigation}) {
  const { session } = useSession();
  const state = useRemote(async () => {
    const [donations,claims] = await Promise.all([
      query(supabase.from('donations').select('*').eq('donor_id',session.user.id).order('created_at',{ascending:false}).limit(50)),
      query(supabase.from('reservations').select('*,donations(*)').order('created_at',{ascending:false}).limit(50)),
    ]);
    return {donations,claims};
  },[session.user.id]);
  useFocusEffect(React.useCallback(() => {state.refresh();},[state.refresh]));
  const [section,setSection]=useState('active');
  const matches = item => section==='completed'?item.status==='collected':section==='cancelled'?item.status==='cancelled':section==='expired'?item.status==='available'&&new Date(item.pickup_deadline)<=new Date():item.status==='reserved'||item.status==='available'&&new Date(item.pickup_deadline)>new Date();
  const claimMatches=r=>section==='active'?r.status==='reserved':section==='completed'?r.status==='collected':section==='cancelled'?r.status==='cancelled':false;
  return <Page>
    <AppText variant="title">Every share has a story</AppText>
    <Select label="Activity status" value={section} onChange={setSection} options={[{value:'active',label:'Current'},{value:'completed',label:'Completed'},{value:'cancelled',label:'Cancelled'},{value:'expired',label:'Expired listings'}]}/>
    <RemoteState {...state} retry={state.refresh}/>
    {!state.loading && !state.error && <>
      <AppText variant="heading">Pickups</AppText>
      {!state.data?.claims.filter(claimMatches).length && <Card><AppText variant="muted">No pickups in this section.</AppText></Card>}
      {state.data?.claims.filter(claimMatches).map(claim=><Card key={claim.id}>
        <AppText variant="heading">{claim.donations?.title || 'Donation'}</AppText>
        <AppText>{claim.status==='reserved'?'Awaiting collection':claim.status==='collected'?'✓ Completed':'Cancelled'}</AppText>
        <AppText variant="muted">{claim.donations?.area} · {dateLabel(claim.created_at)}</AppText>
        <Button title="View pickup" secondary onPress={()=>navigation.navigate('Pickup',{id:claim.id})}/>
      </Card>)}
      <AppText variant="heading">Your donations</AppText>
      {!state.data?.donations.filter(matches).length && <Card><AppText variant="muted">No donations in this section.</AppText></Card>}
      {state.data?.donations.filter(matches).map(item=><Card key={item.id}>
        <AppText variant="heading">{item.title}</AppText>
        <AppText>{item.status==='collected'?'✓ Completed':item.status==='cancelled'?'Cancelled':item.status==='available' && new Date(item.pickup_deadline)<=new Date()?'Expired':item.status==='reserved'?'Reserved':'Available'} · {item.quantity}</AppText>
        <Button title="View donation" secondary onPress={()=>navigation.navigate('Donation',{id:item.id})}/>
      </Card>)}
      <AppText variant="muted">Showing your latest 50 donations and pickups.</AppText>
    </>}
  </Page>;
}
export function PickupScreen({route,navigation}) {
  const {session}=useSession(), {colors}=useTheme();
  const state=useRemote(async()=>{
    const claim=await query(supabase.from('reservations').select(PICKUP_SELECT).eq('id',route.params.id).maybeSingle());
    if(!claim)return null;
    const [messages,details]=await Promise.all([
      query(supabase.from('messages').select('*').eq('reservation_id',claim.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100)),
      query(supabase.from('pickup_details').select('instructions').eq('donation_id',claim.donation_id).maybeSingle()),
    ]);
    if(messages[0])await rpc('read_pickup',{p_reservation:claim.id,p_through:messages[0].created_at});
    return {claim,member:pickupMember(claim,session.user.id),messages:messages.reverse(),details};
  },[route.params.id]);
  useFocusEffect(React.useCallback(()=>{
    state.refresh();
    const timer=setInterval(state.refresh,15000);
    return ()=>clearInterval(timer);
  },[state.refresh]));
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(''),[showDetails,setShowDetails]=useState(!!route.params.showDetails);const chat=useChatScroll({startAtBottom:!route.params.showDetails});
  async function act(name,params) {
    setBusy(true);setError('');
    try {await rpc(name,params);setMessage('');setConfirm('');await state.refresh();}
    catch(err){setError(err.message||'This action failed.');}
    finally{setBusy(false);}
  }
  useEffect(()=>{if(route.params.showDetails){setShowDetails(true);chat.scrollRef.current?.scrollTo({y:0,animated:false});}},[route.params.showDetails,route.params.id]);
  const claim=state.data?.claim, donation=claim?.donations;
  const donor=donation?.donor_id===session.user.id;
  const confirmed=donor?claim?.donor_confirmed:claim?.recipient_confirmed;
  return <Page scrollRef={chat.scrollRef} onScroll={chat.onScroll} onContentSizeChange={()=>chat.contentChanged(state.data?.messages)} footer={claim?.status==='reserved'?<MessageComposer value={message} onChange={setMessage} onSend={()=>act('send_message',{p_reservation:claim.id,p_body:message})} busy={busy} error={error}/>:null}>
    <AppText variant="title">{donation?.title||'Pickup conversation'}</AppText>
    <RemoteState loading={state.loading && !state.data} error={state.error} retry={state.refresh}/>
    {!state.loading && !state.error && !claim && <AppText>This pickup is unavailable.</AppText>}
    {!!claim && <>
      <Card>
        <ConversationMember member={state.data.member} navigation={navigation}/><Button title={showDetails?'Hide pickup details':'Pickup details and confirmation'} secondary icon={<Icon name="chevron"/>} accessibilityState={{expanded:showDetails}} onPress={()=>setShowDetails(!showDetails)}/>{showDetails&&<><AppText>{donation?.quantity} · {donation?.area}</AppText>
        <AppText variant="muted">Collect by {dateLabel(donation?.pickup_deadline)} · {claim.status}</AppText>
        {state.data.details && <><AppText variant="heading">Private pickup instructions</AppText><AppText>{state.data.details.instructions}</AppText></>}
        {claim.status==='reserved' && <>
          <AppText variant="muted">Only confirm after the food has been handed over. Both people must confirm to complete the exchange.</AppText>
          <AppText>You: {confirmed?'confirmed':'not yet confirmed'} · Other person: {(donor?claim.recipient_confirmed:claim.donor_confirmed)?'confirmed':'not yet confirmed'}</AppText>
          {!confirmed && <Button title="Confirm collection" disabled={busy} onPress={()=>setConfirm('complete')}/>}
          <Button title="Cancel reservation" secondary disabled={busy} onPress={()=>setConfirm('cancel')}/>
        </>}
        {!!confirm && <Card><AppText>{confirm==='complete'?'Has the food been handed over?':'Cancel this reservation? The food may become available again.'}</AppText>
          <Button title={confirm==='complete'?'Yes, confirm collection':'Yes, cancel reservation'} busy={busy} onPress={()=>act(confirm==='complete'?'confirm_collection':'cancel_reservation',{p_reservation:claim.id})}/>
          <Button title="Go back" secondary disabled={busy} onPress={()=>setConfirm('')}/>
        </Card>}
        <Button title="Report or block this member" secondary onPress={()=>navigation.navigate('Report',{type:'user',id:donor?claim.recipient_id:donation.donor_id,userId:donor?claim.recipient_id:donation.donor_id})}/>
      </>}
      </Card>
      <AppText variant="heading">Pickup messages</AppText>
      {!state.data.messages.length && <AppText variant="muted">No messages yet. Use this private conversation to coordinate pickup.</AppText>}
      <MessageBubbles messages={state.data.messages} userId={session.user.id} member={state.data.member}/>
      {state.data.messages.length===100 && <AppText variant="muted">Showing the latest 100 messages.</AppText>}
    </>}
    {!!error&&claim?.status!=='reserved' && <AppText accessibilityRole="alert" style={{color:colors.danger}}>{error}</AppText>}
  </Page>;
}

