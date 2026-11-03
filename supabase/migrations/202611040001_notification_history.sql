-- Match historical alerts to the claim that existed when each alert was created.
begin;
update public.notifications n set reservation_id=(
 select r.id from public.reservations r join public.donations d on d.id=r.donation_id
 where r.donation_id=n.donation_id and n.user_id in (r.recipient_id,d.donor_id)
   and r.created_at<=n.created_at
 order by r.created_at desc,r.id desc limit 1
) where n.inquiry_id is null and n.donation_id is not null and n.kind in ('update','pickup_message');
update public.notifications n set title='Inquiry about “'||d.title||'”',body='You received an inquiry about “'||d.title||'”. Open the conversation to read and reply.'
 from public.donations d where n.donation_id=d.id and n.inquiry_id is not null
 and n.body in ('New message about a food donation. Open Messages to reply.','New message about your food listing. Open Messages to reply.');
commit;
