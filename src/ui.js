import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontStyle, useTheme } from './theme';
import {textSize} from './sizing.cjs';

export function AppText({ variant, style, ...props }) {
  const { colors,sizePercent=100,uiScale=0.8 } = useTheme();
  const combined=StyleSheet.flatten([fontStyle,styles.text,{color:colors.text},variant==='title'&&styles.title,variant==='heading'&&styles.heading,variant==='muted'&&{color:colors.muted},style]);
  return <Text {...props} style={[combined,{fontSize:textSize(combined.fontSize||16,sizePercent),lineHeight:Math.max(18,(combined.lineHeight||25)*uiScale)}]} />;
}
export function Page({ children,footer,scrollRef,onScroll,onContentSizeChange }) {
  const { colors,uiScale=0.8 } = useTheme();
  const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={100} onContentSizeChange={onContentSizeChange} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, {padding:20*uiScale, paddingTop: Math.max(insets.top,20*uiScale), paddingBottom: Math.max(insets.bottom, 24*uiScale) }]}>
      <View style={[styles.content,{gap:18*uiScale}]}>{children}</View>
    </ScrollView>
    {!!footer&&<View style={{borderTopWidth:1,borderColor:colors.border,backgroundColor:colors.surface,padding:12*uiScale}}><View style={{width:'100%',maxWidth:720,alignSelf:'center'}}>{footer}</View></View>}
  </KeyboardAvoidingView>;
}
export function Card({ children,style }) {
  const { colors,uiScale=0.8 } = useTheme();
  return <View style={[styles.card, {padding:18*uiScale,gap:14*uiScale,borderRadius:22*uiScale, backgroundColor: colors.surface, borderColor: colors.border },style]}>{children}</View>;
}
export function Button({ title, icon, onPress, secondary, disabled, busy, accessibilityState, ...props }) {
  const { colors,uiScale=0.8 } = useTheme();
  return <Pressable {...props} accessibilityRole="button" aria-selected={accessibilityState?.selected} aria-expanded={accessibilityState?.expanded} aria-busy={busy} accessibilityState={{ ...accessibilityState, disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.button, {minHeight:Math.max(44,48*uiScale),paddingHorizontal:18*uiScale,paddingVertical:12*uiScale,borderRadius:12*uiScale, backgroundColor: secondary ? colors.surface : colors.primary, borderColor: colors.primary, opacity: disabled || busy ? 0.55 : pressed ? 0.8 : 1 }]}>
    {busy && <ActivityIndicator color={secondary ? colors.primary : colors.onPrimary} />}
    {!busy && icon}
    <AppText style={{ color: secondary ? colors.primary : colors.onPrimary, textAlign: 'center', fontWeight: '600', flexShrink: 1 }}>{title}</AppText>
  </Pressable>;
}
export function Field({ label, icon, inputRef, error, style, ...props }) {
  const { colors,uiScale=0.8,sizePercent=100 } = useTheme();
  return <View style={{ gap: 6 }}>
    <AppText>{label}</AppText>
    <View><TextInput ref={inputRef} {...props} accessibilityLabel={label} placeholderTextColor={colors.muted} style={[fontStyle, styles.input, {minHeight:Math.max(44,50*uiScale),padding:12*uiScale,fontSize:textSize(16,sizePercent),lineHeight:Math.max(18,24*uiScale), backgroundColor: colors.input, borderColor: error ? colors.danger : colors.border, color: colors.text }, icon&&{paddingLeft:Math.max(40,46*uiScale)},style]} />
    {!!icon&&<View pointerEvents="none" style={{position:'absolute',left:12,top:0,bottom:0,justifyContent:'center'}}>{icon}</View>}</View>
    {!!error && <AppText accessibilityRole="alert" style={{ color: colors.danger }}>{error}</AppText>}
  </View>;
}
const styles = StyleSheet.create({
  page: { padding: 20, flexGrow: 1 }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 18 },
  text: { fontSize: 16, lineHeight: 25, flexShrink: 1 }, title: { fontSize: 28, lineHeight: 36, fontWeight: '600' }, heading: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 14 },
  button: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, lineHeight: 24, width: '100%' },
});
