const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyEmailCode, requestEmailCode } = require('../src/email-verification.cjs');

test('invalid email or code never reaches the verification endpoint', async () => {
  let calls = 0;
  const auth = { verifyOtp() { calls++; throw new Error('Unexpected network call'); } };
  for (const [email, code] of [['not-an-email', '12345678'], ['demo@example.test', ''], ['demo@example.test', '1234567'], ['demo@example.test', '123456789'], ['demo@example.test', 'abcdefgh']]) {
    await assert.rejects(verifyEmailCode(auth, email, code));
  }
  assert.equal(calls, 0);
});

test('verification uses the email OTP endpoint without a browser redirect', async () => {
  const verified = { user: { email_confirmed_at: '2026-01-01T00:00:00Z' }, session: { access_token: 'TEST_ONLY_SESSION' } };
  const auth = { async verifyOtp(params) {
    assert.deepEqual(params, { email: 'demo@example.test', token: '12345678', type: 'email' });
    return { data: verified, error: null };
  } };
  assert.equal(await verifyEmailCode(auth, ' demo@example.test ', '1234 5678'), verified);
});

test('expired codes and missing verified sessions are never reported as success', async () => {
  const expired = Object.assign(new Error('Code expired'), { code: 'otp_expired' });
  await assert.rejects(verifyEmailCode({ verifyOtp: async () => ({ error: expired }) }, 'demo@example.test', '12345678'), error => error === expired);
  for (const data of [null, { user: { email_confirmed_at: '2026-01-01' }, session: null }, { user: {}, session: { access_token: 'TEST_ONLY_SESSION' } }]) {
    await assert.rejects(verifyEmailCode({ verifyOtp: async () => ({ data, error: null }) }, 'demo@example.test', '12345678'), /Verification did not complete/);
  }
});

test('resending confirms an existing signup and propagates mail/rate-limit errors', async () => {
  let calls = 0;
  const auth = { async resend(params) { calls++; assert.deepEqual(params, { type: 'signup', email: 'demo@example.test' }); return { error: null }; } };
  await requestEmailCode(auth, ' demo@example.test ');
  assert.equal(calls, 1);
  await assert.rejects(requestEmailCode(auth, 'invalid'));
  assert.equal(calls, 1);
  const limited = Object.assign(new Error('Mail rate limit'), { code: 'over_email_send_rate_limit' });
  await assert.rejects(requestEmailCode({ resend: async () => ({ error: limited }) }, 'demo@example.test'), error => error === limited);
});
