import React from 'react';
import {View} from 'react-native';
import Svg,{Path,Circle,Rect,Ellipse} from 'react-native-svg';
import {AppText} from './ui';
import {useTheme} from './theme';

// Original vector artwork: scales cleanly without another icon font or remote assets.
const paths={home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',share:'M12 5v14M5 12h14',community:'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3a6 6 0 0 1 12 0v3M17 4a4 4 0 0 1 0 8M18 15a5 5 0 0 1 4 5',messages:'M3 3h18v14H9l-6 4Z',activity:'M4 5v6h6M4 11a9 9 0 1 1 1 7M12 7v6l4 2',settings:'M9 3 8 6 5 5 3 9l2 2v2l-2 2 2 4 3-1 1 3h6l1-3 3 1 2-4-2-2v-2l2-2-2-4-3 1-1-3ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',bell:'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4',pin:'M12 22S4 14 4 9a8 8 0 1 1 16 0c0 5-8 13-8 13ZM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',calendar:'M3 5h18v16H3ZM7 2v6M17 2v6M3 10h18',chevron:'m7 10 5 5 5-5',check:'m4 12 5 5L20 6',close:'m5 5 14 14M5 19 19 5',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6',photo:'M3 4h18v16H3ZM3 17l6-6 5 5 3-3 4 4M16 7h.01',clock:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 6v7l4 2'};
export function Icon({name,size=23,color}){const {colors}=useTheme();return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}><Path d={paths[name]||paths.share} stroke={color||colors.primary} fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"/></Svg>;}
export function BasketArt({size=100}){return <Svg width={size} height={size} viewBox="0 0 120 120" accessible={false}>
  <Circle cx="60" cy="60" r="58" fill="#E8EFCF"/><Ellipse cx="60" cy="98" rx="34" ry="5" fill="#CED9AE"/>
  <Path d="M30 56c-10-30 8-36 18-17l10 25" fill="#F5BA70" stroke="#61452D" strokeWidth="2.5"/>
  <Path d="m29 41 9-4m-6 14 9-4" stroke="#95603C" strokeWidth="2.5"/>
  <Path d="M67 57c-14-18-5-26 4-22-1-17 16-18 18-7 17-3 17 15 5 20 4 11-8 20-19 13" fill="#6E965E" stroke="#375A3D" strokeWidth="2.5"/>
  <Path d="m78 41-7 30" stroke="#375A3D" strokeWidth="3"/>
  <Circle cx="57" cy="60" r="14" fill="#EB8159" stroke="#95451F" strokeWidth="2.5"/>
  <Path d="m53 44 5 7 7-5" stroke="#375A3D" strokeWidth="3" fill="none"/>
  <Path d="m24 66 8 29h57l8-29Z" fill="#FFD18C" stroke="#61452D" strokeWidth="3" strokeLinejoin="round"/>
  <Rect x="20" y="60" width="81" height="10" rx="5" fill="#FFF9F2" stroke="#61452D" strokeWidth="3"/>
  <Path d="M44 76v12m16-12v12m16-12v12" stroke="#B8763A" strokeWidth="3" strokeLinecap="round"/>
 </Svg>;}
export function Brand({compact=false}){const {colors}=useTheme();return <View style={{flexDirection:'row',alignItems:'center',gap:12,flexWrap:'wrap'}}><BasketArt size={compact?40:66}/><View style={{flexShrink:1}}><AppText style={{fontSize:compact?18:28,lineHeight:compact?26:35,fontWeight:'600',color:colors.primary}}>{'Nourish\u200bExtend'}</AppText>{!compact&&<AppText variant="muted">Share food, spread hope.</AppText>}</View></View>;}
