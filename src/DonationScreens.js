import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { Page, AppText, Card, Field, Button } from './ui';
import { useTheme } from './theme';
import { useSession } from './session';
import { supabase, rpc, query } from './backend';
import { useRemote, dateLabel, categories } from './data';
import {Brand,BasketArt,Icon} from './brand';
import {Select,LocationSelect,DeadlinePicker} from './controls';
import {deadlineISO} from './date-time.cjs';

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
  const [areas,setAreas] = useState([]);
  const [category,setCategory] = useState('');
  const [showFilters,setShowFilters] = useState(false);
  const [page,setPage] = useState(0);
  const [filters,setFilters] = useState({search:'',areas:[],category:''});
  const { data,loading,error,refresh } = useRemote(() => {
    let request = supabase.from('donations').select('*').eq('status','available').gt('pickup_deadline',new Date().toISOString()).order('pickup_deadline').order('id').range(page*20,page*20+19);
    if (filters.search) request = request.ilike('title','%'+filters.search.replace(/[%_]/g,'')+'%');
    if (filters.areas.length) request = request.in('location_code',filters.areas);
    if (filters.category) request = request.eq('category',filters.category);
    return query(request);
  },[filters,page]);
  useFocusEffect(React.useCallback(() => { refresh(); },[refresh]));
  return <Page>
    <Brand/>
    <Card style={{borderColor:'#375A3D',borderLeftWidth:5}}>
      <AppText variant="title">Good food deserves another table.</AppText>
      <AppText variant="muted">Share your extra. Find something nourishing.</AppText>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}><Button title="Share food" onPress={()=>navigation.navigate('Donate')}/><Button title="Find food below" secondary onPress={()=>setShowFilters(true)}/></View>
    </Card>
    <Card>
      <Field label="Search food" value={search} onChangeText={setSearch} maxLength={80} placeholder="What are you looking for?" />
      <Button title={showFilters?'Hide filters':'Filter by area or food type'} secondary onPress={()=>setShowFilters(!showFilters)} />
      {showFilters && <>
      <LocationSelect label="Where would you like to collect?" value={areas} onChange={setAreas} multiple/>
      <Select label="Food category" value={category} onChange={setCategory} options={[{value:'',label:'All food'},...categories.map(value=>({value,label:value}))]}/>
      </>}
      <Button title="Find food" onPress={() => { setPage(0); setFilters({search:search.trim(),areas,category}); }} />
      {!!filters.areas.length&&<AppText variant="muted">Older listings without a selected city are excluded from area filters. Clear areas to see all listings.</AppText>}
    </Card>
    <AppText variant="heading">Available to collect</AppText>
    <RemoteState loading={loading} error={error} retry={refresh} />
    {!loading && !error && !data?.length && <Card><AppText>No food matches yet.</AppText><AppText variant="muted">Try another area or share something of your own.</AppText><Button title="Share food" onPress={() => navigation.navigate('Donate')} /></Card>}
    {!loading && !error && data?.map(item => <Card key={item.id}>
      <FoodPhoto path={item.photo_path} />
      <AppText variant="heading">{item.title}</AppText>
      <AppText>{item.quantity} · {item.category}</AppText>
      <View style={{flexDirection:'row',gap:8}}><Icon name="pin" size={19}/><AppText>{item.area}</AppText></View>
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
  const [location,setLocation]=useState([]),[neighbourhood,setNeighbourhood]=useState('');
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
    for (const key of ['title','quantity','allergens','storage_info','instructions','pickup_deadline']) if (!form[key].trim()) { setError('Complete every required field. Description is optional.'); return; }
    if(!location.length){setError('Choose a pickup city or municipality.');return;}
    // Input is a local Philippines time, independent of the browser/device timezone.
    const iso=deadlineISO(form.pickup_deadline),deadline=iso?new Date(iso):null;
    if (!deadline || deadline<=new Date() || deadline>Date.now()+30*86400000) { setError('Choose a future pickup deadline within the next 30 days.'); return; }
    setBusy(true);
    try {
      const {data,error:uploadError} = await supabase.functions.invoke('upload-photo',{body:{imageBase64:photo.base64}});
      if (uploadError || !data?.path) throw new Error(data?.error || 'Photo upload failed. Check that the upload-photo function is deployed.');
      const id = await rpc('publish_located_donation',{p_data:{...form,location_code:location[0],neighbourhood,photo_path:data.path,pickup_deadline:deadline.toISOString()}});
      setForm(initial); setPhoto(null);setLocation([]);setNeighbourhood('');
      navigation.navigate('Donation',{id});
    } catch (err) { setError(err.message || 'Donation could not be published.'); }
    finally { setBusy(false); }
  }
  return <Page>
    <View style={{flexDirection:'row',alignItems:'center',gap:16}}><BasketArt size={86}/><AppText variant="title" style={{flex:1}}>A little extra. A lot of good.</AppText></View>
    <AppText variant="muted">Share food with your community. Keep your exact pickup location in the private instructions field.</AppText>
    <Card>
      <AppText variant="heading">1. What are you sharing?</AppText>
      {photo ? <Image accessibilityLabel="Selected food photo" source={{uri:photo.uri}} style={{width:'100%',aspectRatio:1.6,borderRadius:12}} />:<View style={{padding:24,alignItems:'center',gap:8,backgroundColor:colors.background,borderRadius:16}}><Icon name="photo" size={36}/><AppText variant="muted">Let neighbours see the food you’re sharing.</AppText></View>}
      <Button title={photo?'Change food photo':'Choose food photo'} secondary disabled={busy} onPress={choosePhoto} />
      <Field label="Food name" value={form.title} onChangeText={update('title')} maxLength={100} />
      <Field label="Quantity" value={form.quantity} onChangeText={update('quantity')} placeholder="For example: 3 sealed packs" maxLength={80} />
      <Select label="Food category" value={form.category} onChange={update('category')} options={categories.map(value=>({value,label:value}))}/>
      <Field label="Description (optional)" value={form.description} onChangeText={update('description')} multiline maxLength={1500} />
      <AppText variant="heading">2. Keep the food safe</AppText>
      <Field label="Allergens / ingredients" value={form.allergens} onChangeText={update('allergens')} placeholder="Include known allergens or say unknown" multiline maxLength={300} />
      <Field label="Storage information" value={form.storage_info} onChangeText={update('storage_info')} multiline maxLength={300} />
      <AppText variant="heading">3. Plan the collection</AppText>
      <LocationSelect label="Pickup city or municipality" value={location} onChange={setLocation}/>
      <Field label="Barangay / neighbourhood (optional)" value={neighbourhood} onChangeText={setNeighbourhood} placeholder="Approximate area only" maxLength={60}/>
      <AppText variant="muted">Members see this approximate area. Keep your exact address in private pickup instructions.</AppText>
      <DeadlinePicker value={form.pickup_deadline} onChange={update('pickup_deadline')}/>
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
      <AppText variant="heading">{available?'Available':item.status==='available'?'Expired':item.status==='collected'?'Completed':item.status[0].toUpperCase()+item.status.slice(1)}</AppText>
      {!!item.description && <AppText>{item.description}</AppText>}
      <AppText variant="heading">Allergens / ingredients</AppText><AppText>{item.allergens}</AppText>
      <AppText variant="heading">Storage</AppText><AppText>{item.storage_info}</AppText>
      {!!actionError && <AppText accessibilityRole="alert" style={{color:colors.danger}}>{actionError}</AppText>}
      {!!notice && <AppText accessibilityLiveRegion="polite">{notice}</AppText>}
      {item.donor_id!==session.user.id && available && <Button title="Reserve this food" busy={busy} onPress={() => act('reserve_donation')} />}
      {item.donor_id!==session.user.id && available && <Button title="Message donor" secondary onPress={()=>navigation.navigate('Inquiry',{donationId:item.id,title:item.title})}/>}
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

