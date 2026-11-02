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
import NotificationsScreen from './NotificationsScreen';

const Stack=createStackNavigator();
function Root() {
  const {navigationTheme,isDark,colors}=useTheme();
  const {session,profile,loading,error,recovery,refreshProfile}=useSession();
  const [privacyOpen,setPrivacyOpen]=useState(false);
  const [retryError,setRetryError]=useState('');
  const insets=useSafeAreaInsets();
  const navigation=React.useRef(null);
  const [current,setCurrent]=useState('Home');
  if(loading)return <Page><AppText>Opening NourishExtend…</AppText></Page>;
  if(privacyOpen)return <PrivacyScreen onBack={()=>setPrivacyOpen(false)}/>;
  if(!session || recovery)return <><StatusBar style={isDark?'light':'dark'}/><AuthScreen onPrivacy={()=>setPrivacyOpen(true)}/></>;
  if(!profile)return <Page><AppText variant="title">Let’s reconnect</AppText><AppText>{retryError||error||'Your profile is unavailable. Apply the database setup and try again.'}</AppText><Button title="Try again" onPress={()=>refreshProfile().catch(()=>setRetryError('Could not load your profile. Check the database setup and connection.'))}/><Button title="Sign out" secondary onPress={()=>supabase.auth.signOut()}/></Page>;
  return <View style={{flex:1,backgroundColor:colors.background}}>
    <StatusBar style={isDark?'light':'dark'}/>
    <NavigationContainer ref={navigation} theme={navigationTheme} onStateChange={()=>{const name=navigation.current?.getCurrentRoute()?.name;setCurrent(previous=>name==='Pickup'?'Activity':['Home','Donate','Community','Activity','Settings'].includes(name)?name:previous);}}>
      <Stack.Navigator initialRouteName="Home" screenOptions={{headerStyle:{backgroundColor:colors.surface},headerTintColor:colors.text,headerTitleStyle:{fontFamily:headingFont,fontWeight:'600'},cardStyle:{backgroundColor:colors.background}}}>
        <Stack.Screen name="Home" component={HomeScreen} options={{title:'NourishExtend'}}/>
        <Stack.Screen name="Donate" component={CreateDonationScreen} options={{title:'Share food'}}/>
        <Stack.Screen name="Donation" component={DonationDetailScreen} options={{title:'Donation details'}}/>
        <Stack.Screen name="CancelDonation" component={CancelDonationScreen} options={{title:'Cancel donation'}}/>
        <Stack.Screen name="Activity" component={ActivityScreen}/>
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
        {['Home','Donate','Community','Activity','Settings'].map(name=><Pressable key={name} accessibilityRole="tab" accessibilityState={{selected:current===name}} onPress={()=>navigation.current?.navigate(name)} style={({pressed})=>({flex:1,minWidth:64,minHeight:58,justifyContent:'center',alignItems:'center',padding:8,backgroundColor:current===name?colors.background:colors.surface,opacity:pressed?0.7:1})}><AppText style={{fontSize:14,color:current===name?colors.primary:colors.muted}}>{name==='Donate'?'Share':name}</AppText></Pressable>)}
      </ScrollView>
    </View>
  </View>;
}
export default function App(){
  return <GestureHandlerRootView style={{flex:1}}><SafeAreaProvider><ThemeProvider><SessionProvider><Root/></SessionProvider></ThemeProvider></SafeAreaProvider></GestureHandlerRootView>;
}

