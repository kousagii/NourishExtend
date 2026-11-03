function inquiryMember(thread,userId){return thread.donor_id===userId?thread.inquirer:thread.donor;}
function pickupMember(thread,userId){return thread.donations?.donor_id===userId?thread.recipient:thread.donations?.donor;}
function conversationList({inquiries=[],pickups=[]},userId){
 const rows=[...inquiries.map(thread=>({type:'inquiry',thread,member:inquiryMember(thread,userId)})),...pickups.map(thread=>({type:'pickup',thread,member:pickupMember(thread,userId)}))];
 return rows.map(row=>{
  const t=row.thread,own=row.type==='inquiry'?t.donor_id===userId:t.donations?.donor_id===userId;
  const read=own?t.donor_read_at:row.type==='inquiry'?t.inquirer_read_at:t.recipient_read_at;
  const unread=!!t.last_message_at&&(!read||new Date(read)<new Date(t.last_message_at))&&(row.type==='inquiry'||t.last_sender_id!==userId);
  return {...row,key:row.type+':'+t.id,timestamp:t.last_message_at||t.created_at,unread};
 }).sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0)||a.key.localeCompare(b.key));
}
function chatDay(stamp){return new Date(stamp).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'});}
function chatTime(stamp){return new Date(stamp).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'});}
module.exports={inquiryMember,pickupMember,conversationList,chatDay,chatTime};
