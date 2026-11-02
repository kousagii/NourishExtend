import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { Page, AppText, Card, Field, Button } from './ui';
import { useTheme } from './theme';
import { useSession } from './session';
import { supabase, rpc, query } from './backend';
import { useRemote, dateLabel, categories } from './data';

export function RemoteState({ loading, error, retry }) {
  return <>{loading && <AppText accessibilityLiveRegion="polite">Loading…</AppText>}{!!error && <Card><AppText accessibilityRole="alert">{error}</AppText><Button title="Try again" secondary onPress={retry} /></Card>}</>;
}
export function FoodPhoto({ path }) {
  const [uri,setUri] = useState('');
  const [failed,setFailed] = useState(false);
  const { colors } = useTheme();
  useEffect(() => {
    let active = true; setUri(''); setFailed(false);
    supabase.storage.from('food-photos').createSignedUrl(path,600).then(({data,error}) => {
      if (active) { if (error) setFailed(true); else setUri(data.signedUrl); }
    });
    return () => { active = false; };
  },[path]);
  if (!uri || failed) return <View style={{ padding:24,backgroundColor:colors.background,borderRadius:10 }}><AppText variant="muted">{failed ? 'Photo unavailable' : 'Loading photo…'}</AppText></View>;
  return <Image accessibilityLabel="Donated food" source={{ uri }} onError={() => setFailed(true)} style={{ width:'100%',aspectRatio:1.7,borderRadius:12 }} />;
}
export function HomeScreen({ navigation }) {
  const [search,setSearch] = useState('');
  const [area,setArea] = useState('');
  const [category,setCategory] = useState('');
  const [showFilters,setShowFilters] = useState(false);
  const [page,setPage] = useState(0);
  const [filters,setFilters] = useState({search:'',area:'',category:''});
  const { data,loading,error,refresh } = useRemote(() => {
    let request = supabase.from('donations').select('*').eq('status','available').gt('pickup_deadline',new Date().toISOString()).order('pickup_deadline').order('id').range(page*20,page*20+19);
    if (filters.search) request = request.ilike('title','%'+filters.search.replace(/[%_]/g,'')+'%');
    if (filters.area) request = request.ilike('area','%'+filters.area.replace(/[%_]/g,'')+'%');
    if (filters.category) request = request.eq('category',filters.category);
    return query(request);
  },[filters,page]);
  useFocusEffect(React.useCallback(() => { refresh(); },[refresh]));
  return <Page>
    <AppText variant="muted">NOURISH EXTEND · PHILIPPINES</AppText>
    <AppText variant="title">Good food. A little closer.</AppText>
    <AppText variant="muted">Find something to share, or offer your extra.</AppText>
    <Card>
      <Field label="Search food" value={search} onChangeText={setSearch} maxLength={80} placeholder="What are you looking for?" />
      <Button title={showFilters?'Hide filters':'Filter by area or food type'} secondary onPress={()=>setShowFilters(!showFilters)} />
      {showFilters && <>
      <Field label="Pickup area" value={area} onChangeText={setArea} maxLength={100} placeholder="City or neighbourhood" />
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {['',...categories].map(value => <Button key={value} title={value || 'All food'} secondary={category !== value} onPress={() => setCategory(value)} />)}
      </View>
      </>}
      <Button title="Find food" onPress={() => { setPage(0); setFilters({search:search.trim(),area:area.trim(),category}); }} />
    </Card>
    <AppText variant="heading">Available to collect</AppText>
    <RemoteState loading={loading} error={error} retry={refresh} />
    {!loading && !error && !data?.length && <Card><AppText>No food matches yet.</AppText><AppText variant="muted">Try another area or share something of your own.</AppText><Button title="Share food" onPress={() => navigation.navigate('Donate')} /></Card>}
    {!loading && !error && data?.map(item => <Card key={item.id}>
      <FoodPhoto path={item.photo_path} />
      <AppText variant="heading">{item.title}</AppText>
      <AppText>{item.quantity} · {item.area}</AppText>
      <AppText variant="muted">Collect by {dateLabel(item.pickup_deadline)}</AppText>
      <Button title="View donation" secondary accessibilityLabel={'View '+item.title} onPress={() => navigation.navigate('Donation',{id:item.id})} />
    </Card>)}
    <View style={{gap:10}}>
      {page>0 && <Button title="Previous page" secondary onPress={() => setPage(page-1)} />}
      {data?.length === 20 && <Button title="Next page" secondary onPress={() => setPage(page+1)} />}
    </View>
  </Page>;
}
export function CreateDonationScreen({ navigation }) {
  const initial = { title:'',description:'',quantity:'',category:'Produce',allergens:'',storage_info:'',area:'',instructions:'',pickup_deadline:'' };
  const [form,setForm] = useState(initial);
  const [photo,setPhoto] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const { colors } = useTheme();
  const update = key => value => setForm(previous => ({...previous,[key]:value}));
  async function choosePhoto() {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:0.7,base64:true,allowsEditing:true,aspect:[4,3]});
      if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
    } catch { setError('Could not open your photos. Please try again.'); }
  }
  async function publish() {
    setError('');
    if (!photo?.base64) { setError('Choose a food photo first.'); return; }
    if (photo.base64.length>4194304) { setError('Choose a photo under 3 MB.'); return; }
    for (const key of ['title','quantity','allergens','storage_info','area','instructions','pickup_deadline']) if (!form[key].trim()) { setError('Complete every required field. Description is optional.'); return; }
    // Input is a local Philippines time, independent of the browser/device timezone.
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(form.pickup_deadline)) { setError('Use YYYY-MM-DD HH:MM for the pickup deadline.'); return; }
    const deadline = new Date(form.pickup_deadline.replace(' ','T')+':00+08:00');
    if (!Number.isFinite(deadline.getTime()) || deadline<=new Date()) { setError('Choose a future pickup deadline.'); return; }
    setBusy(true);
    try {
      const {data,error:uploadError} = await supabase.functions.invoke('upload-photo',{body:{imageBase64:photo.base64}});
      if (uploadError || !data?.path) throw new Error(data?.error || 'Photo upload failed. Check that the upload-photo function is deployed.');
      const id = await rpc('publish_donation',{p_data:{...form,photo_path:data.path,pickup_deadline:deadline.toISOString()}});
      setForm(initial); setPhoto(null);
      navigation.navigate('Donation',{id});
    } catch (err) { setError(err.message || 'Donation could not be published.'); }
    finally { setBusy(false); }
  }
  return <Page>
    <AppText variant="title">A little extra. A lot of good.</AppText>
    <AppText variant="muted">Share food with your community. Keep your exact pickup location in the private instructions field.</AppText>
    <Card>
      {photo && <Image accessibilityLabel="Selected food photo" source={{uri:photo.uri}} style={{width:'100%',aspectRatio:1.6,borderRadius:12}} />}
      <Button title={photo?'Change food photo':'Choose food photo'} secondary disabled={busy} onPress={choosePhoto} />
      <Field label="Food name" value={form.title} onChangeText={update('title')} maxLength={100} />
      <Field label="Quantity" value={form.quantity} onChangeText={update('quantity')} placeholder="For example: 3 sealed packs" maxLength={80} />
      <AppText>Food category</AppText>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{categories.map(value => <Button key={value} title={value} secondary={form.category!==value} onPress={() => update('category')(value)} />)}</View>
      <Field label="Description (optional)" value={form.description} onChangeText={update('description')} multiline maxLength={1500} />
      <Field label="Allergens / ingredients" value={form.allergens} onChangeText={update('allergens')} placeholder="Include known allergens or say unknown" multiline maxLength={300} />
      <Field label="Storage information" value={form.storage_info} onChangeText={update('storage_info')} multiline maxLength={300} />
      <Field label="Public pickup area" value={form.area} onChangeText={update('area')} placeholder="City or neighbourhood only" maxLength={120} />
      <Field label="Collect by (Philippines time)" value={form.pickup_deadline} onChangeText={update('pickup_deadline')} placeholder="YYYY-MM-DD HH:MM" maxLength={16} />
      <Field label="Private pickup instructions" value={form.instructions} onChangeText={update('instructions')} multiline maxLength={1000} placeholder="Shared only with your current recipient" />
      {!!error && <AppText accessibilityRole="alert" style={{color:colors.danger}}>{error}</AppText>}
      <Button title="Publish donation" busy={busy} onPress={publish} />
    </Card>
  </Page>;
}
export function DonationDetailScreen({route,navigation}) {
  const {session} = useSession();
  const {colors} = useTheme();
  const {data:item,loading,error,refresh} = useRemote(() => query(supabase.from('donations').select('*').eq('id',route.params.id).maybeSingle()),[route.params.id]);
  const [busy,setBusy] = useState(false);
  const [actionError,setActionError] = useState('');
  const [notice,setNotice] = useState('');
  useFocusEffect(React.useCallback(() => { refresh(); },[refresh]));
  async function act(name) {
    setBusy(true); setActionError('');
    try {
      const id = await rpc(name,{p_donation:item.id});
      if(name==='reserve_donation') navigation.navigate('Pickup',{id});
      else { setNotice('Donation cancelled.'); await refresh(); }
    } catch(err) { setActionError(err.message || 'This action failed.'); refresh(); }
    finally {setBusy(false);}
  }
  const available = item?.status==='available' && new Date(item.pickup_deadline)>new Date();
  return <Page>
    <RemoteState loading={loading} error={error} retry={refresh} />
    {!loading && !error && !item && <Card><AppText>This donation is no longer available.</AppText><Button title="Browse food" onPress={() => navigation.navigate('Home')} /></Card>}
    {!!item && !loading && <Card>
      <FoodPhoto path={item.photo_path} />
      <AppText variant="title">{item.title}</AppText>
      <AppText>{item.quantity} · {item.category}</AppText>
      <AppText variant="muted">{item.area} · Collect by {dateLabel(item.pickup_deadline)}</AppText>
      <AppText variant="heading">{available?'Available':item.status==='available'?'Expired':item.status[0].toUpperCase()+item.status.slice(1)}</AppText>
      {!!item.description && <AppText>{item.description}</AppText>}
      <AppText variant="heading">Allergens / ingredients</AppText><AppText>{item.allergens}</AppText>
      <AppText variant="heading">Storage</AppText><AppText>{item.storage_info}</AppText>
      {!!actionError && <AppText accessibilityRole="alert" style={{color:colors.danger}}>{actionError}</AppText>}
      {!!notice && <AppText accessibilityLiveRegion="polite">{notice}</AppText>}
      {item.donor_id!==session.user.id && available && <Button title="Reserve this food" busy={busy} onPress={() => act('reserve_donation')} />}
      {item.donor_id===session.user.id && ['available','reserved'].includes(item.status) && <Button title="Cancel donation" secondary busy={busy} onPress={() => navigation.navigate('CancelDonation',{id:item.id})} />}
      {item.status==='reserved' && <Button title="View my activity" secondary onPress={() => navigation.navigate('Activity')} />}
      {item.donor_id!==session.user.id && <Button title="Report or block" secondary onPress={() => navigation.navigate('Report',{type:'donation',id:item.id,userId:item.donor_id})} />}
    </Card>}
  </Page>;
}
export function CancelDonationScreen({route,navigation}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function cancel() {
    setBusy(true);setError('');
    try {await rpc('cancel_donation',{p_donation:route.params.id});navigation.navigate('Activity');}
    catch(err){setError(err.message || 'Could not cancel donation.');}finally{setBusy(false);}
  }
  return <Page><AppText variant="title">Cancel this donation?</AppText><AppText>Any current recipient will be notified. The listing will no longer be available.</AppText>{!!error&&<AppText accessibilityRole="alert">{error}</AppText>}<Button title="Yes, cancel donation" busy={busy} onPress={cancel}/><Button title="Keep donation" secondary onPress={()=>navigation.goBack()}/></Page>;
}

