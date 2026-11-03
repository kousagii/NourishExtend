// Specify foreign keys so new relationship tables cannot change embedded authors.
const COMMUNITY_POST_SELECT='*,profiles!community_posts_author_id_fkey(display_name,avatar_path,account_type,organisation_name,verified)';
const INQUIRY_SELECT='*,donor:profiles!inquiries_donor_id_fkey(id,display_name,avatar_path),inquirer:profiles!inquiries_inquirer_id_fkey(id,display_name,avatar_path)';
const PICKUP_CONVERSATIONS_SELECT='*,donations!reservations_donation_id_fkey(id,title,donor_id,donor:profiles!donations_donor_id_fkey(id,display_name,avatar_path)),recipient:profiles!reservations_recipient_id_fkey(id,display_name,avatar_path)';
const PICKUP_SELECT='*,donations!reservations_donation_id_fkey(*,donor:profiles!donations_donor_id_fkey(id,display_name,avatar_path)),recipient:profiles!reservations_recipient_id_fkey(id,display_name,avatar_path)';
const DONATION_INQUIRY_SELECT='id,title,donor_id,status,pickup_deadline,area,donor:profiles!donations_donor_id_fkey(id,display_name,avatar_path)';
module.exports={COMMUNITY_POST_SELECT,INQUIRY_SELECT,PICKUP_CONVERSATIONS_SELECT,PICKUP_SELECT,DONATION_INQUIRY_SELECT};
