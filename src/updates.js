import React,{createContext,useContext,useEffect,useState,useCallback,useRef} from 'react';
import {AppState} from 'react-native';
import {useSession} from './session';
import {rpc} from './backend';
import {subscribeUpdates} from './update-events';
const Context=createContext({messages:0,notifications:0,refresh:()=>{}});
export function UpdatesProvider({children}){
 const {session}=useSession();const userId=session?.user.id;
 const [counts,setCounts]=useState({messages:0,notifications:0});const version=useRef(0);
 const refresh=useCallback(async()=>{
  const request=++version.current;if(!userId)return;
  try{const next=await rpc('unread_counts');if(request===version.current)setCounts({messages:Math.max(0,Number(next?.messages)||0),notifications:Math.max(0,Number(next?.notifications)||0)});}catch{/* Keep existing unread indicators on a temporary connection failure. */}
 },[userId]);
 useEffect(()=>{
  setCounts({messages:0,notifications:0});if(!userId)return;
  refresh();const interval=setInterval(refresh,5000);const unsubscribe=subscribeUpdates(refresh);
  const app=AppState.addEventListener('change',state=>{if(state==='active')refresh();});
  return()=>{version.current++;clearInterval(interval);unsubscribe();app.remove();};
 },[refresh,userId]);
 return <Context.Provider value={{...counts,refresh}}>{children}</Context.Provider>;
}
export const useUpdates=()=>useContext(Context);
