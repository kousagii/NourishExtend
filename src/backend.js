import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, processLock } from '@supabase/supabase-js';
import {signalUpdates} from './update-events';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const configured = !!(url && key);
// Browser sessions deliberately use sessionStorage, not persistent localStorage.
// Native refresh tokens use the OS-protected secure store.
const storage = Platform.OS === 'web' ? {
  getItem: key => typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null,
  setItem: (key, value) => { if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value); },
  removeItem: key => { if (typeof window !== 'undefined') window.sessionStorage.removeItem(key); },
} : { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync };

export const supabase = configured ? createClient(url, key, {
  auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web', lock: processLock },
}) : null;
if (supabase && Platform.OS !== 'web') {
  if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
  AppState.addEventListener('change', state => state === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh());
}
export async function rpc(name, params) {
  if (!supabase) throw new Error('Connect the Supabase project before continuing.');
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  if(!['unread_counts','my_profile','community_post_activity'].includes(name))signalUpdates();
  return data;
}
export async function query(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}
export const redirectUrl = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:8081';
export const privacy = {
  operator: process.env.EXPO_PUBLIC_PRIVACY_OPERATOR || 'NourishExtend student project team',
  email: process.env.EXPO_PUBLIC_PRIVACY_EMAIL || 'nourishextend@gmail.com',
  retentionEnabled: process.env.EXPO_PUBLIC_RETENTION_ENABLED === 'true',
};
