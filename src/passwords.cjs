const CODE_LENGTH=8;
function address(value){const email=String(value||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');return email;}
function validatePassword(password,confirmation){if(typeof password!=='string'||password.length<12)throw new Error('Use at least 12 characters for your password.');if(password!==confirmation)throw new Error('Your new passwords do not match.');}
async function requestPasswordCode(auth,email){const {error}=await auth.resetPasswordForEmail(address(email));if(error)throw error;}
async function verifyPasswordCode(auth,email,value){
 const token=String(value||'').replace(/\s/g,'');if(!new RegExp('^[0-9]{'+CODE_LENGTH+'}$').test(token))throw new Error('Enter the '+CODE_LENGTH+'-digit reset code from your latest email.');
 const {data,error}=await auth.verifyOtp({email:address(email),token,type:'recovery'});if(error)throw error;
 if(!data?.session?.access_token||!data?.user?.id)throw new Error('Password recovery did not complete. Request a new code.');return data;
}
async function changePassword(auth,email,current,password,confirmation){
 validatePassword(password,confirmation);if(!current)throw new Error('Enter your current password.');if(current===password)throw new Error('Choose a different new password.');
 const {data,error}=await auth.signInWithPassword({email:address(email),password:current});if(error)throw new Error('Your current password could not be verified.');
 if(!data?.session?.access_token)throw new Error('Please sign in again before changing your password.');
 const result=await auth.updateUser({password,current_password:current});if(result.error)throw result.error;if(!result.data?.user?.id)throw new Error('Password change was not confirmed. Please try again.');
}
module.exports={CODE_LENGTH,validatePassword,requestPasswordCode,verifyPasswordCode,changePassword};
