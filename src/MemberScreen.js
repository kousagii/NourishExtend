import React from 'react';
import {Page,Card,AppText} from './ui';
import {useRemote} from './data';
import {supabase,query} from './backend';
import {RemoteState} from './DonationScreens';
import Avatar from './Avatar';
export default function MemberScreen({route}){
 const state=useRemote(()=>query(supabase.from('profiles').select('id,display_name,account_type,organisation_name,verified,bio,avatar_path').eq('id',route.params.id).maybeSingle()),[route.params.id]);const member=state.data;
 return <Page><RemoteState {...state} retry={state.refresh}/>{member&&<Card><Avatar size={104} path={member.avatar_path} name={member.display_name}/><AppText variant="title">{member.display_name||'Member'}</AppText><AppText variant="muted">{member.account_type==='organisation'?member.organisation_name+' · Unverified organisation':'Community member'}</AppText>{!!member.bio&&<AppText>{member.bio}</AppText>}<AppText variant="muted">A display name, photo or bio does not prove identity. Keep communication in the app and never pay for a free donation.</AppText></Card>}{!state.loading&&!state.error&&!member&&<AppText>This profile is unavailable.</AppText>}</Page>;
}
