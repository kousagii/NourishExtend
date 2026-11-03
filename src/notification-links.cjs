function notificationDestination(item){
 if(item.post_id)return {screen:'CommunityPost',params:{id:item.post_id}};
 if(item.inquiry_id)return {screen:'Inquiry',params:{id:item.inquiry_id}};
 if(item.reservation_id)return {screen:'Pickup',params:{id:item.reservation_id,...(item.kind==='confirm_collection'?{showDetails:true}:{})}};
 if(item.donation_id)return {screen:'Donation',params:{id:item.donation_id}};
 return null;
}
module.exports={notificationDestination};
