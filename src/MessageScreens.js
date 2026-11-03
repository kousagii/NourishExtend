import React,{useState} from 'react';
import {View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Card,AppText,Field,Button} from './ui';
import {Icon} from './brand';
import {supabase,query,rpc} from './backend';
import {useSession} from './session';
import {useTheme} from './theme';
import {useRemote,dateLabel} from './data';
import {RemoteState} from './DonationScreens';
export function MessagesScreen({navigation}){
 const {session}=useSession();
 const state=useRemote(()=>query(supabase.from('inquiries').select('*,donor:profiles!inquiries_donor_id_fkey(display_name),inquirer:profiles!inquiries_inquirer_id_fkey(display_name)').order('last_message_at',{ascending:false}).limit(50)),[]);
 useFocusEffect(React.useCallback(()=>{state.refresh();const timer=setInterval(state.refresh,15000);return()=>clearInterval(timer);},[state.refresh]));
 return <Page><View style={{flexDirection:'row',alignItems:'center',gap:12}}><Icon name="messages" size={32}/><AppText variant="title">Food conversations</AppText></View><AppText variant="muted">Ask a question before you reserve. A conversation doesn’t hold the food.</AppText><Button title="Your reserved pickups and pickup messages" secondary onPress={()=>navigation.navigate('Activity')}/><RemoteState loading={state.loading&&!state.data} error={state.error} retry={state.refresh}/>
 {!state.loading&&!state.error&&!state.data?.length&&<Card><AppText variant="heading">Start with a hello</AppText><AppText variant="muted">Open a donation and tap Message donor to ask about the food.</AppText><Button title="Browse donations" onPress={()=>navigation.navigate('Home')}/></Card>}
 {state.data?.map(t=>{const own=t.donor_id===session.user.id;const read=own?t.donor_read_at:t.inquirer_read_at;const unread=!read||new Date(read)<new Date(t.last_message_at);return <Card key={t.id}><AppText variant="muted">{unread?'● New message':'Read'} · {own?'Your donation':'Your inquiry'}</AppText><AppText variant="heading">{t.donation_title}</AppText><AppText>With {(own?t.inquirer:t.donor)?.display_name||'Member'}</AppText><AppText variant="muted">{dateLabel(t.last_message_at)}</AppText><Button secondary title="Open conversation" accessibilityLabel={'Open conversation about '+t.donation_title} onPress={()=>navigation.navigate('Inquiry',{id:t.id})}/></Card>;})}
 {state.data?.length===50&&<AppText variant="muted">Showing your 50 most recently active conversations.</AppText>}
 </Page>;
}
export function InquiryScreen({route,navigation}){
 const {session}=useSession(),{colors}=useTheme();const [threadId,setThreadId]=useState(route.params.id||null);
 const [body,setBody]=useState(''),[busy,setBusy]=useState(false),[actionError,setActionError]=useState('');
 const state=useRemote(async()=>{
  let t=threadId?await query(supabase.from('inquiries').select('*').eq('id',threadId).maybeSingle()):null;
  if(!threadId&&route.params.donationId)t=await query(supabase.from('inquiries').select('*').eq('donation_id',route.params.donationId).eq('inquirer_id',session.user.id).maybeSingle());
  if(threadId&&!t)return null;
  const donationId=t?.donation_id||route.params.donationId;
  const [donation,messages,claims]=await Promise.all([
   query(supabase.from('donations').select('id,title,donor_id,status,pickup_deadline,area').eq('id',donationId).maybeSingle()),
   t?query(supabase.from('inquiry_messages').select('*').eq('inquiry_id',t.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100)):[],
   query(supabase.from('reservations').select('id,recipient_id').eq('donation_id',donationId).eq('status','reserved')),
  ]);
  // Only mark the newest messages that were actually loaded, never a later concurrent message.
  if(t)await rpc('read_inquiry',{p_inquiry:t.id,p_through:messages[0]?.created_at||t.last_message_at});
  return {thread:t,donation,messages:messages.reverse(),claim:claims.find(c=>c.recipient_id===session.user.id||donation?.donor_id===session.user.id)};
 },[threadId,route.params.donationId,session.user.id]);
 useFocusEffect(React.useCallback(()=>{state.refresh();const timer=setInterval(state.refresh,15000);return()=>clearInterval(timer);},[state.refresh]));
 const t=state.data?.thread,d=state.data?.donation;const available=d?.status==='available'&&new Date(d.pickup_deadline)>new Date();
 async function send(){setBusy(true);setActionError('');try{const id=await rpc('send_inquiry',{p_donation:t?.donation_id||route.params.donationId,p_body:body,p_inquiry:t?.id||null});setBody('');if(threadId!==id)setThreadId(id);else await state.refresh();}catch(e){setActionError(e.message||'Message could not be sent.');}finally{setBusy(false);}}
 return <Page><AppText variant="title">{t?.donation_title||d?.title||route.params.title||'Donation inquiry'}</AppText><RemoteState loading={state.loading&&!state.data} error={state.error} retry={state.refresh}/>
 {!!state.data&&<><Card><AppText variant="muted">Private conversation · {d?.area||'Listing unavailable'}</AppText><AppText>{available?'Ask about the food before reserving. Exact pickup instructions are shared only after reservation.':'This listing is unavailable for new inquiries. Existing messages remain here until removed under the retention policy.'}</AppText>{d&&<Button title="View donation" secondary onPress={()=>navigation.navigate('Donation',{id:d.id})}/>}<Button title="All messages" secondary onPress={()=>navigation.navigate('Messages')}/>{state.data.claim&&<Button title="Coordinate your reserved pickup" onPress={()=>navigation.navigate('Pickup',{id:state.data.claim.id})}/>}</Card>
 {!state.data.messages.length&&<AppText variant="muted">No messages yet. Keep your address and contact details out of pre-reservation inquiries.</AppText>}
 {state.data.messages.map(m=><Card key={m.id} style={{borderLeftWidth:4,borderLeftColor:m.sender_id===session.user.id?colors.accent:colors.primary}}><AppText variant="muted">{m.sender_id===session.user.id?'You':'Other member'} · {dateLabel(m.created_at)}</AppText><AppText>{m.body}</AppText></Card>)}
 {state.data.messages.length===100&&<AppText variant="muted">Showing the latest 100 messages.</AppText>}
 {available&&<Card><Field label="Your message" value={body} onChangeText={setBody} multiline maxLength={1500}/><Button title="Send message" busy={busy} disabled={!body.trim()} onPress={send}/></Card>}
 {t&&<Button secondary title="Report or block this member" onPress={()=>navigation.navigate('Report',{type:'user',id:t.donor_id===session.user.id?t.inquirer_id:t.donor_id,userId:t.donor_id===session.user.id?t.inquirer_id:t.donor_id})}/>}</>}
 {!state.loading&&!state.error&&!state.data&&<AppText>This conversation is no longer available.</AppText>}
 {!!actionError&&<AppText accessibilityRole="alert" style={{color:colors.danger}}>{actionError}</AppText>}
 </Page>;
}
