import React, { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Page, Card, AppText, Field, Button } from './ui';
import { useSession } from './session';
import { useTheme } from './theme';
import { supabase, rpc, query } from './backend';
import { useRemote, dateLabel } from './data';
import { RemoteState } from './DonationScreens';

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
  const active = item => item.status==='reserved'||item.status==='available';
  return <Page>
    <AppText variant="title">Every share has a story</AppText>
    <Button title={section==='active'?'Show completed / cancelled':'Show current activity'} secondary onPress={()=>setSection(section==='active'?'history':'active')}/>
    <RemoteState {...state} retry={state.refresh}/>
    {!state.loading && !state.error && <>
      <AppText variant="heading">Pickups</AppText>
      {!state.data?.claims.filter(r=>section==='active'?r.status==='reserved':r.status!=='reserved').length && <Card><AppText variant="muted">No {section==='active'?'current':'past'} pickups yet.</AppText></Card>}
      {state.data?.claims.filter(r=>section==='active'?r.status==='reserved':r.status!=='reserved').map(claim=><Card key={claim.id}>
        <AppText variant="heading">{claim.donations?.title || 'Donation'}</AppText>
        <AppText>{claim.status==='reserved'?'Awaiting collection':claim.status==='collected'?'Collected':'Cancelled'}</AppText>
        <AppText variant="muted">{claim.donations?.area} · {dateLabel(claim.created_at)}</AppText>
        <Button title="View pickup" secondary onPress={()=>navigation.navigate('Pickup',{id:claim.id})}/>
      </Card>)}
      <AppText variant="heading">Your donations</AppText>
      {!state.data?.donations.filter(d=>section==='active'?active(d):!active(d)).length && <Card><AppText variant="muted">No donations in this section.</AppText></Card>}
      {state.data?.donations.filter(d=>section==='active'?active(d):!active(d)).map(item=><Card key={item.id}>
        <AppText variant="heading">{item.title}</AppText>
        <AppText>{item.status==='available' && new Date(item.pickup_deadline)<new Date()?'Expired':item.status} · {item.quantity}</AppText>
        <Button title="View donation" secondary onPress={()=>navigation.navigate('Donation',{id:item.id})}/>
      </Card>)}
      <AppText variant="muted">Showing your latest 50 donations and pickups.</AppText>
    </>}
  </Page>;
}
export function PickupScreen({route,navigation}) {
  const {session}=useSession(), {colors}=useTheme();
  const state=useRemote(async()=>{
    const claim=await query(supabase.from('reservations').select('*,donations(*)').eq('id',route.params.id).maybeSingle());
    if(!claim)return null;
    const [messages,details]=await Promise.all([
      query(supabase.from('messages').select('*').eq('reservation_id',claim.id).order('created_at').limit(200)),
      query(supabase.from('pickup_details').select('instructions').eq('donation_id',claim.donation_id).maybeSingle()),
    ]);
    return {claim,messages,details};
  },[route.params.id]);
  useFocusEffect(React.useCallback(()=>{
    state.refresh();
    const timer=setInterval(state.refresh,15000);
    return ()=>clearInterval(timer);
  },[state.refresh]));
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState('');
  async function act(name,params) {
    setBusy(true);setError('');
    try {await rpc(name,params);setMessage('');setConfirm('');await state.refresh();}
    catch(err){setError(err.message||'This action failed.');}
    finally{setBusy(false);}
  }
  const claim=state.data?.claim, donation=claim?.donations;
  const donor=donation?.donor_id===session.user.id;
  const confirmed=donor?claim?.donor_confirmed:claim?.recipient_confirmed;
  return <Page>
    <AppText variant="title">Arrange a good handover</AppText>
    <RemoteState loading={state.loading && !state.data} error={state.error} retry={state.refresh}/>
    {!state.loading && !state.error && !claim && <AppText>This pickup is unavailable.</AppText>}
    {!!claim && <>
      <Card>
        <AppText variant="heading">{donation?.title}</AppText><AppText>{donation?.quantity} · {donation?.area}</AppText>
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
      </Card>
      <AppText variant="heading">Pickup messages</AppText>
      {!state.data.messages.length && <AppText variant="muted">No messages yet. Use this private conversation to coordinate pickup.</AppText>}
      {state.data.messages.map(item=><Card key={item.id}><AppText variant="muted">{item.sender_id===session.user.id?'You':'Other person'} · {dateLabel(item.created_at)}</AppText><AppText>{item.body}</AppText></Card>)}
      {state.data.messages.length===200 && <AppText variant="muted">Showing the first 200 messages.</AppText>}
      {claim.status==='reserved' && <Card>
        <Field label="Message" value={message} onChangeText={setMessage} multiline maxLength={1500}/>
        <Button title="Send message" busy={busy} disabled={!message.trim()} onPress={()=>act('send_message',{p_reservation:claim.id,p_body:message})}/>
      </Card>}
    </>}
    {!!error && <AppText accessibilityRole="alert" style={{color:colors.danger}}>{error}</AppText>}
  </Page>;
}

