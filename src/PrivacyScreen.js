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
      <AppText>Your email is used for sign-in and account recovery. Other signed-in members can see your display name, profile photo, short bio, organisation name if supplied, donation photos, approximate pickup area, community posts and comments. Organisation accounts are labelled unverified.</AppText>
      <AppText>When you like a community post, we store your account ID, the post ID and the time so you can undo it. Other members see aggregate like counts, not a list of who liked a post. Likes are removed when you unlike, delete your account, or the post is deleted. Counts exclude members you have blocked or who blocked you.</AppText>
      <AppText>Exact pickup instructions are private to the donor and current recipient. Pre-reservation inquiries are private to the donor and the person asking; an inquiry does not reserve food or reveal private pickup instructions. Do not put your address or contact details in public titles, descriptions, photos, community posts, or pre-reservation inquiries.</AppText>
      <AppText>Photos are processed to remove embedded metadata. Supabase processes accounts, records and images; Cloudflare serves the website. Your project region determines primary database location; provider processing can involve other countries.</AppText>
      <AppText>Photos use temporary links. Someone who already has a copied link may view it until it expires (up to 10 minutes). Removing a profile photo hides it from your profile; unlinked photo files are removed by maintenance after a one-day grace period when cleanup is active.</AppText>
    </Card>
    <Card>
      <AppText variant="heading">Retention and control</AppText>
      <AppText>The agreed policy is to delete pickup details and pickup messages 30 days after the exchange closes, and donation history after 90 days. Inquiry conversations are removed after 30 days of inactivity or 30 days after the listing closes/expires, whichever comes first. Community posts and reports are kept up to 90 days, notifications 30 days. Abandoned reservations close one day after their deadline.</AppText>
      <AppText>{privacy.retentionEnabled ? 'Daily cleanup is enabled. Scheduled deletions may take up to one additional day.' : 'Automatic cleanup is not active in this pilot yet. Use fictional demo details until the student team activates and verifies it.'}</AppText>
      <AppText>You can delete your account in Settings. This removes associated app records and photos. Copies already shared with another person cannot be recalled; provider backups may remain according to provider policies.</AppText>
      <AppText>This notice describes the pilot. It is not a certification of legal compliance. The team must confirm its lawful processing basis, school requirements, maintenance schedule and provider terms before collecting real personal data.</AppText>
    </Card>
    <Button title="Font licence" secondary onPress={()=>setLicenceOpen(true)} />
    {onBack && <Button title="Back" secondary onPress={onBack} />}
  </Page>;
}
