import React, {useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Card,AppText,Field,Button} from './ui';
import {supabase,rpc,query} from './backend';
import {useSession} from './session';
import {useRemote,dateLabel} from './data';
import {RemoteState} from './DonationScreens';
import {View} from 'react-native';
import {LocationSelect,Select,locationLabel} from './controls';
import {Icon} from './brand';

export function CommunityScreen({navigation}) {
  const {session}=useSession();
  const [page,setPage]=useState(0);
  const [areas,setAreas]=useState([]),[filterAreas,setFilterAreas]=useState([]),[showFilters,setShowFilters]=useState(false);
  const state=useRemote(()=>{let request=supabase.from('community_posts').select('*,profiles(display_name,account_type,organisation_name,verified)').order('created_at',{ascending:false}).order('id').range(page*20,page*20+19);if(filterAreas.length)request=request.overlaps('location_codes',filterAreas);return query(request);},[page,filterAreas]);
  useFocusEffect(React.useCallback(()=>{state.refresh();},[state.refresh]));
  return <Page>
    <AppText variant="title">A community that cares</AppText>
    <AppText variant="muted">Ask for what is needed. Share what is happening nearby.</AppText>
    <Button title="Write a community post" onPress={()=>navigation.navigate('WritePost')}/>
    <Button title={showFilters?'Hide area filters':'Find posts in your area'} secondary onPress={()=>setShowFilters(!showFilters)}/>
    {showFilters&&<Card><LocationSelect label="Cities and municipalities" value={areas} onChange={setAreas} multiple/><Button title="Apply areas" onPress={()=>{setPage(0);setFilterAreas(areas);}}/><AppText variant="muted">Areas help you find posts. All signed-in members can still read them.</AppText></Card>}
    <RemoteState {...state} retry={state.refresh}/>
    {!state.loading&&!state.error&&!state.data?.length&&<Card><AppText>No community posts yet.</AppText><AppText variant="muted">Start with a local food request or an update.</AppText></Card>}
    {!state.loading&&!state.error&&state.data?.map(post=><Card key={post.id}>
      <View style={{flexDirection:'row',gap:10,alignItems:'center'}}><Icon name="community"/><AppText variant="muted">{post.kind==='request'?'Food request':'Community update'}</AppText></View>
      <AppText variant="muted">{post.location_codes?.length?post.location_codes.map(locationLabel).join(' · '):post.area}</AppText>
      <AppText variant="heading">{post.title}</AppText><AppText numberOfLines={3}>{post.body}</AppText>
      <Button title="Read post" secondary accessibilityLabel={'Read '+post.title} onPress={()=>navigation.navigate('CommunityPost',{id:post.id})}/>
      <AppText variant="muted">{post.profiles?.display_name || 'Member'}{post.profiles?.account_type==='organisation'?' · '+post.profiles.organisation_name+' (unverified organisation)':''} · {dateLabel(post.created_at)}</AppText>
      {post.author_id!==session.user.id&&<Button title="Report or block" secondary onPress={()=>navigation.navigate('Report',{type:'post',id:post.id,userId:post.author_id})}/>}
    </Card>)}
    {page>0&&<Button title="Previous page" secondary onPress={()=>setPage(page-1)}/>}
    {state.data?.length===20&&<Button title="Next page" secondary onPress={()=>setPage(page+1)}/>}
  </Page>;
}
export function CommunityPostScreen({route,navigation}) {
  const {session}=useSession();
  const state=useRemote(()=>query(supabase.from('community_posts').select('*,profiles(display_name,account_type,organisation_name,verified)').eq('id',route.params.id).maybeSingle()),[route.params.id]);
  const post=state.data;
  return <Page><RemoteState {...state} retry={state.refresh}/>
    {!state.loading&&!state.error&&!post&&<AppText>This post is no longer available.</AppText>}
    {!!post&&!state.loading&&<Card>
      <AppText variant="muted">{post.kind==='request'?'Food request':'Community update'}</AppText>
      <AppText variant="muted">{post.location_codes?.length?post.location_codes.map(locationLabel).join(' · '):post.area}</AppText>
      <AppText variant="title">{post.title}</AppText>
      <AppText variant="muted">{post.profiles?.display_name||'Member'} · {dateLabel(post.created_at)}</AppText>
      <AppText>{post.body}</AppText>
      {post.author_id!==session.user.id&&<Button title="Report or block" secondary onPress={()=>navigation.navigate('Report',{type:'post',id:post.id,userId:post.author_id})}/>}
    </Card>}
  </Page>;
}
export function WritePostScreen({navigation}) {
  const [kind,setKind]=useState('request'),[title,setTitle]=useState(''),[body,setBody]=useState(''),[areas,setAreas]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function publish(){
    setBusy(true);setError('');
    try{await rpc('publish_located_post',{p_kind:kind,p_title:title,p_body:body,p_locations:areas});navigation.navigate('Community');}
    catch(err){setError(err.message||'Could not publish your post.');}finally{setBusy(false);}
  }
  return <Page><AppText variant="title">What would you like to share?</AppText><Card>
    <Select label="Post type" value={kind} onChange={setKind} options={[{value:'request',label:'Food request'},{value:'update',label:'Community update'}]}/>
    <Field label="Title" value={title} onChangeText={setTitle} maxLength={100}/>
    <LocationSelect label={kind==='request'?'Where is food needed?':'Areas covered'} value={areas} onChange={setAreas} multiple/>
    <Field label="Your post" value={body} onChangeText={setBody} maxLength={1500} multiline/>
    <AppText variant="muted">Other signed-in members can read this. Keep exact addresses, phone numbers and private details out of public posts.</AppText>
    {!!error&&<AppText accessibilityRole="alert">{error}</AppText>}
    <Button title="Publish post" busy={busy} disabled={title.trim().length<3||body.trim().length<3||!areas.length} onPress={publish}/>
  </Card></Page>;
}
export function ReportScreen({route,navigation}) {
  const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[confirmBlock,setConfirmBlock]=useState(false);
  async function report(){
    setBusy(true);setError('');setNotice('');
    try{await rpc('report_content',{p_type:route.params.type,p_target:route.params.id,p_reason:reason});setNotice('Report submitted for review by the student team.');setReason('');}
    catch(err){setError(err.message||'Report could not be submitted.');}finally{setBusy(false);}
  }
  async function block(){
    setBusy(true);setError('');
    try{await rpc('set_block',{p_user:route.params.userId,p_blocked:true});navigation.navigate('Home');}
    catch(err){setError(err.message||'Could not block this member.');}finally{setBusy(false);}
  }
  return <Page><AppText variant="title">Help keep this space welcoming</AppText><Card>
    <Field label="Reason for reporting" value={reason} onChangeText={setReason} multiline maxLength={1000}/>
    <AppText variant="muted">Reports are private to you and the student team. Reports are reviewed manually; this is not an emergency service.</AppText>
    <Button title="Submit report" busy={busy} disabled={reason.trim().length<5} onPress={report}/>
    {!!notice&&<AppText accessibilityLiveRegion="polite">{notice}</AppText>}
  </Card>
  {route.params.userId&&<Card><AppText variant="heading">Block this member</AppText><AppText>Hide their listings and posts and stop new messages between you. Existing reservations are not automatically cancelled; cancel them in Activity if needed.</AppText>
    {confirmBlock?<><Button title="Confirm block" busy={busy} onPress={block}/><Button title="Go back" secondary onPress={()=>setConfirmBlock(false)}/></>:<Button title="Block member" secondary onPress={()=>setConfirmBlock(true)}/>}
  </Card>}
  {!!error&&<AppText accessibilityRole="alert">{error}</AppText>}
  </Page>;
}

