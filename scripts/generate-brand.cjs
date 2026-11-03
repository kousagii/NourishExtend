// Render the existing Home basket vector; no generated/redrawn logo or icon font.
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
let sharp;
try{sharp=require('sharp');}catch{
 try{sharp=require('../.tools/logo-renderer/node_modules/sharp');}catch{
  console.error('Install the optional build tool first: npm.cmd install --prefix .tools/logo-renderer --no-save --ignore-scripts --no-audit --no-fund sharp@0.35.5');process.exit(1);
 }
}
async function write(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);}
async function main(){
 const source=await fs.readFile(path.join(root,'src/brand.js'),'utf8');
 let body=source.match(/export function BasketArt[\s\S]*?<Svg[^>]*>([\s\S]*?)<\/Svg>/)?.[1];
 if(!body)throw new Error('Home basket vector not found. Review the generator after changing BasketArt.');
 body=body.replace(/<(\/?)(Circle|Ellipse|Path|Rect)\b/g,(_,slash,tag)=>'<'+slash+tag.toLowerCase())
  .replace(/\{([\d.]+)\}/g,'"$1"').replace(/strokeWidth=/g,'stroke-width=').replace(/strokeLinejoin=/g,'stroke-linejoin=').replace(/strokeLinecap=/g,'stroke-linecap=');
 if(/[{}]/.test(body))throw new Error('Unexpected dynamic artwork. Review before rendering.');
 const svg=(box,background='')=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${box}">${background}${body}</svg>`);
 const logo=svg('-12 -12 144 144'),adaptive=svg('-40 -40 200 200');
 const icon=svg('-12 -12 144 144','<rect x="-12" y="-12" width="144" height="144" fill="#FAE6D0"/>');
 await write(path.join(root,'Images/home-logo.svg'),logo);
 for(const [name,input,size] of [['icon.png',icon,1024],['adaptive-icon.png',adaptive,1024],['splash-icon.png',logo,1024],['favicon.png',icon,64]]){
  await write(path.join(root,'Images',name),await sharp(input).resize(size,size).png().toBuffer());
 }
 const res=path.join(root,'android/app/src/main/res');
 for(const [density,multiplier] of [['mdpi',1],['hdpi',1.5],['xhdpi',2],['xxhdpi',3],['xxxhdpi',4]]){
  const size=48*multiplier;
  const legacy=await sharp(icon).resize(size,size).png().toBuffer();
  const roundMask=Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`);
  await write(path.join(res,`mipmap-${density}/ic_launcher.webp`),await sharp(legacy).webp({lossless:true}).toBuffer());
  await write(path.join(res,`mipmap-${density}/ic_launcher_round.webp`),await sharp(legacy).composite([{input:roundMask,blend:'dest-in'}]).webp({lossless:true}).toBuffer());
  await write(path.join(res,`mipmap-${density}/ic_launcher_foreground.webp`),await sharp(adaptive).resize(108*multiplier,108*multiplier).webp({lossless:true}).toBuffer());
  const logoSize=160*multiplier,canvasSize=288*multiplier;
  const splashLogo=await sharp(logo).resize(logoSize,logoSize).png().toBuffer();
  const canvas=sharp({create:{width:canvasSize,height:canvasSize,channels:4,background:'#00000000'}});
  await write(path.join(res,`drawable-${density}/splashscreen_logo.png`),await canvas.composite([{input:splashLogo,gravity:'centre'}]).png().toBuffer());
 }
 console.log('Rendered Home basket into app icon, adaptive/round launcher icons, transparent splash logos, and favicon.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
