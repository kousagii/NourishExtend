import React, { useEffect, useState } from 'react';
import { Page, AppText, Card, Field, Button } from './ui';
import { configured, supabase, redirectUrl } from './backend';
import { useSession } from './session';
import { useTheme } from './theme';
import { EMAIL_CODE_LENGTH, verifyEmailCode, requestEmailCode } from './email-verification.cjs';
import {Brand} from './brand';
import {requestPasswordCode,verifyPasswordCode,validatePassword} from './passwords.cjs';

export default function AuthScreen({ onPrivacy }) {
  const { colors } = useTheme();
  const { recovery, setRecovery } = useSession();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const verifying = mode === 'verify' && !recovery;
  const resetting=mode==='reset-code'&&!recovery;
  useEffect(() => {
    if (!resendAt) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  function changeMode(next) {
    setMode(next); setError(''); setNotice(''); setPassword('');setConfirmPassword(''); setCode('');
  }
  async function cancelRecovery(){setBusy(true);setError('');try{const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error;setRecovery(false);changeMode('signin');}catch{setError('Could not close your reset session. Check your connection and try again.');}finally{setBusy(false);}}
  function cooldown() { setResendAt(Date.now() + 60000); setRemaining(60); }
  async function submit(action = mode) {
    if (busy || (['resend','recover'].includes(action) && resendAt > Date.now())) return;
    setError(''); setNotice('');
    if (!configured) { setError('The Supabase connection has not been configured.'); return; }
    if (!recovery && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if ((recovery || action === 'signup') && password.length < 12) { setError('Use at least 12 characters for your password.'); return; }
    if(recovery){try{validatePassword(password,confirmPassword);}catch(e){setError(e.message);return;}}
    if (action === 'signup' && name.trim().length < 2) { setError('Enter your display name.'); return; }
    setBusy(true);
    try {
      let result;
      if (recovery) result = await supabase.auth.updateUser({ password });
      else if (action === 'verify') {
        await verifyEmailCode(supabase.auth, email, code);
        setCode('');
        setNotice('Email verified. Opening your account…');
        return;
      }
      else if (action === 'resend') {
        // Cool down failed attempts too; the server also enforces its mail limits.
        cooldown();
        await requestEmailCode(supabase.auth, email);
        setCode('');
        setNotice('If your account needs confirmation, a new code will arrive by email. Check your spam folder too.');
        return;
      }
      else if (action === 'signup') result = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() }, emailRedirectTo: redirectUrl } });
      else if(action==='reset-code'){
        await verifyPasswordCode(supabase.auth,email,code);setCode('');setRecovery(true);return;
      }
      else if (action === 'recover') {
        cooldown();await requestPasswordCode(supabase.auth,email);setMode('reset-code');setCode('');setPassword('');
        setNotice('If this email has an account, a reset code will arrive. Check spam too. Enter it here; no browser link is needed.');return;
      }
      else result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      setPassword('');
      if (recovery) { setConfirmPassword('');setRecovery(false); setNotice('Your password was updated.'); }
      else if (action === 'signup') {
        setMode('verify'); setCode(''); cooldown();
        setNotice('Check your email for your verification code.');
      }
      else if (action === 'recover') setNotice('If an account exists, a password-reset email will be sent.');
    } catch (err) {
      setCode('');
      if (action === 'signin' && err.code === 'email_not_confirmed') {
        setPassword(''); setMode('verify');
        setError('Confirm your email before signing in. Request a code below if you need one.');
        return;
      }
      setError(action === 'verify' && ['otp_expired', 'otp_disabled', 'invalid_credentials'].includes(err.code)
        ? 'The code is invalid or has expired. Use the latest email or request a new code.'
        : action === 'signin' ? 'Sign-in failed. Check your email/password and try again.' : err.message || 'The request failed. Please try again.');
    } finally { setBusy(false); }
  }
  return <Page>
    <Brand/>
    <AppText variant="muted">A little extra can mean a lot to someone nearby.</AppText>
    {!configured && <Card><AppText variant="heading">Connect your project</AppText><AppText>Add your Supabase URL and publishable key to .env, apply the database migration, and restart the app. No live data is shown until connected.</AppText></Card>}
    <Card>
      <AppText variant="heading">{recovery ? 'Choose a new password' : resetting?'Reset your password':verifying ? 'Verify your email' : mode === 'signup' ? 'Join your community' : 'Welcome back'}</AppText>
      {!recovery && mode === 'signup' && <Field label="Display name" value={name} onChangeText={setName} maxLength={80} autoComplete="name" />}
      {!recovery && <Field label="Email address" value={email} onChangeText={value => { setEmail(value); setCode(''); }} editable={!busy} keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} />}
      {verifying||resetting ? <>
        <AppText variant="muted">Enter the {EMAIL_CODE_LENGTH}-digit code from your latest {resetting?'password-reset':'confirmation'} email. You can stay in the app.</AppText>
        <Field label="Verification code" value={code} onChangeText={setCode} editable={!busy} maxLength={16} keyboardType="number-pad" inputMode="numeric" autoComplete="one-time-code" textContentType="oneTimeCode" autoCapitalize="none" autoCorrect={false} />
      </> : <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'signup' || recovery ? 'new-password' : 'current-password'} />}
      {recovery&&<Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password"/>}
      {!!error && <AppText accessibilityRole="alert" style={{ color: colors.danger }}>{error}</AppText>}
      {!!notice && <AppText accessibilityLiveRegion="polite" style={{ color: colors.accent }}>{notice}</AppText>}
      <Button title={recovery ? 'Save new password' : resetting?'Verify reset code':verifying ? 'Verify email' : mode === 'signup' ? 'Create account' : 'Sign in'} busy={busy} disabled={!configured} onPress={() => submit()} />
      {!recovery && <>
        {verifying && <Button title={remaining ? 'Send new code in ' + remaining + 's' : 'Send new code'} secondary disabled={busy || remaining > 0 || !configured} onPress={() => submit('resend')} />}
        {resetting && <Button title={remaining?'Send new code in '+remaining+'s':'Send new reset code'} secondary disabled={busy||remaining>0||!configured} onPress={()=>submit('recover')}/>}
        <Button title={mode === 'signin' ? 'Create an account' : 'Back to sign in'} secondary disabled={busy} onPress={() => changeMode(mode === 'signin' ? 'signup' : 'signin')} />
        {mode === 'signin' && <>
          <Button title="Forgot password? Send a reset code" secondary disabled={busy || !email.trim() || !configured||remaining>0} onPress={() => submit('recover')} />
        </>}
      </>}
      {recovery&&<Button secondary title="Cancel password reset" disabled={busy} onPress={cancelRecovery}/>}
    </Card>
    <Button title="Privacy and data use" secondary onPress={onPrivacy} />
  </Page>;
}
