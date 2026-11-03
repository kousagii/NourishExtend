import {INQUIRY_SELECT,PICKUP_CONVERSATIONS_SELECT,DONATION_INQUIRY_SELECT} from './queries.cjs';
import React,{useState} from 'react';
import {View,Pressable} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Card,AppText,Field,Button} from './ui';
import {Icon} from './brand';
import {supabase,query,rpc} from './backend';
import {useSession} from './session';
import {useTheme} from './theme';
import {useRemote,dateLabel} from './data';
import {RemoteState} from './DonationScreens';
import ConversationMember from './ConversationMember';
import Avatar from './Avatar';
import {conversationList,inquiryMember} from './conversations.cjs';
import {MessageBubbles,MessageComposer,useChatScroll} from './Chat';
export function MessagesScreen({navigation}){
 const {session}=useSession();const {colors,uiScale}=useTheme();
 const state=useRemote(async()=>{
  const [inquiries,pickups]=await Promise.all([
   query(supabase.from('inquiries').select(INQUIRY_SELECT).order('last_message_at',{ascending:false}).limit(50)),
   query(supabase.from('reservations').select(PICKUP_CONVERSATIONS_SELECT).order('last_message_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(50)),
  ]);return {inquiries,pickups};
 },[]);
 useFocusEffect(React.useCallback(()=>{state.refresh();const timer=setInterval(state.refresh,15000);return()=>clearInterval(timer);},[state.refresh]));
 return <Page><View style={{flexDirection:'row',alignItems:'center',gap:12}}><Icon name="messages" size={32}/><AppText variant="title">Food conversations</AppText></View><AppText variant="muted">Ask a question before you reserve. A conversation doesn’t hold the food.</AppText><Button title="Your reserved pickups and pickup messages" secondary onPress={()=>navigation.navigate('Activity')}/><RemoteState loading={state.loading&&!state.data} error={state.error} retry={state.refresh}/>
 {!state.loading&&!state.error&&!state.data?.inquiries.length&&!state.data?.pickups.length&&<Card><AppText variant="heading">Start with a hello</AppText><AppText variant="muted">Open a donation and tap Message donor to ask about the food.</AppText><Button title="Browse donations" onPress={()=>navigation.navigate('Home')}/></Card>}
 {state.data&&conversationList(state.data,session.user.id).map(({key,type,thread:t,member,unread,timestamp})=><Pressable key={key} accessibilityRole="button" accessibilityLabel={'Open '+type+' with '+(member?.display_name||'member')+' about '+(t.donation_title||t.donations?.title||'food')+(unread?', new message':'')+(timestamp?', '+dateLabel(timestamp):'')} onPress={()=>navigation.navigate(type==='pickup'?'Pickup':'Inquiry',{id:t.id})} style={{minHeight:44,borderRadius:22*uiScale}}>
 {({pressed})=><Card style={{backgroundColor:pressed?colors.background:colors.surface,borderColor:pressed?colors.primary:colors.border}}>
  <View style={{flexDirection:'row',alignItems:'flex-start',gap:12}}>
   <View style={{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:10}}><Avatar path={member?.avatar_path} name={member?.display_name||'Member unavailable'} size={52}/><AppText style={{flex:1,fontWeight:'600'}}>{member?.display_name||'Member unavailable'}</AppText></View>
   {!!timestamp&&<AppText variant="muted" style={{maxWidth:'45%',fontSize:14,textAlign:'right'}}>{dateLabel(timestamp)}</AppText>}
  </View>
  <AppText variant="muted" style={unread?{fontWeight:'600'}:undefined}>{unread?'● New message · ':''}{type==='pickup'?'Pickup':'Inquiry'}{type==='pickup'?' - '+(t.status==='collected'?'Completed':t.status==='cancelled'?'Cancelled':'Reserved'):''}</AppText>
  <AppText variant="heading">{type==='pickup'?t.donations?.title||'Food donation':t.donation_title}</AppText>
 </Card>}
 </Pressable>)}
 {(state.data?.inquiries.length===50||state.data?.pickups.length===50)&&<AppText variant="muted">Newest conversations appear first. Showing up to 50 inquiries and 50 pickups.</AppText>}
 </Page>;
}
export function InquiryScreen({route,navigation}){
 const {session}=useSession(),{colors}=useTheme();const [threadId,setThreadId]=useState(route.params.id||null);
 const [body,setBody]=useState(''),[busy,setBusy]=useState(false),[actionError,setActionError]=useState(''),[showDetails,setShowDetails]=useState(false);const chat=useChatScroll();
 const state=useRemote(async()=>{
  let t=threadId?await query(supabase.from('inquiries').select(INQUIRY_SELECT).eq('id',threadId).maybeSingle()):null;
  if(!threadId&&route.params.donationId)t=await query(supabase.from('inquiries').select(INQUIRY_SELECT).eq('donation_id',route.params.donationId).eq('inquirer_id',session.user.id).maybeSingle());
  if(threadId&&!t)return null;
  const donationId=t?.donation_id||route.params.donationId;
  const [donation,messages,claims]=await Promise.all([
   query(supabase.from('donations').select(DONATION_INQUIRY_SELECT).eq('id',donationId).maybeSingle()),
   t?query(supabase.from('inquiry_messages').select('*').eq('inquiry_id',t.id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100)):[],
   query(supabase.from('reservations').select('id,recipient_id').eq('donation_id',donationId).eq('status','reserved')),
  ]);
  // Only mark the newest messages that were actually loaded, never a later concurrent message.
  if(t)await rpc('read_inquiry',{p_inquiry:t.id,p_through:messages[0]?.created_at||t.last_message_at});
  return {thread:t,member:t?inquiryMember(t,session.user.id):donation?.donor,donation,messages:messages.reverse(),claim:claims.find(c=>c.recipient_id===session.user.id||donation?.donor_id===session.user.id)};
 },[threadId,route.params.donationId,session.user.id]);
 useFocusEffect(React.useCallback(()=>{state.refresh();const timer=setInterval(state.refresh,15000);return()=>clearInterval(timer);},[state.refresh]));
 const t=state.data?.thread,d=state.data?.donation;const available=d?.status==='available'&&new Date(d.pickup_deadline)>new Date();
 async function send(){setBusy(true);setActionError('');try{const id=await rpc('send_inquiry',{p_donation:t?.donation_id||route.params.donationId,p_body:body,p_inquiry:t?.id||null});setBody('');if(threadId!==id)setThreadId(id);else await state.refresh();}catch(e){setActionError(e.message||'Message could not be sent.');}finally{setBusy(false);}}
 return <Page scrollRef={chat.scrollRef} onScroll={chat.onScroll} onContentSizeChange={()=>chat.contentChanged(state.data?.messages)} footer={state.data&&available?<MessageComposer value={body} onChange={setBody} onSend={send} busy={busy} error={actionError}/>:null}><AppText variant="title">{t?.donation_title||d?.title||route.params.title||'Donation inquiry'}</AppText><RemoteState loading={state.loading&&!state.data} error={state.error} retry={state.refresh}/>
 {!!state.data&&<><Card><ConversationMember member={state.data.member} navigation={navigation}/><Button title={showDetails?'Hide donation details':'Donation details'} icon={<Icon name="chevron"/>} secondary accessibilityState={{expanded:showDetails}} onPress={()=>setShowDetails(!showDetails)}/>{!available&&<AppText variant="muted">This listing is unavailable for new inquiries.</AppText>}{showDetails&&<><AppText variant="muted">Private conversation · {d?.area||'Listing unavailable'}</AppText><AppText>{available?'Ask about the food before reserving. Exact pickup instructions are shared only after reservation.':'This listing is unavailable for new inquiries. Existing messages remain here until removed under the retention policy.'}</AppText>{d&&<Button title="View donation" secondary onPress={()=>navigation.navigate('Donation',{id:d.id})}/>}<Button title="All messages" secondary onPress={()=>navigation.navigate('Messages')}/>{state.data.claim&&<Button title="Coordinate your reserved pickup" onPress={()=>navigation.navigate('Pickup',{id:state.data.claim.id})}/>}{t&&<Button secondary title="Report or block this member" onPress={()=>navigation.navigate('Report',{type:'user',id:t.donor_id===session.user.id?t.inquirer_id:t.donor_id,userId:t.donor_id===session.user.id?t.inquirer_id:t.donor_id})}/>}</>}</Card>
 {!state.data.messages.length&&<AppText variant="muted">No messages yet. Keep your address and contact details out of pre-reservation inquiries.</AppText>}
 <MessageBubbles messages={state.data.messages} userId={session.user.id} member={state.data.member}/>
 {state.data.messages.length===100&&<AppText variant="muted">Showing the latest 100 messages.</AppText>}
 </>}
 {!state.loading&&!state.error&&!state.data&&<AppText>This conversation is no longer available.</AppText>}
 {!!actionError&&!available&&<AppText accessibilityRole="alert" style={{color:colors.danger}}>{actionError}</AppText>}
 </Page>;
}
