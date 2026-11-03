import 'react-native-gesture-handler';
import React, {useState} from 'react';
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
import PasswordScreen from './src/PasswordScreen';
import MemberScreen from './src/MemberScreen';
import NotificationsScreen from './NotificationsScreen';
import {MessagesScreen,InquiryScreen} from './src/MessageScreens';
import {Icon} from './src/brand';
import {UpdatesProvider,useUpdates} from './src/updates';

const Stack=createStackNavigator();
function Root() {
  const {navigationTheme,isDark,colors,uiScale}=useTheme();
  const {session,profile,loading,error,recovery,refreshProfile}=useSession();
  const [privacyOpen,setPrivacyOpen]=useState(false);
  const [retryError,setRetryError]=useState('');
  const insets=useSafeAreaInsets();
  const navigation=React.useRef(null);
  const [current,setCurrent]=useState('Home');
  const [navigationReady,setNavigationReady]=useState(false);
  const badges=useUpdates();
  if(loading)return <Page><AppText>Opening Nourish Extend…</AppText></Page>;
  if(privacyOpen)return <PrivacyScreen onBack={()=>setPrivacyOpen(false)}/>;
  if(!session || recovery)return <><StatusBar style={isDark?'light':'dark'}/><AuthScreen onPrivacy={()=>setPrivacyOpen(true)}/></>;
  if(!profile)return <Page><AppText variant="title">Let’s reconnect</AppText><AppText>{retryError||error||'Your profile is unavailable. Apply the database setup and try again.'}</AppText><Button title="Try again" onPress={()=>refreshProfile().catch(()=>setRetryError('Could not load your profile. Check the database setup and connection.'))}/><Button title="Sign out" secondary onPress={()=>supabase.auth.signOut()}/></Page>;
  return <View style={{flex:1,backgroundColor:colors.background}}>
    <StatusBar style={isDark?'light':'dark'}/>
    <NavigationContainer ref={navigation} onReady={()=>setNavigationReady(true)} theme={navigationTheme} onStateChange={()=>{const name=navigation.current?.getCurrentRoute()?.name;setCurrent(previous=>name==='Pickup'?'Activity':name==='Inquiry'?'Messages':['Home','Donate','Community','Messages','Activity','Settings'].includes(name)?name:previous);}}>
      <Stack.Navigator initialRouteName="Home" screenOptions={{headerLeft:()=>null,headerStyle:{backgroundColor:colors.primary},headerTintColor:colors.onPrimary,headerTitleStyle:{fontFamily:headingFont,fontWeight:'600',fontSize:Math.max(12,18*uiScale)},cardStyle:{backgroundColor:colors.background},headerRight:()=> <View style={{flexDirection:'row',paddingRight:8}}><Pressable disabled={!navigationReady} accessibilityRole="button" accessibilityLabel={`Notifications${badges.notifications?', '+badges.notifications+' unread updates':''}`} onPress={()=>navigation.current?.navigate('Notifications')} style={{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center'}}><Icon name="bell" color={colors.onPrimary}/>{badges.notifications>0&&<View style={{position:'absolute',top:7,right:7,width:11,height:11,borderRadius:6,borderWidth:2,borderColor:colors.surface,backgroundColor:colors.onPrimary}}/>}</Pressable><Pressable disabled={!navigationReady} accessibilityRole="button" accessibilityLabel="Settings" onPress={()=>navigation.current?.navigate('Settings')} style={{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center'}}><Icon name="settings" color={colors.onPrimary}/></Pressable></View>}}>
        <Stack.Screen name="Home" component={HomeScreen} options={{title:'Nourish Extend'}}/>
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
        <Stack.Screen name="ChangePassword" component={PasswordScreen} options={{title:'Change password'}}/>
        <Stack.Screen name="Member" component={MemberScreen} options={{title:'Member profile'}}/>
        <Stack.Screen name="Notifications" component={NotificationsScreen}/>
        <Stack.Screen name="Privacy" component={PrivacyScreen} options={{title:'Privacy'}}/>
      </Stack.Navigator>
    </NavigationContainer>
    <View style={{borderTopWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingBottom:insets.bottom}}>
      <ScrollView horizontal contentContainerStyle={{flexGrow:1}} showsHorizontalScrollIndicator={false}>
        {['Home','Donate','Community','Messages','Activity'].map(name=><Pressable key={name} disabled={!navigationReady} accessibilityRole="tab" aria-selected={current===name} accessibilityLabel={name==='Messages'&&badges.messages?`Messages, ${badges.messages} unread conversations`:name==='Donate'?'Share food':name} accessibilityState={{selected:current===name}} onPress={()=>navigation.current?.navigate(name)} style={({pressed})=>({flexGrow:1,flexShrink:0,minWidth:Math.max(56,72*uiScale),minHeight:Math.max(52,70*uiScale),justifyContent:'center',alignItems:'center',padding:8*uiScale,gap:4*uiScale,backgroundColor:current===name?colors.background:colors.surface,opacity:pressed?0.7:1})}><View><Icon name={{Home:'home',Donate:'share',Community:'community',Messages:'messages',Activity:'activity'}[name]} color={current===name?colors.primary:colors.muted}/>{name==='Messages'&&badges.messages>0&&<View style={{position:'absolute',top:-2,right:-7,width:11,height:11,borderRadius:6,borderWidth:2,borderColor:colors.surface,backgroundColor:colors.primary}}/>}</View><AppText style={{fontSize:14,color:current===name?colors.primary:colors.muted}}>{name==='Donate'?'Share':name}</AppText></Pressable>)}
      </ScrollView>
    </View>
  </View>;
}
export default function App(){
  return <GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><ThemeProvider><SessionProvider><UpdatesProvider><Root/></UpdatesProvider></SessionProvider></ThemeProvider></SafeAreaProvider></GestureHandlerRootView>;
}

