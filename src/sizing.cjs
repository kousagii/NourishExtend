const SIZE_OPTIONS=[80,90,100,110,120];
function validSize(value){const number=Number(value);return SIZE_OPTIONS.includes(number)?number:100;}
function sizeScale(value){return 0.8*validSize(value)/100;}
function textSize(value,percent){return Math.max(12,value*sizeScale(percent));}
module.exports={SIZE_OPTIONS,validSize,sizeScale,textSize};
