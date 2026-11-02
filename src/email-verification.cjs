// Supabase generates, expires and verifies the code; never store it in app storage.
const EMAIL_CODE_LENGTH = 8;
function emailAddress(value) {
  const email = String(value || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return email;
}
async function verifyEmailCode(auth, email, value) {
  const address = emailAddress(email);
  const token = String(value || '').replace(/\s/g, '');
  if (!new RegExp('^[0-9]{' + EMAIL_CODE_LENGTH + '}$').test(token)) {
    throw new Error('Enter the ' + EMAIL_CODE_LENGTH + '-digit code from your latest email.');
  }
  const { data, error } = await auth.verifyOtp({ email: address, token, type: 'email' });
  if (error) throw error;
  if (!data?.session?.access_token || !data?.user?.email_confirmed_at) {
    throw new Error('Verification did not complete. Please try again or sign in if you already confirmed your email.');
  }
  return data;
}
async function requestEmailCode(auth, email) {
  const { error } = await auth.resend({ type: 'signup', email: emailAddress(email) });
  if (error) throw error;
}
module.exports = { EMAIL_CODE_LENGTH, verifyEmailCode, requestEmailCode };
