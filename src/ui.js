import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontStyle, useTheme } from './theme';

export function AppText({ variant, style, ...props }) {
  const { colors } = useTheme();
  return <Text {...props} style={[fontStyle, styles.text, { color: colors.text }, variant === 'title' && styles.title, variant === 'heading' && styles.heading, variant === 'muted' && { color: colors.muted }, style]} />;
}
export function Page({ children }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingTop: Math.max(insets.top,20), paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.content}>{children}</View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
export function Card({ children }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>;
}
export function Button({ title, onPress, secondary, disabled, busy, accessibilityState, ...props }) {
  const { colors } = useTheme();
  return <Pressable {...props} accessibilityRole="button" accessibilityState={{ ...accessibilityState, disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: secondary ? colors.surface : colors.primary, borderColor: colors.primary, opacity: disabled || busy ? 0.55 : pressed ? 0.8 : 1 }]}>
    {busy && <ActivityIndicator color={secondary ? colors.primary : colors.onPrimary} />}
    <AppText style={{ color: secondary ? colors.primary : colors.onPrimary, textAlign: 'center', fontWeight: '600', flexShrink: 1 }}>{title}</AppText>
  </Pressable>;
}
export function Field({ label, error, style, ...props }) {
  const { colors } = useTheme();
  return <View style={{ gap: 6 }}>
    <AppText>{label}</AppText>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.muted} style={[fontStyle, styles.input, { backgroundColor: colors.input, borderColor: error ? colors.danger : colors.border, color: colors.text }, style]} />
    {!!error && <AppText accessibilityRole="alert" style={{ color: colors.danger }}>{error}</AppText>}
  </View>;
}
const styles = StyleSheet.create({
  page: { padding: 20, flexGrow: 1 }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 18 },
  text: { fontSize: 16, lineHeight: 25, flexShrink: 1 }, title: { fontSize: 28, lineHeight: 36, fontWeight: '600' }, heading: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 14 },
  button: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, lineHeight: 24, width: '100%' },
});
