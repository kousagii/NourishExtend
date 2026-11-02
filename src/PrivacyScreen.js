import React, { useState } from 'react';
import { Page, Card, AppText, Button } from './ui';
import { privacy } from './backend';
import fontLicence from './font-license.json';
export default function PrivacyScreen({ onBack }) {
  const [licenceOpen,setLicenceOpen] = useState(false);
  if (licenceOpen) return <Page><AppText variant="title">Libre Franklin licence</AppText><AppText>{fontLicence.text}</AppText><Button title="Back to privacy" secondary onPress={()=>setLicenceOpen(false)} /></Page>;
  return <Page>
    <AppText variant="title">Your privacy matters</AppText>
    <Card>
      <AppText variant="heading">Who runs this project</AppText>
      <AppText>{privacy.operator}. This is a school pilot in the Philippines. Contact {privacy.email} for access, correction, deletion, or privacy questions.</AppText>
    </Card>
    <Card>
      <AppText variant="heading">What we collect and share</AppText>
      <AppText>Your email is used for sign-in and account recovery. Other signed-in members can see your display name, organisation name if supplied, donation photos, approximate pickup area, and community posts. Organisation accounts are labelled unverified.</AppText>
      <AppText>Exact pickup instructions and messages are private to the donor and current recipient. Do not put your address or contact details in public titles, descriptions, photos, or community posts.</AppText>
      <AppText>Photos are processed to remove embedded metadata. Supabase processes accounts, records and images; Cloudflare serves the website. Your project region determines primary database location; provider processing can involve other countries.</AppText>
    </Card>
    <Card>
      <AppText variant="heading">Retention and control</AppText>
      <AppText>The agreed policy is to delete pickup details and messages 30 days after the exchange closes, and donation history after 90 days. Community posts and reports are kept up to 90 days, notifications 30 days. Abandoned reservations close one day after their deadline.</AppText>
      <AppText>{privacy.retentionEnabled ? 'Daily cleanup is enabled. Scheduled deletions may take up to one additional day.' : 'Automatic cleanup is not active in this pilot yet. Use fictional demo details until the student team activates and verifies it.'}</AppText>
      <AppText>You can delete your account in Settings. This removes associated app records and photos. Copies already shared with another person cannot be recalled; provider backups may remain according to provider policies.</AppText>
      <AppText>This notice describes the pilot. It is not a certification of legal compliance. The team must confirm its lawful processing basis, school requirements, maintenance schedule and provider terms before collecting real personal data.</AppText>
    </Card>
    <Button title="Font licence" secondary onPress={()=>setLicenceOpen(true)} />
    {onBack && <Button title="Back" secondary onPress={onBack} />}
  </Page>;
}
