import 'react-native-gesture-handler';
import React, {useState,useEffect} from 'react';
import {View,ScrollView,Pressable} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider,useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemeProvider,useTheme,headingFont} from './src/theme';
import {SessionProvider,useSession} from './src/session';
import {supabase} from './src/backend';
import {Page,AppText,Button} from './src/ui';
import AuthScreen from './src/AuthScreen';
import PrivacyScreen from './src/PrivacyScreen';
import {HomeScreen,CreateDonationScreen,DonationDetailScreen,CancelDonationScreen} from './src/DonationScreens';
import {ActivityScreen,PickupScreen} from './src/ActivityScreens';
import {CommunityScreen,CommunityPostScreen,WritePostScreen,ReportScreen} from './src/CommunityScreens';
import SettingsScreen from './SettingsScreen';
import ProfileScreen from './ProfileScreen';
import NotificationsScreen from './NotificationsScreen';
import {MessagesScreen,InquiryScreen} from './src/MessageScreens';
import {Icon} from './src/brand';

const Stack=createStackNavigator();
function Root() {
  const {navigationTheme,isDark,colors}=useTheme();
  const {session,profile,loading,error,recovery,refreshProfile}=useSession();
  const [privacyOpen,setPrivacyOpen]=useState(false);
  const [retryError,setRetryError]=useState('');
  const insets=useSafeAreaInsets();
  const navigation=React.useRef(null);
  const [current,setCurrent]=useState('Home');
  const [navigationReady,setNavigationReady]=useState(false);
  const [badges,setBadges]=useState({messages:0,notifications:0});
  useEffect(()=>{
    if(!session){setBadges({messages:0,notifications:0});return;}
    let active=true;
    async function poll(){
      const [notes,threads]=await Promise.all([
        supabase.from('notifications').select('id',{count:'exact',head:true}).is('read_at',null),
        supabase.from('inquiries').select('donor_id,donor_read_at,inquirer_read_at,last_message_at').order('last_message_at',{ascending:false}).limit(100),
      ]);
      if(active)setBadges({notifications:notes.count||0,messages:threads.data?.filter(t=>{const read=t.donor_id===session.user.id?t.donor_read_at:t.inquirer_read_at;return !read||new Date(read)<new Date(t.last_message_at);}).length||0});
    }
    poll();const timer=setInterval(poll,15000);return()=>{active=false;clearInterval(timer);};
  },[session?.user.id]);
  if(loading)return <Page><AppText>Opening NourishExtend…</AppText></Page>;
  if(privacyOpen)return <PrivacyScreen onBack={()=>setPrivacyOpen(false)}/>;
  if(!session || recovery)return <><StatusBar style={isDark?'light':'dark'}/><AuthScreen onPrivacy={()=>setPrivacyOpen(true)}/></>;
  if(!profile)return <Page><AppText variant="title">Let’s reconnect</AppText><AppText>{retryError||error||'Your profile is unavailable. Apply the database setup and try again.'}</AppText><Button title="Try again" onPress={()=>refreshProfile().catch(()=>setRetryError('Could not load your profile. Check the database setup and connection.'))}/><Button title="Sign out" secondary onPress={()=>supabase.auth.signOut()}/></Page>;
  return <View style={{flex:1,backgroundColor:colors.background}}>
    <StatusBar style={isDark?'light':'dark'}/>
    <NavigationContainer ref={navigation} onReady={()=>setNavigationReady(true)} theme={navigationTheme} onStateChange={()=>{const name=navigation.current?.getCurrentRoute()?.name;setCurrent(previous=>name==='Pickup'?'Activity':name==='Inquiry'?'Messages':['Home','Donate','Community','Messages','Activity','Settings'].includes(name)?name:previous);}}>
      <Stack.Navigator initialRouteName="Home" screenOptions={{headerLeft:()=>null,headerStyle:{backgroundColor:colors.primary},headerTintColor:colors.onPrimary,headerTitleStyle:{fontFamily:headingFont,fontWeight:'600'},cardStyle:{backgroundColor:colors.background},headerRight:()=> <View style={{flexDirection:'row',paddingRight:8}}><Pressable disabled={!navigationReady} accessibilityRole="button" accessibilityLabel={`Notifications${badges.notifications?', unread updates':''}`} onPress={()=>navigation.current?.navigate('Notifications')} style={{minHeight:48,minWidth:48,alignItems:'center',justifyContent:'center'}}><Icon name="bell" color={colors.onPrimary}/>{badges.notifications>0&&<View style={{position:'absolute',top:7,right:7,width:9,height:9,borderRadius:5,backgroundColor:colors.onPrimary}}/>}</Pressable><Pressable disabled={!navigationReady} accessibilityRole="button" accessibilityLabel="Settings" onPress={()=>navigation.current?.navigate('Settings')} style={{minHeight:48,minWidth:48,alignItems:'center',justifyContent:'center'}}><Icon name="settings" color={colors.onPrimary}/></Pressable></View>}}>
        <Stack.Screen name="Home" component={HomeScreen} options={{title:'NourishExtend'}}/>
        <Stack.Screen name="Donate" component={CreateDonationScreen} options={{title:'Share food'}}/>
        <Stack.Screen name="Donation" component={DonationDetailScreen} options={{title:'Donation details'}}/>
        <Stack.Screen name="CancelDonation" component={CancelDonationScreen} options={{title:'Cancel donation'}}/>
        <Stack.Screen name="Activity" component={ActivityScreen}/>
        <Stack.Screen name="Messages" component={MessagesScreen}/>
        <Stack.Screen name="Inquiry" component={InquiryScreen} options={{title:'Donation messages'}}/>
        <Stack.Screen name="Pickup" component={PickupScreen} options={{title:'Your pickup'}}/>
        <Stack.Screen name="Community" component={CommunityScreen}/>
        <Stack.Screen name="CommunityPost" component={CommunityPostScreen} options={{title:'Community post'}}/>
        <Stack.Screen name="WritePost" component={WritePostScreen} options={{title:'New community post'}}/>
        <Stack.Screen name="Report" component={ReportScreen} options={{title:'Report or block'}}/>
        <Stack.Screen name="Settings" component={SettingsScreen}/>
        <Stack.Screen name="ProfileScreen" component={ProfileScreen} options={{title:'Edit profile'}}/>
        <Stack.Screen name="Notifications" component={NotificationsScreen}/>
        <Stack.Screen name="Privacy" component={PrivacyScreen} options={{title:'Privacy'}}/>
      </Stack.Navigator>
    </NavigationContainer>
    <View style={{borderTopWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingBottom:insets.bottom}}>
      <ScrollView horizontal contentContainerStyle={{flexGrow:1}} showsHorizontalScrollIndicator={false}>
        {['Home','Donate','Community','Messages','Activity'].map(name=><Pressable key={name} disabled={!navigationReady} accessibilityRole="tab" aria-selected={current===name} accessibilityLabel={name==='Messages'&&badges.messages?`Messages, ${badges.messages} unread conversations`:name==='Donate'?'Share food':name} accessibilityState={{selected:current===name}} onPress={()=>navigation.current?.navigate(name)} style={({pressed})=>({flexGrow:1,flexShrink:0,minWidth:72,minHeight:70,justifyContent:'center',alignItems:'center',padding:8,gap:4,backgroundColor:current===name?colors.background:colors.surface,opacity:pressed?0.7:1})}><View><Icon name={{Home:'home',Donate:'share',Community:'community',Messages:'messages',Activity:'activity'}[name]} color={current===name?colors.primary:colors.muted}/>{name==='Messages'&&badges.messages>0&&<View style={{position:'absolute',top:-2,right:-7,width:9,height:9,borderRadius:5,backgroundColor:colors.primary}}/>}</View><AppText style={{fontSize:14,color:current===name?colors.primary:colors.muted}}>{name==='Donate'?'Share':name}</AppText></Pressable>)}
      </ScrollView>
    </View>
  </View>;
}
export default function App(){
  return <GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><ThemeProvider><SessionProvider><Root/></SessionProvider></ThemeProvider></SafeAreaProvider></GestureHandlerRootView>;
}

