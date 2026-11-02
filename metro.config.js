const {getDefaultConfig}=require('expo/metro-config');
const config=getDefaultConfig(__dirname);
const existing=config.resolver.blockList;
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const projectRoots=[__dirname,__dirname.replace(/\\/g,'/')];
config.resolver.blockList=[
  ...(Array.isArray(existing)?existing:existing?[existing]:[]),
  ...projectRoots.map(root=>new RegExp('^'+escape(root)+'[\\\\/](?:\\.tools|\\.local|exports|dist|legacy)[\\\\/]')),
  /(?:^|[\\/])\.env(?:\.[^\\/]*)?$/,
];
module.exports=config;
