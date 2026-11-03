function phtParts(date){const shifted=new Date(new Date(date).getTime()+8*3600000);return {date:shifted.toISOString().slice(0,10),time:shifted.toISOString().slice(11,16)};}
function deadlineISO(value){if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value||''))return null;const d=new Date(value.replace(' ','T')+':00+08:00');if(!Number.isFinite(d.getTime()))return null;const p=phtParts(d);return `${p.date} ${p.time}`===value?d.toISOString():null;}
module.exports={phtParts,deadlineISO};
