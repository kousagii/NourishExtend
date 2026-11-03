import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { LibreFranklin_400Regular } from '@expo-google-fonts/libre-franklin/400Regular';
import { LibreFranklin_600SemiBold } from '@expo-google-fonts/libre-franklin/600SemiBold';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';

const ThemeContext = createContext(null);
export const THEME_KEY = 'nourish.appearance.v1';
export const palettes = {
  light: { background: '#FAE6D0', surface: '#FFF9F2', text: '#30251F', muted: '#705D50', border: '#9C785B', primary: '#95451F', onPrimary: '#FFFFFF', accent: '#375A3D', danger: '#A02626', input: '#FFFFFF' },
  dark: { background: '#211B17', surface: '#302720', text: '#FFF3E6', muted: '#CDB9A5', border: '#8A7562', primary: '#F2B68E', onPrimary: '#302016', accent: '#ADD2A6', danger: '#FFAAAA', input: '#251F1A' },
};
SplashScreen.preventAutoHideAsync().catch(() => {});
// Approved OFL font; never copy font files from the Windows installation.
export const fontStyle = { fontFamily: Platform.OS === 'web' ? '"Franklin Gothic Medium", LibreFranklin_400Regular' : 'LibreFranklin_400Regular' };
export const headingFont = Platform.OS === 'web' ? fontStyle.fontFamily : 'LibreFranklin_600SemiBold';

export function ThemeProvider({ children }) {
  const [fontsReady, fontError] = useFonts({ LibreFranklin_400Regular, LibreFranklin_600SemiBold });
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState('system');
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_KEY).then(value => {
      if (mounted && ['light', 'dark', 'system'].includes(value)) setPreference(value);
    }).catch(() => { if (mounted) setStorageError('Your appearance preference could not be loaded.'); })
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);
  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark');
  const colors = palettes[isDark ? 'dark' : 'light'];
  const value = useMemo(() => ({
    preference, isDark, colors, storageError,
    async setAppearance(next) {
      if (!['light', 'dark', 'system'].includes(next)) return;
      try {
        await AsyncStorage.setItem(THEME_KEY, next);
        setPreference(next);
        setStorageError('');
      } catch { setStorageError('Could not save appearance. Please try again.'); }
    },
    navigationTheme: { ...(isDark ? DarkTheme : DefaultTheme), fonts: Object.fromEntries(['regular','medium','bold','heavy'].map(weight => [weight,{ fontFamily: weight === 'regular' ? fontStyle.fontFamily : headingFont, fontWeight: weight === 'regular' ? '400' : '600' }])), colors: { ...(isDark ? DarkTheme : DefaultTheme).colors, background: colors.background, card: colors.surface, text: colors.text, primary: colors.primary, border: colors.border } },
  }), [preference, isDark, colors, storageError]);
  useEffect(() => { if (ready && (fontsReady || fontError)) SplashScreen.hideAsync().catch(() => {}); }, [ready, fontsReady, fontError]);
  if (!ready || (!fontsReady && !fontError)) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() { return useContext(ThemeContext); }
