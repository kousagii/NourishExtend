import React,{useRef,useState} from 'react';
import {View,Pressable,Modal,Platform,useWindowDimensions,ActivityIndicator} from 'react-native';
import {AppText} from './ui';
import {Icon} from './brand';
import {useTheme} from './theme';

export function PostAction({title,icon,onPress,selected=false,disabled=false,busy=false,accessibilityLabel}){
 const {colors,uiScale}=useTheme();
 return <Pressable onPress={onPress} disabled={disabled||busy} accessibilityRole="button" accessibilityLabel={accessibilityLabel||title} accessibilityState={{selected,disabled:disabled||busy,busy}} style={({pressed})=>({flex:1,minWidth:100,minHeight:44,flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'center',gap:7,padding:8*uiScale,borderRadius:10,backgroundColor:selected?colors.background:'transparent',opacity:disabled||busy?0.55:pressed?0.7:1})}>
  {busy?<ActivityIndicator size="small" color={colors.primary}/>:<Icon name={icon} color={selected?colors.primary:colors.muted}/>}
  <AppText style={{color:selected?colors.primary:colors.muted,fontWeight:'600'}}>{title}</AppText>
 </Pressable>;
}

// A modal-backed anchored dropdown keeps the menu above cards and navigation.
export function PostMenu({label,options}){
 const {colors}=useTheme();const {width,height}=useWindowDimensions();
 const trigger=useRef(null),items=useRef([]);const [anchor,setAnchor]=useState(null);
 function close(){setAnchor(null);if(Platform.OS==='web')requestAnimationFrame(()=>trigger.current?.focus?.());}
 function open(){trigger.current?.measureInWindow((x,y,w,h)=>setAnchor({x,y,w,h}));}
 const menuWidth=Math.min(240,width-32),menuHeight=options.length*52+16;
 function keys(event,index){if(Platform.OS!=='web')return;const key=event.nativeEvent?.key||event.key;let next;
  if(key==='Escape'){event.preventDefault();close();return;}
  if(key==='ArrowDown')next=(index+1)%options.length;if(key==='ArrowUp')next=(index+options.length-1)%options.length;
  if(key==='Home')next=0;if(key==='End')next=options.length-1;
  if(next!==undefined){event.preventDefault();items.current[next]?.focus?.();}
 }
 return <><Pressable ref={trigger} onPress={open} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{expanded:!!anchor}} aria-haspopup="menu" style={({pressed})=>({width:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:pressed?colors.background:'transparent'})}><Icon name="more" size={26}/></Pressable>
 <Modal visible={!!anchor} transparent animationType="fade" onRequestClose={close} onShow={()=>{if(Platform.OS==='web')items.current[0]?.focus?.();}}>
  <View style={{flex:1}}><Pressable accessibilityRole="button" accessibilityLabel="Close post options" onPress={close} style={{position:'absolute',top:0,bottom:0,left:0,right:0,backgroundColor:'#0003'}}/>
  {!!anchor&&<View accessibilityViewIsModal accessibilityRole="menu" accessibilityLabel={label} style={{position:'absolute',top:Math.max(16,Math.min(anchor.y+anchor.h+4,height-menuHeight-16)),left:Math.max(16,Math.min(anchor.x+anchor.w-menuWidth,width-menuWidth-16)),width:menuWidth,padding:8,borderRadius:14,borderColor:colors.border,borderWidth:1,backgroundColor:colors.surface,boxShadow:'0 4px 16px #0003'}}>
   {options.map((option,index)=><Pressable key={option.title} ref={node=>items.current[index]=node} accessibilityRole="menuitem" accessibilityLabel={option.title} onKeyDown={event=>keys(event,index)} onPress={()=>{close();option.onPress();}} style={({pressed})=>({minHeight:52,padding:12,borderRadius:8,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:pressed?colors.background:'transparent'})}><Icon name={option.icon}/><AppText>{option.title}</AppText></Pressable>)}
  </View>}
  </View>
 </Modal></>;
}
