import React, {useRef,useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {Page,Card,AppText,Field,Button} from './ui';
import {supabase,rpc,query} from './backend';
import {useSession} from './session';
import {useRemote,dateLabel} from './data';
import {RemoteState} from './DonationScreens';
import {View,Pressable} from 'react-native';
import {useTheme} from './theme';
import Avatar from './Avatar';
import {PostAction,PostMenu} from './PostActions';
import {LocationSelect,Select,locationLabel} from './controls';
import {Icon} from './brand';

function usePostActivity(ids){
  const key=ids.join(',');
  return useRemote(()=>ids.length?rpc('community_post_activity',{p_posts:ids}):Promise.resolve([]),[key]);
}
function moderationOptions(navigation,{type,id,userId}){
  return [{title:'Report',icon:'report',onPress:()=>navigation.navigate('Report',{type,id,userId,action:'report'})},
    {title:'Block',icon:'block',onPress:()=>navigation.navigate('Report',{type,id,userId,action:'block'})}];
}
function PostHeader({post,navigation,userId}){
  const name=post.profiles?.display_name||'Member';
  return <View style={{flexDirection:'row',alignItems:'flex-start',gap:8}}>
    <Pressable accessibilityRole="button" accessibilityLabel={'View '+name+'’s profile'} onPress={()=>navigation.navigate('Member',{id:post.author_id})} style={{flex:1,minHeight:44,flexDirection:'row',alignItems:'center',gap:10}}>
      <Avatar path={post.profiles?.avatar_path} name={name} size={50}/><View style={{flex:1,gap:2}}><AppText style={{fontWeight:'600'}}>{name}</AppText><AppText variant="muted" style={{fontSize:14}}>{dateLabel(post.created_at)}</AppText>{post.profiles?.account_type==='organisation'&&<AppText variant="muted" style={{fontSize:14}}>{post.profiles.organisation_name||'Organisation'} · Unverified organisation</AppText>}</View>
    </Pressable>
    {post.author_id!==userId&&<PostMenu label={'Options for '+post.title} options={moderationOptions(navigation,{type:'post',id:post.id,userId:post.author_id})}/>}
  </View>;
}
function CommunityCard({post,navigation,userId,activity,activityState,full=false,onComment}){
  const {colors}=useTheme();const [busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false);
  async function like(){if(pending.current||!activity)return;pending.current=true;setBusy(true);setError('');
    try{await rpc('set_post_like',{p_post:post.id,p_liked:!activity.liked});await activityState.refresh();}
    catch(e){setError(e.message||'Could not save your like. Try again.');}finally{pending.current=false;setBusy(false);}
  }
  return <Card>
    <PostHeader post={post} navigation={navigation} userId={userId}/>
    <View style={{flexDirection:'row',alignItems:'center',gap:7}}><Icon name="community" size={19}/><AppText variant="muted" style={{fontSize:14}}>{post.kind==='request'?'Food request':'Community update'}</AppText></View>
    <Pressable disabled={full} accessibilityRole={full?undefined:"button"} accessibilityLabel={full?undefined:'Read full post: '+post.title} onPress={()=>navigation.navigate('CommunityPost',{id:post.id})} style={{minHeight:44,justifyContent:'center'}}><AppText variant="heading">{post.title}</AppText></Pressable><AppText numberOfLines={full?undefined:3}>{post.body}</AppText>
    {!full&&post.body.length>140&&<Pressable accessibilityRole="button" accessibilityLabel={'Read more of '+post.title} onPress={()=>navigation.navigate('CommunityPost',{id:post.id})} style={{minHeight:44,justifyContent:'center',alignSelf:'flex-start'}}><AppText style={{color:colors.primary,fontWeight:'600'}}>Read more</AppText></Pressable>}
    <View style={{flexDirection:'row',alignItems:'flex-start',gap:6}}><Icon name="pin" size={17}/><AppText variant="muted" style={{fontSize:14}}>{post.location_codes?.length?post.location_codes.map(locationLabel).join(' · '):post.area}</AppText></View>
    {!!activity&&<View style={{flexDirection:'row',justifyContent:'space-between',flexWrap:'wrap',gap:8}}><AppText variant="muted" style={{fontSize:14}}>{activity.like_count} {Number(activity.like_count)===1?'like':'likes'}</AppText><AppText variant="muted" style={{fontSize:14}}>{activity.comment_count} {Number(activity.comment_count)===1?'comment':'comments'}</AppText></View>}
    {activityState.loading&&!activity&&<AppText variant="muted" accessibilityLiveRegion="polite">Loading activity…</AppText>}
    {!!activityState.error&&<><AppText accessibilityRole="alert">Likes and comment counts could not be refreshed.</AppText><PostAction title="Retry activity" icon="activity" onPress={activityState.refresh}/></>}
    <View style={{borderTopWidth:1,borderColor:colors.border,paddingTop:4,flexDirection:'row',flexWrap:'wrap',gap:6}}>
      <PostAction title={activity?.liked?'Liked':'Like'} icon="like" selected={!!activity?.liked} busy={busy} disabled={!activity||activityState.loading||!!activityState.error} accessibilityLabel={(activity?.liked?'Unlike: ':'Like: ')+post.title} onPress={like}/>
      <PostAction title="Comment" icon="messages" accessibilityLabel={'Comment on '+post.title} onPress={onComment||(()=>navigation.navigate('CommunityPost',{id:post.id,focusComment:true}))}/>
    </View>
    {!!error&&<AppText accessibilityRole="alert">{error}</AppText>}
  </Card>;
}
export function CommunityScreen({navigation}) {
  const {session}=useSession();const {colors}=useTheme();
  const [page,setPage]=useState(0);
  const [areas,setAreas]=useState([]),[filterAreas,setFilterAreas]=useState([]),[showFilters,setShowFilters]=useState(false);
  const state=useRemote(()=>{let request=supabase.from('community_posts').select('*,profiles(display_name,avatar_path,account_type,organisation_name,verified)').order('created_at',{ascending:false}).order('id').range(page*20,page*20+19);if(filterAreas.length)request=request.overlaps('location_codes',filterAreas);return query(request);},[page,filterAreas]);
  const activity=usePostActivity(state.data?.map(p=>p.id)||[]);
  useFocusEffect(React.useCallback(()=>{state.refresh();activity.refresh();},[state.refresh,activity.refresh]));
  return <Page>
    <AppText variant="title">A community that cares</AppText>
    <AppText variant="muted">Ask for what is needed. Share what is happening nearby.</AppText>
    <Button title="Write a post" icon={<Icon name="write" color={colors.onPrimary}/>} onPress={()=>navigation.navigate('WritePost')}/>
    <Button title={showFilters?'Hide area filters':'Find posts in your area'} icon={<Icon name="search"/>} secondary onPress={()=>setShowFilters(!showFilters)}/>
    {showFilters&&<Card><LocationSelect label="Cities and municipalities" value={areas} onChange={setAreas} multiple/><Button title="Apply areas" onPress={()=>{setPage(0);setFilterAreas(areas);}}/><AppText variant="muted">Areas help you find posts. All signed-in members can still read them.</AppText></Card>}
    <RemoteState {...state} retry={state.refresh}/>
    {!state.loading&&!state.error&&!state.data?.length&&<Card><AppText>No community posts yet.</AppText><AppText variant="muted">Start with a local food request or an update.</AppText></Card>}
    {!state.loading&&!state.error&&state.data?.map(post=><CommunityCard key={post.id} post={post} navigation={navigation} userId={session.user.id} activity={activity.data?.find(a=>a.post_id===post.id)} activityState={activity}/>)}
    {page>0&&<Button title="Previous page" secondary onPress={()=>setPage(page-1)}/>}
    {state.data?.length===20&&<Button title="Next page" secondary onPress={()=>setPage(page+1)}/>}
  </Page>;
}
export function CommunityPostScreen({route,navigation}) {
  const {session}=useSession();const {colors}=useTheme();const input=useRef(null);
  const state=useRemote(()=>query(supabase.from('community_posts').select('*,profiles(display_name,avatar_path,account_type,organisation_name,verified)').eq('id',route.params.id).maybeSingle()),[route.params.id]);
  const post=state.data;const activity=usePostActivity(post?[post.id]:[]);
  const [comment,setComment]=useState(''),[commentError,setCommentError]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState(0);
  const comments=useRemote(()=>query(supabase.from('community_comments').select('*,profiles(display_name,avatar_path)').eq('post_id',route.params.id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*20,page*20+19)),[route.params.id,page]);
  useFocusEffect(React.useCallback(()=>{state.refresh();comments.refresh();activity.refresh();},[state.refresh,comments.refresh,activity.refresh]));
  React.useEffect(()=>{if(!post||post.id!==route.params.id||!route.params.focusComment)return;const timer=setTimeout(()=>{input.current?.focus();navigation.setParams({focusComment:false});},200);return()=>clearTimeout(timer);},[post?.id,route.params.focusComment]);
  async function add(){setBusy(true);setCommentError('');try{await rpc('add_comment',{p_post:post.id,p_body:comment});setComment('');setPage(0);await Promise.all([comments.refresh(),activity.refresh()]);}catch(e){setCommentError(e.message||'Could not post your comment.');}finally{setBusy(false);}}
  async function remove(id){setBusy(true);setCommentError('');try{await rpc('hide_my_comment',{p_comment:id});await Promise.all([comments.refresh(),activity.refresh()]);}catch(e){setCommentError(e.message||'Could not remove your comment.');}finally{setBusy(false);}}
  return <Page><RemoteState {...state} retry={state.refresh}/>
    {!state.loading&&!state.error&&!post&&<AppText>This post is no longer available.</AppText>}
    {!!post&&!state.loading&&<CommunityCard post={post} full navigation={navigation} userId={session.user.id} activity={activity.data?.find(a=>a.post_id===post.id)} activityState={activity} onComment={()=>input.current?.focus()}/>}
    {!!post&&<><AppText variant="heading">Comments</AppText><AppText variant="muted">Comments are visible to signed-in members. Keep addresses and contact details private.</AppText>
      <Card><Field label="Write a comment" inputRef={input} value={comment} onChangeText={setComment} multiline maxLength={1000}/><Button title="Post comment" icon={<Icon name="send" color={colors.onPrimary}/>} busy={busy} disabled={!comment.trim()} onPress={add}/></Card>
      {!!commentError&&<AppText accessibilityRole="alert">{commentError}</AppText>}
      <RemoteState {...comments} retry={comments.refresh}/>
      {!comments.loading&&!comments.error&&!comments.data?.length&&<AppText variant="muted">No comments yet. Start the conversation.</AppText>}
      {comments.data?.map(c=><Card key={c.id}><View style={{flexDirection:'row',alignItems:'flex-start',gap:8}}><Pressable accessibilityRole="button" accessibilityLabel={'View '+(c.profiles?.display_name||'member')+'’s profile'} onPress={()=>navigation.navigate('Member',{id:c.author_id})} style={{flex:1,minHeight:44,flexDirection:'row',alignItems:'center',gap:8}}><Avatar path={c.profiles?.avatar_path} name={c.profiles?.display_name} size={42}/><AppText style={{fontWeight:'600'}}>{c.profiles?.display_name||'Member'}</AppText></Pressable>
        <PostMenu label="Comment options" options={c.author_id===session.user.id?[{title:'Remove my comment',icon:'close',onPress:()=>{if(!busy)remove(c.id);}}]:moderationOptions(navigation,{type:'comment',id:c.id,userId:c.author_id})}/></View>
        <AppText>{c.body}</AppText><AppText variant="muted" style={{fontSize:14}}>{dateLabel(c.created_at)}</AppText>
      </Card>)}
      {page>0&&<Button secondary title="Newer comments" onPress={()=>setPage(page-1)}/>}{comments.data?.length===20&&<Button secondary title="Older comments" onPress={()=>setPage(page+1)}/>}
    </>}
  </Page>;
}
export function WritePostScreen({navigation}) {
  const {colors}=useTheme();
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
    <Button title="Publish post" icon={<Icon name="send" color={colors.onPrimary}/>} busy={busy} disabled={title.trim().length<3||body.trim().length<3||!areas.length} onPress={publish}/>
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
  return <Page><AppText variant="title">{route.params.action==='block'?'Block this member':'Help keep this space welcoming'}</AppText>{route.params.action!=='block'&&<Card>
    <Field label="Reason for reporting" value={reason} onChangeText={setReason} multiline maxLength={1000}/>
    <AppText variant="muted">Reports are private to you and the student team. Reports are reviewed manually; this is not an emergency service.</AppText>
    <Button title="Submit report" busy={busy} disabled={reason.trim().length<5} onPress={report}/>
    {!!notice&&<AppText accessibilityLiveRegion="polite">{notice}</AppText>}
  </Card>}
  {route.params.userId&&<Card><AppText variant="heading">Block this member</AppText><AppText>Hide their listings and posts and stop new messages between you. Existing reservations are not automatically cancelled; cancel them in Activity if needed.</AppText>
    {confirmBlock?<><Button title="Confirm block" busy={busy} onPress={block}/><Button title="Go back" secondary onPress={()=>setConfirmBlock(false)}/></>:<Button title="Block member" secondary onPress={()=>setConfirmBlock(true)}/>}
  </Card>}
  {!!error&&<AppText accessibilityRole="alert">{error}</AppText>}
  </Page>;
}

